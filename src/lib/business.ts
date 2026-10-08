import { supabase, bizguardDebug, normalizeUuid } from './supabase';
import type { Business } from '../types';
import type { Database } from './database.types';

type BusinessRow = Database['public']['Tables']['businesses']['Row'];
type UserProfileRow = Database['public']['Tables']['users']['Row'];

const PLACEHOLDER_UUIDS = new Set([
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
]);

const isPlaceholderUuid = (value?: string | null) => !value || PLACEHOLDER_UUIDS.has(value);

export const toAppBusiness = (business: BusinessRow): Business => ({
  id: business.id,
  name: business.name,
  type: ['retail', 'wholesale', 'pharmacy', 'restaurant', 'school', 'church', 'service', 'other'].includes(business.type)
    ? business.type as Business['type']
    : 'retail',
  industry: business.industry,
  location: business.location || '',
  currency: business.currency || 'NGN',
  timezone: business.timezone || 'Africa/Lagos',
  createdAt: business.created_at,
  settings: {
    fiscalYearStart: '01-01',
    taxRate: 7.5,
    lowStockThreshold: 10,
    enableDebtors: true,
    enableAI: true,
    ...(typeof business.settings === 'object' && business.settings !== null ? business.settings : {}),
  },
});

const getBusinessById = async (businessId: string) => {
  if (isPlaceholderUuid(businessId)) {
    bizguardDebug('business.getBusinessById.skipPlaceholder', { businessId });
    return null;
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  bizguardDebug('business.getBusinessById', { businessId, loadedBusinessId: data?.id || null, error: error?.message || null });
  if (error) throw error;
  return data;
};

const upsertUserProfile = async (params: {
  userId: string;
  email: string;
  name: string;
  businessId: string;
  role?: string | null;
}) => {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: params.userId,
      email: params.email,
      name: params.name,
      business_id: params.businessId,
      role: params.role || 'owner',
    }, { onConflict: 'id' })
    .select('*')
    .single();

  bizguardDebug('business.upsertUserProfile', { userId: params.userId, businessId: params.businessId, profileBusinessId: data?.business_id || null, error: error?.message || null });
  if (error) throw error;
  return data as UserProfileRow;
};

const createBusinessAndLinkUser = async (params: {
  userId: string;
  email: string;
  profile: UserProfileRow | null;
  businessName?: string | null;
  industry?: string | null;
}) => {
  const name = params.businessName || `${params.profile?.name || params.email.split('@')[0] || 'My'} Business`;
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name,
      industry: params.industry || 'General',
      type: 'retail',
      location: '',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
    })
    .select('*')
    .single();

  bizguardDebug('business.createFallbackBusiness', { userId: params.userId, businessId: business?.id || null, error: businessError?.message || null });
  if (businessError) throw businessError;

  const updatedProfile = await upsertUserProfile({
    userId: params.userId,
    email: params.profile?.email || params.email,
    name: params.profile?.name || params.email.split('@')[0] || 'Business Owner',
    businessId: business.id,
    role: params.profile?.role || 'owner',
  });

  await supabase.auth.updateUser({
    data: {
      business_id: business.id,
      business_name: business.name,
    },
  });

  return { business, profile: updatedProfile };
};

export const ensureBusinessContext = async (options?: { businessName?: string | null; industry?: string | null }) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  bizguardDebug('business.ensure.auth', { userId: user?.id || null, metadataBusinessId: user?.user_metadata?.business_id || null, error: userError?.message || null });
  if (userError) throw userError;
  if (!user) return { user: null, profile: null, business: null };

  const userEmail = user.email || '';
  const fallbackName = user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0] || 'Business Owner';

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  bizguardDebug('business.ensure.publicUsers', { userId: user.id, profileId: profile?.id || null, profileBusinessId: profile?.business_id || null, error: profileError?.message || null });
  if (profileError) throw profileError;

  let typedProfile = profile as UserProfileRow | null;
  let business: BusinessRow | null = null;

  if (typedProfile?.business_id && !isPlaceholderUuid(typedProfile.business_id)) {
    business = await getBusinessById(typedProfile.business_id);
  }

  const metadataBusinessId = normalizeUuid(user.user_metadata?.business_id);
  if (!business && metadataBusinessId && !isPlaceholderUuid(metadataBusinessId)) {
    business = await getBusinessById(metadataBusinessId);
    if (business) {
      typedProfile = await upsertUserProfile({
        userId: user.id,
        email: typedProfile?.email || userEmail,
        name: typedProfile?.name || fallbackName,
        businessId: business.id,
        role: typedProfile?.role || 'owner',
      });
    }
  }

  if (!business) {
    const rpcResult = await supabase.rpc('repair_current_auth_business_link');
    bizguardDebug('business.ensure.repairCurrentAuthBusinessLink', { userId: user.id, businessId: rpcResult.data?.id || null, error: rpcResult.error?.message || null });

    if (!rpcResult.error && rpcResult.data) {
      business = rpcResult.data as BusinessRow;
      const { data: repairedProfile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      typedProfile = (repairedProfile || typedProfile) as UserProfileRow | null;
    }
  }

  if (!business) {
    const rpcResult = await supabase.rpc('ensure_business_for_current_user', {
      p_business_name: options?.businessName || user.user_metadata?.business_name || null,
      p_industry: options?.industry || user.user_metadata?.industry || null,
    });

    bizguardDebug('business.ensure.ensureBusinessForCurrentUser', { userId: user.id, businessId: rpcResult.data?.id || null, error: rpcResult.error?.message || null });

    if (!rpcResult.error && rpcResult.data) {
      business = rpcResult.data as BusinessRow;
      const { data: repairedProfile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      typedProfile = (repairedProfile || typedProfile) as UserProfileRow | null;
    }
  }

  if (!business) {
    const fallback = await createBusinessAndLinkUser({
      userId: user.id,
      email: userEmail,
      profile: typedProfile,
      businessName: options?.businessName || user.user_metadata?.business_name || null,
      industry: options?.industry || user.user_metadata?.industry || null,
    });
    business = fallback.business;
    typedProfile = fallback.profile;
  }

  if (business && (!typedProfile?.business_id || typedProfile.business_id !== business.id)) {
    typedProfile = await upsertUserProfile({
      userId: user.id,
      email: typedProfile?.email || userEmail,
      name: typedProfile?.name || fallbackName,
      businessId: business.id,
      role: typedProfile?.role || 'owner',
    });
  }

  bizguardDebug('business.ensure.result', {
    userId: user.id,
    profileId: typedProfile?.id || null,
    profileBusinessId: typedProfile?.business_id || null,
    loadedBusinessId: business?.id || null,
    loadedBusinessName: business?.name || null,
  });

  return { user, profile: typedProfile, business };
};

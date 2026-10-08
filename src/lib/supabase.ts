import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
export const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL. Add it to .env.local and your deployment environment.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY. Add it to .env.local and your deployment environment.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

export const bizguardDebug = (scope: string, payload: Record<string, unknown>) => {
  if (!DEBUG) return;
  console.info(`[BizGuard:${scope}]`, payload);
};

export const normalizeUuid = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

export const normalizeNullableText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

export const getAppUrl = () => import.meta.env.VITE_APP_URL || window.location.origin;

const isMissingFunctionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('Could not find the function') || message.includes('function') || message.includes('PGRST202') || message.includes('404');
};

export const ensureUserProfile = async (options?: {
  businessId?: string | null;
  name?: string | null;
  businessName?: string | null;
  industry?: string | null;
}) => {
  const providedBusinessId = options?.businessId?.trim();
  if (providedBusinessId && !normalizeUuid(providedBusinessId)) {
    return { profile: null, error: new Error('Invalid business ID. Please refresh and try again.') };
  }

  const normalizedBusinessId = normalizeUuid(options?.businessId);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { profile: null, error: userError || new Error('Authentication required') };

  const rpcResult = await supabase.rpc('ensure_user_profile', {
    p_business_id: normalizedBusinessId,
    p_name: normalizeNullableText(options?.name),
    p_business_name: normalizeNullableText(options?.businessName),
    p_industry: normalizeNullableText(options?.industry),
  });

  if (!rpcResult.error) {
    bizguardDebug('ensureUserProfile.rpc.success', { userId: user.id, business_id: rpcResult.data?.business_id || null });
    return { profile: rpcResult.data, error: null };
  }

  bizguardDebug('ensureUserProfile.rpc.failed', { userId: user.id, error: rpcResult.error.message });

  if (!isMissingFunctionError(rpcResult.error)) {
    // The database repair RPC is authoritative, but legacy deployments can
    // still have an older business_members role constraint. Do not make Snap
    // unusable just because the repair RPC is temporarily incompatible; the
    // server-side Vision gateway remains the authoritative business check.
    // Fall back to the direct public.users repair path when RLS permits it.
    bizguardDebug('ensureUserProfile.rpc.compatibilityFallback', { userId: user.id, error: rpcResult.error.message });
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      email: user.email || '',
      name: normalizeNullableText(options?.name) || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Business Owner',
      business_id: normalizedBusinessId,
      role: 'owner',
    }, { onConflict: 'id' })
    .select('*')
    .single();

  bizguardDebug('ensureUserProfile.fallback', { userId: user.id, business_id: data?.business_id || null, error: error?.message || null });
  return { profile: data, error };
};

export const ensureProfile = async (options?: {
  businessId?: string | null;
  fullName?: string | null;
  businessName?: string | null;
  industry?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { profile: null, error: userError || new Error('Authentication required') };

  const providedBusinessId = options?.businessId?.trim();
  if (providedBusinessId && !normalizeUuid(providedBusinessId)) {
    return { profile: null, error: new Error('Invalid business ID. Please refresh and try again.') };
  }

  const { data, error } = await supabase.rpc('ensure_profile_for_auth_user', {
    p_user_id: user.id,
    p_business_id: normalizeUuid(options?.businessId),
    p_full_name: normalizeNullableText(options?.fullName),
    p_business_name: normalizeNullableText(options?.businessName),
    p_industry: normalizeNullableText(options?.industry),
    p_phone: normalizeNullableText(options?.phone),
    p_avatar_url: normalizeNullableText(options?.avatarUrl),
  });

  if (error) {
    bizguardDebug('ensureProfile.optional.failed', { userId: user.id, error: error.message });
    return { profile: null, error: null };
  }

  return { profile: data, error: null };
};

export const signUp = async (email: string, password: string, businessName: string, name?: string, businessId?: string | null) => {
  const providedBusinessId = businessId?.trim();
  if (providedBusinessId && !normalizeUuid(providedBusinessId)) {
    return {
      data: { user: null, session: null },
      error: new Error('Invalid business ID. Please refresh and try again.'),
    };
  }

  const normalizedBusinessId = normalizeUuid(businessId);
  const normalizedName = normalizeNullableText(name) || email.split('@')[0];

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/`,
      data: {
        business_id: normalizedBusinessId,
        business_name: normalizeNullableText(businessName),
        name: normalizedName,
        full_name: normalizedName,
        role: 'business_owner',
      },
    },
  });

  bizguardDebug('signUp.result', { userId: data.user?.id || null, session: Boolean(data.session), error: error?.message || null });
  if (error) return { data, error };

  if (data.session) {
    const { error: userProfileError } = await ensureUserProfile({ businessId: normalizedBusinessId, name: normalizedName, businessName });
    if (userProfileError) return { data, error: userProfileError };
    await ensureProfile({ businessId: normalizedBusinessId, fullName: normalizedName, businessName });
  }

  return { data, error: null };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  bizguardDebug('signIn.result', { userId: data.user?.id || null, error: error?.message || null });
  if (error) return { data, error };

  try {
    await ensureUserProfile({
      businessId: normalizeUuid(data.user?.user_metadata?.business_id),
      name: data.user?.user_metadata?.name,
      businessName: data.user?.user_metadata?.business_name,
      industry: data.user?.user_metadata?.industry,
    });
    await ensureProfile({
      businessId: normalizeUuid(data.user?.user_metadata?.business_id),
      fullName: data.user?.user_metadata?.full_name || data.user?.user_metadata?.name,
      businessName: data.user?.user_metadata?.business_name,
      industry: data.user?.user_metadata?.industry,
      phone: data.user?.user_metadata?.phone,
      avatarUrl: data.user?.user_metadata?.avatar_url,
    });
  } catch (profileRepairError) {
    bizguardDebug('signIn.profileRepair.nonFatal', { userId: data.user?.id || null, error: profileRepairError instanceof Error ? profileRepairError.message : String(profileRepairError) });
  }

  return { data, error: null };
};

export const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/`,
      shouldCreateUser: false,
    },
  });
  return { data, error };
};

export const resendEmailVerification = async (email: string) => {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/`,
    },
  });
  return { data, error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/login`,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  bizguardDebug('auth.getUser', { userId: user?.id || null, metadataBusinessId: user?.user_metadata?.business_id || null, error: error?.message || null });
  return { user, error };
};

export const getCurrentProfile = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  bizguardDebug('getCurrentProfile.auth', { userId: user?.id || null, metadataBusinessId: user?.user_metadata?.business_id || null, error: userError?.message || null });
  if (userError || !user) return { user: null, profile: null, error: userError };

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  bizguardDebug('getCurrentProfile.publicUsers', { userId: user.id, profileId: profile?.id || null, profileBusinessId: profile?.business_id || null, error: error?.message || null });
  if (error) return { user, profile: null, error };
  if (profile) {
    await ensureProfile({ businessId: profile.business_id, fullName: profile.name, businessName: user.user_metadata?.business_name, industry: user.user_metadata?.industry });
    return { user, profile, error: null };
  }

  const { profile: createdProfile, error: profileError } = await ensureUserProfile({
    businessId: normalizeUuid(user.user_metadata?.business_id),
    name: user.user_metadata?.name || user.user_metadata?.full_name,
    businessName: user.user_metadata?.business_name,
    industry: user.user_metadata?.industry,
  });

  if (!profileError) {
    await ensureProfile({
      businessId: createdProfile?.business_id || normalizeUuid(user.user_metadata?.business_id),
      fullName: createdProfile?.name || user.user_metadata?.full_name || user.user_metadata?.name,
      businessName: user.user_metadata?.business_name,
      industry: user.user_metadata?.industry,
    });
  }

  bizguardDebug('getCurrentProfile.createdOrRepaired', { userId: user.id, business_id: createdProfile?.business_id || null, error: profileError?.message || null });
  return { user, profile: createdProfile, error: profileError };
};

export default supabase;

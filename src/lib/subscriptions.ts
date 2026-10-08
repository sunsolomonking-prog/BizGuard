import { supabase } from './supabase';
import type { Json } from './database.types';

export type SubscriptionPlanCode = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type VoiceIntent = 'sale' | 'inventory' | 'debtor' | 'expense' | 'report' | 'opportunity' | 'prediction' | 'risk' | 'unknown';

export interface PlanDefinition {
  code: SubscriptionPlanCode;
  name: string;
  monthlyPrice: number;
  dailyLimit: number | null;
  snapCountLimit: number | null;
  freeCommands: number;
  premiumCommands: number | null;
  unlimited: boolean;
  targetUsers: string[];
  features: string[];
  limitMessage: string;
}

export interface VoiceUsageStatus {
  business_id: string;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  used_today: number;
  remaining_today: number | null;
  daily_limit: number | null;
  is_unlimited: boolean;
  reset_at: string;
  upgrade_message: string;
}

export interface ParsedVoiceCommand {
  intent: VoiceIntent;
  amount?: number | null;
  quantity?: number | null;
  normalized_text?: string;
  confidence?: number;
  raw?: Json;
}

export interface SnapUsageStatus {
  business_id: string;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  used_today: number;
  remaining_today: number | null;
  daily_limit: number | null;
  is_unlimited: boolean;
  reset_at: string;
  upgrade_message: string;
}

export interface SnapCountReservation {
  allowed: boolean;
  reservation_id?: string | null;
  plan_code: SubscriptionPlanCode;
  used_today: number;
  remaining_today: number | null;
  daily_limit: number | null;
  is_unlimited: boolean;
  message: string;
}

export interface VoiceCommandResult {
  allowed: boolean;
  plan_code: SubscriptionPlanCode;
  used_today: number;
  remaining_today: number | null;
  daily_limit: number | null;
  is_unlimited: boolean;
  message: string;
  parsed_payload: ParsedVoiceCommand;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    code: 'free',
    name: 'Free',
    monthlyPrice: 0,
    dailyLimit: 3,
    snapCountLimit: 3,
    freeCommands: 3,
    premiumCommands: 0,
    unlimited: false,
    targetUsers: ['Students', 'Micro Businesses', 'Market Traders', 'Startups'],
    features: ['Basic Sales Tracking', 'Basic Inventory Tracking', 'Basic Debtor Tracking', 'Daily Revenue Overview', 'Profit Calculation', 'Business Health Score', 'One Device Access', 'Maximum 50 Products'],
    limitMessage: 'You have exhausted your free Voice AI usage for today. Upgrade to Starter, Pro, Business or Enterprise to continue.',
  },
  {
    code: 'starter',
    name: 'Starter',
    monthlyPrice: 5000,
    dailyLimit: 8,
    snapCountLimit: 8,
    freeCommands: 3,
    premiumCommands: 5,
    unlimited: false,
    targetUsers: ['Food Vendors', 'Phone Shops', 'Fashion Stores', 'Small Supermarkets'],
    features: ['Unlimited Products', 'WhatsApp Alerts', 'Debtor Reminders', 'Smart Restock Suggestions', 'Expiry Alerts', 'Export Reports', 'Multi-device Access (3 Devices)'],
    limitMessage: "You have reached today's Voice AI limit. Upgrade to Pro for more Voice AI access.",
  },
  {
    code: 'pro',
    name: 'Pro',
    monthlyPrice: 10000,
    dailyLimit: 50,
    snapCountLimit: 50,
    freeCommands: 0,
    premiumCommands: 50,
    unlimited: false,
    targetUsers: ['Growing Businesses', 'Pharmacies', 'Boutiques', 'Retail Stores'],
    features: ['AI Business Doctor', 'Barcode Scanner', 'AI Forecasting', 'Debtor Risk Analysis', 'Voice-to-Sales', 'Voice-to-Inventory', 'Voice-to-Expense', 'Voice-to-Debtor'],
    limitMessage: 'Upgrade to Business Plan for higher Voice AI capacity.',
  },
  {
    code: 'business',
    name: 'Business',
    monthlyPrice: 25000,
    dailyLimit: 100,
    snapCountLimit: 100,
    freeCommands: 0,
    premiumCommands: 100,
    unlimited: false,
    targetUsers: ['Schools', 'Hospitals', 'Churches', 'Medium Organizations'],
    features: ['Multi-Branch Dashboard', 'Staff Accounts', 'Audit Logs', 'Centralized Reporting', 'Approval Workflow'],
    limitMessage: 'Upgrade to Enterprise Plan for unlimited Voice AI.',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 100000,
    dailyLimit: null,
    snapCountLimit: null,
    freeCommands: 0,
    premiumCommands: null,
    unlimited: true,
    targetUsers: ['Manufacturers', 'Distributors', 'Franchises', 'Large Organizations'],
    features: ['White Label Version', 'API Access', 'Custom AI Models', 'Dedicated Support', 'Priority Support', 'Custom Integrations', 'Unlimited Voice Commands'],
    limitMessage: 'Unlimited Voice AI enabled.',
  },
];

export const getPlanDefinition = (code?: string | null) => PLAN_DEFINITIONS.find((plan) => plan.code === code) || PLAN_DEFINITIONS[0];

export interface BusinessSubscriptionStatus {
  business_id: string;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  status: string;
  monthly_price_ngn: number;
  current_period_ends_at: string | null;
}

export const getBusinessSubscriptionStatus = async (businessId: string): Promise<BusinessSubscriptionStatus | null> => {
  const { data, error } = await supabase.rpc('get_business_subscription', { target_business_id: businessId });
  if (error) throw error;
  return (data?.[0] || null) as BusinessSubscriptionStatus | null;
};

const fallbackVoiceStatus = (businessId: string): VoiceUsageStatus => ({
  business_id: businessId,
  plan_code: 'free',
  plan_name: 'Free',
  used_today: 0,
  remaining_today: 3,
  daily_limit: 3,
  is_unlimited: false,
  reset_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
  upgrade_message: 'Voice AI available.',
});

export const getVoiceUsageStatus = async (businessId: string): Promise<VoiceUsageStatus> => {
  const { data, error } = await supabase.rpc('get_voice_ai_usage_status', { target_business_id: businessId });
  if (!error && data?.[0]) return data[0] as VoiceUsageStatus;

  // Resilient read path: the UI should remain usable while an older deployment
  // catches up with the runtime RPC migration. Never treat a missing RPC as a
  // reason to expose SQL instructions to an end user.
  try {
    const [{ data: subscription }, { data: usage }] = await Promise.all([
      supabase.from('business_subscriptions').select('plan_code,status,current_period_ends_at,updated_at').eq('business_id', businessId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('voice_ai_usage').select('total_commands_used').eq('business_id', businessId).eq('usage_date', new Date().toISOString().slice(0, 10)).maybeSingle(),
    ]);
    const planCode = (subscription?.plan_code || 'free') as SubscriptionPlanCode;
    const plan = getPlanDefinition(planCode);
    const used = Number(usage?.total_commands_used || 0);
    return {
      business_id: businessId,
      plan_code: plan.code,
      plan_name: plan.name,
      used_today: used,
      remaining_today: plan.unlimited ? null : Math.max((plan.dailyLimit || 0) - used, 0),
      daily_limit: plan.unlimited ? null : plan.dailyLimit,
      is_unlimited: plan.unlimited,
      reset_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
      upgrade_message: plan.unlimited ? 'Unlimited Voice AI enabled.' : 'Voice AI available.',
    };
  } catch {
    return fallbackVoiceStatus(businessId);
  }
};



export const getSnapCountUsageStatus = async (businessId: string): Promise<SnapUsageStatus> => {
  const { data, error } = await supabase.rpc('get_snap_count_usage_status', { target_business_id: businessId });
  if (!error && data?.[0]) return data[0] as SnapUsageStatus;

  // Targeted compatibility read: preserve the existing plan structure and keep
  // the Subscription/Snap UI usable while an older database deployment catches
  // up. This read never grants entitlement; reserve_snap_count remains the
  // authoritative gate for an actual Snap analysis.
  try {
    const [{ data: subscription }, { data: usage }] = await Promise.all([
      supabase.from('business_subscriptions')
        .select('plan_code,status,updated_at')
        .eq('business_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('snap_count_usage')
        .select('snap_counts_used')
        .eq('business_id', businessId)
        .eq('usage_date', new Date().toISOString().slice(0, 10))
        .maybeSingle(),
    ]);
    const plan = getPlanDefinition((subscription?.plan_code || 'free') as SubscriptionPlanCode);
    const used = Number(usage?.snap_counts_used || 0);
    return {
      business_id: businessId,
      plan_code: plan.code,
      plan_name: plan.name,
      used_today: used,
      remaining_today: plan.snapCountLimit === null ? null : Math.max(plan.snapCountLimit - used, 0),
      daily_limit: plan.snapCountLimit,
      is_unlimited: plan.snapCountLimit === null,
      reset_at: new Date(Date.now() + 86400000).toISOString(),
      upgrade_message: plan.snapCountLimit === null
        ? 'Unlimited Snap Count enabled.'
        : used >= plan.snapCountLimit
          ? 'You have reached today’s Snap Count limit. Choose a higher plan to continue.'
          : 'Snap Count available.',
    };
  } catch {
    // Free is the safe display fallback. It does not bypass the server-side
    // reservation gate.
    return {
      business_id: businessId,
      plan_code: 'free',
      plan_name: 'Free',
      used_today: 0,
      remaining_today: 3,
      daily_limit: 3,
      is_unlimited: false,
      reset_at: new Date(Date.now() + 86400000).toISOString(),
      upgrade_message: 'Snap Count available.',
    };
  }
};

export const recordVoiceCommand = async (businessId: string, commandText: string): Promise<VoiceCommandResult> => {
  const { data, error } = await supabase.rpc('record_voice_ai_command', {
    target_business_id: businessId,
    command_text: commandText,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Voice command result was not returned.');
  return {
    ...row,
    parsed_payload: normalizeParsedPayload(row.parsed_payload),
  } as VoiceCommandResult;
};

export const changeSubscriptionPlan = async (businessId: string, planCode: SubscriptionPlanCode, provider = 'manual') => {
  const { data, error } = await supabase.rpc('change_business_subscription', {
    target_business_id: businessId,
    target_plan_code: planCode,
    target_provider: provider,
  });
  if (error) throw error;
  return data;
};

export const normalizeParsedPayload = (payload: Json): ParsedVoiceCommand => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { intent: 'unknown', raw: payload };
  const record = payload as Record<string, Json>;
  return {
    intent: typeof record.intent === 'string' ? record.intent as VoiceIntent : 'unknown',
    amount: typeof record.amount === 'number' ? record.amount : null,
    quantity: typeof record.quantity === 'number' ? record.quantity : null,
    normalized_text: typeof record.normalized_text === 'string' ? record.normalized_text : '',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0,
    raw: payload,
  };
};

export const getResetCountdown = (resetAt?: string | null) => {
  if (!resetAt) return 'today';
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return 'soon';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

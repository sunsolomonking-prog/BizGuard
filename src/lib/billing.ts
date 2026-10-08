import { supabase } from './supabase';
import type { SubscriptionPlanCode } from './subscriptions';

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PaymentRequestRecord {
  id: string;
  business_id: string | null;
  user_id: string | null;
  plan_code: SubscriptionPlanCode;
  amount_ngn: number;
  provider: string;
  reference: string | null;
  proof_url: string | null;
  note: string | null;
  status: PaymentRequestStatus;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export const getPaymentRequest = async (requestId: string, userId: string) => {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id,business_id,user_id,plan_code,amount_ngn,provider,reference,proof_url,note,status,reviewed_at,admin_note,created_at')
    .eq('id', requestId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as PaymentRequestRecord | null;
};


export const getPendingPaymentRequest = async (businessId: string, userId: string) => {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id,business_id,user_id,plan_code,amount_ngn,provider,reference,proof_url,note,status,reviewed_at,admin_note,created_at')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as PaymentRequestRecord | null;
};

const getPaymentSubmissionError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (typeof candidate.details === 'string' && candidate.details.trim()) return candidate.details;
    if (typeof candidate.hint === 'string' && candidate.hint.trim()) return candidate.hint;
  }
  return 'Could not submit payment request. Please try again.';
};

export const createPaymentRequest = async (input: {
  businessId: string;
  userId: string;
  planCode: SubscriptionPlanCode;
  amountNgn: number;
  provider?: string;
  reference?: string;
  note?: string;
  proof?: File | null;
}) => {
  if (!input.proof) throw new Error('Please attach your payment proof.');
  if (input.proof.size > 10 * 1024 * 1024) throw new Error('Payment proof must be 10 MB or smaller.');

  const existing = await getPendingPaymentRequest(input.businessId, input.userId);
  if (existing) return existing;

  let proofPath: string | null = null;
  try {
    const safeName = input.proof.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    proofPath = `${input.userId}/payment-${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('bizguard-captures').upload(proofPath, input.proof, {
      upsert: false,
      contentType: input.proof.type || undefined,
    });
    if (upload.error) throw new Error(`Receipt upload failed: ${getPaymentSubmissionError(upload.error)}`);

    const { data, error } = await supabase.rpc('create_payment_request', {
      p_business_id: input.businessId,
      p_plan_code: input.planCode,
      p_amount_ngn: input.amountNgn,
      p_provider: input.provider || 'bank_transfer',
      p_reference: input.reference || null,
      p_proof_url: proofPath,
      p_note: input.note || null,
    });

    if (error) throw new Error(`Payment request could not be created: ${getPaymentSubmissionError(error)}`);
    if (!data) throw new Error('Payment request could not be created: no request was returned by the server.');
    return data;
  } catch (error) {
    if (proofPath) await supabase.storage.from('bizguard-captures').remove([proofPath]);
    throw new Error(getPaymentSubmissionError(error));
  }
};

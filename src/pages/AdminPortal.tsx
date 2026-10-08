import React from 'react';
import { CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, Users, XCircle, Building2, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { PLAN_DEFINITIONS } from '../lib/subscriptions';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  business_id: string | null;
  role: string;
  created_at: string;
}

interface PaymentRequest {
  id: string;
  business_id: string | null;
  user_id: string | null;
  plan_code: string;
  amount_ngn: number;
  provider: string;
  reference: string | null;
  proof_url: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
  business_name?: string | null;
}

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export const AdminPortal: React.FC = () => {
  const { user, currentBusiness } = useAppStore();
  const adminRpc = supabase.rpc as any;
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [payments, setPayments] = React.useState<PaymentRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [businessSetup, setBusinessSetup] = React.useState<any>(null);
  const [businessSetupLoading, setBusinessSetupLoading] = React.useState(false);

  const loadBusinessSetup = React.useCallback(async () => {
    const { data, error } = await adminRpc('admin_get_my_business_account_status');
    if (error) {
      setBusinessSetup(null);
      return;
    }
    setBusinessSetup(Array.isArray(data) ? (data[0] ?? null) : data ?? null);
  }, [currentBusiness?.id, currentBusiness?.name]);

  const setupMyBusiness = async () => {
    setBusinessSetupLoading(true);
    try {
      const { data, error } = await adminRpc('admin_setup_my_business_account', {
        p_business_id: currentBusiness?.id || null,
        p_business_name: currentBusiness?.name || '2040Ai future store',
      });
      if (error) throw error;
      setBusinessSetup(Array.isArray(data) ? (data[0] ?? null) : data ?? null);
      toast.success('Business account repaired and Free Snap Count activated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Business account setup failed.');
    } finally {
      setBusinessSetupLoading(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, paymentsResult] = await Promise.all([
        adminRpc('admin_list_users'),
        adminRpc('admin_list_payment_requests'),
      ]);
      if (usersResult.error) toast.error(`Users: ${usersResult.error.message}`);
      else setUsers((usersResult.data || []) as AdminUser[]);
      if (paymentsResult.error) toast.error(`Payments: ${paymentsResult.error.message}`);
      else setPayments((paymentsResult.data || []) as PaymentRequest[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); void loadBusinessSetup(); }, [load, loadBusinessSetup]);

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('bizguard-captures').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error(error?.message || 'Payment proof is unavailable.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const review = async (request: PaymentRequest, decision: 'approved' | 'rejected') => {
    setWorkingId(request.id);
    try {
      const { error } = await adminRpc('admin_review_payment_request', {
        p_request_id: request.id,
        p_decision: decision,
        p_admin_note: decision === 'approved' ? 'Approved by BizGuard administrator.' : 'Payment proof was not approved.',
      });
      if (error) throw error;
      toast.success(decision === 'approved' ? 'Payment approved and subscription activated.' : 'Payment request rejected.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review payment request.');
    } finally {
      setWorkingId(null);
    }
  };

  const pending = payments.filter((item) => item.status === 'pending');
  const activePlans = PLAN_DEFINITIONS.filter((plan) => plan.code !== 'free');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><ShieldCheck className="h-4 w-4" /> Administrator</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Admin Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Review people, verify payments and activate subscriptions.</p>
          <p className="mt-2 text-xs font-medium text-slate-400">Signed in as {user?.email || 'administrator'}</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </button>
      </header>

      <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-800"><Building2 className="h-4 w-4" /> Business Account + Free Snap</div>
            <h2 className="mt-2 text-xl font-black text-slate-950">Activate this Super Admin as a business owner</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">This creates/repairs the business workspace and owner membership. It does <strong>not</strong> require a paid Business subscription. Free includes 3 Snap Counts per day.</p>
            {businessSetup && <div className="mt-3 grid gap-2 text-xs font-bold text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
              <span>Business: {businessSetup.business_name || '—'}</span>
              <span>Membership: {businessSetup.member_status || '—'}</span>
              <span>Plan: {businessSetup.plan_code || 'free'}</span>
              <span>Snap: {businessSetup.snap_remaining ?? 3} remaining</span>
            </div>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={loadBusinessSetup} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"><ScanLine className="h-4 w-4" /> Verify</button>
            <button onClick={setupMyBusiness} disabled={businessSetupLoading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Building2 className="h-4 w-4" /> {businessSetupLoading ? 'Repairing…' : 'Repair & Activate'}</button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><Users className="h-5 w-5 text-slate-500" /><p className="mt-3 text-3xl font-black text-slate-950">{users.length}</p><p className="text-sm text-slate-500">Registered users</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><Clock3 className="h-5 w-5 text-amber-600" /><p className="mt-3 text-3xl font-black text-slate-950">{pending.length}</p><p className="text-sm text-slate-500">Pending payments</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><CreditCard className="h-5 w-5 text-slate-500" /><p className="mt-3 text-3xl font-black text-slate-950">{activePlans.length}</p><p className="text-sm text-slate-500">Paid plan options</p></div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6"><h2 className="text-xl font-black text-slate-950">Payment requests</h2><p className="mt-1 text-sm text-slate-500">Approve only after checking the submitted payment evidence.</p></div>
        <div className="divide-y divide-slate-100">
          {payments.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No payment requests yet.</div>}
          {payments.map((request) => {
            const plan = PLAN_DEFINITIONS.find((item) => item.code === request.plan_code);
            return (
              <div key={request.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-700">{plan?.name || request.plan_code}</span><span className="text-sm font-bold text-slate-900">{money(Number(request.amount_ngn))}</span><span className="text-xs text-slate-400">{new Date(request.created_at).toLocaleString()}</span></div>
                  <p className="mt-2 text-sm text-slate-600">User: <span className="font-semibold text-slate-900">{request.user_name || request.user_email || request.user_id || '—'}</span> · Business: <span className="font-semibold text-slate-900">{request.business_name || request.business_id || '—'}</span></p>
                  <p className="mt-1 text-sm text-slate-600">Reference: <span className="font-semibold text-slate-900">{request.reference || '—'}</span></p>
                  {request.note && <p className="mt-1 text-sm text-slate-500">{request.note}</p>}
                  {request.proof_url && <button onClick={() => openProof(request.proof_url!)} className="mt-2 inline-block text-sm font-bold text-slate-900 underline">Open payment proof</button>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {request.status !== 'pending' ? <span className={`rounded-full px-3 py-2 text-xs font-black uppercase ${request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{request.status}</span> : <><button onClick={() => review(request, 'rejected')} disabled={workingId === request.id} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle className="h-4 w-4" /> Reject</button><button onClick={() => review(request, 'approved')} disabled={workingId === request.id} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Approve</button></>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6"><h2 className="text-xl font-black text-slate-950">Users</h2><p className="mt-1 text-sm text-slate-500">The existing public.users table remains the source of role information.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Email</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((item) => <tr key={item.id}><td className="px-6 py-4 font-semibold text-slate-900">{item.name || '—'}</td><td className="px-6 py-4 text-slate-600">{item.email}</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{item.role}</span></td><td className="px-6 py-4 text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
};

export default AdminPortal;

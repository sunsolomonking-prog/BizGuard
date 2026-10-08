import React from 'react';
import { Camera, Check, CreditCard, Crown, FileUp, Image as ImageIcon, RefreshCw, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { getBusinessSubscriptionStatus, getPlanDefinition, getVoiceUsageStatus, getSnapCountUsageStatus, PLAN_DEFINITIONS, type SubscriptionPlanCode, type VoiceUsageStatus, type SnapUsageStatus } from '../lib/subscriptions';
import { createPaymentRequest, getPaymentRequest, getPendingPaymentRequest, type PaymentRequestRecord } from '../lib/billing';
import { formatCurrency } from '../utils/helpers';
import VoiceUsageWidget from '../components/subscription/VoiceUsageWidget';
import PaymentAccountDetails from '../components/billing/PaymentAccountDetails';

export const Subscription: React.FC = () => {
  const { currentBusiness, user } = useAppStore();
  const [usage, setUsage] = React.useState<VoiceUsageStatus | null>(null);
  const [snapUsage, setSnapUsage] = React.useState<SnapUsageStatus | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<SubscriptionPlanCode | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [requestPlan, setRequestPlan] = React.useState<SubscriptionPlanCode | null>(null);
  const [reference, setReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [proof, setProof] = React.useState<File | null>(null);
  const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = React.useState<PaymentRequestRecord | null>(null);
  const [checkingApproval, setCheckingApproval] = React.useState(false);
  const [paymentStage, setPaymentStage] = React.useState<'payment' | 'submitted'>('payment');
  const submittingPaymentRef = React.useRef(false);
  const approvalCheckRef = React.useRef(false);

  const businessId = currentBusiness?.id;

  const loadSubscription = React.useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      let nextUsage: VoiceUsageStatus | null = null;
      let nextSnapUsage: SnapUsageStatus | null = null;
      try {
        nextUsage = await getVoiceUsageStatus(businessId);
      } catch {
        nextUsage = { business_id: businessId, plan_code: 'free', plan_name: 'Free', used_today: 0, remaining_today: 3, daily_limit: 3, is_unlimited: false, reset_at: new Date(Date.now() + 86400000).toISOString(), upgrade_message: 'Voice AI available.' };
      }
      try {
        nextSnapUsage = await getSnapCountUsageStatus(businessId);
      } catch {
        nextSnapUsage = { business_id: businessId, plan_code: nextUsage.plan_code, plan_name: nextUsage.plan_name, used_today: 0, remaining_today: getPlanDefinition(nextUsage.plan_code).snapCountLimit, daily_limit: getPlanDefinition(nextUsage.plan_code).snapCountLimit, is_unlimited: getPlanDefinition(nextUsage.plan_code).snapCountLimit === null, reset_at: new Date(Date.now() + 86400000).toISOString(), upgrade_message: 'Snap Count available.' };
      }
      setUsage(nextUsage);
      setSelectedPlan(nextUsage.plan_code as SubscriptionPlanCode);
      setSnapUsage(nextSnapUsage);
      setSubscriptionError(null);
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : 'Subscription data is temporarily unavailable.');
    } finally { setIsLoading(false); }
  }, [businessId]);

  React.useEffect(() => { loadSubscription(); }, [loadSubscription]);

  React.useEffect(() => {
    let cancelled = false;
    const restorePendingRequest = async () => {
      if (!businessId || !user?.id) return;
      try {
        const pending = await getPendingPaymentRequest(businessId, user.id);
        if (cancelled || !pending) return;
        setSubmittedRequest(pending);
        setRequestPlan(pending.plan_code);
        setPaymentStage('submitted');
        await checkPaymentApprovalFor(pending.id);
      } catch {
        // The normal subscription screen remains usable if the pending-request
        // compatibility read is unavailable on an older deployment.
      }
    };
    void restorePendingRequest();
    return () => { cancelled = true; };
  }, [businessId, user?.id]);

  const resetPaymentModal = () => {
    setRequestPlan(null);
    setReference('');
    setNote('');
    setProof(null);
    setSubmittedRequest(null);
    setPaymentStage('payment');
    setCheckingApproval(false);
  };

  const refreshAfterApproval = async (request: PaymentRequestRecord) => {
    if (!businessId) return false;
    const subscription = await getBusinessSubscriptionStatus(businessId);
    if (subscription?.status === 'active' && subscription.plan_code === request.plan_code) {
      await loadSubscription();
      toast.success(`${getPlanDefinition(request.plan_code).name} plan is now active.`);
      resetPaymentModal();
      return true;
    }
    return false;
  };

  const checkPaymentApproval = async (silent = false) => {
    if (!submittedRequest || !user?.id || approvalCheckRef.current) return;
    approvalCheckRef.current = true;
    setCheckingApproval(true);
    try {
      const latest = await getPaymentRequest(submittedRequest.id, user.id);
      if (!latest) throw new Error('Payment request could not be found.');
      setSubmittedRequest(latest);
      if (latest.status === 'approved') {
        const activated = await refreshAfterApproval(latest);
        if (!activated && !silent) toast('Payment is approved. Subscription activation is still syncing. Please check again.');
      } else if (latest.status === 'rejected') {
        if (!silent) toast.error(latest.admin_note || 'Payment proof was not approved. You can submit a new request.');
      } else if (!silent) {
        toast('Payment is still awaiting administrator confirmation.');
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Could not check payment approval.');
    } finally {
      approvalCheckRef.current = false;
      setCheckingApproval(false);
    }
  };

  const submitRequest = async () => {
    if (!businessId || !user?.id || !requestPlan || submittingPaymentRef.current) return;
    const plan = getPlanDefinition(requestPlan);
    submittingPaymentRef.current = true;
    setIsLoading(true);
    try {
      const request = await createPaymentRequest({ businessId, userId: user.id, planCode: requestPlan, amountNgn: plan.monthlyPrice, reference, note, proof });
      const normalized = request as PaymentRequestRecord;
      setSubmittedRequest(normalized);
      setPaymentStage('submitted');
      toast.success('Receipt submitted. BizGuard will activate the plan after administrator approval.');
      // If an approval already exists for this request, reconcile immediately.
      await checkPaymentApprovalFor(normalized.id);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Could not submit payment request.';
      toast.error(message, { duration: 7000 });
    } finally {
      submittingPaymentRef.current = false;
      setIsLoading(false);
    }
  };

  const checkPaymentApprovalFor = async (requestId: string) => {
    if (!user?.id || !businessId) return;
    try {
      const latest = await getPaymentRequest(requestId, user.id);
      if (!latest) return;
      setSubmittedRequest(latest);
      if (latest.status === 'approved') await refreshAfterApproval(latest);
    } catch {
      // The normal approval-check button surfaces errors to the user.
    }
  };

  React.useEffect(() => {
    if (paymentStage !== 'submitted' || !submittedRequest || submittedRequest.status !== 'pending') return;
    const timer = window.setInterval(() => { void checkPaymentApproval(true); }, 8000);
    return () => window.clearInterval(timer);
  }, [paymentStage, submittedRequest?.id, submittedRequest?.status, user?.id, businessId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Plans</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Subscription</h1><p className="mt-1 text-sm text-slate-500">Choose a plan first. Payment details appear only after you choose a paid plan. Send proof and BizGuard activates access after review.</p></div>
        <button onClick={loadSubscription} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh</button>
      </header>

      {subscriptionError && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Subscription data is temporarily unavailable. Refresh in a moment or contact BizGuard support.</div>}

      <VoiceUsageWidget businessId={businessId} />

      {snapUsage && <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Snap Count Usage</p><h2 className="mt-1 text-2xl font-black text-slate-950">{snapUsage.is_unlimited ? 'Unlimited Snap Counts' : `${snapUsage.remaining_today ?? 0} Snap Counts remaining today`}</h2><p className="mt-1 text-sm text-slate-600">{snapUsage.is_unlimited ? 'Enterprise includes unlimited daily Snap Count analyses.' : `${snapUsage.used_today} of ${snapUsage.daily_limit} used today on the ${snapUsage.plan_name} plan.`}</p></div>{!snapUsage.is_unlimited && (snapUsage.remaining_today ?? 0) === 0 && <button onClick={() => document.getElementById('bizguard-plan-choices')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Choose a plan</button>}</div></section>}

      <section id="bizguard-plan-choices" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white"><Crown className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-950">Simple plan choices</h2><p className="text-sm text-slate-500">Your existing Free → Starter → Pro → Business → Enterprise structure stays intact.</p></div></div>
        <div className="grid gap-4 xl:grid-cols-5">
          {PLAN_DEFINITIONS.map((plan) => {
            const current = selectedPlan === plan.code;
            return <article key={plan.code} className={`rounded-2xl border p-5 ${current ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-black text-slate-950">{plan.name}</h3>{current && <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-black uppercase text-white">Current</span>}</div>
              <p className="mt-3 text-2xl font-black text-slate-950">{plan.code === 'enterprise' ? '₦100,000+' : formatCurrency(plan.monthlyPrice)}</p><p className="text-xs text-slate-400">per month</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold text-slate-900">Voice AI</p><p className="mt-1 text-slate-500">{plan.unlimited ? 'Unlimited' : `${plan.dailyLimit} commands/day`}</p></div><div className="rounded-xl bg-cyan-50 p-3 text-sm"><p className="font-bold text-cyan-950">Snap Count</p><p className="mt-1 text-cyan-800">{plan.unlimited ? 'Unlimited' : `${plan.snapCountLimit} snaps/day`}</p></div></div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">{plan.features.slice(0, 5).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />{feature}</li>)}</ul>
              <button onClick={() => plan.code === 'free' ? toast('Free is included with every BizGuard account.') : setRequestPlan(plan.code)} disabled={current || isLoading} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{current ? 'Current plan' : plan.code === 'free' ? 'Included' : 'Choose plan'}</button>
            </article>;
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><CreditCard className="h-5 w-5 text-slate-700" /><h3 className="mt-3 font-black text-slate-950">Payment review</h3><p className="mt-1 text-sm leading-6 text-slate-500">Paid plans are not activated from the browser. Your receipt goes into the admin review queue.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-slate-700" /><h3 className="mt-3 font-black text-slate-950">Secure entitlement</h3><p className="mt-1 text-sm leading-6 text-slate-500">The subscription is changed on the database after approval, not by local browser state.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><FileUp className="h-5 w-5 text-slate-700" /><h3 className="mt-3 font-black text-slate-950">Proof once</h3><p className="mt-1 text-sm leading-6 text-slate-500">Upload the receipt once, add a reference if you have one, and wait for approval.</p></div></section>

      {requestPlan && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4" onMouseDown={(e) => e.currentTarget === e.target && resetPaymentModal()}>
        <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Payment request</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{getPlanDefinition(requestPlan).name}</h2>
              <p className="mt-1 text-sm text-slate-500">{formatCurrency(getPlanDefinition(requestPlan).monthlyPrice)} per month</p>
            </div>
            <button onClick={resetPaymentModal} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Close payment request"><X className="h-5 w-5" /></button>
          </div>

          {paymentStage === 'payment' ? <div className="mt-6 space-y-4">
            <PaymentAccountDetails amount={getPlanDefinition(requestPlan).monthlyPrice} compact={true} showInstructions={true} />
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
              <p className="font-black">After you make the transfer</p>
              <p className="mt-1 leading-6">Upload the receipt below, then tap Continue. Your request goes to the existing Admin Portal approval queue. BizGuard never activates a paid plan from the browser alone.</p>
            </div>
            <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Transfer reference <span className="font-normal text-slate-400">(optional)</span></label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Paste your transfer reference" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">Payment receipt / proof</label>
              <div className="rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/70 p-3 sm:p-4">
                <input
                  id="bizguard-payment-proof-camera"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <input
                  id="bizguard-payment-proof-gallery"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <input
                  id="bizguard-payment-proof-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                  className="sr-only"
                />

                <div className="rounded-xl border border-cyan-200 bg-white px-4 py-4 text-center shadow-sm">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white"><FileUp className="h-5 w-5" /></span>
                  <p className="mt-2 text-sm font-black text-slate-950">{proof ? 'Change payment receipt' : 'Upload payment receipt'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Choose how you want to upload your payment proof.</p>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label
                      htmlFor="bizguard-payment-proof-camera"
                      className="inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
                    >
                      <Camera className="h-4 w-4" />
                      Take photo
                    </label>
                    <label
                      htmlFor="bizguard-payment-proof-gallery"
                      className="inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-black text-cyan-950 transition hover:bg-cyan-100 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Gallery
                    </label>
                    <label
                      htmlFor="bizguard-payment-proof-file"
                      className="inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
                    >
                      <FileUp className="h-4 w-4" />
                      File / PDF
                    </label>
                  </div>
                </div>

                {proof && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-emerald-900">{proof.name}</p>
                      <p className="text-xs text-emerald-700">{(proof.size / 1024 / 1024).toFixed(2)} MB selected</p>
                    </div>
                    <span className="shrink-0 text-xs font-black text-emerald-700">Ready</span>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">JPG, PNG or WEBP from your gallery; PDF or image from Files. Maximum 10 MB. You can also take a new receipt photo.</p>
            </div>
            <button onClick={submitRequest} disabled={isLoading || !proof} className="w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">{isLoading ? 'Submitting…' : 'Continue'}</button>
          </div> : <div className="mt-6 space-y-4">
            <div className={`rounded-2xl border p-5 ${submittedRequest?.status === 'approved' ? 'border-emerald-200 bg-emerald-50' : submittedRequest?.status === 'rejected' ? 'border-rose-200 bg-rose-50' : 'border-cyan-200 bg-cyan-50'}`}>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Payment status</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">{submittedRequest?.status === 'approved' ? 'Approved — activating your plan' : submittedRequest?.status === 'rejected' ? 'Payment not approved' : 'Awaiting administrator approval'}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{submittedRequest?.status === 'approved' ? 'The administrator has confirmed your payment. BizGuard is reconciling the approved subscription from the database now.' : submittedRequest?.status === 'rejected' ? (submittedRequest.admin_note || 'The administrator did not approve this payment proof. You can close this window and submit a new receipt.') : 'Your receipt is in the existing Admin Portal queue. Once the administrator approves it, BizGuard automatically reads the approved subscription and switches your active plan.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => void checkPaymentApproval(false)} disabled={checkingApproval} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{checkingApproval ? 'Checking…' : 'Check approval'}</button>
              <button onClick={resetPaymentModal} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">{submittedRequest?.status === 'rejected' ? 'Close & resubmit' : 'Continue to BizGuard'}</button>
            </div>
          </div>}
        </div>
      </div>}
    </div>
  );
};

export default Subscription;

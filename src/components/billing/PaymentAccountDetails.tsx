import React from 'react';
import { Check, Clipboard, Landmark, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { PAYMENT_ACCOUNT } from '../../lib/paymentAccount';
import { formatCurrency } from '../../utils/helpers';

interface PaymentAccountDetailsProps {
  amount?: number | null;
  compact?: boolean;
  showInstructions?: boolean;
}

const copyValue = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
};

export const PaymentAccountDetails: React.FC<PaymentAccountDetailsProps> = ({
  amount,
  compact = false,
  showInstructions = true,
}) => (
  <section
    id={compact ? undefined : 'payment-account'}
    className={`border border-slate-200 bg-slate-50 ${compact ? 'rounded-xl p-4' : 'rounded-2xl p-5'}`}
    aria-label="BizGuard payment account details"
  >
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
        <Landmark className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Payment account</p>
            <h3 className="mt-1 text-base font-black text-slate-950">Pay by bank transfer</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified account
          </div>
        </div>
      </div>
    </div>

    <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-400">Account name</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">{PAYMENT_ACCOUNT.accountName}</p>
        <button type="button" onClick={() => copyValue('Account name', PAYMENT_ACCOUNT.accountName)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-950">
          <Clipboard className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-400">Bank</p>
        <p className="mt-1 text-sm font-black text-slate-950">{PAYMENT_ACCOUNT.bankName}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-400">Account number</p>
        <p className="mt-1 text-lg font-black tracking-[.08em] text-slate-950">{PAYMENT_ACCOUNT.accountNumber}</p>
        <button type="button" onClick={() => copyValue('Account number', PAYMENT_ACCOUNT.accountNumber)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-950">
          <Clipboard className="h-3.5 w-3.5" /> Copy number
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-400">Amount</p>
        <p className="mt-1 text-lg font-black text-slate-950">{amount && amount > 0 ? formatCurrency(amount) : 'Use the plan price'}</p>
        <p className="mt-1 text-[11px] text-slate-400">Currency: {PAYMENT_ACCOUNT.currency}</p>
      </div>
    </div>

    {showInstructions && (
      <div className="mt-4 flex gap-2 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Transfer the exact plan amount, then upload your receipt and continue. BizGuard activates paid access only after administrator approval.
      </div>
    )}
  </section>
);

export default PaymentAccountDetails;

import React from 'react';
import { Check, Clipboard, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { PAYMENT_ACCOUNT, USDT_ERC20_PAYMENT } from '../../lib/paymentAccount';
import { formatCurrency } from '../../utils/helpers';

interface PaymentAccountDetailsProps {
  amount?: number | null;
  compact?: boolean;
  showInstructions?: boolean;
  selectedMethod?: 'bank_transfer' | 'usdt_erc20' | 'both';
}

const copyValue = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
};

const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(USDT_ERC20_PAYMENT.walletAddress)}`;

export const PaymentAccountDetails: React.FC<PaymentAccountDetailsProps> = ({
  amount,
  compact = false,
  showInstructions = true,
  selectedMethod = 'both',
}) => (
  <section
    id={compact ? undefined : 'payment-account'}
    className={`space-y-4 border border-slate-200 bg-slate-50 ${compact ? 'rounded-xl p-4' : 'rounded-2xl p-5'}`}
    aria-label="BizGuard subscription payment methods"
  >
    {selectedMethod !== 'usdt_erc20' && (<>
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
        <Landmark className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Payment method 1</p>
            <h3 className="mt-1 text-base font-black text-slate-950">Pay by bank transfer</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Bank transfer
          </div>
        </div>
      </div>
    </div>

    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
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
        <p className="text-[11px] font-semibold text-slate-400">Plan amount</p>
        <p className="mt-1 text-lg font-black text-slate-950">{amount && amount > 0 ? formatCurrency(amount) : 'Use the plan price'}</p>
        <p className="mt-1 text-[11px] text-slate-400">Currency: {PAYMENT_ACCOUNT.currency}</p>
      </div>
    </div>

    </>)}

    {selectedMethod !== 'bank_transfer' && (<>
    <div className="overflow-hidden rounded-2xl border border-cyan-200 bg-white">
      <div className="flex items-start gap-3 border-b border-cyan-100 bg-cyan-50 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-950 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">Payment method 2 · Global</p>
          <h3 className="mt-1 text-base font-black text-slate-950">Pay with USDT (ERC-20)</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Scan the QR code with a wallet that supports USDT on Ethereum.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-cyan-900">USDT</span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
        <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 text-center">
          <img
            src={qrCodeUrl}
            alt="QR code encoding the BizGuard USDT ERC-20 deposit wallet address"
            width="280"
            height="280"
            loading="eager"
            referrerPolicy="no-referrer"
            className="mx-auto aspect-square w-full"
          />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Wallet address QR</p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">Network</p>
          <p className="mt-1 text-sm font-black text-slate-950">{USDT_ERC20_PAYMENT.network}</p>
          <p className="mt-4 text-xs font-bold text-slate-500">USDT deposit address</p>
          <p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs font-bold leading-5 text-slate-900">{USDT_ERC20_PAYMENT.walletAddress}</p>
          <button
            type="button"
            onClick={() => copyValue('USDT ERC-20 wallet address', USDT_ERC20_PAYMENT.walletAddress)}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
          >
            <Clipboard className="h-4 w-4" /> Copy USDT wallet address
          </button>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <strong>Important:</strong> Send USDT on Ethereum (ERC-20) only. Do not use TRC-20, BEP-20, or another network. Confirm the network and address in your wallet before sending.
          </div>
        </div>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500">After sending, keep the transaction hash and a screenshot of the completed transfer for administrator review.</p>
    </div>

    </>)}

    {showInstructions && (
      <div className="flex gap-2 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Bank transfers and crypto payments must be reviewed before a paid subscription is activated.
      </div>
    )}
  </section>
);

export default PaymentAccountDetails;

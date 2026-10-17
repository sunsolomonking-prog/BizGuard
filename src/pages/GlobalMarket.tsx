import React from 'react';
import { AlertTriangle, ArrowLeftRight, Globe2, Plus, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import {
  GLOBAL_MARKET_CURRENCIES,
  buildCurrencyInsight,
  convertWithManualRate,
  formatGlobalCurrency,
  getRateFreshness,
  validateManualFxRate,
  type ManualFxRate,
} from '../lib/globalMarketEngine';

const currencyOptions = GLOBAL_MARKET_CURRENCIES as readonly { code: string; name: string }[];
const nowForInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const storageKey = (businessId: string) => `bizguard.global-market.fx.v1.${businessId}`;

const readRates = (businessId: string): ManualFxRate[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ManualFxRate =>
      !!item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.baseCurrency === 'string' &&
      typeof item.quoteCurrency === 'string' && typeof item.quotePerBase === 'number' &&
      typeof item.source === 'string' && typeof item.effectiveAt === 'string' && typeof item.createdAt === 'string'
    );
  } catch {
    return [];
  }
};

export const GlobalMarket: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const businessId = currentBusiness?.id;
  const operatingCurrency = currentBusiness?.currency || 'NGN';
  const [rates, setRates] = React.useState<ManualFxRate[]>([]);
  const [baseCurrency, setBaseCurrency] = React.useState(operatingCurrency);
  const [quoteCurrency, setQuoteCurrency] = React.useState('USD');
  const [rateValue, setRateValue] = React.useState('');
  const [rateSource, setRateSource] = React.useState('');
  const [effectiveAt, setEffectiveAt] = React.useState(nowForInput);
  const [amount, setAmount] = React.useState('1');
  const [selectedRateId, setSelectedRateId] = React.useState('');
  const [revenue, setRevenue] = React.useState('');
  const [cost, setCost] = React.useState('');
  const [insightCurrency, setInsightCurrency] = React.useState(operatingCurrency);

  React.useEffect(() => {
    if (!businessId) {
      setRates([]);
      return;
    }
    const stored = readRates(businessId);
    setRates(stored);
    setSelectedRateId(stored[0]?.id || '');
  }, [businessId]);

  React.useEffect(() => {
    setBaseCurrency(operatingCurrency);
    setInsightCurrency(operatingCurrency);
  }, [operatingCurrency]);

  const persistRates = (next: ManualFxRate[]) => {
    setRates(next);
    if (!businessId) return;
    try {
      window.localStorage.setItem(storageKey(businessId), JSON.stringify(next));
    } catch {
      toast.error('Browser storage is unavailable. Export or record these rates elsewhere before leaving this page.');
    }
  };

  const addRate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId) {
      toast.error('Select a business workspace first.');
      return;
    }
    const candidate = {
      baseCurrency: baseCurrency.toUpperCase(),
      quoteCurrency: quoteCurrency.toUpperCase(),
      quotePerBase: Number(rateValue),
      source: rateSource.trim(),
      effectiveAt: new Date(effectiveAt).toISOString(),
    };
    const error = validateManualFxRate(candidate);
    if (error) {
      toast.error(error);
      return;
    }
    const next: ManualFxRate = { ...candidate, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const updated = [next, ...rates].slice(0, 100);
    persistRates(updated);
    setSelectedRateId(next.id);
    setRateValue('');
    setRateSource('');
    setEffectiveAt(nowForInput());
    toast.success('Manual FX reference saved for this business on this device.');
  };

  const selectedRate = rates.find((rate) => rate.id === selectedRateId) || rates[0];
  const convertedAmount = selectedRate && Number.isFinite(Number(amount)) && Number(amount) >= 0
    ? convertWithManualRate(Number(amount), selectedRate)
    : null;
  const insight = React.useMemo(() => {
    if (!revenue.trim() || !cost.trim()) return null;
    try {
      return buildCurrencyInsight({ revenue: Number(revenue), cost: Number(cost), currency: insightCurrency });
    } catch {
      return null;
    }
  }, [revenue, cost, insightCurrency]);

  const selectClasses = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';
  const inputClasses = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-200"><Globe2 className="h-4 w-4" /> Global Market Intelligence</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Trade beyond borders.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">A controlled workspace for currency references, transparent conversions, and explainable margin checks. Existing inventory, sales, and historical financial records are not modified here.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Business operating currency</p>
            <p className="mt-2 text-2xl font-black">{operatingCurrency}</p>
            <p className="mt-1 text-xs text-slate-400">Existing business setting · unchanged</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><ArrowLeftRight className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-900">FX reference desk</h2><p className="mt-1 text-sm text-slate-500">Record a rate you obtained from a source you trust. Rates are manual estimates, not live exchange quotes.</p></div>
          </div>
          <form onSubmit={addRate} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Base currency</span><select className={selectClasses} value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>{currencyOptions.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
              <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Quote currency</span><select className={selectClasses} value={quoteCurrency} onChange={e => setQuoteCurrency(e.target.value)}>{currencyOptions.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
            </div>
            <label className="block space-y-1.5"><span className="text-xs font-semibold text-slate-600">Quote units per 1 base unit</span><input className={inputClasses} inputMode="decimal" type="number" min="0.00000001" step="any" value={rateValue} onChange={e => setRateValue(e.target.value)} placeholder="Example: enter the rate you verified" required /><span className="block text-xs text-slate-400">For example, if 1 USD equals 1,500 NGN, base is USD, quote is NGN, rate is 1500.</span></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Rate source / reference</span><input className={inputClasses} value={rateSource} onChange={e => setRateSource(e.target.value)} placeholder="Bank, provider, invoice, or reference" required /></label>
              <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Effective at</span><input className={inputClasses} type="datetime-local" value={effectiveAt} onChange={e => setEffectiveAt(e.target.value)} required /></label>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Save FX reference</button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><TrendingUp className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Currency conversion calculator</h2><p className="mt-1 text-sm text-slate-500">Uses only a saved manual rate and currency-specific rounding. No transaction is posted.</p></div></div>
          {rates.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Add a verified reference rate to enable conversion. BizGuard will not invent or silently fetch rates.</div> : <>
            <label className="mt-5 block space-y-1.5"><span className="text-xs font-semibold text-slate-600">Saved rate</span><select className={selectClasses} value={selectedRateId || rates[0].id} onChange={e => setSelectedRateId(e.target.value)}>{rates.map(rate => <option key={rate.id} value={rate.id}>{rate.baseCurrency} → {rate.quoteCurrency} · {rate.quotePerBase} ({rate.source})</option>)}</select></label>
            {selectedRate && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p>1 {selectedRate.baseCurrency} = {selectedRate.quotePerBase.toLocaleString()} {selectedRate.quoteCurrency}</p><p className="mt-1">Source: {selectedRate.source} · Effective: {new Date(selectedRate.effectiveAt).toLocaleString()}</p><p className={selectedRate && getRateFreshness(selectedRate.effectiveAt) !== 'fresh' ? 'mt-1 font-bold text-amber-700' : 'mt-1 font-semibold text-emerald-700'}>{getRateFreshness(selectedRate.effectiveAt) === 'fresh' ? 'Less than 24 hours old' : getRateFreshness(selectedRate.effectiveAt) === 'stale' ? 'Stale rate: verify before use' : 'Future or invalid timestamp: verify this rate'}</p></div>}
            <label className="mt-4 block space-y-1.5"><span className="text-xs font-semibold text-slate-600">Amount in {selectedRate?.baseCurrency || 'base currency'}</span><input className={inputClasses} type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <div className="mt-4 rounded-2xl bg-cyan-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Estimated converted amount</p><p className="mt-2 break-words text-3xl font-black text-slate-950">{selectedRate && convertedAmount !== null ? formatGlobalCurrency(convertedAmount, selectedRate.quoteCurrency) : '—'}</p><p className="mt-2 text-xs text-cyan-900">Estimate only. Not a payment, settlement, or guaranteed provider quote.</p></div>
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => { if (selectedRate) { persistRates(rates.filter(rate => rate.id !== selectedRate.id)); setSelectedRateId(rates.find(rate => rate.id !== selectedRate.id)?.id || ''); } }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Remove selected rate</button></div>
          </>}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><TrendingUp className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Smart margin check</h2><p className="mt-1 text-sm text-slate-500">An explainable calculation for figures you enter in the same currency. This is a planning tool, not an automatic change to product prices or recorded sales.</p></div></div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Currency for both values</span><select className={selectClasses} value={insightCurrency} onChange={e => setInsightCurrency(e.target.value)}>{currencyOptions.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Revenue</span><input className={inputClasses} type="number" min="0" step="any" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="Enter revenue" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Total cost</span><input className={inputClasses} type="number" min="0" step="any" value={cost} onChange={e => setCost(e.target.value)} placeholder="Enter cost in same currency" /></label>
        </div>
        {insight && <div className={`mt-4 rounded-xl border p-4 ${insight.severity === 'critical' ? 'border-rose-200 bg-rose-50' : insight.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><p className="font-bold text-slate-900">Estimated margin: {formatGlobalCurrency(insight.margin, insightCurrency)} ({insight.marginPercent.toFixed(2)}%)</p><p className="mt-1 text-sm text-slate-700">{insight.message}</p></div>}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-bold text-amber-950">Data integrity and current phase</h2><p className="mt-1 text-sm leading-6 text-amber-900">FX references are saved in this browser for this business only; they are not synchronized across devices or users. Existing inventory and POS sales still use BizGuard's current business-currency and sale RPC behavior. This preview does not write multi-currency amounts into existing transaction records. That requires a separately reviewed additive Supabase migration and a compatible server-side POS RPC update before transaction-level multi-currency checkout can be enabled.</p><div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-900"><ShieldCheck className="h-4 w-4" /> Preview-only · no changes to existing financial records</div></div></div>
      </section>
    </div>
  );
};

export default GlobalMarket;

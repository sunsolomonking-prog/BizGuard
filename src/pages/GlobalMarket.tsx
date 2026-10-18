import React from 'react';
import { AlertTriangle, ArrowLeftRight, Globe2, Plus, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
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
type GlobalMarketTransaction = Database['public']['Tables']['global_market_transactions']['Row'];
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
  const { currentBusiness, user } = useAppStore();
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
  const [reportingCurrency, setReportingCurrency] = React.useState(operatingCurrency);
  const [locale, setLocale] = React.useState('en');
  const [countryCode, setCountryCode] = React.useState('');
  const [timezone, setTimezone] = React.useState(currentBusiness?.timezone || '');
  const [savingPreferences, setSavingPreferences] = React.useState(false);
  const [fetchingPublicRate, setFetchingPublicRate] = React.useState(false);
  const [reportTotal, setReportTotal] = React.useState<number | null>(null);
  const [reportExcluded, setReportExcluded] = React.useState(0);
  const [reportCurrencyCount, setReportCurrencyCount] = React.useState(0);
  const [transactions, setTransactions] = React.useState<GlobalMarketTransaction[]>([]);
  const [transactionType, setTransactionType] = React.useState<'sale' | 'purchase' | 'expense' | 'income' | 'refund'>('sale');
  const [transactionDescription, setTransactionDescription] = React.useState('');
  const [transactionReference, setTransactionReference] = React.useState('');
  const [counterparty, setCounterparty] = React.useState('');
  const [originalAmount, setOriginalAmount] = React.useState('');
  const [originalCurrency, setOriginalCurrency] = React.useState(operatingCurrency);
  const [settlementCurrency, setSettlementCurrency] = React.useState(operatingCurrency);
  const [transactionRate, setTransactionRate] = React.useState('1');
  const [transactionRateSource, setTransactionRateSource] = React.useState('Same-currency settlement');
  const [transactionDate, setTransactionDate] = React.useState(nowForInput);
  const [savingTransaction, setSavingTransaction] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      if (!businessId || !user?.id) { setRates([]); return; }
      const [rateResult, preferenceResult] = await Promise.all([
        supabase.from('global_fx_rates').select('*').eq('business_id', businessId).order('effective_at', { ascending: false }).limit(100),
        supabase.from('global_market_preferences').select('*').eq('business_id', businessId).eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (rateResult.error) toast.error(`Could not load saved FX rates: ${rateResult.error.message}`);
      else {
        const loaded: ManualFxRate[] = (rateResult.data || []).map(row => ({
          id: row.id, baseCurrency: row.base_currency, quoteCurrency: row.quote_currency,
          quotePerBase: Number(row.rate), source: row.source, effectiveAt: row.effective_at, createdAt: row.created_at,
        }));
        setRates(loaded);
        setSelectedRateId(current => loaded.some(rate => rate.id === current) ? current : (loaded[0]?.id || ''));
      }
      if (preferenceResult.error) toast.error(`Could not load global preferences: ${preferenceResult.error.message}`);
      else if (preferenceResult.data) {
        setReportingCurrency(preferenceResult.data.reporting_currency);
        setInsightCurrency(preferenceResult.data.reporting_currency);
        setLocale(preferenceResult.data.locale);
        setCountryCode(preferenceResult.data.country_code || '');
        setTimezone(preferenceResult.data.timezone || '');
      } else {
        setReportingCurrency(operatingCurrency);
        setInsightCurrency(operatingCurrency);
        setTimezone(currentBusiness?.timezone || '');
      }
    };
    void loadWorkspace();
    return () => { cancelled = true; };
  }, [businessId, user?.id, operatingCurrency, currentBusiness?.timezone]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTransactions = async () => {
      if (!businessId) { setTransactions([]); return; }
      const { data, error } = await supabase.from('global_market_transactions')
        .select('*').eq('business_id', businessId)
        .order('transaction_date', { ascending: false }).limit(200);
      if (cancelled) return;
      if (error) { toast.error(`Could not load global transaction register: ${error.message}`); return; }
      setTransactions(data || []);
    };
    void loadTransactions();
    return () => { cancelled = true; };
  }, [businessId]);

  React.useEffect(() => {
    let cancelled = false;
    const loadReport = async () => {
      if (!businessId) { setReportTotal(null); setReportExcluded(0); setReportCurrencyCount(0); return; }
      const { data, error } = await supabase.from('sales')
        .select('id,total,created_at,transaction_currency')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) { toast.error(`Could not load global sales report: ${error.message}`); return; }
      const rows = data || [];
      const currencies = new Set(rows.map(row => row.transaction_currency).filter((value): value is string => !!value));
      let converted = 0;
      let excluded = 0;
      for (const row of rows) {
        const sourceCurrency = row.transaction_currency;
        const amountValue = Number(row.total);
        if (!sourceCurrency || !Number.isFinite(amountValue)) { excluded += 1; continue; }
        if (sourceCurrency === reportingCurrency) { converted += amountValue; continue; }
        const saleTime = new Date(row.created_at).getTime();
        const matching = rates
          .filter(rate => new Date(rate.effectiveAt).getTime() <= saleTime &&
            ((rate.baseCurrency === sourceCurrency && rate.quoteCurrency === reportingCurrency) ||
             (rate.baseCurrency === reportingCurrency && rate.quoteCurrency === sourceCurrency)))
          .sort((a,b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime())[0];
        if (!matching) { excluded += 1; continue; }
        converted += matching.baseCurrency === sourceCurrency
          ? amountValue * matching.quotePerBase
          : amountValue / matching.quotePerBase;
      }
      setReportTotal(converted);
      setReportExcluded(excluded);
      setReportCurrencyCount(currencies.size);
    };
    void loadReport();
    return () => { cancelled = true; };
  }, [businessId, reportingCurrency, rates]);


  React.useEffect(() => {
    setBaseCurrency(operatingCurrency);
    setInsightCurrency(operatingCurrency);
  }, [operatingCurrency]);

  const persistRates = (next: ManualFxRate[]) => setRates(next);

  const addRate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId || !user?.id) { toast.error('Sign in and select a business workspace first.'); return; }
    const candidate = { baseCurrency: baseCurrency.toUpperCase(), quoteCurrency: quoteCurrency.toUpperCase(), quotePerBase: Number(rateValue), source: rateSource.trim(), effectiveAt };
    const validationError = validateManualFxRate(candidate);
    if (validationError) { toast.error(validationError); return; }
    const { data, error } = await supabase.from('global_fx_rates').insert({
      business_id: businessId, base_currency: candidate.baseCurrency, quote_currency: candidate.quoteCurrency,
      rate: candidate.quotePerBase, source: candidate.source, rate_kind: 'manual',
      effective_at: new Date(candidate.effectiveAt).toISOString(), recorded_by: user.id,
    }).select('*').single();
    if (error || !data) { toast.error(`Could not save FX reference: ${error?.message || 'No saved row returned'}`); return; }
    const next: ManualFxRate = { id: data.id, baseCurrency: data.base_currency, quoteCurrency: data.quote_currency, quotePerBase: Number(data.rate), source: data.source, effectiveAt: data.effective_at, createdAt: data.created_at };
    const updated = [next, ...rates.filter(rate => rate.id !== next.id)].slice(0, 100);
    persistRates(updated); setSelectedRateId(next.id); setRateValue(''); setRateSource(''); setEffectiveAt(nowForInput());
    void supabase.from('global_market_audit_events').insert({ business_id: businessId, actor_id: user.id, event_type: 'fx_rate_created', details: { rate_id: next.id, base_currency: next.baseCurrency, quote_currency: next.quoteCurrency, source: next.source } });
    toast.success('FX reference saved securely for this business.');
  };

  const fetchPublicRate = async () => {
    if (baseCurrency === quoteCurrency) { toast.error('Choose two different currencies.'); return; }
    setFetchingPublicRate(true);
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`);
      if (!response.ok) throw new Error(`Public FX provider returned HTTP ${response.status}`);
      const payload: { result?: string; rates?: Record<string, number>; time_last_update_utc?: string; time_last_update_unix?: number } = await response.json();
      const fetchedRate = payload.rates?.[quoteCurrency];
      if (payload.result !== 'success' || typeof fetchedRate !== 'number' || !Number.isFinite(fetchedRate) || fetchedRate <= 0) {
        throw new Error(`The public provider has no usable rate for ${baseCurrency}/${quoteCurrency}. Enter a verified rate manually instead.`);
      }
      setRateValue(String(fetchedRate));
      setRateSource(`open.er-api.com public reference; updated ${payload.time_last_update_utc || 'timestamp unavailable'}`);
      setEffectiveAt(payload.time_last_update_unix
        ? (() => { const d = new Date(payload.time_last_update_unix! * 1000); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0,16); })()
        : nowForInput());
      toast.success('Public reference rate loaded. Review the source and timestamp, then save it to your business.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not retrieve a public FX reference.');
    } finally {
      setFetchingPublicRate(false);
    }
  };

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId || !user?.id) { toast.error('Sign in and select a business first.'); return; }
    setSavingPreferences(true);
    const { error } = await supabase.from('global_market_preferences').upsert({
      business_id: businessId, user_id: user.id, reporting_currency: reportingCurrency, locale,
      country_code: countryCode.trim() ? countryCode.trim().toUpperCase() : null,
      timezone: timezone.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,user_id' });
    setSavingPreferences(false);
    if (error) { toast.error(`Could not save preferences: ${error.message}`); return; }
    void supabase.from('global_market_audit_events').insert({ business_id: businessId, actor_id: user.id, event_type: 'preference_updated', details: { reporting_currency: reportingCurrency, locale, country_code: countryCode.trim().toUpperCase() || null, timezone: timezone.trim() || null } });
    toast.success('Global Market preferences synced to your business account.');
  };

  const removeRate = async (rate: ManualFxRate) => {
    if (!businessId) return;
    const { error } = await supabase.from('global_fx_rates').delete().eq('business_id', businessId).eq('id', rate.id);
    if (error) { toast.error(`Could not remove rate: ${error.message}`); return; }
    persistRates(rates.filter(item => item.id !== rate.id));
    setSelectedRateId(rates.find(item => item.id !== rate.id)?.id || '');
    void supabase.from('global_market_audit_events').insert({ business_id: businessId, actor_id: user?.id || null, event_type: 'fx_rate_deleted', details: { rate_id: rate.id, base_currency: rate.baseCurrency, quote_currency: rate.quoteCurrency } });
    toast.success('FX reference removed.');
  };

  const selectedRate = rates.find((rate) => rate.id === selectedRateId) || rates[0];
  const convertedAmount = selectedRate && Number.isFinite(Number(amount)) && Number(amount) >= 0
    ? convertWithManualRate(Number(amount), selectedRate)
    : null;
  const saveGlobalTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId || !user?.id) { toast.error('Sign in and select a business workspace first.'); return; }
    if (!transactionDescription.trim()) { toast.error('Add a clear transaction description.'); return; }
    const amountValue = Number(originalAmount);
    const rateValue = Number(transactionRate);
    if (!Number.isFinite(amountValue) || amountValue < 0) { toast.error('Original amount must be a non-negative number.'); return; }
    if (!Number.isFinite(rateValue) || rateValue <= 0) { toast.error('Exchange rate must be positive.'); return; }
    if (originalCurrency === settlementCurrency && rateValue !== 1) { toast.error('For same-currency settlement, exchange rate must be 1.'); return; }
    if (originalCurrency !== settlementCurrency && !transactionRateSource.trim()) { toast.error('Record the FX source for cross-currency settlement.'); return; }
    const settlementValue = Number((amountValue * rateValue).toFixed(2));
    const effectiveTimestamp = new Date(transactionDate);
    if (!Number.isFinite(effectiveTimestamp.getTime())) { toast.error('Choose a valid transaction date.'); return; }
    setSavingTransaction(true);
    const { data, error } = await supabase.from('global_market_transactions').insert({
      business_id: businessId, created_by: user.id, transaction_type: transactionType,
      reference: transactionReference.trim() || null, counterparty: counterparty.trim() || null,
      description: transactionDescription.trim(), transaction_date: effectiveTimestamp.toISOString(),
      original_amount: Number(amountValue.toFixed(2)), original_currency: originalCurrency,
      settlement_amount: settlementValue, settlement_currency: settlementCurrency,
      fx_rate: rateValue, fx_rate_source: transactionRateSource.trim(),
      fx_rate_timestamp: effectiveTimestamp.toISOString(), status: 'recorded',
    }).select('*').single();
    setSavingTransaction(false);
    if (error || !data) { toast.error(`Could not save global transaction: ${error?.message || 'No saved record returned'}`); return; }
    setTransactions(current => [data, ...current].slice(0, 200));
    void supabase.from('global_market_audit_events').insert({
      business_id: businessId, actor_id: user.id, event_type: 'report_exported',
      details: { action: 'global_transaction_created', transaction_id: data.id, transaction_type: data.transaction_type, original_currency: data.original_currency, settlement_currency: data.settlement_currency },
    });
    setTransactionDescription(''); setTransactionReference(''); setCounterparty(''); setOriginalAmount('');
    toast.success('Global transaction recorded separately from the existing POS ledger.');
  };

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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-700"><Globe2 className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-bold text-slate-900">Your global preferences</h2><p className="mt-1 text-sm text-slate-500">Saved to your signed-in account for this business. The reporting currency changes display and reporting only; it does not change recorded transactions or payment settlement.</p></div>
        </div>
        <form onSubmit={savePreferences} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Reporting currency</span><select className={selectClasses} value={reportingCurrency} onChange={e => setReportingCurrency(e.target.value)}>{currencyOptions.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Language</span><select className={selectClasses} value={locale} onChange={e => setLocale(e.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="pt">Português</option><option value="es">Español</option><option value="ar">العربية</option></select></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">Country code</span><input className={inputClasses} value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase().slice(0,2))} placeholder="NG" pattern="[A-Za-z]{2}" maxLength={2} /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-600">IANA timezone</span><input className={inputClasses} value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Africa/Lagos" /></label>
          <div className="flex items-end"><button disabled={savingPreferences} className="w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50">{savingPreferences ? 'Saving…' : 'Save preferences'}</button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-bold text-slate-900">Global sales overview</h2><p className="mt-1 text-sm text-slate-500">Up to 5,000 recent sales. Converts using the latest saved rate effective on or before each sale date.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{reportCurrencyCount} recorded currency {reportCurrencyCount === 1 ? 'type' : 'types'}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Convertible recorded sales</p><p className="mt-2 break-words text-3xl font-black">{reportTotal === null ? '—' : formatGlobalCurrency(reportTotal, reportingCurrency, locale)}</p><p className="mt-2 text-xs text-slate-300">Reporting currency: {reportingCurrency}</p></div>
          <div className="rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Excluded from total</p><p className="mt-2 text-3xl font-black text-slate-900">{reportExcluded}</p><p className="mt-2 text-xs leading-5 text-slate-500">Historical rows without a currency snapshot or rows without a suitable dated FX reference are excluded rather than guessed.</p></div>
          <div className="rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate coverage</p><p className="mt-2 text-lg font-bold text-slate-900">{rates.length} saved FX references</p><p className="mt-2 text-xs leading-5 text-slate-500">Rate selection is auditable by source and effective timestamp. Verify bank fees and settlement terms separately.</p></div>
        </div>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Important: historical sales created before the currency snapshot migration are intentionally not assigned a currency retroactively. The existing POS flow continues to record sales in the business operating currency; multi-currency checkout is not activated by changing this reporting preference.</p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><ArrowLeftRight className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-900">FX reference desk</h2><p className="mt-1 text-sm text-slate-500">Record a rate you obtained from a source you trust. You can fetch a public indicative rate or enter a rate you obtained from a trusted source. Public rates may be delayed and are not guaranteed settlement quotes.</p></div>
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
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void fetchPublicRate()} disabled={fetchingPublicRate} className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 px-4 py-2.5 text-sm font-bold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50">{fetchingPublicRate ? 'Fetching rate…' : 'Fetch public reference rate'}</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Save FX reference</button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><TrendingUp className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Currency conversion calculator</h2><p className="mt-1 text-sm text-slate-500">Uses only a saved manual rate and currency-specific rounding. No transaction is posted.</p></div></div>
          {rates.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Add a verified reference rate to enable conversion. BizGuard will not invent or silently fetch rates.</div> : <>
            <label className="mt-5 block space-y-1.5"><span className="text-xs font-semibold text-slate-600">Saved rate</span><select className={selectClasses} value={selectedRateId || rates[0].id} onChange={e => setSelectedRateId(e.target.value)}>{rates.map(rate => <option key={rate.id} value={rate.id}>{rate.baseCurrency} → {rate.quoteCurrency} · {rate.quotePerBase} ({rate.source})</option>)}</select></label>
            {selectedRate && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p>1 {selectedRate.baseCurrency} = {selectedRate.quotePerBase.toLocaleString()} {selectedRate.quoteCurrency}</p><p className="mt-1">Source: {selectedRate.source} · Effective: {new Date(selectedRate.effectiveAt).toLocaleString()}</p><p className={selectedRate && getRateFreshness(selectedRate.effectiveAt) !== 'fresh' ? 'mt-1 font-bold text-amber-700' : 'mt-1 font-semibold text-emerald-700'}>{getRateFreshness(selectedRate.effectiveAt) === 'fresh' ? 'Less than 24 hours old' : getRateFreshness(selectedRate.effectiveAt) === 'stale' ? 'Stale rate: verify before use' : 'Future or invalid timestamp: verify this rate'}</p></div>}
            <label className="mt-4 block space-y-1.5"><span className="text-xs font-semibold text-slate-600">Amount in {selectedRate?.baseCurrency || 'base currency'}</span><input className={inputClasses} type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <div className="mt-4 rounded-2xl bg-cyan-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Estimated converted amount</p><p className="mt-2 break-words text-3xl font-black text-slate-950">{selectedRate && convertedAmount !== null ? formatGlobalCurrency(convertedAmount, selectedRate.quoteCurrency) : '—'}</p><p className="mt-2 text-xs text-cyan-900">Estimate only. Not a payment, settlement, or guaranteed provider quote.</p></div>
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => { if (selectedRate) void removeRate(selectedRate); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Remove selected rate</button></div>
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

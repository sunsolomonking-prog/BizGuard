import React from 'react';
import { BrainCircuit, Crown, PhoneCall, RefreshCw, Search, ShieldAlert, ShoppingBag, Sparkles, TrendingDown, UserCheck, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { buildCustomerPatronagePredictions, type CustomerPatronagePrediction, type CustomerPredictorResult } from '../lib/customerPredictor';
import { cn } from '../utils/cn';
import { formatCurrency, formatDate } from '../utils/helpers';

const riskStyles = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
};

const actionLabels = {
  sell_now: 'Sell now',
  nurture: 'Nurture',
  win_back: 'Win back',
  collect: 'Collect first',
  protect_vip: 'Protect VIP',
};

export const CustomerPredictor: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [result, setResult] = React.useState<CustomerPredictorResult | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadPredictions = React.useCallback(async () => {
    if (!businessId) {
      setResult(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const next = await buildCustomerPatronagePredictions(businessId);
      setResult(next);
      setSelectedCustomerId((current) => current || next.predictions[0]?.customer.id || null);
    } catch (error) {
      toast.error(error instanceof Error ? `Customer predictor unavailable: ${error.message}` : 'Customer predictor unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => { loadPredictions(); }, [loadPredictions]);

  const predictions = result?.predictions || [];
  const filtered = predictions.filter((prediction) => {
    const haystack = `${prediction.customer.name} ${prediction.customer.phone || ''} ${prediction.customer.email || ''} ${prediction.predictedNextPurchase} ${prediction.recommendedAction}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selected = predictions.find((prediction) => prediction.customer.id === selectedCustomerId) || filtered[0] || null;

  React.useEffect(() => {
    if (!selectedCustomerId && filtered[0]) setSelectedCustomerId(filtered[0].customer.id);
  }, [filtered, selectedCustomerId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-purple-700">
            <BrainCircuit className="h-4 w-4" /> Premium / Enterprise Intelligence
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-800">AI Customer Patronage Predictor</h1>
          <p className="mt-1 max-w-3xl text-slate-500">Predict buy-again probability, churn, loyalty, revenue opportunities and debtor risk from live customers, sales, sale items, invoices, payments and customer intelligence signals.</p>
        </div>
        <button onClick={loadPredictions} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} /> Refresh Predictions
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Customers Analyzed" value={String(result?.summary.totalCustomers || 0)} icon={UserCheck} />
        <Metric label="Likely Buyers" value={String(result?.summary.likelyToBuySoon || 0)} icon={ShoppingBag} tone="emerald" />
        <Metric label="Churn Risk" value={String(result?.summary.churnRiskCustomers || 0)} icon={TrendingDown} tone="red" />
        <Metric label="VIP Customers" value={String(result?.summary.vipCustomers || 0)} icon={Crown} tone="amber" />
        <Metric label="Debtor Risk" value={String(result?.summary.highRiskDebtors || 0)} icon={ShieldAlert} tone="orange" />
        <Metric label="Opportunity" value={formatCurrency(result?.summary.totalRevenueOpportunity || 0)} icon={WalletCards} tone="purple" />
      </div>

      <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white via-purple-50/60 to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-6 w-6 text-purple-600" />
          <div>
            <h2 className="font-black text-slate-800">{result?.summary.providerResult.title || 'AI Customer Predictor'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{result?.summary.providerResult.summary || 'Loading customer patronage intelligence from live BizGuard data...'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(result?.summary.providerResult.recommendations || []).map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-purple-700 shadow-sm">{item}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-2">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-black text-slate-800">Patronage Probability Leaderboard</h2>
              <p className="text-sm text-slate-500">Ranked by buy-again, loyalty, spending growth, churn and payment behaviour.</p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or product..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Patronage</th><th className="px-5 py-3">Buy Again</th><th className="px-5 py-3">Churn</th><th className="px-5 py-3">Loyalty</th><th className="px-5 py-3">Next Purchase</th><th className="px-5 py-3">Est. Value</th><th className="px-5 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Loading live customer predictions...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No customer prediction data yet. Add customers and record sales to activate this intelligence.</td></tr> : filtered.map((prediction) => (
                  <tr key={prediction.customer.id} onClick={() => setSelectedCustomerId(prediction.customer.id)} className={cn('cursor-pointer hover:bg-purple-50/50', selected?.customer.id === prediction.customer.id && 'bg-purple-50')}>
                    <td className="px-5 py-4"><p className="font-bold text-slate-800">#{prediction.vipRank} {prediction.customer.name}</p><p className="text-xs text-slate-500">{prediction.customer.phone || prediction.customer.email || 'No contact'} · Confidence {prediction.confidence}%</p></td>
                    <td className="px-5 py-4"><ScorePill value={prediction.patronageProbability} /></td>
                    <td className="px-5 py-4"><ScorePill value={prediction.buyAgainProbability} tone="emerald" /></td>
                    <td className="px-5 py-4"><span className={cn('rounded-full border px-2 py-1 text-xs font-black capitalize', riskStyles[prediction.churnRisk])}>{prediction.churnRisk} · {prediction.stopBuyingProbability}%</span></td>
                    <td className="px-5 py-4"><ScorePill value={prediction.loyaltyScore} tone="amber" /></td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{prediction.predictedNextPurchase}</td>
                    <td className="px-5 py-4 font-black text-slate-800">{formatCurrency(prediction.estimatedOrderValue)}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{actionLabels[prediction.recommendedAction]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <ListPanel title="Customers likely to buy soon" icon={PhoneCall} items={(result?.opportunities || []).slice(0, 5)} render={(item) => `${item.customer.name} · ${formatCurrency(item.revenueOpportunity)} opportunity`} />
          <ListPanel title="Churn watchlist" icon={TrendingDown} items={(result?.churnWatchlist || []).slice(0, 5)} render={(item) => `${item.customer.name} · ${item.stopBuyingProbability}% stop-buying probability`} />
          <ListPanel title="Collection priority" icon={ShieldAlert} items={(result?.debtorRisk || []).slice(0, 5)} render={(item) => `#${item.collectionPriorityRank} ${item.customer.name} · ${item.defaultProbability}% default risk`} />
        </div>
      </div>

      {selected && <CustomerPredictionDetail prediction={selected} generatedAt={result?.generatedAt || new Date().toISOString()} />}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; icon: typeof UserCheck; tone?: 'emerald' | 'red' | 'amber' | 'orange' | 'purple' }> = ({ label, value, icon: Icon, tone = 'purple' }) => {
  const colors = { emerald: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', amber: 'text-amber-600 bg-amber-50', orange: 'text-orange-600 bg-orange-50', purple: 'text-purple-600 bg-purple-50' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', colors[tone])}><Icon className="h-5 w-5" /></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-800">{value}</p></div>;
};

const ScorePill: React.FC<{ value: number; tone?: 'purple' | 'emerald' | 'amber' }> = ({ value, tone = 'purple' }) => {
  const color = tone === 'emerald' ? 'bg-emerald-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-purple-600';
  return <div className="w-28"><div className="mb-1 flex justify-between text-xs font-bold text-slate-600"><span>{value}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
};

const ListPanel = ({ title, icon: Icon, items, render }: { title: string; icon: typeof PhoneCall; items: CustomerPatronagePrediction[]; render: (item: CustomerPatronagePrediction) => string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-purple-600" /><h2 className="font-black text-slate-800">{title}</h2></div>
    <div className="mt-4 space-y-2">{items.length ? items.map((item) => <div key={item.customer.id} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{render(item)}</div>) : <p className="text-sm text-slate-500">No customers in this segment yet.</p>}</div>
  </div>
);

const CustomerPredictionDetail = ({ prediction, generatedAt }: { prediction: CustomerPatronagePrediction; generatedAt: string }) => (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><h2 className="text-xl font-black text-slate-800">{prediction.customer.name}</h2><p className="text-sm text-slate-500">Prediction generated {formatDate(generatedAt)} · VIP rank #{prediction.vipRank} · Collection rank #{prediction.collectionPriorityRank || 'N/A'}</p></div>
        <span className={cn('rounded-full border px-3 py-1 text-xs font-black uppercase', riskStyles[prediction.churnRisk])}>{prediction.churnRisk} churn risk</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniMetric label="Patronage Probability" value={`${prediction.patronageProbability}%`} />
        <MiniMetric label="Loyalty Score" value={`${prediction.loyaltyScore}%`} />
        <MiniMetric label="Spending Growth" value={`${prediction.spendingGrowthProbability}%`} />
        <MiniMetric label="CLV Estimate" value={formatCurrency(prediction.lifetimeValueEstimate)} />
        <MiniMetric label="Late Payment" value={`${prediction.latePaymentProbability}%`} />
        <MiniMetric label="Default Risk" value={`${prediction.defaultProbability}%`} />
        <MiniMetric label="Predicted Product" value={prediction.predictedNextPurchase} />
        <MiniMetric label="Est. Order Value" value={formatCurrency(prediction.estimatedOrderValue)} />
      </div>
      <div className="mt-6 rounded-2xl bg-purple-50 p-5">
        <h3 className="font-black text-slate-800">Recommendation</h3>
        <p className="mt-2 text-slate-700">{prediction.recommendation}</p>
      </div>
    </div>
    <div className="space-y-4">
      <InfoPanel title="Recommended Products" lines={prediction.recommendedProducts.length ? prediction.recommendedProducts : ['More product history needed.']} />
      <InfoPanel title="Churn Drivers" lines={prediction.churnDrivers.length ? prediction.churnDrivers : ['No major churn driver detected.']} />
      <InfoPanel title="Evidence" lines={prediction.evidence} />
    </div>
  </div>
);

const MiniMetric = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words font-black text-slate-800">{value}</p></div>;
const InfoPanel = ({ title, lines }: { title: string; lines: string[] }) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-800">{title}</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{lines.map((line) => <li key={line}>• {line}</li>)}</ul></div>;

export default CustomerPredictor;

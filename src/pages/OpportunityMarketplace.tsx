import React from 'react';
import { Package, RefreshCw, Rocket, ShoppingBag, Target, TrendingUp, Users, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { buildOpportunityMarketplace, type MarketplaceOpportunity, type OpportunityMarketplaceResult } from '../lib/opportunityMarketplaceEngine';
import { formatCurrency } from '../utils/helpers';
import { buildAutonomousActions, type AutonomousAction } from '../lib/autonomousActionEngine';
import { ActionCard } from '../components/actions/ActionCard';

export const OpportunityMarketplace: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [result, setResult] = React.useState<OpportunityMarketplaceResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actions, setActions] = React.useState<AutonomousAction[]>([]);
  const [generatedActionId, setGeneratedActionId] = React.useState<string | null>(null);
  const businessId = currentBusiness?.id;

  const load = React.useCallback(async () => {
    if (!businessId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const marketplace = await buildOpportunityMarketplace(businessId);
      setResult(marketplace);
      setActions(await buildAutonomousActions(businessId, { marketplace }));
      setGeneratedActionId(null);
    }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Opportunity Marketplace unavailable.'); }
    finally { setIsLoading(false); }
  }, [businessId]);

  React.useEffect(() => { load(); }, [load]);

  return <div className="space-y-6"><div className="rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-black p-6 text-white shadow-2xl shadow-purple-950/30"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-purple-200"><ShoppingBag className="mr-2 inline h-4 w-4" />Opportunity Marketplace Intelligence</p><h1 className="mt-3 text-3xl font-black">Opportunity Marketplace</h1><p className="mt-2 text-purple-100/80">A live marketplace of product, profit, inventory, customer and growth opportunities from existing BizGuard data.</p></div><button onClick={load} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white"><RefreshCw className={`mr-2 inline h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button></div></div><div className="grid gap-4 md:grid-cols-4"><Metric label="Opportunities" value={String(result?.summary.totalOpportunities || 0)} icon={Target} /><Metric label="Revenue Impact" value={formatCurrency(result?.summary.expectedRevenueImpact || 0)} icon={TrendingUp} /><Metric label="Avg Confidence" value={`${result?.summary.averageConfidence || 0}%`} icon={Rocket} /><Metric label="Fastest Product" value={result?.summary.fastestProduct || 'No data'} icon={Package} /></div>{isLoading ? <div className="rounded-3xl border border-purple-100 bg-white/85 p-10 text-center text-slate-500"><RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-purple-600" />Scanning marketplace opportunities...</div> : <>
        {actions.length > 0 && <section className="space-y-4"><div><h2 className="text-xl font-black text-slate-900">Autonomous Action Engine</h2><p className="text-sm text-slate-500">Convert detected opportunities into reviewable action plans. No action is executed without human approval.</p></div><div className="grid gap-4 xl:grid-cols-2">{actions.map((action) => <ActionCard key={action.id} action={action} generated={generatedActionId === action.id} onGeneratePlan={(nextAction) => setGeneratedActionId(nextAction.id)} />)}</div></section>}
        <div className="grid gap-6 xl:grid-cols-2"><Section title="Top Revenue Opportunities" icon={TrendingUp} items={result?.topRevenueOpportunities || []} /><Section title="Top Profit Opportunities" icon={WalletCards} items={result?.topProfitOpportunities || []} /><Section title="Inventory Opportunities" icon={Package} items={result?.inventoryOpportunities || []} /><Section title="Customer Opportunities" icon={Users} items={result?.customerOpportunities || []} /><Section title="Growth Opportunities" icon={Rocket} items={result?.growthOpportunities || []} /></div></>}</div>;
};

const Metric = ({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Target }) => <div className="rounded-2xl border border-purple-100 bg-white/80 p-5 shadow-lg shadow-purple-950/5"><Icon className="h-5 w-5 text-purple-600" /><p className="mt-3 text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-2xl font-black text-slate-900">{value}</p></div>;
const Section = ({ title, icon: Icon, items }: { title: string; icon: typeof TrendingUp; items: MarketplaceOpportunity[] }) => <div className="rounded-3xl border border-purple-100 bg-white/85 p-5 shadow-lg shadow-purple-950/5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900"><Icon className="h-5 w-5 text-purple-600" />{title}</h2><div className="space-y-3">{items.length ? items.map((item) => <OpportunityCard key={item.id} item={item} />) : <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No opportunities in this category yet.</p>}</div></div>;
const OpportunityCard = ({ item }: { item: MarketplaceOpportunity }) => <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/70 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase text-purple-700">{item.category}</p><p className="font-black text-slate-900">{item.opportunityName}</p></div><span className="rounded-full bg-black px-2 py-1 text-xs font-black text-purple-100">{item.confidenceScore}%</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Expected Revenue Impact</p><p className="font-black text-slate-900">{formatCurrency(item.expectedRevenueImpact)}</p></div><div><p className="text-xs text-slate-500">Recommended Action</p><p className="text-sm font-semibold text-slate-700">{item.recommendedAction}</p></div></div><p className="mt-3 text-xs text-slate-500">Evidence: {item.evidence}</p></div>;
export default OpportunityMarketplace;

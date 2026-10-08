import React from 'react';
import { Activity, Brain, RefreshCw, ShieldAlert, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useAppStore } from '../store';
import { getBusinessDoctorAnalysis } from '../lib/aiOperatingSystem';
import type { BusinessAnalysisResult } from '../lib/ai/providers';

type DoctorResult = BusinessAnalysisResult & { scores: Record<string, number> };

export const BusinessDoctor: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [result, setResult] = React.useState<DoctorResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const load = React.useCallback(async () => {
    if (!businessId) { setIsLoading(false); return; }
    setIsLoading(true);
    try { setResult(await getBusinessDoctorAnalysis(businessId)); } finally { setIsLoading(false); }
  }, [businessId]);

  React.useEffect(() => { load(); }, [load]);

  const scores = result?.scores || {};
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-800">AI Business Doctor</h1><p className="text-slate-500">Diagnosis, root cause, impact and action plan from live BizGuard data</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Score label="Business Health" value={scores.businessHealth} icon={Activity} /><Score label="Profitability" value={scores.profitabilityScore} icon={Wallet} /><Score label="Cashflow" value={scores.cashflowScore} icon={TrendingUp} /><Score label="Operational Risk" value={scores.operationalRisk} icon={ShieldAlert} inverse /></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Brain className="h-7 w-7 text-purple-600" /><h2 className="text-xl font-black text-slate-800">{result?.title || 'Analyzing business...'}</h2></div><p className="mt-4 text-slate-600">{result?.summary || 'Loading live business diagnosis...'}</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel title="Strengths & Recommendations" items={result?.recommendations || []} /><Panel title="Risks" items={result?.risks.length ? result.risks : ['No critical risk detected from current data.']} /></div>
      <Panel title="Recommended Actions" items={result?.actionPlan || []} />
    </div>
  );
};

const Score = ({ label, value = 0, icon: Icon, inverse = false }: { label: string; value?: number; icon: typeof Activity; inverse?: boolean }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-purple-600" /><p className="mt-3 text-sm text-slate-500">{label}</p><p className="text-3xl font-black text-slate-800">{Math.round(value)}/100</p><div className="mt-3 h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${inverse ? 'bg-red-500' : 'bg-purple-600'}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
const Panel = ({ title, items }: { title: string; items: string[] }) => <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600" /><h2 className="font-bold text-slate-800">{title}</h2></div><div className="space-y-2">{items.length ? items.map((item) => <div key={item} className="rounded-lg bg-purple-50 p-3 text-sm text-slate-700">{item}</div>) : <p className="text-sm text-slate-500">No items yet.</p>}</div></div>;

export default BusinessDoctor;

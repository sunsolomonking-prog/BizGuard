import React from 'react';
import { BrainCircuit, CheckCircle2, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store';
import { getAICEOAdvice } from '../lib/aiOperatingSystem';
import type { BusinessAnalysisResult } from '../lib/ai/providers';
import { buildAutonomousActionsFromRecommendations, type AutonomousAction } from '../lib/autonomousActionEngine';
import { ActionCard } from '../components/actions/ActionCard';

const defaultQuestions = [
  'Should I open another branch?',
  'Can I hire staff?',
  'Should I increase prices?',
  'Can I expand inventory?',
  'Should I take a loan?',
  'Which products should I push?',
];

export const AICEO: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [question, setQuestion] = React.useState(defaultQuestions[0]);
  const [result, setResult] = React.useState<BusinessAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [actions, setActions] = React.useState<AutonomousAction[]>([]);
  const [generatedActionId, setGeneratedActionId] = React.useState<string | null>(null);
  const businessId = currentBusiness?.id;

  const ask = React.useCallback(async (nextQuestion = question) => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const nextResult = await getAICEOAdvice(businessId, nextQuestion);
      setResult(nextResult);
      setActions(buildAutonomousActionsFromRecommendations([...nextResult.recommendations, ...nextResult.actionPlan], nextResult.confidence));
      setGeneratedActionId(null);
    } finally { setIsLoading(false); }
  }, [businessId, question]);

  React.useEffect(() => { ask(defaultQuestions[0]); }, [ask]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-black text-slate-800">AI CEO</h1><p className="text-slate-500">Strategic decision engine for expansion, pricing, staffing, loans and growth.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label className="text-sm font-semibold text-slate-700">Ask the AI CEO</label><div className="mt-3 flex gap-3"><input value={question} onChange={(event) => setQuestion(event.target.value)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3" /><button onClick={() => ask()} disabled={isLoading} className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white"><RefreshCw className={`inline h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Analyze</button></div><div className="mt-4 flex flex-wrap gap-2">{defaultQuestions.map((item) => <button key={item} onClick={() => { setQuestion(item); ask(item); }} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{item}</button>)}</div></div>
      {actions.length > 0 && <section className="space-y-4"><div><h2 className="text-xl font-black text-slate-800">AI CEO Action Engine</h2><p className="text-sm text-slate-500">Turn AI CEO recommendations into reviewable action plans. Human approval is required before execution.</p></div><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{actions.map((action) => <ActionCard key={action.id} action={action} generated={generatedActionId === action.id} onGeneratePlan={(nextAction) => setGeneratedActionId(nextAction.id)} />)}</div></section>}
      {result && <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><div className="flex items-center gap-3"><BrainCircuit className="h-7 w-7 text-purple-600" /><h2 className="text-xl font-black text-slate-800">{result.title}</h2></div><p className="mt-4 text-slate-600">{result.summary}</p><p className="mt-4 text-sm font-bold text-purple-700">Confidence: {result.confidence}%</p></div><Panel title="Risks" items={result.risks} icon={ShieldAlert} /><Panel title="Action Plan" items={result.actionPlan} icon={CheckCircle2} /><Panel title="Recommendations" items={result.recommendations} icon={TrendingUp} /></div>}
    </div>
  );
};

const Panel = ({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof ShieldAlert }) => <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-2"><Icon className="h-5 w-5 text-purple-600" /><h2 className="font-bold text-slate-800">{title}</h2></div><div className="space-y-2">{items.length ? items.map((item) => <div key={item} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item}</div>) : <p className="text-sm text-slate-500">No items.</p>}</div></div>;

export default AICEO;

import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import type { AutonomousAction } from '../../lib/autonomousActionEngine';

interface ActionCardProps {
  action: AutonomousAction;
  onGeneratePlan?: (action: AutonomousAction) => void;
  generated?: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onGeneratePlan, generated = false }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{action.title}</p>
          <h3 className="mt-1 font-black text-slate-900">{action.recommendation}</h3>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{action.confidence}%</span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">Expected Impact</p>
        <p className="mt-1 text-sm font-bold text-slate-800">{action.expectedImpact}</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">Confidence</p>
        <p className="mt-1 text-sm font-bold text-slate-800">{action.confidence}% based on available signals</p>
      </div>
    </div>

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600" /> Human approval required — nothing executes automatically.
      </div>
      <button
        type="button"
        onClick={() => onGeneratePlan?.(action)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
      >
        {generated ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        {generated ? 'Plan Generated' : action.actionLabel}
      </button>
    </div>

    {generated && (
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Proposed plan</p>
        <ol className="mt-2 space-y-2 text-sm text-slate-700">
          {action.plan.map((step, index) => <li key={`${action.id}-${index}`}><span className="mr-2 font-black text-emerald-700">{index + 1}.</span>{step}</li>)}
        </ol>
      </div>
    )}
  </article>
);

export default ActionCard;

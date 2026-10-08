import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Shield, Zap } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { Database as DB } from '../lib/database.types';

type HealthEvent = DB['public']['Tables']['system_health_events']['Row'];
type ErrorEvent = DB['public']['Tables']['error_events']['Row'];
type PerformanceEvent = DB['public']['Tables']['performance_events']['Row'];

export const SystemHealth: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [health, setHealth] = React.useState<HealthEvent[]>([]);
  const [errors, setErrors] = React.useState<ErrorEvent[]>([]);
  const [perf, setPerf] = React.useState<PerformanceEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const [healthResult, errorResult, perfResult] = await Promise.all([
      supabase.from('system_health_events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('error_events').select('*').eq('business_id', currentBusiness?.id || '').order('created_at', { ascending: false }).limit(50),
      supabase.from('performance_events').select('*').eq('business_id', currentBusiness?.id || '').order('created_at', { ascending: false }).limit(50),
    ]);
    setHealth(healthResult.data || []);
    setErrors(errorResult.data || []);
    setPerf(perfResult.data || []);
    setIsLoading(false);
  }, [currentBusiness?.id]);

  React.useEffect(() => { load(); }, [load]);

  const criticalErrors = errors.filter((error) => error.severity === 'critical' || error.severity === 'high');
  const slowEvents = perf.filter((event) => event.rating === 'poor' || event.rating === 'needs_improvement');
  const operational = criticalErrors.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-800">System Health</h1><p className="text-slate-500">Frontend, backend, Supabase and performance monitoring</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Card icon={operational ? CheckCircle2 : AlertTriangle} label="Overall" value={operational ? 'Operational' : 'Degraded'} tone={operational ? 'emerald' : 'red'} /><Card icon={Database} label="Supabase Events" value={String(health.length)} tone="blue" /><Card icon={Shield} label="High/Critical Errors" value={String(criticalErrors.length)} tone="red" /><Card icon={Zap} label="Slow Events" value={String(slowEvents.length)} tone="yellow" /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel title="Recent Errors">{errors.length ? errors.slice(0, 8).map((event) => <Row key={event.id} title={event.message} meta={`${event.source} · ${event.severity}`} />) : <Empty text="No captured errors yet." />}</Panel><Panel title="Performance Events">{perf.length ? perf.slice(0, 8).map((event) => <Row key={event.id} title={`${event.page} / ${event.metric_name}`} meta={`${event.metric_value}ms · ${event.rating || 'unrated'}`} />) : <Empty text="No performance events yet." />}</Panel></div>
      <Panel title="System Health Events">{health.length ? health.slice(0, 10).map((event) => <Row key={event.id} title={`${event.service}: ${event.status}`} meta={event.message || new Date(event.created_at).toLocaleString()} />) : <Empty text="No health events recorded. Monitoring tables are ready." />}</Panel>
    </div>
  );
};

const Card = ({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: 'emerald' | 'blue' | 'red' | 'yellow' }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className={`h-6 w-6 text-${tone}-600`} /><p className="mt-3 text-sm text-slate-500">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold text-slate-800">{title}</h2><div className="space-y-2">{children}</div></div>;
const Row = ({ title, meta }: { title: string; meta: string }) => <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold text-slate-800">{title}</p><p className="text-sm text-slate-500">{meta}</p></div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>;

export default SystemHealth;

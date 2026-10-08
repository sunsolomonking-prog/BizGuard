import React from 'react';
import { BarChart3, CalendarDays, Mic, RefreshCw, Users, Wallet } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import type { Database } from '../lib/database.types';
import { buildAutonomousActions, type AutonomousAction } from '../lib/autonomousActionEngine';
import { ActionCard } from '../components/actions/ActionCard';

type AnalyticsEvent = Database['public']['Tables']['user_analytics_events']['Row'];
type VoiceUsage = Database['public']['Tables']['voice_ai_usage']['Row'];
type Subscription = Database['public']['Tables']['business_subscriptions']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];

export const Analytics: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [events, setEvents] = React.useState<AnalyticsEvent[]>([]);
  const [voice, setVoice] = React.useState<VoiceUsage[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actions, setActions] = React.useState<AutonomousAction[]>([]);
  const [generatedActionId, setGeneratedActionId] = React.useState<string | null>(null);
  const businessId = currentBusiness?.id;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const [eventResult, voiceResult, subResult, salesResult] = await Promise.all([
      supabase.from('user_analytics_events').select('*').eq('business_id', businessId || '').order('created_at', { ascending: false }).limit(500),
      supabase.from('voice_ai_usage').select('*').eq('business_id', businessId || '').order('usage_date', { ascending: false }).limit(100),
      supabase.from('business_subscriptions').select('*').eq('business_id', businessId || '').limit(10),
      supabase.from('sales').select('*').eq('business_id', businessId || '').order('created_at', { ascending: false }).limit(500),
    ]);
    setEvents(eventResult.data || []);
    if (businessId) {
      try {
        setActions(await buildAutonomousActions(businessId, { focus: 'profit' }));
      } catch {
        setActions([]);
      }
    } else {
      setActions([]);
    }
    setGeneratedActionId(null);
    setVoice(voiceResult.data || []);
    setSubscriptions(subResult.data || []);
    setSales(salesResult.data || []);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => { load(); }, [load]);

  const dau = new Set(events.filter((event) => new Date(event.created_at) > new Date(Date.now() - 86400000)).map((event) => event.user_id)).size;
  const mau = new Set(events.filter((event) => new Date(event.created_at) > new Date(Date.now() - 30 * 86400000)).map((event) => event.user_id)).size;
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const voiceUsed = voice.reduce((sum, row) => sum + Number(row.total_commands_used || 0), 0);
  const featureCounts = Array.from(events.reduce((map, event) => map.set(event.feature, (map.get(event.feature) || 0) + 1), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-800">Analytics Dashboard</h1><p className="text-slate-500">DAU, MAU, feature usage, AI usage, subscription conversion and business activity</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Metric icon={Users} label="DAU" value={String(dau)} /><Metric icon={CalendarDays} label="MAU" value={String(mau)} /><Metric icon={Mic} label="Voice AI Usage" value={String(voiceUsed)} /><Metric icon={Wallet} label="Revenue Signal" value={formatCurrency(revenue)} /></div>
      {actions.length > 0 && <section className="space-y-4"><div><h2 className="text-xl font-black text-slate-800">Profit Intelligence</h2><p className="text-sm text-slate-500">Review profit-focused recommendations and generate plans without changing existing financial or sales data.</p></div><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{actions.map((action) => <ActionCard key={action.id} action={action} generated={generatedActionId === action.id} onGeneratePlan={(nextAction) => setGeneratedActionId(nextAction.id)} />)}</div></section>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel title="Feature Usage">{featureCounts.length ? featureCounts.map(([feature, count]) => <Row key={feature} title={feature} value={`${count} events`} />) : <Empty text="No analytics events recorded yet." />}</Panel><Panel title="Subscription Analytics">{subscriptions.length ? subscriptions.map((sub) => <Row key={sub.id} title={sub.plan_code} value={sub.status} />) : <Empty text="No subscription analytics yet. Free plan is created after migration." />}</Panel></div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold text-slate-800">{title}</h2><div className="space-y-2">{children}</div></div>;
const Row = ({ title, value }: { title: string; value: string }) => <div className="flex justify-between rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-800">{title}</span><span className="text-slate-600">{value}</span></div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>;

export default Analytics;

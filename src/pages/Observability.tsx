import React from 'react';
import { Activity, DatabaseBackup, LockKeyhole, RefreshCw, ShieldAlert, TerminalSquare } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type BusinessEvent = Database['public']['Tables']['business_events']['Row'];
type SecurityEvent = Database['public']['Tables']['security_events']['Row'];
type BackupJob = Database['public']['Tables']['backup_jobs']['Row'];
type AgentRun = Database['public']['Tables']['ai_agent_runs']['Row'];

export const Observability: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [businessEvents, setBusinessEvents] = React.useState<BusinessEvent[]>([]);
  const [securityEvents, setSecurityEvents] = React.useState<SecurityEvent[]>([]);
  const [backupJobs, setBackupJobs] = React.useState<BackupJob[]>([]);
  const [agentRuns, setAgentRuns] = React.useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const [businessResult, securityResult, backupResult, aiResult] = await Promise.all([
      supabase.from('business_events').select('*').eq('business_id', businessId || '').order('created_at', { ascending: false }).limit(100),
      supabase.from('security_events').select('*').eq('business_id', businessId || '').order('created_at', { ascending: false }).limit(100),
      supabase.from('backup_jobs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('ai_agent_runs').select('*').eq('business_id', businessId || '').order('created_at', { ascending: false }).limit(100),
    ]);
    setBusinessEvents(businessResult.data || []);
    setSecurityEvents(securityResult.data || []);
    setBackupJobs(backupResult.data || []);
    setAgentRuns(aiResult.data || []);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-800">Production Observability</h1><p className="text-slate-500">Audit logs, business events, AI events, security events, performance and recovery status</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Metric icon={Activity} label="Business Events" value={String(businessEvents.length)} /><Metric icon={LockKeyhole} label="Security Events" value={String(securityEvents.length)} /><Metric icon={TerminalSquare} label="AI Agent Runs" value={String(agentRuns.length)} /><Metric icon={DatabaseBackup} label="Backup Jobs" value={String(backupJobs.length)} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel title="Business Event Logs">{businessEvents.length ? businessEvents.slice(0, 10).map((event) => <Row key={event.id} title={event.event_type} value={event.description || event.entity_type || 'Business event'} />) : <Empty text="No business events recorded yet." />}</Panel><Panel title="Security Event Logs">{securityEvents.length ? securityEvents.slice(0, 10).map((event) => <Row key={event.id} title={event.event_type} value={`${event.severity} · ${new Date(event.created_at).toLocaleString()}`} />) : <Empty text="No security events recorded yet." />}</Panel><Panel title="AI Agent Logs">{agentRuns.length ? agentRuns.slice(0, 10).map((run) => <Row key={run.id} title={run.agent} value={run.prompt} />) : <Empty text="No AI agent runs recorded yet." />}</Panel><Panel title="Backup & Recovery Jobs">{backupJobs.length ? backupJobs.slice(0, 10).map((job) => <Row key={job.id} title={`${job.backup_type}: ${job.status}`} value={job.location || job.notes || 'No location recorded'} />) : <Empty text="No backup jobs recorded. See docs/operations for runbook." />}</Panel></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><ShieldAlert className="h-6 w-6 text-amber-600" /><div><h2 className="font-bold text-slate-800">Recovery Verification Checklist</h2><p className="text-sm text-slate-500">Verify backup location, checksum, migration version, RLS integrity, auth login, and smoke tests after every restore.</p></div></div></div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold text-slate-800">{title}</h2><div className="space-y-2">{children}</div></div>;
const Row = ({ title, value }: { title: string; value: string }) => <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold capitalize text-slate-800">{title}</p><p className="text-sm text-slate-500">{value}</p></div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>;

export default Observability;

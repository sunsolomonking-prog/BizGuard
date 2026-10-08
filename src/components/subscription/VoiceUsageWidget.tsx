import React from 'react';
import { Mic, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getResetCountdown, getVoiceUsageStatus, type VoiceUsageStatus } from '../../lib/subscriptions';
import { cn } from '../../utils/cn';

interface VoiceUsageWidgetProps {
  businessId?: string | null;
  compact?: boolean;
}

const fallbackUsage = (businessId: string): VoiceUsageStatus => ({
  business_id: businessId,
  plan_code: 'free',
  plan_name: 'Free',
  used_today: 0,
  remaining_today: 3,
  daily_limit: 3,
  is_unlimited: false,
  reset_at: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
  upgrade_message: 'Voice AI available.',
});

export const VoiceUsageWidget: React.FC<VoiceUsageWidgetProps> = ({ businessId, compact = false }) => {
  const navigate = useNavigate();
  const [usage, setUsage] = React.useState<VoiceUsageStatus | null>(businessId ? fallbackUsage(businessId) : null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadUsage = React.useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    setError(null);
    try {
      const nextUsage = await getVoiceUsageStatus(businessId);
      setUsage(nextUsage);
    } catch (loadError) {
      setUsage(fallbackUsage(businessId));
      setError(loadError instanceof Error ? loadError.message : 'Voice usage is temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  if (!businessId) return null;

  const used = usage?.used_today || 0;
  const limit = usage?.daily_limit;
  const remaining = usage?.remaining_today;
  const percentage = usage?.is_unlimited || !limit ? 100 : Math.min(100, (used / limit) * 100);

  return (
    <div className={cn('rounded-2xl border border-cyan-200 bg-gradient-to-br from-slate-900 to-emerald-900 text-white shadow-lg shadow-emerald-900/10', compact ? 'p-4' : 'p-6')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/15 ring-1 ring-cyan-300/30">
            <Mic className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="text-sm text-cyan-100/80">Voice Usage Today</p>
            <h3 className="text-lg font-black">{usage?.plan_name || 'Free'} Plan</h3>
          </div>
        </div>
        <button onClick={loadUsage} disabled={isLoading} className="rounded-lg p-2 text-cyan-100/70 hover:bg-white/10 disabled:opacity-50" aria-label="Refresh voice usage">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-black">{usage?.is_unlimited ? 'Unlimited' : `${used} / ${limit || 0}`}</p>
            <p className="text-sm text-cyan-100/80">{usage?.is_unlimited ? 'No daily restrictions' : `${remaining ?? 0} Remaining`}</p>
          </div>
          <div className="text-right text-sm text-cyan-100/80">
            <p>Resets In</p>
            <p className="font-bold text-white">{getResetCountdown(usage?.reset_at)}</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-amber-100">{error}</p>}
      {usage?.upgrade_message && !usage.is_unlimited && remaining === 0 && <p className="mt-3 text-sm text-amber-100">{usage.upgrade_message}</p>}
      {usage && !usage.is_unlimited && remaining === 0 && !compact && <div className="mt-4 rounded-xl bg-white/95 p-3 text-slate-950"><p className="text-sm font-bold">Voice limit reached.</p><p className="mt-1 text-xs text-slate-600">Choose a paid plan to see payment details and continue.</p><button type="button" onClick={() => navigate('/subscription')} className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">Choose a plan</button></div>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button onClick={() => navigate('/subscription')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-cyan-50">
          <Zap className="h-4 w-4" /> Upgrade
        </button>
        <button onClick={() => navigate('/ai-assistant')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
          <Sparkles className="h-4 w-4" /> Use Voice AI
        </button>
      </div>
    </div>
  );
};

export default VoiceUsageWidget;

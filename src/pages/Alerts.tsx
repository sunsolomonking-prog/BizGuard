import React from 'react';
import { Bell, Check, Trash2, Filter, BellOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import type { Database } from '../lib/database.types';

type AlertRow = Database['public']['Tables']['alerts']['Row'];

export const Alerts: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const businessId = currentBusiness?.id;
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [filter, setFilter] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadAlerts = React.useCallback(async () => {
    if (!businessId) {
      setAlerts([]);
      setError('No business is selected. Sign in again to load alerts.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const { data, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (alertsError) {
      setError(alertsError.message);
      toast.error(`Could not load alerts: ${alertsError.message}`);
      setAlerts([]);
    } else {
      setAlerts(data || []);
    }
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  React.useEffect(() => {
    if (!businessId) return undefined;
    const channel = supabase
      .channel(`alerts-center-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `business_id=eq.${businessId}` }, () => loadAlerts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, loadAlerts]);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.is_read;
    if (filter === 'read') return alert.is_read;
    return true;
  });

  const markAlertAsRead = async (alertId: string) => {
    const { error: updateError } = await supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
    if (updateError) {
      toast.error(`Could not update alert: ${updateError.message}`);
      return;
    }
    setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, is_read: true } : alert));
  };

  const markAllAsRead = async () => {
    if (!businessId) return;
    const { error: updateError } = await supabase.from('alerts').update({ is_read: true }).eq('business_id', businessId).eq('is_read', false);
    if (updateError) {
      toast.error(`Could not update alerts: ${updateError.message}`);
      return;
    }
    toast.success('All alerts marked as read');
    await loadAlerts();
  };

  const dismissAlert = async (alertId: string) => {
    const { error: deleteError } = await supabase.from('alerts').delete().eq('id', alertId);
    if (deleteError) {
      toast.error(`Could not dismiss alert: ${deleteError.message}`);
      return;
    }
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'success': return '🟢';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  const unreadCount = alerts.filter((alert) => !alert.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notification Center</h1>
          <p className="text-slate-500 mt-1">Live low stock, debtor, security, system, and business alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAlerts} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={markAllAsRead} disabled={unreadCount === 0} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
            <BellOff className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4"><p className="font-medium">Alerts error</p><p className="text-sm mt-1">{error}</p></div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><p className="text-sm text-slate-500">Total</p><p className="text-2xl font-bold text-slate-800">{alerts.length}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><p className="text-sm text-slate-500">Unread</p><p className="text-2xl font-bold text-emerald-600">{unreadCount}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><p className="text-sm text-slate-500">Critical</p><p className="text-2xl font-bold text-red-600">{alerts.filter((alert) => alert.severity === 'error').length}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><p className="text-sm text-slate-500">Warnings</p><p className="text-2xl font-bold text-yellow-600">{alerts.filter((alert) => alert.severity === 'warning').length}</p></div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All Alerts</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl p-10 border border-slate-200 text-center text-slate-500"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />Loading alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl p-10 border border-slate-200 text-center text-slate-500"><Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />No alerts found</div>
        ) : filteredAlerts.map((alert) => (
          <div key={alert.id} className={cn('bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start gap-4', !alert.is_read && 'border-l-4 border-l-emerald-500')}>
            <span className="text-2xl">{getSeverityIcon(alert.severity)}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className={cn('font-semibold', !alert.is_read && 'text-slate-800', alert.is_read && 'text-slate-600')}>{alert.title}</h3>
                <span className="text-xs text-slate-400">{formatDate(alert.created_at, 'MMM dd, HH:mm')}</span>
              </div>
              <p className="text-slate-600 mt-1">{alert.message}</p>
              <div className="flex items-center gap-3 mt-3">
                {!alert.is_read && <button onClick={() => markAlertAsRead(alert.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"><Check className="w-3 h-3" />Mark as read</button>}
                {alert.action_url && <a href={alert.action_url} className="text-xs text-blue-600 hover:text-blue-700">Open related page</a>}
                <button onClick={() => dismissAlert(alert.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" />Dismiss</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;

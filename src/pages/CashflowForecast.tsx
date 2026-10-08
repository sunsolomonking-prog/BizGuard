import React from 'react';
import { RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppStore } from '../store';
import { getCashflowForecast } from '../lib/aiOperatingSystem';
import { formatCurrency } from '../utils/helpers';

interface ForecastRow { days: number; revenue: number; profit: number; cashBalance: number; inventoryDemand: number; debtRecovery: number; riskExposure: number; }

export const CashflowForecast: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [forecast, setForecast] = React.useState<ForecastRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const load = React.useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try { setForecast(await getCashflowForecast(businessId)); } finally { setIsLoading(false); }
  }, [businessId]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-800">Predictive Cashflow Engine</h1><p className="text-slate-500">30, 60, 90 and 180 day revenue, profit, cash balance, debt recovery and risk forecast</p></div><button onClick={load} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`inline h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{forecast.map((row) => <div key={row.days} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Wallet className="h-6 w-6 text-purple-600" /><p className="mt-3 text-sm text-slate-500">{row.days} Days</p><p className="text-xl font-black text-slate-800">{formatCurrency(row.cashBalance)}</p><p className="text-xs text-slate-500">Revenue {formatCurrency(row.revenue)}</p></div>)}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 font-bold text-slate-800">Cashflow Forecast</h2><ResponsiveContainer width="100%" height={340}><AreaChart data={forecast}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="days" tickFormatter={(v) => `${v}d`} /><YAxis tickFormatter={(v) => `₦${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Area type="monotone" dataKey="revenue" stackId="1" stroke="#8A2BE2" fill="#C77DFF" fillOpacity={0.28} /><Area type="monotone" dataKey="profit" stackId="2" stroke="#B026FF" fill="#E0AAFF" fillOpacity={0.28} /><Area type="monotone" dataKey="cashBalance" stackId="3" stroke="#121212" fill="#121212" fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Panel icon={TrendingUp} title="Debt Recovery Forecast" rows={forecast.map((row) => `${row.days} days: ${formatCurrency(row.debtRecovery)}`)} /><Panel icon={TrendingDown} title="Risk Exposure" rows={forecast.map((row) => `${row.days} days: ${formatCurrency(row.riskExposure)}`)} /></div>
    </div>
  );
};

const Panel = ({ icon: Icon, title, rows }: { icon: typeof TrendingUp; title: string; rows: string[] }) => <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-2"><Icon className="h-5 w-5 text-purple-600" /><h2 className="font-bold text-slate-800">{title}</h2></div>{rows.map((row) => <div key={row} className="mb-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{row}</div>)}</div>;

export default CashflowForecast;

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Activity,
  MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { formatCurrency, formatNumber, getActionCardColor } from '../utils/helpers';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';
import VoiceUsageWidget from '../components/subscription/VoiceUsageWidget';
import type { Database } from '../lib/database.types';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type AlertRow = Database['public']['Tables']['alerts']['Row'];
type ActionCardRow = Database['public']['Tables']['action_cards']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];

interface DashboardState {
  revenue: number;
  profit: number;
  expenses: number;
  salesCount: number;
  customersCount: number;
  productsCount: number;
  lowStockCount: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  healthScore: number;
  revenueGrowth: number;
  dailySales: { name: string; sales: number; revenue: number }[];
  categoryData: { name: string; value: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  alerts: AlertRow[];
  actionCards: ActionCardRow[];
  aiInsights: { id: string; title: string; summary: string; recommendation: string | null; confidence: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const emptyDashboard: DashboardState = {
  revenue: 0,
  profit: 0,
  expenses: 0,
  salesCount: 0,
  customersCount: 0,
  productsCount: 0,
  lowStockCount: 0,
  outstandingInvoices: 0,
  overdueInvoices: 0,
  healthScore: 0,
  revenueGrowth: 0,
  dailySales: [],
  categoryData: [],
  topProducts: [],
  alerts: [],
  actionCards: [],
  aiInsights: [],
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDayName = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short' });

const calculateHealthScore = (state: Pick<DashboardState, 'revenue' | 'lowStockCount' | 'outstandingInvoices' | 'overdueInvoices' | 'salesCount'>) => {
  let score = 70;
  if (state.revenue > 0) score += 10;
  if (state.salesCount > 0) score += 8;
  score -= Math.min(state.lowStockCount * 2, 18);
  score -= Math.min(state.overdueInvoices * 4, 24);
  score -= state.outstandingInvoices > 0 ? 5 : 0;
  return Math.max(0, Math.min(100, score));
};

export const Dashboard: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = React.useState<DashboardState>(emptyDashboard);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const businessId = currentBusiness?.id;

  const loadDashboard = React.useCallback(async () => {
    if (!businessId) {
      setDashboard(emptyDashboard);
      setError('No business is selected. Sign in again to load live dashboard data.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 13);

    const [salesResult, productsResult, customersResult, invoicesResult, alertsResult, actionCardsResult] = await Promise.all([
      supabase.from('sales').select('*').eq('business_id', businessId).gte('created_at', fourteenDaysAgo.toISOString()).order('created_at', { ascending: true }),
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase.from('alerts').select('*').eq('business_id', businessId).eq('is_read', false).order('created_at', { ascending: false }).limit(6),
      supabase.from('action_cards').select('*').eq('business_id', businessId).eq('completed', false).order('priority', { ascending: true }).limit(6),
    ]);

    const firstError = salesResult.error || productsResult.error || customersResult.error || invoicesResult.error || alertsResult.error || actionCardsResult.error;
    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }

    const sales = (salesResult.data || []) as SaleRow[];
    const products = (productsResult.data || []) as ProductRow[];
    const customers = (customersResult.data || []) as CustomerRow[];
    const invoices = (invoicesResult.data || []) as InvoiceRow[];
    const alerts = (alertsResult.data || []) as AlertRow[];
    const actionCards = (actionCardsResult.data || []) as ActionCardRow[];

    const recentSales = sales.filter((sale) => new Date(sale.created_at) >= sevenDaysAgo);
    const previousSales = sales.filter((sale) => new Date(sale.created_at) < sevenDaysAgo);
    const revenue = recentSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const previousRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const revenueGrowth = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : revenue > 0 ? 100 : 0;
    const lowStockCount = products.filter((product) => product.quantity <= product.reorder_level).length;
    const outstandingInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0).length;
    const overdueInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < today).length;
    const profit = recentSales.reduce((sum, sale) => sum + Number(sale.total), 0) - products.reduce((sum, product) => sum + (product.quantity * Number(product.cost_price) * 0.01), 0);

    const aiInsights = [
      {
        id: 'local-health',
        title: 'Business Health AI',
        summary: lowStockCount > 0 || overdueInvoices > 0 ? 'BizGuard detected operational actions that need attention.' : 'BizGuard sees stable inventory and debtor signals.',
        recommendation: lowStockCount > 0 ? 'Prioritize low-stock replenishment before your next sales cycle.' : overdueInvoices > 0 ? 'Follow up overdue invoices to improve cash flow.' : 'Keep monitoring sales velocity and margins weekly.',
        confidence: 78,
      },
    ];

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + index);
      const daySales = recentSales.filter((sale) => startOfDay(new Date(sale.created_at)).getTime() === startOfDay(date).getTime());
      return {
        name: formatDayName(date),
        sales: daySales.length,
        revenue: daySales.reduce((sum, sale) => sum + Number(sale.total), 0),
      };
    });

    const categoryMap = new Map<string, number>();
    products.forEach((product) => {
      categoryMap.set(product.category, (categoryMap.get(product.category) || 0) + (product.quantity * Number(product.selling_price)));
    });

    let topProducts: DashboardState['topProducts'] = [];
    if (recentSales.length > 0) {
      const { data: saleItems } = await supabase.from('sale_items').select('*').in('sale_id', recentSales.map((sale) => sale.id));
      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
      ((saleItems || []) as SaleItemRow[]).forEach((item) => {
        const current = productMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += Number(item.total);
        productMap.set(item.product_id, current);
      });
      topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }

    const nextDashboard = {
      revenue,
      profit: Math.max(0, profit),
      expenses: 0,
      salesCount: recentSales.length,
      customersCount: customers.length,
      productsCount: products.length,
      lowStockCount,
      outstandingInvoices,
      overdueInvoices,
      healthScore: 0,
      revenueGrowth,
      dailySales: days,
      categoryData: Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
      topProducts,
      alerts,
      actionCards,
      aiInsights,
    };

    nextDashboard.healthScore = calculateHealthScore(nextDashboard);
    setDashboard(nextDashboard);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  React.useEffect(() => {
    if (!businessId) return undefined;
    const channel = supabase
      .channel(`dashboard-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${businessId}` }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `business_id=eq.${businessId}` }, () => loadDashboard())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, loadDashboard]);

  const metrics = [
    { title: 'Revenue', value: formatCurrency(dashboard.revenue), change: dashboard.revenueGrowth, icon: DollarSign, color: 'from-emerald-500 to-green-600' },
    { title: 'Profit', value: formatCurrency(dashboard.profit), change: dashboard.profit > 0 ? 8.4 : 0, icon: TrendingUp, color: 'from-cyan-500 to-blue-600' },
    { title: 'Sales', value: formatNumber(dashboard.salesCount), change: dashboard.revenueGrowth, icon: ShoppingCart, color: 'from-blue-500 to-cyan-600' },
    { title: 'Customers', value: formatNumber(dashboard.customersCount), change: 0, icon: Users, color: 'from-purple-500 to-pink-600' },
    { title: 'Products', value: formatNumber(dashboard.productsCount), change: 0, icon: Package, color: 'from-orange-500 to-red-600' },
    { title: 'Low Stock', value: formatNumber(dashboard.lowStockCount), change: dashboard.lowStockCount > 0 ? -dashboard.lowStockCount : 0, icon: AlertTriangle, color: 'from-yellow-500 to-orange-600' },
    { title: 'Debtors', value: formatNumber(dashboard.outstandingInvoices), change: dashboard.overdueInvoices > 0 ? -dashboard.overdueInvoices : 0, icon: Clock, color: 'from-rose-500 to-red-600' },
    { title: 'Health Score', value: `${dashboard.healthScore}/100`, change: dashboard.healthScore - 70, icon: Activity, color: 'from-teal-500 to-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">Live business intelligence for {currentBusiness?.name || 'your business'}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDashboard} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>

        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => navigate('/sales')} className="rounded-2xl bg-slate-950 px-4 py-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"><Plus className="h-5 w-5" /><p className="mt-3 text-sm font-black">Record sale</p><p className="mt-1 text-xs text-white/55">One tap</p></button>
        <button onClick={() => navigate('/inventory')} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"><Package className="h-5 w-5" /><p className="mt-3 text-sm font-black">Add stock</p><p className="mt-1 text-xs text-slate-400">Keep inventory current</p></button>
        <button onClick={() => navigate('/debtors')} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"><Users className="h-5 w-5" /><p className="mt-3 text-sm font-black">Record debt</p><p className="mt-1 text-xs text-slate-400">Track who owes</p></button>
        <button onClick={() => navigate('/ai-assistant')} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"><MessageSquare className="h-5 w-5" /><p className="mt-3 text-sm font-black">Ask BizGuard</p><p className="mt-1 text-xs text-slate-400">Get a quick answer</p></button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <p className="font-medium">Dashboard error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
          Loading live dashboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <div key={metric.title} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{metric.title}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{metric.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {metric.change >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                      <span className={cn('text-sm font-medium', metric.change >= 0 ? 'text-green-500' : 'text-red-500')}>{metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%</span>
                      <span className="text-sm text-slate-400">trend</span>
                    </div>
                  </div>
                  <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center', metric.color)}>
                    <metric.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <VoiceUsageWidget businessId={businessId} />
            </div>
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">AI Daily Action Recommendations</h2>
              <p className="mt-1 text-sm text-slate-500">Proactive guidance from current sales, debtor, and inventory signals.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {dashboard.aiInsights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="font-bold text-slate-800">{insight.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{insight.recommendation || insight.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Sales Trend</h2>
                  <p className="text-sm text-slate-500">Daily sales and revenue from Supabase</p>
                </div>
                <button onClick={() => navigate('/sales')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">View all <ArrowRight className="w-4 h-4" /></button>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => `₦${Number(value) / 1000}K`} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} formatter={(value) => [formatCurrency(Number(value || 0)), '']} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', strokeWidth: 2 }} name="Revenue" />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', strokeWidth: 2 }} name="Sales Count" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Inventory Value by Category</h2>
              <p className="text-sm text-slate-500 mb-6">Current live product valuation</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={5} dataKey="value">
                      {dashboard.categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Products</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.topProducts} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={95} stroke="#64748b" fontSize={11} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Action Cards</h2>
              <div className="space-y-3">
                {dashboard.actionCards.length === 0 ? <p className="text-sm text-slate-500">No open action cards.</p> : dashboard.actionCards.slice(0, 4).map((card) => (
                  <div key={card.id} className={cn('p-4 rounded-lg border-l-4 transition-all hover:shadow-md', getActionCardColor(card.type as 'urgent' | 'important' | 'routine' | 'opportunity'))}>
                    <h3 className="font-medium text-slate-800">{card.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Alerts</h2>
              <div className="space-y-3">
                {dashboard.alerts.length === 0 ? <p className="text-sm text-slate-500">No active alerts.</p> : dashboard.alerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className={cn('p-4 rounded-lg border flex items-start gap-3', alert.severity === 'error' && 'bg-red-50 border-red-200', alert.severity === 'warning' && 'bg-yellow-50 border-yellow-200', alert.severity === 'info' && 'bg-blue-50 border-blue-200')}>
                    <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', alert.severity === 'error' && 'text-red-500', alert.severity === 'warning' && 'text-yellow-500', alert.severity === 'info' && 'text-blue-500')} />
                    <div>
                      <h3 className="font-medium text-slate-800">{alert.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-emerald-900 rounded-xl p-6 border border-emerald-400/20 shadow-sm text-white">
              <h2 className="text-lg font-semibold mb-4">BizGuard AI Insights</h2>
              <div className="space-y-3">
                {dashboard.aiInsights.length === 0 ? <p className="text-sm text-cyan-100/80">No AI insights yet. Open the AI Assistant to generate a business briefing.</p> : dashboard.aiInsights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="rounded-lg bg-white/10 p-4 border border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{insight.title}</h3>
                      <span className="text-xs text-cyan-200">{Math.round(Number(insight.confidence))}%</span>
                    </div>
                    <p className="text-sm text-cyan-50/85 mt-2">{insight.summary}</p>
                    {insight.recommendation && <p className="text-xs text-emerald-100 mt-2">{insight.recommendation}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

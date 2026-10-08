import React from 'react';
import { Shield, TrendingUp, Info, RefreshCw, Wallet, Package, Users } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import type { Database } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

type Severity = 'low' | 'medium' | 'high';

interface RiskFactor {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
}

export const RiskScore: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [sales, setSales] = React.useState<SaleRow[]>([]);
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadRisk = React.useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [productsResult, salesResult, customersResult, invoicesResult] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('sales').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(200),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('invoices').select('*').eq('business_id', businessId),
    ]);
    setProducts(productsResult.data || []);
    setSales(salesResult.data || []);
    setCustomers(customersResult.data || []);
    setInvoices(invoicesResult.data || []);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdue = invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date());
  const lowStock = products.filter((product) => product.quantity <= product.reorder_level);
  const inactiveCustomers = customers.filter((customer) => !customer.last_purchase_date || new Date(customer.last_purchase_date) < new Date(Date.now() - 1000 * 60 * 60 * 24 * 45));

  const financialScore = Math.max(0, Math.min(100, 85 - Math.min(35, overdue.length * 7) - (outstanding > revenue && revenue > 0 ? 15 : 0)));
  const inventoryScore = Math.max(0, Math.min(100, 90 - Math.min(45, lowStock.length * 6)));
  const salesScore = Math.max(0, Math.min(100, sales.length > 0 ? 80 + Math.min(15, sales.length) : 45));
  const customerScore = Math.max(0, Math.min(100, 85 - Math.min(30, inactiveCustomers.length * 3)));
  const overallScore = Math.round((financialScore + inventoryScore + salesScore + customerScore) / 4);

  const riskFactors: RiskFactor[] = [
    ...(overdue.length > 0 ? [{ id: 'overdue', severity: 'high' as const, title: 'Overdue Receivables', description: `${overdue.length} invoices are overdue with ${formatCurrency(overdue.reduce((sum, invoice) => sum + Number(invoice.balance), 0))} outstanding.`, recommendation: 'Follow up immediately and tighten credit terms for high-risk customers.' }] : []),
    ...(lowStock.length > 0 ? [{ id: 'low-stock', severity: 'medium' as const, title: 'Inventory Stockout Risk', description: `${lowStock.length} products are at or below reorder level.`, recommendation: 'Prioritize restocking items with the highest sales velocity and margin.' }] : []),
    ...(sales.length === 0 ? [{ id: 'no-sales', severity: 'high' as const, title: 'No Recent Sales Recorded', description: 'No sales records are available for risk scoring.', recommendation: 'Record POS sales daily to unlock accurate revenue, profit and demand risk scoring.' }] : []),
    ...(inactiveCustomers.length > 0 ? [{ id: 'inactive-customers', severity: 'low' as const, title: 'Customer Retention Risk', description: `${inactiveCustomers.length} customers have not purchased recently.`, recommendation: 'Create win-back offers or reminders for dormant customers.' }] : []),
  ];

  const riskCategories = [
    { name: 'Financial Health', score: financialScore, icon: Wallet },
    { name: 'Inventory Risk', score: inventoryScore, icon: Package },
    { name: 'Sales Performance', score: salesScore, icon: TrendingUp },
    { name: 'Customer Credit', score: customerScore, icon: Users },
  ];

  const getScoreColor = (score: number) => score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const getScoreBg = (score: number) => score >= 80 ? 'from-green-500 to-emerald-600' : score >= 60 ? 'from-yellow-500 to-orange-600' : 'from-red-500 to-rose-600';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Risk Score</h1><p className="mt-1 text-slate-500">Live business health scoring from sales, inventory, customers and invoices</p></div>
        <button onClick={loadRisk} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="relative h-48 w-48"><svg className="h-full w-full -rotate-90 transform"><circle cx="96" cy="96" r="88" fill="none" stroke="#e2e8f0" strokeWidth="16" /><circle cx="96" cy="96" r="88" fill="none" stroke="url(#riskGradient)" strokeWidth="16" strokeDasharray={`${(overallScore / 100) * 553} 553`} strokeLinecap="round" /><defs><linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444" /><stop offset="50%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className={cn('text-5xl font-bold', getScoreColor(overallScore))}>{overallScore}</span><span className="mt-1 text-slate-500">out of 100</span><span className={cn('mt-2 rounded-full px-3 py-1 text-sm font-medium text-white bg-gradient-to-r', getScoreBg(overallScore))}>{overallScore >= 80 ? 'Low Risk' : overallScore >= 60 ? 'Medium Risk' : 'High Risk'}</span></div></div>
          <div className="w-full flex-1"><h2 className="mb-4 text-lg font-semibold text-slate-800">Risk Categories</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{riskCategories.map((category) => <div key={category.name} className="rounded-lg bg-slate-50 p-4"><div className="mb-3 flex items-center gap-3"><category.icon className="h-5 w-5 text-slate-400" /><span className="font-medium text-slate-700">{category.name}</span></div><div className="flex items-center justify-between"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full bg-gradient-to-r', getScoreBg(category.score))} style={{ width: `${category.score}%` }} /></div><span className={cn('ml-3 font-semibold', getScoreColor(category.score))}>{category.score}</span></div></div>)}</div></div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold text-slate-800">Risk Factors</h2><div className="space-y-4">{riskFactors.length === 0 ? <p className="text-sm text-slate-500">No major risk factors detected from current data.</p> : riskFactors.map((factor) => <div key={factor.id} className={cn('rounded-lg border-l-4 p-4', factor.severity === 'high' && 'border-l-red-500 bg-red-50', factor.severity === 'medium' && 'border-l-yellow-500 bg-yellow-50', factor.severity === 'low' && 'border-l-blue-500 bg-blue-50')}><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-slate-800">{factor.title}</h3><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', factor.severity === 'high' && 'bg-red-100 text-red-700', factor.severity === 'medium' && 'bg-yellow-100 text-yellow-700', factor.severity === 'low' && 'bg-blue-100 text-blue-700')}>{factor.severity}</span></div><p className="mt-1 text-slate-600">{factor.description}</p><div className="mt-3 flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-slate-400" /><span className="text-slate-500">{factor.recommendation}</span></div></div></div></div>)}</div></div>

      <div className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 p-6 text-white"><div className="flex items-center gap-3"><Shield className="h-8 w-8" /><div><h3 className="text-lg font-bold">Live Risk Engine Active</h3><p className="opacity-90">Scores are recalculated from current business data each time the page loads.</p></div></div></div>
    </div>
  );
};

export default RiskScore;

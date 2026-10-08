import React from 'react';
import { Brain, CalendarDays, DollarSign, Package, PhoneCall, RefreshCw, ShieldAlert, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { buildCustomerIntelligence } from '../lib/customerIntelligence';
import { buildExecutiveBriefing, buildGuardianActions, buildHealthRadar, type GuardianAction } from '../lib/executiveGuardian';
import { formatCurrency } from '../utils/helpers';
import { cn } from '../utils/cn';
import type { Database } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

const actionStyles: Record<GuardianAction['priority'], string> = {
  urgent: 'border-red-200 bg-red-50 text-red-800',
  high: 'border-orange-200 bg-orange-50 text-orange-800',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800',
};

const radarLabels = [
  ['revenue', 'Revenue', DollarSign],
  ['profit', 'Profit', TrendingUp],
  ['inventory', 'Inventory', Package],
  ['customer', 'Customer', Users],
  ['debtor', 'Debtor', ShieldAlert],
  ['cashflow', 'Cashflow', Zap],
  ['growth', 'Growth', Sparkles],
] as const;

export const BusinessGuardian: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const navigate = useNavigate();
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [sales, setSales] = React.useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = React.useState<SaleItemRow[]>([]);
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadGuardian = React.useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [productsResult, salesResult, customersResult, invoicesResult, paymentsResult] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('sales').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(500),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase.from('payments').select('*').eq('business_id', businessId),
    ]);
    const firstError = productsResult.error || salesResult.error || customersResult.error || invoicesResult.error || paymentsResult.error;
    if (firstError) {
      toast.error(`Could not load Business Guardian: ${firstError.message}`);
      setIsLoading(false);
      return;
    }
    const saleIds = (salesResult.data || []).map((sale) => sale.id);
    const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
    if (saleItemsResult.error) toast.error(`Could not load sale item data: ${saleItemsResult.error.message}`);
    setProducts(productsResult.data || []);
    setSales(salesResult.data || []);
    setCustomers(customersResult.data || []);
    setInvoices(invoicesResult.data || []);
    setPayments(paymentsResult.data || []);
    setSaleItems((saleItemsResult.data || []) as SaleItemRow[]);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadGuardian();
  }, [loadGuardian]);

  const customerIntelligence = React.useMemo(() => buildCustomerIntelligence({ customers, sales, saleItems, invoices, payments, products }), [customers, sales, saleItems, invoices, payments, products]);
  const radar = React.useMemo(() => buildHealthRadar({ sales, products, invoices, customers: customerIntelligence }), [sales, products, invoices, customerIntelligence]);
  const actions = React.useMemo(() => buildGuardianActions({ products, invoices, customers: customerIntelligence, sales }), [products, invoices, customerIntelligence, sales]);
  const briefing = React.useMemo(() => buildExecutiveBriefing({ radar, actions }), [radar, actions]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const receivables = invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const lowStock = products.filter((product) => product.quantity <= product.reorder_level);
  const topCustomer = customerIntelligence[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-700 text-white"><Brain className="h-6 w-6" /></div><div><h1 className="text-2xl font-black text-slate-800">Business Guardian Command Center</h1><p className="text-slate-500">Executive AI operating layer for customers, inventory, cashflow, growth and risk</p></div></div>
        </div>
        <button onClick={loadGuardian} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Refresh</button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-cyan-950 p-6 text-white shadow-2xl">
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-2"><p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Morning Briefing</p><h2 className="mt-3 text-3xl font-black">{briefing.morning}</h2><p className="mt-4 text-cyan-50/80">{briefing.weekly}</p></div>
          <div className="rounded-2xl bg-white/10 p-5"><p className="text-cyan-100/80">Revenue</p><p className="mt-2 text-2xl font-black">{formatCurrency(revenue)}</p></div>
          <div className="rounded-2xl bg-white/10 p-5"><p className="text-cyan-100/80">Receivables</p><p className="mt-2 text-2xl font-black">{formatCurrency(receivables)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5"><Package className="h-6 w-6 text-orange-600" /><p className="mt-3 text-sm text-slate-500">Products To Restock</p><p className="text-2xl font-black text-slate-800">{lowStock.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><PhoneCall className="h-6 w-6 text-blue-600" /><p className="mt-3 text-sm text-slate-500">Customers To Call</p><p className="text-2xl font-black text-slate-800">{actions.filter((action) => action.category === 'customer' || action.category === 'debt').length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><ShieldAlert className="h-6 w-6 text-red-600" /><p className="mt-3 text-sm text-slate-500">Invoices To Collect</p><p className="text-2xl font-black text-slate-800">{invoices.filter((invoice) => Number(invoice.balance) > 0).length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><CrownLike /><p className="mt-3 text-sm text-slate-500">Best Customer</p><p className="truncate text-2xl font-black text-slate-800">{topCustomer?.customer.name || 'Not enough data'}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2"><h2 className="mb-4 text-lg font-bold text-slate-800">Today's Priorities</h2><div className="space-y-3">{actions.map((action) => <button key={action.id} onClick={() => navigate(action.actionUrl)} className={cn('block w-full rounded-xl border p-4 text-left transition hover:shadow-md', actionStyles[action.priority])}><div className="flex items-center justify-between gap-3"><p className="font-bold">{action.title}</p><span className="rounded-full bg-white/70 px-2 py-1 text-xs font-black uppercase">{action.priority}</span></div><p className="mt-1 text-sm opacity-80">{action.description}</p></button>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-bold text-slate-800">Business Health Radar</h2><div className="space-y-4">{radarLabels.map(([key, label, Icon]) => <div key={key}><div className="mb-1 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium text-slate-700"><Icon className="h-4 w-4 text-emerald-600" />{label}</span><span className="font-black text-slate-800">{radar[key]}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${radar[key]}%` }} /></div></div>)}</div><div className="mt-6 rounded-2xl bg-slate-900 p-5 text-white"><p className="text-sm text-cyan-100">Overall Health</p><p className="text-4xl font-black">{radar.overall}/100</p></div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Insight title="Customer Opportunities" text={topCustomer ? `Reward ${topCustomer.customer.name}; loyalty level is ${topCustomer.loyaltyLevel}.` : 'Add customers and record sales to unlock customer opportunities.'} />
        <Insight title="Inventory Risks" text={lowStock.length ? `${lowStock.length} products need attention before stockouts occur.` : 'Inventory risk is currently controlled.'} />
        <Insight title="Profit Opportunities" text="Review bundles, high-value customers, and slow stock to improve margin this week." />
      </div>
    </div>
  );
};

const CrownLike = () => <Sparkles className="h-6 w-6 text-purple-600" />;
const Insight: React.FC<{ title: string; text: string }> = ({ title, text }) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><CalendarDays className="h-6 w-6 text-emerald-600" /><h3 className="mt-3 font-bold text-slate-800">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></div>;

export default BusinessGuardian;

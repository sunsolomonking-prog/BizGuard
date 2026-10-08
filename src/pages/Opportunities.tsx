import React from 'react';
import { Building2, Lightbulb, Globe, RefreshCw, TrendingUp, Users, Package, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import type { Database } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

type OpportunityPriority = 'high' | 'medium' | 'low';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: OpportunityPriority;
  category: 'growth' | 'cashflow' | 'inventory' | 'customer' | 'operations';
  icon: typeof Lightbulb;
}

const priorityStyles: Record<OpportunityPriority, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const Opportunities: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [sales, setSales] = React.useState<SaleRow[]>([]);
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadOpportunities = React.useCallback(async () => {
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
    const firstError = productsResult.error || salesResult.error || customersResult.error || invoicesResult.error;
    if (firstError) toast.error(`Could not load opportunities: ${firstError.message}`);
    setProducts(productsResult.data || []);
    setSales(salesResult.data || []);
    setCustomers(customersResult.data || []);
    setInvoices(invoicesResult.data || []);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const receivables = invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const lowStock = products.filter((product) => product.quantity <= product.reorder_level);
  const overstock = products.filter((product) => product.quantity > product.reorder_level * 4);
  const inactiveCustomers = customers.filter((customer) => !customer.last_purchase_date || new Date(customer.last_purchase_date) < new Date(Date.now() - 1000 * 60 * 60 * 24 * 45));
  const averageSale = sales.length ? revenue / sales.length : 0;

  const opportunities: Opportunity[] = [
    ...(lowStock.length > 0 ? [{ id: 'restock', title: 'Capture missed sales by restocking fast', description: `${lowStock.length} products are below reorder level. Prioritize high-margin items first.`, impact: `Potential stockout prevention across ${lowStock.length} SKUs`, priority: 'high' as const, category: 'inventory' as const, icon: Package }] : []),
    ...(receivables > 0 ? [{ id: 'cashflow', title: 'Unlock cash from outstanding invoices', description: `You have ${formatCurrency(receivables)} in outstanding invoice balances.`, impact: 'Improves cash flow without increasing sales volume', priority: 'high' as const, category: 'cashflow' as const, icon: AlertTriangle }] : []),
    ...(inactiveCustomers.length > 0 ? [{ id: 'winback', title: 'Win back dormant customers', description: `${inactiveCustomers.length} customers have not purchased recently. Send targeted offers or reminders.`, impact: 'Improves repeat sales and customer lifetime value', priority: 'medium' as const, category: 'customer' as const, icon: Users }] : []),
    ...(overstock.length > 0 ? [{ id: 'overstock', title: 'Turn excess stock into cash', description: `${overstock.length} products may be overstocked. Consider bundles, promos, or supplier returns.`, impact: 'Reduces working capital tied in slow inventory', priority: 'medium' as const, category: 'inventory' as const, icon: Package }] : []),
    { id: 'average-sale', title: 'Increase average transaction value', description: `Current average sale is ${formatCurrency(averageSale)}. Bundle related products and upsell at checkout.`, impact: 'Boosts revenue without adding new customers', priority: averageSale > 0 ? 'low' : 'medium', category: 'growth', icon: TrendingUp },
    { id: 'digital', title: 'Digitize customer engagement', description: 'Prepare WhatsApp reminders and digital receipt workflows for customers with balances or repeat purchases.', impact: 'Increases retention and trust', priority: 'low', category: 'operations', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Opportunities</h1>
          <p className="text-slate-500 mt-1">Growth recommendations generated from live sales, customers, invoices and inventory</p>
        </div>
        <button onClick={loadOpportunities} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5"><TrendingUp className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">Revenue Signal</p><p className="text-2xl font-black text-slate-800">{formatCurrency(revenue)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><Users className="h-6 w-6 text-blue-600" /><p className="mt-3 text-sm text-slate-500">Customers</p><p className="text-2xl font-black text-slate-800">{customers.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><Package className="h-6 w-6 text-orange-600" /><p className="mt-3 text-sm text-slate-500">Low Stock</p><p className="text-2xl font-black text-slate-800">{lowStock.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><AlertTriangle className="h-6 w-6 text-red-600" /><p className="mt-3 text-sm text-slate-500">Receivables</p><p className="text-2xl font-black text-slate-800">{formatCurrency(receivables)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {opportunities.map((opportunity) => (
          <div key={opportunity.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600"><opportunity.icon className="h-6 w-6 text-white" /></div>
            <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-800">{opportunity.title}</h3><span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${priorityStyles[opportunity.priority]}`}>{opportunity.priority}</span></div>
            <p className="mt-2 text-sm text-slate-500">{opportunity.description}</p>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">{opportunity.impact}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
        <div className="flex items-center gap-3"><Building2 className="h-8 w-8" /><div><h3 className="text-lg font-bold">BizGuard powers every hustle</h3><p className="opacity-90">Opportunities are generated from live business activity and update as you record sales, products, customers and payments.</p></div></div>
      </div>
    </div>
  );
};

export default Opportunities;

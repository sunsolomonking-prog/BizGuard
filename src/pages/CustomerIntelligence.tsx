import React from 'react';
import { Brain, Crown, Download, HeartPulse, PhoneCall, RefreshCw, Search, ShieldAlert, ShoppingBag, Star, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { buildCustomerIntelligence, buildGuardianAnswers, exportCustomerLedgerCsv, type CustomerIntelligence as CustomerInsight } from '../lib/customerIntelligence';
import { cn } from '../utils/cn';
import { formatCurrency, formatDate } from '../utils/helpers';
import type { Database } from '../lib/database.types';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

const loyaltyStyles: Record<string, string> = {
  Bronze: 'bg-amber-50 text-amber-700 border-amber-200',
  Silver: 'bg-slate-50 text-slate-700 border-slate-200',
  Gold: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Platinum: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Diamond: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const CustomerIntelligence: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [sales, setSales] = React.useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = React.useState<SaleItemRow[]>([]);
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [query, setQuery] = React.useState('');
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadIntelligence = React.useCallback(async () => {
    if (!businessId) {
      setCustomers([]);
      setSales([]);
      setSaleItems([]);
      setInvoices([]);
      setPayments([]);
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [customersResult, salesResult, invoicesResult, paymentsResult, productsResult] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('sales').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(500),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase.from('payments').select('*').eq('business_id', businessId),
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
    ]);

    const firstError = customersResult.error || salesResult.error || invoicesResult.error || paymentsResult.error || productsResult.error;
    if (firstError) {
      toast.error(`Could not load customer intelligence: ${firstError.message}`);
      setIsLoading(false);
      return;
    }

    const saleIds = (salesResult.data || []).map((sale) => sale.id);
    const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
    if (saleItemsResult.error) toast.error(`Could not load customer purchase items: ${saleItemsResult.error.message}`);

    setCustomers(customersResult.data || []);
    setSales(salesResult.data || []);
    setInvoices(invoicesResult.data || []);
    setPayments(paymentsResult.data || []);
    setProducts(productsResult.data || []);
    setSaleItems((saleItemsResult.data || []) as SaleItemRow[]);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const intelligence = React.useMemo(() => buildCustomerIntelligence({ customers, sales, saleItems, invoices, payments, products }), [customers, sales, saleItems, invoices, payments, products]);
  const guardian = React.useMemo(() => buildGuardianAnswers(intelligence), [intelligence]);
  const filtered = intelligence.filter((item) => {
    const text = `${item.customer.name} ${item.customer.email || ''} ${item.customer.phone || ''} ${item.tags.join(' ')}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const selected = intelligence.find((item) => item.customer.id === selectedCustomerId) || filtered[0] || null;

  React.useEffect(() => {
    if (!selectedCustomerId && filtered[0]) setSelectedCustomerId(filtered[0].customer.id);
  }, [filtered, selectedCustomerId]);

  const totalCLV = intelligence.reduce((sum, item) => sum + item.lifetimeValue, 0);
  const projectedValue = intelligence.reduce((sum, item) => sum + item.projectedValue, 0);
  const atRiskCount = intelligence.filter((item) => item.riskScore >= 55).length;
  const winBackCount = intelligence.filter((item) => (item.daysSinceLastPurchase || 0) >= 30).length;

  const exportLedger = (item: CustomerInsight) => {
    const csv = exportCustomerLedgerCsv(item);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizguard-customer-ledger-${item.customer.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Intelligence</h1>
          <p className="text-slate-500 mt-1">Patronage, loyalty, lifetime value, debtor behaviour, and AI recovery actions from live data</p>
        </div>
        <button onClick={loadIntelligence} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Refresh</button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Crown className="h-6 w-6 text-purple-600" /><p className="mt-3 text-sm text-slate-500">Total Lifetime Value</p><p className="text-2xl font-black text-slate-800">{formatCurrency(totalCLV)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><TrendingUp className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">Projected Value</p><p className="text-2xl font-black text-slate-800">{formatCurrency(projectedValue)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><ShieldAlert className="h-6 w-6 text-red-600" /><p className="mt-3 text-sm text-slate-500">At Risk</p><p className="text-2xl font-black text-slate-800">{atRiskCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><PhoneCall className="h-6 w-6 text-blue-600" /><p className="mt-3 text-sm text-slate-500">Win-Back List</p><p className="text-2xl font-black text-slate-800">{winBackCount}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold text-slate-800">Top Customer Leaderboard</h2><p className="text-sm text-slate-500">Ranked by patronage score, revenue, frequency and loyalty</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers..." className="rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600"><tr><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Revenue</th><th className="px-5 py-3">Purchases</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Loyalty</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">Loading intelligence...</td></tr> : filtered.slice(0, 10).map((item, index) => (
                  <tr key={item.customer.id} onClick={() => setSelectedCustomerId(item.customer.id)} className={cn('cursor-pointer hover:bg-slate-50', selected?.customer.id === item.customer.id && 'bg-emerald-50/60')}><td className="px-5 py-4 font-black text-slate-700">#{index + 1}</td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.customer.name}</p><p className="text-xs text-slate-500">{item.customer.phone || item.customer.email || 'No contact'}</p></td><td className="px-5 py-4">{formatCurrency(item.lifetimeValue)}</td><td className="px-5 py-4">{item.transactionCount}</td><td className="px-5 py-4"><span className="font-black text-emerald-700">{item.patronageScore}</span>/100</td><td className="px-5 py-4"><span className={cn('rounded-full border px-2 py-1 text-xs font-bold', loyaltyStyles[item.loyaltyLevel])}>{item.loyaltyLevel}</span></td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.patronageClass}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Brain className="h-5 w-5 text-purple-600" /><h2 className="font-bold text-slate-800">Business Guardian Answers</h2></div><div className="mt-4 space-y-3 text-sm text-slate-600"><p><strong>Best customer:</strong> {guardian.bestCustomer?.customer.name || 'Not enough data'}</p><p><strong>Owes most:</strong> {guardian.topDebtor?.customer.name || 'None'} ({formatCurrency(Number(guardian.topDebtor?.customer.current_balance || 0))})</p><p><strong>Likely to leave:</strong> {guardian.likelyToLeave?.customer.name || 'Not enough data'}</p><p><strong>Reward this month:</strong> {guardian.reward?.customer.name || 'Not enough data'}</p></div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><PhoneCall className="h-5 w-5 text-emerald-600" /><h2 className="font-bold text-slate-800">Call Today</h2></div><div className="mt-4 space-y-2">{guardian.callToday.slice(0, 6).map((item) => <div key={item.customer.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-800">{item.customer.name}</p><p className="text-slate-500">Risk {item.riskScore}/100 · Balance {formatCurrency(Number(item.customer.current_balance))}</p></div>)}</div></div>
        </div>
      </div>

      {selected && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-800">{selected.customer.name}</h2><p className="text-slate-500">{selected.customer.email || selected.customer.phone || 'No contact information'}</p></div><button onClick={() => exportLedger(selected)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" /> Ledger CSV</button></div><div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4"><Metric label="Lifetime Value" value={formatCurrency(selected.lifetimeValue)} icon={Wallet} /><Metric label="Projected Value" value={formatCurrency(selected.projectedValue)} icon={TrendingUp} /><Metric label="Avg Order" value={formatCurrency(selected.averageOrderValue)} icon={ShoppingBag} /><Metric label="Health" value={selected.health} icon={HeartPulse} /></div><div className="mt-6 flex flex-wrap gap-2">{selected.tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{tag}</span>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><Insight title="Purchase Pattern" lines={[`Preferred product: ${selected.mostPurchasedProducts[0]?.productName || 'Not enough data'}`, `Preferred day: ${selected.preferredPurchaseDay}`, `Preferred time: ${selected.preferredPurchaseTime}`, `Payment method: ${selected.preferredPaymentMethod}`, `Average basket: ${selected.averageBasketSize.toFixed(1)} items`]} /><Insight title="AI Recommendations" lines={selected.recommendations.length ? selected.recommendations : ['No urgent action required. Keep nurturing this customer.']} /></div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 font-bold text-slate-800">Relationship Timeline</h2><div className="max-h-[520px] space-y-3 overflow-y-auto">{selected.timeline.slice(0, 15).map((entry, index) => <div key={`${entry.date}-${entry.type}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-xs text-slate-400">{formatDate(entry.date)}</p><p className="font-semibold text-slate-800">{entry.title}</p><p className="text-sm text-slate-600">{entry.description}</p>{entry.amount !== undefined && <p className="mt-1 text-sm font-bold text-emerald-700">{formatCurrency(entry.amount)}</p>}</div>)}</div></div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; icon: typeof Star }> = ({ label, value, icon: Icon }) => <div className="rounded-xl bg-slate-50 p-4"><Icon className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="font-black text-slate-800">{value}</p></div>;
const Insight: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => <div className="rounded-xl border border-slate-100 bg-white p-4"><h3 className="font-bold text-slate-800">{title}</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{lines.map((line) => <li key={line}>• {line}</li>)}</ul></div>;

export default CustomerIntelligence;

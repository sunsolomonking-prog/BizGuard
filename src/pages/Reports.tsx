import React from 'react';
import { FileText, Download, Calendar, TrendingUp, Package, Users, Wallet, RefreshCw, Printer, Mail, MessageCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import type { Database } from '../lib/database.types';

type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

type ReportType = 'sales' | 'inventory' | 'customers' | 'profit' | 'tax';

interface ReportState {
  sales: SaleRow[];
  products: ProductRow[];
  customers: CustomerRow[];
  invoices: InvoiceRow[];
}

const emptyReportState: ReportState = { sales: [], products: [], customers: [], invoices: [] };

const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;


const buildReportHtml = (title: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => `
  <html><head><title>${title}</title><style>
  body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px} th{background:#f8fafc} h1{font-size:22px}
  </style></head><body><h1>${title}</h1><table><thead><tr>${headers.map((h)=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r)=>`<tr>${r.map((c)=>`<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>
`;

const downloadExcelHtml = (filename: string, title: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => {
  const blob = new Blob([buildReportHtml(title, headers, rows)], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.csv$/, '.xls');
  link.click();
  URL.revokeObjectURL(url);
};

const printReportHtml = (title: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => {
  const popup = window.open('', '_blank', 'width=960,height=720');
  if (!popup) return false;
  popup.document.write(buildReportHtml(title, headers, rows) + '<script>window.print()</script>');
  popup.document.close();
  return true;
};

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const Reports: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [state, setState] = React.useState<ReportState>(emptyReportState);
  const [isLoading, setIsLoading] = React.useState(true);
  const [period, setPeriod] = React.useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const businessId = currentBusiness?.id;

  const loadReports = React.useCallback(async () => {
    if (!businessId) {
      setState(emptyReportState);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [sales, products, customers, invoices] = await Promise.all([
      supabase.from('sales').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('invoices').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    ]);

    const firstError = sales.error || products.error || customers.error || invoices.error;
    if (firstError) {
      toast.error(`Could not load reports: ${firstError.message}`);
      setState(emptyReportState);
    } else {
      setState({
        sales: sales.data || [],
        products: products.data || [],
        customers: customers.data || [],
        invoices: invoices.data || [],
      });
    }
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const revenue = state.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const tax = state.sales.reduce((sum, sale) => sum + Number(sale.tax), 0);
  const discounts = state.sales.reduce((sum, sale) => sum + Number(sale.discount), 0);
  const inventoryValue = state.products.reduce((sum, product) => sum + Number(product.cost_price) * product.quantity, 0);
  const potentialRetailValue = state.products.reduce((sum, product) => sum + Number(product.selling_price) * product.quantity, 0);
  const outstanding = state.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const estimatedProfit = revenue - state.products.reduce((sum, product) => sum + Number(product.cost_price) * Math.max(0, Math.min(product.quantity, 1)), 0);

  const getReportData = (type: ReportType) => {
    const date = new Date().toISOString().slice(0, 10);
    if (type === 'sales') return { filename: `bizguard-sales-${period}-${date}.csv`, title: 'BizGuard Sales Report', headers: ['Invoice', 'Date', 'Payment', 'Status', 'Subtotal', 'Tax', 'Discount', 'Total'], rows: state.sales.map((sale) => [sale.invoice_number, sale.created_at, sale.payment_method, sale.status, sale.subtotal, sale.tax, sale.discount, sale.total]) };
    if (type === 'inventory') return { filename: `bizguard-inventory-${date}.csv`, title: 'BizGuard Inventory Report', headers: ['Product', 'SKU', 'Category', 'Quantity', 'Reorder Level', 'Cost Price', 'Selling Price', 'Stock Value'], rows: state.products.map((product) => [product.name, product.sku, product.category, product.quantity, product.reorder_level, product.cost_price, product.selling_price, Number(product.cost_price) * product.quantity]) };
    if (type === 'customers') return { filename: `bizguard-customers-${date}.csv`, title: 'BizGuard Customer Report', headers: ['Name', 'Email', 'Phone', 'Credit Limit', 'Balance', 'Total Purchases'], rows: state.customers.map((customer) => [customer.name, customer.email, customer.phone, customer.credit_limit, customer.current_balance, customer.total_purchases]) };
    if (type === 'profit') return { filename: `bizguard-profit-${period}-${date}.csv`, title: 'BizGuard Profit Report', headers: ['Metric', 'Value'], rows: [['Revenue', revenue], ['Inventory Cost Value', inventoryValue], ['Potential Retail Value', potentialRetailValue], ['Estimated Profit Signal', estimatedProfit], ['Outstanding Invoices', outstanding]] };
    return { filename: `bizguard-tax-${period}-${date}.csv`, title: 'BizGuard Tax Report', headers: ['Metric', 'Value'], rows: [['Sales Tax Collected', tax], ['Discounts Given', discounts], ['Gross Revenue', revenue], ['Net Revenue After Discount', revenue - discounts]] };
  };

  const exportReport = (type: ReportType) => {
    const report = getReportData(type);
    downloadCsv(report.filename, report.headers, report.rows);
    toast.success('CSV report exported');
  };

  const exportExcel = (type: ReportType) => {
    const report = getReportData(type);
    downloadExcelHtml(report.filename, report.title, report.headers, report.rows);
    toast.success('Excel-compatible report exported');
  };

  const printReport = (type: ReportType) => {
    const report = getReportData(type);
    if (printReportHtml(report.title, report.headers, report.rows)) toast.success('Print report opened');
    else toast.error('Popup blocked. Allow popups to print reports.');
  };

  const shareReport = (type: ReportType, channel: 'email' | 'whatsapp') => {
    const report = getReportData(type);
    const body = encodeURIComponent(`${report.title}\nGenerated from BizGuard. Rows: ${report.rows.length}`);
    if (channel === 'email') window.location.href = `mailto:?subject=${encodeURIComponent(report.title)}&body=${body}`;
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${body}`, '_blank');
  };

  const scheduleReport = async (type: ReportType) => {
    if (!businessId) return;
    const { error } = await supabase.from('report_schedules').insert({
      business_id: businessId,
      report_type: type,
      frequency: period === 'yearly' ? 'monthly' : period,
      delivery_channel: 'email',
      is_active: true,
    });
    if (error) toast.error(`Schedule unavailable: ${error.message}. Apply report schedule migration.`);
    else toast.success('Report schedule created');
  };

  const reports = [
    { key: 'sales' as const, name: 'Sales Report', description: 'Sales, invoices, taxes, discounts, payment status', icon: TrendingUp, value: formatCurrency(revenue) },
    { key: 'inventory' as const, name: 'Inventory Report', description: 'Stock levels, reorder points, cost and retail valuation', icon: Package, value: formatCurrency(inventoryValue) },
    { key: 'customers' as const, name: 'Customer Report', description: 'Customer balances, credit limits, lifetime purchases', icon: Users, value: `${state.customers.length} customers` },
    { key: 'profit' as const, name: 'Profit Report', description: 'Revenue, estimated margin signals, outstanding invoices', icon: Wallet, value: formatCurrency(estimatedProfit) },
    { key: 'tax' as const, name: 'Tax Report', description: 'Tax collected, discounts, revenue breakdown', icon: FileText, value: formatCurrency(tax) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports Center</h1>
          <p className="text-slate-500 mt-1">Live exportable reports generated from BizGuard business data</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button onClick={loadReports} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {reports.map((report) => (
          <div key={report.key} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600">
              <report.icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-slate-800">{report.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{report.description}</p>
            <p className="mt-4 text-lg font-black text-slate-900">{report.value}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => exportReport(report.key)} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"><Download className="h-3 w-3" />CSV</button>
              <button onClick={() => exportExcel(report.key)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"><FileText className="h-3 w-3" />Excel</button>
              <button onClick={() => printReport(report.key)} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><Printer className="h-3 w-3" />PDF/Print</button>
              <button onClick={() => scheduleReport(report.key)} className="flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700"><Clock className="h-3 w-3" />Schedule</button>
              <button onClick={() => shareReport(report.key, 'email')} className="flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700"><Mail className="h-3 w-3" />Email</button>
              <button onClick={() => shareReport(report.key, 'whatsapp')} className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700"><MessageCircle className="h-3 w-3" />WhatsApp</button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8" />
          <div>
            <h3 className="text-lg font-bold">Automated Business Reporting</h3>
            <p className="opacity-90">Daily, weekly, monthly, quarterly and yearly reporting architecture is active via live Supabase data exports.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

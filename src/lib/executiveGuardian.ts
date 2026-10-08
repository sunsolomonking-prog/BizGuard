import type { CustomerIntelligence } from './customerIntelligence';
import type { Database } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];

type GuardianPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface GuardianAction {
  id: string;
  title: string;
  description: string;
  priority: GuardianPriority;
  category: 'customer' | 'inventory' | 'debt' | 'growth' | 'profit' | 'risk' | 'cashflow';
  actionUrl: string;
}

export interface HealthRadar {
  revenue: number;
  profit: number;
  inventory: number;
  customer: number;
  debtor: number;
  cashflow: number;
  growth: number;
  overall: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const buildHealthRadar = (params: {
  sales: Sale[];
  products: Product[];
  invoices: Invoice[];
  customers: CustomerIntelligence[];
}): HealthRadar => {
  const revenue = params.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const paidInvoices = params.invoices.filter((invoice) => Number(invoice.balance) <= 0).length;
  const invoiceCount = params.invoices.length;
  const lowStock = params.products.filter((product) => product.quantity <= product.reorder_level).length;
  const customerAvg = params.customers.length ? params.customers.reduce((sum, customer) => sum + customer.healthScore, 0) / params.customers.length : 55;
  const debtorRisk = invoiceCount ? (paidInvoices / invoiceCount) * 100 : 80;
  const cashflow = invoiceCount ? 100 - Math.min(70, (params.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0) / Math.max(1, revenue || 1)) * 70) : 75;
  const growth = params.sales.length > 0 ? Math.min(100, 55 + params.sales.length * 2) : 35;
  const profit = revenue > 0 ? 72 : 35;
  const inventory = params.products.length ? 100 - Math.min(70, lowStock * 8) : 40;
  const radar = {
    revenue: clamp(revenue > 0 ? 78 : 35),
    profit: clamp(profit),
    inventory: clamp(inventory),
    customer: clamp(customerAvg),
    debtor: clamp(debtorRisk),
    cashflow: clamp(cashflow),
    growth: clamp(growth),
    overall: 0,
  };
  radar.overall = clamp((radar.revenue + radar.profit + radar.inventory + radar.customer + radar.debtor + radar.cashflow + radar.growth) / 7);
  return radar;
};

export const buildGuardianActions = (params: {
  products: Product[];
  invoices: Invoice[];
  customers: CustomerIntelligence[];
  sales: Sale[];
}): GuardianAction[] => {
  const lowStock = params.products.filter((product) => product.quantity <= product.reorder_level);
  const overdueInvoices = params.invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date());
  const highRiskCustomers = params.customers.filter((customer) => customer.riskScore >= 60);
  const topCustomers = params.customers.slice(0, 5);
  const revenue = params.sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  const actions: GuardianAction[] = [];
  if (overdueInvoices.length > 0) {
    actions.push({ id: 'collect-overdue', title: 'Collect overdue invoices', description: `${overdueInvoices.length} invoices are overdue. Prioritize calls and payment reminders today.`, priority: 'urgent', category: 'debt', actionUrl: '/debtors' });
  }
  if (lowStock.length > 0) {
    actions.push({ id: 'restock-low', title: 'Restock critical products', description: `${lowStock.length} products are at or below reorder level.`, priority: 'high', category: 'inventory', actionUrl: '/inventory' });
  }
  if (highRiskCustomers.length > 0) {
    actions.push({ id: 'call-risk-customers', title: 'Call high-risk customers', description: `${highRiskCustomers.length} customers show churn, inactivity, or debt risk.`, priority: 'high', category: 'customer', actionUrl: '/customer-intelligence' });
  }
  if (topCustomers.length > 0) {
    actions.push({ id: 'reward-top-customers', title: 'Reward best customers', description: `Reward ${topCustomers[0].customer.name} and other top customers to increase loyalty.`, priority: 'medium', category: 'growth', actionUrl: '/customer-intelligence' });
  }
  if (revenue <= 0) {
    actions.push({ id: 'record-sales', title: 'Record today’s sales', description: 'Sales data is required for accurate AI CFO and growth recommendations.', priority: 'medium', category: 'profit', actionUrl: '/sales' });
  }
  actions.push({ id: 'review-reports', title: 'Review executive reports', description: 'Export updated sales, inventory, customer, tax and profit reports.', priority: 'low', category: 'growth', actionUrl: '/reports' });
  return actions;
};

export const buildExecutiveBriefing = (params: { radar: HealthRadar; actions: GuardianAction[] }) => {
  const urgent = params.actions.filter((action) => action.priority === 'urgent' || action.priority === 'high');
  return {
    morning: `Good morning. Business health is ${params.radar.overall}/100. You have ${urgent.length} priority actions today.`,
    evening: `Today’s review: focus on cashflow (${params.radar.cashflow}/100), customers (${params.radar.customer}/100), and inventory (${params.radar.inventory}/100).`,
    weekly: `Weekly summary: overall health ${params.radar.overall}/100 with ${params.actions.length} actionable recommendations.`,
    monthly: `Monthly executive summary: protect cashflow, reward loyal customers, and keep inventory aligned to demand signals.`,
  };
};

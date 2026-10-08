import { supabase } from './supabase';
import { buildCustomerIntelligence } from './customerIntelligence';
import { buildGuardianActions, buildHealthRadar } from './executiveGuardian';
import { getAIProvider, type BusinessAnalysisResult } from './ai/providers';
import type { Database, Json } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type SaleItem = Database['public']['Tables']['sale_items']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Benchmark = Database['public']['Tables']['market_benchmarks']['Row'];

export interface OperatingSystemContext {
  businessId: string;
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  benchmarks: Benchmark[];
  revenue: number;
  outstanding: number;
  overdue: number;
  lowStock: number;
  inventoryValue: number;
  profitEstimate: number;
  collectionRate: number;
}

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export const loadOperatingSystemContext = async (businessId: string): Promise<OperatingSystemContext> => {
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const [productsResult, salesResult, customersResult, invoicesResult, paymentsResult, benchmarksResult] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
    supabase.from('sales').select('*').eq('business_id', businessId).gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
    supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
    supabase.from('invoices').select('*').eq('business_id', businessId).limit(1000),
    supabase.from('payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1000),
    supabase.from('market_benchmarks').select('*').limit(500),
  ]);
  const firstError = productsResult.error || salesResult.error || customersResult.error || invoicesResult.error || paymentsResult.error;
  if (firstError) throw firstError;
  const sales = salesResult.data || [];
  const saleIds = sales.map((sale) => sale.id);
  const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
  if (saleItemsResult.error) throw saleItemsResult.error;
  const products = productsResult.data || [];
  const invoices = invoicesResult.data || [];
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdue = invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date()).length;
  const lowStock = products.filter((product) => product.quantity <= product.reorder_level).length;
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.cost_price) * product.quantity, 0);
  const paidInvoices = invoices.filter((invoice) => Number(invoice.balance) <= 0).length;
  return {
    businessId,
    products,
    sales,
    saleItems: (saleItemsResult.data || []) as SaleItem[],
    customers: customersResult.data || [],
    invoices,
    payments: paymentsResult.data || [],
    benchmarks: benchmarksResult.data || [],
    revenue,
    outstanding,
    overdue,
    lowStock,
    inventoryValue,
    profitEstimate: revenue - inventoryValue * 0.05,
    collectionRate: invoices.length ? (paidInvoices / invoices.length) * 100 : 100,
  };
};

const providerInput = (businessId: string, prompt: string, context: OperatingSystemContext, mode: string) => ({
  businessId,
  prompt,
  mode: mode as 'doctor',
  context: {
    revenue: context.revenue,
    outstanding: context.outstanding,
    overdue: context.overdue,
    lowStock: context.lowStock,
    inventoryValue: context.inventoryValue,
    profitEstimate: context.profitEstimate,
    collectionRate: context.collectionRate,
  } as Json,
});

export const getBusinessDoctorAnalysis = async (businessId: string): Promise<BusinessAnalysisResult & { scores: Record<string, number> }> => {
  const context = await loadOperatingSystemContext(businessId);
  const provider = getAIProvider('local');
  const base = await provider.analyzeBusiness(providerInput(businessId, 'Diagnose the business health', context, 'doctor'));
  const customerIntelligence = buildCustomerIntelligence({ customers: context.customers, sales: context.sales, saleItems: context.saleItems, invoices: context.invoices, payments: context.payments, products: context.products });
  const radar = buildHealthRadar({ sales: context.sales, products: context.products, invoices: context.invoices, customers: customerIntelligence });
  const scores = {
    businessHealth: radar.overall,
    salesHealth: radar.revenue,
    inventoryHealth: radar.inventory,
    debtorHealth: radar.debtor,
    growthScore: radar.growth,
    cashflowScore: radar.cashflow,
    profitabilityScore: radar.profit,
    operationalRisk: 100 - radar.overall,
  };
  return { ...base, scores };
};

export const getAICEOAdvice = async (businessId: string, question: string): Promise<BusinessAnalysisResult> => {
  const context = await loadOperatingSystemContext(businessId);
  const provider = getAIProvider('local');
  const result = await provider.evaluateExpansion(providerInput(businessId, question, context, 'doctor'));
  const canExpand = context.revenue > context.outstanding * 2 && context.lowStock < 5;
  return {
    ...result,
    title: 'AI CEO Strategic Decision',
    summary: `${canExpand ? 'Expansion may be considered cautiously.' : 'Expansion should wait until cashflow and operations are stronger.'} Revenue is ${money(context.revenue)} and receivables are ${money(context.outstanding)}.`,
    confidence: canExpand ? 74 : 68,
    risks: [...result.risks, context.outstanding > 0 ? 'Outstanding receivables may reduce expansion capacity.' : 'Expansion risk is mainly operational execution.'].filter(Boolean),
    actionPlan: canExpand ? ['Validate demand for the new branch or investment.', 'Protect working capital.', 'Expand one operational unit at a time.'] : ['Collect outstanding debts.', 'Increase sales consistency.', 'Stabilize inventory before expanding.'],
  };
};

export const getGuardianAIAlerts = async (businessId: string) => {
  const context = await loadOperatingSystemContext(businessId);
  const customerIntelligence = buildCustomerIntelligence({ customers: context.customers, sales: context.sales, saleItems: context.saleItems, invoices: context.invoices, payments: context.payments, products: context.products });
  const actions = buildGuardianActions({ products: context.products, invoices: context.invoices, customers: customerIntelligence, sales: context.sales });
  return actions.map((action) => ({ ...action, severity: action.priority === 'urgent' ? 'critical' : action.priority === 'high' ? 'high' : action.priority === 'medium' ? 'medium' : 'low' }));
};

export const getCashflowForecast = async (businessId: string) => {
  const context = await loadOperatingSystemContext(businessId);
  const averageDailyRevenue = context.sales.length ? context.revenue / Math.max(1, 180) : 0;
  const expectedRecovery = context.outstanding * Math.min(0.75, Math.max(0.2, context.collectionRate / 100));
  const periods = [30, 60, 90, 180];
  return periods.map((days) => ({
    days,
    revenue: Math.round(averageDailyRevenue * days),
    profit: Math.round(averageDailyRevenue * days * 0.22),
    cashBalance: Math.round(averageDailyRevenue * days * 0.22 + expectedRecovery * (days / 180)),
    inventoryDemand: Math.round(context.lowStock * (days / 30)),
    debtRecovery: Math.round(expectedRecovery * (days / 180)),
    riskExposure: Math.round(context.outstanding + context.lowStock * 10000 - expectedRecovery * (days / 180)),
  }));
};

export const getVoiceOperatorArchitecture = () => ({
  supportedCommands: ['Voice-to-Sales', 'Voice-to-Inventory', 'Voice-to-Debtors', 'Voice-to-Payments', 'Voice-to-Reports', 'Voice-to-Customer Search', 'Voice-to-Business Guardian', 'Voice-to-Insights'],
  safety: ['Parse intent first', 'Validate business context', 'Require user confirmation before mutating records', 'Write audit trail', 'Respect subscription voice limits'],
  examples: [
    'Sold 5 cartons of Coca-Cola for ₦120,000',
    'John owes me ₦45,000',
    'I bought 20 bags of rice yesterday',
  ],
});

export const getMarketNetworkInsights = async (businessId: string) => {
  const context = await loadOperatingSystemContext(businessId);
  const benchmarks = context.benchmarks;
  return {
    benchmarks,
    insights: benchmarks.slice(0, 6).map((benchmark) => `${benchmark.industry} ${benchmark.metric_name.replace(/_/g, ' ')} benchmark is ${benchmark.metric_value} ${benchmark.metric_unit}.`),
    privacy: 'Anonymous aggregated benchmarks only. No personal data and no business identifiers are exposed.',
  };
};

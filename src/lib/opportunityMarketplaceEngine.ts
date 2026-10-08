import { supabase } from './supabase';
import type { Database } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type SaleItem = Database['public']['Tables']['sale_items']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];

export type MarketplaceOpportunityCategory = 'revenue' | 'profit' | 'inventory' | 'customer' | 'growth';

export interface MarketplaceOpportunity {
  id: string;
  category: MarketplaceOpportunityCategory;
  opportunityName: string;
  expectedRevenueImpact: number;
  confidenceScore: number;
  recommendedAction: string;
  evidence: string;
}

export interface OpportunityMarketplaceResult {
  generatedAt: string;
  opportunities: MarketplaceOpportunity[];
  topRevenueOpportunities: MarketplaceOpportunity[];
  topProfitOpportunities: MarketplaceOpportunity[];
  inventoryOpportunities: MarketplaceOpportunity[];
  customerOpportunities: MarketplaceOpportunity[];
  growthOpportunities: MarketplaceOpportunity[];
  summary: {
    totalOpportunities: number;
    expectedRevenueImpact: number;
    averageConfidence: number;
    fastestProduct: string;
    slowestProduct: string;
  };
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const makeId = (category: string, name: string) => `${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const buildOpportunityMarketplace = async (businessId: string): Promise<OpportunityMarketplaceResult> => {
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const [productsResult, salesResult, customersResult, invoicesResult] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
    supabase.from('sales').select('*').eq('business_id', businessId).gte('created_at', since).order('created_at', { ascending: false }).limit(1500),
    supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
    supabase.from('invoices').select('*').eq('business_id', businessId).limit(1500),
  ]);
  const firstError = productsResult.error || salesResult.error || customersResult.error || invoicesResult.error;
  if (firstError) throw firstError;

  const products = (productsResult.data || []) as Product[];
  const sales = (salesResult.data || []) as Sale[];
  const customers = (customersResult.data || []) as Customer[];
  const invoices = (invoicesResult.data || []) as Invoice[];
  const saleIds = sales.map((sale) => sale.id);
  const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
  if (saleItemsResult.error) throw saleItemsResult.error;
  const saleItems = (saleItemsResult.data || []) as SaleItem[];

  const productById = new Map(products.map((product) => [product.id, product]));
  const productMetrics = new Map<string, { productName: string; product?: Product; quantity: number; revenue: number; profit: number; saleCount: number }>();
  saleItems.forEach((item) => {
    const product = item.product_id ? productById.get(item.product_id) : undefined;
    const key = item.product_id || item.product_name;
    const current = productMetrics.get(key) || { productName: item.product_name, product, quantity: 0, revenue: 0, profit: 0, saleCount: 0 };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.total || 0);
    current.profit += Math.max(0, Number(item.unit_price || 0) - Number(product?.cost_price || 0)) * Number(item.quantity || 0);
    current.saleCount += 1;
    productMetrics.set(key, current);
  });

  const rankedByQuantity = Array.from(productMetrics.values()).sort((a, b) => b.quantity - a.quantity);
  const rankedByProfit = Array.from(productMetrics.values()).sort((a, b) => b.profit - a.profit);
  const opportunities: MarketplaceOpportunity[] = [];

  rankedByQuantity.slice(0, 5).forEach((metric) => {
    opportunities.push({
      id: makeId('revenue', metric.productName),
      category: 'revenue',
      opportunityName: `Promote fast seller: ${metric.productName}`,
      expectedRevenueImpact: Math.round(metric.revenue * 0.22),
      confidenceScore: clamp(72 + metric.saleCount * 3),
      recommendedAction: `Feature ${metric.productName} in today's sales push and protect availability.`,
      evidence: `${metric.quantity} units sold with recorded revenue of ${metric.revenue}.`,
    });
  });

  rankedByProfit.slice(0, 5).forEach((metric) => {
    if (metric.profit <= 0) return;
    opportunities.push({
      id: makeId('profit', metric.productName),
      category: 'profit',
      opportunityName: `Scale high-margin product: ${metric.productName}`,
      expectedRevenueImpact: Math.round(metric.profit * 1.4),
      confidenceScore: clamp(70 + metric.profit / 10000),
      recommendedAction: `Bundle or upsell ${metric.productName} to customers already buying related items.`,
      evidence: `Estimated profit contribution is ${Math.round(metric.profit)} from sale item margins.`,
    });
  });

  products.filter((product) => product.quantity <= product.reorder_level).slice(0, 8).forEach((product) => {
    opportunities.push({
      id: makeId('inventory-restock', product.name),
      category: 'inventory',
      opportunityName: `Restock opportunity: ${product.name}`,
      expectedRevenueImpact: Math.round(Number(product.selling_price || 0) * Math.max(1, product.reorder_level)),
      confidenceScore: 82,
      recommendedAction: `Restock ${product.name} before stockout blocks demand.`,
      evidence: `Current quantity ${product.quantity} is at/below reorder level ${product.reorder_level}.`,
    });
  });

  products.filter((product) => product.quantity > product.reorder_level * 4 && !Array.from(productMetrics.values()).some((metric) => metric.product?.id === product.id && metric.quantity > 0)).slice(0, 8).forEach((product) => {
    opportunities.push({
      id: makeId('dead-inventory', product.name),
      category: 'inventory',
      opportunityName: `Dead inventory risk: ${product.name}`,
      expectedRevenueImpact: Math.round(Number(product.selling_price || 0) * Math.min(product.quantity, product.reorder_level || 1) * 0.35),
      confidenceScore: 68,
      recommendedAction: `Discount, bundle, or reduce reorder commitment for ${product.name}.`,
      evidence: `Stock is ${product.quantity}, but recent sale velocity is weak or absent.`,
    });
  });

  const now = Date.now();
  customers.slice(0, 1000).forEach((customer) => {
    const customerSales = sales.filter((sale) => sale.customer_id === customer.id);
    const customerInvoices = invoices.filter((invoice) => invoice.customer_id === customer.id);
    const revenue = customerSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) || Number(customer.total_purchases || 0);
    const lastPurchase = customer.last_purchase_date || customerSales[0]?.created_at;
    const inactiveDays = lastPurchase ? Math.floor((now - new Date(lastPurchase).getTime()) / 86400000) : 999;
    const balance = Number(customer.current_balance || 0) || customerInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
    if (inactiveDays >= 45 && revenue > 0) opportunities.push({
      id: makeId('reactivation', customer.name),
      category: 'customer',
      opportunityName: `Reactivate ${customer.name}`,
      expectedRevenueImpact: Math.round((revenue / Math.max(1, customerSales.length || 1)) * 0.7),
      confidenceScore: clamp(80 - Math.min(35, inactiveDays / 6)),
      recommendedAction: `Send a retention offer to ${customer.name} based on previous buying behavior.`,
      evidence: `${inactiveDays} days since last purchase with historical value available.`,
    });
    if (balance > 0) opportunities.push({
      id: makeId('cash-recovery', customer.name),
      category: 'customer',
      opportunityName: `Cash recovery: ${customer.name}`,
      expectedRevenueImpact: Math.round(balance * 0.45),
      confidenceScore: 76,
      recommendedAction: `Follow up ${customer.name} for payment and require deposit before new credit.`,
      evidence: `Outstanding balance is ${balance}.`,
    });
  });

  if (rankedByQuantity[0] && rankedByProfit[0]) opportunities.push({
    id: 'cross-sell-top-profit-top-volume',
    category: 'growth',
    opportunityName: `Cross-sell ${rankedByProfit[0].productName} with ${rankedByQuantity[0].productName}`,
    expectedRevenueImpact: Math.round((rankedByProfit[0].profit + rankedByQuantity[0].revenue) * 0.12),
    confidenceScore: 74,
    recommendedAction: `Create a bundle combining the top-volume product with a high-margin product.`,
    evidence: `Combines high sales velocity and high profit contribution signals.`,
  });

  const sorted = opportunities.sort((a, b) => b.expectedRevenueImpact * (b.confidenceScore / 100) - a.expectedRevenueImpact * (a.confidenceScore / 100));
  const avgConfidence = sorted.length ? sorted.reduce((sum, item) => sum + item.confidenceScore, 0) / sorted.length : 0;

  return {
    generatedAt: new Date().toISOString(),
    opportunities: sorted,
    topRevenueOpportunities: sorted.filter((item) => item.category === 'revenue').slice(0, 8),
    topProfitOpportunities: sorted.filter((item) => item.category === 'profit').slice(0, 8),
    inventoryOpportunities: sorted.filter((item) => item.category === 'inventory').slice(0, 8),
    customerOpportunities: sorted.filter((item) => item.category === 'customer').slice(0, 8),
    growthOpportunities: sorted.filter((item) => item.category === 'growth').slice(0, 8),
    summary: {
      totalOpportunities: sorted.length,
      expectedRevenueImpact: sorted.reduce((sum, item) => sum + item.expectedRevenueImpact, 0),
      averageConfidence: clamp(avgConfidence),
      fastestProduct: rankedByQuantity[0]?.productName || 'Not enough data',
      slowestProduct: products.find((product) => !Array.from(productMetrics.values()).some((metric) => metric.product?.id === product.id && metric.quantity > 0))?.name || 'Not enough data',
    },
  };
};

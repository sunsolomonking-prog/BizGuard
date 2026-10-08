import { buildCustomerIntelligence, type CustomerIntelligence } from './customerIntelligence';
import type { BusinessAnalysisResult } from './ai/providers';
import { getAIProvider } from './ai/providers';
import { supabase } from './supabase';
import type { Database, Json } from './database.types';

type Customer = Database['public']['Tables']['customers']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type SaleItem = Database['public']['Tables']['sale_items']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export type CustomerPredictionRisk = 'low' | 'medium' | 'high' | 'critical';
export type CustomerPredictionAction = 'sell_now' | 'nurture' | 'win_back' | 'collect' | 'protect_vip';

export interface CustomerPatronagePrediction {
  customer: Customer;
  patronageProbability: number;
  buyAgainProbability: number;
  stopBuyingProbability: number;
  loyaltyProbability: number;
  spendingGrowthProbability: number;
  churnRisk: CustomerPredictionRisk;
  churnDrivers: string[];
  loyaltyScore: number;
  lifetimeValueEstimate: number;
  vipRank: number;
  predictedNextPurchase: string;
  recommendedProducts: string[];
  estimatedOrderValue: number;
  revenueOpportunity: number;
  latePaymentProbability: number;
  defaultProbability: number;
  collectionPriorityRank: number;
  recommendedAction: CustomerPredictionAction;
  recommendation: string;
  confidence: number;
  evidence: string[];
}

export interface CustomerPredictorSummary {
  totalCustomers: number;
  likelyToBuySoon: number;
  churnRiskCustomers: number;
  vipCustomers: number;
  highRiskDebtors: number;
  totalRevenueOpportunity: number;
  averagePatronageProbability: number;
  averageLoyaltyScore: number;
  providerResult: BusinessAnalysisResult;
}

export interface CustomerPredictorResult {
  generatedAt: string;
  predictions: CustomerPatronagePrediction[];
  opportunities: CustomerPatronagePrediction[];
  churnWatchlist: CustomerPatronagePrediction[];
  vipRanking: CustomerPatronagePrediction[];
  debtorRisk: CustomerPatronagePrediction[];
  summary: CustomerPredictorSummary;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const daysBetween = (date: string | null | undefined) => {
  if (!date) return null;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / MS_PER_DAY));
};

const medianGapDays = (sales: Sale[]) => {
  if (sales.length < 2) return null;
  const sorted = [...sales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const gaps = sorted.slice(1).map((sale, index) => Math.max(1, Math.round((new Date(sale.created_at).getTime() - new Date(sorted[index].created_at).getTime()) / MS_PER_DAY))).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
};

const trendScore = (sales: Sale[]) => {
  if (sales.length < 3) return 50;
  const now = Date.now();
  const recent = sales.filter((sale) => now - new Date(sale.created_at).getTime() <= 60 * MS_PER_DAY).reduce((sum, sale) => sum + Number(sale.total), 0);
  const prior = sales.filter((sale) => {
    const age = now - new Date(sale.created_at).getTime();
    return age > 60 * MS_PER_DAY && age <= 120 * MS_PER_DAY;
  }).reduce((sum, sale) => sum + Number(sale.total), 0);
  if (recent <= 0 && prior <= 0) return 45;
  if (prior <= 0) return recent > 0 ? 70 : 40;
  return clamp(50 + ((recent - prior) / Math.max(1, prior)) * 35);
};

const riskLabel = (score: number): CustomerPredictionRisk => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
};

const pickRecommendedProducts = (insight: CustomerIntelligence, allCustomerInsights: CustomerIntelligence[], products: Product[]) => {
  const ownProducts = insight.mostPurchasedProducts.map((product) => product.productName).filter(Boolean);
  const peerProducts = allCustomerInsights.flatMap((item) => item.mostPurchasedProducts.map((product) => product.productName));
  const rankedPeerProducts = Array.from(new Set(peerProducts)).filter((name) => !ownProducts.includes(name));
  const activeProducts = products.filter((product) => product.is_active && product.quantity > 0).sort((a, b) => Number(b.selling_price) - Number(a.selling_price)).map((product) => product.name);
  return Array.from(new Set([...ownProducts, ...rankedPeerProducts, ...activeProducts])).slice(0, 3);
};

const buildPrediction = (insight: CustomerIntelligence, allInsights: CustomerIntelligence[], products: Product[], index: number): CustomerPatronagePrediction => {
  const daysSinceLast = insight.daysSinceLastPurchase ?? daysBetween(insight.customer.last_purchase_date);
  const expectedGap = medianGapDays(insight.sales) ?? (insight.purchaseFrequency > 0 ? Math.round(30 / insight.purchaseFrequency) : 45);
  const trend = trendScore(insight.sales);
  const outstandingDebt = Number(insight.customer.current_balance || 0) || insight.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdueInvoices = insight.invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date());
  const overduePressure = clamp(overdueInvoices.length * 22 + (outstandingDebt > 0 ? Math.min(35, outstandingDebt / 10000) : 0));
  const recencyComponent = daysSinceLast === null ? 38 : daysSinceLast <= Math.max(10, expectedGap) ? 90 : daysSinceLast <= expectedGap * 2 ? 65 : daysSinceLast <= expectedGap * 3 ? 38 : 16;
  const frequencyComponent = clamp(insight.purchaseFrequency * 24);
  const valueComponent = clamp(insight.averageOrderValue / 5000);
  const buyAgainProbability = clamp(recencyComponent * 0.38 + frequencyComponent * 0.22 + trend * 0.18 + insight.paymentReliability * 0.12 + valueComponent * 0.1);
  const stopBuyingProbability = clamp((100 - recencyComponent) * 0.48 + (100 - trend) * 0.22 + (100 - insight.patronageScore) * 0.18 + overduePressure * 0.12);
  const loyaltyProbability = clamp(insight.patronageScore * 0.42 + insight.paymentReliability * 0.22 + insight.debtBehaviour * 0.14 + frequencyComponent * 0.12 + valueComponent * 0.1);
  const spendingGrowthProbability = clamp(trend * 0.34 + frequencyComponent * 0.18 + valueComponent * 0.18 + recencyComponent * 0.18 + insight.productDiversity * 4);
  const patronageProbability = clamp(buyAgainProbability * 0.35 + loyaltyProbability * 0.25 + spendingGrowthProbability * 0.18 + insight.healthScore * 0.14 + (100 - stopBuyingProbability) * 0.08);
  const latePaymentProbability = clamp((100 - insight.paymentReliability) * 0.38 + overduePressure * 0.35 + (outstandingDebt > insight.averageOrderValue && outstandingDebt > 0 ? 18 : 0) + (insight.invoices.length === 0 ? 8 : 0));
  const defaultProbability = clamp(latePaymentProbability * 0.55 + (100 - insight.debtBehaviour) * 0.32 + (daysSinceLast !== null && daysSinceLast > 90 ? 13 : 0));
  const recommendedProducts = pickRecommendedProducts(insight, allInsights, products);
  const predictedNextPurchase = recommendedProducts[0] || insight.mostPurchasedProducts[0]?.productName || 'Needs more purchase data';
  const estimatedOrderValue = Math.round(Math.max(insight.averageOrderValue, Number(products.find((product) => product.name === predictedNextPurchase)?.selling_price || 0), insight.lifetimeValue > 0 ? insight.lifetimeValue / Math.max(1, insight.transactionCount) : 0));
  const revenueOpportunity = Math.round(estimatedOrderValue * (buyAgainProbability / 100));
  const churnDrivers = [
    daysSinceLast !== null && daysSinceLast > expectedGap * 2 ? `Last purchase was ${daysSinceLast} days ago; expected cadence is about ${expectedGap} days.` : null,
    trend < 45 ? 'Recent spending is below the previous period.' : null,
    insight.purchaseFrequency < 0.5 ? 'Order frequency is low.' : null,
    overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue invoice(s) may reduce future patronage.` : null,
    outstandingDebt > 0 ? `${money(outstandingDebt)} outstanding balance is still open.` : null,
  ].filter(Boolean) as string[];
  const recommendedAction: CustomerPredictionAction = defaultProbability >= 60 || latePaymentProbability >= 65 ? 'collect' : stopBuyingProbability >= 60 ? 'win_back' : loyaltyProbability >= 80 ? 'protect_vip' : buyAgainProbability >= 70 ? 'sell_now' : 'nurture';
  const recommendation = recommendedAction === 'collect'
    ? `Prioritize collection for ${insight.customer.name} before extending more credit.`
    : recommendedAction === 'win_back'
      ? `Contact ${insight.customer.name} within 7 days with a win-back offer.`
      : recommendedAction === 'protect_vip'
        ? `Protect ${insight.customer.name} with VIP service and early access to ${predictedNextPurchase}.`
        : recommendedAction === 'sell_now'
          ? `Contact ${insight.customer.name} within 7 days about ${predictedNextPurchase}.`
          : `Nurture ${insight.customer.name} with a helpful follow-up and product reminder.`;
  const evidence = [
    `${insight.transactionCount} purchase(s), ${money(insight.lifetimeValue)} lifetime value.`,
    daysSinceLast === null ? 'No last purchase date available.' : `Last purchase ${daysSinceLast} day(s) ago.`,
    `Average order value is ${money(insight.averageOrderValue)}.`,
    outstandingDebt > 0 ? `Outstanding debt: ${money(outstandingDebt)}.` : 'No outstanding debtor balance detected.',
  ];

  return {
    customer: insight.customer,
    patronageProbability,
    buyAgainProbability,
    stopBuyingProbability,
    loyaltyProbability,
    spendingGrowthProbability,
    churnRisk: riskLabel(stopBuyingProbability),
    churnDrivers,
    loyaltyScore: loyaltyProbability,
    lifetimeValueEstimate: Math.round(Math.max(insight.projectedValue, insight.lifetimeValue + revenueOpportunity * 6)),
    vipRank: index + 1,
    predictedNextPurchase,
    recommendedProducts,
    estimatedOrderValue,
    revenueOpportunity,
    latePaymentProbability,
    defaultProbability,
    collectionPriorityRank: 0,
    recommendedAction,
    recommendation,
    confidence: clamp(55 + Math.min(25, insight.transactionCount * 4) + (insight.invoices.length > 0 ? 8 : 0) + (insight.mostPurchasedProducts.length > 0 ? 7 : 0)),
    evidence,
  };
};

export const buildCustomerPatronagePredictions = async (businessId: string): Promise<CustomerPredictorResult> => {
  const [customersResult, salesResult, invoicesResult, paymentsResult, productsResult] = await Promise.all([
    supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
    supabase.from('sales').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1500),
    supabase.from('invoices').select('*').eq('business_id', businessId).limit(1500),
    supabase.from('payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1500),
    supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true).limit(1000),
  ]);

  const firstError = customersResult.error || salesResult.error || invoicesResult.error || paymentsResult.error || productsResult.error;
  if (firstError) throw firstError;

  const customers = (customersResult.data || []) as Customer[];
  const sales = (salesResult.data || []) as Sale[];
  const saleIds = sales.map((sale) => sale.id);
  const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
  if (saleItemsResult.error) throw saleItemsResult.error;

  const products = (productsResult.data || []) as Product[];
  const invoices = (invoicesResult.data || []) as Invoice[];
  const payments = (paymentsResult.data || []) as Payment[];
  const saleItems = (saleItemsResult.data || []) as SaleItem[];
  const intelligence = buildCustomerIntelligence({ customers, sales, saleItems, invoices, payments, products });
  const predictions = intelligence
    .map((insight, index) => buildPrediction(insight, intelligence, products, index))
    .sort((a, b) => b.patronageProbability - a.patronageProbability)
    .map((prediction, index) => ({ ...prediction, vipRank: index + 1 }));

  const debtorRanking = [...predictions].sort((a, b) => (b.defaultProbability + b.latePaymentProbability) - (a.defaultProbability + a.latePaymentProbability));
  debtorRanking.forEach((prediction, index) => { prediction.collectionPriorityRank = index + 1; });

  const totalRevenueOpportunity = predictions.reduce((sum, prediction) => sum + prediction.revenueOpportunity, 0);
  const averagePatronageProbability = predictions.length ? predictions.reduce((sum, prediction) => sum + prediction.patronageProbability, 0) / predictions.length : 0;
  const averageLoyaltyScore = predictions.length ? predictions.reduce((sum, prediction) => sum + prediction.loyaltyScore, 0) / predictions.length : 0;
  const provider = getAIProvider('local');
  const providerResult = await provider.predictCustomerPatronage({
    businessId,
    prompt: 'Predict customer patronage, churn, loyalty, opportunities, and debtor risk from live BizGuard customer intelligence.',
    mode: 'customer-predictor',
    context: {
      totalCustomers: predictions.length,
      totalRevenueOpportunity,
      likelyToBuySoon: predictions.filter((prediction) => prediction.buyAgainProbability >= 70).length,
      churnRiskCustomers: predictions.filter((prediction) => prediction.stopBuyingProbability >= 60).length,
      vipCustomers: predictions.filter((prediction) => prediction.loyaltyScore >= 80).length,
      highRiskDebtors: predictions.filter((prediction) => prediction.defaultProbability >= 60 || prediction.latePaymentProbability >= 65).length,
      topOpportunity: predictions[0]?.customer.name || null,
    } as Json,
  });

  return {
    generatedAt: new Date().toISOString(),
    predictions,
    opportunities: [...predictions].sort((a, b) => b.revenueOpportunity - a.revenueOpportunity).slice(0, 12),
    churnWatchlist: predictions.filter((prediction) => prediction.stopBuyingProbability >= 45).sort((a, b) => b.stopBuyingProbability - a.stopBuyingProbability).slice(0, 12),
    vipRanking: predictions.slice(0, 12),
    debtorRisk: debtorRanking.slice(0, 12),
    summary: {
      totalCustomers: predictions.length,
      likelyToBuySoon: predictions.filter((prediction) => prediction.buyAgainProbability >= 70).length,
      churnRiskCustomers: predictions.filter((prediction) => prediction.stopBuyingProbability >= 60).length,
      vipCustomers: predictions.filter((prediction) => prediction.loyaltyScore >= 80).length,
      highRiskDebtors: predictions.filter((prediction) => prediction.defaultProbability >= 60 || prediction.latePaymentProbability >= 65).length,
      totalRevenueOpportunity,
      averagePatronageProbability: clamp(averagePatronageProbability),
      averageLoyaltyScore: clamp(averageLoyaltyScore),
      providerResult,
    },
  };
};

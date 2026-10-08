import type { AIProvider, BusinessAnalysisInput, BusinessAnalysisResult } from './types';

const asRecord = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const numberValue = (record: Record<string, unknown>, key: string) => typeof record[key] === 'number' ? record[key] as number : 0;
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);

const buildResult = (input: BusinessAnalysisInput, purpose: string): BusinessAnalysisResult => {
  const context = asRecord(input.context);
  const revenue = numberValue(context, 'revenue');
  const outstanding = numberValue(context, 'outstanding');
  const lowStock = numberValue(context, 'lowStock');
  const overdue = numberValue(context, 'overdue');
  const profitEstimate = numberValue(context, 'profitEstimate');
  const growthScore = numberValue(context, 'growthScore');
  const projectedRevenueImpact = numberValue(context, 'projectedRevenueImpact');
  const projectedProfitImpact = numberValue(context, 'projectedProfitImpact');
  const totalCustomers = numberValue(context, 'totalCustomers');
  const totalRevenueOpportunity = numberValue(context, 'totalRevenueOpportunity');
  const recoverableRevenue = numberValue(context, 'recoverableRevenue');
  const isGrowth = input.mode === 'growth-engine';
  const isCustomer = input.mode === 'customer-predictor' || input.mode === 'customer-future-intelligence' || input.mode === 'customer-action-automation';
  if (isGrowth) {
    const recommendations = [
      projectedRevenueImpact > 0 ? `Prioritize growth opportunities worth about ${money(projectedRevenueImpact)}.` : 'Record more sales and product history to unlock stronger growth projections.',
      projectedProfitImpact > 0 ? `Focus on plays that can add about ${money(projectedProfitImpact)} profit.` : 'Improve product margin and inventory mix before expansion.',
      lowStock > 0 ? 'Secure fast-moving inventory before promotions.' : 'Use inventory stability to test growth campaigns.',
    ];
    return { provider: 'local', title: 'Autonomous Growth Engine', summary: `Growth Engine detected a ${Math.round(growthScore || 0)}/100 growth score, ${money(projectedRevenueImpact)} revenue upside, and ${money(projectedProfitImpact)} projected profit upside from live BizGuard data.`, confidence: projectedRevenueImpact > 0 ? 84 : 60, risks: [outstanding > revenue * 0.35 && outstanding > 0 ? `${money(outstanding)} receivables may slow growth execution.` : null, lowStock > 0 ? `${lowStock} low-stock product(s) could block revenue growth.` : null].filter(Boolean) as string[], recommendations, actionPlan: recommendations, metrics: { growthScore, projectedRevenueImpact: money(projectedRevenueImpact), projectedProfitImpact: money(projectedProfitImpact), revenue: money(revenue), outstanding: money(outstanding), lowStock } };
  }
  if (isCustomer) {
    const recommendations = [totalRevenueOpportunity > 0 ? `Prioritize ${money(totalRevenueOpportunity)} customer opportunity.` : 'Add product-level sales history.', recoverableRevenue > 0 ? `Activate follow-up plays to recover ${money(recoverableRevenue)}.` : 'Use follow-up plays once enough signals exist.'];
    return { provider: 'local', title: purpose, summary: `Customer AI analyzed ${totalCustomers} customer(s), ${money(totalRevenueOpportunity)} opportunity and ${money(recoverableRevenue)} recoverable revenue.`, confidence: totalCustomers > 0 ? 82 : 55, risks: totalCustomers <= 0 ? ['No active customer records are available.'] : [], recommendations, actionPlan: recommendations, metrics: { totalCustomers, totalRevenueOpportunity: money(totalRevenueOpportunity), recoverableRevenue: money(recoverableRevenue) } };
  }
  const recommendations = [outstanding > 0 ? 'Prioritize collections before new expansion spend.' : 'Keep debtor exposure low.', lowStock > 0 ? 'Restock high-performing low-stock products first.' : 'Maintain inventory discipline.', revenue > 0 ? 'Protect margin on top products and repeat customers.' : 'Record daily sales to strengthen forecasting.'];
  return { provider: 'local', title: purpose, summary: `Neural analysis shows ${money(revenue)} revenue, ${money(profitEstimate)} estimated profit, ${money(outstanding)} receivables, ${lowStock} low-stock products and ${overdue} overdue invoices.`, confidence: revenue > 0 ? 84 : 58, risks: [outstanding > 0 ? `${money(outstanding)} is tied up in receivables.` : null, lowStock > 0 ? `${lowStock} products are at or below reorder level.` : null, overdue > 0 ? `${overdue} invoices are overdue.` : null].filter(Boolean) as string[], recommendations, actionPlan: recommendations.slice(0, 3), metrics: { revenue: money(revenue), profitEstimate: money(profitEstimate), outstanding: money(outstanding), lowStock, overdue } };
};

export const localAIProvider: AIProvider = {
  name: 'local',
  analyzeBusiness: async (input) => buildResult(input, 'AI Business Doctor Diagnosis'),
  generateRecommendations: async (input) => buildResult(input, 'AI Recommendations'),
  forecastCashflow: async (input) => buildResult(input, 'Predictive Cashflow Forecast'),
  evaluateExpansion: async (input) => buildResult(input, 'AI CEO Strategic Advisor'),
  generateMarketInsights: async (input) => buildResult(input, 'AI Market Advisor'),
  predictCustomerPatronage: async (input) => buildResult(input, 'AI Customer Intelligence'),
  generateCustomerActions: async (input) => buildResult(input, 'AI Customer Action Automation'),
  runNeuralCore: async (input) => buildResult(input, 'BizGuard Neural Core'),
  generateGrowthPlan: async (input) => buildResult(input, 'Autonomous Growth Engine'),
};

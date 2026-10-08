import { buildOpportunityMarketplace, type MarketplaceOpportunity, type OpportunityMarketplaceResult } from './opportunityMarketplaceEngine';

export type AutonomousActionType =
  | 'restock-recommendation'
  | 'customer-reactivation'
  | 'debtor-recovery'
  | 'profit-optimization'
  | 'inventory-reduction';

export interface AutonomousAction {
  id: string;
  type: AutonomousActionType;
  title: string;
  recommendation: string;
  expectedImpact: string;
  confidence: number;
  actionLabel: string;
  approvalRequired: true;
  sourceOpportunityId?: string;
  sourceRecommendation?: string;
  plan: string[];
}

export interface AutonomousActionInput {
  marketplace?: OpportunityMarketplaceResult | null;
  recommendations?: string[];
  confidence?: number;
  focus?: 'all' | 'profit';
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Math.max(0, Number(value) || 0));

const actionMeta: Record<AutonomousActionType, { title: string; actionLabel: string }> = {
  'restock-recommendation': { title: 'Restock Recommendation', actionLabel: 'Generate Restock Plan' },
  'customer-reactivation': { title: 'Customer Reactivation', actionLabel: 'Generate Customer Message' },
  'debtor-recovery': { title: 'Debtor Recovery', actionLabel: 'Generate Recovery Plan' },
  'profit-optimization': { title: 'Profit Optimization', actionLabel: 'Generate Growth Plan' },
  'inventory-reduction': { title: 'Inventory Reduction', actionLabel: 'Generate Reduction Plan' },
};

const typeForOpportunity = (item: MarketplaceOpportunity): AutonomousActionType | null => {
  if (item.category === 'profit') return 'profit-optimization';
  if (item.category === 'inventory' && /restock/i.test(item.opportunityName)) return 'restock-recommendation';
  if (item.category === 'inventory' && /dead inventory|reduce|slow/i.test(`${item.opportunityName} ${item.recommendedAction}`)) return 'inventory-reduction';
  if (item.category === 'customer' && /reactivate/i.test(item.opportunityName)) return 'customer-reactivation';
  if (item.category === 'customer' && /cash recovery|payment|debt/i.test(`${item.opportunityName} ${item.recommendedAction}`)) return 'debtor-recovery';
  return null;
};

const typeForRecommendation = (recommendation: string): AutonomousActionType => {
  if (/restock|stockout|inventory/i.test(recommendation)) return 'restock-recommendation';
  if (/debt|debtor|receivable|outstanding|payment|collect/i.test(recommendation)) return 'debtor-recovery';
  if (/reactivat|win.?back|retention|dormant|customer/i.test(recommendation)) return 'customer-reactivation';
  if (/profit|margin|price|upsell|bundle|revenue|growth/i.test(recommendation)) return 'profit-optimization';
  return 'inventory-reduction';
};

const buildPlan = (type: AutonomousActionType, recommendation: string) => {
  switch (type) {
    case 'restock-recommendation':
      return ['Review affected SKUs and current stock levels.', 'Generate quantities and estimated cost from existing inventory data.', 'Require human approval before creating or sending any purchase action.'];
    case 'customer-reactivation':
      return ['Review the customer’s recent purchase history.', 'Generate a personalized reactivation message or offer.', 'Require human approval before any customer message is sent.'];
    case 'debtor-recovery':
      return ['Review outstanding balance, due date and payment history.', 'Generate a recovery sequence with a proposed follow-up message.', 'Require human approval before contacting the customer or changing credit terms.'];
    case 'profit-optimization':
      return ['Review the evidence behind the recommendation.', 'Generate a pricing, bundle, upsell or margin-improvement plan.', 'Require human approval before changing prices, promotions or sales rules.'];
    case 'inventory-reduction':
      return ['Identify slow/dead stock and its carrying value.', 'Generate discount, bundle or supplier-return options.', 'Require human approval before changing inventory, pricing or supplier commitments.'];
    default:
      return [recommendation, 'Review the proposed action.', 'Human approval is required before execution.'];
  }
};

const makeAction = (type: AutonomousActionType, recommendation: string, confidence: number, expectedImpact: string, sourceOpportunityId?: string): AutonomousAction => ({
  id: `${type}-${sourceOpportunityId || recommendation.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
  type,
  title: actionMeta[type].title,
  recommendation,
  expectedImpact,
  confidence: clamp(confidence),
  actionLabel: actionMeta[type].actionLabel,
  approvalRequired: true,
  sourceOpportunityId,
  sourceRecommendation: recommendation,
  plan: buildPlan(type, recommendation),
});

export const buildAutonomousActions = async (businessId: string, input: AutonomousActionInput = {}): Promise<AutonomousAction[]> => {
  const marketplace = input.marketplace ?? await buildOpportunityMarketplace(businessId);
  const actions: AutonomousAction[] = [];
  const seen = new Set<AutonomousActionType>();
  const focus = input.focus ?? 'all';

  const opportunities = marketplace.opportunities
    .filter((item) => focus === 'all' || item.category === 'profit')
    .sort((a, b) => b.expectedRevenueImpact * (b.confidenceScore / 100) - a.expectedRevenueImpact * (a.confidenceScore / 100));

  opportunities.forEach((item) => {
    const type = typeForOpportunity(item);
    if (!type || seen.has(type)) return;
    seen.add(type);
    actions.push(makeAction(type, item.recommendedAction, item.confidenceScore, `Potential impact: ${money(item.expectedRevenueImpact)}`, item.id));
  });

  (input.recommendations || []).forEach((recommendation) => {
    const type = typeForRecommendation(recommendation);
    if (focus === 'profit' && type !== 'profit-optimization') return;
    if (seen.has(type)) return;
    seen.add(type);
    actions.push(makeAction(type, recommendation, input.confidence ?? 60, 'Impact requires review against current business data.'));
  });

  if (focus === 'all') {
    (Object.keys(actionMeta) as AutonomousActionType[]).forEach((type) => {
      if (seen.has(type)) return;
      const fallback = {
        'restock-recommendation': 'Review products at or below their reorder level.',
        'customer-reactivation': 'Review dormant customers and identify a suitable reactivation offer.',
        'debtor-recovery': 'Review outstanding balances and prioritize overdue accounts for follow-up.',
        'profit-optimization': 'Review high-margin products and opportunities to improve pricing, bundles or upsells.',
        'inventory-reduction': 'Review slow-moving inventory for discount, bundling or supplier-return options.',
      }[type];
      actions.push(makeAction(type, fallback, input.confidence ?? 50, 'No quantified impact is available from the current dataset.'));
    });
  }

  return actions.slice(0, 5);
};

export const buildAutonomousActionsFromRecommendations = (recommendations: string[], confidence = 60): AutonomousAction[] => {
  const seen = new Set<AutonomousActionType>();
  return recommendations.map((recommendation) => {
    const type = typeForRecommendation(recommendation);
    if (seen.has(type)) return null;
    seen.add(type);
    return makeAction(type, recommendation, confidence, 'Impact requires review against current business data.');
  }).filter((action): action is AutonomousAction => Boolean(action)).slice(0, 5);
};

export const generateActionPlan = (action: AutonomousAction) => action.plan;

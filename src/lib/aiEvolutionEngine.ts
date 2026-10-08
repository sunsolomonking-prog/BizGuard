import { supabase } from './supabase';
import { loadOperatingSystemContext, type OperatingSystemContext } from './aiOperatingSystem';

export type EvolutionStage = 'OBSERVE' | 'LEARN' | 'ADAPT' | 'SELF-CORRECT' | 'IMPROVE' | 'OBSERVE AGAIN';
export type FeedbackKind = 'HELPFUL' | 'NOT_HELPFUL' | 'ACCURATE' | 'INACCURATE';

export interface EvolutionState {
  stage: EvolutionStage;
  observationStatus: 'LIVE' | 'LIMITED';
  learningStatus: 'LEARNING' | 'READY';
  adaptationStatus: 'EVIDENCE_FIRST' | 'BALANCED' | 'ACTION_ORIENTED';
  selfCorrectionStatus: 'CHECKING' | 'STABLE';
  improvementStatus: 'IMPROVING' | 'READY';
  confidenceScore: number;
  accuracyScore: number;
  trustScore: number;
  feedbackScore: number;
  improvementScore: number;
  helpful: number;
  corrections: number;
  streak: number;
  lastFeedback?: FeedbackKind;
}

export interface ProfitSnapshot {
  revenue: number;
  estimatedCost: number;
  profit: number;
  margin: number;
  source: 'LIVE_BIZGUARD_DATA' | 'MANUAL_INPUT';
}

export interface MoneyMove { title: string; reason: string; impact: 'HIGH' | 'MEDIUM' | 'LOW'; action: string; }
export interface DailyBriefing { businessHealth: number; revenueStatus: string; profitStatus: string; cashflowStatus: string; debtRisk: string; inventoryRisk: string; customerOpportunities: string[]; growthOpportunities: string[]; yesterday: string[]; today: string[]; next: string[]; }
export interface ExecutiveScores { businessHealth: number; growth: number; profit: number; risk: number; aiConfidence: number; customerHealth: number; inventoryHealth: number; cashflowHealth: number; }
export interface GrowthMission { title: string; reason: string; target?: number; completed: boolean; }
export interface CognitiveState { awareness: string; perception: string; reasoning: string; memory: string; intention: string; confidence: number; selfCheck: string; }

export const EVOLUTION_STAGES: EvolutionStage[] = ['OBSERVE', 'LEARN', 'ADAPT', 'SELF-CORRECT', 'IMPROVE', 'OBSERVE AGAIN'];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateProfit(revenue: number, cost: number, source: ProfitSnapshot['source'] = 'MANUAL_INPUT'): ProfitSnapshot {
  const safeRevenue = Number.isFinite(revenue) ? Math.max(0, revenue) : 0;
  const safeCost = Number.isFinite(cost) ? Math.max(0, cost) : 0;
  const profit = safeRevenue - safeCost;
  return { revenue: safeRevenue, estimatedCost: safeCost, profit, margin: safeRevenue ? (profit / safeRevenue) * 100 : 0, source };
}

export function calculateLiveProfit(context: OperatingSystemContext): ProfitSnapshot {
  const productCosts = new Map(context.products.map((product) => [product.id, Number(product.cost_price) || 0]));
  const estimatedCost = context.saleItems.reduce((sum, item) => sum + (productCosts.get(item.product_id) || 0) * Number(item.quantity || 0), 0);
  return calculateProfit(context.revenue, estimatedCost, 'LIVE_BIZGUARD_DATA');
}

export function getMoneyMoves(context: OperatingSystemContext, profit: ProfitSnapshot): MoneyMove[] {
  const moves: MoneyMove[] = [];
  const debt = context.outstanding;
  const urgentProduct = [...context.products].sort((a, b) => Number(a.quantity) - Number(b.quantity))[0];
  const slow = [...context.products].sort((a, b) => Number(a.quantity) - Number(b.quantity)).slice(0, 1)[0];
  const fastIds = new Map<string, number>();
  context.saleItems.forEach((item) => fastIds.set(item.product_id, (fastIds.get(item.product_id) || 0) + Number(item.quantity || 0)));
  const fast = [...context.products].sort((a, b) => (fastIds.get(b.id) || 0) - (fastIds.get(a.id) || 0))[0];

  if (profit.profit > 0 && profit.margin > 20) moves.push({ title: 'Protect your highest-margin revenue', reason: `Current modeled margin is ${profit.margin.toFixed(1)}%.`, impact: 'HIGH', action: fast ? `Prioritize ${fast.name} and keep its stock protected.` : 'Identify your highest-margin product and protect its availability.' });
  else moves.push({ title: 'Improve margin before scaling', reason: `Current modeled margin is ${profit.margin.toFixed(1)}%.`, impact: 'HIGH', action: 'Review pricing and the largest product cost drivers before adding volume.' });

  if (debt > 0) moves.push({ title: 'Recover outstanding cash', reason: `BizGuard currently sees ${formatNGN(debt)} outstanding.`, impact: 'HIGH', action: 'Follow up the most urgent overdue customer or invoice today.' });
  if (urgentProduct && Number(urgentProduct.quantity) <= Number(urgentProduct.reorder_level)) moves.push({ title: 'Restock before a stockout', reason: `${urgentProduct.name} is at or below its reorder level.`, impact: 'HIGH', action: `Review ${urgentProduct.name} and replenish based on real demand.` });
  if (slow) moves.push({ title: 'Review slow-moving stock', reason: `${slow.name} has the lowest current quantity signal among active products.`, impact: 'MEDIUM', action: 'Check demand and avoid tying additional cash up in weak inventory.' });
  if (fast) moves.push({ title: 'Protect the fast mover', reason: `${fast.name} has the strongest recorded unit movement in the loaded sales window.`, impact: 'MEDIUM', action: `Monitor ${fast.name} stock and margin closely.` });
  return moves.slice(0, 6);
}

export function buildDailyBriefing(context: OperatingSystemContext, profit: ProfitSnapshot): DailyBriefing {
  const businessHealth = clamp((profit.margin > 0 ? 45 : 25) + (context.lowStock === 0 ? 20 : Math.max(0, 20 - context.lowStock * 2)) + (context.collectionRate * 0.25));
  const debtRisk = context.overdue > 0 ? `${context.overdue} overdue invoice${context.overdue === 1 ? '' : 's'}.` : 'No overdue invoices detected in the loaded data.';
  const inventoryRisk = context.lowStock > 0 ? `${context.lowStock} product${context.lowStock === 1 ? '' : 's'} at or below reorder level.` : 'No current low-stock signal detected.';
  return {
    businessHealth,
    revenueStatus: `${formatNGN(context.revenue)} recorded across the loaded 180-day sales window.`,
    profitStatus: `${formatNGN(profit.profit)} estimated profit at ${profit.margin.toFixed(1)}% margin.`,
    cashflowStatus: `${formatNGN(context.outstanding)} remains outstanding from invoices.`,
    debtRisk,
    inventoryRisk,
    customerOpportunities: context.customers.filter((c) => Number(c.current_balance) === 0).slice(0, 3).map((c) => `Review ${c.name} for a repeat purchase opportunity.`),
    growthOpportunities: profit.margin > 20 ? ['Protect high-margin products.', 'Use sales evidence to identify repeatable winners.'] : ['Run a small margin-improvement experiment.', 'Stabilize cash collection before aggressive expansion.'],
    yesterday: ['Review the latest recorded sales and collections.', `Revenue signal: ${formatNGN(context.revenue)}.`],
    today: [debtRisk, inventoryRisk, profit.margin < 15 ? 'Prioritize margin improvement.' : 'Protect profitable demand.'],
    next: ['Record the outcome of one action.', 'Give BizGuard honest feedback so the next cycle can adapt.'],
  };
}

export function buildExecutiveScores(context: OperatingSystemContext, profit: ProfitSnapshot): ExecutiveScores {
  const inventoryHealth = clamp(100 - context.lowStock * 10);
  const customerHealth = clamp(context.customers.length ? (context.collectionRate * 0.65 + Math.min(35, context.customers.length)) : 50);
  const cashflowHealth = clamp(70 + (context.outstanding === 0 ? 30 : -Math.min(45, context.outstanding / Math.max(1, context.revenue) * 100)));
  const businessHealth = clamp((profit.margin > 0 ? 45 : 20) + inventoryHealth * 0.2 + cashflowHealth * 0.2);
  return { businessHealth, growth: clamp(profit.margin * 2 + (context.sales.length ? 40 : 15)), profit: clamp(50 + profit.margin * 2), risk: clamp(100 - businessHealth), aiConfidence: 72, customerHealth, inventoryHealth, cashflowHealth };
}

export function buildMissions(context: OperatingSystemContext, profit: ProfitSnapshot): GrowthMission[] {
  const overdue = context.invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date()).sort((a, b) => Number(b.balance) - Number(a.balance))[0];
  const low = context.products.filter((p) => Number(p.quantity) <= Number(p.reorder_level)).sort((a, b) => Number(a.quantity) - Number(b.quantity))[0];
  return [
    overdue ? { title: `Recover ${formatNGN(Number(overdue.balance))} from an overdue invoice`, reason: 'Cash recovery improves working capital.', target: Number(overdue.balance), completed: false } : { title: 'Review one debtor account', reason: 'Keep receivables visible and actionable.', completed: false },
    low ? { title: `Restock ${low.name}`, reason: 'Protect availability before a stockout.', completed: false } : { title: 'Check the top seller', reason: 'Protect the product creating the strongest demand signal.', completed: false },
    { title: 'Run one margin improvement experiment', reason: `Current modeled margin is ${profit.margin.toFixed(1)}%.`, target: 3, completed: false },
    { title: 'Record one measurable business outcome', reason: 'Outcomes let BizGuard compare prediction with reality.', completed: false },
  ];
}

export function getInitialEvolutionState(): EvolutionState { return { stage: 'OBSERVE', observationStatus: 'LIVE', learningStatus: 'READY', adaptationStatus: 'BALANCED', selfCorrectionStatus: 'STABLE', improvementStatus: 'READY', confidenceScore: 72, accuracyScore: 72, trustScore: 72, feedbackScore: 0, improvementScore: 50, helpful: 0, corrections: 0, streak: 0 }; }

export function applyFeedback(state: EvolutionState, feedback: FeedbackKind): EvolutionState {
  const positive = feedback === 'HELPFUL' || feedback === 'ACCURATE';
  const correction = feedback === 'NOT_HELPFUL' || feedback === 'INACCURATE';
  const helpful = state.helpful + (positive ? 1 : 0);
  const corrections = state.corrections + (correction ? 1 : 0);
  const feedbackScore = clamp(state.feedbackScore + (positive ? 8 : -5));
  return { ...state, stage: correction ? 'SELF-CORRECT' : 'LEARN', learningStatus: 'LEARNING', adaptationStatus: correction ? 'EVIDENCE_FIRST' : positive ? 'ACTION_ORIENTED' : 'BALANCED', selfCorrectionStatus: correction ? 'CHECKING' : 'STABLE', improvementStatus: 'IMPROVING', confidenceScore: clamp(state.confidenceScore + (positive ? 3 : -6)), accuracyScore: clamp(state.accuracyScore + (positive ? 2 : -7)), trustScore: clamp(state.trustScore + (positive ? 3 : -5)), feedbackScore, improvementScore: clamp(state.improvementScore + (positive ? 5 : 7)), helpful, corrections, streak: positive ? state.streak + 1 : 0, lastFeedback: feedback };
}

export async function saveEvolutionFeedback(businessId: string, userId: string, feedback: FeedbackKind, note?: string) {
  const key = `ai:evolution_feedback:${new Date().toISOString().slice(0, 10)}`;
  const { error } = await supabase.rpc('upsert_business_memory', { target_business_id: businessId, target_memory_key: key, target_memory_value: { feedback, note: note?.trim() || null, userId, recordedAt: new Date().toISOString() }, target_source: 'ai_evolution_feedback', target_confidence: 1 });
  if (error) throw error;
  return { key };
}

export async function loadEvolutionState(businessId: string): Promise<EvolutionState> {
  const base = getInitialEvolutionState();
  const { data } = await supabase.from('business_memory').select('memory_value').eq('business_id', businessId).eq('memory_key', 'ai:evolution_state').maybeSingle();
  if (!data?.memory_value || typeof data.memory_value !== 'object' || Array.isArray(data.memory_value)) return base;
  return { ...base, ...(data.memory_value as Partial<EvolutionState>) };
}

export async function persistEvolutionState(businessId: string, state: EvolutionState) {
  await supabase.rpc('upsert_business_memory', { target_business_id: businessId, target_memory_key: 'ai:evolution_state', target_memory_value: state, target_source: 'ai_evolution_engine', target_confidence: state.confidenceScore / 100 });
}

export async function loadEvolutionDashboard(businessId: string) {
  const context = await loadOperatingSystemContext(businessId);
  const profit = calculateLiveProfit(context);
  return { context, profit, briefing: buildDailyBriefing(context, profit), moves: getMoneyMoves(context, profit), scores: buildExecutiveScores(context, profit), missions: buildMissions(context, profit), state: await loadEvolutionState(businessId) };
}

export function buildCognitiveState(context: OperatingSystemContext, state: EvolutionState, profit: ProfitSnapshot): CognitiveState {
  return { awareness: `${context.sales.length} sales, ${context.products.length} products, ${context.customers.length} customers loaded.`, perception: 'Structured from live sales, inventory, debtor, payment and product-cost signals.', reasoning: `Profit is ${formatNGN(profit.profit)} at ${profit.margin.toFixed(1)}% modeled margin.`, memory: state.lastFeedback ? `Latest feedback: ${state.lastFeedback}.` : 'No feedback recorded in the current visible cycle.', intention: profit.margin < 15 ? 'PROFIT_GROWTH' : context.outstanding > 0 ? 'DEBT_RECOVERY' : 'INVENTORY_PROTECTION', confidence: state.confidenceScore, selfCheck: state.corrections ? `${state.corrections} correction signal(s) have moved the engine toward evidence-first reasoning.` : 'No correction signal recorded yet.' };
}

export function formatNGN(value: number) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }

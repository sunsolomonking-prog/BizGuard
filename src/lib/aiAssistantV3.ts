import { supabase } from './supabase';
import type { Database, Json } from './database.types';

type AIConversationRow = Database['public']['Tables']['ai_conversations']['Row'];
type BusinessMemoryRow = Database['public']['Tables']['business_memory']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

export type AIAgentMode = 'guardian' | 'cfo' | 'coo' | 'credit_controller' | 'sales_director' | 'inventory_strategist' | 'business_doctor';
export type AIConversationCategory = 'general' | 'cfo' | 'coo' | 'credit' | 'sales' | 'inventory' | 'guardian' | 'voice';

export interface AIMessageV3 {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AIAgentMode;
}

export interface BusinessAIContext {
  sales: SaleRow[];
  products: ProductRow[];
  customers: CustomerRow[];
  invoices: InvoiceRow[];
  saleItems: SaleItemRow[];
  payments: PaymentRow[];
  memories: BusinessMemoryRow[];
}

export interface AgentResponse {
  title: string;
  summary: string;
  recommendations: string[];
  metrics: Record<string, number | string>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export const parseMessages = (messages: Json): AIMessageV3[] => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
      const record = message as Record<string, unknown>;
      return typeof record.id === 'string' && (record.role === 'user' || record.role === 'assistant') && typeof record.content === 'string' && typeof record.timestamp === 'string';
    })
    .map((message) => message as unknown as AIMessageV3);
};

export const messagesToJson = (messages: AIMessageV3[]): Json => messages as unknown as Json;

export const loadAIConversations = async (businessId: string, includeArchived = false) => {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('business_id', businessId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (!includeArchived) query = query.eq('is_archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AIConversationRow[];
};

export const createAIConversation = async (businessId: string, userId: string, category: AIConversationCategory = 'general') => {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ business_id: businessId, user_id: userId, title: 'New Chat', category, messages: [], memory: {} })
    .select('*')
    .single();
  if (error) throw error;
  return data as AIConversationRow;
};

export const updateAIConversation = async (conversationId: string, updates: Database['public']['Tables']['ai_conversations']['Update']) => {
  const { data, error } = await supabase
    .from('ai_conversations')
    .update({ ...updates, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*')
    .single();
  if (error) throw error;
  return data as AIConversationRow;
};

export const loadBusinessAIContext = async (businessId: string): Promise<BusinessAIContext> => {
  const since = new Date();
  since.setDate(since.getDate() - 120);
  const [salesResult, productsResult, customersResult, invoicesResult, paymentsResult, memoryResult] = await Promise.all([
    supabase.from('sales').select('*').eq('business_id', businessId).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(500),
    supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true).limit(500),
    supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).limit(500),
    supabase.from('invoices').select('*').eq('business_id', businessId).limit(500),
    supabase.from('payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(500),
    supabase.from('business_memory').select('*').eq('business_id', businessId).eq('is_active', true).limit(100),
  ]);
  const firstError = salesResult.error || productsResult.error || customersResult.error || invoicesResult.error || paymentsResult.error;
  if (firstError) throw firstError;
  const sales = salesResult.data || [];
  const saleIds = sales.map((sale) => sale.id);
  const saleItemsResult = saleIds.length ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
  if (saleItemsResult.error) throw saleItemsResult.error;
  return {
    sales,
    products: productsResult.data || [],
    customers: customersResult.data || [],
    invoices: invoicesResult.data || [],
    payments: paymentsResult.data || [],
    saleItems: (saleItemsResult.data || []) as SaleItemRow[],
    memories: (memoryResult.data || []) as BusinessMemoryRow[],
  };
};

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export const generateBusinessMemory = async (businessId: string, context: BusinessAIContext, businessProfile: { name?: string; industry?: string; type?: string }) => {
  const revenue = context.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const topProductMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  context.saleItems.forEach((item) => {
    const current = topProductMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.total);
    topProductMap.set(item.product_id, current);
  });
  const topProducts = Array.from(topProductMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const slowMovingProducts = context.products.filter((product) => product.quantity > product.reorder_level * 3).slice(0, 8).map((product) => product.name);
  const topCustomers = [...context.customers].sort((a, b) => Number(b.total_purchases) - Number(a.total_purchases)).slice(0, 5).map((customer) => ({ name: customer.name, revenue: Number(customer.total_purchases) }));
  const frequentDebtors = [...context.customers].filter((customer) => Number(customer.current_balance) > 0).sort((a, b) => Number(b.current_balance) - Number(a.current_balance)).slice(0, 5).map((customer) => ({ name: customer.name, balance: Number(customer.current_balance) }));
  const memoryValue = { businessProfile, revenue, topProducts, slowMovingProducts, topCustomers, frequentDebtors, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase.rpc('upsert_business_memory', {
    target_business_id: businessId,
    target_memory_key: 'business_operating_context',
    target_memory_value: memoryValue as Json,
    target_source: 'ai_assistant',
    target_confidence: 88,
  });
  if (error) throw error;
  return data as BusinessMemoryRow;
};

export const generateAgentResponse = (mode: AIAgentMode, question: string, context: BusinessAIContext): AgentResponse => {
  const revenue = context.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const tax = context.sales.reduce((sum, sale) => sum + Number(sale.tax), 0);
  const discounts = context.sales.reduce((sum, sale) => sum + Number(sale.discount), 0);
  const inventoryCost = context.products.reduce((sum, product) => sum + Number(product.cost_price) * product.quantity, 0);
  const inventoryRetail = context.products.reduce((sum, product) => sum + Number(product.selling_price) * product.quantity, 0);
  const outstanding = context.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdue = context.invoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date());
  const lowStock = context.products.filter((product) => product.quantity <= product.reorder_level);
  const overstock = context.products.filter((product) => product.quantity > product.reorder_level * 4);
  const deadStock = context.products.filter((product) => product.quantity > 0 && product.quantity > product.reorder_level * 6);
  const topProductMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  context.saleItems.forEach((item) => {
    const current = topProductMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.total);
    topProductMap.set(item.product_id, current);
  });
  const topProducts = Array.from(topProductMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const highDebtCustomers = [...context.customers].filter((customer) => Number(customer.current_balance) > 0).sort((a, b) => Number(b.current_balance) - Number(a.current_balance)).slice(0, 5);
  const inactiveCustomers = context.customers.filter((customer) => !customer.last_purchase_date || new Date(customer.last_purchase_date) < new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));
  const grossSignal = revenue - discounts;

  if (mode === 'cfo') {
    return {
      title: 'AI CFO Financial Briefing',
      summary: `Revenue signal is ${money(revenue)} with ${money(outstanding)} receivables and ${money(inventoryCost)} inventory cost value.`,
      recommendations: [
        topProducts[0] ? `Protect margin on ${topProducts[0].name}; it is the strongest revenue product.` : 'Record more sales to identify revenue leaders.',
        outstanding > 0 ? `Prioritize collection of ${money(outstanding)} to improve cashflow.` : 'Receivables are currently controlled.',
        inventoryCost > revenue && revenue > 0 ? 'Review stock purchasing because inventory cost value is high relative to recent revenue.' : 'Maintain disciplined stock purchases tied to demand.',
        tax > 0 ? `Set aside ${money(tax)} for tax obligations.` : 'Configure tax on sales to strengthen tax reporting.',
      ],
      metrics: { revenue: money(revenue), discounts: money(discounts), grossSignal: money(grossSignal), receivables: money(outstanding), inventoryCost: money(inventoryCost) },
      priority: outstanding > revenue && revenue > 0 ? 'high' : 'medium',
    };
  }

  if (mode === 'coo') {
    return {
      title: 'AI COO Operations Briefing',
      summary: `${lowStock.length} products need stock attention, ${overstock.length} may be overstocked, and ${context.sales.length} recent sales are available for workflow analysis.`,
      recommendations: [
        lowStock.length ? `Restock ${lowStock.slice(0, 5).map((p) => p.name).join(', ')}.` : 'No urgent low-stock operational bottleneck detected.',
        overstock.length ? `Review promotions or bundles for ${overstock.slice(0, 5).map((p) => p.name).join(', ')}.` : 'Overstock risk is currently limited.',
        'Run daily closeout: reconcile cash, sales, debtor payments and low stock alerts.',
      ],
      metrics: { lowStock: lowStock.length, overstock: overstock.length, sales: context.sales.length, products: context.products.length },
      priority: lowStock.length > 0 ? 'high' : 'medium',
    };
  }

  if (mode === 'credit_controller') {
    return {
      title: 'AI Credit Controller Briefing',
      summary: `${highDebtCustomers.length} customers have outstanding balances and ${overdue.length} invoices are overdue.`,
      recommendations: [
        ...highDebtCustomers.slice(0, 3).map((customer) => `Call ${customer.name}; outstanding balance is ${money(Number(customer.current_balance))}.`),
        overdue.length ? 'Escalate invoices older than due date and record collection notes.' : 'No overdue invoices detected from current data.',
        'Offer structured part-payment plans for high-value debtors with good payment history.',
      ],
      metrics: { receivables: money(outstanding), overdueInvoices: overdue.length, highDebtCustomers: highDebtCustomers.length },
      priority: overdue.length > 0 ? 'urgent' : outstanding > 0 ? 'high' : 'low',
    };
  }

  if (mode === 'sales_director') {
    return {
      title: 'AI Sales Director Strategy',
      summary: `${topProducts.length} top-selling product signals and ${inactiveCustomers.length} re-engagement opportunities found.`,
      recommendations: [
        topProducts[0] ? `Upsell around ${topProducts[0].name}; it leads revenue.` : 'Record more sales to unlock upsell recommendations.',
        topProducts.length >= 2 ? `Bundle ${topProducts.slice(0, 2).map((p) => p.name).join(' + ')} for cross-sell.` : 'Build product bundles when more sales history is available.',
        inactiveCustomers.length ? `Launch win-back outreach to ${inactiveCustomers.slice(0, 5).map((c) => c.name).join(', ')}.` : 'Customer activity is healthy from current data.',
      ],
      metrics: { revenue: money(revenue), topProducts: topProducts.length, inactiveCustomers: inactiveCustomers.length },
      priority: inactiveCustomers.length > 0 ? 'medium' : 'low',
    };
  }

  if (mode === 'inventory_strategist') {
    return {
      title: 'AI Inventory Strategist Plan',
      summary: `${lowStock.length} reorder opportunities, ${overstock.length} overstock warnings and ${deadStock.length} dead-stock risks were detected.`,
      recommendations: [
        lowStock.length ? `Reorder now: ${lowStock.slice(0, 6).map((p) => `${p.name} (${Math.max(p.reorder_level * 2 - p.quantity, p.reorder_level)})`).join(', ')}.` : 'No immediate reorder detected.',
        overstock.length ? `Promote or discount overstock: ${overstock.slice(0, 5).map((p) => p.name).join(', ')}.` : 'Overstock levels are controlled.',
        deadStock.length ? `Investigate dead stock: ${deadStock.slice(0, 5).map((p) => p.name).join(', ')}.` : 'No major dead-stock signal detected.',
      ],
      metrics: { lowStock: lowStock.length, overstock: overstock.length, deadStock: deadStock.length, retailValue: money(inventoryRetail) },
      priority: lowStock.length ? 'high' : overstock.length ? 'medium' : 'low',
    };
  }

  if (mode === 'business_doctor') {
    const issues = [outstanding > 0 ? 'cash tied in debtors' : null, lowStock.length ? 'stockout risk' : null, revenue <= 0 ? 'low/no recorded revenue' : null, inactiveCustomers.length ? 'customer inactivity' : null].filter(Boolean);
    return {
      title: 'AI Business Doctor Diagnosis',
      summary: issues.length ? `Diagnosis found: ${issues.join(', ')}.` : 'No critical business illness detected from current data.',
      recommendations: issues.length ? ['Treat cashflow first, then inventory availability, then customer reactivation.', 'Review this diagnosis weekly after recording fresh sales and payments.'] : ['Continue recording transactions daily and monitor weekly trends.'],
      metrics: { issues: issues.length, healthSignal: issues.length ? 'Needs attention' : 'Stable' },
      priority: issues.length >= 3 ? 'urgent' : issues.length ? 'high' : 'low',
    };
  }

  return {
    title: 'AI Business Guardian Response',
    summary: `I reviewed your live business context for: "${question}".`,
    recommendations: [
      lowStock.length ? `Restock ${lowStock.length} low-stock products.` : 'Inventory is stable from current data.',
      outstanding > 0 ? `Collect ${money(outstanding)} outstanding receivables.` : 'Receivables are controlled.',
      topProducts[0] ? `Protect and promote ${topProducts[0].name}.` : 'Record more sales to identify best sellers.',
    ],
    metrics: { revenue: money(revenue), customers: context.customers.length, products: context.products.length, invoices: context.invoices.length },
    priority: lowStock.length || outstanding > 0 ? 'medium' : 'low',
  };
};

export const agentModeLabel = (mode: AIAgentMode) => {
  const labels: Record<AIAgentMode, string> = {
    guardian: 'Business Guardian',
    cfo: 'AI CFO',
    coo: 'AI COO',
    credit_controller: 'AI Credit Controller',
    sales_director: 'AI Sales Director',
    inventory_strategist: 'AI Inventory Strategist',
    business_doctor: 'AI Business Doctor',
  };
  return labels[mode];
};

import type { Database } from './database.types';

type Customer = Database['public']['Tables']['customers']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type SaleItem = Database['public']['Tables']['sale_items']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export type PatronageClass = 'VIP Customer' | 'Loyal Customer' | 'Frequent Buyer' | 'Regular Customer' | 'Occasional Customer' | 'At Risk Customer' | 'Lost Customer';
export type CustomerHealth = 'Excellent' | 'Good' | 'Warning' | 'Critical';
export type LoyaltyLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type CustomerRisk = 'Low' | 'Medium' | 'High' | 'Critical';

export interface CustomerIntelligence {
  customer: Customer;
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
  saleItems: SaleItem[];
  lifetimeValue: number;
  projectedValue: number;
  transactionCount: number;
  averageOrderValue: number;
  purchaseFrequency: number;
  daysSinceLastPurchase: number | null;
  paymentReliability: number;
  debtBehaviour: number;
  productDiversity: number;
  patronageScore: number;
  patronageClass: PatronageClass;
  healthScore: number;
  health: CustomerHealth;
  loyaltyLevel: LoyaltyLevel;
  riskScore: number;
  risk: CustomerRisk;
  tags: string[];
  preferredPaymentMethod: string;
  preferredPurchaseDay: string;
  preferredPurchaseTime: string;
  averageBasketSize: number;
  mostPurchasedProducts: Array<{ productName: string; quantity: number; revenue: number }>;
  recommendations: string[];
  aiInsights: string[];
  timeline: Array<{ date: string; type: string; title: string; description: string; amount?: number }>;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const daysBetween = (date: string | null | undefined) => {
  if (!date) return null;
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / MS_PER_DAY));
};

const classifyPatronage = (score: number, daysSinceLastPurchase: number | null): PatronageClass => {
  if (daysSinceLastPurchase !== null && daysSinceLastPurchase >= 180) return 'Lost Customer';
  if (daysSinceLastPurchase !== null && daysSinceLastPurchase >= 90) return 'At Risk Customer';
  if (score >= 85) return 'VIP Customer';
  if (score >= 72) return 'Loyal Customer';
  if (score >= 62) return 'Frequent Buyer';
  if (score >= 45) return 'Regular Customer';
  return 'Occasional Customer';
};

const classifyHealth = (score: number): CustomerHealth => {
  if (score >= 80) return 'Excellent';
  if (score >= 62) return 'Good';
  if (score >= 40) return 'Warning';
  return 'Critical';
};

const classifyRisk = (score: number): CustomerRisk => {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
};

const classifyLoyalty = (lifetimeValue: number, transactionCount: number, patronageScore: number): LoyaltyLevel => {
  if (lifetimeValue >= 1_000_000 || patronageScore >= 90) return 'Diamond';
  if (lifetimeValue >= 500_000 || (transactionCount >= 20 && patronageScore >= 75)) return 'Platinum';
  if (lifetimeValue >= 250_000 || transactionCount >= 12) return 'Gold';
  if (lifetimeValue >= 100_000 || transactionCount >= 6) return 'Silver';
  return 'Bronze';
};

const preferred = (values: string[]) => {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not enough data';
};

const dayName = (date: string) => new Date(date).toLocaleDateString(undefined, { weekday: 'long' });
const timeBucket = (date: string) => {
  const hour = new Date(date).getHours();
  if (hour < 11) return 'Morning';
  if (hour < 16) return 'Afternoon';
  if (hour < 20) return 'Evening';
  return 'Night';
};

export const buildCustomerIntelligence = (params: {
  customers: Customer[];
  sales: Sale[];
  saleItems: SaleItem[];
  invoices: Invoice[];
  payments: Payment[];
  products: Product[];
}): CustomerIntelligence[] => {
  const productById = new Map(params.products.map((product) => [product.id, product]));

  return params.customers.map((customer) => {
    const customerSales = params.sales.filter((sale) => sale.customer_id === customer.id);
    const customerInvoices = params.invoices.filter((invoice) => invoice.customer_id === customer.id);
    const customerPayments = params.payments.filter((payment) => payment.customer_id === customer.id);
    const saleIds = new Set(customerSales.map((sale) => sale.id));
    const customerSaleItems = params.saleItems.filter((item) => saleIds.has(item.sale_id));

    const lifetimeValue = customerSales.reduce((sum, sale) => sum + Number(sale.total), 0) || Number(customer.total_purchases || 0);
    const transactionCount = customerSales.length;
    const averageOrderValue = transactionCount > 0 ? lifetimeValue / transactionCount : 0;
    const firstPurchaseAt = customerSales.length ? customerSales.map((sale) => new Date(sale.created_at).getTime()).sort((a, b) => a - b)[0] : null;
    const activeDays = firstPurchaseAt ? Math.max(1, Math.ceil((Date.now() - firstPurchaseAt) / MS_PER_DAY)) : 0;
    const purchaseFrequency = activeDays > 0 ? transactionCount / Math.max(1, activeDays / 30) : 0;
    const daysSinceLastPurchase = daysBetween(customer.last_purchase_date || customerSales[0]?.created_at);

    const totalInvoiceValue = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const outstandingDebt = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0) || Number(customer.current_balance || 0);
    const overdueInvoices = customerInvoices.filter((invoice) => Number(invoice.balance) > 0 && new Date(invoice.due_date) < new Date());
    const paidInvoices = customerInvoices.filter((invoice) => Number(invoice.balance) <= 0 || invoice.status === 'paid');

    const paymentReliability = customerInvoices.length > 0 ? (paidInvoices.length / customerInvoices.length) * 100 - Math.min(overdueInvoices.length * 12, 45) : 75;
    const debtBehaviour = outstandingDebt <= 0 ? 100 : totalInvoiceValue > 0 ? 100 - Math.min(80, (outstandingDebt / totalInvoiceValue) * 100) : 40;
    const productDiversity = new Set(customerSaleItems.map((item) => item.product_id)).size;
    const diversityScore = clamp(productDiversity * 12, 0, 100);
    const recencyScore = daysSinceLastPurchase === null ? 35 : daysSinceLastPurchase <= 7 ? 100 : daysSinceLastPurchase <= 30 ? 80 : daysSinceLastPurchase <= 60 ? 55 : daysSinceLastPurchase <= 90 ? 35 : 15;
    const frequencyScore = clamp(purchaseFrequency * 28, 0, 100);
    const valueScore = clamp(lifetimeValue / 10000, 0, 100);

    const patronageScore = clamp((frequencyScore * 0.2) + (valueScore * 0.25) + (recencyScore * 0.2) + (paymentReliability * 0.15) + (debtBehaviour * 0.1) + (diversityScore * 0.1));
    const patronageClass = classifyPatronage(patronageScore, daysSinceLastPurchase);
    const healthScore = clamp((valueScore * 0.25) + (frequencyScore * 0.2) + (paymentReliability * 0.25) + (debtBehaviour * 0.2) + (recencyScore * 0.1));
    const health = classifyHealth(healthScore);
    const riskScore = clamp((100 - recencyScore) * 0.35 + (100 - paymentReliability) * 0.3 + (100 - debtBehaviour) * 0.25 + (transactionCount === 0 ? 10 : 0));
    const risk = classifyRisk(riskScore);
    const projectedValue = Math.round(lifetimeValue + (averageOrderValue * Math.max(1, purchaseFrequency) * 6));
    const loyaltyLevel = classifyLoyalty(lifetimeValue, transactionCount, patronageScore);

    const productsMap = new Map<string, { productName: string; quantity: number; revenue: number }>();
    customerSaleItems.forEach((item) => {
      const product = productById.get(item.product_id);
      const key = item.product_id;
      const existing = productsMap.get(key) || { productName: product?.name || item.product_name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.total);
      productsMap.set(key, existing);
    });
    const mostPurchasedProducts = Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const preferredPaymentMethod = preferred(customerSales.map((sale) => sale.payment_method));
    const preferredPurchaseDay = preferred(customerSales.map((sale) => dayName(sale.created_at)));
    const preferredPurchaseTime = preferred(customerSales.map((sale) => timeBucket(sale.created_at)));
    const averageBasketSize = customerSales.length > 0 ? customerSaleItems.reduce((sum, item) => sum + item.quantity, 0) / customerSales.length : 0;

    const tags = [
      patronageClass === 'VIP Customer' ? 'VIP' : null,
      lifetimeValue >= 250000 ? 'High Spender' : null,
      purchaseFrequency >= 2 ? 'Frequent Buyer' : null,
      transactionCount > 1 ? 'Returning Customer' : null,
      outstandingDebt > 0 ? 'Debt Risk' : null,
      patronageScore >= 72 ? 'Loyal Customer' : null,
      daysSinceLastPurchase !== null && daysSinceLastPurchase >= 60 ? 'Inactive Customer' : null,
      patronageClass === 'At Risk Customer' ? 'At Risk' : null,
      patronageClass === 'Lost Customer' ? 'Lost Customer' : null,
    ].filter(Boolean) as string[];

    const recommendations = [
      daysSinceLastPurchase !== null && daysSinceLastPurchase >= 30 ? `Contact ${customer.name}. Last purchase was ${daysSinceLastPurchase} days ago.` : null,
      outstandingDebt > 0 ? `Follow up outstanding balance of ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(outstandingDebt)}.` : null,
      patronageScore >= 80 ? 'Reward this customer with a loyalty benefit or early access offer.' : null,
      mostPurchasedProducts.length >= 2 ? `Bundle ${mostPurchasedProducts.slice(0, 2).map((p) => p.productName).join(' and ')} for cross-sell.` : null,
      riskScore >= 60 ? 'Add this customer to today’s call list for recovery action.' : null,
    ].filter(Boolean) as string[];

    const aiInsights = [
      `${customer.name} generated ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(lifetimeValue)} lifetime revenue.`,
      riskScore >= 60 ? `${customer.name} may stop buying soon.` : `${customer.name} currently shows ${health.toLowerCase()} relationship health.`,
      loyaltyLevel !== 'Bronze' ? `${customer.name} qualifies for ${loyaltyLevel} loyalty rewards.` : `${customer.name} can be nurtured toward Silver loyalty status.`,
      mostPurchasedProducts.length > 0 ? `${customer.name} frequently buys ${mostPurchasedProducts.map((p) => p.productName).slice(0, 3).join(', ')}.` : 'More purchase data is needed for product affinity insights.',
    ];

    const timeline = [
      { date: customer.created_at, type: 'customer_created', title: 'Customer Added', description: `${customer.name} was added to the CRM.` },
      ...customerSales.map((sale) => ({ date: sale.created_at, type: 'purchase', title: `Purchase ${sale.invoice_number}`, description: `${customer.name} purchased ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(sale.total))}.`, amount: Number(sale.total) })),
      ...customerInvoices.map((invoice) => ({ date: invoice.created_at, type: 'invoice', title: `Invoice ${invoice.invoice_number}`, description: `Balance: ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(invoice.balance))}.`, amount: Number(invoice.total) })),
      ...customerPayments.map((payment) => ({ date: payment.created_at, type: 'payment', title: 'Payment Received', description: `${payment.method} payment recorded.`, amount: Number(payment.amount) })),
      ...recommendations.slice(0, 2).map((recommendation, index) => ({ date: new Date().toISOString(), type: 'ai_recommendation', title: `AI Recommendation ${index + 1}`, description: recommendation })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      customer,
      sales: customerSales,
      invoices: customerInvoices,
      payments: customerPayments,
      saleItems: customerSaleItems,
      lifetimeValue,
      projectedValue,
      transactionCount,
      averageOrderValue,
      purchaseFrequency,
      daysSinceLastPurchase,
      paymentReliability: clamp(paymentReliability),
      debtBehaviour: clamp(debtBehaviour),
      productDiversity,
      patronageScore,
      patronageClass,
      healthScore,
      health,
      loyaltyLevel,
      riskScore,
      risk,
      tags,
      preferredPaymentMethod,
      preferredPurchaseDay,
      preferredPurchaseTime,
      averageBasketSize,
      mostPurchasedProducts,
      recommendations,
      aiInsights,
      timeline,
    };
  }).sort((a, b) => b.patronageScore - a.patronageScore);
};

export const buildGuardianAnswers = (customers: CustomerIntelligence[]) => {
  const bestCustomer = customers[0];
  const dormant = customers.filter((customer) => (customer.daysSinceLastPurchase || 0) >= 30).sort((a, b) => (b.daysSinceLastPurchase || 0) - (a.daysSinceLastPurchase || 0));
  const topDebtor = [...customers].sort((a, b) => Number(b.customer.current_balance) - Number(a.customer.current_balance))[0];
  const likelyToLeave = [...customers].sort((a, b) => b.riskScore - a.riskScore)[0];
  const reward = customers.find((customer) => customer.loyaltyLevel === 'Diamond' || customer.loyaltyLevel === 'Platinum') || bestCustomer;
  return {
    bestCustomer,
    dormant,
    topDebtor,
    likelyToLeave,
    reward,
    callToday: customers.filter((customer) => customer.riskScore >= 55 || Number(customer.customer.current_balance) > 0).slice(0, 10),
  };
};

export const exportCustomerLedgerCsv = (customer: CustomerIntelligence) => {
  const headers = ['Date', 'Type', 'Title', 'Description', 'Amount'];
  const rows = customer.timeline.map((entry) => [entry.date, entry.type, entry.title, entry.description, entry.amount ?? '']);
  return [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
};

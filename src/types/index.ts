// BizGuard Core Types

export interface User {
  id: string;
  email: string;
  name: string;
  businessId: string | null;
  role: 'super_admin' | 'business_owner' | 'owner' | 'manager' | 'staff' | 'viewer';
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  industry: string;
  location: string;
  currency: string;
  timezone: string;
  createdAt: string;
  settings: BusinessSettings;
}

export type BusinessType = 'retail' | 'wholesale' | 'pharmacy' | 'restaurant' | 'school' | 'church' | 'service' | 'other';

export interface BusinessSettings {
  fiscalYearStart: string;
  taxRate: number;
  lowStockThreshold: number;
  enableDebtors: boolean;
  enableAI: boolean;
}

// Phase 1: Sales
export interface Sale {
  id: string;
  businessId: string;
  customerId?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
  status: 'completed' | 'pending' | 'refunded';
  createdAt: string;
  createdBy: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

// Phase 1: Inventory
export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  supplier?: string;
  barcode?: string;
  images?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  parentId?: string;
  color?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  reason: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
}

// Phase 1: Debtors
export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId: string;
  invoiceNumber: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: 'paid' | 'partial' | 'overdue' | 'cancelled';
  createdAt: string;
}

export interface Payment {
  id: string;
  businessId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  method: 'cash' | 'card' | 'mobile' | 'bank_transfer';
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

// Phase 2: Risk Score
export interface RiskScore {
  businessId: string;
  overallScore: number;
  categories: {
    financial: number;
    inventory: number;
    sales: number;
    customers: number;
  };
  factors: RiskFactor[];
  lastUpdated: string;
}

export interface RiskFactor {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  impact: number;
}

// Phase 2: Action Cards
export interface ActionCard {
  id: string;
  type: 'urgent' | 'important' | 'routine' | 'opportunity';
  title: string;
  description: string;
  priority: number;
  completed: boolean;
  dueDate?: string;
  relatedEntity?: {
    type: 'sale' | 'product' | 'customer' | 'invoice';
    id: string;
  };
  createdAt: string;
}

// Phase 2: Smart Alerts
export interface Alert {
  id: string;
  businessId: string;
  type: 'low_stock' | 'overdue_payment' | 'sales_target' | 'anomaly' | 'reminder';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

// Phase 3: Demand Prediction
export interface DemandPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  recommendedOrder: number;
  confidence: number;
  lastUpdated: string;
}

// Phase 3: Smart Restock
export interface RestockRecommendation {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  recommendedQuantity: number;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  supplier?: string;
  reason: string;
  createdAt: string;
}

// Dashboard Types
export interface DashboardMetrics {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  overdueInvoices: number;
  salesGrowth: number;
  topProducts: Product[];
  recentSales: Sale[];
  salesByCategory: { category: string; value: number }[];
  dailySales: { date: string; value: number }[];
}

export interface AIAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
}

// Phase 5: Multi-Business
export interface BusinessSubscription {
  id: string;
  businessId: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  startDate: string;
  endDate?: string;
  features: string[];
}


// Phase 14: Subscription + Voice AI
export type SubscriptionPlanCode = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

export interface VoiceUsageSummary {
  planCode: SubscriptionPlanCode;
  planName: string;
  usedToday: number;
  remainingToday: number | null;
  dailyLimit: number | null;
  isUnlimited: boolean;
  resetAt: string;
}

export interface BusinessSubscriptionState {
  businessId: string;
  planCode: SubscriptionPlanCode;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodEndsAt?: string;
}

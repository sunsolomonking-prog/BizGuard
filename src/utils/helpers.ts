import { format, formatDistanceToNow, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Currency formatting
export const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
  const currencies: Record<string, { symbol: string; locale: string }> = {
    NGN: { symbol: '₦', locale: 'en-NG' },
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    KES: { symbol: 'KSh', locale: 'en-KE' },
    GHS: { symbol: '₵', locale: 'en-GH' },
    ZAR: { symbol: 'R', locale: 'en-ZA' },
  };

  const config = currencies[currency] || { symbol: currency, locale: 'en-US' };
  return `${config.symbol}${amount.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Date formatting
export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
};

export const formatRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
};

// Date ranges
export const getDateRange = (range: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: endOfDay(new Date(now.getFullYear(), 11, 31)) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

// Number formatting
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Calculate percentage change
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Generate unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Generate invoice number
export const generateInvoiceNumber = (prefix: string = 'INV'): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}${month}-${random}`;
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone (African formats)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Truncate text
export const truncate = (text: string, length: number): string => {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
};

// Get initials from name
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Status colors
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    success: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    partial: 'bg-yellow-100 text-yellow-800',
    warning: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    overdue: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

// Severity colors
export const getSeverityColor = (severity: string): string => {
  const colors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800',
    info: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    warning: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
  };
  return colors[severity.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

// Action card type colors
export const getActionCardColor = (type: string): string => {
  const colors: Record<string, string> = {
    urgent: 'border-l-red-500 bg-red-50',
    important: 'border-l-orange-500 bg-orange-50',
    routine: 'border-l-blue-500 bg-blue-50',
    opportunity: 'border-l-green-500 bg-green-50',
  };
  return colors[type.toLowerCase()] || 'border-l-gray-500 bg-gray-50';
};

// Risk score color
export const getRiskScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

// Risk score label
export const getRiskScoreLabel = (score: number): string => {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Local storage helpers
export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
};

export default {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getDateRange,
  formatNumber,
  calculatePercentageChange,
  generateId,
  generateInvoiceNumber,
  isValidEmail,
  isValidPhone,
  truncate,
  getInitials,
  getStatusColor,
  getSeverityColor,
  getActionCardColor,
  getRiskScoreColor,
  getRiskScoreLabel,
  debounce,
  storage,
};

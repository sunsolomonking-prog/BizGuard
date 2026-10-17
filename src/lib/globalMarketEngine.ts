/**
 * BizGuard Global Market engine (preview foundation).
 * Rates entered here are user-supplied estimates, not live provider quotes.
 * This module never mutates existing transactions or business currency settings.
 */
export const GLOBAL_MARKET_CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira' }, { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British Pound' },
  { code: 'NOK', name: 'Norwegian Krone' }, { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' }, { code: 'INR', name: 'Indian Rupee' },
  { code: 'KES', name: 'Kenyan Shilling' }, { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'ZAR', name: 'South African Rand' }, { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' }, { code: 'CHF', name: 'Swiss Franc' },
  { code: 'AED', name: 'UAE Dirham' }, { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'XOF', name: 'West African CFA Franc' }, { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'BRL', name: 'Brazilian Real' }, { code: 'MXN', name: 'Mexican Peso' },
  { code: 'SGD', name: 'Singapore Dollar' }, { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' }, { code: 'SEK', name: 'Swedish Krona' },
  { code: 'DKK', name: 'Danish Krone' }, { code: 'PLN', name: 'Polish Zloty' },
  { code: 'TRY', name: 'Turkish Lira' }, { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' }, { code: 'RWF', name: 'Rwandan Franc' },
] as const;

export type GlobalMarketCurrency = (typeof GLOBAL_MARKET_CURRENCIES)[number]['code'];

export interface ManualFxRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  quotePerBase: number;
  source: string;
  effectiveAt: string;
  createdAt: string;
}

export const getCurrencyDigits = (currency: string): number => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

export const roundCurrency = (amount: number, currency: string): number => {
  if (!Number.isFinite(amount)) throw new Error('Amount must be a finite number.');
  const digits = getCurrencyDigits(currency);
  const factor = 10 ** digits;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
};

export const formatGlobalCurrency = (amount: number, currency: string, locale = 'en'): string => {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: getCurrencyDigits(currency) }).format(amount);
  } catch {
    return `${roundCurrency(amount, currency).toLocaleString(locale)} ${currency}`;
  }
};

export const validateManualFxRate = (rate: Omit<ManualFxRate, 'id' | 'createdAt'>): string | null => {
  if (!/^[A-Z]{3}$/.test(rate.baseCurrency) || !/^[A-Z]{3}$/.test(rate.quoteCurrency)) return 'Choose valid three-letter currency codes.';
  if (rate.baseCurrency === rate.quoteCurrency) return 'Base and quote currencies must be different.';
  if (!Number.isFinite(rate.quotePerBase) || rate.quotePerBase <= 0) return 'Exchange rate must be a positive finite number.';
  if (!rate.source.trim()) return 'Record the rate source so this conversion is auditable.';
  if (!rate.effectiveAt || !Number.isFinite(new Date(rate.effectiveAt).getTime())) return 'Provide a valid rate effective date and time.';
  return null;
};

export const convertWithManualRate = (amount: number, rate: ManualFxRate): number => {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a non-negative finite number.');
  if (!Number.isFinite(rate.quotePerBase) || rate.quotePerBase <= 0) throw new Error('A valid positive exchange rate is required.');
  return roundCurrency(amount * rate.quotePerBase, rate.quoteCurrency);
};

export const getRateFreshness = (effectiveAt: string): 'fresh' | 'stale' | 'future' => {
  const timestamp = new Date(effectiveAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 5 * 60_000) return 'future';
  return Date.now() - timestamp > 24 * 60 * 60_000 ? 'stale' : 'fresh';
};

export const buildCurrencyInsight = (input: {
  revenue: number; cost: number; currency: string; fxRate?: number | null;
}): { margin: number; marginPercent: number; message: string; severity: 'positive' | 'warning' | 'critical' } => {
  const revenue = Number(input.revenue);
  const cost = Number(input.cost);
  if (![revenue, cost].every(Number.isFinite) || revenue < 0 || cost < 0) {
    throw new Error('Revenue and cost must be non-negative numbers.');
  }
  const profit = roundCurrency(revenue - cost, input.currency);
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  if (revenue === 0) return { margin: profit, marginPercent, message: 'Enter revenue to calculate a meaningful margin.', severity: 'warning' };
  if (profit < 0) return { margin: profit, marginPercent, message: 'Cost exceeds revenue in the selected currency. Verify the source amounts and currency assumptions.', severity: 'critical' };
  if (marginPercent < 10) return { margin: profit, marginPercent, message: 'Margin is below 10%. Review supplier costs, FX assumptions, and discounts before changing prices.', severity: 'warning' };
  return { margin: profit, marginPercent, message: 'Positive margin based on the values entered. Confirm the FX rate and all source amounts before acting.', severity: 'positive' };
};

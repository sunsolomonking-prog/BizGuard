/**
 * BizGuard global formatting foundation.
 *
 * Additive, side-effect-free helpers. These utilities do not change existing
 * transaction values, business records, routes, or application defaults.
 * Integrate them into screens only after the relevant workflows are audited.
 */

export const BIZGUARD_SUPPORTED_LOCALES = [
  'en',
  'fr',
  'pt',
  'es',
  'ar',
] as const;

export type BizGuardLocale = (typeof BIZGUARD_SUPPORTED_LOCALES)[number];

export interface GlobalMarketPreferences {
  /** ISO 3166-1 alpha-2 country code, when explicitly selected by the user. */
  countryCode?: string;
  /** Supported language preference; defaults to English as a fallback. */
  locale: BizGuardLocale;
  /** IANA timezone, e.g. Europe/Oslo. Optional until selected/verified. */
  timezone?: string;
  /** ISO 4217 currency code for display/reporting preference, not transaction settlement. */
  reportingCurrency?: string;
}

export const DEFAULT_BIZGUARD_LOCALE: BizGuardLocale = 'en';
const PREFERENCES_KEY = 'bizguard.global-market-preferences.v1';

const isSupportedLocale = (value: unknown): value is BizGuardLocale =>
  typeof value === 'string' &&
  BIZGUARD_SUPPORTED_LOCALES.includes(value as BizGuardLocale);

const normalizeCountryCode = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
};

const normalizeCurrencyCode = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return undefined;

  try {
    // Intl validates currency identifiers but does not confirm payment-provider support.
    new Intl.NumberFormat('en', { style: 'currency', currency: normalized });
    return normalized;
  } catch {
    return undefined;
  }
};

const normalizeTimezone = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value.trim();
  try {
    new Intl.DateTimeFormat('en', { timeZone: normalized });
    return normalized;
  } catch {
    return undefined;
  }
};

export const normalizeGlobalMarketPreferences = (
  value: Partial<GlobalMarketPreferences> | null | undefined,
): GlobalMarketPreferences => ({
  locale: isSupportedLocale(value?.locale) ? value.locale : DEFAULT_BIZGUARD_LOCALE,
  countryCode: normalizeCountryCode(value?.countryCode),
  timezone: normalizeTimezone(value?.timezone),
  reportingCurrency: normalizeCurrencyCode(value?.reportingCurrency),
});

/**
 * Read browser-local preferences. Returns safe defaults when storage is
 * unavailable or contains malformed data. No account data is read or written.
 */
export const getGlobalMarketPreferences = (): GlobalMarketPreferences => {
  const fallback: GlobalMarketPreferences = { locale: DEFAULT_BIZGUARD_LOCALE };

  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return normalizeGlobalMarketPreferences(parsed as Partial<GlobalMarketPreferences>);
  } catch {
    return fallback;
  }
};

/**
 * Persist non-sensitive display preferences locally. This is intentionally
 * not a substitute for syncing preferences to the authenticated profile.
 */
export const saveGlobalMarketPreferences = (
  preferences: Partial<GlobalMarketPreferences>,
): GlobalMarketPreferences => {
  const normalized = normalizeGlobalMarketPreferences(preferences);

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Private browsing or browser policy may block storage; callers still get
    // the normalized value and can keep it in component state.
  }

  return normalized;
};

export const formatLocalizedNumber = (
  value: number,
  locale: BizGuardLocale | string = DEFAULT_BIZGUARD_LOCALE,
  options: Intl.NumberFormatOptions = {},
): string => {
  if (!Number.isFinite(value)) return '—';
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_BIZGUARD_LOCALE;

  try {
    return new Intl.NumberFormat(safeLocale, options).format(value);
  } catch {
    return new Intl.NumberFormat(DEFAULT_BIZGUARD_LOCALE, options).format(value);
  }
};

/**
 * Formats an amount for display only. It does not convert currencies, apply
 * FX rates, round stored values, or represent payment settlement.
 */
export const formatLocalizedCurrency = (
  amount: number,
  currency: string,
  locale: BizGuardLocale | string = DEFAULT_BIZGUARD_LOCALE,
  options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {},
): string => {
  if (!Number.isFinite(amount)) return '—';

  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_BIZGUARD_LOCALE;
  const safeCurrency = normalizeCurrencyCode(currency);

  if (!safeCurrency) {
    const formattedAmount = formatLocalizedNumber(amount, safeLocale, options);
    return currency?.trim() ? `${formattedAmount} ${currency.trim().toUpperCase()}` : formattedAmount;
  }

  try {
    return new Intl.NumberFormat(safeLocale, {
      ...options,
      style: 'currency',
      currency: safeCurrency,
    }).format(amount);
  } catch {
    return `${formatLocalizedNumber(amount, DEFAULT_BIZGUARD_LOCALE, options)} ${safeCurrency}`;
  }
};

export const formatLocalizedDateTime = (
  value: Date | string | number,
  locale: BizGuardLocale | string = DEFAULT_BIZGUARD_LOCALE,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_BIZGUARD_LOCALE;

  try {
    return new Intl.DateTimeFormat(safeLocale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_BIZGUARD_LOCALE, options).format(date);
  }
};

export const formatLocalizedDate = (
  value: Date | string | number,
  locale: BizGuardLocale | string = DEFAULT_BIZGUARD_LOCALE,
): string =>
  formatLocalizedDateTime(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const getBrowserTimezone = (): string | undefined => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return normalizeTimezone(timezone);
  } catch {
    return undefined;
  }
};

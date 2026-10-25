export interface PricingMarket {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
}

export const PRICING_MARKETS: PricingMarket[] = [
  { countryCode: 'NG', countryName: 'Nigeria', currency: 'NGN', locale: 'en-NG' },
  { countryCode: 'US', countryName: 'United States', currency: 'USD', locale: 'en-US' },
  { countryCode: 'GB', countryName: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { countryCode: 'NO', countryName: 'Norway', currency: 'NOK', locale: 'nb-NO' },
  { countryCode: 'EU', countryName: 'Eurozone', currency: 'EUR', locale: 'en-IE' },
  { countryCode: 'CA', countryName: 'Canada', currency: 'CAD', locale: 'en-CA' },
  { countryCode: 'AU', countryName: 'Australia', currency: 'AUD', locale: 'en-AU' },
  { countryCode: 'GH', countryName: 'Ghana', currency: 'GHS', locale: 'en-GH' },
  { countryCode: 'KE', countryName: 'Kenya', currency: 'KES', locale: 'en-KE' },
  { countryCode: 'ZA', countryName: 'South Africa', currency: 'ZAR', locale: 'en-ZA' },
  { countryCode: 'IN', countryName: 'India', currency: 'INR', locale: 'en-IN' },
  { countryCode: 'AE', countryName: 'United Arab Emirates', currency: 'AED', locale: 'en-AE' },
  { countryCode: 'SG', countryName: 'Singapore', currency: 'SGD', locale: 'en-SG' },
  { countryCode: 'CH', countryName: 'Switzerland', currency: 'CHF', locale: 'de-CH' },
  { countryCode: 'SE', countryName: 'Sweden', currency: 'SEK', locale: 'sv-SE' },
  { countryCode: 'DK', countryName: 'Denmark', currency: 'DKK', locale: 'da-DK' },
  { countryCode: 'JP', countryName: 'Japan', currency: 'JPY', locale: 'ja-JP' },
  { countryCode: 'BR', countryName: 'Brazil', currency: 'BRL', locale: 'pt-BR' },
  { countryCode: 'MX', countryName: 'Mexico', currency: 'MXN', locale: 'es-MX' },
];

export interface GlobalPriceQuote {
  baseAmountNgn: number;
  localAmount: number;
  localCurrency: string;
  usdtAmount: number;
  ngnPerLocal: number;
  usdPerUsdt: number;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}

interface ErApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
}

interface CoinGeckoResponse {
  tether?: { usd?: number };
}

/** Indicative display quote only. Server/admin must verify the amount actually received before activation. */
export async function getGlobalPriceQuote(baseAmountNgn: number, currency: string): Promise<GlobalPriceQuote> {
  const [fxResponse, cryptoResponse] = await Promise.all([
    fetch('https://open.er-api.com/v6/latest/NGN', { cache: 'no-store' }),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd', { cache: 'no-store' }),
  ]);
  if (!fxResponse.ok) throw new Error('Live currency rates are temporarily unavailable.');
  if (!cryptoResponse.ok) throw new Error('Live USDT market quote is temporarily unavailable.');
  const fx = await fxResponse.json() as ErApiResponse;
  const crypto = await cryptoResponse.json() as CoinGeckoResponse;
  const rate = currency === 'NGN' ? 1 : fx.rates?.[currency];
  const usdPerUsdt = crypto.tether?.usd;
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new Error(`A live NGN/${currency} exchange rate is unavailable.`);
  if (!usdPerUsdt || !Number.isFinite(usdPerUsdt) || usdPerUsdt <= 0) throw new Error('A live USDT/USD quote is unavailable.');
  const localAmount = baseAmountNgn * rate;
  const usdAmount = baseAmountNgn * (fx.rates?.USD || 0);
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) throw new Error('The USD conversion rate is unavailable.');
  const now = Date.now();
  return {
    baseAmountNgn,
    localAmount,
    localCurrency: currency,
    usdtAmount: usdAmount / usdPerUsdt,
    ngnPerLocal: 1 / rate,
    usdPerUsdt,
    source: 'open.er-api.com + CoinGecko Tether/USD',
    fetchedAt: fx.time_last_update_utc || new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
  };
}

export const formatGlobalAmount = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount);

import { getIndicativeFxRate } from './fxRates';

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

interface CoinGeckoResponse {
  tether?: { usd?: number };
}
interface CoinbaseResponse {
  data?: { amount?: string; base?: string; currency?: string };
}

async function getIndicativeUsdtUsd(): Promise<{ rate: number; source: string; fetchedAt: string }> {
  const attempts = [
    async () => {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd', {
        cache: 'no-store', signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
      const payload = await response.json() as CoinGeckoResponse;
      const rate = payload.tether?.usd;
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error('CoinGecko returned no valid USDT/USD quote');
      return { rate, source: 'CoinGecko Tether/USD market quote', fetchedAt: new Date().toISOString() };
    },
    async () => {
      const response = await fetch('https://api.coinbase.com/v2/prices/USDT-USD/spot', {
        cache: 'no-store', signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) throw new Error(`Coinbase HTTP ${response.status}`);
      const payload = await response.json() as CoinbaseResponse;
      const rate = Number(payload.data?.amount);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Coinbase returned no valid USDT/USD quote');
      return { rate, source: 'Coinbase USDT/USD spot quote', fetchedAt: new Date().toISOString() };
    },
  ];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try { return await attempt(); }
    catch (error) { errors.push(error instanceof Error ? error.message : 'request failed'); }
  }
  throw new Error(`Live USDT/USD market data is unavailable. ${errors.join('; ')}`);
}

/** Indicative display quote only. Server/admin must verify the amount actually received before activation. */
export async function getGlobalPriceQuote(baseAmountNgn: number, currency: string): Promise<GlobalPriceQuote> {
  if (!Number.isFinite(baseAmountNgn) || baseAmountNgn <= 0) throw new Error('The subscription plan amount is invalid.');
  const [localFx, usdFx, crypto] = await Promise.all([
    getIndicativeFxRate('NGN', currency),
    getIndicativeFxRate('NGN', 'USD'),
    getIndicativeUsdtUsd(),
  ]);
  const localAmount = baseAmountNgn * localFx.rate;
  const usdAmount = baseAmountNgn * usdFx.rate;
  if (!Number.isFinite(localAmount) || localAmount <= 0 || !Number.isFinite(usdAmount) || usdAmount <= 0) {
    throw new Error('The current currency conversion quote is invalid.');
  }
  const now = Date.now();
  return {
    baseAmountNgn,
    localAmount,
    localCurrency: currency,
    usdtAmount: usdAmount / crypto.rate,
    ngnPerLocal: 1 / localFx.rate,
    usdPerUsdt: crypto.rate,
    source: `${localFx.source}; ${usdFx.source}; ${crypto.source}`,
    fetchedAt: [localFx.effectiveAt, usdFx.effectiveAt, crypto.fetchedAt].sort().slice(-1)[0] || new Date(now).toISOString(),
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

export interface IndicativeFxRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  source: string;
  effectiveAt: string;
}

type RatePayload = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
  time_last_update_unix?: number;
  date?: string;
};

/**
 * Fetch an indicative, timestamped FX rate from public market-data providers.
 * This is display-only: it is not a settlement/accounting quote. OpenAI is
 * intentionally not treated as a numeric exchange-rate oracle.
 */
export async function getIndicativeFxRate(baseCurrency: string, quoteCurrency: string): Promise<IndicativeFxRate> {
  const base = baseCurrency.trim().toUpperCase();
  const quote = quoteCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    throw new Error('Both currencies must be valid three-letter currency codes.');
  }
  if (base === quote) {
    return { baseCurrency: base, quoteCurrency: quote, rate: 1, source: 'Identity conversion', effectiveAt: new Date().toISOString() };
  }

  const failures: string[] = [];
  const providers: Array<{ name: string; url: string; parse: (payload: RatePayload) => { rate?: number; timestamp?: string } }> = [
    {
      name: 'open.er-api.com',
      url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      parse: (payload) => ({
        rate: payload.result === 'success' ? payload.rates?.[quote] : undefined,
        timestamp: payload.time_last_update_unix ? new Date(payload.time_last_update_unix * 1000).toISOString() : payload.time_last_update_utc,
      }),
    },
    {
      name: 'api.exchangerate-api.com',
      url: `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base)}`,
      parse: (payload) => ({ rate: payload.rates?.[quote], timestamp: payload.date }),
    },
    {
      name: 'Frankfurter',
      url: `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`,
      parse: (payload) => ({ rate: payload.rates?.[quote], timestamp: payload.date }),
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, { cache: 'no-store', signal: AbortSignal.timeout(6500) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as RatePayload;
      const parsed = provider.parse(payload);
      if (typeof parsed.rate !== 'number' || !Number.isFinite(parsed.rate) || parsed.rate <= 0) {
        throw new Error(`no valid ${base}/${quote} rate in response`);
      }
      return {
        baseCurrency: base,
        quoteCurrency: quote,
        rate: parsed.rate,
        source: `${provider.name} indicative rate`,
        effectiveAt: parsed.timestamp && !Number.isNaN(Date.parse(parsed.timestamp)) ? new Date(parsed.timestamp).toISOString() : new Date().toISOString(),
      };
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : 'request failed'}`);
    }
  }
  throw new Error(`Could not load ${base}/${quote} FX rate from any configured provider. ${failures.join('; ')}`);
}

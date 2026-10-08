const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asNumber = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const restSelectOne = async (baseUrl: string, key: string, table: string, select: string, filters: Record<string, string>) => {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  Object.entries(filters).forEach(([name, value]) => url.searchParams.set(name, value));
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: key } });
  if (!response.ok) return { error: `Membership lookup (${table}) failed (${response.status}).` };
  const rows = await response.json();
  return { row: Array.isArray(rows) ? rows[0] || null : null };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method === 'GET') return json({ service: 'bizguard-vision', status: 'ok', version: '2026-10-03' });
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
      try {
        const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
        return keys.default || '';
      } catch { return ''; }
    })();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-6-luna';
    const requestTimeoutMs = 25_000;
    if (!supabaseUrl || !serviceKey || !openaiKey) return json({ error: 'Vision service is not configured on the server. Required secrets: Supabase secret key, OPENAI_API_KEY.' }, 503);

    // Validate the bearer token directly with Supabase Auth using the server-side
    // service client. This avoids depending on SUPABASE_ANON_KEY inside the Edge
    // Function and is compatible with current publishable-key browser clients.
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return json({ error: 'Authentication required.' }, 401);
    // New Supabase sb_secret_* keys are opaque API keys, not JWTs. They must
    // travel in `apikey`, while the user's access token travels in `Authorization`.
    // Do not send the secret key as a Bearer token.
    const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!authResponse.ok) return json({ error: 'Authentication required.' }, 401);
    const user = await authResponse.json();
    if (!user?.id) return json({ error: 'Authentication required.' }, 401);

    const body = await request.json();
    const businessId = asString(body?.business_id);
    const mode = body?.mode === 'sales' ? 'sales' : 'inventory';
    const image = asString(body?.image);
    const knownProducts = Array.isArray(body?.known_products) ? body.known_products.slice(0, 164) : [];
    const barcodeHints = Array.isArray(body?.barcode_hints) ? body.barcode_hints.map(asString).filter(Boolean).slice(0, 12) : [];
    if (!businessId || !image.startsWith('data:image/')) return json({ error: 'business_id and an image data URL are required.' }, 400);
    if (image.length > 8_000_000) return json({ error: 'Image payload is too large.' }, 413);

    const [legacyResult, profileResult, memberResult] = await Promise.all([
      restSelectOne(supabaseUrl, serviceKey, 'users', 'id,email,business_id,role', { id: `eq.${user.id}` }),
      restSelectOne(supabaseUrl, serviceKey, 'profiles', 'id,email,business_id,role', { id: `eq.${user.id}` }),
      restSelectOne(supabaseUrl, serviceKey, 'business_members', 'id,user_id,business_id,role,status', { user_id: `eq.${user.id}`, status: 'eq.active' }),
    ]);
    if (legacyResult.error && profileResult.error && memberResult.error) return json({ error: `${legacyResult.error} ${profileResult.error} ${memberResult.error}`.slice(0, 500) }, 502);
    let membership = memberResult.row?.business_id
      ? memberResult.row
      : legacyResult.row?.business_id
        ? legacyResult.row
        : profileResult.row?.business_id
          ? profileResult.row
          : null;

    // Super admin is an administrative authorization, not a paid-plan gate.
    // Allow the selected existing business even if the legacy users row has no
    // business_id yet. Normal users remain strictly tenant-scoped.
    if (legacyResult.row?.role === 'super_admin') {
      const selectedBusiness = await restSelectOne(supabaseUrl, serviceKey, 'businesses', 'id,name', { id: `eq.${businessId}` });
      if (selectedBusiness.row?.id) {
        membership = { ...legacyResult.row, business_id: selectedBusiness.row.id, role: 'super_admin' };
      }
    }

    if (!membership) return json({ error: 'Business access required. Link this account to a BizGuard business workspace in Admin Portal. A paid Business subscription is not required for Free Snap Count.', code: 'VISION_PROFILE_MISSING' }, 403);
    const ownsBusiness = membership.role === 'super_admin' || String(membership.business_id || '').toLowerCase() === businessId.toLowerCase();
    if (!ownsBusiness) return json({ error: 'Business access required. The selected business is not linked to your signed-in BizGuard account.' }, 403);

    const productCatalog = knownProducts.map((p: Record<string, unknown>) => ({ id: asString(p.id), name: asString(p.name), sku: asString(p.sku), barcode: p.barcode || null })).filter((p: { id: string; name: string }) => p.id && p.name);
    const catalogText = JSON.stringify(productCatalog);
    const task = mode === 'inventory'
      ? 'Analyze this stock photograph for inventory receiving. Identify every distinct visible product and count the visible physical units/packages of each. Count objects you can actually see; never infer hidden, stacked, boxed, or occluded quantities. If a package says 12 pieces, count the package as 1 visible package unless individual pieces are actually visible. Separate visually distinct product types. Be conservative when objects overlap.'
      : 'Analyze this product photograph for a point-of-sale draft. Identify every distinct visible product and count the visible physical units that appear to be part of the purchase. Never infer hidden quantities or package contents that are not visible.';

    const prompt = `${task}\n\nKnown BizGuard product catalog: ${catalogText}\n\nCamera barcode hints: ${JSON.stringify(barcodeHints)}\n\nRules: Prefer an exact barcode match when the barcode is visible. Match an existing catalog item only when visual evidence is reasonable. Return its exact catalog id in product_id only when the match is supported by the image/catalog; never invent a product_id. Count visible physical objects, not hidden stock. Do not multiply a single package by the number printed on it unless the individual units are visibly countable. Each detection must represent one visually distinct product type. Keep quantities conservative. If two products look similar and cannot be distinguished reliably, lower confidence and explain the ambiguity in notes.\n\nReturn ONLY valid JSON: {"summary": string, "detections": [{"product_id": string|null, "name": string, "quantity": integer, "confidence": number, "barcode": string|null, "category": string|null, "notes": string|null}], "requires_review": true}. Confidence must be 0..1. Quantity must be an observed visible count.`;

    let openaiResponse: Response | null = null;
    let raw: Record<string, unknown> | null = null;
    let lastProviderError = 'Vision provider failed.';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        openaiResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: [{ role: 'user', content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: image, detail: 'high' },
            ] }],
            max_output_tokens: 1200,
          }),
        });
        raw = await openaiResponse.json();
        if (openaiResponse.ok) break;
        lastProviderError = asString(raw?.error && typeof raw.error === 'object' ? (raw.error as Record<string, unknown>).message : '') || `Vision provider returned HTTP ${openaiResponse.status}.`;
        if (openaiResponse.status !== 429 && openaiResponse.status < 500) break;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return json({ error: 'Vision analysis timed out. Retake a closer, well-lit photo and try again.' }, 504);
        lastProviderError = error instanceof Error ? error.message : 'Vision provider request failed.';
      } finally {
        clearTimeout(timeout);
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (!openaiResponse?.ok || !raw) return json({ error: lastProviderError }, 502);
    const outputText = asString(raw?.output_text) ||
      (Array.isArray(raw?.output)
        ? raw.output.flatMap((item: unknown) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).content) ? ((item as Record<string, unknown>).content as unknown[]) : []).map((item: unknown) => item && typeof item === 'object' ? asString((item as Record<string, unknown>).text) : '').filter(Boolean).join('\n')
        : '');
    if (!outputText) return json({ error: 'Vision provider returned no analysis.' }, 502);

    let parsed: { summary?: string; detections?: unknown[]; requires_review?: boolean };
    try {
      const cleaned = outputText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ error: 'Vision provider returned malformed analysis.' }, 502);
    }

    const detections = (Array.isArray(parsed.detections) ? parsed.detections : []).map((item: unknown) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        product_id: asString(record.product_id).trim() || null,
        name: asString(record.name).trim() || 'Unidentified product',
        quantity: Math.max(0, Math.floor(asNumber(record.quantity, 0))),
        confidence: Math.max(0, Math.min(1, asNumber(record.confidence, 0))),
        barcode: asString(record.barcode).trim() || null,
        category: asString(record.category).trim() || null,
        notes: asString(record.notes).trim() || null,
      };
    }).filter((item: { quantity: number }) => item.quantity > 0).slice(0, 50);

    const catalogIds = new Set(productCatalog.map((item: { id: string }) => item.id));
    for (const item of detections as Array<{ product_id: string | null }>) {
      if (item.product_id && !catalogIds.has(item.product_id)) item.product_id = null;
    }

    return json({ mode, detections, summary: asString(parsed.summary) || `Detected ${detections.length} product type(s).`, provider: `OpenAI ${model}`, requires_review: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Vision service failed.' }, 500);
  }
});

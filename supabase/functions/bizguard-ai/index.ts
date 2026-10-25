const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const asString = (value: unknown, max = 6000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

async function restSelectOne(baseUrl: string, key: string, table: string, select: string, filters: Record<string, string>) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  Object.entries(filters).forEach(([name, value]) => url.searchParams.set(name, value));
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: key } });
  if (!response.ok) return { error: `Membership lookup failed for ${table} (${response.status}).` };
  const rows = await response.json();
  return { row: Array.isArray(rows) ? rows[0] || null : null };
}

const systemPrompt = `You are BizGuard, a careful business intelligence assistant for small and medium businesses. Use only the supplied business context and user question. Do not invent metrics, exchange rates, customer facts, or transactions. Clearly label estimates and missing data. Do not execute transactions, change prices, send messages, or modify records. Recommendations that affect money, inventory, customers, credit, or operations must require human review. Respect the supplied country and reporting currency, but do not convert values unless the context provides a documented FX rate. Return valid JSON only.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method === 'GET') return json({ service: 'bizguard-ai', status: 'ok', provider: 'openai' });
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return json({ error: 'Authentication required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
      try {
        const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
        return keys.default || '';
      } catch { return ''; }
    })();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    if (!supabaseUrl || !serviceKey || !openaiKey) {
      return json({ error: 'AI service is not configured on the server. Configure Supabase server secrets and OPENAI_API_KEY.' }, 503);
    }

    const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!authResponse.ok) return json({ error: 'Authentication required.' }, 401);
    const user = await authResponse.json();
    if (!user?.id) return json({ error: 'Authentication required.' }, 401);

    const body = await request.json();
    const businessId = asString(body?.business_id, 100);
    const prompt = asString(body?.prompt, 6000);
    const operation = asString(body?.operation, 80) || 'analyzeBusiness';
    const mode = asString(body?.mode, 80) || 'guardian';
    if (!businessId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)) {
      return json({ error: 'A valid business_id is required.' }, 400);
    }
    if (!prompt) return json({ error: 'A prompt is required.' }, 400);

    const context = body?.context && typeof body.context === 'object' ? body.context : {};
    const contextText = JSON.stringify(context);
    if (contextText.length > 24000) return json({ error: 'Business context is too large. Send a smaller, relevant summary.' }, 413);

    const [legacyResult, profileResult, memberResult] = await Promise.all([
      restSelectOne(supabaseUrl, serviceKey, 'users', 'id,email,business_id,role', { id: `eq.${user.id}` }),
      restSelectOne(supabaseUrl, serviceKey, 'profiles', 'id,email,business_id,role', { id: `eq.${user.id}` }),
      restSelectOne(supabaseUrl, serviceKey, 'business_members', 'id,user_id,business_id,role,status', { user_id: `eq.${user.id}`, business_id: `eq.${businessId}`, status: 'eq.active' }),
    ]);
    if (legacyResult.error && profileResult.error && memberResult.error) {
      return json({ error: 'Could not verify BizGuard business access. Contact your administrator.' }, 502);
    }
    let membership = memberResult.row?.business_id
      ? memberResult.row
      : legacyResult.row?.business_id
        ? legacyResult.row
        : profileResult.row?.business_id
          ? profileResult.row
          : null;

    if (legacyResult.row?.role === 'super_admin') {
      const selectedBusiness = await restSelectOne(supabaseUrl, serviceKey, 'businesses', 'id,name', { id: `eq.${businessId}` });
      if (selectedBusiness.row?.id) membership = { ...legacyResult.row, business_id: selectedBusiness.row.id, role: 'super_admin' };
    }
    if (!membership || String(membership.business_id || '').toLowerCase() !== businessId.toLowerCase()) {
      return json({ error: 'Business access required. The selected business is not linked to your signed-in account.' }, 403);
    }

    const wantsAgentResponse = operation === 'agentResponse';
    const outputShape = wantsAgentResponse
      ? { title: 'string', summary: 'string', recommendations: ['string'], metrics: {}, priority: 'low|medium|high|urgent' }
      : { provider: 'openai', title: 'string', summary: 'string', confidence: 0, risks: ['string'], recommendations: ['string'], actionPlan: ['string'], metrics: {} };
    const userPrompt = [
      `BizGuard operation: ${operation}`,
      `Agent mode: ${mode}`,
      `User request: ${prompt}`,
      `Business context JSON: ${contextText}`,
      `Return a JSON object matching this shape: ${JSON.stringify(outputShape)}`,
      'For metrics, use only numbers or short strings present or directly calculable from the supplied context. If data is insufficient, say so and lower confidence.',
    ].join('\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let openaiResponse: Response;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1400,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!openaiResponse.ok) {
      const details = await openaiResponse.text();
      console.error('BizGuard OpenAI request failed', openaiResponse.status, details.slice(0, 500));
      return json({ error: openaiResponse.status === 429 ? 'AI capacity is temporarily limited. Please retry shortly.' : 'OpenAI could not complete this request. Check the server model/key configuration and retry.' }, 502);
    }
    const payload = await openaiResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return json({ error: 'OpenAI returned an empty response.' }, 502);
    let result: Record<string, unknown>;
    try { result = JSON.parse(content); } catch { return json({ error: 'OpenAI returned an invalid structured response.' }, 502); }

    if (wantsAgentResponse) {
      const recommendations = Array.isArray(result.recommendations) ? result.recommendations.filter((v) => typeof v === 'string').slice(0, 8) : [];
      return json({
        title: asString(result.title, 160) || 'BizGuard AI Business Briefing',
        summary: asString(result.summary, 2000),
        recommendations,
        metrics: result.metrics && typeof result.metrics === 'object' && !Array.isArray(result.metrics) ? result.metrics : {},
        priority: ['low', 'medium', 'high', 'urgent'].includes(String(result.priority)) ? result.priority : 'medium',
        provider: 'openai',
      });
    }

    return json({
      provider: 'openai',
      title: asString(result.title, 160) || 'BizGuard AI Analysis',
      summary: asString(result.summary, 3000) || 'Analysis completed with limited context.',
      confidence: Math.max(0, Math.min(100, Number(result.confidence) || 50)),
      risks: Array.isArray(result.risks) ? result.risks.filter((v) => typeof v === 'string').slice(0, 8) : [],
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.filter((v) => typeof v === 'string').slice(0, 10) : [],
      actionPlan: Array.isArray(result.actionPlan) ? result.actionPlan.filter((v) => typeof v === 'string').slice(0, 10) : [],
      metrics: result.metrics && typeof result.metrics === 'object' && !Array.isArray(result.metrics) ? result.metrics : {},
    });
  } catch (error) {
    console.error('BizGuard AI request error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'AI request failed safely. Please retry; if it persists, check the Edge Function logs.' }, 500);
  }
});

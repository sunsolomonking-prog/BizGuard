/**
 * BizGuard Vision Vercel emergency gateway.
 *
 * This is a same-origin fallback for deployments where the Supabase Edge
 * Function is unavailable. Secrets stay server-side. Configure on Vercel:
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *   OPENAI_VISION_MODEL (optional; defaults to gpt-6-luna)
 */

const VERSION = '44.12-final-snap-auth-source-of-truth';

const json = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-BizGuard-Vision-Version', VERSION);
  res.status(status).json(body);
};

const asString = (value) => typeof value === 'string' ? value : '';
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function getUser(supabaseUrl, serviceKey, token) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function callSupabaseRpc(supabaseUrl, serviceKey, accessToken, functionName, args) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  const body = await readJson(response);
  return { response, body };
}

async function restSelectOne(supabaseUrl, serviceKey, table, select, filters) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: serviceKey } });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { error: `Membership lookup (${table}) failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ''}` };
  }
  const rows = await response.json();
  return { row: Array.isArray(rows) ? rows[0] || null : null };
}

async function getMembership(supabaseUrl, serviceKey, accessToken, user, requestedBusinessId) {
  const businessId = asString(requestedBusinessId).trim();
  const userId = asString(user?.id).trim();
  if (!businessId || !userId) return { membership: null };

  // Primary authorization primitive: the existing SECURITY DEFINER RPC.
  // Keep the authenticated user's JWT so auth.uid() is the real user.
  let rpcAllowed = false;
  let rpcError = '';
  try {
    const accessResult = await callSupabaseRpc(
      supabaseUrl,
      serviceKey,
      accessToken,
      'user_can_access_business',
      { target_business_id: businessId },
    );
    if (accessResult.response.ok) {
      const allowed = Array.isArray(accessResult.body) ? accessResult.body[0] : accessResult.body;
      rpcAllowed = allowed === true ||
        allowed?.user_can_access_business === true ||
        allowed?.result === true;
    } else {
      rpcError = asString(accessResult.body?.message) || asString(accessResult.body?.error) || `Business authorization check failed (${accessResult.response.status}).`;
    }
  } catch (error) {
    rpcError = error instanceof Error ? error.message : 'Business authorization check failed.';
  }

  // Targeted runtime fallback for deployments where the RPC is missing,
  // stale, overloaded, or returning a false negative because of schema drift.
  // This remains tenant-safe: every relationship is checked against the
  // authenticated user ID and the requested existing business ID.
  let userRow = null;
  let profileRow = null;
  let memberRow = null;
  let businessRow = null;
  try {
    const [memberResult, userResult, profileResult, businessResult] = await Promise.all([
      restSelectOne(supabaseUrl, serviceKey, 'business_members', 'id,user_id,business_id,role,status', {
        user_id: `eq.${userId}`,
        business_id: `eq.${businessId}`,
        status: 'eq.active',
      }),
      restSelectOne(supabaseUrl, serviceKey, 'users', 'id,email,name,business_id,role', { id: `eq.${userId}` }),
      restSelectOne(supabaseUrl, serviceKey, 'profiles', 'id,email,full_name,business_id,role', { id: `eq.${userId}` }),
      restSelectOne(supabaseUrl, serviceKey, 'businesses', 'id,name', { id: `eq.${businessId}` }),
    ]);
    memberRow = memberResult.row || null;
    userRow = userResult.row || null;
    profileRow = profileResult.row || null;
    businessRow = businessResult.row || null;

    if (memberResult.error || userResult.error || profileResult.error || businessResult.error) {
      const detail = memberResult.error || userResult.error || profileResult.error || businessResult.error;
      if (!rpcAllowed) return { error: rpcError || detail };
    }
  } catch (error) {
    if (!rpcAllowed) return { error: rpcError || (error instanceof Error ? error.message : 'Business authorization lookup failed.') };
  }

  const isSuperAdmin = userRow?.role === 'super_admin' || user?.app_metadata?.role === 'super_admin' || user?.user_metadata?.role === 'super_admin';
  const linkedByUsers = String(userRow?.business_id || '').trim().toLowerCase() === businessId.toLowerCase();
  const linkedByProfile = String(profileRow?.business_id || '').trim().toLowerCase() === businessId.toLowerCase();
  const linkedByMember = String(memberRow?.business_id || '').trim().toLowerCase() === businessId.toLowerCase() && memberRow?.status === 'active';
  const existingBusiness = Boolean(businessRow?.id);

  const authorized = rpcAllowed ||
    (existingBusiness && isSuperAdmin) ||
    linkedByUsers ||
    linkedByProfile ||
    linkedByMember;

  if (!authorized) return { membership: null };

  let role = 'owner';
  let source = rpcAllowed ? 'public.user_can_access_business' : 'runtime relationship fallback';
  if (memberRow?.role) {
    role = memberRow.role;
    source = 'public.business_members';
  } else if (isSuperAdmin) {
    role = 'super_admin';
    source = 'public.users.super_admin';
  } else if (userRow?.role) {
    role = userRow.role;
    source = 'public.users';
  } else if (profileRow?.role) {
    role = profileRow.role;
    source = 'public.profiles';
  }

  return {
    membership: {
      id: userId,
      email: asString(user?.email).trim().toLowerCase(),
      business_id: businessId,
      role,
      source,
    },
  };
}

const buildPrompt = ({ mode, productCatalog, barcodeHints }) => {
  const task = mode === 'inventory'
    ? 'Analyze this stock photograph for inventory receiving/counting. Identify every distinct visible product and count the visible physical units/packages of each. Count only what is actually visible. Never infer hidden, stacked, boxed, or occluded quantities. If a package says 12 pieces, count the package as 1 visible package unless individual pieces are visibly countable. Separate visually distinct product types.'
    : 'Analyze this product photograph for a point-of-sale draft. Identify every distinct visible product and count the visible physical units that appear to be part of the purchase. Never infer hidden quantities or package contents that are not visible.';

  return `${task}\n\nKnown BizGuard product catalog: ${JSON.stringify(productCatalog)}\n\nCamera barcode hints: ${JSON.stringify(barcodeHints)}\n\nRules:\n- Prefer an exact barcode match when visible.\n- Match a catalog item only when visual evidence supports it.\n- Never invent product_id values.\n- Count visible physical objects, not labels or printed quantities.\n- Do not multiply a package by a number printed on it.\n- One detection = one visually distinct product type.\n- Be conservative with overlapping objects.\n- If identification is uncertain, lower confidence and explain the ambiguity.\n- Return integer quantities >= 1.\n\nReturn ONLY valid JSON with this shape: {"summary": string, "detections": [{"product_id": string|null, "name": string, "quantity": integer, "confidence": number, "barcode": string|null, "category": string|null, "notes": string|null}], "requires_review": true}`;
};

async function callOpenAI({ openaiKey, model, image, prompt }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
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
  return { response, body: await readJson(response) };
}

function normalizeResult(body, mode, model, productCatalog) {
  const outputText = asString(body?.output_text) ||
    (Array.isArray(body?.output)
      ? body.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []).map((item) => asString(item?.text)).filter(Boolean).join('\n')
      : '');
  if (!outputText) throw new Error('Vision provider returned no analysis.');

  let parsed;
  try {
    parsed = JSON.parse(outputText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
  } catch {
    throw new Error('Vision provider returned malformed analysis.');
  }

  const detections = (Array.isArray(parsed?.detections) ? parsed.detections : []).map((item) => {
    const record = item && typeof item === 'object' ? item : {};
    return {
      product_id: asString(record.product_id).trim() || null,
      name: asString(record.name).trim() || 'Unidentified product',
      quantity: Math.max(0, Math.floor(asNumber(record.quantity, 0))),
      confidence: Math.max(0, Math.min(1, asNumber(record.confidence, 0))),
      barcode: asString(record.barcode).trim() || null,
      category: asString(record.category).trim() || null,
      notes: asString(record.notes).trim() || null,
    };
  }).filter((item) => item.quantity > 0).slice(0, 50);

  const catalogIds = new Set(productCatalog.map((item) => item.id));
  for (const item of detections) if (item.product_id && !catalogIds.has(item.product_id)) item.product_id = null;

  return {
    mode,
    detections,
    summary: asString(parsed?.summary) || `Detected ${detections.length} product type(s).`,
    provider: `OpenAI ${model} via Vercel Vision Gateway`,
    requires_review: true,
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, {
    service: 'bizguard-vision-vercel-gateway',
    status: 'ok',
    version: VERSION,
    configured: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      openaiKey: Boolean(process.env.OPENAI_API_KEY),
      openaiVisionModel: Boolean(process.env.OPENAI_VISION_MODEL),
    },
  });
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });

  const supabaseUrl = asString(process.env.SUPABASE_URL).replace(/\/$/, '');
  const serviceKey = asString(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const openaiKey = asString(process.env.OPENAI_API_KEY);
  const model = asString(process.env.OPENAI_VISION_MODEL) || 'gpt-6-luna';
  if (!supabaseUrl || !serviceKey || !openaiKey) return json(res, 503, { error: 'Vision gateway is not configured. Set SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) and OPENAI_API_KEY on Vercel.' });

  const auth = asString(req.headers.authorization);
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Authentication required.', code: 'VISION_AUTH_MISSING' });

  try {
    const user = await getUser(supabaseUrl, serviceKey, token);
    if (!user?.id) return json(res, 401, { error: 'Authentication required. Sign in again and retry Snap.', code: 'VISION_AUTH_INVALID' });

    const body = req.body || {};
    const businessId = asString(body.business_id);
    const mode = body.mode === 'sales' ? 'sales' : 'inventory';
    const image = asString(body.image);
    const knownProducts = Array.isArray(body.known_products) ? body.known_products.slice(0, 164) : [];
    const barcodeHints = Array.isArray(body.barcode_hints) ? body.barcode_hints.map(asString).filter(Boolean).slice(0, 12) : [];
    if (!businessId || !image.startsWith('data:image/')) return json(res, 400, { error: 'business_id and an image data URL are required.' });
    if (image.length > 8_000_000) return json(res, 413, { error: 'Image payload is too large.' });

    // Source-of-truth authorization is performed here from the authenticated
    // user plus the existing users/profiles/business_members records.
    // Do NOT call prepare_snap_business_access before Vision: older database
    // deployments can contain an overloaded/legacy implementation whose
    // unqualified business_id references produce the exact ambiguity that
    // previously surfaced as HTTP 403. The membership check below already
    // enforces tenant isolation, while reserve_snap_count is the authoritative
    // entitlement gate.
    const membershipResult = await getMembership(supabaseUrl, serviceKey, token, user, businessId);
    if (membershipResult?.error) return json(res, 502, { error: membershipResult.error, code: 'VISION_MEMBERSHIP_LOOKUP_FAILED' });
    const membership = membershipResult?.membership || null;
    if (!membership) return json(res, 403, {
      error: 'Business access required. Link this account to a BizGuard business workspace in Admin Portal. Free Snap Count does not require a paid Business subscription.',
      code: 'VISION_PROFILE_MISSING',
    });
    const membershipBusinessId = String(membership.business_id || '').trim().toLowerCase();
    const requestedBusinessId = businessId.trim().toLowerCase();
    const ownsBusiness = membership.role === 'super_admin' || membershipBusinessId === requestedBusinessId;
    if (!ownsBusiness) return json(res, 403, {
      error: 'Business access required. The selected business is not linked to your signed-in BizGuard account.',
      code: 'VISION_BUSINESS_MISMATCH',
    });

    // Subscription entitlement is authoritative on the server. A valid Vision
    // request consumes exactly one Snap Count reservation; failed provider calls
    // release that reservation so users are not charged for failed analyses.
    const reservationResult = await callSupabaseRpc(supabaseUrl, serviceKey, token, 'reserve_snap_count', { target_business_id: businessId });
    if (!reservationResult.response.ok) {
      const message = asString(reservationResult.body?.message) || asString(reservationResult.body?.error) || `Snap Count entitlement check failed (${reservationResult.response.status}).`;
      return json(res, reservationResult.response.status === 401 ? 401 : 502, { error: message, code: 'SNAP_COUNT_ENTITLEMENT_CHECK_FAILED' });
    }
    const entitlement = Array.isArray(reservationResult.body) ? reservationResult.body[0] : reservationResult.body;
    if (!entitlement?.allowed) {
      return json(res, 402, {
        error: entitlement?.message || 'You have reached your Snap Count limit. Upgrade your BizGuard plan to continue.',
        code: 'SNAP_COUNT_LIMIT_REACHED',
        plan_code: entitlement?.plan_code || 'free',
        used_today: Number(entitlement?.used_today || 0),
        remaining_today: entitlement?.remaining_today ?? 0,
        daily_limit: entitlement?.daily_limit ?? 0,
      });
    }
    const reservationId = asString(entitlement?.reservation_id).trim();
    if (!reservationId) return json(res, 502, { error: 'Snap Count reservation was not created. Please retry.', code: 'SNAP_COUNT_RESERVATION_FAILED' });

    const releaseReservation = async () => {
      try { await callSupabaseRpc(supabaseUrl, serviceKey, token, 'release_snap_count', { target_reservation_id: reservationId }); } catch { /* best effort; reservation expires automatically */ }
    };

    const productCatalog = knownProducts.map((p) => ({ id: asString(p?.id), name: asString(p?.name), sku: asString(p?.sku), barcode: p?.barcode || null })).filter((p) => p.id && p.name);
    const prompt = buildPrompt({ mode, productCatalog, barcodeHints });

    let lastError = null;
    let analysisResult = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { response, body: providerBody } = await callOpenAI({ openaiKey, model, image, prompt });
        if (response.ok) {
          analysisResult = normalizeResult(providerBody, mode, model, productCatalog);
          break;
        }
        const message = asString(providerBody?.error?.message) || `Vision provider returned HTTP ${response.status}.`;
        lastError = new Error(message);
        if (response.status !== 429 && response.status < 500) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Vision provider request failed.');
      }
      if (attempt === 0) await sleep(700);
    }

    if (!analysisResult) {
      await releaseReservation();
      return json(res, 502, { error: lastError?.message || 'Vision provider failed.' });
    }

    const commitResult = await callSupabaseRpc(supabaseUrl, serviceKey, token, 'commit_snap_count', { target_reservation_id: reservationId });
    if (!commitResult.response.ok || !commitResult.body) {
      // Do not silently lose the entitlement. The reservation remains pending
      // briefly and can be safely recovered by the next reservation call.
      return json(res, 502, { error: 'Vision completed, but Snap Count entitlement could not be finalized. Please retry.', code: 'SNAP_COUNT_COMMIT_FAILED' });
    }
    return json(res, 200, analysisResult);
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Vision gateway failed.' });
  }
}

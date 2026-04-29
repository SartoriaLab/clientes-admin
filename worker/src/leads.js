import { getGoogleAccessToken, encodeFields, FIRESTORE_BASE } from './firestore-utils.js';

// Rate limit in-memory: best-effort, resets entre deploys/instâncias do Worker
const rateLimitMap = new Map(); // ip → { count, resetAt }

export async function handleLead(request, env, tenants) {
  const origin = request.headers.get('Origin') || '';
  const tenant = tenants[origin];
  if (!tenant) {
    return new Response(JSON.stringify({ ok: false, error: 'origin não autorizada' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: 10 req/min por IP
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const rl = rateLimitMap.get(ip);
  if (rl && rl.resetAt > now && rl.count >= 10) {
    return new Response(JSON.stringify({ ok: false, error: 'rate limit' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!rl || rl.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    rl.count++;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lead = {
    ts: new Date().toISOString(),
    type: pickEnum(body.type, ['whatsapp_click', 'form_submit', 'phone_click'], 'whatsapp_click'),
    source: str(body.source, 64) || 'direct',
    medium: str(body.medium, 64) || null,
    campaign: str(body.campaign, 128) || null,
    content: str(body.content, 128) || null,
    term: str(body.term, 128) || null,
    gclid: str(body.gclid, 256) || null,
    fbclid: str(body.fbclid, 256) || null,
    referrer: str(body.referrer, 512) || null,
    landingPage: str(body.landingPage, 512) || '',
    currentPage: str(body.currentPage, 512) || '',
    sessionId: str(body.sessionId, 64) || '',
    userAgent: str(body.userAgent, 256) || '',
    meta: sanitizeMeta(body.meta),
  };

  const token = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON);
  const colPath = `${FIRESTORE_BASE}/restaurants/${tenant.slug}/leads`;
  const r = await fetch(colPath, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(lead) }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Firestore POST lead: ${r.status} ${txt}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Helpers de sanitização
// ---------------------------------------------------------------------------

function pickEnum(val, options, fallback) {
  return options.includes(val) ? val : fallback;
}

function str(val, maxLen) {
  if (typeof val !== 'string') return null;
  return val.slice(0, maxLen);
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const out = {};
  if (typeof meta.phone === 'string') out.phone = meta.phone.slice(0, 32);
  if (typeof meta.message === 'string') out.message = meta.message.slice(0, 512);
  return out;
}

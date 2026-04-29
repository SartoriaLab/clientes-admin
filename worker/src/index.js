/**
 * Cloudflare Worker: clientes-sync (multi-tenant)
 *
 * Recebe payload do bookmarklet (rodando na aba do Menudino) e grava no Firestore
 * usando service account. O Worker existe porque Firebase Auth barra CORS a partir
 * de `marietabistro.menudino.com`, ent\u00e3o o browser n\u00e3o consegue escrever direto
 * \u2014 delega pra c\u00e1, que usa OAuth server-side.
 *
 * Fluxo:
 *   1. Valida Origin e SHARED_SECRET
 *   2. Assina JWT com SERVICE_ACCOUNT_JSON (Web Crypto RS256)
 *   3. Troca JWT por access_token no Google OAuth
 *   4. L\u00ea cardapio + businessInfo atuais via Firestore REST
 *   5. Converte payload e faz merge defensivo
 *   6. Grava cardapio + businessInfo atualizados
 *   7. Retorna stats
 *
 * Secrets (configurar via `wrangler secret put`):
 *   SERVICE_ACCOUNT_JSON \u2014 conte\u00fado do JSON do service account
 *   SHARED_SECRET        \u2014 token aleat\u00f3rio (32+ chars), mesmo que o bookmarklet envia
 */

import {
  converterMenudino,
  converterBusinessInfo,
  mergeCardapio,
  mergeBusinessInfo
} from './menudino-sync-lib.js';
import {
  PROJECT_ID,
  FIRESTORE_BASE,
  getGoogleAccessToken,
  encodeFields,
  decodeFields
} from './firestore-utils.js';
import { handleLead } from './leads.js';
import { TRACK_JS } from './track-serve.js';

// Bucket GCS do projeto. Confirmado via Firebase Console:
// gs://cardapio-admin-prod.firebasestorage.app (naming novo, pos-out-2024).
const STORAGE_BUCKET = 'cardapio-admin-prod.firebasestorage.app';

// Multi-tenant: Origin → { slug, instagramUrl, handle }.
// Fallback hardcoded — fonte primária é Firestore /tenantConfig/{slug}.
// Worker tenta Firestore primeiro, cai pro hardcoded se não achar.
const TENANTS_FALLBACK = {
  'https://marietabistro.menudino.com': { slug: 'marieta-bistro', instagramUrl: 'https://www.instagram.com/marieta_bistro/', handle: 'marieta_bistro' },
  'https://marietabistro.com.br':       { slug: 'marieta-bistro', instagramUrl: 'https://www.instagram.com/marieta_bistro/', handle: 'marieta_bistro' },
  'https://academiaolimpus.com.br': { slug: 'academia-olimpus', instagramUrl: 'https://www.instagram.com/academiaolimpustaq/', handle: 'academiaolimpustaq' },
  'https://www.academiaolimpus.com.br': { slug: 'academia-olimpus', instagramUrl: 'https://www.instagram.com/academiaolimpustaq/', handle: 'academiaolimpustaq' },
  'https://pizzakidtaquaritinga.com.br':     { slug: 'pizza-kid', instagramUrl: 'https://www.instagram.com/pizzakidtaq/', handle: 'pizzakidtaq' },
  'https://www.pizzakidtaquaritinga.com.br': { slug: 'pizza-kid', instagramUrl: 'https://www.instagram.com/pizzakidtaq/', handle: 'pizzakidtaq' },
  'https://casadecarnesmaissabor.com.br':     { slug: 'casa-de-carnes-mais-sabor', instagramUrl: 'https://www.instagram.com/casadecarnes.maissabor/', handle: 'casadecarnes.maissabor' },
  'https://www.casadecarnesmaissabor.com.br': { slug: 'casa-de-carnes-mais-sabor', instagramUrl: 'https://www.instagram.com/casadecarnes.maissabor/', handle: 'casadecarnes.maissabor' },
  'https://sartorialab.github.io':            { slug: 'wilsons-pizzaria',           instagramUrl: 'https://www.instagram.com/wilsonpizzastq/',           handle: 'wilsonpizzastq' }
};

// Cache em memória do Worker (TTL 5min) pra evitar GET Firestore a cada request
let TENANTS_CACHE = null;
let TENANTS_CACHE_AT = 0;
const TENANTS_TTL_MS = 5 * 60 * 1000;

async function loadTenants(env) {
  if (TENANTS_CACHE && Date.now() - TENANTS_CACHE_AT < TENANTS_TTL_MS) {
    return TENANTS_CACHE;
  }
  try {
    const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON);
    const r = await fetch(`${FIRESTORE_BASE}/tenantConfig`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (r.ok) {
      const list = await r.json();
      const map = {};
      (list.documents || []).forEach(d => {
        const fields = decodeFields(d.fields || {});
        const origins = fields.origins || [];
        origins.forEach(o => { map[o] = { slug: fields.slug, instagramUrl: fields.instagramUrl, handle: fields.handle }; });
      });
      // Merge com fallback (hardcoded ganha de Firestore não, ao contrário)
      TENANTS_CACHE = { ...TENANTS_FALLBACK, ...map };
    } else {
      TENANTS_CACHE = TENANTS_FALLBACK;
    }
  } catch (e) {
    console.error('loadTenants falhou, usando fallback:', e.message);
    TENANTS_CACHE = TENANTS_FALLBACK;
  }
  TENANTS_CACHE_AT = Date.now();
  return TENANTS_CACHE;
}

// Compat: código abaixo ainda referencia TENANTS — alias dinâmico
const TENANTS = new Proxy({}, {
  get(_, k) { return (TENANTS_CACHE || TENANTS_FALLBACK)[k]; },
  ownKeys() { return Object.keys(TENANTS_CACHE || TENANTS_FALLBACK); },
  has(_, k) { return k in (TENANTS_CACHE || TENANTS_FALLBACK); },
  getOwnPropertyDescriptor(_, k) {
    const v = (TENANTS_CACHE || TENANTS_FALLBACK)[k];
    return v ? { enumerable: true, configurable: true, value: v } : undefined;
  }
});
const ALLOWED_ORIGINS = new Proxy([], {
  get(_, k) {
    const arr = Object.keys(TENANTS_CACHE || TENANTS_FALLBACK);
    return typeof arr[k] === 'function' ? arr[k].bind(arr) : arr[k];
  }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Rota OAuth (painel admin) — separa do fluxo bookmarklet
    if (url.pathname.startsWith('/oauth/')) {
      return handleOAuthRoute(request, env, origin, url.pathname);
    }

    // Garante TENANTS atualizados (cache 5min)
    await loadTenants(env);
    const allowed = ALLOWED_ORIGINS.includes(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin);
    }

    // Script de rastreamento - CORS aberto (qualquer site pode carregar)
    if (url.pathname === '/track.js') {
      return serveTrackJs(request);
    }

    // Rota de leads - POST do site do cliente (origin validada em handleLead)
    if (url.pathname === '/lead') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      try {
        const res = await handleLead(request, env, TENANTS_CACHE || TENANTS_FALLBACK);
        return cors(res, origin);
      } catch (e) {
        console.error('lead error:', e && e.stack || e);
        return cors(jsonResponse({ ok: false, error: (e && e.message) || String(e) }, 500), origin);
      }
    }

    // S\u00f3 POST
    if (request.method !== 'POST') {
      return cors(new Response('Method Not Allowed', { status: 405 }), origin);
    }

    // Origin check \u2014 bloqueia XSS de outras origens
    if (!allowed) {
      return new Response('Forbidden: origin', { status: 403 });
    }

    try {
      // Body pode vir como text/plain (pra evitar preflight no bookmarklet)
      const raw = await request.text();
      let body;
      try {
        body = JSON.parse(raw);
      } catch (e) {
        return cors(jsonResponse({ ok: false, error: 'body n\u00e3o \u00e9 JSON v\u00e1lido' }, 400), origin);
      }

      // Shared secret
      if (!body.secret || body.secret !== env.SHARED_SECRET) {
        return cors(jsonResponse({ ok: false, error: 'secret inv\u00e1lido' }, 401), origin);
      }

      // Rota Instagram (bookmarklet rodando em instagram.com)
      if (body.kind === 'instagram') {
        const tenant = TENANTS[origin];
        if (!tenant) return cors(jsonResponse({ ok: false, error: 'tenant desconhecido' }, 400), origin);
        return cors(await syncInstagram(body, env, tenant), origin);
      }

      // Sanity check do payload
      if (!body.merchant || !Array.isArray(body.categories) || typeof body.itemsByCategoryId !== 'object') {
        return cors(jsonResponse({ ok: false, error: 'payload incompleto' }, 400), origin);
      }

      const menudinoTenant = TENANTS[origin];
      if (!menudinoTenant) return cors(jsonResponse({ ok: false, error: 'tenant desconhecido' }, 400), origin);

      // 1. Access token Google
      const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON);

      // 2. L\u00ea estado atual do Firestore
      const [cardapioAtual, businessInfoAtual] = await Promise.all([
        firestoreGetContent('cardapio', accessToken, menudinoTenant.slug),
        firestoreGetContent('businessInfo', accessToken, menudinoTenant.slug)
      ]);

      // 3. Converte + merge
      const cardapioNovo = converterMenudino(body.categories, body.itemsByCategoryId);
      const businessInfoNovo = converterBusinessInfo(body.merchant);
      const merged = mergeCardapio(cardapioAtual, cardapioNovo);
      const businessInfoMerged = mergeBusinessInfo(businessInfoAtual, businessInfoNovo);

      // 4. Grava
      const updatedAt = new Date().toISOString();
      await Promise.all([
        firestorePatchDoc('cardapio', { content: merged.cardapio, updatedAt }, accessToken, menudinoTenant.slug),
        firestorePatchDoc('businessInfo', { content: businessInfoMerged, updatedAt }, accessToken, menudinoTenant.slug)
      ]);

      return cors(jsonResponse({ ok: true, stats: merged.stats, updatedAt }), origin);
    } catch (e) {
      console.error('sync error:', e && e.stack || e);
      return cors(jsonResponse({ ok: false, error: (e && e.message) || String(e) }, 500), origin);
    }
  }
};

// ---------------------------------------------------------------------------
// CORS + helpers
// ---------------------------------------------------------------------------

function cors(res, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', allowed);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(res.body, { status: res.status, headers });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function serveTrackJs(_request) {
  return new Response(TRACK_JS, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ---------------------------------------------------------------------------
// Firestore REST (via access token)
// ---------------------------------------------------------------------------

function docPath(docId, slug) {
  return `${FIRESTORE_BASE}/restaurants/${slug}/data/${docId}`;
}

/**
 * GET de um documento, retornando apenas o `content` decodificado (ou null se 404).
 */
async function firestoreGetContent(docId, accessToken, slug) {
  const r = await fetch(docPath(docId, slug), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Firestore GET ${docId}: HTTP ${r.status} ${txt}`);
  }
  const data = await r.json();
  if (!data.fields) return null;
  const fields = decodeFields(data.fields);
  return fields.content || null;
}

/**
 * PATCH (overwrite) completo do documento com { content, updatedAt }.
 * `updateMask` omitido \u2192 substitui o documento inteiro.
 */
async function firestorePatchDoc(docId, payload, accessToken, slug) {
  const body = { fields: encodeFields(payload) };
  const r = await fetch(docPath(docId, slug), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Firestore PATCH ${docId}: HTTP ${r.status} ${txt}`);
  }
}

// ---------------------------------------------------------------------------
// Instagram sync: bookmarklet manda array de posts, Worker baixa as imagens,
// sobe pro Firebase Storage e grava no Firestore.
// ---------------------------------------------------------------------------

async function syncInstagram(body, env, tenant) {
  if (!Array.isArray(body.posts) || !body.posts.length) {
    return jsonResponse({ ok: false, error: 'posts vazios' }, 400);
  }

  const posts = body.posts.slice(0, 9);

  const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON, [
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/devstorage.read_write'
  ]);

  const uploads = await Promise.all(posts.map((post, i) => uploadInstagramPost(post, i, accessToken, tenant.slug)));

  const content = uploads.map((u, i) => ({
    image: u.publicUrl,
    postUrl: posts[i].postUrl || tenant.instagramUrl,
    alt: posts[i].alt || ('Post do @' + tenant.handle)
  }));

  const updatedAt = new Date().toISOString();
  await firestorePatchDoc('instagram', { content, updatedAt }, accessToken, tenant.slug);

  return jsonResponse({ ok: true, stats: { count: content.length }, updatedAt });
}

async function uploadInstagramPost(post, index, accessToken, slug) {
  if (!post || !post.imageUrl) throw new Error(`post ${index + 1} sem imageUrl`);

  // 1. Baixa a imagem do CDN do Instagram (UA + Referer evitam 403)
  const imgRes = await fetch(post.imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
    }
  });
  if (!imgRes.ok) {
    throw new Error(`download imagem post ${index + 1}: HTTP ${imgRes.status}`);
  }
  const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg';
  const bytes = await imgRes.arrayBuffer();

  // 2. Sobe pro Firebase Storage via GCS multipart upload — single request
  // que envia objeto + metadata. O metadata `firebaseStorageDownloadTokens`
  // eh lido pela API Firebase Storage v0 para autorizar download publico
  // via URL com ?token=<uuid>.
  const token = crypto.randomUUID();
  const objectPath = `instagram/${slug}/post_${index + 1}.jpg`;
  const encodedPath = encodeURIComponent(objectPath);

  const body = buildMultipartBody(objectPath, contentType, token, new Uint8Array(bytes));
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=multipart`;

  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`
    },
    body: body
  });
  if (!upRes.ok) {
    const txt = await upRes.text();
    throw new Error(`upload Storage post ${index + 1}: HTTP ${upRes.status} ${txt}`);
  }

  // URL p\u00fablica via Firebase Storage download endpoint (l\u00ea o metadata
  // firebaseStorageDownloadTokens que setamos no upload).
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${token}`;
  return { publicUrl };
}

const MULTIPART_BOUNDARY = 'CFWorkerBoundary_' + 'x'.repeat(24);

// Monta o body multipart/related para upload via GCS JSON API.
// Parte 1: metadata JSON (name, contentType, metadata.firebaseStorageDownloadTokens)
// Parte 2: bytes da imagem
function buildMultipartBody(objectPath, contentType, downloadToken, bytes) {
  const enc = new TextEncoder();
  const metadataJson = JSON.stringify({
    name: objectPath,
    contentType: contentType,
    metadata: { firebaseStorageDownloadTokens: downloadToken }
  });

  const prefix = enc.encode(
    `--${MULTIPART_BOUNDARY}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    metadataJson + `\r\n` +
    `--${MULTIPART_BOUNDARY}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const suffix = enc.encode(`\r\n--${MULTIPART_BOUNDARY}--`);

  const out = new Uint8Array(prefix.length + bytes.length + suffix.length);
  out.set(prefix, 0);
  out.set(bytes, prefix.length);
  out.set(suffix, prefix.length + bytes.length);
  return out;
}

// ---------------------------------------------------------------------------
// OAuth Google (server-side) — admin painel troca code/refresh sem expor
// GOOGLE_CLIENT_SECRET no bundle do browser. Auth: Firebase ID token + Origin
// allowlist via env ADMIN_ORIGINS (CSV).
//
// Secrets necessários no Worker:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   FIREBASE_API_KEY        (Web API key, para validar ID token)
//   ADMIN_ORIGINS           (csv: https://admin.exemplo.com,https://outro.app)
// ---------------------------------------------------------------------------

async function handleOAuthRoute(request, env, origin, pathname) {
  const adminOrigins = (env.ADMIN_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const adminAllowed = adminOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return adminCors(new Response(null, { status: 204 }), origin, adminAllowed);
  }
  if (!adminAllowed) {
    return new Response('Forbidden: origin', { status: 403 });
  }
  if (request.method !== 'POST') {
    return adminCors(new Response('Method Not Allowed', { status: 405 }), origin, true);
  }

  // Valida Firebase ID token
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return adminCors(jsonResponse({ ok: false, error: 'missing id token' }, 401), origin, true);
  }
  const adminUid = await verifyFirebaseAdmin(idToken, env);
  if (!adminUid) {
    return adminCors(jsonResponse({ ok: false, error: 'invalid id token or not admin' }, 401), origin, true);
  }

  let body;
  try { body = await request.json(); }
  catch { return adminCors(jsonResponse({ ok: false, error: 'json inválido' }, 400), origin, true); }

  try {
    if (pathname === '/oauth/google/exchange') {
      const tokens = await googleExchange(body, env);
      return adminCors(jsonResponse({ ok: true, tokens }), origin, true);
    }
    if (pathname === '/oauth/google/refresh') {
      const tokens = await googleRefresh(body, env);
      return adminCors(jsonResponse({ ok: true, tokens }), origin, true);
    }
    return adminCors(jsonResponse({ ok: false, error: 'rota desconhecida' }, 404), origin, true);
  } catch (e) {
    console.error('oauth error:', e && e.stack || e);
    return adminCors(jsonResponse({ ok: false, error: e.message || String(e) }, 500), origin, true);
  }
}

function adminCors(res, origin, allowed) {
  const headers = new Headers(res.headers);
  if (allowed && origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return new Response(res.body, { status: res.status, headers });
}

async function verifyFirebaseAdmin(idToken, env) {
  if (!env.FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY não configurado');
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const u = data.users && data.users[0];
  if (!u || !u.localId) return null;

  // Confirma role=admin no Firestore
  const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON);
  const userDoc = await fetch(
    `${FIRESTORE_BASE}/users/${u.localId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!userDoc.ok) return null;
  const docJson = await userDoc.json();
  const role = docJson.fields?.role?.stringValue;
  return role === 'admin' ? u.localId : null;
}

async function googleExchange({ code, redirect_uri }, env) {
  if (!code || !redirect_uri) throw new Error('code e redirect_uri obrigatórios');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code'
    })
  });
  if (!r.ok) throw new Error('exchange falhou: ' + (await r.text()));
  return r.json();
}

async function googleRefresh({ refresh_token }, env) {
  if (!refresh_token) throw new Error('refresh_token obrigatório');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token'
    })
  });
  if (!r.ok) throw new Error('refresh falhou: ' + (await r.text()));
  return r.json();
}

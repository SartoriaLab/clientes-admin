/**
 * Cloudflare Worker: marieta-sync
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

const ALLOWED_ORIGINS = [
  'https://marietabistro.menudino.com',
  'https://marietabistro.com.br'
];
const PROJECT_ID = 'cardapio-admin-prod';
const STORAGE_BUCKET = 'cardapio-admin-prod.firebasestorage.app';
const RESTAURANT_SLUG = 'marieta-bistro';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = ALLOWED_ORIGINS.includes(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin);
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
        return cors(await syncInstagram(body, env), origin);
      }

      // Sanity check do payload
      if (!body.merchant || !Array.isArray(body.categories) || typeof body.itemsByCategoryId !== 'object') {
        return cors(jsonResponse({ ok: false, error: 'payload incompleto' }, 400), origin);
      }

      // 1. Access token Google
      const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON);

      // 2. L\u00ea estado atual do Firestore
      const [cardapioAtual, businessInfoAtual] = await Promise.all([
        firestoreGetContent('cardapio', accessToken),
        firestoreGetContent('businessInfo', accessToken)
      ]);

      // 3. Converte + merge
      const cardapioNovo = converterMenudino(body.categories, body.itemsByCategoryId);
      const businessInfoNovo = converterBusinessInfo(body.merchant);
      const merged = mergeCardapio(cardapioAtual, cardapioNovo);
      const businessInfoMerged = mergeBusinessInfo(businessInfoAtual, businessInfoNovo);

      // 4. Grava
      const updatedAt = new Date().toISOString();
      await Promise.all([
        firestorePatchDoc('cardapio', { content: merged.cardapio, updatedAt }, accessToken),
        firestorePatchDoc('businessInfo', { content: businessInfoMerged, updatedAt }, accessToken)
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

// ---------------------------------------------------------------------------
// Google OAuth via service account JWT (RS256 via Web Crypto)
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(serviceAccountJson, scopes) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const scopeList = Array.isArray(scopes) && scopes.length
    ? scopes.join(' ')
    : 'https://www.googleapis.com/auth/datastore';

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: scopeList,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedClaim = base64urlEncode(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  const privateKey = await importPrivateKey(sa.private_key);
  const signatureBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = base64urlEncodeBuffer(signatureBuf);
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token exchange falhou: HTTP ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth sem access_token na resposta');
  return data.access_token;
}

async function importPrivateKey(pem) {
  // Remove header/footer e quebras de linha
  const cleaned = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = base64ToArrayBuffer(cleaned);
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64urlEncode(str) {
  return base64urlEncodeBuffer(new TextEncoder().encode(str));
}

function base64urlEncodeBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Firestore REST (via access token)
// ---------------------------------------------------------------------------

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function docPath(docId) {
  return `${FIRESTORE_BASE}/restaurants/${RESTAURANT_SLUG}/data/${docId}`;
}

/**
 * GET de um documento, retornando apenas o `content` decodificado (ou null se 404).
 */
async function firestoreGetContent(docId, accessToken) {
  const r = await fetch(docPath(docId), {
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
async function firestorePatchDoc(docId, payload, accessToken) {
  const body = { fields: encodeFields(payload) };
  const r = await fetch(docPath(docId), {
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
// Firestore Value <\u2192> JS converters
// https://cloud.google.com/firestore/docs/reference/rest/v1/Value
// ---------------------------------------------------------------------------

function encodeFields(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = encodeValue(obj[k]);
  return out;
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  throw new Error('Tipo n\u00e3o suportado em encodeValue: ' + typeof v);
}

function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}

function decodeValue(val) {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in val) return decodeFields(val.mapValue.fields || {});
  return null;
}

// ---------------------------------------------------------------------------
// Instagram sync: bookmarklet manda array de posts, Worker baixa as imagens,
// sobe pro Firebase Storage e grava no Firestore.
// ---------------------------------------------------------------------------

async function syncInstagram(body, env) {
  if (!Array.isArray(body.posts) || !body.posts.length) {
    return jsonResponse({ ok: false, error: 'posts vazios' }, 400);
  }

  const posts = body.posts.slice(0, 9);

  const accessToken = await getGoogleAccessToken(env.SERVICE_ACCOUNT_JSON, [
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/devstorage.read_write'
  ]);

  const uploads = await Promise.all(posts.map((post, i) => uploadInstagramPost(post, i, accessToken)));

  const content = uploads.map((u, i) => ({
    image: u.publicUrl,
    postUrl: posts[i].postUrl || 'https://www.instagram.com/marieta_bistro/',
    alt: posts[i].alt || 'Post do @marieta_bistro'
  }));

  const updatedAt = new Date().toISOString();
  await firestorePatchDoc('instagram', { content, updatedAt }, accessToken);

  return jsonResponse({ ok: true, stats: { count: content.length }, updatedAt });
}

async function uploadInstagramPost(post, index, accessToken) {
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

  // 2. Sobe pro Firebase Storage via GCS JSON upload API.
  // (firebasestorage.googleapis.com/v0 n\u00e3o aceita uploadType=media; a API
  // oficial do Google Cloud Storage aceita, e o token custom metadata
  // `firebaseStorageDownloadTokens` funciona igual — gera URL publica.)
  const token = crypto.randomUUID();
  const objectPath = `instagram/${RESTAURANT_SLUG}/post_${index + 1}.jpg`;
  const encodedPath = encodeURIComponent(objectPath);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`;

  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
      'x-goog-meta-firebaseStorageDownloadTokens': token
    },
    body: bytes
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

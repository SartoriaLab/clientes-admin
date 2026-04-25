/**
 * menudino-sync.js — orquestração da sync no browser admin.
 *
 * Lógica pura (converter/merge) vive em /shared/menudino-sync-core.js.
 * Este arquivo cuida de:
 *   - parse do cookie / payload do bookmarklet
 *   - fetch direto das APIs Menudino (CORS aberto, IP residencial)
 *   - leitura/escrita Firestore via SDK do browser
 */

import {
  converterMenudino,
  converterBusinessInfo,
  mergeBusinessInfo,
  mergeCardapio
} from '../../shared/menudino-sync-core.js';

export { converterMenudino, converterBusinessInfo, mergeBusinessInfo, mergeCardapio };

const CATALOG_BASE = 'https://menudino-catalog.consumerapis.com/api/v1';
const MERCHANTS_BASE = 'https://menudino-merchants.consumerapis.com/api/v1';

// ---------------------------------------------------------------------------
// Parse do cookie colado pelo user
// ---------------------------------------------------------------------------

export function parseCookieString(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Nada foi colado. Cole o cookie completo do Menudino.');
  }
  const pairs = raw.split(/;\s*/);
  const map = {};
  pairs.forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      map[k] = v;
    }
  });

  const token = map['app-access-token'];
  if (!token) {
    throw new Error('Não encontrei "app-access-token" no cookie colado. Verifique se você copiou a string completa do document.cookie.');
  }

  let merchantId = null;
  let merchantName = null;
  let merchantUrl = null;
  if (map['merchant-summary']) {
    try {
      // merchant-summary é URL-encoded duas vezes (%25 = %)
      let decoded = decodeURIComponent(map['merchant-summary']);
      if (decoded.startsWith('%')) decoded = decodeURIComponent(decoded);
      const obj = JSON.parse(decoded);
      merchantId = obj.id || null;
      merchantName = obj.name || null;
      merchantUrl = obj.url || null;
    } catch (e) {
      // silencioso — token é o essencial
    }
  }

  return { token, merchantId, merchantName, merchantUrl };
}

// ---------------------------------------------------------------------------
// Chamadas à API do Menudino (fetch do browser)
// ---------------------------------------------------------------------------

async function fetchJson(url, token) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} em ${url.split('?')[0]}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchMerchantDetails(token, merchantId) {
  return fetchJson(`${MERCHANTS_BASE}/merchants/${merchantId}`, token);
}

export async function fetchCategories(token, merchantId) {
  const data = await fetchJson(`${CATALOG_BASE}/categories/${merchantId}?OnlyActive=false`, token);
  return data.items || [];
}

export async function fetchItems(token, merchantId, categoryId) {
  const data = await fetchJson(`${CATALOG_BASE}/items/${merchantId}/${categoryId}/summary?SellOnline=false`, token);
  return data.items || [];
}

// ---------------------------------------------------------------------------
// Orquestrador
// ---------------------------------------------------------------------------

export function tryParseBookmarkletPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.merchant && Array.isArray(parsed.categories) && parsed.itemsByCategoryId) {
      return parsed;
    }
  } catch (e) { /* não é JSON válido */ }
  return null;
}

export async function syncMenudinoCardapio({ pastedData, cookieString, firestore, restaurantSlug, onLog, firestoreOps }) {
  const log = onLog || (() => {});
  const { doc, getDoc, setDoc } = firestoreOps;
  const input = pastedData || cookieString || '';

  let merchant, categories, itemsByCategoryId, totalItems = 0;

  const bookmarkletPayload = tryParseBookmarkletPayload(input);
  if (bookmarkletPayload) {
    log('Payload do bookmarklet detectado — dados já vêm prontos.');
    merchant = bookmarkletPayload.merchant;
    categories = bookmarkletPayload.categories;
    itemsByCategoryId = bookmarkletPayload.itemsByCategoryId;
    Object.keys(itemsByCategoryId).forEach(k => { totalItems += itemsByCategoryId[k].length; });
    log(`Merchant: ${merchant.name}`);
    log(`Categorias: ${categories.length}, items totais: ${totalItems}`);
  } else {
    log('Analisando cookie...');
    const { token, merchantId, merchantName } = parseCookieString(input);
    if (!merchantId) {
      throw new Error('Cookie não contém "merchant-summary" — copie o document.cookie a partir da página do seu cardápio (ex: https://SEURESTAURANTE.menudino.com/), ou use o bookmarklet.');
    }
    log(`OK — ${merchantName || 'merchant'} (${merchantId.slice(0, 8)}...)`);

    log('Buscando merchant details...');
    merchant = await fetchMerchantDetails(token, merchantId);
    log(`OK — ${merchant.name}, ${merchant.address && merchant.address.city}`);

    log('Buscando categorias...');
    categories = await fetchCategories(token, merchantId);
    log(`OK — ${categories.length} categorias`);

    log('Buscando items de cada categoria...');
    itemsByCategoryId = {};
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (i > 0) await new Promise(r => setTimeout(r, 80));
      try {
        const items = await fetchItems(token, merchantId, cat.id);
        itemsByCategoryId[cat.id] = items;
        totalItems += items.length;
        log(`  [${i + 1}/${categories.length}] ${cat.name}: ${items.length}`);
      } catch (e) {
        log(`  [${i + 1}/${categories.length}] ${cat.name}: ERRO — ${e.message}`);
        itemsByCategoryId[cat.id] = [];
      }
    }
    log(`Total: ${totalItems} items`);
  }

  log('Lendo cardápio atual do Firestore...');
  const dataCol = `restaurants/${restaurantSlug}/data`;
  const cardapioRef = doc(firestore, `${dataCol}/cardapio`);
  const bizRef = doc(firestore, `${dataCol}/businessInfo`);

  const [cardSnap, bizSnap] = await Promise.all([getDoc(cardapioRef), getDoc(bizRef)]);
  const cardapioAtual = cardSnap.exists() ? (cardSnap.data().content || null) : null;
  const businessInfoAtual = bizSnap.exists() ? (bizSnap.data().content || null) : null;
  log(`OK — cardápio atual: ${cardapioAtual ? (cardapioAtual.length + ' aba(s)') : 'vazio'}`);

  log('Convertendo e fazendo merge...');
  const cardapioNovo = converterMenudino(categories, itemsByCategoryId);
  const businessInfoNovo = converterBusinessInfo(merchant);
  const merged = mergeCardapio(cardapioAtual, cardapioNovo);
  const businessInfoMerged = mergeBusinessInfo(businessInfoAtual, businessInfoNovo);

  log('Escrevendo no Firestore...');
  await setDoc(cardapioRef, { content: merged.cardapio, updatedAt: new Date().toISOString() });
  await setDoc(bizRef, { content: businessInfoMerged, updatedAt: new Date().toISOString() });

  const estruturaFinal = (merged.cardapio || []).map(tab => {
    const nCats = (tab.categorias || []).length;
    let nItens = 0;
    (tab.categorias || []).forEach(c => { nItens += (c.itens || []).length; });
    return { label: tab.label, nCats, nItens };
  });

  log('');
  log('=== Concluído ===');
  log(`Categorias novas: ${merged.stats.categorias_novas}`);
  log(`Reorganizadas: ${merged.stats.categorias_movidas}`);
  log(`Items adicionados: ${merged.stats.adicionados}`);
  log(`Items atualizados: ${merged.stats.atualizados}`);
  log(`Items inativados: ${merged.stats.inativados}`);
  estruturaFinal.forEach(s => log(`  [${s.label}] ${s.nCats} cats, ${s.nItens} items`));

  return { stats: merged.stats, estruturaFinal };
}

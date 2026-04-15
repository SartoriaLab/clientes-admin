/**
 * menudino-sync.js — lógica de sincronização do cardápio Menudino → Firestore,
 * adaptada para rodar dentro do browser do cardapio-admin.
 *
 * Por que no browser?
 *   - O Cloudflare do Menudino bloqueia qualquer IP de datacenter (GitHub
 *     Actions, Cloud Functions, etc) com HTTP 403 "Attention Required".
 *   - Do browser do admin (IP residencial do user), o Cloudflare aceita.
 *   - A API menudino-catalog.consumerapis.com aceita CORS de qualquer origin,
 *     então é possível fazer fetch direto do frontend.
 *
 * Único passo que não pode ser automatizado: obter o `app-access-token`. O user
 * precisa copiar manualmente do cookie do Menudino (ver SyncMenudinoModal).
 */

const CATALOG_BASE = 'https://menudino-catalog.consumerapis.com/api/v1';
const MERCHANTS_BASE = 'https://menudino-merchants.consumerapis.com/api/v1';
const FILES_BASE = 'https://files.menudino.com';

const CATEGORIAS_IGNORAR = ['Complemento'];

const PALAVRAS_BEBIDAS = [
  'bebida', 'drink', 'vinho', 'cerveja', 'cervejas',
  'refrigerante', 'suco', 'sucos', 'cafe', 'café',
  'agua', 'água', 'dose', 'doses', 'whisky', 'vodka',
  'cachaça', 'cachaca', 'gin', 'aperitivo', 'chopp', 'chope'
];

// ---------------------------------------------------------------------------
// Parse do cookie colado pelo user
// ---------------------------------------------------------------------------

/**
 * Parseia uma string de cookies (formato `chave=valor; chave=valor; ...`) e
 * retorna `{ token, merchantId, merchantName, merchantUrl }`.
 * Lança erro se não encontrar o app-access-token.
 */
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
      // merchant-summary é URL-encoded DUAS vezes (%25 = %)
      let decoded = decodeURIComponent(map['merchant-summary']);
      if (decoded.startsWith('%')) decoded = decodeURIComponent(decoded);
      const obj = JSON.parse(decoded);
      merchantId = obj.id || null;
      merchantName = obj.name || null;
      merchantUrl = obj.url || null;
    } catch (e) {
      // silencioso — o token é o essencial, merchantId pode ser inferido depois
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
  // Sem SellOnline=true (restringiria ao delivery do momento)
  const data = await fetchJson(`${CATALOG_BASE}/categories/${merchantId}?OnlyActive=false`, token);
  return data.items || [];
}

export async function fetchItems(token, merchantId, categoryId) {
  // SellOnline=false é a chave — com true, muitos items ficam ocultos
  const data = await fetchJson(`${CATALOG_BASE}/items/${merchantId}/${categoryId}/summary?SellOnline=false`, token);
  return data.items || [];
}

// ---------------------------------------------------------------------------
// Conversão Menudino → formato cardapio-admin
// ---------------------------------------------------------------------------

function prefixHttps(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return FILES_BASE + '/' + url.replace(/^\//, '').replace(/^files\.menudino\.com\//, '');
}

function converterItem(item) {
  let imagem = '';
  if (item.hasPhoto) {
    imagem = prefixHttps(item.largeImageUrl || item.smallImageUrl || '');
  }
  return {
    nome: (item.name || '').trim(),
    desc: (item.description || '').trim(),
    preco: typeof item.salePrice === 'number' ? item.salePrice : 0,
    imagem,
    ativo: true,
    tags: []
  };
}

export function converterMenudino(categories, itemsByCategoryId) {
  const sorted = [...categories].sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));

  const categoriasFinais = [];
  sorted.forEach(cat => {
    if (CATEGORIAS_IGNORAR.indexOf(cat.name) !== -1) return;
    const rawItems = itemsByCategoryId[cat.id] || [];
    if (rawItems.length === 0) return;

    const itens = [...rawItems]
      .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0))
      .map(converterItem);

    categoriasFinais.push({
      titulo: (cat.name || '').trim(),
      nota: '',
      ativo: true,
      itens
    });
  });

  return [{
    id: 'cardapio',
    label: 'Cardápio',
    ativo: true,
    categorias: categoriasFinais
  }];
}

// ---------------------------------------------------------------------------
// businessInfo
// ---------------------------------------------------------------------------

const DIAS_PT = {
  Sunday: 'Dom', Monday: 'Seg', Tuesday: 'Ter',
  Wednesday: 'Qua', Thursday: 'Qui', Friday: 'Sex', Saturday: 'Sáb'
};
const DIAS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatarHora(hhmmss) {
  if (!hhmmss) return '';
  const [h, m] = hhmmss.split(':').map(n => parseInt(n, 10));
  if (m === 0) return `${h}h`;
  return `${h}h${m < 10 ? '0' + m : m}`;
}

export function converterBusinessInfo(merchant) {
  const addr = merchant.address || {};
  const phoneRaw = (merchant.phone || '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const whatsappNumber = phoneDigits.startsWith('55') ? phoneDigits : ('55' + phoneDigits);

  const horariosPorDia = {};
  (merchant.openingHours || []).forEach(h => {
    if (!horariosPorDia[h.dayOfWeek]) horariosPorDia[h.dayOfWeek] = [];
    horariosPorDia[h.dayOfWeek].push({
      start: h.startTime,
      end: h.endTime,
      ehAlmoco: parseInt(h.startTime.split(':')[0], 10) < 17
    });
  });

  const diasAbertos = DIAS_ORDER.filter(d => horariosPorDia[d]);
  let funcionamento = '';
  if (diasAbertos.length === 7) funcionamento = 'Todos os dias';
  else if (diasAbertos.length > 0) funcionamento = diasAbertos.map(d => DIAS_PT[d]).join(', ');

  const almocos = [], jantares = [];
  diasAbertos.forEach(d => {
    horariosPorDia[d].forEach(h => {
      const txt = `${DIAS_PT[d]} ${formatarHora(h.start)}–${formatarHora(h.end)}`;
      if (h.ehAlmoco) almocos.push(txt);
      else jantares.push(txt);
    });
  });

  const completoLinhas = [];
  DIAS_ORDER.forEach(d => {
    const hs = horariosPorDia[d];
    if (!hs) return;
    const parts = hs.map(h => `${formatarHora(h.start)}–${formatarHora(h.end)}`);
    completoLinhas.push(`${DIAS_PT[d]}: ${parts.join(' e ')}`);
  });

  return {
    name: merchant.name || '',
    slogan: '',
    tagline: '',
    whatsapp: phoneRaw,
    whatsappNumber,
    phone: phoneRaw,
    address: [addr.street, addr.number].filter(Boolean).join(', '),
    neighborhood: addr.district || '',
    cityState: [addr.city, addr.state].filter(Boolean).join(' - '),
    cep: addr.zipCode || '',
    instagram: '',
    facebook: '',
    googleMapsLink: '',
    googleMapsEmbed: '',
    hours: {
      funcionamento,
      almoco: almocos.join(' | '),
      jantar: jantares.join(' | '),
      completo: completoLinhas.join(' | ')
    }
  };
}

const BIZ_PRESERVAR_SE_EXISTIR = [
  'slogan', 'tagline', 'instagram', 'facebook', 'googleMapsLink', 'googleMapsEmbed'
];

export function mergeBusinessInfo(atual, novo) {
  if (!atual) return novo;
  const out = { ...novo };
  BIZ_PRESERVAR_SE_EXISTIR.forEach(k => {
    if (atual[k] && atual[k].length > 0) out[k] = atual[k];
  });
  out.hours = { ...(atual.hours || {}), ...(novo.hours || {}) };
  Object.keys(out.hours).forEach(k => {
    if (!out.hours[k] && atual.hours && atual.hours[k]) out.hours[k] = atual.hours[k];
  });
  return out;
}

// ---------------------------------------------------------------------------
// Merge defensivo de cardápio
// ---------------------------------------------------------------------------

function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escolherAbaParaCategoria(resultado, tituloCategoria) {
  const nomeNorm = normalizar(tituloCategoria);
  const ehBebida = PALAVRAS_BEBIDAS.some(p => nomeNorm.indexOf(normalizar(p)) !== -1);

  if (ehBebida) {
    for (let i = 0; i < resultado.length; i++) {
      if (normalizar(resultado[i].label || '').indexOf('bebida') !== -1) return i;
    }
  }
  return 0;
}

function garantirAbasPadrao(resultado) {
  const temCardapio = resultado.some(t => {
    const l = normalizar(t.label);
    return l.indexOf('cardapio') !== -1 || l.indexOf('menu') !== -1;
  });
  const temBebidas = resultado.some(t => normalizar(t.label).indexOf('bebida') !== -1);
  if (!temCardapio) resultado.unshift({ id: 'cardapio', label: 'Cardápio', ativo: true, categorias: [] });
  if (!temBebidas) resultado.push({ id: 'bebidas', label: 'Bebidas', ativo: true, categorias: [] });
  return resultado;
}

export function mergeCardapio(atual, novo) {
  const stats = {
    adicionados: 0,
    atualizados: 0,
    inativados: 0,
    preservados_desc: 0,
    preservados_imagem: 0,
    categorias_novas: 0,
    categorias_movidas: 0
  };

  if (!atual || !Array.isArray(atual) || atual.length === 0) {
    const resultadoInicial = garantirAbasPadrao([]);
    (novo[0].categorias || []).forEach(c => {
      const idx = escolherAbaParaCategoria(resultadoInicial, c.titulo);
      resultadoInicial[idx].categorias.push(c);
      stats.categorias_novas++;
      stats.adicionados += (c.itens || []).length;
    });
    return { cardapio: resultadoInicial, stats };
  }

  let itensAtuaisPorNome = {};
  let catsAtuaisPorTitulo = {};
  atual.forEach((tab, ti) => {
    (tab.categorias || []).forEach((cat, ci) => {
      (cat.itens || []).forEach((item, ii) => {
        const key = normalizar(item.nome);
        if (key) itensAtuaisPorNome[key] = { item, tabIdx: ti, catIdx: ci, itemIdx: ii };
      });
      const ckey = normalizar(cat.titulo);
      if (ckey) catsAtuaisPorTitulo[ckey] = { cat, tabIdx: ti, catIdx: ci };
    });
  });

  let resultado = JSON.parse(JSON.stringify(atual));
  resultado = garantirAbasPadrao(resultado);

  // Reorganiza abas
  let moved = true;
  while (moved) {
    moved = false;
    for (let ti = 0; ti < resultado.length; ti++) {
      const cats = resultado[ti].categorias || [];
      for (let ci = 0; ci < cats.length; ci++) {
        const alvo = escolherAbaParaCategoria(resultado, cats[ci].titulo);
        if (alvo !== ti) {
          const m = cats.splice(ci, 1)[0];
          resultado[alvo].categorias = resultado[alvo].categorias || [];
          resultado[alvo].categorias.push(m);
          stats.categorias_movidas++;
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
  }

  // Re-indexa
  itensAtuaisPorNome = {};
  catsAtuaisPorTitulo = {};
  resultado.forEach((tab, ti) => {
    (tab.categorias || []).forEach((cat, ci) => {
      (cat.itens || []).forEach((item, ii) => {
        const key = normalizar(item.nome);
        if (key) itensAtuaisPorNome[key] = { item, tabIdx: ti, catIdx: ci, itemIdx: ii };
      });
      const ckey = normalizar(cat.titulo);
      if (ckey) catsAtuaisPorTitulo[ckey] = { cat, tabIdx: ti, catIdx: ci };
    });
  });

  const vistosNoMenudino = {};
  const categoriasMenudino = (novo[0] && novo[0].categorias) || [];
  categoriasMenudino.forEach(catNova => {
    const catKey = normalizar(catNova.titulo);
    const match = catsAtuaisPorTitulo[catKey];
    let targetCat;

    if (!match) {
      stats.categorias_novas++;
      const abaIdx = escolherAbaParaCategoria(resultado, catNova.titulo);
      resultado[abaIdx].categorias = resultado[abaIdx].categorias || [];
      targetCat = { titulo: catNova.titulo, nota: '', ativo: true, itens: [] };
      resultado[abaIdx].categorias.push(targetCat);
    } else {
      targetCat = resultado[match.tabIdx].categorias[match.catIdx];
    }

    catNova.itens.forEach(itemNovo => {
      const itemKey = normalizar(itemNovo.nome);
      vistosNoMenudino[itemKey] = true;

      const info = itensAtuaisPorNome[itemKey];
      if (!info) {
        targetCat.itens.push(itemNovo);
        stats.adicionados++;
        return;
      }

      const itemAtual = resultado[info.tabIdx].categorias[info.catIdx].itens[info.itemIdx];
      itemAtual.preco = itemNovo.preco;
      if (itemNovo.desc && itemNovo.desc.length > 0) itemAtual.desc = itemNovo.desc;
      else if (itemAtual.desc) stats.preservados_desc++;
      if (itemNovo.imagem && itemNovo.imagem.length > 0) itemAtual.imagem = itemNovo.imagem;
      else if (itemAtual.imagem) stats.preservados_imagem++;
      itemAtual.nome = itemNovo.nome;
      stats.atualizados++;
    });
  });

  Object.keys(itensAtuaisPorNome).forEach(key => {
    if (vistosNoMenudino[key]) return;
    const info = itensAtuaisPorNome[key];
    const ref = resultado[info.tabIdx].categorias[info.catIdx].itens[info.itemIdx];
    if (ref.ativo !== false) {
      ref.ativo = false;
      stats.inativados++;
    }
  });

  return { cardapio: resultado, stats };
}

// ---------------------------------------------------------------------------
// Orquestrador: executa a sync completa emitindo eventos de progresso
// ---------------------------------------------------------------------------

/**
 * Executa a sincronização completa.
 * @param {Object} params
 * @param {string} params.cookieString - cookie colado pelo user
 * @param {Object} params.firestore - instância do Firestore (db)
 * @param {string} params.restaurantSlug - slug do restaurant (ex: 'marieta-bistro')
 * @param {Function} [params.onLog] - callback(string) chamado para cada linha de log
 * @param {Object} params.firestoreOps - { doc, getDoc, setDoc } do firebase/firestore
 * @returns {Promise<{stats, estruturaFinal}>}
 */
export async function syncMenudinoCardapio({ cookieString, firestore, restaurantSlug, onLog, firestoreOps }) {
  const log = onLog || (() => {});
  const { doc, getDoc, setDoc } = firestoreOps;

  log('Analisando cookie...');
  const { token, merchantId, merchantName } = parseCookieString(cookieString);
  if (!merchantId) {
    throw new Error('Cookie não contém "merchant-summary" — é preciso copiar o document.cookie a partir da página do seu cardápio (ex: https://SEURESTAURANTE.menudino.com/).');
  }
  log(`OK — ${merchantName || 'merchant'} (${merchantId.slice(0, 8)}...)`);

  log('Buscando merchant details...');
  const merchant = await fetchMerchantDetails(token, merchantId);
  log(`OK — ${merchant.name}, ${merchant.address && merchant.address.city}`);

  log('Buscando categorias...');
  const categories = await fetchCategories(token, merchantId);
  log(`OK — ${categories.length} categorias`);

  log('Buscando items de cada categoria...');
  const itemsByCategoryId = {};
  let totalItems = 0;
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

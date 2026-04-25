/**
 * menudino-sync-core.js — transformações puras Menudino → cliente-admin.
 *
 * Compartilhado entre:
 *   - src/lib/menudino-sync.js (browser admin)
 *   - worker/src/menudino-sync-lib.js (Cloudflare Worker)
 *
 * Sem dependências de browser ou Firebase. Só JS puro.
 */

const FILES_BASE = 'https://files.menudino.com';

const CATEGORIAS_IGNORAR = ['Complemento'];

const PALAVRAS_BEBIDAS = [
  'bebida', 'drink', 'vinho', 'cerveja', 'cervejas',
  'refrigerante', 'suco', 'sucos', 'cafe', 'café',
  'agua', 'água', 'dose', 'doses', 'whisky', 'vodka',
  'cachaça', 'cachaca', 'gin', 'aperitivo', 'chopp', 'chope'
];

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

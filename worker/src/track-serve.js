// Inline de worker/public/track.js — edite o .js original, nao este arquivo.
// Wrangler nao suporta import ?raw, entao o conteudo fica inline aqui.
export const TRACK_JS = `(function () {
  'use strict';

  // Configuração: descobre o <script> pelo padrão da URL (async invalida currentScript).
  var scriptTag = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    for (var i = 0; i < all.length; i++) {
      if (all[i].src && all[i].src.indexOf('/track.js') !== -1) return all[i];
    }
    return null;
  })();

  var WORKER_URL = (scriptTag && scriptTag.getAttribute('data-worker')) ||
    'https://clientes-sync.julianodev.workers.dev';
  var TENANT = (scriptTag && scriptTag.src && new URL(scriptTag.src).searchParams.get('t')) || '';

  var STORAGE_KEY = '_cd'; // attribution data (first-touch, 30d)
  var SESSION_KEY = '_cs'; // session id (30d)
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

  // ---------------------------------------------------------------------------
  // UTM / gclid / fbclid da URL atual
  // ---------------------------------------------------------------------------

  function parseUtms() {
    var p = new URLSearchParams(location.search);
    var data = {
      source: p.get('utm_source') || '',
      medium: p.get('utm_medium') || '',
      campaign: p.get('utm_campaign') || '',
      content: p.get('utm_content') || '',
      term: p.get('utm_term') || '',
      gclid: p.get('gclid') || '',
      fbclid: p.get('fbclid') || '',
    };
    // Só retorna se tiver pelo menos uma UTM ou clid
    var hasData = Object.values(data).some(function (v) { return v; });
    return hasData ? data : null;
  }

  // ---------------------------------------------------------------------------
  // localStorage helpers com TTL
  // ---------------------------------------------------------------------------

  function lsGet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj.exp && Date.now() > obj.exp) { localStorage.removeItem(key); return null; }
      return obj.val;
    } catch (e) { return null; }
  }

  function lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify({ val: val, exp: Date.now() + TTL_MS }));
    } catch (e) { /* ignore quota errors */ }
  }

  // ---------------------------------------------------------------------------
  // UUID v4 simples (sem crypto.randomUUID para compat IE11)
  // ---------------------------------------------------------------------------

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ---------------------------------------------------------------------------
  // Inicialização: first-touch attribution + session
  // ---------------------------------------------------------------------------

  var attribution = lsGet(STORAGE_KEY);
  var fresh = parseUtms();

  if (!attribution) {
    // Primeira visita: salva o que tiver (UTMs ou only referrer)
    attribution = fresh || {};
    attribution.referrer = document.referrer || '';
    attribution.landingPage = location.href.split('?')[0];
    lsSet(STORAGE_KEY, attribution);
  } else if (fresh) {
    // Revisita com UTMs novos: sobrescreve (novo canal de tráfego)
    fresh.referrer = document.referrer || '';
    fresh.landingPage = location.href.split('?')[0];
    attribution = fresh;
    lsSet(STORAGE_KEY, attribution);
  }

  var sessionId = lsGet(SESSION_KEY);
  if (!sessionId) {
    sessionId = uuid();
    lsSet(SESSION_KEY, sessionId);
  }

  // ---------------------------------------------------------------------------
  // Dedup: evita duplo-envio em 2s para mesmo tipo
  // ---------------------------------------------------------------------------

  var lastSent = {}; // type → timestamp

  function canSend(type) {
    var now = Date.now();
    if (lastSent[type] && now - lastSent[type] < 2000) return false;
    lastSent[type] = now;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Envio do lead
  // ---------------------------------------------------------------------------

  function sendLead(type, extra) {
    if (!canSend(type)) return;
    var payload = {
      type: type,
      source: attribution.source || 'direct',
      medium: attribution.medium || null,
      campaign: attribution.campaign || null,
      content: attribution.content || null,
      term: attribution.term || null,
      gclid: attribution.gclid || null,
      fbclid: attribution.fbclid || null,
      referrer: attribution.referrer || null,
      landingPage: attribution.landingPage || '',
      currentPage: location.href.split('?')[0],
      sessionId: sessionId,
      userAgent: navigator.userAgent,
      meta: extra || {},
    };

    var url = WORKER_URL.replace(/\/$/, '') + '/lead';
    var body = JSON.stringify(payload);

    // Usa sendBeacon quando disponível (não bloqueia navegação)
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .catch(function () { /* silencia erros de rede */ });
    }
  }

  // ---------------------------------------------------------------------------
  // Reescreve links WhatsApp com UTMs no href (para deep link preservar params)
  // ---------------------------------------------------------------------------

  function rewriteWhatsAppLink(a) {
    var href = a.getAttribute('href') || '';
    if (!href.match(/wa\.me|api\.whatsapp\.com/)) return;
    if (a.dataset.cdRewritten) return;
    a.dataset.cdRewritten = '1';

    // Adiciona listener no clique
    a.addEventListener('click', function () {
      var phone = href.match(/wa\.me\/([0-9]+)/);
      sendLead('whatsapp_click', {
        phone: phone ? phone[1] : null,
        message: new URL(href.startsWith('http') ? href : 'https://x.com' + href).searchParams.get('text') || null,
      });
    }, { passive: true });
  }

  function rewriteTelLink(a) {
    var href = a.getAttribute('href') || '';
    if (!href.startsWith('tel:')) return;
    if (a.dataset.cdRewritten) return;
    a.dataset.cdRewritten = '1';

    a.addEventListener('click', function () {
      sendLead('phone_click', { phone: href.slice(4) });
    }, { passive: true });
  }

  function processLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      rewriteWhatsAppLink(links[i]);
      rewriteTelLink(links[i]);
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver: captura links adicionados dinamicamente (SPA/AJAX)
  // ---------------------------------------------------------------------------

  function observeDom() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'A') { rewriteWhatsAppLink(node); rewriteTelLink(node); }
          var nested = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
          for (var i = 0; i < nested.length; i++) {
            rewriteWhatsAppLink(nested[i]);
            rewriteTelLink(nested[i]);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      processLinks();
      observeDom();
    });
  } else {
    processLinks();
    observeDom();
  }

})();
`;

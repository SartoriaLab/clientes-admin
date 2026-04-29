import { useState } from 'react'

/**
 * Modal de sincronização com Instagram — fluxo 1 clique via bookmarklet.
 *
 * O bookmarklet (arrastado uma vez pra barra de favoritos) roda na aba
 * do Instagram (com IP residencial + sessão logada, bypassa o login-wall
 * que bloqueia data centers), extrai os 9 últimos posts do grid e posta
 * no mesmo Cloudflare Worker do Menudino — que baixa as imagens, sobe
 * pro Firebase Storage e grava o array no Firestore.
 */

const SYNC_SECRET = import.meta.env.VITE_MENUDINO_SYNC_SECRET || ''
const BOOKMARKLET_CONFIGURED = !!SYNC_SECRET

// Mapping slug → { relayUrl, handle, instagramUrl }. Adicione novos clientes aqui.
const RESTAURANT_CONFIG = {
  'marieta-bistro':             { relayUrl: 'https://marietabistro.com.br/sync-instagram.html',         handle: 'marieta_bistro',         instagramUrl: 'https://www.instagram.com/marieta_bistro/' },
  'academia-olimpus':           { relayUrl: 'https://academiaolimpus.com.br/sync-instagram.html',       handle: 'academiaolimpustaq',     instagramUrl: 'https://www.instagram.com/academiaolimpustaq/' },
  'pizza-kid':                  { relayUrl: 'https://pizzakidtaquaritinga.com.br/sync-instagram.html',  handle: 'pizzakidtaq',            instagramUrl: 'https://www.instagram.com/pizzakidtaq/' },
  'casa-de-carnes-mais-sabor':  { relayUrl: 'https://casadecarnesmaissabor.com.br/sync-instagram.html', handle: 'casadecarnes.maissabor', instagramUrl: 'https://www.instagram.com/casadecarnes.maissabor/' },
  'wilsons-pizzaria':           { relayUrl: 'https://sartorialab.github.io/ws/sync-instagram.html',      handle: 'wilsonpizzastq',        instagramUrl: 'https://www.instagram.com/wilsonpizzastq/' }
}

function resolveConfig(restaurantSlug, instagramUrl) {
  const cfg = RESTAURANT_CONFIG[restaurantSlug] || RESTAURANT_CONFIG['marieta-bistro']
  return { ...cfg, instagramUrl: instagramUrl && instagramUrl.trim() ? instagramUrl : cfg.instagramUrl }
}

// Código do bookmarklet (single-line). Contorna o CSP do Instagram (que bloqueia
// fetch pro Cloudflare Worker) navegando pra uma relay page no nosso domínio
// — a relay faz o POST e mostra o resultado sem restrições.
function buildBookmarkletCode(relayUrl, secret, handle) {
  return `(()=>{try{if(!location.hostname.includes('instagram.com')){alert('Abra instagram.com/${handle} primeiro (esta em: '+location.hostname+')');return;}var links=document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');if(!links.length){alert('Nenhum post encontrado. Role um pouco ou abra o perfil @${handle}.');return;}var posts=[];var seen=new Set();for(var i=0;i<links.length&&posts.length<9;i++){var a=links[i];var img=a.querySelector('img');if(!img||!img.src)continue;if(seen.has(a.href))continue;seen.add(a.href);posts.push({imageUrl:img.src,postUrl:a.href,alt:img.alt||''});}if(!posts.length){alert('Nenhum post com imagem encontrado no grid.');return;}if(!confirm('Enviar '+posts.length+' posts para o site?'))return;var payload={kind:'instagram',secret:'${secret}',posts:posts};location.href='${relayUrl}#'+encodeURIComponent(JSON.stringify(payload));}catch(e){alert('Erro: '+(e&&e.message||e));}})();void 0;`
}

function buildBookmarkletAnchorHTML(cfg) {
  if (!BOOKMARKLET_CONFIGURED) return null
  const code = buildBookmarkletCode(cfg.relayUrl, SYNC_SECRET, cfg.handle)
  const href = `javascript:${encodeURIComponent(code)}`
  return `<a href="${href}" draggable="true" title="Arraste pra barra de favoritos. Depois, estando no Instagram, clique pra sincronizar." style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg,#d946ef,#a855f7);color:white;border-radius:8px;font-weight:700;text-decoration:none;cursor:move;box-shadow:0 2px 4px rgba(0,0,0,0.1);user-select:none">📸 Sincronizar Instagram</a>`
}

const TUTORIAL_CSS = `
  @keyframes tutorial-drag {
    0%, 8%   { transform: translate(0, 0) scale(1); opacity: 0; }
    15%      { transform: translate(0, 0) scale(1); opacity: 1; }
    30%      { transform: translate(4px, -2px) scale(1.05); opacity: 1; }
    60%      { transform: translate(-120px, -78px) scale(0.75); opacity: 1; }
    65%, 100% { transform: translate(-120px, -78px) scale(0.75); opacity: 0; }
  }
  @keyframes tutorial-cursor {
    0%, 8%   { transform: translate(10px, 8px); opacity: 0; }
    15%      { transform: translate(10px, 8px); opacity: 1; }
    30%      { transform: translate(14px, 6px); opacity: 1; }
    60%      { transform: translate(-110px, -70px); opacity: 1; }
    65%, 100% { transform: translate(-110px, -70px); opacity: 0; }
  }
  @keyframes tutorial-newbookmark {
    0%, 55%  { opacity: 0; transform: scale(0); }
    62%      { opacity: 1; transform: scale(1.3); }
    70%      { opacity: 1; transform: scale(1); }
    95%      { opacity: 1; transform: scale(1); }
    100%     { opacity: 0; transform: scale(0.95); }
  }
  .ig-tut-ghost    { animation: tutorial-drag 4s infinite ease-in-out; }
  .ig-tut-cursor   { animation: tutorial-cursor 4s infinite ease-in-out; }
  .ig-tut-newitem  { animation: tutorial-newbookmark 4s infinite ease-in-out; }
`

export default function SyncInstagramModal({ isOpen, onClose, instagramUrl, restaurantSlug, onSyncComplete }) {
  const [showTutorial, setShowTutorial] = useState(false)
  const cfg = resolveConfig(restaurantSlug, instagramUrl)
  const BOOKMARKLET_ANCHOR_HTML = buildBookmarkletAnchorHTML(cfg)

  const handleClose = () => {
    if (onSyncComplete) onSyncComplete()
    onClose()
  }

  const handleAbrirInstagram = () => {
    const url = cfg.instagramUrl.startsWith('http') ? cfg.instagramUrl : 'https://' + cfg.instagramUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {showTutorial ? 'Como instalar o sync' : 'Sincronizar com Instagram'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {showTutorial ? 'Assista a animação — depois é só repetir com seu mouse' : 'Puxa as últimas 9 fotos do feed direto do perfil'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
            title="Fechar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {!BOOKMARKLET_CONFIGURED ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900">
              <div className="font-bold mb-1">Sync automática não configurada</div>
              <p className="text-xs">
                A variável <code className="bg-white px-1 rounded">VITE_MENUDINO_SYNC_SECRET</code>{' '}
                não está definida neste build.
              </p>
            </div>
          ) : showTutorial ? (
            <TutorialView onBack={() => setShowTutorial(false)} handle={cfg.handle} />
          ) : (
            <>
              <div className="bg-gradient-to-br from-fuchsia-50 to-purple-50 border-2 border-fuchsia-300 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📸</span>
                    <div className="font-bold text-fuchsia-900 text-base">Sync de 1 clique</div>
                  </div>
                  <button
                    onClick={() => setShowTutorial(true)}
                    className="text-xs font-medium text-fuchsia-700 hover:text-fuchsia-900 hover:bg-fuchsia-100 px-2 py-1 rounded transition"
                    title="Ver animação de como arrastar pra barra de favoritos"
                  >
                    📹 Como funciona?
                  </button>
                </div>

                <ol className="text-sm text-slate-700 space-y-1.5 mb-4 list-decimal pl-5">
                  <li><b>Arraste</b> o botão rosa abaixo pra barra de favoritos do navegador (só precisa fazer isso uma vez).</li>
                  <li>Abra o Instagram no perfil <b>@{cfg.handle}</b> em outra aba (já logado).</li>
                  <li><b>Clique no favorito</b> — você será redirecionado pra tela de sincronização com o resultado.</li>
                </ol>

                <div className="flex items-center gap-3 flex-wrap">
                  <div dangerouslySetInnerHTML={{ __html: BOOKMARKLET_ANCHOR_HTML }} />
                  <button
                    onClick={handleAbrirInstagram}
                    className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center gap-1.5"
                    title="Abrir o Instagram em nova aba"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir Instagram
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  Não vê a barra de favoritos? Pressione <kbd className="border px-1 rounded text-xs bg-white">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs bg-white">Shift</kbd>+<kbd className="border px-1 rounded text-xs bg-white">B</kbd>.
                </p>
              </div>

              <div className="mt-4 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <b className="text-slate-600">Como funciona:</b>{' '}
                O bookmarklet lê as 9 últimas fotos do grid no Instagram (no seu navegador,
                com sua sessão logada — data centers são bloqueados pelo IG), e redireciona
                pra uma página no nosso domínio que envia pro servidor. As imagens são baixadas
                e publicadas direto no site.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
          {showTutorial ? (
            <button
              onClick={() => setShowTutorial(false)}
              className="px-4 py-2 rounded-lg text-sm text-fuchsia-700 hover:bg-fuchsia-100 font-medium flex items-center gap-1"
            >
              ← Voltar
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// TutorialView — animação CSS demonstrando o drag do botão pra barra de favs.
// ===========================================================================

function TutorialView({ onBack, handle }) {
  return (
    <div>
      <style>{TUTORIAL_CSS}</style>

      <div className="relative bg-slate-200 rounded-lg overflow-hidden border border-slate-300 shadow-inner" style={{ height: 240 }}>
        <div className="bg-slate-300 h-5 flex items-center px-2 gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <div className="ml-2 flex-1 bg-white/70 rounded h-2.5"></div>
        </div>

        <div className="bg-white border-b border-slate-300 h-7 flex items-center gap-1.5 px-2 relative">
          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600">
            <span>📁</span>
            <span>Trabalho</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600">
            <span>📷</span>
            <span>Instagram</span>
          </div>
          <div
            className="ig-tut-newitem bg-fuchsia-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5"
            style={{ transformOrigin: 'left center' }}
          >
            📸 Sincronizar
          </div>
        </div>

        <div className="absolute inset-x-0 top-12 bottom-0 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-slate-200">
            <div className="text-[10px] text-slate-400 mb-2">Modal do admin</div>
            <div
              className="inline-block px-3 py-2 rounded text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
            >
              📸 Sincronizar Instagram
            </div>

            <div
              className="ig-tut-ghost absolute"
              style={{
                top: '50%',
                left: '50%',
                marginTop: 8,
                marginLeft: -65,
                background: 'linear-gradient(135deg, #d946ef, #a855f7)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              📸 Sincronizar Instagram
            </div>

            <svg
              className="ig-tut-cursor absolute"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              style={{
                top: '50%',
                left: '50%',
                filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))',
                pointerEvents: 'none'
              }}
            >
              <path
                d="M5 2 L5 18 L9 14 L13 22 L16 20 L12 13 L18 13 Z"
                fill="white"
                stroke="black"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-700">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-600 text-white font-bold flex items-center justify-center text-xs">1</div>
          <p>Se sua <b>barra de favoritos</b> não aparecer no topo do navegador, pressione <kbd className="border px-1 rounded text-xs bg-slate-50">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs bg-slate-50">Shift</kbd>+<kbd className="border px-1 rounded text-xs bg-slate-50">B</kbd>.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-600 text-white font-bold flex items-center justify-center text-xs">2</div>
          <p><b>Clique e segure</b> o botão rosa <span className="inline-block px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-bold">📸 Sincronizar Instagram</span> com o mouse.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-600 text-white font-bold flex items-center justify-center text-xs">3</div>
          <p><b>Arraste pra cima</b> até a barra de favoritos e <b>solte</b>. Pronto — ele vira um favorito.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-600 text-white font-bold flex items-center justify-center text-xs">4</div>
          <p>No futuro, estando na aba do Instagram (<b>@{handle}</b>), <b>clique no favorito</b> e confirme. A aba é redirecionada pra tela de resultado da sincronização.</p>
        </div>
      </div>

      <button
        onClick={onBack}
        className="mt-5 w-full px-4 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-bold"
      >
        Entendi, voltar
      </button>
    </div>
  )
}

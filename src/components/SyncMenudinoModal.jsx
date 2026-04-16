import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

/**
 * Modal de sincronização com Menudino — fluxo 1 clique via bookmarklet.
 *
 * O bookmarklet (arrastado uma vez pra barra de favoritos) roda na aba
 * do Menudino, puxa o cardápio via APIs internas e posta no Cloudflare
 * Worker (marieta-sync) que grava no Firestore. Feedback vem por alert
 * no próprio bookmarklet.
 */

// ---------------------------------------------------------------------------
// Bookmarklet (posta direto no Cloudflare Worker)
//
// Configurado via VITE_MENUDINO_SYNC_WORKER_URL + VITE_MENUDINO_SYNC_SECRET
// definidos no build. React 19 bloqueia javascript: em href JSX, por isso o
// <a> é renderizado via dangerouslySetInnerHTML.
// ---------------------------------------------------------------------------

const WORKER_URL = import.meta.env.VITE_MENUDINO_SYNC_WORKER_URL || ''
const SYNC_SECRET = import.meta.env.VITE_MENUDINO_SYNC_SECRET || ''
const BOOKMARKLET_CONFIGURED = !!(WORKER_URL && SYNC_SECRET)

// Código do bookmarklet (minificado, single-line). Content-Type text/plain
// evita preflight CORS (simple request). O regex captura merchantId do RSC
// payload do Next no HTML da home do Menudino.
function buildBookmarkletCode(workerUrl, secret) {
  return `(async()=>{try{if(!location.hostname.includes('menudino.com')){alert('Abra o Menudino primeiro (esta em: '+location.hostname+')');return;}var r=await fetch('/',{cache:'no-store'});if(!r.ok){alert('fetch / falhou: HTTP '+r.status);return;}var t=r.headers.get('app-access-token');if(!t){alert('Sem app-access-token. Site pode ter mudado.');return;}var h=await r.text(),m=h.match(/merchantSummary[\\\\"\\s:{]*id[\\\\"\\s:]*([a-f0-9-]{36})/);if(!m){alert('merchantId nao encontrado no HTML. Site pode ter mudado.');return;}var mid=m[1],a={headers:{Authorization:'Bearer '+t}},cb='https://menudino-catalog.consumerapis.com/api/v1',mb='https://menudino-merchants.consumerapis.com/api/v1';var me=await(await fetch(mb+'/merchants/'+mid,a)).json();var cr=await(await fetch(cb+'/categories/'+mid+'?OnlyActive=false',a)).json();var cs=cr.items||[];var it={};for(var i=0;i<cs.length;i++){var ir=await(await fetch(cb+'/items/'+mid+'/'+cs[i].id+'/summary?SellOnline=false',a)).json();it[cs[i].id]=ir.items||[];}var res=await fetch('${workerUrl}',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({merchant:me,categories:cs,itemsByCategoryId:it,secret:'${secret}'})});var data=await res.json();if(data.ok){var s=data.stats;alert('OK! '+s.categorias_novas+' categorias novas, '+s.adicionados+' items adicionados, '+s.atualizados+' atualizados, '+s.inativados+' inativados.');}else{alert('Erro do servidor: '+(data.error||'desconhecido'));}}catch(e){alert('Erro: '+(e&&e.message||e));}})();void 0;`
}

function buildBookmarkletAnchorHTML() {
  if (!BOOKMARKLET_CONFIGURED) return null
  const code = buildBookmarkletCode(WORKER_URL, SYNC_SECRET)
  const href = `javascript:${encodeURIComponent(code)}`
  return `<a href="${href}" draggable="true" title="Arraste pra barra de favoritos. Depois, estando na aba do Menudino, clique pra sincronizar." style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg,#059669,#047857);color:white;border-radius:8px;font-weight:700;text-decoration:none;cursor:move;box-shadow:0 2px 4px rgba(0,0,0,0.1);user-select:none">⬇️ Sincronizar Marieta</a>`
}

const BOOKMARKLET_ANCHOR_HTML = buildBookmarkletAnchorHTML()

// CSS das animações do tutorial. Inline porque é específico deste componente
// e não vale criar arquivo separado. Duas animações sincronizadas (4s loop):
//  - tutorial-drag: cursor+fantasma do botão saem do centro e voam pra barra
//  - tutorial-newbookmark: favorito novo aparece na barra quando o drag chega
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
  .tutorial-ghost    { animation: tutorial-drag 4s infinite ease-in-out; }
  .tutorial-cursor   { animation: tutorial-cursor 4s infinite ease-in-out; }
  .tutorial-newitem  { animation: tutorial-newbookmark 4s infinite ease-in-out; }
`

export default function SyncMenudinoModal({ isOpen, onClose, restaurantSlug, onSyncComplete }) {
  const [menudinoUrl, setMenudinoUrl] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)

  const handleClose = () => {
    if (onSyncComplete) onSyncComplete()
    onClose()
  }

  // Carrega a URL salva do restaurant doc ao abrir
  useEffect(() => {
    if (!isOpen || !restaurantSlug) return
    setShowTutorial(false) // reset tutorial ao reabrir
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'restaurants', restaurantSlug))
        if (snap.exists()) {
          const data = snap.data()
          if (data.menudinoUrl) {
            setMenudinoUrl(data.menudinoUrl)
          } else if (data.slug || data.id) {
            const slug = data.slug || data.id || restaurantSlug
            setMenudinoUrl(`https://${slug.replace(/-/g, '')}.menudino.com/`)
          }
        }
      } catch (e) {
        console.warn('Não conseguiu carregar menudinoUrl do restaurant doc:', e)
      }
    })()
  }, [isOpen, restaurantSlug])

  const handleAbrirMenudino = async () => {
    if (!menudinoUrl) return
    let url = menudinoUrl.trim()
    if (!/^https?:\/\//.test(url)) url = 'https://' + url
    window.open(url, '_blank', 'noopener,noreferrer')
    if (restaurantSlug) {
      try {
        await updateDoc(doc(db, 'restaurants', restaurantSlug), { menudinoUrl })
      } catch (e) {
        console.warn('Não salvou menudinoUrl:', e)
      }
    }
  }

  if (!isOpen) return null

  const urlValida = menudinoUrl && menudinoUrl.includes('menudino.com')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {showTutorial ? 'Como instalar o sync' : 'Sincronizar com Menudino'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {showTutorial ? 'Assista a animação — depois é só repetir com seu mouse' : 'Puxa o cardápio direto do seu Menudino'}
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
            // Fallback: env vars não configurados (dev local sem .env preenchido)
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900">
              <div className="font-bold mb-1">Sync automática não configurada</div>
              <p className="text-xs">
                As variáveis <code className="bg-white px-1 rounded">VITE_MENUDINO_SYNC_WORKER_URL</code> e{' '}
                <code className="bg-white px-1 rounded">VITE_MENUDINO_SYNC_SECRET</code> não estão definidas
                neste build. Veja <code className="bg-white px-1 rounded">worker/README.md</code>.
              </p>
            </div>
          ) : showTutorial ? (
            // ==================== VIEW: TUTORIAL ====================
            <TutorialView onBack={() => setShowTutorial(false)} />
          ) : (
            // ==================== VIEW: PRINCIPAL ====================
            <>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <div className="font-bold text-emerald-900 text-base">Sync de 1 clique</div>
                  </div>
                  <button
                    onClick={() => setShowTutorial(true)}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 px-2 py-1 rounded transition"
                    title="Ver animação de como arrastar pra barra de favoritos"
                  >
                    📹 Como funciona?
                  </button>
                </div>

                <ol className="text-sm text-slate-700 space-y-1.5 mb-4 list-decimal pl-5">
                  <li><b>Arraste</b> o botão verde abaixo pra barra de favoritos do navegador (só precisa fazer isso uma vez).</li>
                  <li>Abra o Menudino em uma aba.</li>
                  <li><b>Clique no favorito</b> — o cardápio atualiza sozinho em ~10s.</li>
                </ol>

                <div className="flex items-center gap-3 flex-wrap">
                  <div dangerouslySetInnerHTML={{ __html: BOOKMARKLET_ANCHOR_HTML }} />
                  {urlValida && (
                    <button
                      onClick={handleAbrirMenudino}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center gap-1.5"
                      title="Abrir seu Menudino em nova aba"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Abrir Menudino
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  Não vê a barra de favoritos? Pressione <kbd className="border px-1 rounded text-xs bg-white">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs bg-white">Shift</kbd>+<kbd className="border px-1 rounded text-xs bg-white">B</kbd>.
                </p>
              </div>

              {!urlValida && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    URL do seu Menudino
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={menudinoUrl}
                      onChange={e => setMenudinoUrl(e.target.value)}
                      placeholder="https://seurestaurante.menudino.com/"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:border-amber-500 outline-none"
                    />
                    <button
                      onClick={handleAbrirMenudino}
                      disabled={!menudinoUrl}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium disabled:opacity-40"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
          {showTutorial ? (
            <button
              onClick={() => setShowTutorial(false)}
              className="px-4 py-2 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 font-medium flex items-center gap-1"
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

function TutorialView({ onBack }) {
  return (
    <div>
      <style>{TUTORIAL_CSS}</style>

      {/* Stage: simulação do browser */}
      <div className="relative bg-slate-200 rounded-lg overflow-hidden border border-slate-300 shadow-inner" style={{ height: 240 }}>
        {/* Barra de URLs (chrome do navegador — topo cinza) */}
        <div className="bg-slate-300 h-5 flex items-center px-2 gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <div className="ml-2 flex-1 bg-white/70 rounded h-2.5"></div>
        </div>

        {/* Barra de favoritos (onde o drag vai chegar) */}
        <div className="bg-white border-b border-slate-300 h-7 flex items-center gap-1.5 px-2 relative">
          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600">
            <span>📁</span>
            <span>Trabalho</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600">
            <span>⭐</span>
            <span>Menudino</span>
          </div>
          {/* Favorito novo que aparece quando o drag chega */}
          <div
            className="tutorial-newitem bg-emerald-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5"
            style={{ transformOrigin: 'left center' }}
          >
            ⬇️ Sincronizar
          </div>
        </div>

        {/* Conteúdo: modal "fake" com botão verde no centro */}
        <div className="absolute inset-x-0 top-12 bottom-0 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-slate-200">
            <div className="text-[10px] text-slate-400 mb-2">Modal do admin</div>
            <div
              className="inline-block px-3 py-2 rounded text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
            >
              ⬇️ Sincronizar Marieta
            </div>

            {/* Fantasma do botão arrastado (animado) */}
            <div
              className="tutorial-ghost absolute"
              style={{
                top: '50%',
                left: '50%',
                marginTop: 8,
                marginLeft: -65,
                background: 'linear-gradient(135deg, #059669, #047857)',
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
              ⬇️ Sincronizar Marieta
            </div>

            {/* Cursor animado */}
            <svg
              className="tutorial-cursor absolute"
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

      {/* Instruções detalhadas */}
      <div className="mt-4 space-y-3 text-sm text-slate-700">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">1</div>
          <p>Se sua <b>barra de favoritos</b> não aparecer no topo do navegador, pressione <kbd className="border px-1 rounded text-xs bg-slate-50">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs bg-slate-50">Shift</kbd>+<kbd className="border px-1 rounded text-xs bg-slate-50">B</kbd>.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">2</div>
          <p><b>Clique e segure</b> o botão verde <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">⬇️ Sincronizar Marieta</span> com o mouse.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">3</div>
          <p><b>Arraste pra cima</b> até a barra de favoritos e <b>solte</b>. Pronto — ele vira um favorito.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">4</div>
          <p>No futuro, estando na aba do Menudino, é só <b>clicar no favorito</b> e aguardar ~10s pelo aviso.</p>
        </div>
      </div>

      <button
        onClick={onBack}
        className="mt-5 w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
      >
        Entendi, voltar
      </button>
    </div>
  )
}

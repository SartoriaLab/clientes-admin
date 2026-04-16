import { useState, useRef, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { syncMenudinoCardapio, tryParseBookmarkletPayload } from '../lib/menudino-sync'

/**
 * Modal para sincronizar o cardápio a partir do Menudino.
 *
 * Fluxo otimizado (3 cliques depois do bookmarklet instalado):
 *   1. [Abrir Menudino] → abre o cardápio do cliente em outra aba
 *   2. Na aba do Menudino → clica no bookmarklet da barra de favoritos
 *      (cookie copia automaticamente pro clipboard)
 *   3. [Colar e sincronizar] → lê o clipboard e dispara a sync
 *
 * Fallback: se o clipboard API não funcionar, há um textarea para colar manualmente.
 */

// Código que faz TUDO do lado do Menudino:
//   1. Valida que o user está em *.menudino.com
//   2. fetch('/') para pegar app-access-token do response header
//   3. Extrai merchantId do HTML via regex do __next_f (RSC data)
//   4. Chama menudino-merchants e menudino-catalog com Authorization
//   5. Monta payload JSON e copia pro clipboard
//
// Uso: o user copia este texto via botão "Copiar código", abre o Menudino,
// F12 → Console → Ctrl+V → Enter. O JSON resultante fica no clipboard pra
// ser colado no cardapio-admin. Fluxo manual (fallback); o caminho preferido
// para marieta-bistro é o bookmarklet que posta direto no Worker.
const SNIPPET_CODE = `(async()=>{try{if(!location.hostname.includes('menudino.com')){alert('Voce nao esta em *.menudino.com. Host: '+location.hostname);return;}var r=await fetch('/',{cache:'no-store'});if(!r.ok){alert('fetch / falhou: HTTP '+r.status);return;}var t=r.headers.get('app-access-token');if(!t){alert('Sem header app-access-token. O site pode ter mudado.');return;}var h=await r.text(),m=h.match(/merchantSummary[\\\\"\\s:{]*id[\\\\"\\s:]*([a-f0-9-]{36})/);if(!m){alert('Nao achei merchantId no HTML. O site pode ter mudado.');return;}var mid=m[1],a={headers:{Authorization:'Bearer '+t}},cb='https://menudino-catalog.consumerapis.com/api/v1',mb='https://menudino-merchants.consumerapis.com/api/v1';var me=await(await fetch(mb+'/merchants/'+mid,a)).json();var cr=await(await fetch(cb+'/categories/'+mid+'?OnlyActive=false',a)).json();var cs=cr.items||[];var it={},tt=0;for(var i=0;i<cs.length;i++){var ir=await(await fetch(cb+'/items/'+mid+'/'+cs[i].id+'/summary?SellOnline=false',a)).json();it[cs[i].id]=ir.items||[];tt+=it[cs[i].id].length;}var p=JSON.stringify({version:1,merchant:me,categories:cs,itemsByCategoryId:it});var ok=function(){alert('OK! '+cs.length+' categorias e '+tt+' items copiados ('+p.length+' chars). Volte ao cardapio-admin e clique em Colar e sincronizar.');};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(p).then(ok,function(){var x=document.createElement('textarea');x.value=p;x.style.position='fixed';x.style.top='0';x.style.opacity='0';document.body.appendChild(x);x.focus();x.select();try{document.execCommand('copy');document.body.removeChild(x);ok();}catch(e){document.body.removeChild(x);prompt('Copie:',p);}});}else{prompt('Copie:',p);}}catch(e){alert('Erro: '+(e&&e.message||e));}})();`

// ---------------------------------------------------------------------------
// Bookmarklet de 1 clique (posta direto no Cloudflare Worker)
//
// Quando configurado (VITE_MENUDINO_SYNC_WORKER_URL + VITE_MENUDINO_SYNC_SECRET
// definidos no build), renderiza um <a href="javascript:..."> que o dono
// arrasta pra barra de favoritos do browser. Clicando nele estando na aba
// do Menudino, o cardápio é sincronizado num clique só.
//
// Não depende do fluxo manual (que continua funcionando como fallback).
// Só é mostrado pra marieta-bistro porque é o único cliente com Worker
// provisionado no momento.
// ---------------------------------------------------------------------------

const WORKER_URL = import.meta.env.VITE_MENUDINO_SYNC_WORKER_URL || ''
const SYNC_SECRET = import.meta.env.VITE_MENUDINO_SYNC_SECRET || ''
const BOOKMARKLET_CONFIGURED = !!(WORKER_URL && SYNC_SECRET)

// Código do bookmarklet (minificado, single-line). Padrão de regex igual
// ao SNIPPET_CODE; diferença: em vez de copiar pro clipboard, POSTa no Worker.
// Content-Type text/plain evita preflight CORS (simple request).
function buildBookmarkletCode(workerUrl, secret) {
  return `(async()=>{try{if(!location.hostname.includes('menudino.com')){alert('Abra o Menudino primeiro (esta em: '+location.hostname+')');return;}var r=await fetch('/',{cache:'no-store'});if(!r.ok){alert('fetch / falhou: HTTP '+r.status);return;}var t=r.headers.get('app-access-token');if(!t){alert('Sem app-access-token. Site pode ter mudado.');return;}var h=await r.text(),m=h.match(/merchantSummary[\\\\"\\s:{]*id[\\\\"\\s:]*([a-f0-9-]{36})/);if(!m){alert('merchantId nao encontrado no HTML. Site pode ter mudado.');return;}var mid=m[1],a={headers:{Authorization:'Bearer '+t}},cb='https://menudino-catalog.consumerapis.com/api/v1',mb='https://menudino-merchants.consumerapis.com/api/v1';var me=await(await fetch(mb+'/merchants/'+mid,a)).json();var cr=await(await fetch(cb+'/categories/'+mid+'?OnlyActive=false',a)).json();var cs=cr.items||[];var it={};for(var i=0;i<cs.length;i++){var ir=await(await fetch(cb+'/items/'+mid+'/'+cs[i].id+'/summary?SellOnline=false',a)).json();it[cs[i].id]=ir.items||[];}var res=await fetch('${workerUrl}',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({merchant:me,categories:cs,itemsByCategoryId:it,secret:'${secret}'})});var data=await res.json();if(data.ok){var s=data.stats;alert('OK! '+s.categorias_novas+' categorias novas, '+s.adicionados+' items adicionados, '+s.atualizados+' atualizados, '+s.inativados+' inativados.');}else{alert('Erro do servidor: '+(data.error||'desconhecido'));}}catch(e){alert('Erro: '+(e&&e.message||e));}})();void 0;`
}

// Monta o HTML do <a> com href="javascript:..." URL-encoded. Usado via
// dangerouslySetInnerHTML porque o React 19 bloqueia javascript: em href JSX.
function buildBookmarkletAnchorHTML() {
  if (!BOOKMARKLET_CONFIGURED) return null
  const code = buildBookmarkletCode(WORKER_URL, SYNC_SECRET)
  // encodeURIComponent encode ":", "/", "\"", "&", "<", ">", etc — garante
  // que o href fique seguro em HTML double-quoted e que o browser decode
  // corretamente antes de avaliar o JS.
  const href = `javascript:${encodeURIComponent(code)}`
  return `<a href="${href}" draggable="true" title="Arraste pra barra de favoritos. Depois, estando na aba do Menudino, clique pra sincronizar." style="display:inline-block;padding:10px 18px;background:linear-gradient(135deg,#059669,#047857);color:white;border-radius:8px;font-weight:700;text-decoration:none;cursor:move;box-shadow:0 2px 4px rgba(0,0,0,0.1);user-select:none">⬇️ Sincronizar Marieta</a>`
}

const BOOKMARKLET_ANCHOR_HTML = buildBookmarkletAnchorHTML()

export default function SyncMenudinoModal({ isOpen, onClose, restaurantSlug, onSyncComplete }) {
  const [menudinoUrl, setMenudinoUrl] = useState('')
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [clipboardChecked, setClipboardChecked] = useState(false)
  const [showManualPaste, setShowManualPaste] = useState(false)
  const logEndRef = useRef(null)
  const modalBodyRef = useRef(null)
  const resultAnchorRef = useRef(null)

  const [snippetCopied, setSnippetCopied] = useState(false)

  const copySnippetToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET_CODE)
      setSnippetCopied(true)
      setTimeout(() => setSnippetCopied(false), 2500)
    } catch (e) {
      // Fallback: selecionar o textarea
      alert('Não consegui copiar automaticamente. Selecione o texto no campo abaixo e use Ctrl+C.')
    }
  }

  // Autoscroll dos logs
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Quando chega sucesso ou erro, rola a modal até o card de resultado
  // pro user ver imediatamente (senão ele pode ficar olhando o espaço dos logs)
  useEffect(() => {
    if ((success || error) && resultAnchorRef.current) {
      resultAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [success, error])

  // Carrega a URL salva do restaurant doc e reset ao abrir
  useEffect(() => {
    if (!isOpen) return
    setCookie('')
    setLogs([])
    setError(null)
    setSuccess(null)
    setLoading(false)
    setClipboardChecked(false)
    setShowManualPaste(false)

    if (!restaurantSlug) return
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'restaurants', restaurantSlug))
        if (snap.exists()) {
          const data = snap.data()
          if (data.menudinoUrl) {
            setMenudinoUrl(data.menudinoUrl)
          } else if (data.slug || data.id) {
            // Sugestão razoável baseada no slug
            const slug = data.slug || data.id || restaurantSlug
            setMenudinoUrl(`https://${slug.replace(/-/g, '')}.menudino.com/`)
          }
        }
      } catch (e) {
        console.warn('Não conseguiu carregar menudinoUrl do restaurant doc:', e)
      }
    })()
  }, [isOpen, restaurantSlug])

  const doSync = useCallback(async (pastedData) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setLogs([])

    try {
      const result = await syncMenudinoCardapio({
        pastedData,
        firestore: db,
        restaurantSlug,
        firestoreOps: { doc, getDoc, setDoc },
        onLog: (line) => setLogs(prev => [...prev, line])
      })

      // Salva a URL do menudino no restaurant doc pra próxima vez
      if (menudinoUrl && restaurantSlug) {
        try {
          await updateDoc(doc(db, 'restaurants', restaurantSlug), { menudinoUrl })
        } catch (e) {
          console.warn('Não salvou menudinoUrl:', e)
        }
      }

      setSuccess(result)
      if (onSyncComplete) onSyncComplete()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [restaurantSlug, menudinoUrl, onSyncComplete])

  const validarConteudo = (text) => {
    if (!text) return { ok: false, reason: 'vazio' }
    // Se começa com { é o novo payload JSON do bookmarklet
    const bp = tryParseBookmarkletPayload(text)
    if (bp) return { ok: true, kind: 'bookmarklet', totalItems: Object.values(bp.itemsByCategoryId).reduce((a, xs) => a + xs.length, 0) }
    // Legado: cookie string
    if (text.indexOf('app-access-token') !== -1) return { ok: true, kind: 'cookie' }
    return { ok: false, reason: 'nenhum formato reconhecido' }
  }

  const handlePasteFromClipboard = async () => {
    setError(null)
    setClipboardChecked(true)
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        setError('O clipboard está vazio. Clique no bookmarklet "Sincronizar Menudino" na barra de favoritos (estando na página do Menudino) e tente de novo.')
        setShowManualPaste(true)
        return
      }
      const v = validarConteudo(text)
      if (!v.ok) {
        const preview = text.length > 200 ? text.slice(0, 200) + '…' : text
        setError(
          `Encontrei algo no clipboard mas não reconheci o formato.\n\n` +
          `Tamanho: ${text.length} caracteres\n` +
          `Início: "${preview}"\n\n` +
          `Esperado: um JSON do bookmarklet (começando com "{") ou uma string de cookie com "app-access-token=".\n\n` +
          `Certifique-se de clicar no bookmarklet ESTANDO na aba do Menudino (não no cardapio-admin) e aguardar o alert "OK! ... copiados" antes de voltar aqui.`
        )
        setShowManualPaste(true)
        setCookie(text)
        return
      }
      setCookie(text)
      await doSync(text)
    } catch (e) {
      setError(
        'Não consegui ler o clipboard automaticamente. Isto pode acontecer se:\n' +
        '• Seu browser pediu permissão e você negou/ignorou\n' +
        '• O foco não está na janela do admin (clique nesta janela antes de clicar no botão)\n' +
        '• Estamos em HTTP (precisa ser HTTPS ou localhost)\n\n' +
        `Detalhes: ${e.message || e}\n\n` +
        'Use o modo manual abaixo — cole direto no textarea.'
      )
      setShowManualPaste(true)
    }
  }

  const handleTestClipboard = async () => {
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      const preview = !text ? '(vazio)' : (text.length > 300 ? text.slice(0, 300) + '…' : text)
      const v = validarConteudo(text || '')
      const kindMsg = v.ok ? (v.kind === 'bookmarklet' ? `JSON do bookmarklet (${v.totalItems} items)` : 'Cookie string (legado)') : `Não reconhecido (${v.reason})`
      alert(
        `Clipboard (${text ? text.length : 0} chars):\n\n${preview}\n\nFormato: ${kindMsg}`
      )
    } catch (e) {
      alert('Erro ao ler o clipboard: ' + (e.message || e))
    }
  }

  const handleManualSync = () => {
    if (!cookie.trim()) return
    doSync(cookie)
  }

  const handleAbrirMenudino = () => {
    if (!menudinoUrl) return
    let url = menudinoUrl.trim()
    if (!/^https?:\/\//.test(url)) url = 'https://' + url
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  const urlValida = menudinoUrl && menudinoUrl.includes('menudino.com')
  const cookieValido = cookie.trim().length > 20 && (cookie.indexOf('app-access-token') !== -1 || cookie.trim().startsWith('{'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Sincronizar com Menudino</h2>
            <p className="text-xs text-slate-500 mt-0.5">Puxa o cardápio e horários direto do seu Menudino</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
            title="Fechar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div ref={modalBodyRef} className="px-6 py-4 overflow-y-auto flex-1">
          {/* Âncora de resultado — posicionada aqui pra que success/error
              apareçam no TOPO da modal quando o sync termina. */}
          <div ref={resultAnchorRef} />

          {/* Success — renderizado no topo pra ser o primeiro a ver */}
          {success && (
            <div className="mb-4 bg-green-50 border-2 border-green-400 rounded-xl p-4 text-sm text-green-900 shadow-sm">
              <div className="font-bold text-base mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sincronização concluída com sucesso!
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3">
                <div>Categorias novas: <b>{success.stats.categorias_novas}</b></div>
                <div>Reorganizadas: <b>{success.stats.categorias_movidas}</b></div>
                <div>Items adicionados: <b>{success.stats.adicionados}</b></div>
                <div>Items atualizados: <b>{success.stats.atualizados}</b></div>
                <div>Items inativados: <b>{success.stats.inativados}</b></div>
                <div>Desc preservadas: <b>{success.stats.preservados_desc}</b></div>
              </div>
              <div className="mt-3 border-t border-green-200 pt-2">
                <div className="font-medium mb-1 text-xs">Estrutura final no cardapio-admin:</div>
                {success.estruturaFinal.map((s, i) => (
                  <div key={i} className="text-xs">
                    📁 <b>{s.label}</b> — {s.nCats} categorias, {s.nItens} items
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-green-700">
                O cardápio já foi atualizado no Firestore. Você pode fechar este modal ou rodar de novo se precisar.
              </div>
            </div>
          )}

          {/* Error — renderizado no topo também */}
          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-xl p-4 text-sm text-red-800 shadow-sm">
              <div className="font-bold text-base mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Erro na sincronização
              </div>
              <div className="whitespace-pre-wrap break-words text-xs mt-2">{error}</div>
            </div>
          )}

          {/* Setup section — fica sempre visível (não depende de success) */}

              {/* Bookmarklet de 1 clique — só pra marieta-bistro com env vars configurados */}
              {BOOKMARKLET_ANCHOR_HTML && restaurantSlug === 'marieta-bistro' && (
                <>
                  <div className="mb-4 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚡</span>
                      <div className="font-bold text-emerald-900">Sync de 1 clique (recomendado)</div>
                    </div>
                    <p className="text-xs text-slate-700 mb-3">
                      Arraste o botão abaixo pra <b>barra de favoritos</b> do seu navegador
                      (fazer isso só uma vez). Depois, estando na aba do Menudino, é só
                      clicar nele — cardápio atualiza sozinho em ~10s, sem abrir Console
                      nem este modal.
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: BOOKMARKLET_ANCHOR_HTML }} />
                    <p className="text-xs text-slate-500 mt-3">
                      Como funciona: o botão roda um script na aba do Menudino que puxa
                      seu cardápio e manda pro nosso servidor (Cloudflare Worker), que
                      grava no Firestore. Um alert confirma o resultado.
                    </p>
                  </div>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-slate-400">ou use o fluxo manual (fallback)</span>
                    </div>
                  </div>
                </>
              )}

              {/* Input URL Menudino */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  URL do seu Menudino
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={menudinoUrl}
                    onChange={e => setMenudinoUrl(e.target.value)}
                    disabled={loading}
                    placeholder="https://seurestaurante.menudino.com/"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:border-amber-500 outline-none disabled:bg-slate-50"
                  />
                  <button
                    onClick={handleAbrirMenudino}
                    disabled={!urlValida || loading}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Abrir em nova aba"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Será aberto numa aba nova. Clique no bookmarklet da barra de favoritos quando a página carregar.</p>
              </div>

              {/* Passos novos: console-based */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-slate-700">
                <div className="font-bold mb-3 text-slate-800">Passos:</div>
                <ol className="list-decimal pl-5 space-y-2 text-slate-700">
                  <li>
                    <b>Copie o código</b> abaixo
                    <button
                      onClick={copySnippetToClipboard}
                      className={`ml-2 px-3 py-1 rounded-md text-xs font-medium transition ${
                        snippetCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      {snippetCopied ? '✓ Copiado' : '📋 Copiar código'}
                    </button>
                  </li>
                  <li>
                    <b>Abra</b> o seu Menudino em outra aba
                    <button
                      onClick={handleAbrirMenudino}
                      disabled={!urlValida}
                      className="ml-2 px-3 py-1 rounded-md text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40"
                    >
                      Abrir Menudino
                    </button>
                  </li>
                  <li>Na aba do Menudino, pressione <kbd className="border px-1 rounded text-xs bg-white">F12</kbd> → aba <b>Console</b></li>
                  <li>Cole o código (<kbd className="border px-1 rounded text-xs bg-white">Ctrl</kbd>+<kbd className="border px-1 rounded text-xs bg-white">V</kbd>) e pressione <kbd className="border px-1 rounded text-xs bg-white">Enter</kbd></li>
                  <li>Aguarde o alert dizer "OK! X categorias, Y items copiados"</li>
                  <li>Volte aqui e clique em <b>"Colar e sincronizar"</b></li>
                </ol>
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Ver o código que vai ser colado</summary>
                  <textarea
                    readOnly
                    value={SNIPPET_CODE}
                    onClick={e => e.target.select()}
                    rows={6}
                    className="mt-2 w-full px-2 py-1.5 rounded border border-slate-300 text-[10px] font-mono text-slate-600 bg-slate-50 resize-none"
                  />
                </details>
              </div>

              {/* Botão principal: colar do clipboard */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handlePasteFromClipboard}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Colar e sincronizar
                    </>
                  )}
                </button>
                <button
                  onClick={handleTestClipboard}
                  disabled={loading}
                  title="Ver o que está atualmente no clipboard"
                  className="px-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs disabled:opacity-50"
                >
                  🔍 Testar clipboard
                </button>
              </div>

              {/* Fallback manual */}
              {(showManualPaste || clipboardChecked) && !loading && (
                <details open={showManualPaste} className="border border-slate-200 rounded-xl overflow-hidden">
                  <summary className="px-4 py-2 bg-slate-50 cursor-pointer text-xs font-medium text-slate-600 hover:bg-slate-100 select-none">
                    Modo manual (sem clipboard)
                  </summary>
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-600">
                      Se o botão acima não funcionou, cole o cookie do Menudino aqui:
                    </p>
                    <textarea
                      value={cookie}
                      onChange={e => setCookie(e.target.value)}
                      placeholder="app-access-token=eyJhbGci...; merchant-summary=%257B..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono text-slate-700 focus:border-amber-500 outline-none resize-none"
                    />
                    <button
                      onClick={handleManualSync}
                      disabled={!cookieValido}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Sincronizar
                    </button>
                  </div>
                </details>
              )}

          {/* Logs — sempre visíveis (ajuda debug inclusive depois do success) */}
          {logs.length > 0 && (
            <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs">
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith('===') ? 'text-amber-300 font-bold' : ''}>
                  {line || '\u00A0'}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            {success ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

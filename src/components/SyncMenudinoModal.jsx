import { useState, useRef, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { syncMenudinoCardapio } from '../lib/menudino-sync'

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

// Bookmarklet que, quando clicado enquanto o user está em *.menudino.com,
// copia `document.cookie` pro clipboard e mostra um alert amigável.
const BOOKMARKLET_CODE = `javascript:(function(){try{var c=document.cookie;if(!c||c.indexOf('app-access-token')===-1){alert('Nao encontrei o cookie do Menudino. Abra o seu cardapio Menudino antes de clicar aqui.');return;}navigator.clipboard.writeText(c).then(function(){alert('OK! Cookie do Menudino copiado. Volte ao cardapio-admin e clique em Colar e Sincronizar.');},function(){prompt('Copie este texto e cole no cardapio-admin:',c);});}catch(e){alert('Erro: '+e.message);}})();`

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

  // Autoscroll dos logs
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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

  const doSync = useCallback(async (cookieToUse) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setLogs([])

    try {
      const result = await syncMenudinoCardapio({
        cookieString: cookieToUse,
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

  const handlePasteFromClipboard = async () => {
    setError(null)
    setClipboardChecked(true)
    try {
      const text = await navigator.clipboard.readText()
      if (!text || text.indexOf('app-access-token') === -1) {
        setError('Não achei o cookie do Menudino no clipboard. Verifique se você clicou no bookmarklet enquanto estava na página do seu Menudino.')
        setShowManualPaste(true)
        return
      }
      setCookie(text)
      // Dispara sync direto — sem esperar o user clicar em outro botão
      await doSync(text)
    } catch (e) {
      setError('Não consegui ler o clipboard automaticamente (seu browser pode não ter permitido). Use o modo manual abaixo.')
      setShowManualPaste(true)
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
  const cookieValido = cookie.trim().length > 20 && cookie.indexOf('app-access-token') !== -1

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
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {!success && (
            <>
              {/* Setup primeira vez: bookmarklet */}
              <details className="mb-4 border border-slate-200 rounded-xl overflow-hidden group">
                <summary className="px-4 py-3 bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-100 select-none">
                  🔖 Primeira vez? Instale o atalho (1x só)
                </summary>
                <div className="px-4 py-3 text-sm text-slate-600 space-y-2 border-t border-slate-200">
                  <p>
                    <b>Arraste</b> o botão laranja abaixo pra sua <b>barra de favoritos</b> do browser:
                  </p>
                  <div className="flex items-center gap-3 py-2">
                    {/* eslint-disable-next-line react/jsx-no-script-url */}
                    <a
                      href={BOOKMARKLET_CODE}
                      onClick={e => {
                        e.preventDefault()
                        alert('Arraste este botão para a sua barra de favoritos. Não clique — arraste!')
                      }}
                      draggable
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 shadow-sm select-none cursor-grab active:cursor-grabbing"
                    >
                      📋 Copiar cookie Menudino
                    </a>
                    <span className="text-xs text-slate-500">← arraste pra barra de favoritos</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Depois de instalado, para sincronizar basta: abrir o site do Menudino → clicar no botão na barra de favoritos → voltar aqui e colar.
                  </p>
                </div>
              </details>

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

              {/* Passos */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-slate-700">
                <div className="font-bold mb-2 text-slate-800">Depois de abrir o Menudino:</div>
                <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                  <li>Aguarda a página carregar</li>
                  <li>Clica no botão <b>"Copiar cookie Menudino"</b> na sua barra de favoritos</li>
                  <li>Volta aqui e clica em <b>"Colar e sincronizar"</b> abaixo</li>
                </ol>
              </div>

              {/* Botão principal: colar do clipboard */}
              <button
                onClick={handlePasteFromClipboard}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
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
            </>
          )}

          {/* Logs */}
          {logs.length > 0 && !success && (
            <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-3 max-h-64 overflow-y-auto font-mono text-xs">
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith('===') ? 'text-amber-300 font-bold' : ''}>
                  {line || '\u00A0'}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              <div className="font-bold mb-1">Erro</div>
              <div>{error}</div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900">
              <div className="font-bold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sincronização concluída
              </div>
              <div className="space-y-1 text-xs">
                <div>Categorias novas: <b>{success.stats.categorias_novas}</b></div>
                <div>Reorganizadas: <b>{success.stats.categorias_movidas}</b></div>
                <div>Items adicionados: <b>{success.stats.adicionados}</b></div>
                <div>Items atualizados: <b>{success.stats.atualizados}</b></div>
                <div>Items inativados: <b>{success.stats.inativados}</b></div>
              </div>
              <div className="mt-3 border-t border-green-200 pt-2">
                <div className="font-medium mb-1">Estrutura final:</div>
                {success.estruturaFinal.map((s, i) => (
                  <div key={i} className="text-xs">
                    [{s.label}] {s.nCats} categorias, {s.nItens} items
                  </div>
                ))}
              </div>
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

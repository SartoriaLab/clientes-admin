import { useState, useRef, useEffect } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { syncMenudinoCardapio } from '../lib/menudino-sync'

/**
 * Modal para sincronizar o cardápio a partir do Menudino.
 *
 * Fluxo:
 *   1. User abre o cardápio Menudino dele em outra aba (ex: https://SEU.menudino.com/)
 *   2. F12 → Console → cola `copy(document.cookie)` → Enter
 *   3. Volta aqui e cola no textarea
 *   4. Clica em Sincronizar → log em tempo real + sucesso/erro
 */
export default function SyncMenudinoModal({ isOpen, onClose, restaurantSlug, onSyncComplete }) {
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const logEndRef = useRef(null)

  // Autoscroll dos logs
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Limpa estado ao reabrir
  useEffect(() => {
    if (isOpen) {
      setCookie('')
      setLogs([])
      setError(null)
      setSuccess(null)
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setLogs([])

    try {
      const result = await syncMenudinoCardapio({
        cookieString: cookie,
        firestore: db,
        restaurantSlug,
        firestoreOps: { doc, getDoc, setDoc },
        onLog: (line) => {
          setLogs(prev => [...prev, line])
        }
      })
      setSuccess(result)
      if (onSyncComplete) onSyncComplete()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const canSync = cookie.trim().length > 20 && !loading

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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
                <div className="font-bold mb-2">Como obter o cookie</div>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    Abra o seu cardápio Menudino em outra aba — ex:{' '}
                    <code className="bg-amber-100 px-1 rounded">https://SEURESTAURANTE.menudino.com/</code>
                  </li>
                  <li>Pressione <kbd className="border px-1 rounded">F12</kbd> para abrir o DevTools</li>
                  <li>Vá na aba <b>Console</b></li>
                  <li>Cole <code className="bg-amber-100 px-1 rounded">copy(document.cookie)</code> e pressione Enter</li>
                  <li>Volte aqui e cole abaixo <kbd className="border px-1 rounded">Ctrl</kbd>+<kbd className="border px-1 rounded">V</kbd></li>
                </ol>
                <div className="mt-2 text-xs text-amber-700">
                  O cookie dura ~24h. Quando expirar, refaça o processo. Se der erro "Cloudflare bloqueou", o Menudino está em modo Bot Fight — aguarde alguns segundos e recarregue a página.
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cookie do Menudino
              </label>
              <textarea
                value={cookie}
                onChange={e => setCookie(e.target.value)}
                disabled={loading}
                placeholder="app-access-token=eyJhbGci...; merchant-summary=%257B...; ..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono text-slate-700 focus:border-amber-500 outline-none resize-none disabled:bg-slate-50"
              />
              {cookie.length > 0 && cookie.indexOf('app-access-token') === -1 && (
                <p className="text-xs text-red-600 mt-1">Não achei "app-access-token" no texto colado.</p>
              )}
            </>
          )}

          {/* Logs */}
          {logs.length > 0 && (
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
                <div>Items inativados (soft-delete): <b>{success.stats.inativados}</b></div>
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
          {!success && (
            <button
              onClick={handleSync}
              disabled={!canSync}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {loading ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

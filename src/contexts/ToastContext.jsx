import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa de ToastProvider')
  return ctx
}

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const push = useCallback((message, kind = 'info', timeout = 4000) => {
    const id = nextId++
    setToasts(t => [...t, { id, message, kind }])
    if (timeout > 0) setTimeout(() => remove(id), timeout)
    return id
  }, [remove])

  const value = {
    success: (m, t) => push(m, 'success', t),
    error: (m, t) => push(m, 'error', t ?? 6000),
    info: (m, t) => push(m, 'info', t),
    push,
    remove,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              background: t.kind === 'error' ? '#fef2f2' : t.kind === 'success' ? '#f0fdf4' : '#eff6ff',
              color: t.kind === 'error' ? '#b91c1c' : t.kind === 'success' ? '#15803d' : '#1d4ed8',
              border: `1px solid ${t.kind === 'error' ? '#fecaca' : t.kind === 'success' ? '#bbf7d0' : '#bfdbfe'}`,
              fontSize: '0.875rem',
              cursor: 'pointer',
              maxWidth: 360,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { getClientType, colorClasses } from '../lib/clientTypes'

export default function Dashboard() {
  const { userData, isAdmin } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        if (isAdmin) {
          const snap = await getDocs(collection(db, 'restaurants'))
          setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        } else if (userData?.restaurantSlug) {
          const snap = await getDoc(doc(db, 'restaurants', userData.restaurantSlug))
          if (snap.exists()) setRestaurants([{ id: snap.id, ...snap.data() }])
        }
      } catch (err) {
        console.error('Erro ao carregar:', err)
      }
      setLoading(false)
    }
    if (userData) load()
  }, [userData, isAdmin])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            {isAdmin ? 'Todos os clientes' : 'Meu painel'}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAdmin ? `${restaurants.length} cliente${restaurants.length !== 1 ? 's' : ''}` : 'Dashboard'}
          </h1>
        </div>
        {isAdmin && (
          <Link
            to="/admin/restaurantes"
            className="flex items-center gap-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-xl transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo cliente
          </Link>
        )}
      </div>

      {/* Empty state */}
      {restaurants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <p className="text-base font-semibold text-slate-600">Nenhum cliente cadastrado</p>
          {isAdmin && (
            <Link to="/admin/restaurantes" className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium hover:underline">
              Criar primeiro cliente →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {restaurants.map(r => {
            const typeDef = getClientType(r.type)
            const cls = colorClasses(typeDef.color)
            const slug = r.slug || r.id
            const sections = typeDef.panelLinks({ slug })

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="text-base font-bold text-slate-900 leading-snug">{r.name}</h2>
                    <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cls.badge}`}>
                      {typeDef.emoji} {typeDef.label}
                    </span>
                  </div>
                  {isAdmin && (
                    <p className="text-[11px] text-slate-400 font-mono">/{slug}</p>
                  )}
                </div>

                <div className="h-px bg-slate-100 mx-5" />

                <div className="px-5 py-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${sections.length}, 1fr)` }}>
                  {sections.map(s => {
                    const scls = colorClasses(s.color)
                    return (
                      <Link
                        key={s.to}
                        to={s.to}
                        className={`text-center py-2.5 rounded-xl text-[13px] font-semibold transition ${scls.pill}`}
                      >
                        {s.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

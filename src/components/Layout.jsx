import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation, useMatch } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

// ── Icons ──────────────────────────────────────────────────────────────────
function IconGrid() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconBuilding() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}
function IconTag() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
}
function IconInfo() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
    </svg>
  )
}
function IconCar() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17H5a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-3m-7 0h7m-7 0a1 1 0 110-2 1 1 0 010 2zm7 0a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  )
}
function IconShirt() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />
    </svg>
  )
}
function IconCreditCard() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

// ── Sidebar item ────────────────────────────────────────────────────────────
function SideItem({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        active
          ? 'bg-amber-500 text-slate-900 shadow-sm font-semibold'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      {icon}
      <span className="text-sm truncate">{label}</span>
    </Link>
  )
}

// ── Client nav sections by type ─────────────────────────────────────────────
function clientSections(slug, type) {
  const base = `/restaurante/${slug}`
  if (type === 'garagem') return [
    { to: `${base}/veiculos`,  icon: <IconCar />,   label: 'Veículos'    },
    { to: `${base}/info`,      icon: <IconInfo />,  label: 'Informações' },
  ]
  if (type === 'roupas') return [
    { to: `${base}/roupas`,    icon: <IconShirt />, label: 'Catálogo'    },
    { to: `${base}/info`,      icon: <IconInfo />,  label: 'Informações' },
  ]
  if (type === 'outros') return [
    { to: `${base}/info`,      icon: <IconInfo />,  label: 'Informações' },
  ]
  return [
    { to: `${base}/cardapio`,  icon: <IconMenu />,  label: 'Cardápio'    },
    { to: `${base}/promocoes`, icon: <IconTag />,   label: 'Promoções'   },
    { to: `${base}/info`,      icon: <IconInfo />,  label: 'Informações' },
  ]
}

// ── Layout ──────────────────────────────────────────────────────────────────
export default function Layout() {
  const { userData, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const clientMatch = useMatch('/restaurante/:slug/*')
  const slug = clientMatch?.params?.slug

  const [clientType, setClientType] = useState(null)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    if (!slug) { setClientType(null); setClientName(''); return }
    getDoc(doc(db, 'restaurants', slug))
      .then(snap => {
        if (snap.exists()) {
          setClientType(snap.data().type || 'restaurante')
          setClientName(snap.data().name || '')
        }
      })
      .catch(() => setClientType('restaurante'))
  }, [slug])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = (userData?.email || 'U').slice(0, 2).toUpperCase()
  const sections = slug ? clientSections(slug, clientType) : []
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-slate-900 flex flex-col py-4 px-3 fixed inset-y-0 left-0 z-40 shadow-xl">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 mb-5 px-1 hover:opacity-80 transition">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-sm font-black text-slate-900 shadow-md shrink-0">
            G
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Gestão Admin</span>
        </Link>

        {/* Main nav */}
        <div className="flex flex-col gap-0.5">
          <SideItem to="/" icon={<IconGrid />} label="Dashboard" active={location.pathname === '/'} />
          {isAdmin && (
            <>
              <SideItem to="/admin/restaurantes" icon={<IconBuilding />} label="Clientes" active={isActive('/admin/restaurantes')} />
              <SideItem to="/admin/usuarios" icon={<IconUsers />} label="Usuários" active={isActive('/admin/usuarios')} />
              <SideItem to="/admin/gestao" icon={<IconCreditCard />} label="Gestão" active={isActive('/admin/gestao')} />
            </>
          )}
        </div>

        {/* Client context nav */}
        {slug && sections.length > 0 && (
          <>
            <div className="mx-1 h-px bg-slate-700/60 my-3" />
            {clientName && (
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2 truncate">
                {clientName}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {sections.map(s => (
                <SideItem key={s.to} to={s.to} icon={s.icon} label={s.label} active={isActive(s.to)} />
              ))}
            </div>
          </>
        )}

        {/* Bottom — user + logout */}
        <div className="mt-auto flex flex-col gap-1">
          <div className="mx-1 h-px bg-slate-700/60 mb-2" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
          >
            <IconLogout />
            <span className="text-sm">Sair</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
              {initials}
            </div>
            <span className="text-xs text-slate-500 truncate">{userData?.email}</span>
          </div>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

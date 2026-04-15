import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import Sidebar from './sidebar/Sidebar'
import MobileHeader from './sidebar/MobileHeader'
import MobileDrawer from './sidebar/MobileDrawer'

// Z-index scale used by this layout:
//   z-30: MobileHeader (sticky, under drawer)
//   z-40: Desktop sidebar, mobile drawer + backdrop
//   z-50: Modals (e.g. SyncMenudinoModal) — always above sidebar/drawer

const STORAGE_KEY = 'ui.sidebarCollapsed'

export default function Layout() {
  const { userData, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const clientMatch = useMatch('/restaurante/:slug/*')
  const slug = clientMatch?.params?.slug

  const [clientType, setClientType] = useState(null)
  const [clientName, setClientName] = useState('')

  // Desktop: persisted collapsed state (rail vs expanded)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  // Mobile: drawer open state
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Close drawer whenever route changes
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // Fetch client metadata once per slug
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

  const sharedSidebarProps = {
    isAdmin,
    slug,
    clientType,
    clientName,
    userEmail: userData?.email,
    onLogout: handleLogout,
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Mobile header (lg:hidden) */}
      <MobileHeader
        onOpenDrawer={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
      />

      {/* Desktop sidebar (hidden below lg) */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <Sidebar
          variant={collapsed ? 'rail' : 'expanded'}
          {...sharedSidebarProps}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile drawer (<lg) */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        {...sharedSidebarProps}
      />

      {/* Content area — padding-left on ≥lg leaves room for fixed sidebar */}
      <div className={`flex-1 flex flex-col min-w-0 ${collapsed ? 'lg:pl-16' : 'lg:pl-56'}`}>
        <main className="flex-1 p-4 lg:p-6 min-w-0 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

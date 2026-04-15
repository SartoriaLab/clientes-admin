import { useEffect } from 'react'
import Sidebar from './Sidebar'

// Slide-in drawer for <lg screens. Renders the Sidebar in `drawer` variant
// inside a fixed overlay with a dimmed backdrop.
//
// Handles:
// - body scroll lock while open
// - Escape key to close
// - click outside (backdrop) to close
// - closing automatically on route change is the parent's responsibility
//   (useEffect on location.pathname in Layout.jsx)
export default function MobileDrawer({
  open,
  onClose,
  isAdmin,
  slug,
  clientType,
  clientName,
  userEmail,
  onLogout,
}) {
  // Scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={`lg:hidden fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Drawer panel */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`absolute inset-y-0 left-0 w-64 max-w-[80%] transform transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          variant="drawer"
          isAdmin={isAdmin}
          slug={slug}
          clientType={clientType}
          clientName={clientName}
          userEmail={userEmail}
          onLogout={onLogout}
          onNavigate={onClose}
        />
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { IconHamburger } from './icons'

// Top bar shown on <lg screens. Contains the hamburger trigger + brand.
// Desktop layout hides this via `lg:hidden`.
export default function MobileHeader({ onOpenDrawer, drawerOpen }) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-4 h-14 shadow-md">
      <button
        onClick={onOpenDrawer}
        aria-label="Abrir menu"
        aria-expanded={drawerOpen}
        aria-controls="mobile-drawer"
        className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition"
      >
        <IconHamburger />
      </button>
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-xs font-black text-slate-900 shadow-md shrink-0">
          G
        </div>
        <span className="font-bold text-sm tracking-tight">Gestão Admin</span>
      </Link>
    </header>
  )
}

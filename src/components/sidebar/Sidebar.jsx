import { Link, useLocation } from 'react-router-dom'
import SideItem from './SideItem'
import { buildNavItems } from './navItems'
import {
  IconGrid, IconBuilding, IconUsers, IconMenu, IconTag, IconInfo,
  IconCar, IconShirt, IconCreditCard, IconLogout,
  IconChevronLeft, IconChevronRight,
} from './icons'

const ICON_MAP = {
  grid: <IconGrid />,
  building: <IconBuilding />,
  users: <IconUsers />,
  menu: <IconMenu />,
  tag: <IconTag />,
  info: <IconInfo />,
  car: <IconCar />,
  shirt: <IconShirt />,
  creditCard: <IconCreditCard />,
}

// Sidebar shell shared across the three variants.
// - `expanded`: desktop, full 224px with labels
// - `rail`:     desktop, 64px, icons only with hover tooltips
// - `drawer`:   mobile, full 224px inside an overlay drawer
//
// `onNavigate` is called after any nav link click — the parent uses it to
// close the mobile drawer.
// `onToggleCollapsed` is only meaningful in desktop variants; omitted for drawer.
export default function Sidebar({
  variant,
  isAdmin,
  slug,
  clientType,
  clientName,
  userEmail,
  onLogout,
  onNavigate,
  onToggleCollapsed,
}) {
  const location = useLocation()
  const collapsed = variant === 'rail'
  const sections = buildNavItems({ isAdmin, slug, clientType, clientName })
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')
  const initials = (userEmail || 'U').slice(0, 2).toUpperCase()

  return (
    <div
      className={`h-full bg-slate-900 flex flex-col py-4 shadow-xl ${
        collapsed ? 'px-2' : 'px-3'
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className={`mb-5 flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between gap-2'}`}>
        <Link
          to="/"
          onClick={onNavigate}
          className={`flex items-center gap-3 hover:opacity-80 transition ${collapsed ? '' : 'px-1'}`}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-sm font-black text-slate-900 shadow-md shrink-0">
            G
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-sm tracking-tight">Gestão Admin</span>
          )}
        </Link>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
            aria-label={collapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        )}
      </div>

      {/* Sections */}
      {sections.map((section, idx) => (
        <div key={idx}>
          {section.kind === 'client' && (
            <>
              <div className="mx-1 h-px bg-slate-700/60 my-3" />
              {!collapsed && section.title && (
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2 truncate">
                  {section.title}
                </p>
              )}
              {collapsed && <div className="mx-1 h-px bg-slate-700/60 mb-2" />}
            </>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <SideItem
                key={item.to}
                to={item.to}
                icon={ICON_MAP[item.iconKey]}
                label={item.label}
                active={isActive(item.to)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Footer: logout + user */}
      <div className="mt-auto flex flex-col gap-1">
        <div className="mx-1 h-px bg-slate-700/60 mb-2" />
        <button
          onClick={onLogout}
          title={collapsed ? 'Sair' : undefined}
          className={`group relative w-full flex items-center gap-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-red-400 transition ${
            collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
          }`}
        >
          <IconLogout />
          {!collapsed && <span className="text-sm">Sair</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Sair
            </span>
          )}
        </button>
        <div
          className={`flex items-center gap-3 py-2 ${collapsed ? 'justify-center px-0' : 'px-3'}`}
          title={collapsed ? userEmail : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <span className="text-xs text-slate-500 truncate">{userEmail}</span>
          )}
        </div>
      </div>
    </div>
  )
}

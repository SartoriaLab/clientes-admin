import { Link } from 'react-router-dom'

// One sidebar row. In rail mode (`collapsed`), the label is hidden and a
// CSS tooltip is revealed on hover to preserve discoverability.
export default function SideItem({ to, icon, label, active, collapsed, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`group relative w-full flex items-center gap-3 rounded-xl transition-all ${
        collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
      } ${
        active
          ? 'bg-amber-500 text-slate-900 shadow-sm font-semibold'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      {icon}
      {!collapsed && <span className="text-sm truncate">{label}</span>}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          {label}
        </span>
      )}
    </Link>
  )
}

// Pure function that builds the list of sidebar nav sections.
// Single source of truth for both desktop sidebar and mobile drawer.
//
// Returns an array of sections. Each section is either:
//   { kind: 'main', items: [{ to, iconKey, label }] }
//   { kind: 'client', title, items: [{ to, iconKey, label }] }
//
// Icons are referenced by key (string) so this file stays pure JS — the
// Sidebar component maps keys to actual icon components from ./icons.

import { getClientType } from '../../lib/clientTypes'

export function buildNavItems({ isAdmin, slug, clientType, clientName }) {
  const sections = []

  const main = [
    { to: '/', iconKey: 'grid', label: 'Dashboard' },
  ]
  if (isAdmin) {
    main.push(
      { to: '/admin/restaurantes', iconKey: 'building',   label: 'Clientes' },
      { to: '/admin/usuarios',     iconKey: 'users',      label: 'Usuários' },
      { to: '/admin/gestao',       iconKey: 'creditCard', label: 'Gestão'   },
    )
  }
  sections.push({ kind: 'main', items: main })

  if (slug) {
    const items = getClientType(clientType).sidebarItems({ slug })
    if (items.length > 0) {
      sections.push({ kind: 'client', title: clientName || '', items })
    }
  }

  return sections
}

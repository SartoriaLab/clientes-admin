// Pure function that builds the list of sidebar nav sections.
// Single source of truth for both desktop sidebar and mobile drawer.
//
// Returns an array of sections. Each section is either:
//   { kind: 'main', items: [{ to, iconKey, label }] }
//   { kind: 'client', title, items: [{ to, iconKey, label }] }
//
// Icons are referenced by key (string) so this file stays pure JS — the
// Sidebar component maps keys to actual icon components from ./icons.

export function buildNavItems({ isAdmin, slug, clientType, clientName }) {
  const sections = []

  // Main nav
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

  // Client context nav (only when viewing a specific client)
  if (slug) {
    const items = clientItemsByType(slug, clientType)
    if (items.length > 0) {
      sections.push({ kind: 'client', title: clientName || '', items })
    }
  }

  return sections
}

function clientItemsByType(slug, type) {
  const base = `/restaurante/${slug}`
  if (type === 'garagem') {
    return [
      { to: `${base}/veiculos`, iconKey: 'car',  label: 'Veículos'    },
      { to: `${base}/info`,     iconKey: 'info', label: 'Informações' },
    ]
  }
  if (type === 'roupas') {
    return [
      { to: `${base}/roupas`, iconKey: 'shirt', label: 'Catálogo'    },
      { to: `${base}/info`,   iconKey: 'info',  label: 'Informações' },
    ]
  }
  if (type === 'outros') {
    return [
      { to: `${base}/info`, iconKey: 'info', label: 'Informações' },
    ]
  }
  // Default: restaurante
  return [
    { to: `${base}/cardapio`,  iconKey: 'menu', label: 'Cardápio'    },
    { to: `${base}/promocoes`, iconKey: 'tag',  label: 'Promoções'   },
    { to: `${base}/info`,      iconKey: 'info', label: 'Informações' },
  ]
}

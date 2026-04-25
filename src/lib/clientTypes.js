// Single source of truth for client business types.
//
// Each type defines:
//   - label, emoji, description (UI)
//   - color (Tailwind palette name used for badges/radios)
//   - sidebarItems({slug}) → array of { to, iconKey, label }
//   - initDocs({slug, name}) → array of { docId, content } to seed on creation
//   - panelLinks({slug}) → array of { to, label, color } shown in admin list
//   - publicEntry({slug}) → string path used by "open client panel" link
//
// To add a new type: add an entry here. AdminRestaurantes form, sidebar nav,
// and GestaoClientesPage open-link will pick it up automatically.

const baseBusinessInfo = (name, tagline = '', hoursShape = 'simple') => ({
  name,
  city: '',
  slogan: '',
  tagline,
  whatsapp: '',
  whatsappNumber: '',
  phone: '',
  address: '',
  neighborhood: '',
  cityState: '',
  cep: '',
  hours: hoursShape === 'restaurant'
    ? { funcionamento: '', jantar: '', almoco: '', completo: '' }
    : { weekdays: '', saturday: '' },
  instagram: '',
  facebook: '',
  googleMapsEmbed: '',
  googleMapsLink: ''
})

const infoOnlyType = ({ id, label, emoji, description, color, tagline = '' }) => ({
  id,
  label,
  emoji,
  description,
  color,
  sidebarItems: ({ slug }) => [
    { to: `/restaurante/${slug}/info`, iconKey: 'info', label: 'Informações' },
  ],
  initDocs: ({ name }) => [
    { docId: 'businessInfo', content: baseBusinessInfo(name, tagline) },
  ],
  panelLinks: ({ slug }) => [
    { to: `/restaurante/${slug}/info`, label: 'Informações', color: 'teal' },
  ],
  publicEntry: ({ slug }) => `/restaurante/${slug}/info`,
})

export const CLIENT_TYPES = {
  restaurante: {
    id: 'restaurante',
    label: 'Restaurante',
    emoji: '🍽️',
    description: 'Cardápio e promoções',
    color: 'amber',
    sidebarItems: ({ slug }) => [
      { to: `/restaurante/${slug}/cardapio`,  iconKey: 'menu', label: 'Cardápio'    },
      { to: `/restaurante/${slug}/promocoes`, iconKey: 'tag',  label: 'Promoções'   },
      { to: `/restaurante/${slug}/info`,      iconKey: 'info', label: 'Informações' },
    ],
    initDocs: ({ name }) => [
      { docId: 'cardapio', content: [] },
      { docId: 'promocoes', content: { domingo: [], segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [] } },
      { docId: 'businessInfo', content: baseBusinessInfo(name, '', 'restaurant') },
    ],
    panelLinks: ({ slug }) => [
      { to: `/restaurante/${slug}/cardapio`,  label: 'Cardápio',    color: 'amber'  },
      { to: `/restaurante/${slug}/promocoes`, label: 'Promoções',   color: 'purple' },
      { to: `/restaurante/${slug}/info`,      label: 'Informações', color: 'teal'   },
    ],
    publicEntry: ({ slug }) => `/restaurante/${slug}/cardapio`,
  },

  garagem: {
    id: 'garagem',
    label: 'Garagem',
    emoji: '🚗',
    description: 'Veículos e informações',
    color: 'blue',
    sidebarItems: ({ slug }) => [
      { to: `/restaurante/${slug}/veiculos`, iconKey: 'car',  label: 'Veículos'    },
      { to: `/restaurante/${slug}/info`,     iconKey: 'info', label: 'Informações' },
    ],
    initDocs: ({ name }) => [
      { docId: 'veiculos', content: [] },
      { docId: 'businessInfo', content: baseBusinessInfo(name, 'Compra, Venda, Troca e Financiamento de Veículos') },
    ],
    panelLinks: ({ slug }) => [
      { to: `/restaurante/${slug}/veiculos`, label: 'Veículos',    color: 'blue' },
      { to: `/restaurante/${slug}/info`,     label: 'Informações', color: 'teal' },
    ],
    publicEntry: ({ slug }) => `/restaurante/${slug}/veiculos`,
  },

  roupas: {
    id: 'roupas',
    label: 'Loja de Roupas',
    emoji: '👔',
    description: 'Catálogo e informações',
    color: 'rose',
    sidebarItems: ({ slug }) => [
      { to: `/restaurante/${slug}/roupas`, iconKey: 'shirt', label: 'Catálogo'    },
      { to: `/restaurante/${slug}/info`,   iconKey: 'info',  label: 'Informações' },
    ],
    initDocs: ({ name }) => [
      { docId: 'roupas', content: [] },
      { docId: 'businessInfo', content: baseBusinessInfo(name, 'Moda Masculina Premium') },
    ],
    panelLinks: ({ slug }) => [
      { to: `/restaurante/${slug}/roupas`, label: 'Catálogo',    color: 'rose' },
      { to: `/restaurante/${slug}/info`,   label: 'Informações', color: 'teal' },
    ],
    publicEntry: ({ slug }) => `/restaurante/${slug}/roupas`,
  },

  academia: infoOnlyType({
    id: 'academia',
    label: 'Academia',
    emoji: '🏋️',
    description: 'Horários e informações',
    color: 'emerald',
    tagline: 'Treine com qualidade',
  }),

  salao: infoOnlyType({
    id: 'salao',
    label: 'Salão de Beleza',
    emoji: '💇',
    description: 'Serviços e contato',
    color: 'pink',
    tagline: 'Beleza e bem-estar',
  }),

  petshop: infoOnlyType({
    id: 'petshop',
    label: 'Pet Shop',
    emoji: '🐾',
    description: 'Produtos e serviços pet',
    color: 'orange',
    tagline: 'Cuidado para seu pet',
  }),

  clinica: infoOnlyType({
    id: 'clinica',
    label: 'Clínica',
    emoji: '🩺',
    description: 'Especialidades e contato',
    color: 'cyan',
    tagline: 'Saúde e cuidado',
  }),

  mercado: infoOnlyType({
    id: 'mercado',
    label: 'Mercado',
    emoji: '🛒',
    description: 'Localização e horários',
    color: 'lime',
    tagline: 'Tudo o que você precisa',
  }),

  hotel: infoOnlyType({
    id: 'hotel',
    label: 'Hotel / Pousada',
    emoji: '🏨',
    description: 'Acomodações e contato',
    color: 'indigo',
    tagline: 'Conforto e hospitalidade',
  }),

  outros: infoOnlyType({
    id: 'outros',
    label: 'Outros',
    emoji: '📦',
    description: 'Apenas informações',
    color: 'slate',
  }),
}

export const CLIENT_TYPE_LIST = Object.values(CLIENT_TYPES)

export function getClientType(id) {
  return CLIENT_TYPES[id] || CLIENT_TYPES.restaurante
}

// Tailwind class lookups — kept here so all type colors stay consistent.
// (Tailwind needs literal classnames at build time; this map is the literal source.)
const COLOR_CLASSES = {
  amber:   { badge: 'bg-amber-50 text-amber-700',     radio: 'border-amber-500 bg-amber-50',     accent: 'accent-amber-500',   pill: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
  blue:    { badge: 'bg-blue-50 text-blue-700',       radio: 'border-blue-500 bg-blue-50',       accent: 'accent-blue-500',    pill: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
  rose:    { badge: 'bg-rose-50 text-rose-700',       radio: 'border-rose-500 bg-rose-50',       accent: 'accent-rose-500',    pill: 'bg-rose-50 hover:bg-rose-100 text-rose-700' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700', radio: 'border-emerald-500 bg-emerald-50', accent: 'accent-emerald-500', pill: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
  pink:    { badge: 'bg-pink-50 text-pink-700',       radio: 'border-pink-500 bg-pink-50',       accent: 'accent-pink-500',    pill: 'bg-pink-50 hover:bg-pink-100 text-pink-700' },
  orange:  { badge: 'bg-orange-50 text-orange-700',   radio: 'border-orange-500 bg-orange-50',   accent: 'accent-orange-500',  pill: 'bg-orange-50 hover:bg-orange-100 text-orange-700' },
  cyan:    { badge: 'bg-cyan-50 text-cyan-700',       radio: 'border-cyan-500 bg-cyan-50',       accent: 'accent-cyan-500',    pill: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700' },
  lime:    { badge: 'bg-lime-50 text-lime-700',       radio: 'border-lime-500 bg-lime-50',       accent: 'accent-lime-500',    pill: 'bg-lime-50 hover:bg-lime-100 text-lime-700' },
  indigo:  { badge: 'bg-indigo-50 text-indigo-700',   radio: 'border-indigo-500 bg-indigo-50',   accent: 'accent-indigo-500',  pill: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' },
  teal:    { badge: 'bg-teal-50 text-teal-700',       radio: 'border-teal-500 bg-teal-50',       accent: 'accent-teal-500',    pill: 'bg-teal-50 hover:bg-teal-100 text-teal-700' },
  purple:  { badge: 'bg-purple-50 text-purple-700',   radio: 'border-purple-500 bg-purple-50',   accent: 'accent-purple-500',  pill: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
  slate:   { badge: 'bg-slate-100 text-slate-600',    radio: 'border-slate-500 bg-slate-50',     accent: 'accent-slate-500',   pill: 'bg-slate-50 hover:bg-slate-100 text-slate-700' },
}

export function colorClasses(color) {
  return COLOR_CLASSES[color] || COLOR_CLASSES.slate
}

// All docIds across all types — used by deletion to clean every possible doc.
export const ALL_TYPE_DOC_IDS = Array.from(
  new Set(
    CLIENT_TYPE_LIST.flatMap(t =>
      t.initDocs({ name: '', slug: '' }).map(d => d.docId)
    )
  )
)

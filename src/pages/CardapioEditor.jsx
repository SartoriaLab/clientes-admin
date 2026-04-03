import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// ===== Item Editor =====
function ItemEditor({ item, onChange, onRemove }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={item.nome}
            onChange={e => onChange({ ...item, nome: e.target.value })}
            placeholder="Nome do item"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none"
          />
          <div className="flex gap-2">
            <textarea
              value={item.desc || ''}
              onChange={e => onChange({ ...item, desc: e.target.value })}
              placeholder="Descrição (opcional)"
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none resize-none"
            />
            <div className="shrink-0 w-24">
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-slate-400">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.preco || ''}
                  onChange={e => onChange({ ...item, preco: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="0,00"
                  className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none text-right"
                />
              </div>
              <span className="text-[10px] text-slate-400 block text-center mt-0.5">Preço</span>
            </div>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-slate-300 hover:text-red-500 transition p-1 shrink-0"
          title="Remover item"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ===== Category Editor =====
function CategoryEditor({ category, onChange, onRemove }) {
  function updateItem(index, newItem) {
    const newItens = [...category.itens]
    newItens[index] = newItem
    onChange({ ...category, itens: newItens })
  }

  function removeItem(index) {
    const newItens = category.itens.filter((_, i) => i !== index)
    onChange({ ...category, itens: newItens })
  }

  function addItem() {
    onChange({
      ...category,
      itens: [...category.itens, { nome: '', desc: '', preco: null }]
    })
  }

  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Category Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1">
          <input
            type="text"
            value={category.titulo}
            onChange={e => { e.stopPropagation(); onChange({ ...category, titulo: e.target.value }) }}
            onClick={e => e.stopPropagation()}
            placeholder="Nome da categoria"
            className="font-semibold text-slate-800 bg-transparent border-none outline-none w-full text-base"
          />
        </div>
        <span className="text-xs text-slate-400">{category.itens.length} itens</span>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="text-slate-300 hover:text-red-500 transition p-1"
          title="Remover categoria"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Category Items */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {category.itens.map((item, i) => (
            <ItemEditor
              key={i}
              item={item}
              onChange={newItem => updateItem(i, newItem)}
              onRemove={() => removeItem(i)}
            />
          ))}

          <button
            onClick={addItem}
            className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-amber-400 text-slate-400 hover:text-amber-600 rounded-xl text-sm transition"
          >
            + Adicionar Item
          </button>

          {/* Nota */}
          <input
            type="text"
            value={category.nota || ''}
            onChange={e => onChange({ ...category, nota: e.target.value })}
            placeholder="Observação da categoria (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 italic focus:border-amber-500 outline-none"
          />
        </div>
      )}
    </div>
  )
}

// ===== Tab Editor =====
function TabEditor({ tab, onChange }) {
  function updateCategory(index, newCat) {
    const newCats = [...tab.categorias]
    newCats[index] = newCat
    onChange({ ...tab, categorias: newCats })
  }

  function removeCategory(index) {
    if (!confirm('Remover esta categoria e todos seus itens?')) return
    const newCats = tab.categorias.filter((_, i) => i !== index)
    onChange({ ...tab, categorias: newCats })
  }

  function addCategory() {
    onChange({
      ...tab,
      categorias: [...tab.categorias, { titulo: 'Nova Categoria', itens: [] }]
    })
  }

  return (
    <div className="space-y-4">
      {tab.categorias.map((cat, i) => (
        <CategoryEditor
          key={i}
          category={cat}
          onChange={newCat => updateCategory(i, newCat)}
          onRemove={() => removeCategory(i)}
        />
      ))}

      <button
        onClick={addCategory}
        className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 text-slate-400 hover:text-amber-600 rounded-2xl text-sm font-medium transition"
      >
        + Nova Categoria
      </button>
    </div>
  )
}

// ===== Main Cardapio Editor =====
export default function CardapioEditor() {
  const { slug } = useParams()
  const [tabs, setTabs] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Load restaurant name
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setRestaurantName(restSnap.data().name)

        // Load cardapio
        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'cardapio'))
        if (snap.exists() && snap.data().content) {
          setTabs(snap.data().content)
        }
      } catch (err) {
        console.error('Erro ao carregar cardápio:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function updateTab(index, newTab) {
    const newTabs = [...tabs]
    newTabs[index] = newTab
    setTabs(newTabs)
    setSaved(false)
  }

  function removeTab(index) {
    if (!confirm(`Remover a aba "${tabs[index].label}" e todo seu conteúdo?`)) return
    const newTabs = tabs.filter((_, i) => i !== index)
    setTabs(newTabs)
    if (activeTab >= newTabs.length) setActiveTab(Math.max(0, newTabs.length - 1))
    setSaved(false)
  }

  function addTab() {
    const id = 'nova-' + generateId()
    setTabs([...tabs, { id, label: 'Nova Aba', categorias: [] }])
    setActiveTab(tabs.length)
    setSaved(false)
  }

  function updateTabLabel(index, newLabel) {
    const newTabs = [...tabs]
    newTabs[index] = {
      ...newTabs[index],
      label: newLabel,
      id: newLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-')
    }
    setTabs(newTabs)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'restaurants', slug, 'data', 'cardapio'), {
        content: tabs,
        updatedAt: new Date().toISOString()
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cardápio</h1>
          <p className="text-xs text-slate-400">{restaurantName}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {saved && <span className="text-xs text-green-600 self-center">Salvo!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {tabs.map((tab, i) => (
          <div key={tab.id} className="flex items-center shrink-0">
            <button
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                activeTab === i
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          </div>
        ))}
        <button
          onClick={addTab}
          className="shrink-0 px-3 py-2 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
        >
          +
        </button>
      </div>

      {/* Active Tab Editor */}
      {tabs.length > 0 && tabs[activeTab] && (
        <div>
          {/* Tab settings */}
          <div className="flex items-center gap-3 mb-4 bg-white rounded-xl p-3 border border-slate-200">
            <label className="text-xs text-slate-500 shrink-0">Nome da aba:</label>
            <input
              type="text"
              value={tabs[activeTab].label}
              onChange={e => updateTabLabel(activeTab, e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-amber-500 outline-none"
            />
            <button
              onClick={() => removeTab(activeTab)}
              className="text-xs text-red-400 hover:text-red-600 transition shrink-0"
            >
              Remover aba
            </button>
          </div>

          <TabEditor
            tab={tabs[activeTab]}
            onChange={newTab => updateTab(activeTab, newTab)}
          />
        </div>
      )}

      {tabs.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p>Nenhuma aba no cardápio</p>
          <button onClick={addTab} className="mt-3 text-amber-600 font-medium">+ Criar primeira aba</button>
        </div>
      )}
    </div>
  )
}

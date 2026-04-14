import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'

export default function AdminRestaurantes() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', type: 'restaurante' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadRestaurants() {
    const snap = await getDocs(collection(db, 'restaurants'))
    setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  useEffect(() => { loadRestaurants() }, [])

  function generateSlug(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function handleNameChange(name) {
    setForm(prev => ({ ...prev, name, slug: generateSlug(name) }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      // Create restaurant/garagem document
      await setDoc(doc(db, 'restaurants', form.slug), {
        name: form.name,
        slug: form.slug,
        type: form.type,
        createdAt: new Date().toISOString()
      })

      if (form.type === 'garagem') {
        // Initialize empty vehicles and business info
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'veiculos'), {
          content: [],
          updatedAt: new Date().toISOString()
        })
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'businessInfo'), {
          content: {
            name: form.name,
            city: '',
            slogan: '',
            tagline: 'Compra, Venda, Troca e Financiamento de Veículos',
            whatsapp: '',
            whatsappNumber: '',
            phone: '',
            address: '',
            neighborhood: '',
            cityState: '',
            cep: '',
            hours: { weekdays: '', saturday: '' },
            instagram: '',
            facebook: '',
            googleMapsEmbed: '',
            googleMapsLink: ''
          },
          updatedAt: new Date().toISOString()
        })
      } else if (form.type === 'roupas') {
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'roupas'), {
          content: [],
          updatedAt: new Date().toISOString()
        })
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'businessInfo'), {
          content: {
            name: form.name,
            city: '',
            slogan: '',
            tagline: 'Moda Masculina Premium',
            whatsapp: '',
            whatsappNumber: '',
            phone: '',
            address: '',
            neighborhood: '',
            cityState: '',
            cep: '',
            hours: { weekdays: '', saturday: '' },
            instagram: '',
            facebook: '',
            googleMapsEmbed: '',
            googleMapsLink: ''
          },
          updatedAt: new Date().toISOString()
        })
      } else if (form.type === 'outros') {
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'businessInfo'), {
          content: {
            name: form.name,
            city: '',
            slogan: '',
            tagline: '',
            whatsapp: '',
            whatsappNumber: '',
            phone: '',
            address: '',
            neighborhood: '',
            cityState: '',
            cep: '',
            hours: { weekdays: '', saturday: '' },
            instagram: '',
            facebook: '',
            googleMapsEmbed: '',
            googleMapsLink: ''
          },
          updatedAt: new Date().toISOString()
        })
      } else {
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'cardapio'), {
          content: [],
          updatedAt: new Date().toISOString()
        })
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'promocoes'), {
          content: {
            domingo: [], segunda: [], terca: [], quarta: [],
            quinta: [], sexta: [], sabado: []
          },
          updatedAt: new Date().toISOString()
        })
        await setDoc(doc(db, 'restaurants', form.slug, 'data', 'businessInfo'), {
          content: {
            name: form.name,
            city: '',
            slogan: '',
            tagline: '',
            whatsapp: '',
            whatsappNumber: '',
            phone: '',
            address: '',
            neighborhood: '',
            cityState: '',
            cep: '',
            hours: { funcionamento: '', jantar: '', almoco: '', completo: '' },
            instagram: '',
            facebook: '',
            googleMapsEmbed: '',
            googleMapsLink: ''
          },
          updatedAt: new Date().toISOString()
        })
      }

      setForm({ name: '', slug: '', type: 'restaurante' })
      setShowForm(false)
      loadRestaurants()
    } catch (err) {
      setError('Erro: ' + err.message)
    }
    setCreating(false)
  }

  async function handleDelete(slug, name, type) {
    if (!confirm(`Remover "${name}"? Esta ação não pode ser desfeita.`)) return
    try {
      const docs = ['cardapio', 'promocoes', 'businessInfo', 'veiculos', 'roupas']
      await Promise.all(docs.map(d =>
        deleteDoc(doc(db, 'restaurants', slug, 'data', d)).catch(() => {})
      ))
      await deleteDoc(doc(db, 'restaurants', slug))
      loadRestaurants()
    } catch (err) {
      alert('Erro ao remover: ' + err.message)
    }
  }

  // Helpers de tipo
  const isGaragem = (r) => r.type === 'garagem'
  const isRoupas = (r) => r.type === 'roupas'
  const isOutros = (r) => r.type === 'outros'
  const typeLabel = (r) => isGaragem(r) ? 'Garagem' : isRoupas(r) ? 'Roupas' : isOutros(r) ? 'Outros' : 'Restaurante'
  const typeBadgeClass = (r) => isGaragem(r)
    ? 'bg-blue-50 text-blue-700'
    : isRoupas(r)
      ? 'bg-rose-50 text-rose-700'
      : isOutros(r)
        ? 'bg-slate-100 text-slate-600'
        : 'bg-amber-50 text-amber-700'

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Clientes</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/usuarios"
            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition font-medium"
          >
            Usuários
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition font-medium"
          >
            {showForm ? 'Cancelar' : '+ Novo'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Novo Cliente</h2>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

          {/* Tipo */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Tipo de cliente</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${form.type === 'restaurante' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="type"
                  value="restaurante"
                  checked={form.type === 'restaurante'}
                  onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                  className="accent-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">🍽️ Restaurante</span>
                  <p className="text-[11px] text-slate-400">Cardápio e promoções</p>
                </div>
              </label>
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${form.type === 'garagem' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="type"
                  value="garagem"
                  checked={form.type === 'garagem'}
                  onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                  className="accent-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">🚗 Garagem</span>
                  <p className="text-[11px] text-slate-400">Veículos e informações</p>
                </div>
              </label>
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${form.type === 'roupas' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="type" value="roupas" checked={form.type === 'roupas'} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="accent-rose-500" />
                <div>
                  <span className="text-sm font-medium text-slate-800">👔 Loja de Roupas</span>
                  <p className="text-[11px] text-slate-400">Catálogo e informações</p>
                </div>
              </label>
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${form.type === 'outros' ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="type" value="outros" checked={form.type === 'outros'} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="accent-slate-500" />
                <div>
                  <span className="text-sm font-medium text-slate-800">📦 Outros</span>
                  <p className="text-[11px] text-slate-400">Apenas informações</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder={form.type === 'garagem' ? 'Ex: Quejinho Veículos' : 'Ex: Marieta Bistrô'}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Slug (identificador único)</label>
            <input
              type="text"
              value={form.slug}
              onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-mono"
              placeholder={form.type === 'garagem' ? 'quejinho-veiculos' : 'marieta-bistro'}
              required
            />
          </div>

          <p className="text-xs text-slate-400">Para criar conta de acesso, use a página <Link to="/admin/usuarios" className="text-amber-600 underline">Usuários</Link> após criar o cliente.</p>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Cliente'}
          </button>
        </form>
      )}

      {/* Restaurant List */}
      <div className="space-y-3">
        {restaurants.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{r.name}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeClass(r)}`}>
                    {typeLabel(r)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">/{r.slug}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {isGaragem(r) ? (
                <>
                  <Link
                    to={`/restaurante/${r.slug}/veiculos`}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                  >
                    Veículos
                  </Link>
                  <Link
                    to={`/restaurante/${r.slug}/info`}
                    className="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition"
                  >
                    Informações
                  </Link>
                </>
              ) : isRoupas(r) ? (
                <>
                  <Link
                    to={`/restaurante/${r.slug}/roupas`}
                    className="text-xs px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition"
                  >
                    Catálogo
                  </Link>
                  <Link
                    to={`/restaurante/${r.slug}/info`}
                    className="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition"
                  >
                    Informações
                  </Link>
                </>
              ) : isOutros(r) ? (
                <Link
                  to={`/restaurante/${r.slug}/info`}
                  className="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition"
                >
                  Informações
                </Link>
              ) : (
                <>
                  <Link
                    to={`/restaurante/${r.slug}/cardapio`}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition"
                  >
                    Cardápio
                  </Link>
                  <Link
                    to={`/restaurante/${r.slug}/promocoes`}
                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
                  >
                    Promoções
                  </Link>
                  <Link
                    to={`/restaurante/${r.slug}/info`}
                    className="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition"
                  >
                    Informações
                  </Link>
                </>
              )}
              <button
                onClick={() => handleDelete(r.slug, r.name, r.type)}
                className="text-xs px-3 py-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore'
import { CLIENT_TYPE_LIST, getClientType, colorClasses, ALL_TYPE_DOC_IDS } from '../lib/clientTypes'

export default function AdminRestaurantes() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', type: 'restaurante' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [editTypeFor, setEditTypeFor] = useState(null)
  const [newType, setNewType] = useState('')
  const [savingType, setSavingType] = useState(false)

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
      await setDoc(doc(db, 'restaurants', form.slug), {
        name: form.name,
        slug: form.slug,
        type: form.type,
        createdAt: new Date().toISOString()
      })

      const typeDef = getClientType(form.type)
      const docs = typeDef.initDocs({ name: form.name, slug: form.slug })
      const now = new Date().toISOString()
      await Promise.all(docs.map(d =>
        setDoc(doc(db, 'restaurants', form.slug, 'data', d.docId), {
          content: d.content,
          updatedAt: now,
        })
      ))

      setForm({ name: '', slug: '', type: 'restaurante' })
      setShowForm(false)
      loadRestaurants()
    } catch (err) {
      setError('Erro: ' + err.message)
    }
    setCreating(false)
  }

  function openTypeEditor(r) {
    setEditTypeFor(r)
    setNewType(r.type || 'restaurante')
  }

  async function handleSaveType() {
    if (!editTypeFor || newType === editTypeFor.type) {
      setEditTypeFor(null)
      return
    }
    setSavingType(true)
    try {
      const slug = editTypeFor.slug
      await updateDoc(doc(db, 'restaurants', slug), { type: newType })

      const typeDef = getClientType(newType)
      const docs = typeDef.initDocs({ name: editTypeFor.name, slug })
      const now = new Date().toISOString()
      await Promise.all(docs.map(async d => {
        const ref = doc(db, 'restaurants', slug, 'data', d.docId)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, { content: d.content, updatedAt: now })
        }
      }))

      setEditTypeFor(null)
      loadRestaurants()
    } catch (err) {
      alert('Erro ao trocar tipo: ' + err.message)
    }
    setSavingType(false)
  }

  async function handleDelete(slug, name) {
    if (!confirm(`Remover "${name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await Promise.all(ALL_TYPE_DOC_IDS.map(d =>
        deleteDoc(doc(db, 'restaurants', slug, 'data', d)).catch(() => {})
      ))
      await deleteDoc(doc(db, 'restaurants', slug))
      loadRestaurants()
    } catch (err) {
      alert('Erro ao remover: ' + err.message)
    }
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

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Novo Cliente</h2>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="block text-xs text-slate-500 mb-2">Tipo de cliente</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CLIENT_TYPE_LIST.map(t => {
                const cls = colorClasses(t.color)
                const selected = form.type === t.id
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${selected ? cls.radio : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t.id}
                      checked={selected}
                      onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                      className={cls.accent}
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-800">{t.emoji} {t.label}</span>
                      <p className="text-[11px] text-slate-400">{t.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
              placeholder="Ex: Marieta Bistrô"
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
              placeholder="marieta-bistro"
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

      <div className="space-y-3">
        {restaurants.map(r => {
          const typeDef = getClientType(r.type)
          const cls = colorClasses(typeDef.color)
          const links = typeDef.panelLinks({ slug: r.slug })
          return (
            <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{r.name}</h3>
                    <button
                      type="button"
                      onClick={() => openTypeEditor(r)}
                      title="Alterar tipo"
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls.badge} hover:opacity-80 cursor-pointer`}
                    >
                      {typeDef.emoji} {typeDef.label} ✎
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">/{r.slug}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {links.map(l => {
                  const lcls = colorClasses(l.color)
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`text-xs px-3 py-1.5 rounded-lg transition ${lcls.pill}`}
                    >
                      {l.label}
                    </Link>
                  )
                })}
                <button
                  onClick={() => handleDelete(r.slug, r.name)}
                  className="text-xs px-3 py-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                >
                  Excluir
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editTypeFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !savingType && setEditTypeFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Alterar tipo</h2>
                <p className="text-sm text-slate-500">{editTypeFor.name}</p>
              </div>
              <button onClick={() => !savingType && setEditTypeFor(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CLIENT_TYPE_LIST.map(t => {
                  const tcls = colorClasses(t.color)
                  const selected = newType === t.id
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${selected ? tcls.radio : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <input
                        type="radio"
                        name="edit-type"
                        value={t.id}
                        checked={selected}
                        onChange={e => setNewType(e.target.value)}
                        className={tcls.accent}
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">{t.emoji} {t.label}</span>
                        <p className="text-[11px] text-slate-400">{t.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400">
                Os documentos existentes (cardápio, veículos, etc.) são preservados. Documentos faltantes do novo tipo são criados vazios. Para limpar dados antigos, edite-os manualmente.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveType}
                  disabled={savingType || newType === editTypeFor.type}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {savingType ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  onClick={() => setEditTypeFor(null)}
                  disabled={savingType}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

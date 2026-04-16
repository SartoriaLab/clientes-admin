import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { db, storage } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

const defaultInfo = {
  name: '',
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
  hours: {
    funcionamento: '',
    jantar: '',
    almoco: '',
    completo: '',
  },
  instagram: '',
  facebook: '',
  googleMapsEmbed: '',
  googleMapsLink: ''
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none"
      />
      {hint && <span className="text-[10px] text-slate-400 mt-0.5 block">{hint}</span>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h2 className="font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2">{title}</h2>
      {children}
    </div>
  )
}

function SlotInstagram({ index, post, uploading, onFileSelect }) {
  const inputRef = useRef(null)

  return (
    <div
      className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden cursor-pointer group"
      onClick={() => inputRef.current?.click()}
    >
      {post?.imageUrl ? (
        <>
          <img
            src={post.imageUrl}
            alt={`Post ${index + 1}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px] font-medium">Foto {index + 1}</span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          if (e.target.files[0]) onFileSelect(index, e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function BusinessInfoEditor() {
  const { slug } = useParams()
  const [info, setInfo] = useState(defaultInfo)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientName, setClientName] = useState('')

  const [igPosts, setIgPosts] = useState(Array(9).fill(null))
  const [igUploading, setIgUploading] = useState(Array(9).fill(false))
  const [igUpdatedAt, setIgUpdatedAt] = useState(null)
  const [igPublishing, setIgPublishing] = useState(false)
  const [igPublished, setIgPublished] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', slug))
        if (restSnap.exists()) setClientName(restSnap.data().name)

        const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'businessInfo'))
        if (snap.exists() && snap.data().content) {
          setInfo({ ...defaultInfo, ...snap.data().content })
        }

        const igSnap = await getDoc(doc(db, 'restaurants', slug, 'data', 'instagram'))
        if (igSnap.exists() && igSnap.data().content) {
          const posts = igSnap.data().content
          setIgPosts(Array(9).fill(null).map((_, i) => posts[i] || null))
          setIgUpdatedAt(igSnap.data().updatedAt)
        }
      } catch (err) {
        console.error('Erro ao carregar informações:', err)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function update(field, value) {
    setInfo(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function updateHours(field, value) {
    setInfo(prev => ({
      ...prev,
      hours: { ...prev.hours, [field]: value }
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'restaurants', slug, 'data', 'businessInfo'), {
        content: info,
        updatedAt: new Date().toISOString()
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  async function handleSlotChange(index, file) {
    // Mostra preview imediato
    const previewUrl = URL.createObjectURL(file)
    setIgPosts(prev => {
      const next = [...prev]
      next[index] = { ...(prev[index] || {}), imageUrl: previewUrl }
      return next
    })
    setIgUploading(prev => { const n = [...prev]; n[index] = true; return n })

    try {
      const path = `instagram/${slug}/post_${index + 1}.jpg`
      const fileRef = storageRef(storage, path)
      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)
      setIgPosts(prev => {
        const next = [...prev]
        next[index] = { imageUrl: url, postUrl: prev[index]?.postUrl || '' }
        return next
      })
    } catch (err) {
      alert('Erro ao enviar imagem: ' + err.message)
      setIgPosts(prev => {
        const next = [...prev]
        next[index] = next[index]?.imageUrl === previewUrl ? null : prev[index]
        return next
      })
    } finally {
      URL.revokeObjectURL(previewUrl)
      setIgUploading(prev => { const n = [...prev]; n[index] = false; return n })
    }
  }

  async function handlePublishInstagram() {
    setIgPublishing(true)
    setIgPublished(false)
    try {
      const postsData = igPosts
        .filter(Boolean)
        .map(p => ({
          image: p.imageUrl,
          postUrl: p.postUrl || (info.instagram || 'https://www.instagram.com/marieta_bistro/')
        }))
      const now = new Date().toISOString()
      await setDoc(doc(db, 'restaurants', slug, 'data', 'instagram'), {
        content: postsData,
        updatedAt: now
      })
      setIgUpdatedAt(now)
      setIgPublished(true)
      setTimeout(() => setIgPublished(false), 3000)
    } catch (err) {
      alert('Erro ao publicar feed: ' + err.message)
    }
    setIgPublishing(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{clientName}</p>
          <h1 className="text-2xl font-bold text-slate-900">Informações</h1>
        </div>
        <div className="flex gap-2 items-center">
          {saved && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">✓ Salvo</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl transition disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dados básicos */}
        <Section title="Dados da Empresa">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da empresa" value={info.name} onChange={v => update('name', v)} placeholder="Quejinho Veículos" />
            <Field label="Cidade" value={info.city} onChange={v => update('city', v)} placeholder="Taquaritinga - SP" />
          </div>
          <Field label="Slogan" value={info.slogan} onChange={v => update('slogan', v)} placeholder="Confiança que te leva mais longe" />
          <Field label="Tagline / Descrição curta" value={info.tagline} onChange={v => update('tagline', v)} placeholder="Compra, Venda, Troca e Financiamento de Veículos" />
        </Section>

        {/* Contato */}
        <Section title="Contato">
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp (exibição)" value={info.whatsapp} onChange={v => update('whatsapp', v)} placeholder="(16) 99635-5566" />
            <Field label="WhatsApp (número API)" value={info.whatsappNumber} onChange={v => update('whatsappNumber', v)} placeholder="5516996355566" hint="Somente números com DDI. Ex: 5516996355566" />
          </div>
          <Field label="Telefone" value={info.phone} onChange={v => update('phone', v)} placeholder="(16) 99635-5566" />
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <Field label="Endereço" value={info.address} onChange={v => update('address', v)} placeholder="Rua Principal, 123" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bairro" value={info.neighborhood} onChange={v => update('neighborhood', v)} placeholder="Centro" />
            <Field label="Cidade - UF" value={info.cityState} onChange={v => update('cityState', v)} placeholder="Taquaritinga - SP" />
            <Field label="CEP" value={info.cep} onChange={v => update('cep', v)} placeholder="15900-000" />
          </div>
        </Section>

        {/* Horários */}
        <Section title="Horário de Atendimento">
          <Field
            label="Dias de funcionamento"
            value={info.hours?.funcionamento}
            onChange={v => updateHours('funcionamento', v)}
            placeholder="Ex: Terça a Domingo"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Jantar"
              value={info.hours?.jantar}
              onChange={v => updateHours('jantar', v)}
              placeholder="Ex: 19h30 às 23h"
            />
            <Field
              label="Almoço"
              value={info.hours?.almoco}
              onChange={v => updateHours('almoco', v)}
              placeholder="Ex: Sáb 11h · Dom 11h30"
            />
          </div>
          <Field
            label="Horário completo (exibido na seção Contato)"
            value={info.hours?.completo}
            onChange={v => updateHours('completo', v)}
            placeholder="Ex: Ter a Sex 19h30–23h · Sáb 11h–14h / 19h30–23h30 · Dom 11h30–14h"
          />
        </Section>

        {/* Redes sociais */}
        <Section title="Redes Sociais">
          <Field label="Instagram (URL)" value={info.instagram} onChange={v => update('instagram', v)} placeholder="https://instagram.com/seuusuario" />
          <Field label="Facebook (URL)" value={info.facebook} onChange={v => update('facebook', v)} placeholder="https://facebook.com/suapagina" />
        </Section>

        {/* Maps */}
        <Section title="Google Maps">
          <Field label="Link do Google Maps" value={info.googleMapsLink} onChange={v => update('googleMapsLink', v)} placeholder="https://www.google.com/maps/search/..." hint="Link para o botão 'Como chegar'" />
          <Field label="Embed do Google Maps" value={info.googleMapsEmbed} onChange={v => update('googleMapsEmbed', v)} placeholder="https://www.google.com/maps?q=...&output=embed" hint="URL para embutir mapa (opcional)" />
        </Section>

        {/* Feed do Instagram */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Feed do Instagram</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {igUpdatedAt
                  ? `Publicado em ${formatDate(igUpdatedAt)}`
                  : 'Clique nas fotos para enviar as imagens do feed'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {igPublished && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">✓ Publicado</span>
              )}
              <button
                onClick={handlePublishInstagram}
                disabled={igPublishing || igUploading.some(Boolean) || igPosts.every(p => !p)}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-40 shadow-sm"
              >
                {igPublishing ? 'Publicando...' : 'Publicar Feed'}
              </button>
            </div>
          </div>
          <div className="p-5 grid grid-cols-3 gap-2">
            {Array(9).fill(null).map((_, i) => (
              <SlotInstagram
                key={i}
                index={i}
                post={igPosts[i]}
                uploading={igUploading[i]}
                onFileSelect={handleSlotChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import SyncMenudinoModal from '../components/SyncMenudinoModal'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

const TAGS = [
  { key: 'destaque',      label: '⭐ Destaque',        cls: 'bg-amber-400 text-amber-900 border-amber-400', movesToFront: true },
  { key: 'promocao',      label: '🏷️ Promoção',        cls: 'bg-pink-100 text-pink-700 border-pink-300' },
  { key: 'vegetariano',   label: '🌿 Vegetariano',     cls: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'vegano',        label: '🌱 Vegano',           cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { key: 'sem-gluten',    label: '🌾 Sem Glúten',      cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'picante',       label: '🌶 Picante',          cls: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'novo',          label: '✨ Novo',              cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'favorito-chef', label: '👨‍🍳 Favorito do Chef', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
]

// ===== Item Editor =====
function ItemEditor({ item, onChange, onRemove, onDuplicate, dragHandleProps, isDragging, isDragOver, index }) {
  const [showAdvanced, setShowAdvanced] = useState(!!(item.imagem))
  const tags = item.tags || []

  function toggleTag(key) {
    const next = tags.includes(key) ? tags.filter(t => t !== key) : [...tags, key]
    onChange({ ...item, tags: next })
  }

  const isInativo = item.ativo === false

  return (
    <div className={`rounded-xl border transition-all shadow-sm ${
      isDragOver ? 'border-amber-400 shadow-amber-100 scale-[1.01]' :
      isDragging ? 'opacity-40 border-slate-200 shadow-none' :
      isInativo ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'
    } overflow-hidden`}>

      {/* Top bar: drag + number + name + price + actions */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <div
          {...dragHandleProps}
          className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 touch-none"
          title="Arrastar"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
          </svg>
        </div>

        {index !== undefined && (
          <span className="shrink-0 w-5 h-5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
        )}

        <input
          type="text"
          value={item.nome}
          onChange={e => onChange({ ...item, nome: e.target.value })}
          placeholder="Nome do prato / item..."
          className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-300 placeholder:font-normal min-w-0"
        />

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onChange({ ...item, ativo: isInativo ? true : false })}
            title={isInativo ? 'Ativar' : 'Inativar'}
            className={`p-1.5 rounded-lg transition ${isInativo ? 'text-slate-300 hover:text-green-500' : 'text-green-500 hover:text-slate-300'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isInativo
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
              }
            </svg>
          </button>
          <button onClick={onDuplicate} className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 transition" title="Duplicar">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 transition" title="Remover">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: description + price + tags */}
      <div className="px-3 py-3 space-y-2.5">
        <div className="flex gap-2 items-start">
          <textarea
            value={item.desc || ''}
            onChange={e => onChange({ ...item, desc: e.target.value })}
            placeholder="Descrição, ingredientes, acompanhamentos... (opcional)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 focus:border-amber-500 outline-none resize-none bg-slate-50 placeholder:text-slate-300"
          />
          <div className="shrink-0 w-24">
            <label className="block text-[10px] font-medium text-slate-400 mb-1 text-center">Preço</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.preco || ''}
                onChange={e => onChange({ ...item, preco: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="—"
                className="w-full pl-7 pr-2 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 outline-none text-right bg-slate-50"
              />
            </div>
            <p className="text-[9px] text-slate-300 text-center mt-0.5">Vazio = ocultar</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map(tag => (
            <button
              key={tag.key}
              onClick={() => toggleTag(tag.key)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition ${
                tags.includes(tag.key) ? tag.cls : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Advanced: image URL */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showAdvanced ? 'Ocultar imagem' : 'Adicionar imagem'}
          </button>
          {showAdvanced && (
            <input
              type="url"
              value={item.imagem || ''}
              onChange={e => onChange({ ...item, imagem: e.target.value })}
              placeholder="https://... (link da imagem)"
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 outline-none bg-slate-50"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Delete Item Modal =====
function DeleteItemModal({ item, onInativar, onDeletar, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Remover item?</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="font-medium text-slate-700">"{item.nome || 'Item sem nome'}"</span> será excluído permanentemente.
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">
            Prefira <strong>inativar</strong> para esconder temporariamente sem perder o item.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button onClick={onInativar} className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Inativar (esconder do cardápio)
          </button>
          <button onClick={onDeletar} className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition">
            Deletar permanentemente
          </button>
          <button onClick={onCancel} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Delete Category Modal =====
function DeleteCategoryModal({ category, onInativar, onDeletar, onCancel }) {
  const total = category.itens.length
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Remover categoria?</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="font-medium text-slate-700">"{category.titulo || 'Sem título'}"</span> e seus{' '}
              <span className="font-medium text-slate-700">{total} {total === 1 ? 'item' : 'itens'}</span> serão excluídos permanentemente.
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">
            Prefira <strong>inativar</strong> para esconder temporariamente sem perder os itens.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button onClick={onInativar} className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Inativar (esconder do cardápio)
          </button>
          <button onClick={onDeletar} className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition">
            Deletar permanentemente
          </button>
          <button onClick={onCancel} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Category Editor =====
function CategoryEditor({ category, onChange, onRemove, dragHandleProps, isDragging, isDragOver }) {
  const [expanded, setExpanded] = useState(true)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)

  const ativos = category.itens.filter(i => i.ativo !== false).length
  const inativos = category.itens.length - ativos
  const isInativa = category.ativo === false

  function updateItem(index, newItem) {
    const wasDestaque = (category.itens[index].tags || []).includes('destaque')
    const isDestaque = (newItem.tags || []).includes('destaque')
    let newItens = [...category.itens]
    newItens[index] = newItem
    // Move to front when destaque is first toggled on
    if (isDestaque && !wasDestaque) {
      newItens.splice(index, 1)
      newItens.unshift(newItem)
    }
    onChange({ ...category, itens: newItens })
  }

  function removeItem(index) {
    onChange({ ...category, itens: category.itens.filter((_, i) => i !== index) })
  }

  function duplicateItem(index) {
    const copy = { ...category.itens[index], nome: category.itens[index].nome + ' (cópia)' }
    const newItens = [...category.itens]
    newItens.splice(index + 1, 0, copy)
    onChange({ ...category, itens: newItens })
  }

  function addItem() {
    onChange({ ...category, itens: [...category.itens, { nome: '', desc: '', preco: null, imagem: '', ativo: true, tags: [] }] })
  }

  function handleItemDrop(targetIndex) {
    if (draggedItem === null || draggedItem === targetIndex) {
      setDraggedItem(null); setDragOverItem(null); return
    }
    const newItens = [...category.itens]
    const [removed] = newItens.splice(draggedItem, 1)
    newItens.splice(targetIndex, 0, removed)
    onChange({ ...category, itens: newItens })
    setDraggedItem(null); setDragOverItem(null)
  }

  return (
    <div className={`rounded-2xl border transition-all ${
      isDragOver ? 'border-amber-400 shadow-md' :
      isDragging ? 'opacity-40 border-slate-200' :
      isInativa ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
    } overflow-hidden`}>
      {/* Category Header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 cursor-pointer select-none transition ${isInativa ? 'opacity-60' : 'hover:bg-slate-50'}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          onClick={e => e.stopPropagation()}
          className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400"
          title="Arrastar categoria"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
          </svg>
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        {/* Title input */}
        <input
          type="text"
          value={category.titulo}
          onChange={e => { e.stopPropagation(); onChange({ ...category, titulo: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          placeholder="Nome da categoria..."
          className="flex-1 font-semibold text-slate-800 bg-transparent border-none outline-none text-sm min-w-0"
        />

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {isInativa ? (
            <span className="text-[11px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Inativa</span>
          ) : (
            <span className="text-xs text-slate-400">
              {ativos} {ativos !== 1 ? 'itens' : 'item'}
              {inativos > 0 && <span className="text-slate-300"> · {inativos} inativo{inativos !== 1 ? 's' : ''}</span>}
            </span>
          )}

          <button
            onClick={() => onChange({ ...category, ativo: isInativa ? true : false })}
            title={isInativa ? 'Ativar categoria' : 'Inativar categoria'}
            className={`p-1 rounded-lg transition ${isInativa ? 'text-slate-400 hover:text-green-500' : 'text-green-500 hover:text-slate-400'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isInativa
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
              }
            </svg>
          </button>

          <button
            onClick={onRemove}
            className="p-1 rounded-lg text-slate-300 hover:text-red-500 transition"
            title="Remover categoria"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-3">
          {category.itens.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum item ainda</p>
          )}

          {category.itens.map((item, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDraggedItem(i)}
              onDragOver={e => { e.preventDefault(); setDragOverItem(i) }}
              onDrop={() => handleItemDrop(i)}
              onDragEnd={() => { setDraggedItem(null); setDragOverItem(null) }}
            >
              <ItemEditor
                item={item}
                index={i}
                onChange={newItem => updateItem(i, newItem)}
                onRemove={() => setPendingDelete(i)}
                onDuplicate={() => duplicateItem(i)}
                dragHandleProps={{}}
                isDragging={draggedItem === i}
                isDragOver={dragOverItem === i && draggedItem !== i}
              />
            </div>
          ))}

          {pendingDelete !== null && (
            <DeleteItemModal
              item={category.itens[pendingDelete]}
              onInativar={() => { updateItem(pendingDelete, { ...category.itens[pendingDelete], ativo: false }); setPendingDelete(null) }}
              onDeletar={() => { removeItem(pendingDelete); setPendingDelete(null) }}
              onCancel={() => setPendingDelete(null)}
            />
          )}

          <button
            onClick={addItem}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-amber-400 text-slate-400 hover:text-amber-600 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar item
          </button>

          {/* Category note */}
          <input
            type="text"
            value={category.nota || ''}
            onChange={e => onChange({ ...category, nota: e.target.value })}
            placeholder="Observação da categoria (ex: *Disponível apenas no jantar)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 italic focus:border-amber-500 outline-none bg-slate-50/50 placeholder:text-slate-300"
          />
        </div>
      )}
    </div>
  )
}

// ===== Tab Editor =====
function TabEditor({ tab, onChange }) {
  const [draggedCat, setDraggedCat] = useState(null)
  const [dragOverCat, setDragOverCat] = useState(null)
  const [pendingDeleteCat, setPendingDeleteCat] = useState(null)

  function updateCategory(index, newCat) {
    const newCats = [...tab.categorias]
    newCats[index] = newCat
    onChange({ ...tab, categorias: newCats })
  }

  function removeCategory(index) {
    onChange({ ...tab, categorias: tab.categorias.filter((_, i) => i !== index) })
  }

  function addCategory() {
    onChange({ ...tab, categorias: [...tab.categorias, { titulo: '', itens: [], nota: '', ativo: true }] })
  }

  function handleCatDrop(targetIndex) {
    if (draggedCat === null || draggedCat === targetIndex) {
      setDraggedCat(null); setDragOverCat(null); return
    }
    const newCats = [...tab.categorias]
    const [removed] = newCats.splice(draggedCat, 1)
    newCats.splice(targetIndex, 0, removed)
    onChange({ ...tab, categorias: newCats })
    setDraggedCat(null); setDragOverCat(null)
  }

  return (
    <div className="space-y-3">
      {tab.categorias.map((cat, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => setDraggedCat(i)}
          onDragOver={e => { e.preventDefault(); setDragOverCat(i) }}
          onDrop={() => handleCatDrop(i)}
          onDragEnd={() => { setDraggedCat(null); setDragOverCat(null) }}
        >
          <CategoryEditor
            category={cat}
            onChange={newCat => updateCategory(i, newCat)}
            onRemove={() => setPendingDeleteCat(i)}
            dragHandleProps={{}}
            isDragging={draggedCat === i}
            isDragOver={dragOverCat === i && draggedCat !== i}
          />
        </div>
      ))}

      {pendingDeleteCat !== null && (
        <DeleteCategoryModal
          category={tab.categorias[pendingDeleteCat]}
          onInativar={() => { updateCategory(pendingDeleteCat, { ...tab.categorias[pendingDeleteCat], ativo: false }); setPendingDeleteCat(null) }}
          onDeletar={() => { removeCategory(pendingDeleteCat); setPendingDeleteCat(null) }}
          onCancel={() => setPendingDeleteCat(null)}
        />
      )}

      <button
        onClick={addCategory}
        className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 text-slate-400 hover:text-amber-600 rounded-2xl text-sm font-medium transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nova Categoria
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
  const [dirty, setDirty] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [search, setSearch] = useState('')
  const [pendingDeleteSearch, setPendingDeleteSearch] = useState(null)
  const [draggedTab, setDraggedTab] = useState(null)
  const [dragOverTab, setDragOverTab] = useState(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const tabInputRef = useRef(null)

  const loadCardapio = useCallback(async ({ silent = false } = {}) => {
    // Se silent, não toca no loading — evita remount de componentes filhos
    // (ex: o SyncMenudinoModal perderia state se o editor trocasse a view
    // para o spinner via early return `if (loading)`).
    if (!silent) setLoading(true)
    try {
      const restSnap = await getDoc(doc(db, 'restaurants', slug))
      if (restSnap.exists()) setRestaurantName(restSnap.data().name)
      const snap = await getDoc(doc(db, 'restaurants', slug, 'data', 'cardapio'))
      if (snap.exists() && snap.data().content) setTabs(snap.data().content)
      else setTabs([])
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err)
    }
    if (!silent) setLoading(false)
  }, [slug])

  // Warn on unsaved changes
  useEffect(() => {
    if (!dirty) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const searchResults = search.trim()
    ? tabs.flatMap((tab, ti) =>
        tab.categorias.flatMap((cat, ci) =>
          cat.itens
            .map((item, ii) => ({ item, ti, ci, ii, tabLabel: tab.label, catLabel: cat.titulo }))
            .filter(({ item }) => normalize(item.nome).includes(normalize(search.trim())))
        )
      )
    : []

  function updateItemInSearch(ti, ci, ii, newItem) {
    setTabs(tabs.map((tab, t) => t !== ti ? tab : {
      ...tab,
      categorias: tab.categorias.map((cat, c) => c !== ci ? cat : {
        ...cat,
        itens: cat.itens.map((item, i) => i !== ii ? item : newItem)
      })
    }))
    setDirty(true)
  }

  function removeItemInSearch(ti, ci, ii) {
    setTabs(tabs.map((tab, t) => t !== ti ? tab : {
      ...tab,
      categorias: tab.categorias.map((cat, c) => c !== ci ? cat : {
        ...cat,
        itens: cat.itens.filter((_, i) => i !== ii)
      })
    }))
    setDirty(true)
  }

  function duplicateItemInSearch(ti, ci, ii) {
    setTabs(tabs.map((tab, t) => t !== ti ? tab : {
      ...tab,
      categorias: tab.categorias.map((cat, c) => {
        if (c !== ci) return cat
        const newItens = [...cat.itens]
        newItens.splice(ii + 1, 0, { ...cat.itens[ii], nome: cat.itens[ii].nome + ' (cópia)' })
        return { ...cat, itens: newItens }
      })
    }))
    setDirty(true)
  }

  useEffect(() => {
    loadCardapio()
  }, [loadCardapio])

  function updateTab(index, newTab) {
    const newTabs = [...tabs]
    newTabs[index] = newTab
    setTabs(newTabs)
    setDirty(true)
  }

  function removeTab(index) {
    if (!confirm(`Remover a aba "${tabs[index].label}" e todo seu conteúdo?`)) return
    const newTabs = tabs.filter((_, i) => i !== index)
    setTabs(newTabs)
    if (activeTab >= newTabs.length) setActiveTab(Math.max(0, newTabs.length - 1))
    setDirty(true)
  }

  function addTab() {
    const id = 'nova-' + generateId()
    const newTabs = [...tabs, { id, label: 'Nova Aba', categorias: [] }]
    setTabs(newTabs)
    setActiveTab(newTabs.length - 1)
    setDirty(true)
    setTimeout(() => tabInputRef.current?.select(), 50)
  }

  function updateTabLabel(index, newLabel) {
    const newTabs = [...tabs]
    newTabs[index] = {
      ...newTabs[index],
      label: newLabel,
      id: newLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-') || newTabs[index].id
    }
    setTabs(newTabs)
    setDirty(true)
  }

  function handleTabDrop(targetIndex) {
    if (draggedTab === null || draggedTab === targetIndex) {
      setDraggedTab(null); setDragOverTab(null); return
    }
    const newTabs = [...tabs]
    const [removed] = newTabs.splice(draggedTab, 1)
    newTabs.splice(targetIndex, 0, removed)
    setTabs(newTabs)
    setActiveTab(targetIndex)
    setDraggedTab(null); setDragOverTab(null)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'restaurants', slug, 'data', 'cardapio'), {
        content: tabs,
        updatedAt: new Date().toISOString()
      })
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  // O modal é renderizado no top-level do return, SEMPRE na mesma posição
  // da árvore JSX (primeiro filho do fragment). Isso garante que React
  // reconcilia ele como o mesmo elemento e nunca o desmonta, mesmo durante
  // um re-render que troca entre loading spinner e o editor completo.
  // Sem isso, o state do modal (logs, success) era perdido a cada re-render
  // que alternasse os returns.
  return (
    <>
      <SyncMenudinoModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        restaurantSlug={slug}
        onSyncComplete={() => { loadCardapio({ silent: true }); setDirty(false); }}
      />

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
        </div>
      )}

      {!loading && (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{restaurantName}</p>
          <h1 className="text-2xl font-bold text-slate-900">Cardápio</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && !saving && <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">● Não salvo</span>}
          {saved && <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">✓ Salvo</span>}
          <button
            onClick={() => setSyncModalOpen(true)}
            disabled={saving}
            title="Puxar cardápio do Menudino"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 rounded-xl transition disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronizar Menudino
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl transition disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>


      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar item no cardápio..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results */}
      {search.trim() && (
        <div className="space-y-3 mb-4">
          <p className="text-xs text-slate-400">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{search}"</p>
          {searchResults.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">Nenhum item encontrado.</div>
          )}
          {searchResults.map(({ item, ti, ci, ii, tabLabel, catLabel }) => (
            <div key={`${ti}-${ci}-${ii}`}>
              <p className="text-[11px] text-slate-400 mb-1 ml-1">{tabLabel} › {catLabel}</p>
              <ItemEditor
                item={item}
                index={ii}
                onChange={newItem => updateItemInSearch(ti, ci, ii, newItem)}
                onRemove={() => setPendingDeleteSearch({ item, ti, ci, ii })}
                onDuplicate={() => duplicateItemInSearch(ti, ci, ii)}
                dragHandleProps={{}}
              />
            </div>
          ))}
          {pendingDeleteSearch && (
            <DeleteItemModal
              item={pendingDeleteSearch.item}
              onInativar={() => {
                const { ti, ci, ii, item } = pendingDeleteSearch
                updateItemInSearch(ti, ci, ii, { ...item, ativo: false })
                setPendingDeleteSearch(null)
              }}
              onDeletar={() => {
                removeItemInSearch(pendingDeleteSearch.ti, pendingDeleteSearch.ci, pendingDeleteSearch.ii)
                setPendingDeleteSearch(null)
              }}
              onCancel={() => setPendingDeleteSearch(null)}
            />
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      {!search.trim() && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide items-center">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              draggable
              onDragStart={() => setDraggedTab(i)}
              onDragOver={e => { e.preventDefault(); setDragOverTab(i) }}
              onDrop={() => handleTabDrop(i)}
              onDragEnd={() => { setDraggedTab(null); setDragOverTab(null) }}
              className={`shrink-0 transition-all ${dragOverTab === i && draggedTab !== i ? 'scale-105' : ''} ${draggedTab === i ? 'opacity-40' : ''}`}
            >
              {activeTab === i ? (
                /* Active tab: inline input + delete button */
                <div className="flex items-center bg-amber-500 rounded-xl overflow-hidden shadow-sm">
                  <input
                    ref={tabInputRef}
                    value={tab.label}
                    onChange={e => updateTabLabel(i, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="px-3 py-2 bg-transparent text-slate-900 text-sm font-semibold outline-none min-w-[5rem] max-w-[14rem]"
                    style={{ width: `${Math.max((tab.label?.length || 4) + 2, 7)}ch` }}
                  />
                  <button
                    onClick={() => removeTab(i)}
                    className="pr-2.5 pl-0.5 text-amber-800/60 hover:text-red-700 transition"
                    title="Remover aba"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Inactive tab */
                <button
                  onClick={() => setActiveTab(i)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                >
                  {tab.label}
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addTab}
            className="shrink-0 px-3 py-2 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 text-slate-500 transition font-medium"
            title="Nova aba"
          >
            + Nova aba
          </button>
        </div>
      )}

      {/* Active Tab Editor */}
      {!search.trim() && tabs.length > 0 && tabs[activeTab] && (
        <TabEditor tab={tabs[activeTab]} onChange={newTab => updateTab(activeTab, newTab)} />
      )}

      {!search.trim() && tabs.length === 0 && (
        <div className="text-center py-24 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-medium text-slate-500 mb-1">Cardápio vazio</p>
          <p className="text-sm mb-4">Crie a primeira aba para começar a adicionar pratos</p>
          <button
            onClick={addTab}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl transition shadow-sm"
          >
            + Criar primeira aba
          </button>
        </div>
      )}
    </div>
      )}
    </>
  )
}

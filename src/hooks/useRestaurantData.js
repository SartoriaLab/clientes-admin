/**
 * useRestaurantData(slug, docId) — hook unificado pra ler/salvar
 * `restaurants/{slug}/data/{docId}`. Centraliza padrão repetido em
 * CardapioEditor, BusinessInfoEditor, VeiculosEditor, RoupasEditor, etc.
 *
 * Retorna: { data, loading, error, save, reload }
 *   - data: conteúdo de `content` do doc (ou null se não existe)
 *   - save(newContent): grava { content, updatedAt }
 */

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export function useRestaurantData(slug, docId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ref = doc(db, 'restaurants', slug, 'data', docId)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDoc(ref)
      setData(snap.exists() ? (snap.data().content ?? null) : null)
    } catch (e) {
      setError(e)
    }
    setLoading(false)
  }, [slug, docId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (newContent) => {
    await setDoc(ref, { content: newContent, updatedAt: new Date().toISOString() })
    setData(newContent)
  }, [slug, docId])

  return { data, loading, error, save, reload: load }
}

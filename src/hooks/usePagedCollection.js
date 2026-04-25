/**
 * usePagedCollection — pagina uma coleção Firestore via cursor (startAfter).
 *
 * Uso:
 *   const { items, loading, hasMore, loadMore } = usePagedCollection('restaurants', {
 *     pageSize: 20,
 *     orderField: 'createdAt',
 *     orderDir: 'desc'
 *   })
 *
 * Substitui `getDocs(collection(...))` puro nas listas Admin que carregavam tudo.
 */

import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export function usePagedCollection(path, opts = {}) {
  const { pageSize = 20, orderField = 'createdAt', orderDir = 'desc' } = opts
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)

  const fetchPage = useCallback(async (after) => {
    setLoading(true)
    setError(null)
    try {
      const constraints = [orderBy(orderField, orderDir), limit(pageSize)]
      if (after) constraints.splice(1, 0, startAfter(after))
      const snap = await getDocs(query(collection(db, path), ...constraints))
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setItems(prev => after ? [...prev, ...docs] : docs)
      setCursor(snap.docs[snap.docs.length - 1] || null)
      setHasMore(docs.length === pageSize)
    } catch (e) {
      setError(e)
    }
    setLoading(false)
  }, [path, pageSize, orderField, orderDir])

  useEffect(() => { fetchPage(null) }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!loading && hasMore && cursor) fetchPage(cursor)
  }, [loading, hasMore, cursor, fetchPage])

  const reload = useCallback(() => fetchPage(null), [fetchPage])

  return { items, loading, hasMore, error, loadMore, reload }
}

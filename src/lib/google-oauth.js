/**
 * google-oauth.js — fluxo OAuth Google via Worker (server-side client_secret).
 *
 * Browser nunca vê GOOGLE_CLIENT_SECRET. Worker valida Firebase ID token
 * antes de trocar code/refresh por tokens.
 */

import { auth } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const WORKER_URL = import.meta.env.VITE_OAUTH_WORKER_URL || import.meta.env.VITE_MENUDINO_SYNC_WORKER_URL || ''

async function callWorker(path, body) {
  if (!WORKER_URL) throw new Error('VITE_OAUTH_WORKER_URL não configurado')
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('não autenticado')
  const r = await fetch(WORKER_URL.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body)
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data.tokens
}

export function exchangeCode(code, redirectUri) {
  return callWorker('/oauth/google/exchange', { code, redirect_uri: redirectUri })
}

export function refreshAccessToken(refreshToken) {
  return callWorker('/oauth/google/refresh', { refresh_token: refreshToken })
}

export async function getValidGoogleToken(settingsDocId) {
  const snap = await getDoc(doc(db, 'settings', settingsDocId))
  if (!snap.exists()) return null
  const data = snap.data()

  if (data.expiresAt && data.expiresAt > Date.now() + 300000) {
    return data.accessToken
  }
  if (!data.refreshToken) return null

  let tokens
  try { tokens = await refreshAccessToken(data.refreshToken) }
  catch { return null }

  await setDoc(doc(db, 'settings', settingsDocId), {
    ...data,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  })

  return tokens.access_token
}

export function buildAuthUrl(clientId, redirectUri, scopes) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

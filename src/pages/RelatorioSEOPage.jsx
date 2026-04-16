import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { jsPDF } from 'jspdf'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly'

function formatNumber(n) {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatPercent(n) {
  return (n * 100).toFixed(1) + '%'
}

function formatPosition(n) {
  return n.toFixed(1)
}

function last30Days() {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

async function getValidToken() {
  const snap = await getDoc(doc(db, 'settings', 'googleSearchConsole'))
  if (!snap.exists()) return null
  const data = snap.data()

  // Check if token is still valid (with 5 min buffer)
  if (data.expiresAt && data.expiresAt > Date.now() + 300000) {
    return data.accessToken
  }

  // Refresh the token
  if (!data.refreshToken) return null
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: data.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!resp.ok) return null
  const tokens = await resp.json()

  await setDoc(doc(db, 'settings', 'googleSearchConsole'), {
    ...data,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  })

  return tokens.access_token
}

async function fetchSearchAnalytics(siteUrl, token, dimension, startDate, endDate) {
  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: dimension === 'query' ? 10 : 5,
      }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ${resp.status}`)
  }
  return resp.json()
}

async function fetchSummary(siteUrl, token, startDate, endDate) {
  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ${resp.status}`)
  }
  return resp.json()
}

async function fetchGoatCounter(gcUrl, token, endpoint, params = {}, attempt = 0) {
  const base = gcUrl.replace(/\/$/, '')
  const url = new URL(`${base}/api/v0/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.status === 429 && attempt < 4) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10)
    const waitMs = (retryAfter > 0 ? retryAfter : Math.pow(2, attempt)) * 1000
    await new Promise(r => setTimeout(r, waitMs))
    return fetchGoatCounter(gcUrl, token, endpoint, params, attempt + 1)
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error || `GoatCounter ${resp.status}`)
  }
  return resp.json()
}

function KpiCard({ label, value, icon, color, description }) {
  const colors = {
    blue:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', descColor: '#3b82f6' },
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', descColor: '#22c55e' },
    amber:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309', descColor: '#f59e0b' },
    purple: { bg: '#faf5ff', border: '#d8b4fe', text: '#7e22ce', descColor: '#a855f7' },
  }
  const c = colors[color] || colors.blue
  return (
    <div style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: '1rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '1.125rem' }}>{icon}</span>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, margin: 0 }}>{label}</p>
      </div>
      <p style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0.25rem 0' }}>{value}</p>
      {description && <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: 1.3 }}>{description}</p>}
    </div>
  )
}

export default function RelatorioSEOPage() {
  const { slug } = useParams()
  const reportRef = useRef(null)
  const [restaurant, setRestaurant] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [dateRange, setDateRange] = useState(() => last30Days())
  const dateRangeRef = useRef(dateRange)
  useEffect(() => { dateRangeRef.current = dateRange }, [dateRange])

  // GoatCounter state
  const [gcReport, setGcReport] = useState(null)
  const [gcGenerating, setGcGenerating] = useState(false)
  const [gcConfigOpen, setGcConfigOpen] = useState(false)
  const [gcUrlInput, setGcUrlInput] = useState('')
  const [gcTokenInput, setGcTokenInput] = useState('')
  const [gcSaving, setGcSaving] = useState(false)
  const [gcError, setGcError] = useState('')

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    setLoading(true)
    try {
      const [restSnap, contractSnap, authSnap] = await Promise.all([
        getDoc(doc(db, 'restaurants', slug)),
        getDoc(doc(db, 'contracts', slug)),
        getDoc(doc(db, 'settings', 'googleSearchConsole')),
      ])
      if (restSnap.exists()) setRestaurant({ id: restSnap.id, ...restSnap.data() })
      if (contractSnap.exists()) {
        const c = contractSnap.data()
        setContract(c)
        setGcUrlInput(c.goatcounterUrl || '')
        setGcTokenInput(c.goatcounterToken || '')
      }
      if (!authSnap.exists() || !authSnap.data().refreshToken) setNeedsAuth(true)
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
    }
    setLoading(false)
  }

  async function handleConnectGoogle() {
    if (!GOOGLE_CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID não configurado no .env')
      return
    }

    // Use OAuth 2.0 authorization code flow with popup
    const redirectUri = window.location.origin + import.meta.env.BASE_URL + 'oauth-callback.html'
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    const popup = window.open(authUrl.toString(), 'googleAuth', 'width=500,height=600')
    if (!popup) {
      setError('Popup bloqueado. Permita popups para este site.')
      return
    }

    // Listen for the auth code from the popup
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return
      if (!event.data?.code) return
      window.removeEventListener('message', handleMessage)

      try {
        // Exchange code for tokens
        const resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: event.data.code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        if (!resp.ok) throw new Error('Erro ao trocar código por tokens')
        const tokens = await resp.json()

        await setDoc(doc(db, 'settings', 'googleSearchConsole'), {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          connectedAt: new Date().toISOString(),
        })

        setNeedsAuth(false)
        setError('')
      } catch (err) {
        setError('Erro na autenticação: ' + err.message)
      }
    }

    window.addEventListener('message', handleMessage)
  }

  async function handleGenerateAll() {
    setGenerating(true)
    setGcGenerating(true)
    setError('')
    setGcError('')
    setReport(null)
    setGcReport(null)

    const { startDate, endDate } = dateRangeRef.current

    // GSC
    const gscPromise = (async () => {
      try {
        const siteUrl = contract?.siteUrl
        if (!siteUrl) throw new Error('Site URL não configurado para este cliente')

        const token = await getValidToken()
        if (!token) {
          setNeedsAuth(true)
          throw new Error('Token expirado. Reconecte o Google Search Console.')
        }

        const [summaryData, queriesData, pagesData] = await Promise.all([
          fetchSummary(siteUrl, token, startDate, endDate),
          fetchSearchAnalytics(siteUrl, token, 'query', startDate, endDate),
          fetchSearchAnalytics(siteUrl, token, 'page', startDate, endDate),
        ])

        setReport({
          period: { start: startDate, end: endDate },
          summary: {
            impressions: summaryData.rows?.[0]?.impressions || 0,
            position: summaryData.rows?.[0]?.position || 0,
          },
          topQueries: (queriesData.rows || []).map(r => ({
            query: r.keys[0],
            impressions: r.impressions,
          })),
          topPages: (pagesData.rows || []).map(r => ({
            page: r.keys[0],
            impressions: r.impressions,
          })),
          generatedAt: new Date().toISOString(),
        })
      } catch (err) {
        setError(err.message)
      }
      setGenerating(false)
    })()

    // GoatCounter
    const gcPromise = (async () => {
      try {
        const gcUrl = contract?.goatcounterUrl
        const gcToken = contract?.goatcounterToken
        if (!gcUrl || !gcToken) return

        const params = { start: startDate, end: endDate }
        // Sequencial para evitar 429 do GoatCounter (limite agressivo no /stats/*)
        const totalData = await fetchGoatCounter(gcUrl, gcToken, 'stats/total', params)
        await new Promise(r => setTimeout(r, 350))
        const hitsData = await fetchGoatCounter(gcUrl, gcToken, 'stats/hits', { ...params, limit: 10 })
        await new Promise(r => setTimeout(r, 350))
        const refsData = await fetchGoatCounter(gcUrl, gcToken, 'stats/toprefs', { ...params, limit: 5 })

        const hits = (hitsData.hits || []).map(h => ({
          path: h.path || h.name || '/',
          title: h.title || '',
          count: h.count || 0,
          countUnique: h.count_unique || 0,
        }))
        const refs = (refsData.stats || []).map(r => ({
          ref: r.name || '(direto)',
          count: r.count || 0,
          countUnique: r.count_unique || 0,
        }))

        setGcReport({
          period: { start: startDate, end: endDate },
          summary: {
            pageviews: totalData.total || 0,
            unique: totalData.total_unique || 0,
            topPath: hits[0]?.path || '—',
            topRef: refs[0]?.ref || 'Acesso direto',
          },
          topHits: hits,
          topRefs: refs,
          generatedAt: new Date().toISOString(),
        })
      } catch (err) {
        setGcError(err.message)
      }
      setGcGenerating(false)
    })()

    await Promise.all([gscPromise, gcPromise])
  }

  async function handleSaveGoatCounter() {
    setGcError('')
    const url = gcUrlInput.trim().replace(/\/$/, '')
    const token = gcTokenInput.trim()
    if (!url || !token) {
      setGcError('Preencha URL e token.')
      return
    }
    if (!/^https?:\/\//.test(url)) {
      setGcError('URL deve começar com http:// ou https://')
      return
    }
    setGcSaving(true)
    try {
      await setDoc(
        doc(db, 'contracts', slug),
        { goatcounterUrl: url, goatcounterToken: token },
        { merge: true }
      )
      setContract(prev => ({ ...(prev || {}), goatcounterUrl: url, goatcounterToken: token }))
      setGcConfigOpen(false)
    } catch (err) {
      setGcError('Erro ao salvar: ' + err.message)
    }
    setGcSaving(false)
  }

  function handleExportPDF() {
    if (!report && !gcReport) return
    setExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const margin = 15
      const contentW = W - margin * 2
      let y = margin

      // Helper functions
      const setColor = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setTextColor(r, g, b)
      }
      const setFillColor = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setFillColor(r, g, b)
      }
      const setDrawColor = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        pdf.setDrawColor(r, g, b)
      }
      const checkPage = (needed) => {
        if (y + needed > 280) { pdf.addPage(); y = margin }
      }

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      setColor('#1e293b')
      pdf.text(restaurant.name, W / 2, y, { align: 'center' })
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      setColor('#64748b')
      pdf.text('Relatório de Desempenho Digital', W / 2, y, { align: 'center' })
      y += 6

      const periodLabel = report
        ? `${formatDateBR(report.period.start)} a ${formatDateBR(report.period.end)}`
        : gcReport
          ? `${formatDateBR(gcReport.period.start)} a ${formatDateBR(gcReport.period.end)}`
          : ''
      pdf.setFontSize(9)
      setColor('#94a3b8')
      pdf.text(`Período: ${periodLabel}`, W / 2, y, { align: 'center' })
      y += 10

      // Divider
      setDrawColor('#e2e8f0')
      pdf.line(margin, y, W - margin, y)
      y += 8

      // ── Seção 1: GoatCounter ────────────────────────────────────────
      if (gcReport) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        setColor('#1e293b')
        pdf.text('Visitas ao site', margin, y)
        y += 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#64748b')
        const gcIntroLines = pdf.splitTextToSize(
          'Dados do GoatCounter: quem realmente visitou seu site, de onde veio e quais páginas acessou.',
          contentW
        )
        pdf.text(gcIntroLines, margin, y)
        y += gcIntroLines.length * 4 + 6

        // GC KPI Cards
        const gcCardW = (contentW - 6) / 2
        const gcCardH = 28
        const gcKpis = [
          { label: 'PAGEVIEWS', value: formatNumber(gcReport.summary.pageviews), desc: 'Total de páginas visualizadas', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
          { label: 'VISITANTES ÚNICOS', value: formatNumber(gcReport.summary.unique), desc: 'Pessoas distintas que visitaram o site', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
        ]
        gcKpis.forEach((kpi, i) => {
          const cx = margin + i * (gcCardW + 6)
          const cy = y
          setFillColor(kpi.bg)
          setDrawColor(kpi.border)
          pdf.roundedRect(cx, cy, gcCardW, gcCardH, 2, 2, 'FD')
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7)
          setColor(kpi.text)
          pdf.text(kpi.label, cx + 4, cy + 6)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(16)
          pdf.text(kpi.value, cx + 4, cy + 15)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(6.5)
          setColor('#64748b')
          const descLines = pdf.splitTextToSize(kpi.desc, gcCardW - 8)
          pdf.text(descLines, cx + 4, cy + 21)
        })
        y += gcCardH + 10

        // GC Top Pages
        if (gcReport.topHits.length > 0) {
          checkPage(40)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          setColor('#1e293b')
          pdf.text('Páginas mais visitadas', margin, y)
          y += 4
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7.5)
          setColor('#64748b')
          pdf.text('Caminhos do site que receberam mais acessos diretos no período.', margin, y)
          y += 6

          setFillColor('#f8fafc')
          setDrawColor('#e2e8f0')
          pdf.roundedRect(margin, y, contentW, 7, 1, 1, 'FD')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(7)
          setColor('#64748b')
          pdf.text('#', margin + 3, y + 5)
          pdf.text('Página', margin + 12, y + 5)
          pdf.text('Visitas', W - margin - 25, y + 5, { align: 'right' })
          pdf.text('Únicos', W - margin - 3, y + 5, { align: 'right' })
          y += 8

          gcReport.topHits.forEach((h, i) => {
            checkPage(7)
            if (i % 2 === 1) {
              setFillColor('#f8fafc')
              pdf.rect(margin, y - 1, contentW, 7, 'F')
            }
            const displayPath = h.path === '/' ? 'Página inicial' : (h.path.length > 45 ? h.path.slice(0, 45) + '…' : h.path)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            setColor('#94a3b8')
            pdf.text(`${i + 1}`, margin + 3, y + 4)
            setColor('#334155')
            pdf.setFont('helvetica', 'bold')
            pdf.text(displayPath, margin + 12, y + 4)
            pdf.setFont('helvetica', 'normal')
            setColor('#15803d')
            pdf.text(formatNumber(h.count), W - margin - 25, y + 4, { align: 'right' })
            setColor('#64748b')
            pdf.text(formatNumber(h.countUnique), W - margin - 3, y + 4, { align: 'right' })
            y += 7
          })
          y += 8
        }

        // GC Top Referrers
        if (gcReport.topRefs.length > 0) {
          checkPage(40)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          setColor('#1e293b')
          pdf.text('De onde vieram as visitas', margin, y)
          y += 4
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7.5)
          setColor('#64748b')
          pdf.text('Sites e fontes que mais trouxeram visitantes.', margin, y)
          y += 6

          setFillColor('#f8fafc')
          setDrawColor('#e2e8f0')
          pdf.roundedRect(margin, y, contentW, 7, 1, 1, 'FD')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(7)
          setColor('#64748b')
          pdf.text('#', margin + 3, y + 5)
          pdf.text('Origem', margin + 12, y + 5)
          pdf.text('Visitas', W - margin - 3, y + 5, { align: 'right' })
          y += 8

          gcReport.topRefs.forEach((r, i) => {
            checkPage(7)
            if (i % 2 === 1) {
              setFillColor('#f8fafc')
              pdf.rect(margin, y - 1, contentW, 7, 'F')
            }
            const displayRef = r.ref.length > 55 ? r.ref.slice(0, 55) + '…' : r.ref
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            setColor('#94a3b8')
            pdf.text(`${i + 1}`, margin + 3, y + 4)
            setColor('#334155')
            pdf.setFont('helvetica', 'bold')
            pdf.text(displayRef, margin + 12, y + 4)
            pdf.setFont('helvetica', 'normal')
            setColor('#7e22ce')
            pdf.text(formatNumber(r.count), W - margin - 3, y + 4, { align: 'right' })
            y += 7
          })
          y += 8
        }

        // GC summary tip
        checkPage(20)
        setFillColor('#f0fdf4')
        setDrawColor('#bbf7d0')
        const gcTipText = gcReport.summary.pageviews > 0
          ? `No período, ${formatNumber(gcReport.summary.unique)} visitantes únicos geraram ${formatNumber(gcReport.summary.pageviews)} visualizações de página. A origem principal foi: ${gcReport.summary.topRef}.`
          : 'Ainda não há dados de visitas para este período. Aguarde alguns dias após a publicação do site.'
        const gcTipLines = pdf.splitTextToSize(gcTipText, contentW - 10)
        const gcTipH = gcTipLines.length * 4 + 12
        pdf.roundedRect(margin, y, contentW, gcTipH, 2, 2, 'FD')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        setColor('#15803d')
        pdf.text('O que esses números significam?', margin + 5, y + 6)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#14532d')
        pdf.text(gcTipLines, margin + 5, y + 12)
        y += gcTipH + 12
      }

      // ── Seção 2: Google Search Console ──────────────────────────────
      if (report) {
        checkPage(30)
        setDrawColor('#e2e8f0')
        pdf.line(margin, y, W - margin, y)
        y += 10

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        setColor('#1e293b')
        pdf.text('Como seu site apareceu no Google', margin, y)
        y += 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#64748b')
        const gscIntroLines = pdf.splitTextToSize(
          'Dados do Google Search Console: quantas vezes seu site apareceu nas pesquisas e em qual posição.',
          contentW
        )
        pdf.text(gscIntroLines, margin, y)
        y += gscIntroLines.length * 4 + 6

        // KPI Cards — 2 cards lado a lado (sem Cliques e CTR)
        const cardW = (contentW - 6) / 2
        const cardH = 28
        const kpis = [
          { label: 'IMPRESSÕES', value: formatNumber(report.summary.impressions), desc: 'Quantas vezes seu site apareceu no Google', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
          { label: 'POSIÇÃO MÉDIA', value: formatPosition(report.summary.position), desc: 'Posição média nos resultados. Posição 1 = primeiro resultado', bg: '#faf5ff', border: '#d8b4fe', text: '#7e22ce' },
        ]

        kpis.forEach((kpi, i) => {
          const cx = margin + i * (cardW + 6)
          const cy = y

          setFillColor(kpi.bg)
          setDrawColor(kpi.border)
          pdf.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD')

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7)
          setColor(kpi.text)
          pdf.text(kpi.label, cx + 4, cy + 6)

          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(16)
          pdf.text(kpi.value, cx + 4, cy + 15)

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(6.5)
          setColor('#64748b')
          const descLines = pdf.splitTextToSize(kpi.desc, cardW - 8)
          pdf.text(descLines, cx + 4, cy + 21)
        })

        y += cardH + 10
      }

      // Top Queries table
      if (report?.topQueries?.length > 0) {
        checkPage(40)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        setColor('#1e293b')
        pdf.text('O que as pessoas pesquisaram para te encontrar', margin, y)
        y += 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#64748b')
        pdf.text('Termos que as pessoas digitaram no Google e que fizeram seu site aparecer.', margin, y)
        y += 6

        setFillColor('#f8fafc')
        setDrawColor('#e2e8f0')
        pdf.roundedRect(margin, y, contentW, 7, 1, 1, 'FD')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        setColor('#64748b')
        pdf.text('#', margin + 3, y + 5)
        pdf.text('O que pesquisaram', margin + 12, y + 5)
        pdf.text('Apareceu', W - margin - 3, y + 5, { align: 'right' })
        y += 8

        report.topQueries.forEach((q, i) => {
          checkPage(7)
          if (i % 2 === 1) {
            setFillColor('#f8fafc')
            pdf.rect(margin, y - 1, contentW, 7, 'F')
          }
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          setColor('#94a3b8')
          pdf.text(`${i + 1}`, margin + 3, y + 4)
          setColor('#334155')
          pdf.setFont('helvetica', 'bold')
          const queryText = q.query.length > 50 ? q.query.slice(0, 50) + '…' : q.query
          pdf.text(queryText, margin + 12, y + 4)
          pdf.setFont('helvetica', 'normal')
          setColor('#64748b')
          pdf.text(formatNumber(q.impressions), W - margin - 3, y + 4, { align: 'right' })
          y += 7
        })
        y += 8
      }

      // Top Pages table (GSC)
      if (report?.topPages?.length > 0) {
        checkPage(40)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        setColor('#1e293b')
        pdf.text('Páginas que mais apareceram no Google', margin, y)
        y += 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#64748b')
        pdf.text('Páginas com mais aparições nos resultados de pesquisa.', margin, y)
        y += 6

        setFillColor('#f8fafc')
        setDrawColor('#e2e8f0')
        pdf.roundedRect(margin, y, contentW, 7, 1, 1, 'FD')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        setColor('#64748b')
        pdf.text('#', margin + 3, y + 5)
        pdf.text('Página', margin + 12, y + 5)
        pdf.text('Apareceu', W - margin - 3, y + 5, { align: 'right' })
        y += 8

        report.topPages.forEach((p, i) => {
          checkPage(7)
          if (i % 2 === 1) {
            setFillColor('#f8fafc')
            pdf.rect(margin, y - 1, contentW, 7, 'F')
          }
          let displayUrl = p.page
          try { displayUrl = new URL(p.page).pathname } catch {}
          if (displayUrl === '/') displayUrl = 'Página inicial'
          if (displayUrl.length > 50) displayUrl = displayUrl.slice(0, 50) + '…'

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          setColor('#94a3b8')
          pdf.text(`${i + 1}`, margin + 3, y + 4)
          setColor('#334155')
          pdf.setFont('helvetica', 'bold')
          pdf.text(displayUrl, margin + 12, y + 4)
          pdf.setFont('helvetica', 'normal')
          setColor('#64748b')
          pdf.text(formatNumber(p.impressions), W - margin - 3, y + 4, { align: 'right' })
          y += 7
        })
        y += 8
      }

      // GSC summary tip
      if (report) {
        checkPage(20)
        setFillColor('#fffbeb')
        setDrawColor('#fde68a')
        const tipText = report.summary.impressions > 0
          ? `No período selecionado, seu site apareceu ${formatNumber(report.summary.impressions)} vezes nas pesquisas do Google. Posição média: ${formatPosition(report.summary.position)} (quanto menor, melhor).`
          : 'Seu site ainda está começando a aparecer no Google. É normal levar algumas semanas para os resultados crescerem.'
        const tipLines = pdf.splitTextToSize(tipText, contentW - 10)
        const tipH = tipLines.length * 4 + 12
        pdf.roundedRect(margin, y, contentW, tipH, 2, 2, 'FD')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        setColor('#92400e')
        pdf.text('O que significa posição média?', margin + 5, y + 6)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        setColor('#78350f')
        pdf.text(tipLines, margin + 5, y + 12)
        y += tipH + 12
      }

      // Footer
      checkPage(15)
      setDrawColor('#f1f5f9')
      pdf.line(margin, y, W - margin, y)
      y += 5
      pdf.setFontSize(7)
      setColor('#94a3b8')
      const sources = [report && 'Google Search Console', gcReport && 'GoatCounter'].filter(Boolean).join(' + ')
      const footerText = `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} — Dados: ${sources}`
      pdf.text(footerText, W / 2, y, { align: 'center' })

      pdf.save(`relatorio-seo-${slug}-${new Date().toISOString().slice(0, 7)}.pdf`)
    } catch (err) {
      setError('Erro ao exportar PDF: ' + err.message)
    }
    setExporting(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-slate-500">Cliente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Relatório SEO</h1>
            <p className="text-sm text-slate-500 mt-0.5">{restaurant.name} — {contract?.siteUrl || 'Site URL não configurado'}</p>
          </div>
          <div className="flex items-center gap-2">
            {(report || gcReport) && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition disabled:opacity-50"
              >
                {exporting ? 'Exportando…' : '📄 Exportar PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Date range + generate button */}
        <div className="mt-4 flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
            <input
              type="date"
              value={dateRange.startDate}
              max={dateRange.endDate}
              onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
            <input
              type="date"
              value={dateRange.endDate}
              min={dateRange.startDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          <div className="flex items-end gap-2 ml-auto">
            {needsAuth && (
              <button
                onClick={handleConnectGoogle}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm px-4 py-2 rounded-xl transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Conectar Search Console
              </button>
            )}
            <button
              onClick={handleGenerateAll}
              disabled={generating || gcGenerating || (!contract?.siteUrl && !contract?.goatcounterUrl)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {generating || gcGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Gerando…
                </>
              ) : (
                <>📊 Gerar Relatório</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {!report && !gcReport && !generating && !gcGenerating && !error && !gcError && (
        <div className="bg-white rounded-2xl border border-slate-200 py-24 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-slate-500 text-sm">
            {needsAuth
              ? 'Conecte sua conta Google para acessar o Search Console.'
              : 'Selecione o período e clique em "Gerar Relatório".'
            }
          </p>
        </div>
      )}

      {/* === Seção GoatCounter === */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">📈 Acessos no site (GoatCounter)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {contract?.goatcounterUrl
                ? <>Conectado a <span className="font-mono text-xs">{contract.goatcounterUrl}</span></>
                : 'Tracking cookieless de visitas — configure abaixo para começar.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGcConfigOpen(v => !v)}
              className="text-sm text-slate-600 hover:text-slate-800 font-medium px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
            >
              ⚙️ {contract?.goatcounterUrl ? 'Editar' : 'Configurar'}
            </button>
          </div>
        </div>

        {gcConfigOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Configuração do GoatCounter</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL do site GoatCounter</label>
                <input
                  type="url"
                  value={gcUrlInput}
                  onChange={e => setGcUrlInput(e.target.value)}
                  placeholder="https://marietabistro.goatcounter.com"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  API Token (gere em <span className="font-mono">{'{url}'}/user/api</span> com permissão "Read statistics")
                </label>
                <input
                  type="password"
                  value={gcTokenInput}
                  onChange={e => setGcTokenInput(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setGcConfigOpen(false); setGcError('') }}
                  className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveGoatCounter}
                  disabled={gcSaving}
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {gcSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {gcError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {gcError}
          </div>
        )}

        {!gcReport && !gcGenerating && !gcError && (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
            <p className="text-4xl mb-3">📈</p>
            <p className="text-slate-500 text-sm">
              {contract?.goatcounterUrl && contract?.goatcounterToken
                ? 'Clique em "Gerar relatório de acessos" para buscar pageviews e visitantes.'
                : 'Configure a URL e o token do GoatCounter para ver os dados de acesso.'}
            </p>
          </div>
        )}

        {gcReport && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{restaurant.name}</h2>
              <p style={{ fontSize: '1rem', color: '#64748b', marginTop: '0.5rem' }}>Quem visitou seu site</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Período: {formatDateBR(gcReport.period.start)} a {formatDateBR(gcReport.period.end)}
              </p>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#15803d', margin: 0, lineHeight: 1.6 }}>
                Estes números mostram quantas pessoas realmente visitaram seu site (não apenas viram no Google).
                O GoatCounter respeita a privacidade — não usa cookies nem rastreia identificação pessoal.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <KpiCard label="Pageviews" value={formatNumber(gcReport.summary.pageviews)} icon="👁️" color="green" description="Total de páginas visualizadas no período" />
              <KpiCard label="Visitantes únicos" value={formatNumber(gcReport.summary.unique)} icon="👤" color="blue" description="Pessoas distintas que visitaram seu site" />
              <KpiCard label="Página mais vista" value={gcReport.summary.topPath === '/' ? 'Início' : gcReport.summary.topPath} icon="📄" color="amber" description="A página que mais recebeu visitas" />
              <KpiCard label="Principal origem" value={gcReport.summary.topRef} icon="🔗" color="purple" description="De onde a maior parte das visitas chegou" />
            </div>

            {gcReport.topHits.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Páginas mais visitadas</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Caminhos do site que receberam mais acessos no período.</p>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Página</th>
                      <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Pageviews</th>
                      <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Visitantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcReport.topHits.map((h, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ padding: '0.625rem 1rem', color: '#334155', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.path}>
                          {h.path === '/' ? 'Página inicial' : h.path}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>{formatNumber(h.count)}</td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#64748b' }}>{formatNumber(h.countUnique)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {gcReport.topRefs.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>De onde vieram</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Sites e fontes que mais trouxeram visitas.</p>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Origem</th>
                      <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Visitas</th>
                      <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Únicos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcReport.topRefs.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ padding: '0.625rem 1rem', color: '#334155', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ref}>
                          {r.ref}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#7e22ce', fontWeight: 600 }}>{formatNumber(r.count)}</td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#64748b' }}>{formatNumber(r.countUnique)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Relatório gerado em {new Date(gcReport.generatedAt).toLocaleDateString('pt-BR')} às{' '}
                {new Date(gcReport.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' '}— Dados do GoatCounter
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Report content — Google Search Console */}
      {report && (
        <div ref={reportRef} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {/* Report Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{restaurant.name}</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', marginTop: '0.5rem' }}>
              Desempenho no Google — Search Console
            </p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Período: {formatDateBR(report.period.start)} a {formatDateBR(report.period.end)}
            </p>
          </div>

          {/* Intro explanation */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>
              Dados do Google Search Console: quantas vezes seu site apareceu nas pesquisas e em qual posição média nos resultados.
            </p>
          </div>

          {/* KPI Cards — só Impressões e Posição */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <KpiCard
              label="Impressões no Google"
              value={formatNumber(report.summary.impressions)}
              icon="👁️"
              color="green"
              description="Quantas vezes seu site apareceu nos resultados de busca do Google"
            />
            <KpiCard
              label="Posição Média"
              value={formatPosition(report.summary.position)}
              icon="📍"
              color="purple"
              description="Em que posição do Google seu site aparece em média. Posição 1 = primeiro resultado"
            />
          </div>

          {/* Top Queries */}
          {report.topQueries.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                O que as pessoas pesquisaram para te encontrar
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Estes são os termos que as pessoas digitaram no Google e que fizeram seu site aparecer nos resultados.
              </p>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>O que pesquisaram</th>
                    <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Viram no Google</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topQueries.map((q, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                      <td style={{ padding: '0.625rem 1rem', color: '#334155', fontWeight: 500 }}>{q.query}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#64748b' }}>{formatNumber(q.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Pages */}
          {report.topPages.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                Páginas mais visitadas do seu site
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Estas são as páginas do seu site que mais receberam visitas vindas do Google.
              </p>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Página</th>
                    <th style={{ textAlign: 'right', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Viram no Google</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topPages.map((p, i) => {
                    let displayUrl = p.page
                    try { displayUrl = new URL(p.page).pathname } catch {}
                    if (displayUrl === '/') displayUrl = 'Página inicial'
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ padding: '0.625rem 1rem', color: '#334155', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.page}>
                          {displayUrl}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#64748b' }}>{formatNumber(p.impressions)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary tip */}
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', margin: '0 0 0.25rem 0' }}>💡 O que significa posição média?</p>
            <p style={{ fontSize: '0.75rem', color: '#78350f', margin: 0, lineHeight: 1.6 }}>
              {report.summary.impressions > 0
                ? `No período selecionado, seu site apareceu ${formatNumber(report.summary.impressions)} vezes nas pesquisas do Google. A posição média ${formatPosition(report.summary.position)} significa que, em média, seu site estava na ${formatPosition(report.summary.position)}ª posição dos resultados — quanto menor, melhor.`
                : 'Seu site ainda está começando a aparecer no Google. É normal levar algumas semanas para os resultados crescerem. Continue mantendo o site atualizado!'
              }
            </p>
          </div>

          {/* Footer */}
          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Relatório gerado em {new Date(report.generatedAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(report.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' '}— Dados do Google Search Console
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

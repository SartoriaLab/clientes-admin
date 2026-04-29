import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startIsoForDays(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function capitalize(s) {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const TYPE_LABEL = {
  whatsapp_click: 'WhatsApp',
  form_submit: 'Formulário',
  phone_click: 'Telefone',
}

function typeLabel(t) { return TYPE_LABEL[t] || t }

function buildDailyBuckets(leads, days) {
  const buckets = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    buckets[key] = 0
  }
  leads.forEach(l => {
    const key = l.ts ? l.ts.slice(0, 10) : null
    if (key && key in buckets) buckets[key]++
  })
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

function topSource(leads) {
  if (!leads.length) return '—'
  const counts = {}
  leads.forEach(l => { counts[l.source || 'direct'] = (counts[l.source || 'direct'] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
}

function sourceDistribution(leads) {
  const counts = {}
  leads.forEach(l => { const s = l.source || 'direct'; counts[s] = (counts[s] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

function leadsLastN(leads, days) {
  const cutoff = startIsoForDays(days)
  return leads.filter(l => l.ts >= cutoff).length
}

function exportCsv(leads) {
  const cols = ['data', 'tipo', 'source', 'medium', 'campaign', 'gclid', 'fbclid', 'landingPage', 'currentPage', 'sessionId']
  const rows = leads.map(l => [
    l.ts || '',
    typeLabel(l.type),
    l.source || '',
    l.medium || '',
    l.campaign || '',
    l.gclid || '',
    l.fbclid || '',
    l.landingPage || '',
    l.currentPage || '',
    l.sessionId || '',
  ])
  const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Hook de dados
// ---------------------------------------------------------------------------

function useLeads(slug, days) {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return
    setLeads(null)
    setError(null)

    const startIso = startIsoForDays(days)
    const q = query(
      collection(db, 'restaurants', slug, 'leads'),
      where('ts', '>=', startIso),
      orderBy('ts', 'desc'),
      limit(1000)
    )

    getDocs(q)
      .then(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setLeads(docs)
      })
      .catch(err => {
        console.error('useLeads:', err)
        setError(err.message || 'Erro ao carregar leads')
      })
  }, [slug, days])

  return { leads, error }
}

// ---------------------------------------------------------------------------
// Componentes visuais
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function BarChartByDay({ buckets }) {
  const max = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Leads por dia</p>
      <div className="flex items-end gap-1" style={{ height: '80px' }}>
        {buckets.map(({ date, count }) => (
          <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full rounded-t bg-amber-400 transition-all"
              style={{ height: `${Math.max(2, (count / max) * 56)}px` }}
              title={`${date}: ${count}`}
            />
            {buckets.length <= 14 && (
              <span className="text-[9px] text-slate-400 truncate w-full text-center">
                {fmtDay(date + 'T00:00:00')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceChart({ dist, total }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Origem do tráfego</p>
      <div className="space-y-2">
        {dist.slice(0, 8).map(([source, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={source}>
              <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                <span className="font-medium">{capitalize(source)}</span>
                <span>{count} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full">
                <div className="h-2 bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {dist.length === 0 && <p className="text-sm text-slate-400">Sem dados</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25
const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

export default function RelatorioLeadsPage() {
  const { slug } = useParams()
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)

  const { leads, error } = useLeads(slug, days)

  // Reset página ao mudar período
  useEffect(() => { setPage(1) }, [days])

  const daily = useMemo(() => leads ? buildDailyBuckets(leads, days) : [], [leads, days])
  const dist = useMemo(() => leads ? sourceDistribution(leads) : [], [leads])
  const today7 = useMemo(() => leads ? leadsLastN(leads, 7) : 0, [leads])
  const top = useMemo(() => leads ? topSource(leads) : '—', [leads])

  const totalPages = leads ? Math.max(1, Math.ceil(leads.length / PAGE_SIZE)) : 1
  const paginated = leads ? leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatório de Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">{slug}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtros de período */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  days === p.days
                    ? 'bg-white shadow text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Export */}
          {leads && leads.length > 0 && (
            <button
              onClick={() => exportCsv(leads)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {leads === null && !error && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
          Erro ao carregar leads: {error}
        </div>
      )}

      {leads !== null && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total de leads"
              value={leads.length}
              sub={`últimos ${days} dias`}
            />
            <KpiCard
              label="Canal principal"
              value={capitalize(top)}
              sub="por volume de conversões"
            />
            <KpiCard
              label="Últimos 7 dias"
              value={today7}
              sub="independente do filtro"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartByDay buckets={daily} />
            <SourceChart dist={dist} total={leads.length} />
          </div>

          {/* Tabela */}
          {leads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Nenhum lead registrado nos últimos {days} dias.</p>
              <p className="text-slate-400 text-xs mt-2">
                Instale o snippet de rastreamento no site do cliente para começar a capturar leads.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Origem</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Meio</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campanha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Página</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(lead.ts)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            lead.type === 'whatsapp_click' ? 'bg-green-100 text-green-700' :
                            lead.type === 'phone_click' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {typeLabel(lead.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{capitalize(lead.source)}</td>
                        <td className="px-4 py-3 text-slate-500">{lead.medium || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate" title={lead.campaign}>{lead.campaign || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate text-xs" title={lead.landingPage}>
                          {lead.landingPage ? lead.landingPage.replace(/^https?:\/\//, '') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, leads.length)} de {leads.length} leads
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Próximo →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

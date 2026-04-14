import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// ── Helpers ──────────────────────────────────────────────────────────────────

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function thisMonthRecord(contract) {
  return contract?.paymentHistory?.find(r => r.month === currentMonth())
}

function paymentStatus(contract) {
  if (!contract) return 'unknown'
  const record = thisMonthRecord(contract)
  if (record?.paid) return 'paid'
  const today = new Date()
  const dueDate = new Date(today.getFullYear(), today.getMonth(), contract.paymentDay)
  const diff = Math.floor((dueDate - today) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'due-soon'
  return 'pending'
}

function daysUntilDomainRenewal(contract) {
  if (!contract?.domainRenewal) return null
  const renewal = new Date(contract.domainRenewal)
  return Math.floor((renewal - new Date()) / 86400000)
}

function contractMonthsRemaining(contract) {
  if (!contract?.contractEnd) return null
  const end = new Date(contract.contractEnd)
  const now = new Date()
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  return Math.max(0, months)
}

function lastNMonths(n = 12) {
  const months = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function formatMonthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[Number(m) - 1]}/${y.slice(2)}`
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function whatsappLink(phone, name, amount, paymentDay) {
  const msg = encodeURIComponent(
    `Olá ${name}! Passando para lembrar que o boleto do seu site vence dia ${paymentDay}. ` +
    `Valor: ${brl.format(amount)}. Qualquer dúvida estou à disposição! 😊`
  )
  const number = (phone || '').replace(/\D/g, '')
  return `https://wa.me/55${number}?text=${msg}`
}

const DEFAULT_CONTRACT = {
  contractValue: 0,
  contractStart: new Date().toISOString().slice(0, 10),
  contractEnd: null,
  paymentDay: 5,
  domain: '',
  domainRenewal: null,
  domainCost: 0,
  status: 'active',
  notes: '',
  paymentHistory: [],
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    slate:  'bg-slate-50 border-slate-200 text-slate-600',
  }
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] || colors.slate}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

function PaymentBadge({ contract }) {
  if (!contract) return <span className="text-xs text-slate-400">—</span>
  const ps = paymentStatus(contract)
  const map = {
    paid:      { cls: 'bg-green-100 text-green-700',  label: '✅ Pago' },
    overdue:   { cls: 'bg-red-100 text-red-700 font-bold', label: '🔴 Vencido' },
    'due-soon':{ cls: 'bg-yellow-100 text-yellow-700 font-bold', label: '⚠️ Vence em breve' },
    pending:   { cls: 'bg-slate-100 text-slate-500',  label: `Dia ${contract.paymentDay}` },
    unknown:   { cls: 'bg-slate-100 text-slate-400',  label: '—' },
  }
  const { cls, label } = map[ps] || map.unknown
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function DomainBadge({ contract }) {
  const days = daysUntilDomainRenewal(contract)
  if (days === null) return <span className="text-xs text-slate-400">—</span>
  if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">🔴 Vencido</span>
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">🟠 {days}d</span>
  return <span className="text-xs text-slate-500">{days}d</span>
}

function ContractDuration({ contract }) {
  if (!contract) return <span className="text-xs text-slate-400">—</span>
  const months = contractMonthsRemaining(contract)
  if (months === null) return <span className="text-xs text-slate-500">Indeterminado</span>
  if (months <= 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Encerrado</span>
  if (months === 1) return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">{'< 1 mês'}</span>
  return <span className="text-xs text-slate-500">{months} meses</span>
}

function StatusBadge({ status }) {
  const map = {
    active:    'bg-green-100 text-green-700',
    suspended: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels = { active: 'Ativo', suspended: 'Suspenso', cancelled: 'Cancelado' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {labels[status] || status}
    </span>
  )
}

function SparklineBar({ contracts, restaurants }) {
  const months = lastNMonths(6)
  const bars = months.map(month => {
    const total = restaurants.reduce((sum, r) => {
      const c = contracts[r.slug]
      if (!c || c.status !== 'active') return sum
      const rec = (c.paymentHistory || []).find(p => p.month === month)
      return sum + (rec?.paid ? (rec.amount || c.contractValue || 0) : 0)
    }, 0)
    return { month, total }
  })
  const max = Math.max(...bars.map(b => b.total), 1)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Receita recebida — últimos 6 meses</p>
      <div className="flex items-end gap-2 h-16">
        {bars.map(({ month, total }) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500">{brl.format(total).replace('R$\u00a0', 'R$')}</span>
            <div
              className="w-full rounded-t-md bg-amber-400 transition-all"
              style={{ height: `${Math.max(4, (total / max) * 48)}px` }}
            />
            <span className="text-[10px] text-slate-400">{formatMonthLabel(month)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentHistoryModal({ restaurant, contract, onToggle, onClose }) {
  const months = lastNMonths(12)
  const now = currentMonth()
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Histórico de Pagamentos</h2>
            <p className="text-sm text-slate-500">{restaurant?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-4 gap-3">
            {months.map(month => {
              const rec = (contract?.paymentHistory || []).find(r => r.month === month)
              const isFuture = month > now
              const isPaid = rec?.paid
              return (
                <button
                  key={month}
                  disabled={isFuture}
                  onClick={() => onToggle(restaurant.slug, month, !isPaid)}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    isFuture
                      ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                      : isPaid
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : 'bg-red-50 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-700">{formatMonthLabel(month)}</p>
                  <p className="text-lg mt-0.5">{isFuture ? '·' : isPaid ? '✅' : '❌'}</p>
                  {rec?.paidAt && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(rec.paidAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {!isFuture && !rec?.paidAt && isPaid === false && (
                    <p className="text-[10px] text-slate-400 mt-1">não pago</p>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">Clique em um mês para alternar pago/não pago</p>
        </div>
      </div>
    </div>
  )
}

function EditContractModal({ restaurant, form, onChange, onSave, onClose, saving, error }) {
  const isIndefinite = !form.contractEnd
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Contrato</h2>
            <p className="text-sm text-slate-500">{restaurant?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Financeiro */}
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Financeiro</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Valor mensal (R$)</span>
              <input
                type="number" min="0" step="0.01"
                value={form.contractValue || ''}
                onChange={e => onChange('contractValue', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Dia do pagamento</span>
              <input
                type="number" min="1" max="28"
                value={form.paymentDay || ''}
                onChange={e => onChange('paymentDay', parseInt(e.target.value) || 5)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Status</span>
              <select
                value={form.status || 'active'}
                onChange={e => onChange('status', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
          </div>

          {/* Contrato */}
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Período do contrato</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Início</span>
              <input
                type="date"
                value={form.contractStart || ''}
                onChange={e => onChange('contractStart', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Fim</span>
              <input
                type="date"
                value={form.contractEnd || ''}
                disabled={isIndefinite}
                onChange={e => onChange('contractEnd', e.target.value || null)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIndefinite}
                  onChange={e => onChange('contractEnd', e.target.checked ? null : new Date().toISOString().slice(0, 10))}
                  className="rounded"
                />
                <span className="text-xs text-slate-500">Indeterminado</span>
              </label>
            </label>
          </div>

          {/* Domínio */}
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Domínio</p>
          <label className="block">
            <span className="text-sm text-slate-600 mb-1 block">Domínio</span>
            <input
              type="text" placeholder="exemplo.com.br"
              value={form.domain || ''}
              onChange={e => onChange('domain', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Data de renovação</span>
              <input
                type="date"
                value={form.domainRenewal || ''}
                onChange={e => onChange('domainRenewal', e.target.value || null)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600 mb-1 block">Custo anual (R$)</span>
              <input
                type="number" min="0" step="0.01"
                value={form.domainCost || ''}
                onChange={e => onChange('domainCost', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
          </div>

          {/* Notas */}
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Notas</p>
          <textarea
            rows={3}
            placeholder="Observações, detalhes do plano, etc."
            value={form.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GestaoClientesPage() {
  const [restaurants, setRestaurants] = useState([])
  const [contracts, setContracts]     = useState({})
  const [loading, setLoading]         = useState(true)
  const [historySlug, setHistorySlug] = useState(null)
  const [editSlug, setEditSlug]       = useState(null)
  const [editForm, setEditForm]       = useState({})
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [restSnap, contractSnap] = await Promise.all([
        getDocs(collection(db, 'restaurants')),
        getDocs(collection(db, 'contracts')),
      ])
      const rests = restSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const cmap = {}
      contractSnap.docs.forEach(d => { cmap[d.id] = { id: d.id, ...d.data() } })
      setRestaurants(rests)
      setContracts(cmap)
    } catch (err) {
      console.error('Erro ao carregar gestão:', err)
    }
    setLoading(false)
  }

  function openEditModal(slug) {
    const existing = contracts[slug]
    setEditForm(existing ? { ...existing } : { ...DEFAULT_CONTRACT, slug })
    setEditSlug(slug)
    setSaveError('')
  }

  async function handleSaveContract(slug) {
    setSaving(true)
    setSaveError('')
    try {
      const data = { ...editForm, slug, updatedAt: new Date().toISOString() }
      await setDoc(doc(db, 'contracts', slug), data)
      setContracts(prev => ({ ...prev, [slug]: data }))
      setEditSlug(null)
    } catch (err) {
      setSaveError('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  async function handleMarkPaid(slug, month, paid) {
    const contract = contracts[slug]
    if (!contract) return
    const history = [...(contract.paymentHistory || [])]
    const idx = history.findIndex(r => r.month === month)
    const record = {
      month,
      paid,
      paidAt: paid ? new Date().toISOString() : null,
      amount: contract.contractValue || 0,
    }
    if (idx >= 0) history[idx] = record
    else history.push(record)
    history.sort((a, b) => a.month.localeCompare(b.month))
    const updated = { ...contract, paymentHistory: history, updatedAt: new Date().toISOString() }
    await setDoc(doc(db, 'contracts', slug), updated)
    setContracts(prev => ({ ...prev, [slug]: updated }))
  }

  // ── KPIs ──
  const activeList = restaurants.filter(r => contracts[r.slug]?.status === 'active')
  const mrr = activeList.reduce((sum, r) => sum + (contracts[r.slug]?.contractValue || 0), 0)
  const avgTicket = activeList.length ? mrr / activeList.length : 0
  const pendingCount = restaurants.filter(r => {
    const ps = paymentStatus(contracts[r.slug])
    return ps === 'overdue' || ps === 'due-soon'
  }).length
  const domainsDueSoon = restaurants.filter(r => {
    const days = daysUntilDomainRenewal(contracts[r.slug])
    return days !== null && days <= 30
  }).length

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestão de Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contratos, pagamentos e domínios</p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm px-4 py-2 rounded-xl transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="MRR" value={brl.format(mrr)} sub="receita mensal recorrente" color="green" />
        <KpiCard label="Ticket médio" value={brl.format(avgTicket)} sub="por cliente ativo" color="blue" />
        <KpiCard label="Clientes ativos" value={activeList.length} sub={`de ${restaurants.length} total`} color="slate" />
        <KpiCard
          label="Pgtos pendentes"
          value={pendingCount}
          sub={pendingCount > 0 ? 'requer atenção' : 'tudo em dia'}
          color={pendingCount > 0 ? 'yellow' : 'slate'}
        />
        <KpiCard
          label="Domínios expirando"
          value={domainsDueSoon}
          sub="em 30 dias"
          color={domainsDueSoon > 0 ? 'orange' : 'slate'}
        />
      </div>

      {/* Sparkline */}
      <div className="mb-6">
        <SparklineBar contracts={contracts} restaurants={restaurants} />
      </div>

      {/* Client table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Clientes</h2>
          <span className="text-xs text-slate-400">{restaurants.length} cadastrados</span>
        </div>

        {restaurants.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Nenhum cliente cadastrado</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {restaurants.map(r => {
              const c = contracts[r.slug]
              const hasContract = !!c
              const ps = paymentStatus(c)
              const isCurrentPaid = thisMonthRecord(c)?.paid

              return (
                <div key={r.slug} className={`px-6 py-4 flex flex-wrap lg:flex-nowrap items-center gap-4 hover:bg-slate-50 transition ${
                  ps === 'overdue' ? 'border-l-4 border-red-400' :
                  ps === 'due-soon' ? 'border-l-4 border-yellow-400' : ''
                }`}>
                  {/* Nome + status */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{r.name}</span>
                      {hasContract && <StatusBadge status={c.status} />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{r.slug}</p>
                    {c?.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]" title={c.notes}>
                        📝 {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Valor */}
                  <div className="w-24 text-right">
                    {hasContract ? (
                      <span className="text-sm font-bold text-slate-700">{brl.format(c.contractValue)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                    <p className="text-[10px] text-slate-400">mensal</p>
                  </div>

                  {/* Pagamento */}
                  <div className="w-32 text-center">
                    {hasContract ? (
                      <>
                        <PaymentBadge contract={c} />
                        <p className="text-[10px] text-slate-400 mt-1">dia {c.paymentDay}</p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>

                  {/* Domínio */}
                  <div className="w-40">
                    {hasContract && c.domain ? (
                      <>
                        <p className="text-xs text-slate-700 font-medium truncate">{c.domain}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <DomainBadge contract={c} />
                          {c.domainRenewal && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(c.domainRenewal).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>

                  {/* Contrato */}
                  <div className="w-28 text-center">
                    {hasContract ? (
                      <>
                        <ContractDuration contract={c} />
                        {c.contractStart && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            desde {new Date(c.contractStart).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                    {/* Marcar como pago */}
                    {hasContract && !isCurrentPaid && (
                      <button
                        onClick={() => handleMarkPaid(r.slug, currentMonth(), true)}
                        title="Marcar como pago este mês"
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg transition font-medium"
                      >
                        ✓ Pago
                      </button>
                    )}

                    {/* Histórico */}
                    {hasContract && (
                      <button
                        onClick={() => setHistorySlug(r.slug)}
                        title="Histórico de pagamentos"
                        className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg transition"
                      >
                        📋 Histórico
                      </button>
                    )}

                    {/* Editar / Configurar */}
                    <button
                      onClick={() => openEditModal(r.slug)}
                      title={hasContract ? 'Editar contrato' : 'Configurar contrato'}
                      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg transition font-medium"
                    >
                      {hasContract ? '✏️ Editar' : '⚙️ Configurar'}
                    </button>

                    {/* WhatsApp */}
                    {hasContract && (
                      <a
                        href={whatsappLink('', r.name, c.contractValue, c.paymentDay)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar lembrete por WhatsApp"
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg transition"
                      >
                        💬
                      </a>
                    )}

                    {/* Link painel do cliente */}
                    <a
                      href={`/restaurante/${r.slug}/${r.type === 'garagem' ? 'veiculos' : r.type === 'roupas' ? 'roupas' : r.type === 'outros' ? 'info' : 'cardapio'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir painel do cliente"
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg transition"
                    >
                      🔗
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment History Modal */}
      {historySlug && (
        <PaymentHistoryModal
          restaurant={restaurants.find(r => r.slug === historySlug)}
          contract={contracts[historySlug]}
          onToggle={handleMarkPaid}
          onClose={() => setHistorySlug(null)}
        />
      )}

      {/* Edit Contract Modal */}
      {editSlug && (
        <EditContractModal
          restaurant={restaurants.find(r => r.slug === editSlug)}
          form={editForm}
          onChange={(field, val) => setEditForm(prev => ({ ...prev, [field]: val }))}
          onSave={() => handleSaveContract(editSlug)}
          onClose={() => setEditSlug(null)}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getCampaignByTsCode } from '@/app/actions/getCampaign'
import { getTemplatesForCampaign, getAllTemplates, mergeSubTemplatesIntoClauses, type TemplateEntry } from '@/lib/terms-templates'

interface PrizeTier { tier: string; description: string; qty: number; unitValue: number }

interface GapFollowUp {
  key: string
  question: string
  placeholder?: string
  multiline?: boolean
  showWhen: number
}

interface Gap {
  key: string
  question: string
  options?: string[]
  optionLabels?: string[]
  placeholder?: string
  multiline?: boolean
  multiple?: boolean
  followUp?: GapFollowUp
}

interface Clause {
  slug: string
  label: string
  text: string
  gaps?: Gap[]
}

type QuestionGap = Gap | GapFollowUp

interface Question {
  gap: QuestionGap
  isFollowUp: boolean
  parentGap?: Gap
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })
}

function formatDateLong(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRegion(regions: string[]) {
  const AU = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']
  if (regions?.includes('national_au')) return 'throughout Australia'
  const states = (regions || []).filter((r: string) => AU.includes(r))
  return states.length ? `in ${states.join(', ')}` : 'in selected regions'
}

function calcDrawDate(promoEnd: string) {
  if (!promoEnd) return 'TBC'
  const d = new Date(promoEnd)
  let added = 0
  while (added < 5) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function calcUnclaimed(promoEnd: string) {
  if (!promoEnd) return { deadline: 'TBC', redraw: 'TBC' }
  const d = new Date(promoEnd)
  const dl = new Date(d)
  dl.setDate(dl.getDate() + 60)
  const rd = new Date(dl)
  rd.setDate(rd.getDate() + 1)
  return {
    deadline: dl.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    redraw: rd.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function normaliseCampaign(raw: any) {
  const prizes: PrizeTier[] = Array.isArray(raw.prizes) ? raw.prizes : []
  const prizePool = prizes.reduce((s: number, p: PrizeTier) => s + p.qty * p.unitValue, 0)
  const totalWinners = prizes.reduce((s: number, p: PrizeTier) => s + p.qty, 0)
  return {
    id: raw.id,
    tsCode: raw.tsCode ?? '',
    name: raw.name ?? '',
    promoter: raw.promoter ?? null,
    promoStart: raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd: raw.promoEnd ? new Date(raw.promoEnd).toISOString().split('T')[0] : '',
    drawMechanic: raw.mechanicType === 'SWEEPSTAKES' ? 'Trade Lottery' : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer' : 'Prize Draw',
    entryMechanic: raw.entryMechanic ?? '',
    regions: raw.regions ?? [],
    prizes,
    prizePool,
    totalWinners,
    prizeList: prizes.map((p: PrizeTier) => `${p.qty} x ${p.description} valued at ${formatMoney(p.unitValue)} (incl. GST)`).join('\n'),
  }
}

function isFullGap(gap: QuestionGap): gap is Gap {
  return 'options' in gap || 'optionLabels' in gap || 'followUp' in gap
}

function formatAddress(address: any): string {
  if (!address) return '[Address]'
  if (typeof address === 'string') return address
  if (typeof address === 'object') {
    const parts = [address.street, address.suburb, address.state, address.postcode].filter(Boolean)
    return parts.join(', ') || '[Address]'
  }
  return '[Address]'
}

export default function TermsTestPage() {
  const [campaignCode, setCampaignCode] = useState('')
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<TemplateEntry[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('repco-trade')
  const [answers, setAnswers] = useState<Record<string, string | number>>({})

  function answer(key: string, value: string | number) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleMultiAnswer(key: string, value: string) {
    setAnswers(prev => {
      const current = prev[key]
      const arr = Array.isArray(current) ? [...current] : []
      const i = arr.indexOf(value)
      if (i >= 0) arr.splice(i, 1)
      else arr.push(value)
      return { ...prev, [key]: arr }
    })
  }

  async function loadCampaign() {
    const code = campaignCode.trim().toUpperCase()
    if (!code) {
      setError('Enter a campaign code (e.g. R98V8)')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const raw = await getCampaignByTsCode(code)
      if (!raw) {
        setCampaign(null)
        setError(`No campaign found for code "${code}"`)
        return
      }
      const c = normaliseCampaign(raw)
      setCampaign(c)
      const { deadline, redraw } = calcUnclaimed(c.promoEnd)
      setAnswers({
        UNCLAIMED_DEADLINE: deadline,
        UNCLAIMED_REDRAW: redraw,
      })
      const templates = getTemplatesForCampaign(
        c.promoter?.name ?? '',
        c.drawMechanic
      )
      setAvailableTemplates(templates)
      if (templates.length > 0 && !templates.find(t => t.meta.id === selectedTemplate)) {
        setSelectedTemplate(templates[0].meta.id)
      }
    } finally {
      setLoading(false)
    }
  }

  const currentTemplate =
    availableTemplates.find(t => t.meta.id === selectedTemplate) ??
    availableTemplates[0] ??
    getAllTemplates()[0]
  const templateMeta = currentTemplate?.meta
  const baseClauses = currentTemplate?.clauses ?? []
  const selectedSubTemplateIds = useMemo(() => {
    const v = answers.PRIZE_TYPES
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  }, [answers])
  const currentClauses = mergeSubTemplatesIntoClauses(baseClauses, selectedSubTemplateIds, { insertAfterSlug: 'prizes' })
  const clausesForDocument = useMemo(() => currentClauses.filter((c: Clause) => c.slug !== 'sub_template_choice'), [currentClauses])

  const allQuestions: Question[] = useMemo(() => {
    const questions: Question[] = []
    currentClauses.forEach((clause: Clause) => {
      if (!clause.gaps) return
      clause.gaps.forEach((gap: Gap) => {
        questions.push({ gap, isFollowUp: false })
        if (gap.followUp) {
          const parentAnswer = answers[gap.key]
          if (parentAnswer !== undefined && Number(parentAnswer) === gap.followUp.showWhen) {
            questions.push({ gap: gap.followUp, isFollowUp: true, parentGap: gap })
          }
        }
      })
    })
    return questions
  }, [answers, currentClauses])

  const AUTO_VARS: Record<string, string> = useMemo(() => {
    if (!campaign) {
      return {
        PROMOTER_NAME: '[Promoter name]', PROMOTER_ABN: '[ABN]', PROMOTER_ADDRESS: '[Address]',
        PROMO_START: '[Start date]', PROMO_END: '[End date]', DRAW_MECHANIC: '[Draw mechanic]',
        CAMPAIGN_URL: '[Campaign URL]', REGION: '[Region]', ENTRY_MECHANIC: '[entry mechanic]',
        TOTAL_WINNERS: '0', DRAW_DATE: '[Draw date]', PRIZE_LIST: '[Prize list]', PRIZE_POOL: '$0.00',
        UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
        UNCLAIMED_REDRAW: String(answers.UNCLAIMED_REDRAW ?? '[redraw date]'),
      }
    }
    return {
      PROMOTER_NAME: campaign.promoter?.name ?? '[Promoter name]',
      PROMOTER_ABN: campaign.promoter?.abn ?? '[ABN]',
      PROMOTER_ADDRESS: formatAddress(campaign.promoter?.address),
      PROMO_START: formatDateLong(campaign.promoStart),
      PROMO_END: formatDateLong(campaign.promoEnd),
      DRAW_MECHANIC: campaign.drawMechanic,
      CAMPAIGN_URL: `https://turnstylehost.com/campaign/${campaign.tsCode.toLowerCase()}/`,
      REGION: formatRegion(campaign.regions),
      ENTRY_MECHANIC: campaign.entryMechanic || '[entry mechanic]',
      TOTAL_WINNERS: String(campaign.totalWinners),
      DRAW_DATE: calcDrawDate(campaign.promoEnd),
      PRIZE_LIST: campaign.prizeList,
      PRIZE_POOL: formatMoney(campaign.prizePool),
      UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
      UNCLAIMED_REDRAW: String(answers.UNCLAIMED_REDRAW ?? '[redraw date]'),
    }
  }, [campaign, answers])

  const resolveText = useMemo(() => {
    return (text: string): { resolved: string; hasUnfilledGaps: boolean } => {
      if (!text) return { resolved: '', hasUnfilledGaps: false }
      let out = String(text)
      let hasUnfilledGaps = false
      out = out.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        const value = AUTO_VARS[key]
        if (value !== undefined && value !== null) return String(value)
        return `[${key}]`
      })
      out = out.replace(/\[\[(\w+)\]\]/g, (_match, key) => {
        const answerVal = answers[key]
        if (answerVal !== undefined && answerVal !== null && String(answerVal).trim() !== '') return String(answerVal)
        hasUnfilledGaps = true
        return `▓▓▓`
      })
      return { resolved: out, hasUnfilledGaps }
    }
  }, [AUTO_VARS, answers])

  // No campaign: show code entry
  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
          style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
        <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm transition-colors">Dashboard</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Terms Test</span>
          </div>
        </nav>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full">
            <h1 className="text-white font-black text-2xl mb-2">Terms Test</h1>
            <p className="text-white/50 text-sm mb-6">Enter a campaign code to open the terms wizard with a live preview.</p>
            <div className="space-y-4">
              <label className="block text-white/70 text-sm font-medium">Campaign code</label>
              <input
                type="text"
                value={campaignCode}
                onChange={e => { setCampaignCode(e.target.value); setError(null) }}
                onKeyDown={e => e.key === 'Enter' && loadCampaign()}
                placeholder="e.g. R98V8"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono uppercase"
              />
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button
                onClick={loadCampaign}
                disabled={loading}
                className="w-full bg-white text-[#0a0a0f] font-bold py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Open wizard'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Split screen: wizard left, live terms right
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10 shrink-0">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/tstyle.png" alt="Turnstyle" className="h-6 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm">Dashboard</Link>
            <span className="text-white/20">/</span>
            <Link href="/dashboard/terms-test" className="text-white/60 text-sm">Terms Test</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">{campaign.name} ({campaign.tsCode})</span>
          </div>
          <button
            onClick={() => { setCampaign(null); setCampaignCode(''); setError(null) }}
            className="text-white/50 hover:text-white text-sm"
          >
            Change campaign
          </button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        {/* Left: Wizard */}
        <div className="border-r border-white/10 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-white/10 shrink-0">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Template</label>
            <select
              value={selectedTemplate}
              onChange={e => {
                setSelectedTemplate(e.target.value)
                setAnswers(prev => {
                  const { UNCLAIMED_DEADLINE, UNCLAIMED_REDRAW } = prev
                  return { UNCLAIMED_DEADLINE: UNCLAIMED_DEADLINE ?? '', UNCLAIMED_REDRAW: UNCLAIMED_REDRAW ?? '' }
                })
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            >
              {availableTemplates.map(t => (
                <option key={t.meta.id} value={t.meta.id}>
                  {t.meta.name}{t.meta.description ? ` — ${t.meta.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-white font-bold text-sm">Gap answers (updates preview live)</h3>
            {allQuestions.length === 0 ? (
              <p className="text-white/40 text-sm">No questions for this template.</p>
            ) : (
              allQuestions.map((q, i) => (
                <div key={`question-${i}`} className="space-y-1">
                  <label className="block text-white/70 text-xs font-medium">
                    {i + 1}. {q.gap.question}
                  </label>
                  {(q.gap as Gap).multiple && q.gap.options && q.gap.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {q.gap.options.map((opt: string, j: number) => {
                        const label = (q.gap as Gap).optionLabels?.[j] ?? opt
                        const selected = Array.isArray(answers[q.gap.key]) ? answers[q.gap.key] : []
                        const isSelected = selected.includes(opt)
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => toggleMultiAnswer(q.gap.key, opt)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-2 ${
                              isSelected ? 'bg-white text-[#0a0a0f] border-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#0a0a0f] border-[#0a0a0f]' : 'border-white/40'}`}>
                              {isSelected && <span className="text-white text-[10px]">✓</span>}
                            </span>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : isFullGap(q.gap) && q.gap.options && q.gap.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {q.gap.options.map((opt: string, j: number) => {
                        const label = (q.gap as Gap).optionLabels?.[j] ?? opt
                        const isSelected = String(answers[q.gap.key]) === String(j)
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => answer(q.gap.key, j)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                              isSelected ? 'bg-white text-[#0a0a0f] border-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    q.gap.multiline ? (
                      <textarea
                        value={String(answers[q.gap.key] ?? '')}
                        onChange={e => answer(q.gap.key, e.target.value)}
                        placeholder={q.gap.placeholder ?? 'Type your answer...'}
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(answers[q.gap.key] ?? '')}
                        onChange={e => answer(q.gap.key, e.target.value)}
                        placeholder={q.gap.placeholder ?? 'Type your answer...'}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                      />
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Live terms preview */}
        <div className="flex flex-col min-h-0 overflow-hidden bg-[#0a0a0f]">
          <div className="px-4 py-2 border-b border-white/10 shrink-0">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Live terms (built from wizard)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-1">{templateMeta?.name}</p>
                <h1 className="text-white font-black text-2xl mb-1">{campaign.name}</h1>
              </div>
              <div className="bg-white rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-gray-900 font-black text-lg">{campaign.name}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">Terms & Conditions · {templateMeta?.name}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {clausesForDocument.length > 0 ? (
                    clausesForDocument.map((clause, ci) => {
                      const { resolved, hasUnfilledGaps } = resolveText(clause.text)
                      const textToShow = resolved?.trim() ? resolved : clause.text || 'No content'
                      return (
                        <div key={clause.slug} className={`px-6 py-4 ${ci % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{clause.label}</div>
                          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                            {hasUnfilledGaps && clause.gaps ? (
                              <span className="text-amber-600 italic">Answer in wizard to generate this clause</span>
                            ) : (
                              textToShow
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">No clauses in template.</div>
                  )}
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-gray-300 text-xs">Turnstyle · {campaign.tsCode}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

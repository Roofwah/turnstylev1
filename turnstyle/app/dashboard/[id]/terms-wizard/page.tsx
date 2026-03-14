'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getCampaign } from '@/app/actions/getCampaign'
import Link from 'next/link'
import { getTemplatesForCampaign, getAllTemplates, mergeSubTemplatesIntoClauses, type TemplateEntry } from '@/lib/terms-templates'
import { useNotify } from '@/components/useNotify'

// Template registry
type TemplateData = {
  clauses: Clause[]
  meta: { id: string; name: string; promoterKeyword?: string; audience?: string }
}



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
  const AU = ['NSW','VIC','QLD','SA','WA','ACT','TAS','NT']
  if (regions.includes('national_au')) return 'throughout Australia'
  const states = regions.filter(r => AU.includes(r))
  return states.length ? `in ${states.join(', ')}` : 'in selected regions'
}

function calcDrawDate(promoEnd: string) {
  if (!promoEnd) return 'TBC'
  const d = new Date(promoEnd)
  let added = 0
  while (added < 5) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++ }
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function calcUnclaimed(promoEnd: string) {
  if (!promoEnd) return { deadline: 'TBC', redraw: 'TBC' }
  const d = new Date(promoEnd)
  const dl = new Date(d); dl.setDate(dl.getDate() + 60)
  const rd = new Date(dl); rd.setDate(rd.getDate() + 1)
  return {
    deadline: dl.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    redraw:   rd.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function normaliseCampaign(raw: any) {
  const prizes: PrizeTier[] = Array.isArray(raw.prizes) ? raw.prizes : []
  const prizePool = prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const totalWinners = prizes.reduce((s, p) => s + p.qty, 0)
  return {
    id:            raw.id,
    tsCode:        raw.tsCode ?? '',
    name:          raw.name ?? '',
    promoter:      raw.promoter ?? null,
    promoStart:    raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd:      raw.promoEnd   ? new Date(raw.promoEnd).toISOString().split('T')[0]   : '',
    drawMechanic:  raw.mechanicType === 'SWEEPSTAKES' ? 'Trade Lottery' : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer' : 'Prize Draw',
    entryMechanic: raw.entryMechanic ?? '',
    regions:       raw.regions ?? [],
    prizes,
    prizePool,
    totalWinners,
    prizeList:     prizes.map(p => `${p.qty} x ${p.description} valued at ${formatMoney(p.unitValue)} (incl. GST)`).join('\n'),
  }
}

function AnimatedText({ text }: { text: string }) {
  const [shown, setShown] = useState('')
  const [done, setDone]   = useState(false)
  const prev = useRef('')

  useEffect(() => {
    if (text === prev.current) return
    prev.current = text
    setDone(false)
    if (!text) { setShown(''); return }
    setShown(text)
    setDone(true)
  }, [text])

  if (!text) return <span className="text-gray-300 italic">Waiting for answer...</span>
  const displayText = shown || text
  return (
    <span>
      {displayText}
      {!done && displayText && <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse align-middle" />}
    </span>
  )
}

export default function TermsWizardPage() {
  const params = useParams()
  const id = params.id as string
  const { toast, modal } = useNotify()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [availableTemplates, setAvailableTemplates] = useState<TemplateEntry[]>([])
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({})
  const [sharing, setSharing]     = useState(false)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isReadonly = searchParams?.get('readonly') === 'true'
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied]       = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showDocument, setShowDocument] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('repco-trade')
  const [draftVersion, setDraftVersion] = useState<number | null>(null)

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

  useEffect(() => {
    getCampaign(id).then(async raw => {
      if (raw) {
        const c = normaliseCampaign(raw)
        setCampaign(c)
        const uc = calcUnclaimed(c.promoEnd)
        setAnswers({
          UNCLAIMED_DEADLINE: uc.deadline,
          UNCLAIMED_REDRAW:   uc.redraw,
        })
        try {
          const res = await fetch(`/api/terms?campaignId=${id}`)
          const drafts = await res.json()
          if (Array.isArray(drafts) && drafts.length > 0) {
            const latest = drafts[0]
            const savedAnswers = latest.gapAnswers as Record<string, string | number | string[]>
            setAnswers(prev => ({ ...prev, ...savedAnswers }))
            setShareLink(`${window.location.origin}/review/${latest.shareToken}`)
            setDraftVersion(latest.version)
            setShowDocument(true)
            setShowModal(false)
          }
        } catch (error) {
          console.error('Failed to fetch terms drafts:', error)
        }
      }
      setLoading(false)
    })
  }, [id])

  function isFullGap(gap: QuestionGap): gap is Gap {
    return 'options' in gap || 'optionLabels' in gap || 'followUp' in gap
  }

  const currentTemplate = (
    availableTemplates.find(t => t.meta.id === selectedTemplate)
    ?? availableTemplates[0]
    ?? getAllTemplates()[0]
  )
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

  const totalQuestions = allQuestions.length

  function formatAddress(address: any): string {
    if (!address) return '[Address]'
    if (typeof address === 'string') return address
    if (typeof address === 'object') {
      const parts = [address.street, address.suburb, address.state, address.postcode].filter(Boolean)
      return parts.join(', ') || '[Address]'
    }
    return '[Address]'
  }

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
      PROMOTER_NAME:    campaign.promoter?.name    ?? '[Promoter name]',
      PROMOTER_ABN:     campaign.promoter?.abn     ?? '[ABN]',
      PROMOTER_ADDRESS: formatAddress(campaign.promoter?.address),
      PROMO_START:      formatDateLong(campaign.promoStart),
      PROMO_END:        formatDateLong(campaign.promoEnd),
      DRAW_MECHANIC:    campaign.drawMechanic,
      CAMPAIGN_URL:     `https://turnstylehost.com/campaign/${campaign.tsCode.toLowerCase()}/`,
      REGION:           formatRegion(campaign.regions),
      ENTRY_MECHANIC:   campaign.entryMechanic || '[entry mechanic]',
      TOTAL_WINNERS:    String(campaign.totalWinners),
      DRAW_DATE:        calcDrawDate(campaign.promoEnd),
      PRIZE_LIST:       campaign.prizeList,
      PRIZE_POOL:       formatMoney(campaign.prizePool),
      UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
      UNCLAIMED_REDRAW:   String(answers.UNCLAIMED_REDRAW   ?? '[redraw date]'),
    }
  }, [campaign, answers])
  useEffect(() => {
    if (campaign) {
      const templates = getTemplatesForCampaign(
        campaign.promoter?.name ?? '',
        campaign.drawMechanic
      )
      setAvailableTemplates(templates)
      // Auto-select first matching template if current selection not in list
      if (templates.length > 0 && !templates.find(t => t.meta.id === selectedTemplate)) {
        setSelectedTemplate(templates[0].meta.id)
      }
    }
  }, [campaign])

  const resolveText = useMemo(() => {
    return (text: string): { resolved: string; hasUnfilledGaps: boolean } => {
      if (!text) return { resolved: '', hasUnfilledGaps: false }
      let out = String(text)
      let hasUnfilledGaps = false
      out = out.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = AUTO_VARS[key]
        if (value !== undefined && value !== null) return String(value)
        return `[${key}]`
      })
      out = out.replace(/\[\[(\w+)\]\]/g, (match, key) => {
        const answer = answers[key]
        if (answer !== undefined && answer !== null && String(answer).trim() !== '') return String(answer)
        hasUnfilledGaps = true
        return `▓▓▓`
      })
      return { resolved: out, hasUnfilledGaps }
    }
  }, [AUTO_VARS, answers])

  useEffect(() => {
    if (!loading && campaign && !draftVersion) {
      if (totalQuestions > 0) setShowModal(true)
      else setShowDocument(true)
    }
  }, [loading, campaign, totalQuestions, draftVersion])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-white/30 text-sm">Loading...</div>
    </div>
  )
  if (!campaign) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-white/30 text-sm">Campaign not found</div>
    </div>
  )

  const currentQuestion = allQuestions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1
  const currentAnswer = currentQuestion ? answers[currentQuestion.gap.key] : undefined
  const canProceed = currentQuestion
    ? (currentQuestion.gap as Gap).multiple
        ? true
        : (isFullGap(currentQuestion.gap) && currentQuestion.gap.options
            ? currentAnswer !== undefined
            : currentAnswer !== undefined && String(currentAnswer).trim() !== '')
    : false

  function handleNext() {
    if (isLastQuestion) {
      setShowModal(false)
      setShowDocument(true)
    } else {
      const nextIndex = currentQuestionIndex + 1
      if (nextIndex >= allQuestions.length) {
        setShowModal(false)
        setShowDocument(true)
      } else {
        setCurrentQuestionIndex(nextIndex)
      }
    }
  }

  function handleBack() {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1)
  }

  async function saveAndShare() {
    if (!campaign) return
    setSharing(true)
    const content = clausesForDocument.map((clause: Clause) => {
      const { resolved } = resolveText(clause.text)
      return `${clause.label}\n\n${resolved}`
    }).join('\n\n---\n\n')

    try {
      const res = await fetch('/api/terms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          content,
          gapAnswers: answers,
          templateId: templateMeta.id,
        }),
      })

      setSharing(false)

      if (!res.ok) {
        const errorText = await res.text()
        console.error('Save error:', errorText)
        toast(`Failed to save: ${res.status} ${res.statusText}`, 'error')
        return
      }

      const draft = await res.json()
      const link = `${window.location.origin}/review/${draft.shareToken}`
      setShareLink(link)
      setDraftVersion(draft.version)

      if (campaign.id) {
        const campaignRes = await fetch(`/api/campaigns/${campaign.id}`)
        if (campaignRes.ok) {
          const updatedCampaign = await campaignRes.json()
          setCampaign(updatedCampaign)
        }
      }

      toast(`Draft v${draft.version} saved successfully`)

    } catch (error: any) {
      setSharing(false)
      console.error('Save error:', error)
      toast(`Failed to save: ${error.message}`, 'error')
    }
  }

  function handleEditAnswers() {
    setShowModal(true)
    setCurrentQuestionIndex(0)
  }

  const userName = 'Admin User'

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />

      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href={`/dashboard/${id}`} className="text-white/40 hover:text-white text-sm transition-colors">{campaign.name}</Link>
            {draftVersion && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-white/60 text-sm">Draft v{draftVersion}</span>
              </>
            )}
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Terms Wizard</span>
          </div>

          <div className="flex items-center gap-2">
            {showDocument && !isReadonly && (
              <button
                className="flex items-center justify-center bg-amber-500/20 border border-amber-500/40 text-amber-400 p-2 rounded-lg hover:bg-amber-500/30 transition-all"
                title="AI Assistant"
              >
                <img src="/ai.svg" alt="AI" className="w-4 h-4" />
              </button>
            )}
            {showDocument && shareLink && !isReadonly && (
              <button
                onClick={() => {
                  modal({
                    title: 'Share Review Link',
                    message: 'Copy this link and send it to the promoter for review.',
                    copyText: shareLink,
                  })
                }}
                className="flex items-center justify-center bg-white/10 border border-white/20 text-white p-2 rounded-lg hover:bg-white/20 transition-all"
                title="Share link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
            {!isReadonly && (
            <button
              disabled={sharing}
              onClick={saveAndShare}
              className="bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-50">
              {sharing ? 'Saving...' : 'Save'}
            </button>
            )}
            {isReadonly && (
              <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">FINAL</span>
            )}
            <button
              onClick={() => window.print()}
              className="bg-white text-[#0a0a0f] font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-white/90 transition-all">
              PDF
            </button>
          </div>
        </div>
      </nav>

      {/* Modal Wizard */}
      {showModal && totalQuestions > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setShowModal(false)
                if (totalQuestions > 0 && Object.keys(answers).length > 0) setShowDocument(true)
              }}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="px-8 py-6 border-b border-white/10">
              <h2 className="text-white font-black text-2xl mb-1">Let's build your terms, {userName}.</h2>
              <div className="flex items-center gap-3 mt-3">
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    setSelectedTemplate(e.target.value)
                    setCurrentQuestionIndex(0)
                    setAnswers({})
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm hover:bg-white/10 focus:outline-none focus:border-white/30 transition-colors"
                >
                  {availableTemplates.map(t => (
                    <option key={t.meta.id} value={t.meta.id}>
                      {t.meta.name}{t.meta.description ? ` — ${t.meta.description}` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-white/30 text-xs">
                  ({availableTemplates.length} template{availableTemplates.length !== 1 ? 's' : ''} available)
                </span>
              </div>
            </div>

            {currentQuestion && (
              <div className="px-8 py-8">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">
                      Question {currentQuestionIndex + 1} of {totalQuestions}
                    </span>
                    <div className="flex-1 mx-4 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <h3 className="text-white font-bold text-lg mb-6">{currentQuestion.gap.question}</h3>

                <div className="space-y-4">
                  {isFullGap(currentQuestion.gap) && currentQuestion.gap.options && currentQuestion.gap.options.length > 0 && (currentQuestion.gap as Gap).multiple ? (
                    <div className="flex flex-col gap-3">
                      {(() => {
                        const gap = currentQuestion.gap as Gap
                        const selected = Array.isArray(currentAnswer) ? currentAnswer : []
                        return gap.options!.map((opt: string, i: number) => {
                          const label = (gap.optionLabels?.[i] ?? opt) || String(i)
                          const isSelected = selected.includes(opt)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleMultiAnswer(gap.key, opt)}
                              className={`px-6 py-4 rounded-xl text-left border-2 transition-all flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-white text-[#0a0a0f] border-white font-bold'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                              }`}>
                              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#0a0a0f] border-[#0a0a0f]' : 'border-white/40'}`}>
                                {isSelected && <span className="text-white text-xs">✓</span>}
                              </span>
                              {label}
                            </button>
                          )
                        })
                      })()}
                    </div>
                  ) : isFullGap(currentQuestion.gap) && currentQuestion.gap.options && currentQuestion.gap.options.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {(() => {
                        const gap = currentQuestion.gap as Gap
                        return gap.options!.map((opt: string, i: number) => {
                          const label = (gap.optionLabels?.[i] ?? opt) || String(i)
                          const isSelected = String(currentAnswer) === String(i)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => answer(gap.key, i)}
                              className={`px-6 py-4 rounded-xl text-left border-2 transition-all ${
                                isSelected
                                  ? 'bg-white text-[#0a0a0f] border-white font-bold'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                              }`}>
                              {label}
                            </button>
                          )
                        })
                      })()}
                    </div>
                  ) : (
                    <div>
                      {currentQuestion.gap.multiline ? (
                        <textarea
                          value={String(currentAnswer ?? '')}
                          onChange={e => answer(currentQuestion.gap.key, e.target.value)}
                          placeholder={currentQuestion.gap.placeholder ?? 'Type your answer...'}
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(currentAnswer ?? '')}
                          onChange={e => answer(currentQuestion.gap.key, e.target.value)}
                          placeholder={currentQuestion.gap.placeholder ?? 'Type your answer...'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                  <button
                    onClick={handleBack}
                    disabled={currentQuestionIndex === 0}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      currentQuestionIndex === 0
                        ? 'bg-white/5 text-white/20 cursor-not-allowed'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}>
                    ← Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className={`px-6 py-3 rounded-xl font-black transition-all ${
                      canProceed
                        ? 'bg-white text-[#0a0a0f] hover:bg-white/90'
                        : 'bg-white/10 text-white/20 cursor-not-allowed'
                    }`}>
                    {isLastQuestion ? 'Generate Terms →' : 'Next →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document */}
      {showDocument && campaign && (
        <main className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-6">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-1">{templateMeta.name}</p>
            <h1 className="text-white font-black text-3xl mb-1">{campaign.name}</h1>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-8 py-6 border-b border-gray-100">
              <h2 className="text-gray-900 font-black text-xl">{campaign.name}</h2>
              <p className="text-gray-400 text-sm mt-0.5">Terms & Conditions · {templateMeta.name}</p>
            </div>

            <div className="grid grid-cols-[220px_1fr] bg-gray-50 border-b border-gray-200">
              <div className="px-8 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Item</div>
              <div className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 border-l border-gray-100">Details</div>
            </div>

            {clausesForDocument.length > 0 ? (
              clausesForDocument.map((clause, ci) => {
                const { resolved, hasUnfilledGaps } = resolveText(clause.text)
                return (
                  <div key={clause.slug} className={`grid grid-cols-[220px_1fr] border-b border-gray-100 last:border-0 ${ci % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <div className="px-8 py-4 flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${clause.gaps ? 'bg-amber-400' : 'bg-gray-300'}`} />
                      <span className="text-gray-800 font-semibold text-sm leading-snug">{clause.label}</span>
                    </div>
                    <div className="px-6 py-4 border-l border-gray-100">
                      <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                        {(() => {
                          const textToShow = resolved && resolved.trim() ? resolved : (clause.text || 'No content')
                          if (clause.gaps && hasUnfilledGaps) {
                            return <span className="text-gray-400 italic text-xs">Answer above to generate this clause</span>
                          }
                          return <AnimatedText text={textToShow} />
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-8 py-8 text-center text-gray-400">
                <p>No clauses found in template.</p>
              </div>
            )}

            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-gray-300 text-xs">Generated by Turnstyle · Flow Marketing · 11 Lomandra Pl, Coolum Beach QLD 4573</p>
              <p className="text-gray-300 text-xs font-mono">{campaign.tsCode}</p>
            </div>
          </div>

          {!isReadonly && (
          <div className="mt-6 flex justify-center pb-16">
            <button
              onClick={handleEditAnswers}
              className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10">
              ← Edit answers
            </button>
          </div>
          )}
        </main>
      )}
    </div>
  )
}
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { REPCO_TRADE, TEMPLATE_META as REPCO_META } from '@/lib/terms-templates/repco-trade'
import { NAPA_TRADE, TEMPLATE_META as NAPA_META } from '@/lib/terms-templates/napa-trade'
import { useNotify } from '@/components/useNotify'

type CommentStatus = 'OPEN' | 'RESOLVED'

interface TermsComment {
  id: string
  termsDraftId: string
  clauseSlug: string
  authorName: string
  authorEmail: string
  body: string
  status: CommentStatus
  createdAt: string
  draft: {
    id: string
    version: number
    templateId: string
  }
}

interface TermsDraft {
  id: string
  version: number
  content: string
  gapAnswers: Record<string, string | number>
  templateId: string
  shareToken: string
}

interface ClauseSection {
  slug: string
  label: string
  text: string
}

const TEMPLATE_REGISTRY: Record<string, { clauses: any[]; meta: { id: string; name: string } }> = {
  'repco-trade': { clauses: REPCO_TRADE as any[], meta: REPCO_META },
  'napa-trade': { clauses: NAPA_TRADE as any[], meta: NAPA_META },
}

export default function TermsCommentsPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { toast, modal } = useNotify()

  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<TermsComment[]>([])
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN')
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TermsDraft | null>(null)
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const documentPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const commentsRes = await fetch(`/api/terms/comments?campaignId=${id}&status=ALL`)
        const commentsJson = await commentsRes.json()
        setComments(commentsJson || [])

        const draftsRes = await fetch(`/api/terms?campaignId=${id}`)
        const draftsJson = await draftsRes.json()
        const latest = Array.isArray(draftsJson) && draftsJson.length > 0 ? draftsJson[0] : null
        if (latest) {
          setDraft({
            id: latest.id,
            version: latest.version,
            content: latest.content,
            gapAnswers: latest.gapAnswers || {},
            templateId: latest.templateId,
            shareToken: latest.shareToken,
          })
        }
      } catch (e) {
        console.error('Failed to load comments/draft:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const currentTemplateKey = useMemo(() => {
    if (!draft) return 'repco-trade'
    if (draft.templateId === NAPA_META.id) return 'napa-trade'
    return 'repco-trade'
  }, [draft])

  const currentTemplate = TEMPLATE_REGISTRY[currentTemplateKey]

  const sections: ClauseSection[] = useMemo(() => {
    if (!draft) return []
    const rawSections = draft.content.split('\n\n---\n\n')
    const labelToText: Record<string, string> = {}
    for (const sec of rawSections) {
      const [firstLine, ...rest] = sec.split('\n\n')
      if (!firstLine) continue
      labelToText[firstLine.trim()] = rest.join('\n\n').trim()
    }
    const clauses = currentTemplate?.clauses || []
    return clauses.map((cl: any) => ({
      slug: cl.slug,
      label: cl.label,
      text: editedTexts[cl.slug] ?? labelToText[cl.label] ?? '',
    }))
  }, [draft, currentTemplate, editedTexts])

  // Resize textareas to fit content on initial load and when sections change
  useEffect(() => {
    if (sections.length === 0) return
    const el = documentPanelRef.current
    if (!el) return
    const run = () => {
      el.querySelectorAll('textarea').forEach((ta: Element) => {
        const t = ta as HTMLTextAreaElement
        t.style.minHeight = '0'
        t.style.height = '0'
        t.style.height = t.scrollHeight + 'px'
      })
    }
    const id = setTimeout(run, 0)
    return () => clearTimeout(id)
  }, [sections])

  const openComments = comments.filter(c => c.status === 'OPEN')
  const resolvedComments = comments.filter(c => c.status === 'RESOLVED')

  const filteredComments = useMemo(() => {
    if (filter === 'OPEN') return openComments
    if (filter === 'RESOLVED') return resolvedComments
    return comments
  }, [comments, openComments, resolvedComments, filter])

  const selectedComment = comments.find(c => c.id === selectedCommentId) || filteredComments[0] || null
  const selectedSlug = selectedComment?.clauseSlug || null

  const handleImplement = (comment: TermsComment) => {
    setSelectedCommentId(comment.id)
    setFilter('ALL')
    setTimeout(() => {
      const el = sectionRefs.current[comment.clauseSlug]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const handleReject = async (comment: TermsComment) => {
    try {
      await fetch(`/api/terms/${comment.termsDraftId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id }),
      })
      setComments(prev => prev.map(c => (c.id === comment.id ? { ...c, status: 'RESOLVED' } : c)))
      toast('Comment rejected and resolved')
    } catch (e) {
      console.error('Failed to resolve comment:', e)
      toast('Failed to resolve comment', 'error')
    }
  }

  const handleChangeClauseText = (slug: string, text: string) => {
    setEditedTexts(prev => ({ ...prev, [slug]: text }))
  }
  const handleSubmit = async () => {
    if (!draft) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING', force: true }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setShowSubmitConfirm(false)
      toast('Terms submitted — campaign is now Pending')
      setTimeout(() => {
        window.location.href = `/dashboard/${id}?tab=terms`
      }, 1200)
    } catch (e) {
      toast('Failed to submit terms', 'error')
    } finally {
      setSubmitting(false)
    }
  }
  const handleSaveRegenerate = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const parts = sections.map(sec => `${sec.label}\n\n${sec.text}`)
      const newContent = parts.join('\n\n---\n\n')

      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: id,
          content: newContent,
          gapAnswers: draft.gapAnswers,
          templateId: draft.templateId,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Save & Regenerate failed:', errText)
        toast('Failed to save updated terms', 'error')
        return
      }

      const newDraft = await res.json()
      setDraft({
        id: newDraft.id,
        version: newDraft.version,
        content: newDraft.content,
        gapAnswers: newDraft.gapAnswers || {},
        templateId: newDraft.templateId,
        shareToken: newDraft.shareToken,
      })

      // Mark all open comments as resolved
      const open = comments.filter(c => c.status === 'OPEN')
      await Promise.all(
        open.map(c =>
          fetch(`/api/terms/${c.termsDraftId}/comments`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commentId: c.id }),
          }),
        ),
      )
      setComments(prev => prev.map(c => (c.status === 'OPEN' ? { ...c, status: 'RESOLVED' } : c)))

      const shareLink = `${window.location.origin}/review/${newDraft.shareToken}`
      modal({
        title: 'Terms Updated — Reshare Required',
        message: `Draft v${newDraft.version} saved and all comments resolved. Send this updated link to the promoter.`,
        copyText: shareLink,
      })
    } catch (e) {
      console.error('Save & Regenerate error:', e)
      toast('Failed to save updated terms', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading comments…</div>
      </div>
    )
  }

  const allResolved = comments.length > 0 && comments.every(c => c.status === 'RESOLVED')

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href={`/dashboard/${id}`} className="text-white/40 hover:text-white text-sm transition-colors">
              Command Centre
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Terms Comments</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveRegenerate}
              disabled={saving}
              className="bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Regenerate'}
            </button>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={saving || submitting}
              className="bg-white text-[#0a0a0f] font-black text-xs px-3 py-1.5 rounded-lg hover:bg-white/90 transition-all disabled:opacity-50"
            >
              Submit →
            </button>
          </div>
        </div>
      </nav>

      {allResolved && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>✓ All comments resolved — ready to reshare</span>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[0.7fr_0.3fr] gap-6">
        {/* Left: document (70%) */}
        <section className="bg-white rounded-2xl overflow-hidden shadow-xl text-sm text-gray-800 lg:order-1">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Terms &amp; Conditions</div>
              <div className="text-gray-900 font-black text-lg mt-0.5">Comments Resolution</div>
            </div>
            {draft && <div className="text-gray-400 text-xs">Draft v{draft.version}</div>}
          </div>

          {sections.length === 0 ? (
            <div className="p-6 text-gray-400 text-sm">No terms content found.</div>
          ) : (
            <div ref={documentPanelRef} className="divide-y divide-gray-100 max-h-[calc(100vh-220px)] overflow-y-auto">
              {sections.map(sec => {
                const isHighlighted = sec.slug === selectedSlug
                return (
                  <div
                    key={sec.slug}
                    ref={el => { sectionRefs.current[sec.slug] = el }}
                    className={`flex flex-col px-6 py-4 ${
                      isHighlighted ? 'bg-amber-50 border-l-4 border-amber-400' : 'bg-white'
                    }`}
                  >
                    <div className="text-gray-900 font-semibold text-sm mb-2">{sec.label}</div>
                    <textarea
                      value={sec.text}
                      onChange={e => handleChangeClauseText(sec.slug, e.target.value)}
                      onInput={e => {
                        const el = e.target as HTMLTextAreaElement
                        el.style.minHeight = '0'
                        el.style.height = '0'
                        el.style.height = el.scrollHeight + 'px'
                      }}
                      rows={1}
                      style={{ minHeight: '1.5rem', resize: 'none', lineHeight: '1.375' }}
                      className="w-full text-gray-800 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 overflow-hidden"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Right: comments list (30%) */}
        <section className="space-y-4 lg:order-2">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            {(['ALL', 'OPEN', 'RESOLVED'] as const).map(key => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  filter === key
                    ? 'bg-white text-[#0a0a0f]'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {key === 'ALL' ? 'All' : key === 'OPEN' ? 'Open' : 'Resolved'}
              </button>
            ))}
            <div className="ml-auto text-white/30 text-xs">
              {openComments.length} open · {resolvedComments.length} resolved
            </div>
          </div>

          {filteredComments.length === 0 ? (
            <div className="text-white/30 text-sm mt-4">No comments in this view.</div>
          ) : (
            filteredComments.map(comment => {
              const isSelected = comment.id === selectedCommentId
              const isResolved = comment.status === 'RESOLVED'
              return (
                <div
                  key={comment.id}
                  className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 transition-all cursor-pointer ${
                    isSelected ? 'border-amber-400 bg-amber-500/5' : ''
                  } ${isResolved ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedCommentId(comment.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white text-xs font-semibold">
                        {comment.authorName}{' '}
                        <span className="text-white/40">· {comment.authorEmail}</span>
                      </div>
                      <div className="text-white/30 text-[11px] mt-0.5">
                        {new Date(comment.createdAt).toLocaleString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-white/40">
                      Draft v{comment.draft.version}
                    </div>
                  </div>

                  <div className="mt-2 text-amber-300 text-xs font-semibold">
                    {comment.clauseSlug}
                  </div>

                  <div className={`mt-2 text-xs ${isResolved ? 'text-white/30 line-through' : 'text-white/80'}`}>
                    {comment.body}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {!isResolved && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); handleImplement(comment) }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all"
                        >
                          Implement
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleReject(comment) }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white/[0.03] border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                        >
                          Reject
                        </button>
                        <span className="ml-auto text-amber-300 text-[11px] font-semibold">Pending</span>
                      </>
                    )}
                    {isResolved && (
                      <span className="ml-auto text-emerald-300 text-[11px] font-semibold">Resolved</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </section>

        {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111118] border border-white/[0.10] rounded-2xl p-8 max-w-sm w-full">
            <h2 className="text-white font-black text-xl mb-2">Submit Terms?</h2>
            <p className="text-white/40 text-sm mb-1">
              Draft version <span className="text-white font-bold">No. {draft?.version}</span> will be submitted for final review.
            </p>
            <p className="text-white/30 text-xs mb-6">
              Once submitted, the campaign status will move to <span className="text-orange-400 font-semibold">Pending</span>. No further edits will be possible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-white/10 transition-all">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-white text-[#0a0a0f] font-black text-sm py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  )
}
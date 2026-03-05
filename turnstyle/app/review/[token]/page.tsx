'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

function parseClauses(content: string): Array<{ label: string; text: string }> {
  const sections = content.split('\n\n---\n\n')
  return sections.map(section => {
    const lines = section.split('\n\n')
    const label = lines[0] || 'Untitled Clause'
    const text = lines.slice(1).join('\n\n')
    return { label, text }
  })
}

function ClauseSection({ 
  clause, 
  clauseSlug, 
  comments, 
  draftId, 
  onCommentAdded 
}: { 
  clause: { label: string; text: string }
  clauseSlug: string
  comments: Array<{ id: string; authorName: string; authorEmail: string; body: string; createdAt: string }>
  draftId: string
  onCommentAdded: () => void
}) {
  const [showCommentForm, setShowCommentForm] = useState(false)

  return (
    <div className="bg-[#1a1a24] rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-white">{clause.label}</h3>
        <button
          onClick={() => setShowCommentForm(!showCommentForm)}
          className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded border border-amber-500/30"
        >
          {showCommentForm ? 'Cancel' : `Comment (${comments.length})`}
        </button>
      </div>
      
      <div className="prose prose-invert max-w-none mb-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80">
          {clause.text}
        </pre>
      </div>

      {showCommentForm && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <CommentForm 
            draftId={draftId} 
            clauseSlug={clauseSlug}
            onCommentAdded={() => {
              setShowCommentForm(false)
              onCommentAdded()
            }} 
          />
        </div>
      )}

      {comments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h4 className="text-sm font-semibold text-white/60 mb-3">Comments ({comments.length})</h4>
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-[#0a0a0f] rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{comment.authorName}</p>
                    <p className="text-xs text-white/50">{comment.authorEmail}</p>
                  </div>
                  <span className="text-xs text-white/40">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-white/80">{comment.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FloatingApprovalButton({ draft, onApproved }: { draft: TermsDraft; onApproved: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [approverName, setApproverName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('review_approver_name') || ''
    }
    return ''
  })
  const [approverEmail, setApproverEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('review_approver_email') || ''
    }
    return ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (approverName && typeof window !== 'undefined') {
      localStorage.setItem('review_approver_name', approverName)
    }
  }, [approverName])

  useEffect(() => {
    if (approverEmail && typeof window !== 'undefined') {
      localStorage.setItem('review_approver_email', approverEmail)
    }
  }, [approverEmail])

  const handleApprove = async () => {
    if (!approverName || !approverEmail) {
      setError('Please enter your name and email')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/terms/${draft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverName,
          approverEmail,
          status: 'APPROVED',
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Failed to approve')
      }

      setShowModal(false)
      onApproved()
    } catch (err: any) {
      setError(err.message || 'Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  const timestamp = new Date().toLocaleString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return (
    <>
      {/* Floating Button */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setShowModal(true)}
          className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full font-bold text-lg shadow-lg shadow-emerald-500/50 hover:shadow-emerald-500/70 transition-all transform hover:scale-105 flex items-center justify-center"
          aria-label="Approve this version"
        >
          ✓
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Approve Version {draft.version}</h2>
              <p className="text-white/60 text-sm">{timestamp}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Your Name</label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Your Email</label>
                <input
                  type="email"
                  value={approverEmail}
                  onChange={(e) => setApproverEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  placeholder="Enter your email"
                />
              </div>
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting || !approverName || !approverEmail}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-emerald-500/50 disabled:to-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                >
                  {submitting ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CommentForm({ 
  draftId, 
  clauseSlug,
  onCommentAdded 
}: { 
  draftId: string
  clauseSlug: string
  onCommentAdded: () => void 
}) {
  // Load saved name/email from localStorage
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('review_comment_authorName') || ''
    }
    return ''
  })
  const [authorEmail, setAuthorEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('review_comment_authorEmail') || ''
    }
    return ''
  })
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save to localStorage when name/email changes
  useEffect(() => {
    if (authorName) {
      localStorage.setItem('review_comment_authorName', authorName)
    }
  }, [authorName])

  useEffect(() => {
    if (authorEmail) {
      localStorage.setItem('review_comment_authorEmail', authorEmail)
    }
  }, [authorEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/terms/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clauseSlug,
          authorName,
          authorEmail,
          body,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Failed to add comment')
      }

      // Reset only the comment body, keep name/email for next comment
      setBody('')
      onCommentAdded()
    } catch (err: any) {
      setError(err.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Your Name</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Your Email</label>
          <input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">Comment</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={3}
          className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-amber-400"
        />
      </div>
      {error && (
        <div className="text-red-400 text-xs">{error}</div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white rounded text-sm font-medium"
      >
        {submitting ? 'Submitting...' : 'Add Comment'}
      </button>
    </form>
  )
}

interface TermsDraft {
  id: string
  content: string
  version: number
  status: string
  createdAt: string
  campaign: {
    name: string
    tsCode: string
  }
  comments: Array<{
    id: string
    clauseSlug: string
    authorName: string
    authorEmail: string
    body: string
    createdAt: string
  }>
  approvals: Array<{
    id: string
    approverName: string
    approverEmail: string
    status: string
    note?: string
    respondedAt?: string
  }>
}

export default function ReviewPage() {
  const params = useParams()
  const token = params.token as string
  const [draft, setDraft] = useState<TermsDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    fetch(`/api/terms/review/${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          if (data.locked) {
            setError('LOCKED')
          } else {
            setError(data.error || `Failed to load: ${res.status}`)
          }
          setLoading(false)
          return
        }
        setDraft(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load terms draft')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    )
  }

  if (error === 'LOCKED') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-white font-black text-xl mb-2">Terms Submitted</h1>
          <p className="text-white/40 text-sm">These terms have been finalised and submitted. This review link is no longer active.</p>
        </div>
      </div>
    )
  }
  if (error || !draft) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-red-400">
        {error || 'Terms draft not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Terms & Conditions Review</h1>
          <div className="text-white/60 space-y-1">
            <p>Campaign: {draft.campaign.name} ({draft.campaign.tsCode})</p>
            <p>Version: {draft.version}</p>
            <p>Status: <span className="capitalize">{draft.status.toLowerCase().replace('_', ' ')}</span></p>
            <p>Created: {new Date(draft.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Content - Parsed into Clauses */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Terms & Conditions</h2>
          {parseClauses(draft.content).map((clause, index) => {
            const clauseSlug = clause.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            const clauseComments = draft.comments.filter(c => c.clauseSlug === clauseSlug)
            return (
              <ClauseSection
                key={index}
                clause={clause}
                clauseSlug={clauseSlug}
                comments={clauseComments}
                draftId={draft.id}
                onCommentAdded={() => {
                  fetch(`/api/terms/review/${token}`)
                    .then(res => res.json())
                    .then(data => setDraft(data))
                }}
              />
            )
          })}
        </div>

        {/* Approval Status (if approved) */}
        {draft.approvals.some((a: any) => a.status === 'APPROVED') && (
          <div className="mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✓</span>
                <span className="text-emerald-400 font-semibold">Approved</span>
              </div>
              <div className="space-y-2 mt-4">
                {draft.approvals
                  .filter((a: any) => a.status === 'APPROVED')
                  .map((approval: any) => (
                    <div key={approval.id} className="text-white/80 text-sm">
                      <p className="font-medium">{approval.approverName} · {approval.approverEmail}</p>
                      <p className="text-white/60 text-xs">
                        Approved · {new Date(approval.respondedAt || approval.createdAt).toLocaleString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                      {approval.note && (
                        <p className="text-white/60 text-xs mt-1 italic">{approval.note}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Approval Button */}
      {!draft.approvals.some((a: any) => a.status === 'APPROVED') && (
        <FloatingApprovalButton 
          draft={draft}
          onApproved={() => {
            fetch(`/api/terms/review/${token}`)
              .then(res => res.json())
              .then(data => setDraft(data))
          }}
        />
      )}
    </div>
  )
}

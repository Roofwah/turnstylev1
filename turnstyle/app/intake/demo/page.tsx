'use client'

import { useState } from 'react'
import type { PacketPresentation } from '@/lib/intake/packet-types'

type SubmitResponse = {
  ok: boolean
  packet_ref?: string
  presentation?: PacketPresentation
  interpretation_source?: string
  degraded?: boolean
  emails?: {
    submitter: boolean
    flow_marketing: boolean
    submitter_error?: string | null
    flow_error?: string | null
  }
  error?: string
}

export default function IntakeDemoPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResponse | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/intake/demo/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, concept }),
      })
      const data = (await res.json()) as SubmitResponse
      if (!res.ok || !data.ok) {
        setError(data.error || 'Submission failed')
        return
      }
      setResult(data)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setError(null)
    setConcept('')
  }

  const presentation = result?.presentation

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative max-w-2xl mx-auto px-6 py-14">
        <div className="mb-10 text-center">
          <img src="/tstyle.png" alt="Turnstyle" className="h-10 w-auto mx-auto mb-5" />
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">INTAKE</h1>
        </div>

        {!presentation ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/85 mb-2">
                Promotional concept
              </label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                required
                rows={5}
                placeholder="We want to run a promotion across 200 stores where customers can win their purchase back."
                className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.1] px-4 py-4 text-base text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 resize-y min-h-[140px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/85 mb-2">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 py-3 text-sm focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/85 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 py-3 text-sm focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-white/85 mb-2">Company</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 py-3 text-sm focus:outline-none focus:border-white/30"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-white text-[#0a0a0f] font-black text-sm px-8 py-3.5 rounded-xl hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating…' : 'Create Promotion'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200/90">
              Thanks — your campaign summary is ready.
              {result?.emails?.submitter
                ? ' A copy has been sent to your email address.'
                : ' We could not confirm email delivery — your summary was still saved.'}
            </div>

            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 sm:p-8">
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 mb-2">Your promotional brief</p>
              <h2 className="text-2xl font-black mb-6">{presentation.campaignName}</h2>

              <dl className="space-y-4">
                {presentation.fields.map((f) => (
                  <div key={f.label} className="grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                    <dt className="text-xs uppercase tracking-wider text-white/40 pt-0.5">{f.label}</dt>
                    <dd className="text-sm text-white/90">
                      {f.value}
                      {!f.confirmed && f.value !== 'Not specified' && f.value !== 'To be confirmed' && f.value !== 'To be determined' && (
                        <span className="ml-2 text-[11px] text-amber-400/90">Suggested</span>
                      )}
                      {!f.confirmed && (f.value === 'Not specified' || f.value === 'To be confirmed' || f.value === 'To be determined') && (
                        <span className="ml-2 text-[11px] text-white/35">Unknown</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {presentation.assumptions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/[0.08]">
                  <h3 className="text-xs uppercase tracking-wider text-white/40 mb-3">Suggested considerations</h3>
                  <ul className="space-y-2 text-sm text-amber-200/80 list-disc pl-5">
                    {presentation.unresolved.slice(0, 6).map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                    {presentation.assumptions.slice(0, 4).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-white/[0.08]">
                <p className="text-xs text-white/35 mb-1">Original concept</p>
                <p className="text-sm text-white/60 italic">&ldquo;{presentation.originalConcept}&rdquo;</p>
                <p className="mt-4 text-[11px] text-white/30 font-mono">
                  Ref {presentation.packetRef}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-white/50 hover:text-white underline underline-offset-4"
            >
              Submit another concept
            </button>
          </div>
        )}

        <p className="mt-16 text-center text-[11px] text-white/25">
          Zitcha · Sales promotions by Turnstyle
        </p>
      </div>
    </div>
  )
}

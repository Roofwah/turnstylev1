// ─────────────────────────────────────────────
// Turnstyle — Preflight Existing Terms
// /dashboard/preflight
//
// Server component shell. Renders the upload form.
// No DB reads required at this route.
// ─────────────────────────────────────────────

import Link from 'next/link'
import { UploadForm } from './UploadForm'

export const metadata = {
  title: 'Preflight Terms — Turnstyle',
}

export default function PreflightUploadPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Grid background — matches dashboard */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-white/60 hover:text-white text-sm transition-colors">
                Campaigns
              </Link>
              <Link href="/dashboard/terms-test" className="text-white/60 hover:text-white text-sm transition-colors">
                Terms Test
              </Link>
              <span className="text-white text-sm font-semibold">Preflight</span>
              <span className="text-white/30 text-sm cursor-not-allowed">Templates</span>
              <span className="text-white/30 text-sm cursor-not-allowed">Reports</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white text-xs font-bold">CS</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-white/30 text-xs mb-8">
          <Link href="/dashboard" className="hover:text-white/60 transition-colors">
            Campaigns
          </Link>
          <span>/</span>
          <span className="text-white/50">Preflight Terms</span>
        </div>

        {/* Two-column layout: intro left, form right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left — description */}
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
                  Document Preflight
                </span>
              </div>
              <h1 className="text-white font-black text-2xl sm:text-3xl leading-tight mb-3">
                Preflight Existing Terms
              </h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Upload a Word document containing promotion terms and conditions.
                The preflight engine will extract the text, classify clauses, and
                run a compliance check — no campaign wizard required.
              </p>
            </div>

            {/* What gets checked */}
            <div className="space-y-3">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                What gets checked
              </p>
              {[
                {
                  icon: '◈',
                  title: 'Clause structure',
                  desc: 'Promoter, eligibility, entry mechanic, prize, draw, notification, privacy, permits',
                },
                {
                  icon: '◈',
                  title: 'Missing clauses',
                  desc: 'Required sections flagged if absent, including travel and event conditions where detected',
                },
                {
                  icon: '◈',
                  title: 'Permit placeholders',
                  desc: 'Unfilled permit number placeholders (####) identified before distribution',
                },
                {
                  icon: '◈',
                  title: 'Prize wording conflicts',
                  desc: 'Contradictory "valued up to" vs "valued at" qualifier detected',
                },
                {
                  icon: '◈',
                  title: 'Privacy clause',
                  desc: 'Confirms a privacy clause is present',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-amber-400/60 text-xs mt-0.5 shrink-0">{item.icon}</span>
                  <div>
                    <span className="text-white/70 text-xs font-semibold">{item.title}</span>
                    <span className="text-white/30 text-xs"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* What's not checked note */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 space-y-1">
              <p className="text-white/40 text-xs font-semibold">Not checked in document mode</p>
              <p className="text-white/25 text-xs leading-relaxed">
                Date consistency, prize pool maths, and builder-vs-terms mismatch rules
                require a linked campaign and are skipped. Use the campaign preflight
                inside a campaign for those checks.
              </p>
            </div>
          </div>

          {/* Right — upload form */}
          <div>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-8">
              <h2 className="text-white font-bold text-base mb-1">Upload document</h2>
              <p className="text-white/40 text-xs mb-6">
                .docx format · max 10 MB
              </p>
              <UploadForm />
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

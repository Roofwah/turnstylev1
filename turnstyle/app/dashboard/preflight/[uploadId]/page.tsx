// ─────────────────────────────────────────────
// Turnstyle — Preflight Upload Report Page
// /dashboard/preflight/[uploadId]
// ─────────────────────────────────────────────

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PreflightUploadReportView } from '@/components/PreflightUploadReportView'
import type { PreflightReport } from '@/lib/preflight/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { uploadId: string }
}

export default async function PreflightReportPage({ params }: PageProps) {
  const { uploadId } = params

  // Fetch upload + its report in one query
  const upload = await prisma.termsUpload.findUnique({
    where: { id: uploadId },
    include: { report: true },
  })

  if (!upload || !upload.report) {
    notFound()
  }

  // Deserialise the stored JSON back to PreflightReport
  const report = upload.report.reportJson as unknown as PreflightReport

  const bandConfig: Record<string, { color: string }> = {
    EXCELLENT:     { color: 'text-emerald-400' },
    LOW_RISK:      { color: 'text-emerald-400' },
    MODERATE_RISK: { color: 'text-amber-400' },
    HIGH_RISK:     { color: 'text-orange-400' },
    NOT_READY:     { color: 'text-red-400' },
  }
  const bandCfg = bandConfig[upload.report.riskBand] ?? bandConfig.NOT_READY

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Grid background */}
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
              <Link href="/dashboard/preflight" className="text-white text-sm font-semibold">
                Preflight
              </Link>
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

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Breadcrumb + header */}
        <div>
          <div className="flex items-center gap-2 text-white/30 text-xs mb-4">
            <Link href="/dashboard" className="hover:text-white/60 transition-colors">
              Campaigns
            </Link>
            <span>/</span>
            <Link href="/dashboard/preflight" className="hover:text-white/60 transition-colors">
              Preflight Terms
            </Link>
            <span>/</span>
            <span className="text-white/50 truncate max-w-xs">{upload.filename}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-white font-black text-2xl sm:text-3xl mb-1">
                Preflight Report
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-sm truncate max-w-xs">{upload.filename}</span>
                <span className={`text-xs font-bold ${bandCfg.color}`}>
                  {upload.report.score}/100 · {upload.report.riskBand.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <Link
              href="/dashboard/preflight"
              className="shrink-0 border border-white/[0.12] text-white/60 hover:text-white hover:border-white/30 text-xs font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap"
            >
              + Preflight Another
            </Link>
          </div>
        </div>

        {/* Report */}
        <PreflightUploadReportView
          report={report}
          filename={upload.filename}
          wordCount={upload.wordCount}
          uploadedAt={upload.uploadedAt.toISOString()}
        />
      </main>
    </div>
  )
}

'use client'
import Link from 'next/link'
import CampaignLifecycleBar from './CampaignLifecycleBar'

interface CampaignCardProps {
  campaign: any
  status: { label: string; color: string; bg: string }
  effectiveStatus: string
  hasApprovedQuote: boolean
  countdownLabel: string | null
  regionLabel: string
  permitStates: string[]
  cta: { label: string; color: string } | undefined
  prizePoolTotalFormatted: string
  promoStartFormatted: string
  promoEndFormatted: string
}

export default function CampaignCard({
  campaign,
  status,
  effectiveStatus,
  hasApprovedQuote,
  countdownLabel,
  regionLabel,
  permitStates,
  cta,
  prizePoolTotalFormatted,
  promoStartFormatted,
  promoEndFormatted,
}: CampaignCardProps) {
  const permitColors: Record<string, string> = {
    ACT: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    SA:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
    NSW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all group">
      <Link href={`/dashboard/${campaign.id}`} className="block">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="text-white/30 text-xs font-mono font-bold">{campaign.tsCode}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
                {status.label}
              </span>
            </div>
            <h2 className="text-white font-bold text-lg leading-tight mb-0.5 group-hover:text-white transition-colors">
              {campaign.name}
            </h2>
            <p className="text-white/40 text-sm">{campaign.promoter?.name ?? '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-white font-black text-lg">{prizePoolTotalFormatted}</div>
            <div className="text-white/30 text-xs">excl GST</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-6 flex-wrap flex-1">
            <div>
              <span className="text-white/30 text-xs">Prize pool </span>
              <span className="text-white/60 text-xs font-semibold">{prizePoolTotalFormatted}</span>
            </div>
            <div>
              <span className="text-white/30 text-xs">Dates </span>
              <span className="text-white/60 text-xs font-semibold">
                {promoStartFormatted} → {promoEndFormatted}
              </span>
            </div>
            {countdownLabel && (
              <div className="px-3 py-0.5 rounded-md bg-sky-400/10 border border-sky-400/20">
                <span className="text-sky-400 text-xs font-bold">{countdownLabel}</span>
              </div>
            )}
            <div>
              <span className="text-white/30 text-xs">Regions </span>
              <span className="text-white/60 text-xs font-semibold">{regionLabel}</span>
            </div>
            {permitStates.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-white/30 text-xs">Permits </span>
                {permitStates.map(state => (
                  <span key={state} className={`text-xs font-bold px-1.5 py-0.5 rounded border ${permitColors[state] ?? 'bg-purple-500/15 text-purple-400 border-purple-500/20'}`}>
                    {state}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Lifecycle Bar - outside Link to avoid nested interactive elements */}
      <div className="mt-3 pt-3 border-t border-white/[0.05]" onClick={(e) => e.stopPropagation()}>
        <CampaignLifecycleBar
          campaignId={campaign.id}
          currentStatus={effectiveStatus}
          campaign={campaign}
        />
      </div>
    </div>
  )
}

'use client'
import Link from 'next/link'
import CampaignLifecycleBar from './CampaignLifecycleBar'

interface CampaignCardProps {
  campaign: any
  status: { label: string; color: string; bg: string }
  effectiveStatus: string
  hasApprovedQuote: boolean
  countdownLabel: string | null
  startDays: number | null
  regionLabel: string
  permitStates: string[]
  cta: { label: string; color: string } | undefined
  prizePoolTotalFormatted: string
  promoStartFormatted: string
  promoEndFormatted: string
}

export default function CampaignCard({
  campaign, status, effectiveStatus, hasApprovedQuote, countdownLabel, startDays,
  regionLabel, permitStates, cta, prizePoolTotalFormatted, promoStartFormatted, promoEndFormatted,
}: CampaignCardProps) {
  const permitColors: Record<string, string> = {
    ACT: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    SA:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
    NSW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all group">

      {/* Top row: name + next step button */}
      <div className="flex items-start justify-between gap-4">
        <Link href={`/dashboard/${campaign.id}`} className="flex-1 min-w-0 block">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-white/30 text-xs font-mono font-bold">{campaign.tsCode}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>{status.label}</span>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight mb-0.5">{campaign.name}</h2>
          <p className="text-white/40 text-sm">{campaign.promoter?.name ?? '—'}</p>
        </Link>

        {/* Next step button only — no metro map */}
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <CampaignLifecycleBar
            campaignId={campaign.id}
            currentStatus={effectiveStatus}
            campaign={campaign}
            compact
          />
        </div>
      </div>

      {/* Metadata row */}
      <Link href={`/dashboard/${campaign.id}`} className="block">
        <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-6 flex-wrap flex-1">
            <div>
              <span className="text-white/30 text-xs">Prize pool </span>
              <span className="text-white/60 text-xs font-semibold">{prizePoolTotalFormatted}</span>
            </div>
            <div>
              <span className="text-white/30 text-xs">Dates </span>
              <span className="text-white/60 text-xs font-semibold">{promoStartFormatted} → {promoEndFormatted}</span>
            </div>
{countdownLabel && (() => {
                const col = startDays !== null && startDays <= 5 ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                            startDays !== null && startDays <= 10 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                            startDays !== null && startDays > 10 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                            'text-sky-400 bg-sky-400/10 border-sky-400/20'
                return (
                  <div className={"px-3 py-0.5 rounded-md border " + col}>
                    <span className={"text-xs font-bold " + col.split(' ')[0]}>{countdownLabel}</span>
                  </div>
                )
              })()}
            <div>
              <span className="text-white/30 text-xs">Regions </span>
              <span className="text-white/60 text-xs font-semibold">{regionLabel}</span>
            </div>
            {permitStates.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-white/30 text-xs">Permits </span>
                {permitStates.map(state => (
                  <span key={state} className={`text-xs font-bold px-1.5 py-0.5 rounded border ${permitColors[state] ?? 'bg-purple-500/15 text-purple-400 border-purple-500/20'}`}>{state}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Metro lifecycle bar — no button (already top right) */}
      <div className="mt-3 pt-3 border-t border-white/[0.05]" onClick={e => e.stopPropagation()}>
        <CampaignLifecycleBar
          campaignId={campaign.id}
          currentStatus={effectiveStatus}
          campaign={campaign}
          hideButton
        />
      </div>

    </div>
  )
}

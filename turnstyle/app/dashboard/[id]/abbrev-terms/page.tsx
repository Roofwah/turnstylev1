'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getCampaign } from '@/app/actions/getCampaign'

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

function formatDateLong(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })
}

function formatRegions(regions: string[]) {
  if (regions.includes('national_au')) return 'Australia'
  const states = regions.filter(r => AU_STATES.includes(r))
  const parts: string[] = []
  if (states.length) parts.push(states.join(', '))
  if (regions.includes('NZ'))  parts.push('New Zealand')
  if (regions.includes('USA')) parts.push('United States')
  if (regions.includes('EU'))  parts.push('Europe')
  return parts.join(', ') || '—'
}

function normaliseCampaign(raw: any) {
  return {
    id:            raw.id,
    tsCode:        raw.tsCode ?? '',
    name:          raw.name ?? '',
    promoter:      raw.promoter ?? null,
    promoStart:    raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd:      raw.promoEnd   ? new Date(raw.promoEnd).toISOString().split('T')[0]   : '',
    drawMechanic:  raw.mechanicType === 'SWEEPSTAKES'   ? 'Sweepstakes'
                 : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer'
                 : 'Other',
    drawFrequency: (raw.drawFrequency ?? 'AT_CONCLUSION').toLowerCase(),
    entryMechanic: raw.entryMechanic ?? '',
    regions:       raw.regions ?? [],
    prizes:        Array.isArray(raw.prizes) ? raw.prizes : [],
    notes:         raw.notes ?? '',
  }
}

function generateDrawDateText(promoEnd: string, drawFrequency: string): string {
  if (!promoEnd) return 'TBC'
  const end = new Date(promoEnd)

  if (drawFrequency === 'at_conclusion') {
    // Draw 5 business days after promo end
    const draw = new Date(end)
    let added = 0
    while (added < 5) {
      draw.setDate(draw.getDate() + 1)
      if (draw.getDay() !== 0 && draw.getDay() !== 6) added++
    }
    return draw.toLocaleDateString('en-AU', {
      hour: '2-digit', minute: '2-digit', weekday: 'long',
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }
  return 'as per schedule'
}

function generateAbbreviatedTerms(campaign: any, campaignUrl: string): string {
  const prizePoolTotal = campaign.prizes.reduce((s: number, p: any) => s + p.qty * p.unitValue, 0)
  const isLimitedOffer = campaign.drawMechanic === 'Limited Offer'
  const regions = formatRegions(campaign.regions)
  const drawDate = generateDrawDateText(campaign.promoEnd, campaign.drawFrequency)

  // Build prize description
  const prizeDesc = campaign.prizes.map((p: any) =>
    `${p.qty === 1 ? '' : `${p.qty} x `}${p.description} valued at ${formatMoney(p.unitValue)} incl GST`
  ).join(', ')

  // Entry mechanic
  const entry = campaign.entryMechanic || '[entry mechanic to be confirmed]'

  // Promoter
  const promoterName = campaign.promoter?.name || '[Promoter]'

  // Build the paragraph
  if (isLimitedOffer) {
    return `Commences 12:00am ${formatDateLong(campaign.promoStart)} and ends 11:59pm ${formatDateLong(campaign.promoEnd)} AEST, see website via the attached QR Code for full terms and conditions, entry requirements, participating retailers and prize details. Please review to determine whether you are eligible to participate. ${entry}. ${prizeDesc}. Total prize pool in ${regions} is ${formatMoney(prizePoolTotal)} incl GST. Promoter is ${promoterName}.`
  }

  return `Commences 12:00am ${formatDateLong(campaign.promoStart)} and ends 11:59pm ${formatDateLong(campaign.promoEnd)} AEST, see website via the attached QR Code for full terms and conditions, entry requirements, participating retailers, prize details and State permit numbers where applicable. Please review to determine whether you are eligible to participate. ${entry}. ${prizeDesc}. Prize drawn ${drawDate} at Flow Marketing, 11 Lomandra Pl, Coolum Beach QLD 4573, Australia. Winners notified via the website or the QR code. Total prize pool in ${regions} is ${formatMoney(prizePoolTotal)} incl GST. Promoter is ${promoterName}.`
}

export default function AbbrevTermsPage() {
  const params  = useParams()
  const id      = params.id as string
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getCampaign(id).then(raw => {
      if (raw) setCampaign(normaliseCampaign(raw))
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>Loading...</div>
  )
  if (!campaign) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>Campaign not found.</div>
  )

  const campaignUrl = `https://turnstylehost.com/campaign/${campaign.tsCode.toLowerCase()}/`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(campaignUrl)}`
  const terms = generateAbbreviatedTerms(campaign, campaignUrl)
  const now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f5f5f5; color: #1a1a1a; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { box-shadow: none !important; margin: 0 !important; }
          .print-dark { background: #0a0a0f !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ background: '#0a0a0f' }}>
        <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={`/dashboard/${id}`} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>← Back to Campaign</a>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>|</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Abbreviated Terms & Conditions</span>
          <button
            onClick={() => window.print()}
            style={{ marginLeft: 'auto', background: 'white', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="page" style={{ maxWidth: 720, margin: '32px auto', background: '#fff', boxShadow: '0 4px 40px rgba(0,0,0,0.10)', borderRadius: 4, overflow: 'hidden' }}>

        {/* Header */}
        <div className="print-dark" style={{ background: '#626363', padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <img src="/tstyle.png" alt="Turnstyle" style={{ height: 30, marginBottom: 12, filter: 'invert(1)' }} />
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Abbreviated Terms & Conditions</div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>{campaign.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 3 }}>Generated</div>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{now}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 8, marginBottom: 3 }}>Campaign ref</div>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{campaign.tsCode}</div>
          </div>
        </div>

        {/* Terms block — QR left, text right */}
        <div style={{ padding: '32px 36px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

          {/* QR Code */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <img src={qrUrl} alt="Campaign QR" style={{ width: 110, height: 110, borderRadius: 4, border: '1px solid #eee' }} />
            <div style={{
              background: '#0a0a0f', color: '#fff', fontSize: 9, fontWeight: 900,
              letterSpacing: 2, textTransform: 'uppercase', padding: '4px 10px',
              borderRadius: 3, textAlign: 'center', width: '100%'
            }}>
              TERMS
            </div>
          </div>

          {/* Terms text */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, color: '#1a1a1a' }}>
              {terms}
            </p>
          </div>

        </div>

        {/* Campaign URL */}
        <div style={{ padding: '0 36px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 110, flexShrink: 0 }} />
          <a href={campaignUrl} style={{ fontSize: 11, color: '#666', textDecoration: 'none' }}>
            {campaignUrl}
          </a>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '14px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 10, color: '#bbb' }}>
            This abbreviated terms statement is generated by Turnstyle and is subject to full terms and conditions available via the QR code or campaign URL.
          </p>
          <p style={{ fontSize: 10, color: '#ddd', flexShrink: 0, marginLeft: 16 }}>
            Turnstyle · Flow Marketing
          </p>
        </div>

      </div>

      <div style={{ height: 48 }} />
    </>
  )
}
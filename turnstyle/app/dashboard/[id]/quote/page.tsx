'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { calculateQuote } from '@/lib/quote-engine'
import { getCampaign } from '@/app/actions/getCampaign'

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRegions(regions: string[]) {
  const parts: string[] = []
  if (regions.includes('national_au')) parts.push('National (Australia)')
  else {
    const states = regions.filter(r => AU_STATES.includes(r))
    if (states.length) parts.push(states.join(', '))
  }
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
    status:        raw.status ?? 'DRAFT',
    promoter:      raw.promoter ?? null,
    promoStart:    raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd:      raw.promoEnd   ? new Date(raw.promoEnd).toISOString().split('T')[0]   : '',
    drawMechanic:  raw.mechanicType === 'SWEEPSTAKES'    ? 'Sweepstakes - Random Draw'
             : raw.mechanicType === 'LIMITED_OFFER'  ? 'Limited Offer'
             : raw.mechanicType === 'INSTANT_WIN'    ? 'Instant Win'
             : raw.mechanicType === 'GAME_OF_SKILL'  ? 'Game of Skill'
             : raw.mechanicType === 'DRAW_ONLY'      ? 'Draw Only'
             : raw.drawMechanic ?? 'Other',
    drawFrequency: (raw.drawFrequency ?? 'AT_CONCLUSION').toLowerCase().replace('_', '_'),
    entryMechanic: raw.entryMechanic ?? '',
    regions:       raw.regions ?? [],
    prizes:        Array.isArray(raw.prizes) ? raw.prizes : [],
    notes:         raw.notes ?? '',
    drawSchedule:  Array.isArray(raw.drawSchedule) ? raw.drawSchedule : [],
  }
}

export default function QuotePrintPage() {
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

  const prizePoolTotal = campaign.prizes.reduce((s: number, p: any) => s + p.qty * p.unitValue, 0)

  const quote = calculateQuote({
    campaignId:        campaign.id,
    tsCode:            campaign.tsCode,
    campaignName:      campaign.name,
    promoStart:        campaign.promoStart,
    promoEnd:          campaign.promoEnd,
    drawMechanic:      campaign.drawMechanic,
    drawFrequency:     campaign.drawFrequency,
    prizes:            campaign.prizes,
    overrideDrawCount: campaign.drawSchedule?.length > 0 ? campaign.drawSchedule.length : undefined,
  })

  const now        = new Date()
  const generated  = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) +
                     ' · ' + now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  const campaignUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/${campaign.id}`
  const qrUrl       = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(campaignUrl)}`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #1a1a1a; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { box-shadow: none !important; }
        }
      `}</style>

      {/* Print / Back buttons */}
      <div className="no-print" style={{ background: '#0a0a0f', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href={`/dashboard/${id}`} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>← Back to Campaign</a>
        <button
          onClick={() => window.print()}
          style={{ marginLeft: 'auto', background: 'white', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Document */}
      <div className="page" style={{ maxWidth: 720, margin: '32px auto', background: '#fff', boxShadow: '0 4px 40px rgba(0,0,0,0.10)', borderRadius: 4 }}>

        {/* Header */}
        <div style={{ background: '#0a0a0f', padding: '32px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <img src="/tstyle.png" alt="Turnstyle" style={{ height: 36, marginBottom: 20 }} />
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Quote</div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>{quote.quoteNumber}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>Generated</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{generated}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8, marginBottom: 4 }}>Valid until</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{formatDate(quote.validUntil)}</div>
          </div>
        </div>

        {/* Campaign + Promoter */}
        <div style={{ padding: '28px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Campaign</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0a0a0f', marginBottom: 4 }}>{campaign.name}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>{campaign.promoter?.name ?? '—'}</div>
            {campaign.promoter?.contactName && (
              <div style={{ fontSize: 13, color: '#999' }}>Contact: {campaign.promoter.contactName}</div>
            )}
            {campaign.promoter?.contactEmail && (
              <div style={{ fontSize: 13, color: '#999' }}>{campaign.promoter.contactEmail}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Flow Marketing</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>
              11 Lomandra Pl<br />
              Coolum Beach QLD 4573<br />
              AUSTRALIA<br />
              1800 660 885<br />
              hello@flowmarketing.com.au
            </div>
          </div>
        </div>

        {/* Big total */}
        <div style={{ padding: '28px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Estimate</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: '#0a0a0f', letterSpacing: -2, lineHeight: 1 }}>{formatMoney(quote.totalExGst)}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>excl GST</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Promotion type</div>
            <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>{campaign.drawMechanic}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Final draw: {quote.finalDrawDate}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              {formatDate(campaign.promoStart)} — {formatDate(campaign.promoEnd)}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              {formatRegions(campaign.regions)}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ padding: '0 40px' }}>
          {quote.lines.map((line: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '18px 0', borderBottom: '1px solid #f5f5f5'
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{line.label}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{line.note}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', flexShrink: 0, marginLeft: 24 }}>
                {formatMoney(line.amount)}
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={{ margin: '0 40px 32px', background: '#0a0a0f', borderRadius: 8, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Total estimate</div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>{formatMoney(quote.totalExGst)}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
              excl GST · +{formatMoney(quote.gstAmount)} GST = {formatMoney(quote.totalIncGst)} incl
            </div>
          </div>
        </div>

        {/* QR + Campaign link */}
        <div style={{ padding: '0 40px 32px', display: 'flex', alignItems: 'center', gap: 24, borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
          <img src={qrUrl} alt="Campaign QR" style={{ width: 80, height: 80, borderRadius: 4 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>Campaign link / QR</div>
            <div style={{ fontSize: 12, color: '#333', fontWeight: 600 }}>{campaignUrl}</div>
          </div>
        </div>

        {/* Disclaimer + engine */}
        <div style={{ padding: '16px 40px 28px', borderTop: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
            Note: This is an automated estimate and may vary based on final mechanics, states, and compliance requirements.
          </p>
          <p style={{ fontSize: 10, color: '#ddd', marginTop: 6 }}>Engine: v0.1.5 · Turnstyle by Flow Marketing</p>
        </div>

      </div>

      <div style={{ height: 48 }} />
    </>
  )
}
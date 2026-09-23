import { Resend } from 'resend'
import type { ExtractedCampaignIntake } from './types'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM =
  process.env.INTAKE_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  'intake@status.turnstylehost.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendIntakeReplyEmail(params: {
  to: string
  subject: string
  intake: ExtractedCampaignIntake
  reviewUrl: string
  inReplyTo?: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[intake/reply] RESEND_API_KEY not set — skipping reply email')
    return null
  }

  const name = params.intake.campaign_name ?? 'your campaign'
  const regionLines = params.intake.regions
    .map(r => {
      const pool = r.total_prize_value
      return pool != null ? `${r.region_name}: $${pool.toLocaleString('en-AU')}` : r.region_name
    })
    .join(' · ')

  const assumptions =
    params.intake.assumptions.length > 0
      ? `<ul>${params.intake.assumptions.slice(0, 6).map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
      : '<p>No additional assumptions.</p>'

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; color: #111;">
      <p style="font-size: 14px; color: #374151;">Thanks — we've interpreted your campaign brief for <strong>${escapeHtml(name)}</strong>.</p>
      ${regionLines ? `<p style="font-size: 14px; color: #374151;"><strong>Regions:</strong> ${escapeHtml(regionLines)}</p>` : ''}
      <p style="font-size: 14px; color: #374151; line-height: 1.6;">${escapeHtml(params.intake.generated_summary)}</p>
      <p style="margin: 24px 0;">
        <a href="${params.reviewUrl}" style="display: inline-block; background: #0a0a0f; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">Review &amp; send to campaign builder</a>
      </p>
      <p style="font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Assumptions applied</p>
      <div style="font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px;">${assumptions}</div>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Turnstyle Campaign Intake · This is a draft for review — nothing has been published yet.</p>
    </div>
  `

  const text = [
    `Thanks — we've interpreted your campaign brief for ${name}.`,
    '',
    params.intake.generated_summary,
    '',
    `Review and continue: ${params.reviewUrl}`,
    '',
    params.intake.assumptions.length ? 'Assumptions:\n' + params.intake.assumptions.map(a => `• ${a}`).join('\n') : '',
  ].join('\n')

  const headers: Record<string, string> = {}
  if (params.inReplyTo) {
    headers['In-Reply-To'] = params.inReplyTo
    headers['References'] = params.inReplyTo
  }

  const result = await resend.emails.send({
    from: FROM,
    to: [params.to],
    subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
    html,
    text,
    headers,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data?.id ?? null
}

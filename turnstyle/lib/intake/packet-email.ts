import { Resend } from 'resend'
import type { PacketPresentation } from './packet-types'
import type { ExtractedCampaignIntake } from './types'
import { generateAbbrevTermsForPacket } from './abbrev-from-packet'
import { buildSubmitterPacketEmail } from './packet-email-submitter'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM =
  process.env.INTAKE_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  'intake@status.turnstylehost.com'

const FLOW_NOTIFY =
  process.env.INTAKE_FLOW_NOTIFY_EMAIL || 'chris@flowmarketing.com.au'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fieldsHtml(p: PacketPresentation): string {
  return p.fields
    .map(
      (f) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtml(f.label)}</td>
          <td style="padding:6px 0;font-size:13px;color:#111;">
            ${escapeHtml(f.value)}
            ${f.confirmed ? '' : ' <span style="color:#b45309;font-size:11px;">(assumed / TBC)</span>'}
          </td>
        </tr>`
    )
    .join('')
}

function assumptionsHtml(list: string[]): string {
  if (!list.length) return '<p style="font-size:13px;color:#6b7280;">None recorded.</p>'
  return `<ul style="margin:0;padding-left:18px;">${list
    .slice(0, 10)
    .map((a) => `<li style="font-size:13px;color:#92400e;margin-bottom:4px;">${escapeHtml(a)}</li>`)
    .join('')}</ul>`
}

function unresolvedHtml(list: string[]): string {
  if (!list.length) return '<p style="font-size:13px;color:#6b7280;">None listed.</p>'
  return `<ul style="margin:0;padding-left:18px;">${list
    .slice(0, 10)
    .map((a) => `<li style="font-size:13px;color:#374151;margin-bottom:4px;">${escapeHtml(a)}</li>`)
    .join('')}</ul>`
}

export async function sendPacketSubmitterEmail(
  presentation: PacketPresentation,
  intake: ExtractedCampaignIntake
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const abbrev = generateAbbrevTermsForPacket({
    intake,
    concept: presentation.originalConcept,
  })
  const { subject, html, text } = buildSubmitterPacketEmail({
    presentation,
    abbrev,
    appUrl,
  })

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [presentation.submitterEmail],
      subject,
      html,
      text,
    })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' }
  }
}

export async function sendPacketFlowNotifyEmail(
  presentation: PacketPresentation,
  reviewUrl?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const subject = `New Turnstyle Intake — ${presentation.submitterCompany} — ${presentation.campaignName}`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;color:#111;">
      <div style="background:#0a0a0f;padding:20px 24px;border-radius:12px 12px 0 0;">
        <div style="color:#fff;font-weight:800;font-size:18px;">New Intake Packet</div>
        <div style="color:rgba(255,255,255,0.45);font-size:12px;margin-top:2px;">Source: ${escapeHtml(presentation.source)} · Partner: ${escapeHtml(presentation.partnerId)}</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Submitter</td><td style="font-size:13px;">${escapeHtml(presentation.submitterName)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Email</td><td style="font-size:13px;">${escapeHtml(presentation.submitterEmail)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Company</td><td style="font-size:13px;">${escapeHtml(presentation.submitterCompany)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Packet</td><td style="font-size:13px;"><strong>${escapeHtml(presentation.packetRef)}</strong></td></tr>
        </table>
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;"><strong>Original concept</strong></p>
        <blockquote style="margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-left:3px solid #0a0a0f;font-size:14px;">
          ${escapeHtml(presentation.originalConcept)}
        </blockquote>
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;"><strong>Summary</strong></p>
        <p style="font-size:14px;line-height:1.55;">${escapeHtml(presentation.summary)}</p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 8px;"><strong>Packet fields</strong></p>
        <table style="width:100%;border-collapse:collapse;">${fieldsHtml(presentation)}</table>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 8px;"><strong>Assumptions</strong></p>
        ${assumptionsHtml(presentation.assumptions)}
        <p style="font-size:12px;color:#6b7280;margin:16px 0 8px;"><strong>Outstanding</strong></p>
        ${unresolvedHtml(presentation.unresolved)}
        ${
          reviewUrl
            ? `<p style="margin-top:24px;"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#0a0a0f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">Open review link</a></p>`
            : ''
        }
      </div>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [FLOW_NOTIFY],
      subject,
      html,
      text: [
        subject,
        `Submitter: ${presentation.submitterName} <${presentation.submitterEmail}>`,
        `Company: ${presentation.submitterCompany}`,
        `Partner: ${presentation.partnerId} (${presentation.source})`,
        `Packet: ${presentation.packetRef}`,
        '',
        presentation.originalConcept,
        '',
        presentation.summary,
        reviewUrl ? `Review: ${reviewUrl}` : '',
      ].join('\n'),
    })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' }
  }
}

export { FLOW_NOTIFY }

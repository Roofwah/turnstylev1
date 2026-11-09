/**
 * Customer-facing Campaign Packet email (partner-branded).
 * Visual reference: Campaign Packet card mockup — clean SaaS document style.
 */

import type { PacketDisplayField, PacketPresentation } from './packet-types'
import {
  absoluteAssetUrl,
  resolvePartnerBranding,
  type PartnerEmailBranding,
} from './partner-branding'
import type { AbbrevGenerateResult } from '@/lib/abbrev-terms/generate'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function firstNameFrom(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0]
  return part || fullName.trim() || 'there'
}

function fieldStatus(f: PacketDisplayField): 'confirmed' | 'proposed' | 'tbc' {
  const v = f.value.trim().toLowerCase()
  if (!f.confirmed || v === 'to be confirmed' || v === 'not specified' || v === 'tbc') {
    if (v === 'to be confirmed' || v === 'not specified' || v === 'tbc' || !f.value.trim()) {
      return 'tbc'
    }
    return 'proposed'
  }
  return 'confirmed'
}

/** Prefer fields with real content; keep a compact overview set. */
export function selectOverviewFields(fields: PacketDisplayField[]): PacketDisplayField[] {
  const preferred = [
    'Likely mechanic',
    'Promotion type',
    'Brand',
    'Retailer',
    'Geography',
    'Campaign dates',
    'Participating locations',
    'Entry requirement',
    'Entry method',
    'Prize',
    'Prize quantity',
    'Approximate prize value',
    'Draw frequency',
  ]

  const byLabel = new Map(fields.map((f) => [f.label, f]))
  const selected: PacketDisplayField[] = []
  for (const label of preferred) {
    const f = byLabel.get(label)
    if (!f) continue
    const status = fieldStatus(f)
    // Skip empty TBC noise except for a few key unknowns
    if (status === 'tbc' && !['Brand', 'Entry method', 'Campaign dates', 'Prize'].includes(label)) {
      continue
    }
    selected.push(f)
  }
  return selected
}

function statusBadge(status: ReturnType<typeof fieldStatus>): string {
  if (status === 'confirmed') {
    return `<span style="display:inline-block;margin-left:6px;font-size:10px;color:#166534;background:#dcfce7;border-radius:999px;padding:1px 7px;vertical-align:middle;">Confirmed</span>`
  }
  if (status === 'proposed') {
    return `<span style="display:inline-block;margin-left:6px;font-size:10px;color:#92400e;background:#fef3c7;border-radius:999px;padding:1px 7px;vertical-align:middle;">Proposed</span>`
  }
  return `<span style="display:inline-block;margin-left:6px;font-size:10px;color:#4b5563;background:#f3f4f6;border-radius:999px;padding:1px 7px;vertical-align:middle;">To be confirmed</span>`
}

function overviewPairsHtml(fields: PacketDisplayField[]): string {
  const rows: string[] = []
  for (let i = 0; i < fields.length; i += 2) {
    const left = fields[i]
    const right = fields[i + 1]
    const cell = (f: PacketDisplayField | undefined) => {
      if (!f) {
        return `<td style="width:50%;padding:10px 12px 10px 0;vertical-align:top;"></td>`
      }
      const status = fieldStatus(f)
      const valueColor = status === 'tbc' ? '#9ca3af' : '#111827'
      return `<td style="width:50%;padding:10px 12px 10px 0;vertical-align:top;">
        <div style="font-size:11px;color:#9ca3af;margin-bottom:3px;">${escapeHtml(f.label)}</div>
        <div style="font-size:14px;font-weight:700;color:${valueColor};line-height:1.35;">
          ${escapeHtml(f.value)}${statusBadge(status)}
        </div>
      </td>`
    }
    rows.push(`<tr>${cell(left)}${cell(right)}</tr>`)
  }
  return rows.join('')
}

function detailsToConfirmHtml(unresolved: string[], fields: PacketDisplayField[]): string {
  const items = [...unresolved]
  for (const f of fields) {
    if (fieldStatus(f) === 'tbc' && ['Brand', 'Entry method', 'Campaign dates'].includes(f.label)) {
      const line =
        f.label === 'Brand'
          ? 'Confirm brand (if distinct from retailer)'
          : f.label === 'Entry method'
            ? 'Confirm entry method / digital channel'
            : 'Confirm promotional dates'
      if (!items.includes(line)) items.push(line)
    }
  }
  const top = items.slice(0, 5)
  if (!top.length) {
    return `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">No critical gaps identified — the promotions team will still review for completeness.</p>`
  }
  return `<ul style="margin:0;padding-left:18px;">${top
    .map((a) => `<li style="font-size:13px;color:#374151;margin-bottom:6px;line-height:1.45;">${escapeHtml(a)}</li>`)
    .join('')}</ul>`
}

function abbrevSectionHtml(
  presentation: PacketPresentation,
  abbrev: AbbrevGenerateResult
): string {
  const header = `
    <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">
      Proposed Abbreviated Terms &amp; Conditions
    </div>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">
      ${escapeHtml(presentation.packetRef)} · Version 1.0
      <span style="display:inline-block;margin-left:8px;font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;border-radius:999px;padding:2px 8px;vertical-align:middle;">DRAFT — SUBJECT TO REVIEW</span>
    </div>`

  if (!abbrev.ok) {
    return `
      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f3f4f6;">
        ${header}
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">
          Draft abbreviated terms and conditions will be prepared once the remaining campaign details are confirmed.
        </p>
      </div>`
  }

  return `
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f3f4f6;">
      ${header}
      <p style="margin:0;font-size:12.5px;line-height:1.7;color:#1f2937;">
        ${escapeHtml(abbrev.text)}
      </p>
    </div>`
}

function brandingHeaderHtml(branding: PartnerEmailBranding, appUrl: string): string {
  const turnstyleSrc = absoluteAssetUrl(branding.turnstyleLogoPath, appUrl)

  if (branding.primaryLogoPath) {
    const partnerSrc = absoluteAssetUrl(branding.primaryLogoPath, appUrl)
    return `
      <div style="background:${branding.headerBg};padding:22px 24px;border-radius:16px 16px 0 0;text-align:center;">
        <img src="${escapeHtml(partnerSrc)}" alt="${escapeHtml(branding.primaryLogoAlt)}" height="${branding.primaryLogoHeight}" style="height:${branding.primaryLogoHeight}px;width:auto;max-width:180px;display:inline-block;border:0;" />
      </div>
      <div style="background:#ffffff;padding:16px 24px 4px;text-align:center;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">${escapeHtml(branding.poweredByLabel)}</div>
        <img src="${escapeHtml(turnstyleSrc)}" alt="${escapeHtml(branding.turnstyleLogoAlt)}" height="${branding.turnstyleLogoHeight}" style="height:${branding.turnstyleLogoHeight}px;width:auto;max-width:160px;display:inline-block;border:0;" />
      </div>`
  }

  return `
    <div style="background:${branding.headerBg};padding:22px 24px;border-radius:16px 16px 0 0;text-align:center;">
      <img src="${escapeHtml(turnstyleSrc)}" alt="${escapeHtml(branding.turnstyleLogoAlt)}" height="26" style="height:26px;width:auto;max-width:180px;display:inline-block;border:0;filter:invert(1);" />
    </div>`
}

export function buildSubmitterPacketEmail(params: {
  presentation: PacketPresentation
  abbrev: AbbrevGenerateResult
  appUrl: string
}): { subject: string; html: string; text: string } {
  const { presentation, abbrev, appUrl } = params
  const branding = resolvePartnerBranding(presentation.partnerId)
  const firstName = firstNameFrom(presentation.submitterName)
  const overview = selectOverviewFields(presentation.fields)

  const subject = `Your Campaign Packet — ${presentation.campaignName}`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Campaign Packet</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your initial Campaign Packet is ready for review.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td>
          ${brandingHeaderHtml(branding, appUrl)}
        </td></tr>
        <tr><td style="padding:28px 28px 8px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Thanks for sharing your promotional idea.</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#374151;">
            We've taken your concept and put together an initial Campaign Packet, outlining how your promotion could work.
          </p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#374151;">
            You'll find a summary below, including the key campaign details, suggested mechanics and a few things we may need to clarify.
          </p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#374151;">
            This is a starting point, not a final campaign plan. Our promotions team will review the details and be in touch about the next steps.
          </p>
          <p style="margin:16px 0 0;font-size:15px;font-weight:700;line-height:1.55;">Your campaign starts here.</p>
        </td></tr>

        <tr><td style="padding:20px 28px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <!-- Campaign Packet card -->
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:22px 22px 18px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;">
              Campaign Packet
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <div style="font-size:22px;font-weight:800;color:#111827;line-height:1.25;">
                    ${escapeHtml(presentation.campaignName)}
                  </div>
                </td>
                <td style="vertical-align:middle;text-align:right;width:72px;">
                  <span style="display:inline-block;font-size:11px;font-weight:600;color:#4b5563;background:#f3f4f6;border-radius:999px;padding:4px 10px;">Draft</span>
                </td>
              </tr>
            </table>
            <div style="font-size:13px;color:#9ca3af;margin:8px 0 16px;">
              ${escapeHtml(presentation.packetRef)} · Version 1.0
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
              ${overviewPairsHtml(overview)}
            </table>

            <div style="margin-top:18px;padding-top:16px;border-top:1px solid #f3f4f6;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#6b7280;margin-bottom:10px;">
                Details to Confirm
              </div>
              ${detailsToConfirmHtml(presentation.unresolved, presentation.fields)}
            </div>

            ${abbrevSectionHtml(presentation, abbrev)}
          </div>

          <div style="margin-top:22px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">
              Next steps
            </div>
            <p style="margin:0;font-size:14px;line-height:1.55;color:#374151;">
              Our promotions team will review this Campaign Packet and contact you about the next steps. No further action is needed from you right now.
            </p>
          </div>
        </td></tr>

        <tr><td style="padding:18px 28px 24px;background:#fafafa;border-top:1px solid #f3f4f6;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;border-radius:0 0 16px 16px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">${escapeHtml(branding.footerLine)}</p>
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
            ${escapeHtml(branding.contactEmail)}
            · Packet ${escapeHtml(presentation.packetRef)}
            · This email is not a quote, permit or approval.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'Thanks for sharing your promotional idea.',
    '',
    "We've taken your concept and put together an initial Campaign Packet, outlining how your promotion could work.",
    '',
    'Your campaign starts here.',
    '',
    `CAMPAIGN PACKET — ${presentation.campaignName}`,
    `${presentation.packetRef} · Version 1.0 · Draft`,
    '',
    ...overview.map((f) => `${f.label}: ${f.value}`),
    '',
    'Details to confirm:',
    ...(presentation.unresolved.slice(0, 5).map((u) => `- ${u}`) || ['- None listed']),
    '',
    abbrev.ok
      ? `Proposed abbreviated T&Cs (DRAFT):\n${abbrev.text}`
      : 'Draft abbreviated terms and conditions will be prepared once the remaining campaign details are confirmed.',
    '',
    'Next steps: Our promotions team will review this Campaign Packet and contact you.',
    '',
    branding.footerLine,
    branding.contactEmail,
  ].join('\n')

  return { subject, html, text }
}

export type { PartnerEmailBranding }

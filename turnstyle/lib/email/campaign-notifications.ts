import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'noreply@status.turnstylehost.com'
const BCC = 'chris@flowmarketing.com.au'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface CampaignEmailData {
  campaignId: string
  campaignName: string
  tsCode: string
  promoterName: string
  promoterEmail: string | null
  promoStart?: string | null
  promoEnd?: string | null
  prizePoolTotal?: number
  shareToken?: string | null
  threadMessageId?: string | null
  permitNSW?: string | null
  permitSA?: string | null
  permitACT?: string | null
}

function formatDate(d: string | null | undefined) {
  if (!d) return 'TBC'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })
}

function threadHeaders(threadMessageId: string | null | undefined): Record<string, string> | undefined {
  if (!threadMessageId) return {}
  return {
    'In-Reply-To': threadMessageId,
    'References': threadMessageId,
  }
}

function baseStyle() {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0a0a0f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <div style="color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">TURNSTYLE</div>
        <div style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 2px;">Campaign Management Platform</div>
      </div>
  `
}

function baseClose(tsCode: string) {
  return `
      <div style="background: #f9fafb; padding: 16px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
        <div style="color: #9ca3af; font-size: 11px;">This is an automated notification from Turnstyle · Flow Marketing · 11 Lomandra Pl, Coolum Beach QLD 4573</div>
        <div style="color: #d1d5db; font-size: 11px; font-family: monospace; margin-top: 4px;">${tsCode}</div>
      </div>
    </div>
  `
}

function button(label: string, href: string, color = '#0a0a0f') {
  return `<a href="${href}" style="display: inline-block; background: ${color}; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">${label} →</a>`
}

// ── 1. DRAFT ─────────────────────────────────────────────────────────────────

export async function sendDraftEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const approveUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Campaign Created</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Hi ${data.promoterName}, your campaign has been created and a quote is ready for your review.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px; font-weight: 700; text-transform: uppercase;">Campaign Summary</div>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #6b7280; padding: 4px 0; width: 140px;">Campaign</td><td style="color: #0a0a0f; font-weight: 600;">${data.campaignName}</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Reference</td><td style="color: #0a0a0f; font-weight: 600; font-family: monospace;">${data.tsCode}</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Start Date</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoStart)}</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">End Date</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoEnd)}</td></tr>
          ${data.prizePoolTotal ? `<tr><td style="color: #6b7280; padding: 4px 0;">Prize Pool</td><td style="color: #0a0a0f; font-weight: 600;">${formatMoney(data.prizePoolTotal)} excl. GST</td></tr>` : ''}
        </table>
      </div>

      <p style="color: #374151; font-size: 14px; line-height: 1.6;">Your quote is ready for review. Once approved, you'll be able to generate your full terms & conditions through our build wizard.</p>
      ${button('Review & Approve Quote', approveUrl)}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Notification`,
    html,
    headers: {},
  })

  return result.data?.id || null
}

// ── 2. CONFIRMED ─────────────────────────────────────────────────────────────

export async function sendConfirmedEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const wizardUrl = `${APP_URL}/dashboard/${data.campaignId}/terms-wizard`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #00C48C; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Project Confirmed ✓</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Great news ${data.promoterName} — your quote has been approved and your project is confirmed. Time to build your terms & conditions.</p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px;">Next Step: Build Your Terms</div>
        <p style="font-size: 14px; color: #166534; margin: 0; line-height: 1.6;">Use our Terms Wizard to generate your full terms & conditions. Choose from thousands of templates and use our AI-driven preflight check to ensure compliance before submission.</p>
      </div>

      ${button('Open Terms Wizard', wizardUrl, '#00C48C')}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Notification`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 3. COMPILED ──────────────────────────────────────────────────────────────

export async function sendCompiledEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const shareUrl = data.shareToken ? `${APP_URL}/review/${data.shareToken}` : `${APP_URL}/dashboard/${data.campaignId}`
  const loaUrl = `${APP_URL}/dashboard/${data.campaignId}/loa`
  const needsPermits = !!(data.permitNSW || data.permitSA || data.permitACT)

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #3B82F6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Terms Compiled</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Your terms have been compiled ${data.promoterName}. Share the link below with any internal or external stakeholders to gather feedback before finalising.</p>

      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 8px; text-transform: uppercase;">Stakeholder Review Link</div>
        <div style="font-family: monospace; font-size: 13px; color: #1e40af; word-break: break-all;">${shareUrl}</div>
      </div>

      ${button('View & Share Terms', shareUrl, '#3B82F6')}

      ${needsPermits ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 8px;">⚠️ Permits Required</div>
        <p style="font-size: 14px; color: #92400e; margin: 0 0 12px; line-height: 1.6;">Your campaign requires state permits. You will need to sign a Letter of Authority (LOA) to authorise Turnstyle to apply for permits on your behalf.</p>
        ${button('Complete LOA', loaUrl, '#F59E0B')}
      </div>
      ` : ''}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Notification`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 4. PENDING ───────────────────────────────────────────────────────────────

export async function sendPendingEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const shareUrl = data.shareToken ? `${APP_URL}/review/${data.shareToken}` : `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #F97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Terms Pending Approval</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Hi ${data.promoterName}, your terms are pending final approval. Share the review link with any remaining stakeholders who need to sign off.</p>

      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #c2410c; margin-bottom: 8px; text-transform: uppercase;">Review Link</div>
        <div style="font-family: monospace; font-size: 13px; color: #c2410c; word-break: break-all;">${shareUrl}</div>
      </div>

      ${button('View Terms', shareUrl, '#F97316')}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Notification`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 5. SCHEDULED ─────────────────────────────────────────────────────────────

export async function sendScheduledEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const dashboardUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #8B5CF6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Campaign Scheduled ✓</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Everything is set ${data.promoterName}. Your campaign is scheduled to start on ${formatDate(data.promoStart)}.</p>

      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #6b7280; padding: 4px 0; width: 140px;">Start Date</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoStart)}</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">End Date</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoEnd)}</td></tr>
          ${data.prizePoolTotal ? `<tr><td style="color: #6b7280; padding: 4px 0;">Prize Pool</td><td style="color: #0a0a0f; font-weight: 600;">${formatMoney(data.prizePoolTotal)} excl. GST</td></tr>` : ''}
        </table>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 4px;">Invoice</div>
        <p style="font-size: 14px; color: #92400e; margin: 0; line-height: 1.6;">An invoice for this campaign will be sent separately. Payment is due within 7 days of receipt.</p>
      </div>

      ${button('View Campaign Dashboard', dashboardUrl, '#8B5CF6')}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Scheduled`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 6. LIVE ──────────────────────────────────────────────────────────────────

export async function sendLiveEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const dashboardUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #00C48C; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🎉 Campaign Live</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Good luck today ${data.promoterName} — your campaign is now live! We hope it's a huge success.</p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #6b7280; padding: 4px 0; width: 140px;">Started</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoStart)}</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Closes</td><td style="color: #0a0a0f; font-weight: 600;">${formatDate(data.promoEnd)}</td></tr>
        </table>
      </div>

      ${button('View Campaign Dashboard', dashboardUrl, '#00C48C')}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Starts Today`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 7. CLOSED ────────────────────────────────────────────────────────────────

export async function sendClosedEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const dashboardUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Campaign Closed</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Hi ${data.promoterName}, your campaign closed on ${formatDate(data.promoEnd)}. The draw is scheduled for ${formatDate(data.promoEnd)} — we'll be in touch shortly with draw results.</p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 4px;">Data Upload</div>
        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.6;">Entry data upload functionality is coming soon. Our team will be in touch to coordinate the draw dataset.</p>
      </div>

      ${button('View Campaign Dashboard', dashboardUrl)}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Now Closed`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 8. DRAWN ─────────────────────────────────────────────────────────────────

export async function sendDrawnEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const dashboardUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #374151; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Winners Drawn</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Hi ${data.promoterName}, the draw for your campaign has been completed. Please review the winners in your dashboard and confirm within 2 business days.</p>

      <div style="background: #fef9c3; border: 1px solid #fef08a; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #854d0e; margin-bottom: 4px;">Action Required</div>
        <p style="font-size: 14px; color: #854d0e; margin: 0; line-height: 1.6;">Please review and confirm the draw results within <strong>2 business days</strong> to allow winner notification to proceed.</p>
      </div>

      ${button('Review Winners', dashboardUrl)}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Winners Drawn`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── 9. ARCHIVED ──────────────────────────────────────────────────────────────

export async function sendArchivedEmail(data: CampaignEmailData) {
  if (!data.promoterEmail) return null

  const dashboardUrl = `${APP_URL}/dashboard/${data.campaignId}`

  const html = `
    ${baseStyle()}
    <div style="padding: 32px;">
      <div style="color: #9ca3af; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Campaign Complete</div>
      <h1 style="font-size: 24px; font-weight: 900; color: #0a0a0f; margin: 0 0 8px;">${data.campaignName}</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Congratulations ${data.promoterName} — your campaign is complete! Draw results are now live. The campaign will be archived in 28 days unless an unclaimed prize exists.</p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 8px;">What's Next?</div>
        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.6;">Thank you for running your promotion with Turnstyle. Our team will be in touch about your next campaign — ask us about referral incentives, instant win promotions, and learn & earn programs.</p>
      </div>

      ${button('View Final Results', dashboardUrl)}
    </div>
    ${baseClose(data.tsCode)}
  `

  const result = await resend.emails.send({
    from: FROM,
    to: data.promoterEmail,
    bcc: BCC,
    subject: `${data.campaignName} Winners Announced`,
    html,
    headers: threadHeaders(data.threadMessageId),
  })

  return result.data?.id || null
}

// ── Master dispatcher ─────────────────────────────────────────────────────────

export async function sendCampaignStatusEmail(
  status: string,
  data: CampaignEmailData
): Promise<string | null> {
  try {
    switch (status) {
      case 'DRAFT':      return await sendDraftEmail(data)
      case 'CONFIRMED':  return await sendConfirmedEmail(data)
      case 'COMPILED':   return await sendCompiledEmail(data)
      case 'PENDING':    return await sendPendingEmail(data)
      case 'SCHEDULED':  return await sendScheduledEmail(data)
      case 'LIVE':       return await sendLiveEmail(data)
      case 'CLOSED':     return await sendClosedEmail(data)
      case 'DRAWN':      return await sendDrawnEmail(data)
      case 'ARCHIVED':   return await sendArchivedEmail(data)
      default:           return null
    }
  } catch (err) {
    console.error(`Failed to send ${status} email:`, err)
    return null
  }
}

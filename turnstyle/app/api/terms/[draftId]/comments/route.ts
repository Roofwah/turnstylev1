import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Send email notifications to relevant parties when a comment is added
async function sendCommentNotifications(
  draftId: string,
  comment: { id: string; authorName: string; clauseSlug: string; body: string },
  commenterEmail: string
) {
  try {
    // Get the draft with campaign and existing commenters
    const termsDraft = (prisma as any).termsDraft
    const draft = await termsDraft.findUnique({
      where: { id: draftId },
      select: {
        id: true,
        shareToken: true,
        version: true,
        campaign: {
          select: {
            name: true,
            createdBy: { select: { email: true, name: true } },
            promoter: { select: { contactEmail: true, contactName: true } },
          },
        },
        comments: {
          where: { status: 'OPEN' },
          select: { authorEmail: true, authorName: true },
        },
      },
    })

    if (!draft) return

    const recipients = new Set<string>()
    const recipientNames = new Map<string, string>()

    // Add campaign creator
    if (draft.campaign?.createdBy?.email) {
      recipients.add(draft.campaign.createdBy.email)
      recipientNames.set(draft.campaign.createdBy.email, draft.campaign.createdBy.name || 'Campaign Creator')
    }

    // Add promoter contact email
    if (draft.campaign?.promoter?.contactEmail) {
      recipients.add(draft.campaign.promoter.contactEmail)
      recipientNames.set(
        draft.campaign.promoter.contactEmail,
        draft.campaign.promoter.contactName || 'Promoter Contact'
      )
    }

    // Add other commenters (but not the person who just commented)
    draft.comments.forEach((c: { authorEmail: string; authorName: string }) => {
      if (c.authorEmail && c.authorEmail !== commenterEmail) {
        recipients.add(c.authorEmail)
        recipientNames.set(c.authorEmail, c.authorName || 'Reviewer')
      }
    })

    // Remove the commenter from recipients
    recipients.delete(commenterEmail)

    if (recipients.size === 0) {
      console.log('No recipients to notify for comment')
      return
    }

    // Send email to each recipient
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/review/${draft.shareToken}`
    const campaignName = draft.campaign?.name || 'Campaign'

    for (const email of recipients) {
      await sendEmail({
        to: email,
        subject: `New comment on ${campaignName} Terms & Conditions`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">New Comment on Terms & Conditions</h2>
            <p><strong>${comment.authorName}</strong> added a comment on the <strong>${comment.clauseSlug}</strong> clause:</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; white-space: pre-wrap;">${comment.body}</p>
            </div>
            <p>
              <a href="${reviewUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                View & Respond
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              Campaign: ${campaignName}<br>
              Terms Draft Version: ${draft.version}
            </p>
          </div>
        `,
        text: `
New Comment on Terms & Conditions

${comment.authorName} added a comment on the ${comment.clauseSlug} clause:

${comment.body}

View & Respond: ${reviewUrl}

Campaign: ${campaignName}
Terms Draft Version: ${draft.version}
        `.trim(),
      })
    }

    console.log(`Sent comment notifications to ${recipients.size} recipients`)
  } catch (error) {
    console.error('Error sending comment notifications:', error)
    throw error
  }
}

// Email sending function - configure with your email service
async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  // TODO: Replace with your email service (Resend, SendGrid, AWS SES, etc.)
  // For now, just log it. In production, use a real email service.
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Email Notification (dev mode):')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('Text:', text)
    return
  }

  // Production email service integration
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'notifications@turnstyle.com',
  //   to,
  //   subject,
  //   html,
  //   text,
  // })

  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail')
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  // await sgMail.send({
  //   to,
  //   from: 'notifications@turnstyle.com',
  //   subject,
  //   html,
  //   text,
  // })

  throw new Error('Email service not configured. Set up Resend, SendGrid, or another email service.')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params
    const body = await req.json()
    const { clauseSlug, authorName, authorEmail, body: commentBody } = body

    if (!clauseSlug || !authorName || !authorEmail || !commentBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const termsComment = (prisma as any).termsComment
    const comment = await termsComment.create({
      data: {
        termsDraftId: draftId,
        clauseSlug,
        authorName,
        authorEmail,
        body: commentBody,
        status: 'OPEN',
      },
    })

    // Send email notifications (non-blocking)
    sendCommentNotifications(draftId, comment, authorEmail).catch(err => {
      console.error('Failed to send comment notifications:', err)
      // Don't fail the request if email fails
    })

    return NextResponse.json(comment)
  } catch (e: any) {
    console.error('POST /api/terms/[draftId]/comments error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    await params // Await params even if not used
    const body = await req.json()
    const termsComment = (prisma as any).termsComment
    const comment = await termsComment.update({
      where: { id: body.commentId },
      data:  { status: 'RESOLVED' },
    })
    return NextResponse.json(comment)
  } catch (e: any) {
    console.error('PATCH /api/terms/[draftId]/comments error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
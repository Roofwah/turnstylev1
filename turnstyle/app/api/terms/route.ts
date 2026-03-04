import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { CampaignStatus } from '@prisma/client'

// Generate a shorter URL-safe token (16 bytes = ~22 chars in base64url)
function generateShareToken(): string {
  return randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '') // Remove padding
}

// POST — save a new terms draft
export async function POST(req: NextRequest) {
  console.log('🚀 POST /api/terms - ROUTE CALLED')
  try {
    const body = await req.json()
    const { campaignId, content, gapAnswers, templateId } = body

    console.log('📥 POST /api/terms - Received:', {
      campaignId,
      contentLength: content?.length,
      templateId,
      hasGapAnswers: !!gapAnswers,
      gapAnswersKeys: gapAnswers ? Object.keys(gapAnswers) : [],
    })

    if (!campaignId || !content || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields', received: { campaignId: !!campaignId, content: !!content, templateId: !!templateId } },
        { status: 400 }
      )
    }

    // Check if campaign exists
    const campaign: any = await (prisma as any).campaign.findUnique({
      where: { id: campaignId },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
        },
        termsDrafts: true,
        promoter: true,
      },
    })
    
    console.log('📊 Campaign data:', {
      campaignId,
      status: campaign?.status,
      quotes: campaign?.quotes?.map((q: any) => ({ id: q.id, status: q.status, quoteNumber: q.quoteNumber })),
      hasApprovedQuote: campaign?.quotes?.some((q: any) => q.status === 'ACCEPTED'),
    })

    if (!campaign) {
      return NextResponse.json({ error: `Campaign with id ${campaignId} not found` }, { status: 404 })
    }

    // Type assertion needed until TypeScript picks up regenerated Prisma client
    const termsDraft = (prisma as any).termsDraft
    
    if (!termsDraft) {
      console.error('termsDraft model is undefined!')
      console.error('Prisma client keys:', Object.keys(prisma))
      return NextResponse.json(
        { error: 'termsDraft model not found in Prisma client. Server may need restart.' },
        { status: 500 }
      )
    }
    
    console.log('termsDraft model found, proceeding with query...')
    
    const latest = await termsDraft.findFirst({
      where:   { campaignId },
      orderBy: { version: 'desc' },
    })

    const version = latest ? latest.version + 1 : 1
    const shareToken = generateShareToken()

    const draft = await termsDraft.create({
      data: {
        campaignId,
        version,
        content,
        gapAnswers: gapAnswers ?? {},
        templateId,
        shareToken,
        status: 'DRAFT', // Using string - Prisma will accept enum value as string
      },
    })

    // ── Lifecycle: auto-upgrade campaign status when full terms are generated ──
    // Only auto-advance CONFIRMED → COMPILED
    // Never block saving terms for campaigns already past CONFIRMED
    const currentStatus = String(campaign.status)
    
    if (currentStatus === 'CONFIRMED' || currentStatus === 'CONFIRMED') {
      try {
        
        
        await prisma.$executeRawUnsafe(
            `UPDATE campaigns SET status = 'COMPILED' WHERE id = $1`,
            campaignId
          )
         
        console.log('Campaign status updated to COMPILED:', { campaignId, from: currentStatus })
      } catch (statusError: any) {
        console.error('Failed to update campaign status to COMPILED:', statusError)
        throw statusError
      }
    } else if (String(currentStatus) === 'DRAFT') {
      // DRAFT means quote not approved — block
      return NextResponse.json(
        { error: 'Quote must be approved before terms can be compiled. Please approve the quote first.' },
        { status: 400 }
      )
    }
    // For COMPILED, REVIEW, PENDING etc — allow saving new draft version without changing status

    // ── Email notification to admin ──
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const reviewUrl = `${origin}/review/${shareToken}`
      const prizePoolTotal = campaign.prizePoolTotal ? Number(campaign.prizePoolTotal).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }) : '$0.00'

      await resend.emails.send({
        from: 'Turnstyle <noreply@flowmarketing.com.au>',
        to: 'chris@flowmarketing.com.au',
        subject: `[ACTION REQUIRED] New Terms Draft — ${campaign.name} v${version}`,
        html: `
          <h2>New Terms Draft Created</h2>
          <p><strong>Campaign:</strong> ${campaign.name}</p>
          <p><strong>Promoter:</strong> ${campaign.promoter?.name || 'N/A'}</p>
          <p><strong>TS Code:</strong> ${campaign.tsCode}</p>
          <p><strong>Template:</strong> ${templateId}</p>
          <p><strong>Version:</strong> ${version}</p>
          <p><strong>Prize Pool:</strong> ${prizePoolTotal}</p>
          <p><a href="${reviewUrl}">Review link: ${reviewUrl}</a></p>
          <p><em>This draft requires your review before the campaign can advance to REVIEW status.</em></p>
        `,
      })
      console.log('Email notification sent to admin')
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Do NOT fail the request if email fails
    }

    // Fetch updated campaign to return current status
    const updatedCampaign = await (prisma as any).campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    })
    
    console.log('POST /api/terms - Success:', { 
      draftId: draft.id, 
      version: draft.version,
      campaignStatus: updatedCampaign?.status,
    })
    
    return NextResponse.json({
      ...draft,
      campaignStatus: updatedCampaign?.status, // Include updated status in response
    })
  } catch (e: any) {
    // Log everything to help debug
    const errorInfo = {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      cause: e?.cause,
      stack: e?.stack,
    }
    console.error('POST /api/terms - FULL ERROR:', JSON.stringify(errorInfo, null, 2))
    
    // Check if termsDraft exists
    console.error('Checking prisma.termsDraft:', typeof (prisma as any).termsDraft)
    console.error('Available Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('_') && typeof (prisma as any)[k] === 'object'))
    
    // Return a safe error response
    try {
      return NextResponse.json(
        { 
          error: String(e?.message || 'Internal server error'),
          details: String(e?.code || 'UNKNOWN_ERROR'),
          name: String(e?.name || 'Error'),
        },
        { status: 500 }
      )
    } catch (jsonError) {
      // If JSON serialization fails, return plain text
      return new Response(
        `Error: ${String(e?.message || 'Internal server error')}`,
        { status: 500, headers: { 'Content-Type': 'text/plain' } }
      )
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    const termsDraft = (prisma as any).termsDraft
    const drafts = await termsDraft.findMany({
      where:   { campaignId },
      orderBy: { version: 'desc' },
      include: {
        comments:  { where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } },
        approvals: { orderBy: { respondedAt: 'desc' } },
      },
    })

    return NextResponse.json(drafts)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
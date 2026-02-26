import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const body = await req.json()
    const { clauseSlug, authorName, authorEmail, body: commentBody } = body

    if (!clauseSlug || !authorName || !authorEmail || !commentBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const comment = await prisma.termsComment.create({
      data: {
        termsDraftId: params.draftId,
        clauseSlug,
        authorName,
        authorEmail,
        body: commentBody,
        status: 'OPEN',
      },
    })

    return NextResponse.json(comment)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const body = await req.json()
    const comment = await prisma.termsComment.update({
      where: { id: body.commentId },
      data:  { status: 'RESOLVED' },
    })
    return NextResponse.json(comment)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
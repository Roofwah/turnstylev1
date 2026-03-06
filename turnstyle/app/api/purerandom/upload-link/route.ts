import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { drawId } = await req.json()
  const res = await fetch(`${process.env.PURERANDOM_URL}/api/upload_link/${drawId}`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.PURERANDOM_ADMIN_KEY || '' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}

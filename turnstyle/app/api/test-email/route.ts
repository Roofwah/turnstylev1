import { Resend } from 'resend'
import { NextResponse } from 'next/server'

export async function GET() {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const result = await resend.emails.send({
    from: 'noreply@status.turnstylehost.com',
    to: 'chris@flowmarketing.com.au',
    subject: 'Turnstyle Test Email',
    html: '<p>Test email from Turnstyle</p>',
  })
  return NextResponse.json(result)
}

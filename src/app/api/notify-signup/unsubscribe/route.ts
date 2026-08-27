import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeEmail, verifyUnsubscribeToken } from '@/lib/verifier-notifications'

function page(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Trustact</title></head>
<body style="background:#0a0710;color:#e5e5e5;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
  <p style="max-width:28rem;text-align:center;padding:0 1.5rem;">${message}</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

/**
 * GET /api/notify-signup/unsubscribe?email=...&token=...
 *
 * Reached by clicking the unsubscribe link in a notification email. GET
 * (not POST) so it works as a plain link with no JS — token is a signed
 * HMAC so it can't be used to unsubscribe someone else's address.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''
  const token = req.nextUrl.searchParams.get('token') ?? ''

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return page('This unsubscribe link is invalid or expired.')
  }

  await unsubscribeEmail(email)
  return page(`${email} won't receive any more Trustact notifications.`)
}

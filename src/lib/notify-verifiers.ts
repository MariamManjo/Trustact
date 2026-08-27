import { Resend } from 'resend'
import { listSubscribedEmails, signUnsubscribeToken } from './verifier-notifications'

const BATCH_SIZE = 100

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trustact.manjom.works'
}

function getFromAddress(): string {
  const domain = process.env.RESEND_EMAIL_DOMAIN ?? 'mail.manjom.works'
  return `Trustact <notify@${domain}>`
}

function buildEmailHtml(question: string, roundId: string, unsubscribeUrl: string): string {
  const verifyUrl = `${getSiteUrl()}/verify`
  return `<!doctype html><html><body style="background:#0a0710;color:#e5e5e5;font-family:system-ui,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#a78bfa;margin:0 0 8px;">New question open</p>
    <h1 style="font-size:20px;line-height:1.4;margin:0 0 16px;">${question}</h1>
    <p style="font-size:14px;color:#a3a3a3;margin:0 0 24px;">
      A real human is needed to verify this before an AI agent spends real money on it.
      Answer in under a minute, get paid in SOL if you're right.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(to right,#8b5cf6,#d946ef);color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:14px;">
      Answer now
    </a>
    <p style="font-size:11px;color:#525252;margin-top:40px;">
      Round ${roundId} · <a href="${unsubscribeUrl}" style="color:#525252;">Unsubscribe</a>
    </p>
  </div>
</body></html>`
}

/**
 * Emails everyone opted in that a new round needs a human. Fire-and-forget
 * from the caller's perspective — a notification failure must never block
 * or fail round creation, so this never throws.
 */
export async function notifyNewRound(round: { id: string; question: string }): Promise<void> {
  try {
    const resend = getResend()
    if (!resend) return // Resend not configured (e.g. local dev without env) — skip quietly.

    const emails = await listSubscribedEmails()
    if (emails.length === 0) return

    const messages = emails.map((email) => {
      const token = signUnsubscribeToken(email)
      const unsubscribeUrl = `${getSiteUrl()}/api/notify-signup/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
      return {
        from: getFromAddress(),
        to: [email],
        subject: 'A new question needs a real human — Trustact',
        html: buildEmailHtml(round.question, round.id, unsubscribeUrl),
      }
    })

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const chunk = messages.slice(i, i + BATCH_SIZE)
      const { error } = await resend.batch.send(chunk, {
        idempotencyKey: `round-open/${round.id}/chunk-${i / BATCH_SIZE}`,
      })
      if (error) {
        console.error('notifyNewRound batch send error:', error)
      }
    }
  } catch (err) {
    console.error('notifyNewRound failed:', err)
  }
}

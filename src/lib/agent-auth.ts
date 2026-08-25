import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Guards the public agent-facing API. Callers must send:
 *   Authorization: Bearer <AGENT_API_KEY>
 *
 * Returns a 401 response to short-circuit the caller, or null if the request
 * is authorized and the route should proceed.
 */
export function requireAgentApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.AGENT_API_KEY

  if (!expected) {
    // Fail closed — an unconfigured key means the API is not safe to expose.
    return NextResponse.json({ error: 'API is not configured.' }, { status: 503 })
  }

  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { error: 'Unauthorized. Send "Authorization: Bearer <API key>".' },
      { status: 401 }
    )
  }

  return null
}

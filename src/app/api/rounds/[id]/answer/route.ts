import { NextRequest, NextResponse } from 'next/server'
import { submitAnswer } from '@/lib/verification-rounds'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to submit answer.'
}

/**
 * POST /api/rounds/[id]/answer
 * body: { verifierWallet: string, answer: 'yes' | 'no', note?: string }
 *
 * Photo/location proof ships in a later phase — this accepts JSON only for
 * now, since proofRequirements is forced off at round creation.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const verifierWallet = typeof body?.verifierWallet === 'string' ? body.verifierWallet : undefined
    const answer = body?.answer === 'yes' || body?.answer === 'no' ? body.answer : undefined
    const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : undefined

    if (!verifierWallet) {
      return NextResponse.json({ error: 'verifierWallet is required.' }, { status: 400 })
    }
    if (!answer) {
      return NextResponse.json({ error: 'answer must be "yes" or "no".' }, { status: 400 })
    }

    const round = await submitAnswer(id, { verifierWallet, answer, note })
    return NextResponse.json(round)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 })
  }
}

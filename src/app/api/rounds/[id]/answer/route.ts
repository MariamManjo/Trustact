import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { submitAnswer, type AnswerLocation } from '@/lib/verification-rounds'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to submit answer.'
}

function buildMapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * POST /api/rounds/[id]/answer
 * multipart/form-data: verifierWallet, answer ('yes'|'no'), note?, photo? (File), lat?, lng?
 *
 * Photo (if present) is uploaded to Vercel Blob; location (if present)
 * becomes a plain Google Maps link — no map-embed API key needed, and a
 * judge card only ever needs to show one pin at a time.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const form = await req.formData()
    const verifierWallet = form.get('verifierWallet')
    const answer = form.get('answer')
    const note = form.get('note')
    const photo = form.get('photo')
    const lat = form.get('lat')
    const lng = form.get('lng')

    if (typeof verifierWallet !== 'string' || !verifierWallet) {
      return NextResponse.json({ error: 'verifierWallet is required.' }, { status: 400 })
    }
    if (answer !== 'yes' && answer !== 'no') {
      return NextResponse.json({ error: 'answer must be "yes" or "no".' }, { status: 400 })
    }

    let photoUrl: string | undefined
    if (photo instanceof File && photo.size > 0) {
      const blob = await put(`rounds/${id}/${crypto.randomUUID()}-${photo.name}`, photo, {
        access: 'public',
        addRandomSuffix: false,
      })
      photoUrl = blob.url
    }

    let location: AnswerLocation | undefined
    if (typeof lat === 'string' && typeof lng === 'string' && lat && lng) {
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        location = { lat: latNum, lng: lngNum, mapUrl: buildMapUrl(latNum, lngNum) }
      }
    }

    const round = await submitAnswer(id, {
      verifierWallet,
      answer,
      note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : undefined,
      photoUrl,
      location,
    })

    return NextResponse.json(round)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 })
  }
}

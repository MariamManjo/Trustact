'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CaptureStage = 'idle' | 'starting' | 'streaming' | 'captured' | 'error'

interface CameraCaptureProps {
  onCapture: (file: File | null) => void
}

/**
 * Live camera capture only — no "choose from library". A plain file input's
 * capture="environment" hint is mobile-only and still lets users pick a
 * saved photo on most browsers (and does nothing at all on desktop), which
 * defeats the point of photo proof. This grabs a real live frame via
 * getUserMedia so what's submitted was taken right now, not pulled from
 * storage.
 */
export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const [stage, setStage] = useState<CaptureStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stopStream, [])

  // The <video> element only exists once stage flips to 'streaming' (it's
  // conditionally rendered below), so attaching the stream inside
  // startCamera() — before that flip has re-rendered — always hit a null
  // ref and silently no-op'd, leaving the feed black even though the
  // permission grant and stream itself were fine. Attaching it here, after
  // the element has actually mounted, is what makes it show.
  useEffect(() => {
    if (stage !== 'streaming' || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {})
  }, [stage])

  async function startCamera() {
    setError(null)
    setStage('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setStage('streaming')
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const message =
        name === 'NotAllowedError'
          ? 'Camera access is blocked. Enable it via the aA icon in the address bar → Website Settings → Camera, then try again.'
          : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : name === 'NotReadableError'
              ? 'Camera is already in use by another app.'
              : 'Could not access your camera. Check permissions and try again.'
      setError(message)
      setStage('error')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    setAspectRatio(video.videoWidth / video.videoHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `verification-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setPreviewUrl(URL.createObjectURL(blob))
        onCapture(file)
        stopStream()
        setStage('captured')
      },
      'image/jpeg',
      0.9
    )
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onCapture(null)
    startCamera()
  }

  if (stage === 'captured' && previewUrl) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- object URL from a live capture, not an optimizable remote asset */}
        <img
          src={previewUrl}
          alt="Captured proof"
          style={{ aspectRatio: aspectRatio ?? 4 / 3 }}
          className="max-h-96 w-full rounded-lg bg-black object-cover"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={retake}
          className="h-8 w-full gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
        >
          <RotateCcw className="h-3 w-3" />
          Retake
        </Button>
      </div>
    )
  }

  if (stage === 'streaming') {
    return (
      <div className="space-y-2">
        <video
          ref={videoRef}
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setAspectRatio(v.videoWidth / v.videoHeight)
          }}
          style={{ aspectRatio: aspectRatio ?? 4 / 3 }}
          className="max-h-96 w-full rounded-lg bg-black object-cover"
        />
        <Button
          type="button"
          size="sm"
          onClick={capture}
          className="h-9 w-full gap-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-xs font-medium text-white hover:from-violet-400 hover:to-fuchsia-400"
        >
          <Check className="h-3.5 w-3.5" />
          Capture photo
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={stage === 'starting'}
        onClick={startCamera}
        className="h-9 w-full gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
      >
        <Camera className="h-3.5 w-3.5" />
        {stage === 'starting' ? 'Opening camera…' : 'Open camera'}
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

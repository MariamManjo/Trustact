'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

interface LocationMapProps {
  lat: number
  lng: number
  className?: string
}

/**
 * Small embedded OpenStreetMap preview marking the exact captured
 * coordinates — no API key needed. Makes location "proof" a real visual
 * instead of a text button that just says it was shared.
 *
 * No `marker` param on the OSM embed — OSM's own red pin is dropped in
 * favor of the Trustact mascot standing on the spot, since the bbox below
 * is always centered on `lat, lng`, the exact middle of the rendered map is
 * the point being proven. The character overlay is anchored by its feet
 * (not its center) so it reads as "standing here," not "hovering over here."
 */
export function LocationMap({ lat, lng, className = 'h-64' }: LocationMapProps) {
  const reduceMotion = useReducedMotion()
  // OSM's embed fits the bbox to the iframe's own aspect ratio, so a short,
  // wide container forces it to zoom out until the box's height fits —
  // making the map look zoomed way out even for a tiny bbox. Keeping this
  // container closer to square (h-64) and the box tight (~250m) keeps the
  // spot at a street-level zoom instead.
  const latDelta = 0.0018
  const lngDelta = 0.0022
  const bbox = `${lng - lngDelta}%2C${lat - latDelta}%2C${lng + lngDelta}%2C${lat + latDelta}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`

  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-black/20 ${className}`}>
      <iframe
        src={src}
        title="Location proof"
        className="h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <motion.div
          className="relative h-[5.5rem] w-14"
          animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Image
            src="/hero/walking.png"
            alt="Verifier's location"
            fill
            sizes="56px"
            className="object-contain object-bottom drop-shadow-[0_6px_8px_rgba(0,0,0,0.6)]"
            priority
          />
        </motion.div>
        <span className="relative -mt-1.5 flex h-2.5 w-2.5 items-center justify-center">
          <span className="absolute h-full w-full animate-ping rounded-full bg-violet-400/70" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-violet-400 ring-2 ring-black/40" />
        </span>
      </div>
    </div>
  )
}

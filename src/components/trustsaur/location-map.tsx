'use client'

interface LocationMapProps {
  lat: number
  lng: number
  className?: string
}

/**
 * Small embedded OpenStreetMap preview with a pin at the exact captured
 * coordinates — no API key needed. Makes location "proof" a real visual
 * instead of a text button that just says it was shared.
 */
export function LocationMap({ lat, lng, className = 'h-36' }: LocationMapProps) {
  const delta = 0.005
  const bbox = `${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat}%2C${lng}`

  return (
    <div className={`overflow-hidden rounded-lg border border-white/10 bg-black/20 ${className}`}>
      <iframe
        src={src}
        title="Location proof"
        className="h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

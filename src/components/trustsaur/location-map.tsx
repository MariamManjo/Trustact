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
export function LocationMap({ lat, lng, className = 'h-64' }: LocationMapProps) {
  // OSM's embed fits the bbox to the iframe's own aspect ratio, so a short,
  // wide container forces it to zoom out until the box's height fits —
  // making the map look zoomed way out even for a tiny bbox. Keeping this
  // container closer to square (h-64) and the box tight (~250m) keeps the
  // pin at a street-level zoom instead.
  const latDelta = 0.0018
  const lngDelta = 0.0022
  const bbox = `${lng - lngDelta}%2C${lat - latDelta}%2C${lng + lngDelta}%2C${lat + latDelta}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`

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

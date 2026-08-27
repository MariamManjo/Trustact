import Image from 'next/image'

interface BrandMarkProps {
  iconClassName?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}

// Wordmark art is 1784x458 (~3.9:1) — wordmarkClassName sets the height,
// width tracks it automatically via the image's own aspect ratio.
export function BrandMark({
  iconClassName = 'h-8 w-8',
  wordmarkClassName = 'h-5',
  showWordmark = true,
}: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/mascot.png"
        alt=""
        width={40}
        height={40}
        className={`${iconClassName} shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(139,92,246,0.45)]`}
        priority
      />
      {showWordmark && (
        <Image
          src="/brand-wordmark.png"
          alt="Trust"
          width={1784}
          height={458}
          className={`${wordmarkClassName} w-auto object-contain`}
          priority
        />
      )}
    </span>
  )
}

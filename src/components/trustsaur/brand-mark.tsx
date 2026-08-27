import Image from 'next/image'

interface BrandMarkProps {
  iconClassName?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}

export function BrandMark({
  iconClassName = 'h-8 w-8',
  wordmarkClassName = 'text-xl',
  showWordmark = true,
}: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/mascot.png"
        alt="Trustact"
        width={40}
        height={40}
        className={`${iconClassName} shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(139,92,246,0.45)]`}
        priority
      />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName}`}>
          <span className="text-white">Trust</span>
          <span className="text-violet-400">act</span>
        </span>
      )}
    </span>
  )
}

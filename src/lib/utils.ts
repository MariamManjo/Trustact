import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
  const strLen = str.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str
}

/** "3m left" / "5h left" / "2d left" for a round's closesAt timestamp. */
export function formatTimeRemaining(closesAt: number): string {
  const ms = closesAt - Date.now()
  if (ms <= 0) return 'closing…'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h left`
  const days = Math.round(hours / 24)
  return `${days}d left`
}

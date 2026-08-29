import { Redis } from '@upstash/redis'

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * Fixed-window rate limit backed by Redis, scoped to whatever `key` the
 * caller passes (e.g. a route name + IP). Fails open (never blocks) when
 * Redis isn't configured — matches this app's existing Redis-optional
 * local-dev fallback elsewhere, since there's no shared counter to fall
 * back to locally anyway.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis()
  if (!redis) return { allowed: true, remaining: limit }

  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, windowSeconds)
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}

/** Best-effort caller IP from Vercel's forwarding headers — good enough to scope a rate limit, not for auth. */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

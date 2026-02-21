/**
 * Generic sliding-window rate limiter for API route handlers.
 *
 * Keyed by `userId:endpoint` so limits are per-user per-route.
 * Stored in process memory — resets on server restart (acceptable for
 * single-instance / Vercel serverless where cold starts naturally reset state).
 *
 * Usage:
 *   const { allowed, retryAfterMs } = apiRateLimit(userId, 'gate:check-in', 10, 60_000)
 *   if (!allowed) return NextResponse.json({ error: ... }, { status: 429 })
 */

interface RateLimitConfig {
  /** Maximum requests allowed within windowMs */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

const store = new Map<string, number[]>()

export function apiRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const key = `${userId}:${endpoint}`
  const now = Date.now()
  const timestamps = store.get(key) ?? []

  // Slide the window — drop entries older than windowMs
  const recent = timestamps.filter((t) => now - t < windowMs)

  if (recent.length >= maxRequests) {
    const oldest = recent[0]
    const retryAfterMs = windowMs - (now - oldest)
    store.set(key, recent)
    return { allowed: false, retryAfterMs }
  }

  recent.push(now)
  store.set(key, recent)
  return { allowed: true }
}

/** Pre-configured limits for each sensitive endpoint category. */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  /** Gate ops: max 30 scans/check-ins per minute per user */
  'gate': { maxRequests: 30, windowMs: 60_000 },
  /** Booking creation: max 10 bookings per minute per user */
  'bookings:create': { maxRequests: 10, windowMs: 60_000 },
  /** Safety mutations (stop-work, incidents): max 20 per minute */
  'safety': { maxRequests: 20, windowMs: 60_000 },
  /** Document uploads: max 15 per minute */
  'documents:upload': { maxRequests: 15, windowMs: 60_000 },
  /** AI endpoints: max 20 per minute per user */
  'ai': { maxRequests: 20, windowMs: 60_000 },
}

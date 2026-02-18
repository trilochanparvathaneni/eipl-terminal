const RATE_LIMIT_RPM = parseInt(process.env.CHAT_RATE_LIMIT_RPM || "30", 10)
const WINDOW_MS = 60_000

const requestTimestamps = new Map<string, number[]>()

export function checkChatRateLimit(userId: string): {
  allowed: boolean
  retryAfterMs?: number
} {
  const now = Date.now()
  const timestamps = requestTimestamps.get(userId) || []

  // Remove timestamps outside the window
  const recent = timestamps.filter((t) => now - t < WINDOW_MS)

  if (recent.length >= RATE_LIMIT_RPM) {
    const oldest = recent[0]
    const retryAfterMs = WINDOW_MS - (now - oldest)
    requestTimestamps.set(userId, recent)
    return { allowed: false, retryAfterMs }
  }

  recent.push(now)
  requestTimestamps.set(userId, recent)
  return { allowed: true }
}

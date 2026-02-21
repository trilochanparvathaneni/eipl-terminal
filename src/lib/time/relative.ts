export function formatRelativeTime(iso: string, now = new Date()): string {
  const target = new Date(iso)
  const diffMs = now.getTime() - target.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))

  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days <= 7) return `${days}d ago`

  return target.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

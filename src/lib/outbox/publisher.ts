import { insertOutboxEvent, findPendingEvents, markEventStatus } from "./outboxRepo"
import { getConnector } from "@/integrations"
import type { EnqueueParams } from "./types"

/**
 * Enqueue a domain event into the transactional outbox.
 *
 * Call this inside your route handler right after the domain write.
 * The event is persisted locally first (PENDING), then a best-effort
 * immediate flush is attempted.  If the flush fails the background
 * poller will retry later.
 */
export async function enqueueEvent(params: EnqueueParams): Promise<string> {
  const event = await insertOutboxEvent(params)

  // Best-effort immediate delivery (non-blocking)
  flushOne(event.id).catch(() => {
    // Swallow — the poller will pick it up
  })

  return event.id
}

/**
 * Try to deliver a single outbox event via the registered connector.
 */
async function flushOne(eventId: string): Promise<void> {
  const pending = await findPendingEvents(1)
  const event = pending.find((e) => e.id === eventId)
  if (!event) return

  // For now we try the sample-erp connector.
  // In production you'd look up which connector(s) are configured for
  // this tenant + event type.
  const connector = getConnector("sample-erp")
  if (!connector) {
    console.warn("[outbox] No connector configured, skipping delivery.")
    return
  }

  try {
    await connector.pushEvent(
      { baseUrl: process.env.ERP_BASE_URL ?? "https://erp.example.com" },
      event.eventType,
      event.payload
    )
    await markEventStatus(eventId, "SENT")
  } catch {
    await markEventStatus(eventId, "FAILED")
  }
}

/**
 * Background poller — call on a cron or setInterval.
 *
 * Picks up all PENDING events and attempts delivery.
 * In production, run this as a separate worker process or a
 * Next.js cron route (vercel.json crons / node-cron).
 */
export async function flushPendingEvents(): Promise<number> {
  const events = await findPendingEvents(50)
  let sent = 0
  for (const event of events) {
    try {
      await flushOne(event.id)
      sent++
    } catch {
      // continue with next event
    }
  }
  return sent
}

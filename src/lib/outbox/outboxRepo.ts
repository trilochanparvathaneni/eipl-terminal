import { randomUUID } from "crypto"
import type { OutboxEvent, EnqueueParams, OutboxStatus } from "./types"

/**
 * Outbox repository.
 *
 * Currently uses an in-memory store.  In production this would be a
 * Prisma model / raw SQL table so events are written in the same
 * transaction as the domain write.
 *
 * TODO: Replace with `prisma.outboxEvent.create(...)` backed by a
 * real `outbox_events` table.
 */

const store: OutboxEvent[] = []

export async function insertOutboxEvent(params: EnqueueParams): Promise<OutboxEvent> {
  const event: OutboxEvent = {
    id: randomUUID(),
    eventType: params.eventType,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    tenantSlug: params.tenantSlug,
    payload: params.payload,
    status: "PENDING",
    attempts: 0,
    createdAt: new Date(),
  }
  store.push(event)
  return event
}

export async function findPendingEvents(limit = 50): Promise<OutboxEvent[]> {
  return store.filter((e) => e.status === "PENDING").slice(0, limit)
}

export async function markEventStatus(
  id: string,
  status: OutboxStatus
): Promise<void> {
  const event = store.find((e) => e.id === id)
  if (!event) return
  event.status = status
  event.attempts += 1
  if (status === "SENT") event.sentAt = new Date()
}

/** Dev-only: return all events for inspection */
export async function listAllEvents(): Promise<OutboxEvent[]> {
  return [...store]
}

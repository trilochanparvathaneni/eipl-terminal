/**
 * Transactional outbox types.
 *
 * The outbox pattern ensures that domain events are reliably published
 * even if the message broker is temporarily unavailable.  Events are
 * first written to a local "outbox" table inside the same DB transaction
 * as the domain write.  A background poller then picks up un-sent rows
 * and pushes them to the broker / connector.
 */

export type OutboxStatus = "PENDING" | "SENT" | "FAILED"

export interface OutboxEvent {
  id: string
  /** e.g. "appointment.created", "trip.completed" */
  eventType: string
  /** The domain aggregate type (e.g. "booking", "truckTrip") */
  aggregateType: string
  /** The domain aggregate ID */
  aggregateId: string
  /** Tenant this event belongs to */
  tenantSlug: string
  /** Serialisable payload */
  payload: Record<string, unknown>
  status: OutboxStatus
  /** Number of delivery attempts */
  attempts: number
  createdAt: Date
  sentAt?: Date
}

export interface EnqueueParams {
  eventType: string
  aggregateType: string
  aggregateId: string
  tenantSlug: string
  payload: Record<string, unknown>
}

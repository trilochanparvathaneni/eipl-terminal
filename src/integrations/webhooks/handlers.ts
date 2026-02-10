import type { InboundWebhookEvent } from "../types"

/**
 * Webhook event handler registry.
 *
 * Each handler processes a specific inbound event type.  In production
 * you'd wire these to domain services (e.g. update a booking status
 * when the ERP confirms a dispatch).
 */

type WebhookHandler = (event: InboundWebhookEvent) => Promise<void>

const handlers = new Map<string, WebhookHandler>()

export function registerHandler(eventType: string, handler: WebhookHandler) {
  handlers.set(eventType, handler)
}

export async function dispatchWebhookEvent(event: InboundWebhookEvent): Promise<boolean> {
  const handler = handlers.get(event.eventType)
  if (!handler) {
    console.warn(`[webhooks] No handler for event type: ${event.eventType}`)
    return false
  }
  await handler(event)
  return true
}

// ── Sample handlers ─────────────────────────────────────────────────────────

registerHandler("order.shipped", async (event) => {
  // TODO: Look up the booking by external ref and update status
  console.log("[webhooks] Handling order.shipped:", event.payload)
})

registerHandler("appointment.confirmed", async (event) => {
  // TODO: Update booking status to OPS_SCHEDULED
  console.log("[webhooks] Handling appointment.confirmed:", event.payload)
})

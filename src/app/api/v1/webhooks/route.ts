import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature } from "@/integrations/webhooks/verify"
import { dispatchWebhookEvent } from "@/integrations/webhooks/handlers"
import { insertOutboxEvent } from "@/lib/outbox/outboxRepo"
import { TENANT_HEADER, DEFAULT_TENANT_SLUG } from "@/lib/tenant/types"
import { randomUUID } from "crypto"

/**
 * POST /api/v1/webhooks
 *
 * Receives inbound webhook events from external systems.
 * Flow:
 *   1. Verify HMAC signature
 *   2. Write to outbox (durable receipt)
 *   3. Dispatch to registered handler
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const tenantSlug = request.headers.get(TENANT_HEADER) ?? DEFAULT_TENANT_SLUG
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      {
        error: {
          code: "WEBHOOK_SECRET_NOT_CONFIGURED",
          message: "Webhook secret is not configured.",
          requestId,
        },
      },
      { status: 500 }
    )
  }

  // Read raw body for signature verification
  const rawBody = await request.text()
  const signature = request.headers.get("x-webhook-signature")

  const verification = verifyWebhookSignature(rawBody, signature, webhookSecret)
  if (!verification.valid) {
    return NextResponse.json(
      {
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: verification.reason ?? "Signature verification failed.",
          requestId,
        },
      },
      { status: 401 }
    )
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body is not valid JSON.",
          requestId,
        },
      },
      { status: 400 }
    )
  }

  const eventType = (body.eventType as string) ?? "unknown"

  // Write to outbox for durability
  const outboxEvent = await insertOutboxEvent({
    eventType,
    aggregateType: (body.aggregateType as string) ?? "external",
    aggregateId: (body.aggregateId as string) ?? requestId,
    tenantSlug,
    payload: body,
  })

  // Dispatch to handler (best-effort, non-blocking)
  const handled = await dispatchWebhookEvent({
    eventType,
    payload: body,
    timestamp: body.timestamp as string | undefined,
  })

  return NextResponse.json({
    requestId,
    outboxEventId: outboxEvent.id,
    handled,
  })
}

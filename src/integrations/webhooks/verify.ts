import { createHmac, timingSafeEqual } from "crypto"
import type { WebhookVerificationResult } from "../types"

/**
 * Verify an inbound webhook signature using HMAC-SHA256.
 *
 * Expected header format:  `sha256=<hex digest>`
 * The secret is per-tenant and should be stored alongside the tenant config.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  secret: string
): WebhookVerificationResult {
  if (!signatureHeader) {
    return { valid: false, reason: "Missing signature header." }
  }

  const [algo, receivedHex] = signatureHeader.split("=")
  if (algo !== "sha256" || !receivedHex) {
    return { valid: false, reason: "Unsupported signature format. Expected sha256=<hex>." }
  }

  const expected = createHmac("sha256", secret)
    .update(typeof rawBody === "string" ? rawBody : rawBody)
    .digest("hex")

  const a = Buffer.from(receivedHex, "hex")
  const b = Buffer.from(expected, "hex")

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "Signature mismatch." }
  }

  return { valid: true }
}

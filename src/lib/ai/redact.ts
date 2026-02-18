/**
 * PII redaction utilities for audit logging and response sanitization.
 */

/** Redact Aadhaar (12 digits) → XXXX-XXXX-{last4} */
function redactAadhaar(text: string): string {
  return text.replace(/\b(\d{4})\s*(\d{4})\s*(\d{4})\b/g, (_, _a, _b, last) => `XXXX-XXXX-${last}`)
}

/** Redact PAN (ABCDE1234F) → XXXXX{1234}X */
function redactPAN(text: string): string {
  return text.replace(/\b([A-Z]{5})(\d{4})([A-Z])\b/g, (_, _a, digits, _c) => `XXXXX${digits}X`)
}

/** Redact bank account numbers (8-18 digits) → ****{last4} */
function redactBankAccount(text: string): string {
  return text.replace(/\b(\d{8,18})\b/g, (match) => `****${match.slice(-4)}`)
}

/**
 * Redact known PII patterns from a string.
 */
export function redactPII(text: string): string {
  let result = text
  result = redactAadhaar(result)
  result = redactPAN(result)
  result = redactBankAccount(result)
  return result
}

/**
 * Deep-clone an object and redact all string values.
 */
export function redactParams(params: unknown): unknown {
  if (typeof params === "string") return redactPII(params)
  if (params === null || params === undefined) return params
  if (Array.isArray(params)) return params.map(redactParams)
  if (typeof params === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      result[key] = redactParams(value)
    }
    return result
  }
  return params
}

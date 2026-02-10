/**
 * Integration framework types.
 *
 * A "connector" is an adapter to an external system (ERP, TMS, WMS, etc.).
 * Each connector implements a standard lifecycle so the platform can
 * register, configure, and invoke them uniformly.
 */

export interface ConnectorMeta {
  /** Unique identifier (e.g. "sample-erp") */
  id: string
  /** Human-readable name */
  name: string
  /** Semver */
  version: string
  /** Short description */
  description: string
}

export interface ConnectorConfig {
  /** Base URL of the external system */
  baseUrl: string
  /** API key or token */
  apiKey?: string
  /** Any extra config the connector needs */
  extra?: Record<string, unknown>
}

export interface Connector {
  meta: ConnectorMeta

  /**
   * Verify we can reach the external system.
   * Returns true if healthy, throws on failure.
   */
  healthCheck(config: ConnectorConfig): Promise<boolean>

  /**
   * Push an event to the external system.
   * Returns a receipt / external reference ID.
   */
  pushEvent(
    config: ConnectorConfig,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ externalRef: string }>
}

// ── Webhook types ───────────────────────────────────────────────────────────

export interface InboundWebhookEvent {
  /** Event type sent by the external system (e.g. "order.shipped") */
  eventType: string
  /** Raw payload */
  payload: Record<string, unknown>
  /** ISO-8601 timestamp from the sender */
  timestamp?: string
}

export interface WebhookVerificationResult {
  valid: boolean
  reason?: string
}

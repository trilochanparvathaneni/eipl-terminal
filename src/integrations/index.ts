/**
 * Integration registry.
 *
 * Import all connectors here.  Downstream code uses `getConnector(id)`
 * rather than importing individual connector modules.
 */

import type { Connector } from "./types"
import sampleErpConnector from "./connectors/sample-erp"

const registry = new Map<string, Connector>()

function register(connector: Connector) {
  registry.set(connector.meta.id, connector)
}

// ── Register built-in connectors ────────────────────────────────────────────
register(sampleErpConnector)

// ── Public API ──────────────────────────────────────────────────────────────

export function getConnector(id: string): Connector | undefined {
  return registry.get(id)
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values())
}

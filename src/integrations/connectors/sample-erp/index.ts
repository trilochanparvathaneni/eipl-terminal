import type { Connector, ConnectorConfig, ConnectorMeta } from "@/integrations/types"

const meta: ConnectorMeta = {
  id: "sample-erp",
  name: "Sample ERP Connector",
  version: "0.1.0",
  description:
    "Example connector that demonstrates the integration interface. " +
    "Replace with a real ERP adapter (SAP, Oracle, Tally, etc.).",
}

/**
 * Sample ERP connector.
 *
 * In production, `pushEvent` would POST to the ERP's webhook/API endpoint.
 * For now it logs the call and returns a deterministic receipt.
 */
const sampleErpConnector: Connector = {
  meta,

  async healthCheck(config: ConnectorConfig): Promise<boolean> {
    // TODO: Replace with actual HTTP ping to config.baseUrl + "/health"
    if (!config.baseUrl) throw new Error("baseUrl is required")
    console.log(`[sample-erp] healthCheck → ${config.baseUrl}`)
    return true
  },

  async pushEvent(
    config: ConnectorConfig,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ externalRef: string }> {
    // TODO: Replace with real HTTP POST
    const ref = `erp-${Date.now().toString(36)}`
    console.log(
      `[sample-erp] pushEvent type=${eventType} ref=${ref}`,
      JSON.stringify(payload).slice(0, 200)
    )
    return { externalRef: ref }
  },
}

export default sampleErpConnector

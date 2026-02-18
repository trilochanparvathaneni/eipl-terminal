import type { CopilotMessage } from "./response-builder"

interface StubToolSchema {
  description: string
  proposedEndpoint: string
  method: string
  requiredPermission: string
  responseSchema: Record<string, string>
}

const STUB_SCHEMAS: Record<string, StubToolSchema> = {
  realtime_queue: {
    description: "Real-time queue of trucks waiting outside the gate, sourced from external gate sensors or camera systems.",
    proposedEndpoint: "GET /api/gate/external-queue",
    method: "GET",
    requiredPermission: "gate:read",
    responseSchema: {
      truckCount: "number — trucks currently in external queue",
      averageWaitMinutes: "number — average wait time",
      trucks: "Array<{ plateNumber, arrivalTime, estimatedEntry }>",
    },
  },
  predictive_maintenance: {
    description: "Predictive maintenance analytics for terminal equipment (gantries, bays, pumps) based on usage patterns and sensor data.",
    proposedEndpoint: "GET /api/maintenance/predictions",
    method: "GET",
    requiredPermission: "reports:read",
    responseSchema: {
      predictions: "Array<{ equipmentId, equipmentName, riskScore, nextServiceDate, recommendation }>",
      overallHealthScore: "number (0-100)",
    },
  },
  export_report: {
    description: "Export operational reports as PDF or CSV documents for offline analysis and compliance records.",
    proposedEndpoint: "POST /api/reports/export",
    method: "POST",
    requiredPermission: "reports:export",
    responseSchema: {
      downloadUrl: "string — temporary signed URL for the exported file",
      format: "'pdf' | 'csv'",
      generatedAt: "ISO 8601 timestamp",
    },
  },
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function handleMissingIntegration(toolId: string): CopilotMessage {
  const schema = STUB_SCHEMAS[toolId]

  if (!schema) {
    return {
      id: makeId(),
      sender: "bot",
      text: `The "${toolId}" feature is not yet available. Contact engineering to enable this integration.`,
    }
  }

  const schemaLines = Object.entries(schema.responseSchema).map(
    ([key, desc]) => `  ${key}: ${desc}`
  )

  return {
    id: makeId(),
    sender: "bot",
    text: `This feature is not yet integrated. Here's the proposed specification:`,
    breakdown: [
      schema.description,
      "",
      `Proposed endpoint: ${schema.proposedEndpoint}`,
      `Method: ${schema.method}`,
      `Permission: ${schema.requiredPermission}`,
      "",
      "Response schema:",
      ...schemaLines,
    ],
    recommendedActions: ["Contact engineering to enable this integration"],
    source: `Stub: ${toolId}`,
    isOpsMetric: true,
  }
}

export type ChatRole = "internal_ops" | "external_client";

export type AssistSeverity = "success" | "warning" | "danger" | "info";

export interface AssistChip {
  label: string;
  severity: AssistSeverity;
  icon?: string;
}

export interface AssistMetric {
  label: string;
  value: string;
  hint?: string;
  severity?: string;
}

export interface AssistAction {
  id: string;
  label: string;
  href: string;
  tooltip: string;
  icon?: string;
  incidentId?: string;
  truckId?: string;
  incident_id?: string;
  truck_id?: string;
  /** When true, renders as the high-visibility primary resolution button */
  primary?: boolean;
  visibility?: ChatRole[];
}

export interface AssistResponse {
  kind: "ops_availability";
  intent: "availability_allotment";
  role: ChatRole;
  headline: string;
  summary: string;
  status: AssistChip;
  metrics: AssistMetric[];
  blockers?: {
    title: string;
    items: Array<{
      text: string;
      severity?: string;
    }>;
  };
  actions: AssistAction[];
  debug?: Record<string, unknown>;
}

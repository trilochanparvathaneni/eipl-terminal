/**
 * Centralised permission constants.
 *
 * Every permission key used in authorize() calls MUST be listed here so
 * we get compile-time typo detection and a single grep target.
 */

export const P = {
  // ── Appointments / Bookings ─────────────────────────────────────────────
  APPOINTMENTS_READ: "appointments.read",
  APPOINTMENTS_WRITE: "appointments.write",

  // ── Bookings (legacy keys kept for backward compat) ─────────────────────
  BOOKING_CREATE: "booking:create",
  BOOKING_READ: "booking:read",
  BOOKING_UPDATE: "booking:update",
  BOOKING_CANCEL: "booking:cancel",
  BOOKING_SCHEDULE: "booking:schedule",

  // ── Truck Trips ─────────────────────────────────────────────────────────
  TRIP_CREATE: "trip:create",
  TRIP_READ: "trip:read",
  TRIP_RESCHEDULE: "trip:reschedule",

  // ── Gate ─────────────────────────────────────────────────────────────────
  GATE_CHECKIN: "gate:checkin",
  GATE_CHECKOUT: "gate:checkout",
  GATE_READ: "gate:read",

  // ── Safety / HSE ────────────────────────────────────────────────────────
  SAFETY_CREATE: "safety:create",
  SAFETY_READ: "safety:read",
  STOPWORK_ISSUE: "stopwork:issue",
  STOPWORK_RESOLVE: "stopwork:resolve",
  INCIDENT_CREATE: "incident:create",
  INCIDENT_READ: "incident:read",
  INCIDENT_CLOSE: "incident:close",

  // ── Reports ─────────────────────────────────────────────────────────────
  REPORTS_READ: "reports:read",
  REPORTS_EXPORT: "reports:export",

  // ── Audit ───────────────────────────────────────────────────────────────
  AUDIT_READ: "audit:read",

  // ── Admin ───────────────────────────────────────────────────────────────
  ADMIN_USERS: "admin:users",
  ADMIN_TERMINAL: "admin:terminal",

  // ── Notifications ───────────────────────────────────────────────────────
  NOTIFICATIONS_READ: "notifications:read",

  // ── Tenant admin ────────────────────────────────────────────────────────
  TENANT_READ: "tenant:read",

  // ── Traffic Controller / AI Operations ────────────────────────────────
  CONTROLLER_CONSOLE: "controller:console",
  CONTROLLER_ASSIGN_BAY: "controller:assign_bay",
  CONTROLLER_ASSIGN_ARM: "controller:assign_arm",
  CONTROLLER_LOCK_BAY: "controller:lock_bay",
  CONTROLLER_UPDATE_ETA: "controller:update_eta",
  CONTROLLER_RESEQUENCE: "controller:resequence",
  CONTROLLER_MARK_NOSHOW: "controller:mark_noshow",
  CONTROLLER_RECLASSIFY: "controller:reclassify",
  CHANGEOVER_SET_READY: "changeover:set_ready",
  AI_READ: "ai:read",

  // ── Documents / Compliance ─────────────────────────────────────────────
  DOCUMENT_UPLOAD: "document:upload",
  DOCUMENT_READ: "document:read",
  DOCUMENT_VERIFY: "document:verify",
  DOCUMENT_REJECT: "document:reject",
  COMPLIANCE_EVALUATE: "compliance:evaluate",
  COMPLIANCE_READ: "compliance:read",
  CUSTODY_TRANSITION: "custody:transition",
  EVIDENCE_GENERATE: "evidence:generate",
  EVIDENCE_READ: "evidence:read",

  // ── Chat & Forms ─────────────────────────────────────────────────────────
  CHAT_USE: "chat:use",
  FORM_SUBMIT: "form:submit",

  // ── Forecast & Prediction ─────────────────────────────────────────────────
  FORECAST_READ: "forecast:read",

  // ── Live Ops Command Panel ───────────────────────────────────────────────
  LIVE_OPS_READ: "live_ops:read",
} as const

export type Permission = (typeof P)[keyof typeof P]

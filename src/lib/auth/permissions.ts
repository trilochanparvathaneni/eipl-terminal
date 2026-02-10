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
} as const

export type Permission = (typeof P)[keyof typeof P]

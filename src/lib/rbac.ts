import { Role } from '@prisma/client'

// Define which roles can access which features
export const ROLE_PERMISSIONS: Record<string, Role[]> = {
  // Bookings
  'booking:create': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:read': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.TRANSPORTER, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.SECURITY, Role.TRAFFIC_CONTROLLER],
  'booking:update': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:cancel': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:schedule': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],

  // Truck Trips
  'trip:create': [Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'trip:read': [Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY, Role.SURVEYOR, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],
  'trip:reschedule': [Role.TRANSPORTER],

  // Gate
  'gate:checkin': [Role.SECURITY],
  'gate:checkout': [Role.SECURITY],
  'gate:read': [Role.SECURITY, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],

  // Safety / HSE
  'safety:create': [Role.HSE_OFFICER, Role.SUPER_ADMIN],
  'safety:read': [Role.HSE_OFFICER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.AUDITOR],
  'stopwork:issue': [Role.HSE_OFFICER, Role.SUPER_ADMIN],
  'stopwork:resolve': [Role.HSE_OFFICER, Role.SUPER_ADMIN],
  'incident:create': [Role.HSE_OFFICER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY],
  'incident:read': [Role.HSE_OFFICER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.AUDITOR],
  'incident:close': [Role.HSE_OFFICER, Role.SUPER_ADMIN],

  // Reports
  'reports:read': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER],
  'reports:export': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],

  // Audit
  'audit:read': [Role.AUDITOR, Role.SUPER_ADMIN],

  // Admin
  'admin:users': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN],
  'admin:terminal': [Role.SUPER_ADMIN],

  // Notifications
  'notifications:read': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],

  // Traffic Controller / AI Operations
  'controller:console': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:assign_bay': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:lock_bay': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:update_eta': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:resequence': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:mark_noshow': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'controller:reclassify': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'changeover:set_ready': [Role.TRAFFIC_CONTROLLER, Role.HSE_OFFICER, Role.SUPER_ADMIN],
  'ai:read': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.AUDITOR],
  'ai:upload': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.HSE_OFFICER], // internal-only SOP upload

  // Documents / Compliance
  'document:upload': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.TRANSPORTER],
  'document:read': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  'document:verify': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR],
  'document:reject': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR],
  'compliance:evaluate': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.HSE_OFFICER],
  'compliance:read': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  'custody:transition': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  'evidence:generate': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],
  'evidence:read': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],
  'controller:assign_arm': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],

  // Chat & Forms
  'chat:use': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],
  'form:submit': [Role.CLIENT, Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],

  // Forecast & Prediction (V2)
  'forecast:read': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.AUDITOR],

  // Live Ops Command Panel
  'live_ops:read': [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY],

  // Communications
  'comms:read':  [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],
  'comms:write': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  'tasks:read':  [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],
  'tasks:write': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.TRAFFIC_CONTROLLER, Role.SECURITY, Role.HSE_OFFICER, Role.SURVEYOR],
}

export function hasPermission(role: Role, permission: string): boolean {
  const allowedRoles = ROLE_PERMISSIONS[permission]
  if (!allowedRoles) return false
  return allowedRoles.includes(role)
}

export function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.TERMINAL_ADMIN:
      return '/dashboard'
    case Role.CLIENT:
      return '/dashboard'
    case Role.TRANSPORTER:
      return '/transporter/trips'
    case Role.SECURITY:
      return '/security/gate'
    case Role.SURVEYOR:
      return '/dashboard'
    case Role.HSE_OFFICER:
      return '/hse'
    case Role.AUDITOR:
      return '/audit-logs'
    case Role.TRAFFIC_CONTROLLER:
      return '/controller/console'
    default:
      return '/dashboard'
  }
}

// Navigation items per role
export interface NavItem {
  label: string
  href: string
  permission?: string
}

export function getNavItems(role: Role): NavItem[] {
  const items: NavItem[] = []

  items.push({ label: 'Dashboard', href: '/dashboard' })

  if (hasPermission(role, 'booking:read')) {
    items.push({ label: 'Bookings', href: '/bookings' })
  }

  if (hasPermission(role, 'booking:schedule')) {
    items.push({ label: 'Schedule', href: '/schedule' })
  }

  if (role === Role.TRANSPORTER) {
    items.push({ label: 'My Trips', href: '/transporter/trips' })
  }

  if (role === Role.SECURITY) {
    items.push({ label: 'Gate Ops', href: '/security/gate' })
  }

  if (([Role.HSE_OFFICER, Role.SUPER_ADMIN] as string[]).includes(role)) {
    items.push({ label: 'HSE', href: '/hse' })
  }

  if (hasPermission(role, 'reports:read')) {
    items.push({ label: 'Reports', href: '/reports' })
  }

  if (role === Role.CLIENT) {
    items.push({ label: 'Documents', href: '/client/documents' })
  }

  if (hasPermission(role, 'document:verify')) {
    items.push({ label: 'Doc Review', href: '/admin/documents-review' })
  }

  if (hasPermission(role, 'controller:console')) {
    items.push({ label: 'Yard Console', href: '/controller/yard-console' })
  }

  if (hasPermission(role, 'controller:console')) {
    items.push({ label: 'Controller', href: '/controller/console' })
  }

  if (hasPermission(role, 'audit:read')) {
    items.push({ label: 'Audit Logs', href: '/audit-logs' })
  }

  if (hasPermission(role, 'forecast:read')) {
    items.push({ label: 'Forecast', href: '/forecast' })
  }

  if (hasPermission(role, 'live_ops:read')) {
    items.push({ label: 'Live Ops', href: '/live-ops' })
  }

  if (hasPermission(role, 'comms:read')) {
    items.push({ label: 'Communications', href: '/communications' })
  }

  if (hasPermission(role, 'chat:use')) {
    items.push({ label: 'Chat', href: '/chat' })
  }

  if (hasPermission(role, 'form:submit')) {
    items.push({ label: 'Forms', href: '/forms' })
  }

  return items
}

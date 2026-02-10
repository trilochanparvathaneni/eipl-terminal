import { Role } from '@prisma/client'

// Define which roles can access which features
export const ROLE_PERMISSIONS: Record<string, Role[]> = {
  // Bookings
  'booking:create': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:read': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.TRANSPORTER, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.SECURITY],
  'booking:update': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:cancel': [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'booking:schedule': [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],

  // Truck Trips
  'trip:create': [Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  'trip:read': [Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY, Role.SURVEYOR, Role.AUDITOR],
  'trip:reschedule': [Role.TRANSPORTER],

  // Gate
  'gate:checkin': [Role.SECURITY],
  'gate:checkout': [Role.SECURITY],
  'gate:read': [Role.SECURITY, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],

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
  'notifications:read': [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR],
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

  if (hasPermission(role, 'audit:read')) {
    items.push({ label: 'Audit Logs', href: '/audit-logs' })
  }

  return items
}

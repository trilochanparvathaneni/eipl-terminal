import { Role } from "@prisma/client"

export type RouteCategory =
  | "Navigation"
  | "Bookings"
  | "Operations"
  | "Safety"
  | "Documents"
  | "Administration"
  | "Account"

export interface SearchableRoute {
  id: string
  name: string
  path: string
  category: RouteCategory
  keywords: string[]
  roles: Role[]
  parent?: string
  priority?: number
}

const ALL_ROLES = Object.values(Role) as Role[]

export const SEARCHABLE_ROUTES: SearchableRoute[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    path: "/dashboard",
    category: "Navigation",
    keywords: ["home", "overview", "analytics", "widgets"],
    roles: ALL_ROLES,
    priority: 10,
  },
  {
    id: "bookings",
    name: "Bookings",
    path: "/bookings",
    category: "Bookings",
    keywords: ["booking", "list", "orders", "cargo"],
    roles: [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.TRANSPORTER, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.SECURITY, Role.TRAFFIC_CONTROLLER],
    priority: 8,
  },
  {
    id: "bookings-new",
    name: "Create New Booking",
    path: "/bookings/new",
    category: "Bookings",
    keywords: ["new", "create", "add", "dispatch"],
    roles: [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
    parent: "bookings",
    priority: 7,
  },
  {
    id: "schedule",
    name: "Schedule",
    path: "/schedule",
    category: "Operations",
    keywords: ["calendar", "slots", "timeline"],
    roles: [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
    priority: 7,
  },
  {
    id: "my-trips",
    name: "My Trips",
    path: "/transporter/trips",
    category: "Operations",
    keywords: ["trips", "trucks", "transport", "vehicle"],
    roles: [Role.TRANSPORTER],
    priority: 8,
  },
  {
    id: "gate-ops",
    name: "Gate Operations",
    path: "/security/gate",
    category: "Safety",
    keywords: ["gate", "check-in", "check-out", "entry", "vehicle", "truck"],
    roles: [Role.SECURITY],
    priority: 8,
  },
  {
    id: "hse",
    name: "HSE Console",
    path: "/hse",
    category: "Safety",
    keywords: ["health", "safety", "environment", "inspection"],
    roles: [Role.HSE_OFFICER, Role.SUPER_ADMIN],
    priority: 7,
  },
  {
    id: "reports",
    name: "Reports",
    path: "/reports",
    category: "Administration",
    keywords: ["reports", "analytics", "charts", "export"],
    roles: [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER],
    priority: 6,
  },
  {
    id: "client-documents",
    name: "My Documents",
    path: "/client/documents",
    category: "Documents",
    keywords: ["documents", "upload", "files", "compliance"],
    roles: [Role.CLIENT],
    priority: 7,
  },
  {
    id: "documents-review",
    name: "Document Review",
    path: "/admin/documents-review",
    category: "Documents",
    keywords: ["review", "verify", "approve", "reject"],
    roles: [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR],
    priority: 6,
  },
  {
    id: "controller-console",
    name: "Controller Console",
    path: "/controller/console",
    category: "Operations",
    keywords: ["controller", "traffic", "queue", "bay", "assign"],
    roles: [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
    priority: 8,
  },
  {
    id: "yard-console",
    name: "Yard Console",
    path: "/controller/yard-console",
    category: "Operations",
    keywords: ["yard", "arm", "gantry", "heatmap", "bay"],
    roles: [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
    priority: 7,
  },
  {
    id: "audit-logs",
    name: "Audit Logs",
    path: "/audit-logs",
    category: "Administration",
    keywords: ["audit", "logs", "trail", "compliance"],
    roles: [Role.AUDITOR, Role.SUPER_ADMIN],
    priority: 6,
  },
  {
    id: "notifications",
    name: "Notifications",
    path: "/notifications",
    category: "Navigation",
    keywords: ["alerts", "updates", "bell"],
    roles: ALL_ROLES,
    priority: 5,
  },
  // Account
  {
    id: "profile",
    name: "Profile",
    path: "/profile",
    category: "Account",
    keywords: ["profile", "account", "my account", "user", "personal info"],
    roles: ALL_ROLES,
    priority: 5,
  },
  {
    id: "settings",
    name: "Settings",
    path: "/settings",
    category: "Account",
    keywords: ["settings", "preferences", "configuration", "config", "options"],
    roles: ALL_ROLES,
    priority: 5,
  },
  {
    id: "signout",
    name: "Sign Out",
    path: "",
    category: "Account",
    keywords: ["logout", "exit", "end session"],
    roles: ALL_ROLES,
    priority: 1,
  },
  // Quick actions & sub-pages
  {
    id: "transporter-qr",
    name: "Trip QR Code",
    path: "/transporter/trips",
    category: "Operations",
    keywords: ["qr", "code", "scan", "ticket"],
    roles: [Role.TRANSPORTER],
    parent: "my-trips",
    priority: 4,
  },
  {
    id: "upload-documents",
    name: "Upload Documents",
    path: "/client/documents",
    category: "Documents",
    keywords: ["upload", "attach", "file", "submit", "compliance"],
    roles: [Role.CLIENT],
    parent: "client-documents",
    priority: 6,
  },
  {
    id: "export-reports",
    name: "Export Reports",
    path: "/reports",
    category: "Administration",
    keywords: ["export", "download", "csv", "pdf", "excel", "print"],
    roles: [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],
    parent: "reports",
    priority: 5,
  },
  {
    id: "manage-users",
    name: "Manage Users",
    path: "/settings",
    category: "Administration",
    keywords: ["users", "roles", "permissions", "team", "invite", "admin"],
    roles: [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN],
    priority: 5,
  },
  {
    id: "product-tour",
    name: "Take a Tour",
    path: "",
    category: "Account",
    keywords: ["tour", "guide", "help", "walkthrough", "onboarding", "tutorial"],
    roles: ALL_ROLES,
    priority: 2,
  },
]

export function getSearchableRoutes(role: Role): SearchableRoute[] {
  return SEARCHABLE_ROUTES.filter((route) => route.roles.includes(role))
}

export const CATEGORY_CONFIG: Record<RouteCategory, string> = {
  Navigation: "bg-slate-100 text-slate-700",
  Bookings: "bg-blue-100 text-blue-700",
  Operations: "bg-amber-100 text-amber-700",
  Safety: "bg-red-100 text-red-700",
  Documents: "bg-emerald-100 text-emerald-700",
  Administration: "bg-purple-100 text-purple-700",
  Account: "bg-indigo-100 text-indigo-700",
}

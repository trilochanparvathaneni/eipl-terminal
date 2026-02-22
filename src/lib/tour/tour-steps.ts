export interface TourStep {
  id: string
  target: string // CSS selector
  title: string
  description: string
  placement: "top" | "bottom" | "left" | "right"
}

export interface WelcomeContent {
  heading: string
  description: string
  features: { icon: string; label: string }[]
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TERMINAL_ADMIN: "Terminal Admin",
  CLIENT: "Client",
  TRANSPORTER: "Transporter",
  SECURITY: "Security",
  SURVEYOR: "Surveyor",
  HSE_OFFICER: "HSE Officer",
  AUDITOR: "Auditor",
  TRAFFIC_CONTROLLER: "Traffic Controller",
}

export function getWelcomeContent(role: string): WelcomeContent {
  const roleLabel = ROLE_LABELS[role] || "User"

  const baseFeatures = [
    { icon: "search", label: "Quick search with keyboard shortcut" },
    { icon: "bell", label: "Real-time notifications" },
    { icon: "bot", label: "EIPL Assist" },
  ]

  const roleFeatures: Record<string, { icon: string; label: string }[]> = {
    SUPER_ADMIN: [
      { icon: "layout", label: "Dashboard analytics & widgets" },
      { icon: "calendar", label: "Schedule management" },
      { icon: "radio", label: "Controller console access" },
      { icon: "users", label: "User administration" },
    ],
    TERMINAL_ADMIN: [
      { icon: "layout", label: "Dashboard analytics & widgets" },
      { icon: "calendar", label: "Schedule management" },
      { icon: "radio", label: "Controller console access" },
      { icon: "file-check", label: "Document review & verification" },
    ],
    CLIENT: [
      { icon: "clipboard", label: "Create & manage bookings" },
      { icon: "folder", label: "Upload & track documents" },
      { icon: "file-text", label: "Compliance monitoring" },
    ],
    TRANSPORTER: [
      { icon: "truck", label: "My Trips management" },
      { icon: "clipboard", label: "View bookings" },
      { icon: "upload", label: "Document upload" },
    ],
    SECURITY: [
      { icon: "shield", label: "Gate check-in & check-out" },
      { icon: "clipboard", label: "Trip monitoring" },
    ],
    SURVEYOR: [
      { icon: "file-check", label: "Document review & verification" },
      { icon: "bar-chart", label: "Reports access" },
    ],
    HSE_OFFICER: [
      { icon: "hard-hat", label: "HSE console & inspections" },
      { icon: "alert", label: "Incident management" },
      { icon: "bar-chart", label: "Safety reports" },
    ],
    AUDITOR: [
      { icon: "file-text", label: "Audit logs & trail" },
      { icon: "bar-chart", label: "Reports & analytics" },
    ],
    TRAFFIC_CONTROLLER: [
      { icon: "radio", label: "Controller console" },
      { icon: "crosshair", label: "Yard console & bay management" },
      { icon: "clipboard", label: "Trip & queue management" },
    ],
  }

  return {
    heading: `Welcome, ${roleLabel}!`,
    description: `Here's a quick overview of your EIPL Terminal workspace. Let us show you around.`,
    features: [...(roleFeatures[role] || []), ...baseFeatures],
  }
}

export function getTourSteps(role: string): TourStep[] {
  const common: TourStep[] = [
    {
      id: "sidebar",
      target: '[data-tour="sidebar"]',
      title: "Sidebar Navigation",
      description: "Your menu, customized for your role. Access all your pages from here.",
      placement: "right",
    },
    {
      id: "search",
      target: '[data-tour="search"]',
      title: "Quick Search",
      description: "Press / to quickly find any page or action. Try it anytime!",
      placement: "bottom",
    },
    {
      id: "notifications",
      target: '[data-tour="notifications"]',
      title: "Notifications",
      description: "Real-time alerts and updates about your operations appear here.",
      placement: "bottom",
    },
    {
      id: "chatbot",
      target: '[data-tour="chatbot"]',
      title: "EIPL Assist",
      description: "Need help? Ask EIPL Assist for help with navigation and terminal workflows.",
      placement: "top",
    },
    {
      id: "profile",
      target: '[data-tour="profile"]',
      title: "Profile Menu",
      description: "Access your settings, sign out, or replay this tour anytime.",
      placement: "bottom",
    },
  ]

  const roleSteps: Record<string, TourStep[]> = {
    SUPER_ADMIN: [
      {
        id: "dashboard-widgets",
        target: '[data-tour="sidebar"] nav a[href="/dashboard"]',
        title: "Dashboard Widgets",
        description: "Your dashboard shows key metrics and analytics for the entire terminal.",
        placement: "right",
      },
    ],
    TERMINAL_ADMIN: [
      {
        id: "dashboard-widgets",
        target: '[data-tour="sidebar"] nav a[href="/dashboard"]',
        title: "Dashboard Widgets",
        description: "Monitor terminal operations with real-time dashboard analytics.",
        placement: "right",
      },
    ],
    CLIENT: [
      {
        id: "bookings",
        target: '[data-tour="sidebar"] nav a[href="/bookings"]',
        title: "Your Bookings",
        description: "Create new bookings and manage your existing ones here.",
        placement: "right",
      },
    ],
    TRANSPORTER: [
      {
        id: "my-trips",
        target: '[data-tour="sidebar"] nav a[href="/transporter/trips"]',
        title: "My Trips",
        description: "View and manage all your scheduled trips from this section.",
        placement: "right",
      },
    ],
    SECURITY: [
      {
        id: "gate-ops",
        target: '[data-tour="sidebar"] nav a[href="/security/gate"]',
        title: "Gate Operations",
        description: "Process truck check-ins and check-outs at the gate.",
        placement: "right",
      },
    ],
    SURVEYOR: [
      {
        id: "doc-review",
        target: '[data-tour="sidebar"] nav a[href="/admin/documents-review"]',
        title: "Document Review",
        description: "Review and verify uploaded documents from this section.",
        placement: "right",
      },
    ],
    HSE_OFFICER: [
      {
        id: "hse-console",
        target: '[data-tour="sidebar"] nav a[href="/hse"]',
        title: "HSE Console",
        description: "Manage safety inspections, incidents, and stop-work orders.",
        placement: "right",
      },
    ],
    AUDITOR: [
      {
        id: "audit-logs",
        target: '[data-tour="sidebar"] nav a[href="/audit-logs"]',
        title: "Audit Logs",
        description: "Access complete audit trails and compliance records here.",
        placement: "right",
      },
    ],
    TRAFFIC_CONTROLLER: [
      {
        id: "controller-console",
        target: '[data-tour="sidebar"] nav a[href="/controller/console"]',
        title: "Controller Console",
        description: "Your main workspace for managing truck queues and bay assignments.",
        placement: "right",
      },
      {
        id: "yard-console",
        target: '[data-tour="sidebar"] nav a[href="/controller/yard-console"]',
        title: "Yard Console",
        description: "Visual bay heatmap and yard overview for real-time monitoring.",
        placement: "right",
      },
    ],
  }

  // Insert role-specific steps after sidebar (index 0), before search
  const extra = roleSteps[role] || []
  return [common[0], ...extra, ...common.slice(1)]
}

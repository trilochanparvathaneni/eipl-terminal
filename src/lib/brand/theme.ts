/**
 * Brand / Theme configuration.
 *
 * Every tenant can override any of these tokens.  The default theme is used
 * when no tenant-specific override exists.  The shape is intentionally flat
 * so it can be stored as a JSONB column or a config file.
 */

export interface BrandTheme {
  /** Slug used for asset paths: /images/tenants/{slug}/logo.jpg */
  tenantSlug: string
  /** Product / app name shown in UI chrome */
  productName: string
  /** One-liner shown under the product name */
  tagline: string
  /** Path to the logo image (icon-only mark) */
  logoSrc: string
  /** Path to the full lockup image (if available) */
  lockupSrc?: string
  /** HSL primary colour – light mode (e.g. "124 50% 24%") */
  primaryHsl: string
  /** HSL primary colour – dark mode */
  primaryHslDark: string
}

// ── Default theme (ships with every deployment) ─────────────────────────────
export const DEFAULT_THEME: BrandTheme = {
  tenantSlug: "eipl",
  productName: "TerminalFlow",
  tagline: "Appointments, Gates, and Turnaround — made auditable.",
  logoSrc: "/images/eipl-logo.jpg",
  primaryHsl: "124 50% 24%",
  primaryHslDark: "130 45% 40%",
}

// ── Per-tenant overrides ────────────────────────────────────────────────────
// In production this would come from DB / config service.
// For now we keep a static map so the code path is exercised.
const TENANT_THEMES: Record<string, Partial<BrandTheme>> = {
  eipl: {
    productName: "EIPL Terminal",
    tagline: "Safety in Storage, Strength in Legacy",
    logoSrc: "/images/eipl-logo.jpg",
  },
  // Example: another tenant
  // acme: {
  //   productName: "ACME Terminal",
  //   tagline: "Fast & Safe Logistics",
  //   logoSrc: "/images/tenants/acme/logo.png",
  //   primaryHsl: "210 80% 45%",
  //   primaryHslDark: "210 70% 55%",
  // },
}

/**
 * Resolve the full brand theme for a given tenant slug.
 * Falls back to DEFAULT_THEME for any missing keys.
 */
export function resolveTheme(tenantSlug?: string): BrandTheme {
  const slug = tenantSlug ?? DEFAULT_THEME.tenantSlug
  const overrides = TENANT_THEMES[slug]
  return { ...DEFAULT_THEME, tenantSlug: slug, ...overrides }
}

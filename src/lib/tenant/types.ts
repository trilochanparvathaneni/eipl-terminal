/**
 * Core tenant types used across the multi-tenant layer.
 */

export interface Tenant {
  id: string
  slug: string
  name: string
  /** Custom domain mapping (e.g. "ops.acme.com") */
  customDomain?: string
  isActive: boolean
  /** JSONB-style config bucket for feature flags, limits, etc. */
  config: Record<string, unknown>
  createdAt: Date
}

export interface TenantContext {
  /** Resolved tenant slug (e.g. "eipl") */
  tenantSlug: string
  /** How the slug was resolved */
  mode: "subdomain" | "header" | "default"
  /** Full tenant record (null until loaded from DB) */
  tenant?: Tenant | null
}

/** Header name used to propagate tenant slug through the request chain */
export const TENANT_HEADER = "x-tenant" as const

/** Default tenant slug when none can be resolved */
export const DEFAULT_TENANT_SLUG = "eipl" as const

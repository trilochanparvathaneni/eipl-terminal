import { type TenantContext, DEFAULT_TENANT_SLUG, TENANT_HEADER } from "./types"

/**
 * Resolve the tenant slug from the incoming request.
 *
 * Resolution order:
 *   1. Subdomain  – e.g. "eipl.app.terminalflow.io" → "eipl"
 *   2. x-tenant header – useful for API clients / dev / tests
 *   3. Default    – falls back to DEFAULT_TENANT_SLUG
 */
export function resolveTenant(headers: Headers, host?: string | null): TenantContext {
  // 1. Try subdomain
  const hostname = host ?? headers.get("host") ?? ""
  const slug = extractSubdomain(hostname)
  if (slug) {
    return { tenantSlug: slug, mode: "subdomain" }
  }

  // 2. Try explicit header
  const headerVal = headers.get(TENANT_HEADER)
  if (headerVal) {
    return { tenantSlug: headerVal, mode: "header" }
  }

  // 3. Default
  return { tenantSlug: DEFAULT_TENANT_SLUG, mode: "default" }
}

/**
 * Extract the first subdomain segment from a hostname.
 * Returns null for bare domains, localhost, and IP addresses.
 *
 * Examples:
 *   "eipl.app.terminalflow.io" → "eipl"
 *   "app.terminalflow.io"      → null  (only 3 parts = bare app domain)
 *   "localhost:3000"            → null
 *   "127.0.0.1:3000"           → null
 */
function extractSubdomain(hostname: string): string | null {
  // Strip port
  const host = hostname.split(":")[0]

  // Skip localhost and IPs
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null
  }

  const parts = host.split(".")
  // Need at least 4 parts for a tenant subdomain:
  // tenant.app.domain.tld  (4 parts)
  // For 3-part hosts (app.domain.tld) there is no tenant subdomain.
  if (parts.length < 4) return null

  const slug = parts[0]
  // Basic validation: alphanumeric + hyphens, 2-63 chars
  if (/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i.test(slug) || /^[a-z0-9]$/i.test(slug)) {
    return slug.toLowerCase()
  }

  return null
}

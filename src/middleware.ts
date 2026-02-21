import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveTenant } from "@/lib/tenant/resolveTenant"
import { TENANT_HEADER } from "@/lib/tenant/types"

/**
 * Build the allowlist of valid tenant slugs once at startup.
 *
 * Sources (in priority order):
 *   1. ALLOWED_TENANT_SLUGS env var (comma-separated, e.g. "eipl,acme")
 *   2. DEFAULT_TENANT_SLUG fallback ("eipl") — always included
 */
const ALLOWED_SLUGS: ReadonlySet<string> = (() => {
  const fromEnv = process.env.ALLOWED_TENANT_SLUGS ?? ""
  const slugs = fromEnv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // Always include the default tenant
  slugs.push("eipl", "public")
  return new Set(slugs)
})()

/**
 * Next.js Edge Middleware.
 *
 * Runs on every matched request before the route handler or page render.
 * Responsibilities:
 *   1. Resolve the tenant from the hostname / headers
 *   2. Validate the resolved slug against the known-tenant allowlist
 *   3. Forward the tenant slug as a request header so server components
 *      and route handlers can read it without re-parsing the host.
 */
export function middleware(request: NextRequest) {
  const { tenantSlug, mode } = resolveTenant(
    request.headers,
    request.nextUrl.hostname
  )

  // Reject unknown tenant slugs — prevents header-spoofing attacks in production.
  // Subdomains are validated by DNS (you can't make up a subdomain), but
  // explicit X-Tenant headers need extra validation.
  if (!ALLOWED_SLUGS.has(tenantSlug.toLowerCase())) {
    return NextResponse.json(
      { error: `Unknown tenant: ${tenantSlug}` },
      { status: 403 }
    )
  }

  // Clone request headers and inject tenant slug + resolution mode
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TENANT_HEADER, tenantSlug)
  // Also propagate how the slug was resolved (useful for debugging)
  requestHeaders.set("x-tenant-mode", mode)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

/**
 * Matcher: run on all routes EXCEPT static assets, _next internals,
 * and the NextAuth API routes (to avoid breaking auth flows).
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image, favicon.ico, images/
     * - api/auth (NextAuth routes)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|images/|api/auth).*)",
  ],
}

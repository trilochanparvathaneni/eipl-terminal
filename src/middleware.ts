import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveTenant } from "@/lib/tenant/resolveTenant"
import { TENANT_HEADER } from "@/lib/tenant/types"

/**
 * Next.js Edge Middleware.
 *
 * Runs on every matched request before the route handler or page render.
 * Responsibilities:
 *   1. Resolve the tenant from the hostname / headers
 *   2. Forward the tenant slug as a request header so server components
 *      and route handlers can read it without re-parsing the host.
 */
export function middleware(request: NextRequest) {
  const { tenantSlug } = resolveTenant(
    request.headers,
    request.nextUrl.hostname
  )

  // Clone request headers and inject tenant slug
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TENANT_HEADER, tenantSlug)

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

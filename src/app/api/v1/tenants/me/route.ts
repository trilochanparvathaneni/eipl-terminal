import { NextRequest, NextResponse } from "next/server"
import { authorize, permissionsForRole } from "@/lib/auth/authorize"
import { findTenantBySlug } from "@/lib/tenant/tenantRepo"
import { P } from "@/lib/auth/permissions"

/**
 * GET /api/v1/tenants/me
 *
 * Returns the current tenant context and the authenticated user's
 * roles / permissions.  Useful for client apps to bootstrap their UI.
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.TENANT_READ,
    headers: request.headers,
  })
  if (error) return error

  const tenant = await findTenantBySlug(ctx.tenantSlug)

  return NextResponse.json({
    requestId: ctx.requestId,
    tenant: tenant
      ? { id: tenant.id, slug: tenant.slug, name: tenant.name }
      : { slug: ctx.tenantSlug, name: ctx.tenantSlug },
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
    },
    permissions: permissionsForRole(ctx.user.role),
  })
}

import type { Tenant } from "./types"

/**
 * Tenant repository.
 *
 * Currently uses an in-memory map.  In production this would query a
 * `tenants` table via Prisma.  The interface is kept stable so the
 * switch is a one-line change.
 */

// ── In-memory store (seed data) ─────────────────────────────────────────────
const TENANTS: Map<string, Tenant> = new Map([
  [
    "eipl",
    {
      id: "tenant_eipl",
      slug: "eipl",
      name: "East India Petroleum Ltd",
      isActive: true,
      config: {},
      createdAt: new Date("2024-01-01"),
    },
  ],
  [
    "public",
    {
      id: "tenant_public",
      slug: "public",
      name: "Public (Demo)",
      isActive: true,
      config: {},
      createdAt: new Date("2024-01-01"),
    },
  ],
])

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  // TODO: Replace with prisma.tenant.findUnique({ where: { slug } })
  return TENANTS.get(slug) ?? null
}

export async function findTenantByDomain(domain: string): Promise<Tenant | null> {
  // TODO: Replace with prisma.tenant.findFirst({ where: { customDomain: domain } })
  const all = Array.from(TENANTS.values())
  return all.find((t) => t.customDomain === domain) ?? null
}

export async function listTenants(): Promise<Tenant[]> {
  return Array.from(TENANTS.values())
}

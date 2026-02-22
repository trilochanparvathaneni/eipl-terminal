import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { Role } from "@prisma/client"

/**
 * Horton Sphere rated capacity used as the denominator when computing
 * lpgLevelPercentage. EIPL terminal default is 10 000 KL across all spheres.
 * Adjust to match the actual installed storage capacity if it changes.
 */
const HORTON_SPHERE_CAPACITY_KL = 10_000

export async function GET() {
  const { user, error } = await requireAuth(
    Role.SUPER_ADMIN,
    Role.TERMINAL_ADMIN,
    Role.TRAFFIC_CONTROLLER,
    Role.HSE_OFFICER,
    Role.AUDITOR,
  )
  if (error) return error

  const lots = await prisma.inventoryLot.findMany({
    include: { product: true },
  })

  // Aggregate by product category (LPG, POL, CHEMICAL)
  const byCategory: Record<string, { totalKL: number; lotCount: number }> = {}
  // Aggregate by product name for the breakdown list
  const byProduct: Record<string, { name: string; category: string; totalKL: number; lotCount: number }> = {}

  for (const lot of lots) {
    const cat = lot.product.category
    if (!byCategory[cat]) byCategory[cat] = { totalKL: 0, lotCount: 0 }
    byCategory[cat].totalKL += lot.quantityAvailable
    byCategory[cat].lotCount += 1

    const key = lot.product.name
    if (!byProduct[key]) byProduct[key] = { name: key, category: cat, totalKL: 0, lotCount: 0 }
    byProduct[key].totalKL += lot.quantityAvailable
    byProduct[key].lotCount += 1
  }

  const totalKL = lots.reduce((sum, l) => sum + l.quantityAvailable, 0)
  const lpgKL = byCategory["LPG"]?.totalKL ?? 0
  const lpgLevelPercentage = Math.round((lpgKL / HORTON_SPHERE_CAPACITY_KL) * 100)

  return NextResponse.json({
    totalKL,
    lpgLevelKL: lpgKL,
    lpgLevelPercentage,
    hortonSphereCapacityKL: HORTON_SPHERE_CAPACITY_KL,
    byCategory,
    productBreakdown: Object.values(byProduct),
    lotCount: lots.length,
  })
}

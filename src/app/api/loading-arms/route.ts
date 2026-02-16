import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/loading-arms?gantryId=xxx
 *
 * Returns all loading arms with bay, gantry, and currentProduct info.
 * Optional query param: gantryId to filter by gantry.
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_CONSOLE,
    headers: request.headers,
  })
  if (error) return error

  try {
    const url = new URL(request.url)
    const gantryId = url.searchParams.get("gantryId")

    const where: any = {}

    if (gantryId) {
      where.bay = {
        gantryId,
      }
    }

    const arms = await prisma.loadingArm.findMany({
      where,
      include: {
        bay: {
          include: {
            gantry: true,
          },
        },
        currentProduct: true,
        lastProduct: true,
      },
      orderBy: [
        { bay: { gantry: { name: "asc" } } },
        { bay: { name: "asc" } },
        { armNo: "asc" },
      ],
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      count: arms.length,
      arms,
      // Backward-compatible alias used by older clients/pages.
      loadingArms: arms,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to fetch loading arms.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}

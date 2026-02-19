import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user!.id },
    select: { conversationId: true, lastReadAt: true },
  })

  const counts = await Promise.all(
    memberships.map(async (m) => {
      const count = await prisma.commMessage.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: user!.id },
          deletedAt: null,
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      })
      return [m.conversationId, count] as const
    })
  )

  const unreadCounts = Object.fromEntries(counts)
  return NextResponse.json({ unreadCounts })
}

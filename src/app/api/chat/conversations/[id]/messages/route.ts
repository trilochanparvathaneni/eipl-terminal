import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "chat:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const url = new URL(req.url)
  const cursor = url.searchParams.get("cursor")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100)

  // Verify ownership
  const conv = await prisma.chatConversation.findFirst({
    where: { id, userId: user!.id },
  })
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: id,
      ...(cursor ? { createdAt: { gt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  const nextCursor =
    messages.length === limit
      ? messages[messages.length - 1].createdAt.toISOString()
      : null

  return NextResponse.json({ messages, nextCursor })
}

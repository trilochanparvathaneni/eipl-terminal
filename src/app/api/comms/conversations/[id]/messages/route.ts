import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { assertConversationAccess, isInternalUser } from "@/lib/comms/membership"
import { sendMessageSchema } from "@/lib/comms/validations"
import { sendNotification } from "@/lib/notifications"
import { Role } from "@prisma/client"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { error: accessError } = await assertConversationAccess(params.id, user!)
  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: accessError.status })
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get("cursor")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)

  const messages = await prisma.commMessage.findMany({
    where: {
      conversationId: params.id,
      deletedAt: null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      mentions: {
        include: {
          mentionedUser: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = messages.length > limit
  const items = hasMore ? messages.slice(0, limit) : messages
  const nextCursor = hasMore ? items[items.length - 1].id : null

  return NextResponse.json({ messages: items.reverse(), nextCursor })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { conversation, error: accessError } = await assertConversationAccess(
    params.id,
    user!
  )
  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: accessError.status })
  }

  // TRANSPORTER role cannot write messages
  if (user!.role === Role.TRANSPORTER) {
    return NextResponse.json(
      { error: "Transporters cannot send messages" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { body: messageBody, mentions } = parsed.data

  try {
    const message = await prisma.commMessage.create({
      data: {
        conversationId: params.id,
        senderId: user!.id,
        body: messageBody,
        mentions: {
          create: mentions.map((m) => ({
            mentionedUserId: m.userId,
            mentionType: m.mentionType,
          })),
        },
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        mentions: {
          include: {
            mentionedUser: { select: { id: true, name: true, role: true } },
          },
        },
      },
    })

    // Notify mentioned users
    await Promise.all(
      mentions.map((m) =>
        sendNotification({
          userId: m.userId,
          subject: `You were mentioned in "${conversation!.title}"`,
          body: `${user!.name} mentioned you: "${messageBody.slice(0, 100)}${messageBody.length > 100 ? "..." : ""}"`,
        })
      )
    )

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}

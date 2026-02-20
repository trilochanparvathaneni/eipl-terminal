import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { createAuditLog } from "@/lib/audit"
import { sendNotification } from "@/lib/notifications"
import { isInternalUser } from "@/lib/comms/membership"
import { createConversationSchema } from "@/lib/comms/validations"
import { Role } from "@prisma/client"

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const isInternal = isInternalUser(user!)

  // Find all conversations where the user is a member
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user!.id },
    include: {
      conversation: {
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          members: {
            include: { user: { select: { id: true, name: true, role: true } } },
          },
          _count: { select: { messages: true } },
          // contextType, contextId, contextLabel are scalar fields returned automatically
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  })

  const conversations = memberships
    .map((m) => m.conversation)
    .filter((conv) => {
      // External users cannot see INTERNAL_ONLY conversations
      if (conv.audience === "INTERNAL_ONLY" && !isInternal) return false
      return true
    })

  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createConversationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // External users cannot create INTERNAL_ONLY conversations
  if (data.audience === "INTERNAL_ONLY" && !isInternalUser(user!)) {
    return NextResponse.json(
      { error: "External users cannot create internal-only conversations" },
      { status: 403 }
    )
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        title: data.title,
        audience: data.audience,
        createdByUserId: user!.id,
        ...(data.contextType && { contextType: data.contextType }),
        ...(data.contextId && { contextId: data.contextId }),
        ...(data.contextLabel && { contextLabel: data.contextLabel }),
        members: {
          create: [
            { userId: user!.id, memberRole: "OWNER" },
            ...data.memberUserIds
              .filter((id) => id !== user!.id)
              .map((userId) => ({ userId, memberRole: "MEMBER" as const })),
          ],
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    })

    await createAuditLog({
      actorUserId: user!.id,
      entityType: "Conversation",
      entityId: conversation.id,
      action: "CREATE",
      after: { title: conversation.title, audience: conversation.audience },
    })

    // Notify added members (excluding creator)
    const otherMembers = data.memberUserIds.filter((id) => id !== user!.id)
    await Promise.all(
      otherMembers.map((userId) =>
        sendNotification({
          userId,
          subject: `You were added to "${conversation.title}"`,
          body: `${user!.name} added you to a conversation: "${conversation.title}"`,
        })
      )
    )

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
  }
}

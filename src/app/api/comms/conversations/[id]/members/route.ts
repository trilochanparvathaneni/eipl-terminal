import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { assertConversationAccess, isInternalUser } from "@/lib/comms/membership"
import { addMemberSchema } from "@/lib/comms/validations"
import { createAuditLog } from "@/lib/audit"
import { sendNotification } from "@/lib/notifications"

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = addMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { userId, memberRole } = parsed.data

  // Fetch the user to be added
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true },
  })

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Internal-only conversations reject external members
  if (conversation!.audience === "INTERNAL_ONLY" && !isInternalUser(targetUser as any)) {
    return NextResponse.json(
      { error: "Cannot add external users to an internal-only conversation" },
      { status: 403 }
    )
  }

  try {
    const member = await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: params.id, userId },
      },
      update: { memberRole },
      create: { conversationId: params.id, userId, memberRole },
    })

    await createAuditLog({
      actorUserId: user!.id,
      entityType: "ConversationMember",
      entityId: `${params.id}:${userId}`,
      action: "ADD_MEMBER",
      after: { userId, memberRole },
    })

    await sendNotification({
      userId,
      subject: `You were added to "${conversation!.title}"`,
      body: `${user!.name} added you to a conversation: "${conversation!.title}"`,
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}

import { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { SessionUser } from "@/lib/auth-utils"

export const INTERNAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.SECURITY,
  Role.SURVEYOR,
  Role.HSE_OFFICER,
  Role.AUDITOR,
  Role.TRAFFIC_CONTROLLER,
])

export function isInternalUser(user: SessionUser): boolean {
  return INTERNAL_ROLES.has(user.role)
}

type AccessSuccess = {
  conversation: { id: string; title: string; audience: string; createdByUserId: string }
  error: null
}
type AccessFailure = {
  conversation: null
  error: { status: number; message: string }
}

export async function assertConversationAccess(
  conversationId: string,
  user: SessionUser
): Promise<AccessSuccess | AccessFailure> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: { select: { userId: true } },
    },
  })

  if (!conversation) {
    return { conversation: null, error: { status: 404, message: "Conversation not found" } }
  }

  const isMember = conversation.members.some((m) => m.userId === user.id)

  if (conversation.audience === "INTERNAL_ONLY") {
    if (!isInternalUser(user)) {
      return { conversation: null, error: { status: 403, message: "Access denied" } }
    }
    if (!isMember) {
      return { conversation: null, error: { status: 403, message: "Not a member of this conversation" } }
    }
  } else {
    // MIXED
    if (!isMember) {
      return { conversation: null, error: { status: 403, message: "Not a member of this conversation" } }
    }
  }

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      audience: conversation.audience,
      createdByUserId: conversation.createdByUserId,
    },
    error: null,
  }
}

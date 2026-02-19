import { prisma } from "@/lib/prisma"
import { INTERNAL_ROLES } from "./membership"
import type { SessionUser } from "@/lib/auth-utils"

interface MentionSearchParams {
  query: string
  conversationId?: string
  moduleContext?: string
  user: SessionUser
}

interface MentionUser {
  id: string
  name: string
  email: string
  role: string
}

interface MentionSearchResult {
  internal: MentionUser[]
  external: MentionUser[]
}

export async function searchMentionCandidates(
  params: MentionSearchParams
): Promise<MentionSearchResult> {
  const { query, conversationId, moduleContext, user } = params

  let allowExternal = false

  // Determine if external users are allowed
  if (conversationId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { audience: true },
    })
    if (conv?.audience === "MIXED") {
      allowExternal = true
    }
  }

  // Security module always restricts to internal
  if (moduleContext === "security") {
    allowExternal = false
  }

  const trimmed = query.trim()

  if (conversationId && allowExternal) {
    // MIXED: search only among current members
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
      },
    })

    const activeMembers = members
      .map((m) => m.user)
      .filter(
        (u) =>
          u.isActive &&
          u.id !== user.id &&
          (!trimmed ||
            u.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            u.email.toLowerCase().includes(trimmed.toLowerCase()))
      )

    const internal: MentionUser[] = []
    const external: MentionUser[] = []

    for (const u of activeMembers) {
      const entry = { id: u.id, name: u.name, email: u.email, role: u.role }
      if (INTERNAL_ROLES.has(u.role as any)) {
        internal.push(entry)
      } else {
        external.push(entry)
      }
    }

    return { internal, external }
  }

  // Internal-only: search all active internal users
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: Array.from(INTERNAL_ROLES) as any },
      id: { not: user.id },
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    take: 20,
  })

  return {
    internal: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    external: [],
  }
}

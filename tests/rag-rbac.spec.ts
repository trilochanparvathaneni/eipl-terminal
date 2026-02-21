import { Role } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionUser } from "@/lib/auth-utils"

const mocks = vi.hoisted(() => ({
  prisma: {
    conversation: { findUnique: vi.fn() },
    conversationMember: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  },
  embedText: vi.fn(),
  embeddingToSql: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}))

vi.mock("@/lib/ai/embedder", () => ({
  embedText: mocks.embedText,
  embeddingToSql: mocks.embeddingToSql,
}))

function makeUser(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: Role.TERMINAL_ADMIN,
    clientId: null,
    transporterId: null,
    terminalId: null,
    ...overrides,
  } as SessionUser
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.embedText.mockResolvedValue([0.1, 0.2, 0.3])
  mocks.embeddingToSql.mockImplementation((v: number[]) => `[${v.join(",")}]`)
})

describe("Acceptance 1 - External user cannot list INTERNAL_ONLY conversations", () => {
  it("CLIENT role is denied for internal conversation", async () => {
    const { assertConversationAccess } = await import("@/lib/comms/membership")

    mocks.prisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      title: "Internal",
      audience: "INTERNAL_ONLY",
      createdByUserId: "user-9",
      members: [],
    })

    const externalUser = makeUser({ role: Role.CLIENT, clientId: "client-1" })
    const result = await assertConversationAccess("conv-1", externalUser)

    expect(result.error?.status).toBe(403)
  })
})

describe("Acceptance 2 - Mention search in security module returns internal users only", () => {
  it("moduleContext=security excludes external users", async () => {
    const { searchMentionCandidates } = await import("@/lib/comms/mention-search")

    mocks.prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@eipl.com", role: Role.SECURITY },
    ])

    const result = await searchMentionCandidates({
      query: "alice",
      user: makeUser({ role: Role.TERMINAL_ADMIN }),
      moduleContext: "security",
    })

    expect(result.external).toEqual([])
    expect(result.internal).toHaveLength(1)
  })
})

describe("Acceptance 3 - Mention search returns ACTIVE users only", () => {
  it("query enforces isActive=true", async () => {
    const { searchMentionCandidates } = await import("@/lib/comms/mention-search")

    mocks.prisma.user.findMany.mockResolvedValue([])

    await searchMentionCandidates({
      query: "bob",
      user: makeUser({ role: Role.TERMINAL_ADMIN }),
    })

    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })
})

describe("Acceptance 4 - Message send requires conversation membership", () => {
  it("returns forbidden when user is not a member", async () => {
    const { assertConversationAccess } = await import("@/lib/comms/membership")

    mocks.prisma.conversation.findUnique.mockResolvedValue({
      id: "conv-2",
      title: "Internal",
      audience: "INTERNAL_ONLY",
      createdByUserId: "user-9",
      members: [],
    })

    const result = await assertConversationAccess("conv-2", makeUser({ role: Role.TERMINAL_ADMIN }))
    expect(result.error?.status).toBe(403)
  })
})

describe("Acceptance 5 - Task creation writes audit log", () => {
  it("creates audit log with task + create action", async () => {
    const { createAuditLog } = await import("@/lib/audit")

    await createAuditLog({
      actorUserId: "user-1",
      entityType: "task",
      entityId: "task-1",
      action: "create",
      after: { title: "Task" },
    })

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "task",
          action: "create",
        }),
      })
    )
  })
})

describe("Acceptance 6 - Audit logs are append-only", () => {
  it("does not expose update/delete helpers", async () => {
    const auditModule = await import("@/lib/audit")
    expect(typeof auditModule.createAuditLog).toBe("function")
    expect((auditModule as any).updateAuditLog).toBeUndefined()
    expect((auditModule as any).deleteAuditLog).toBeUndefined()
  })
})

describe("Acceptance 7 - Vector search is org scoped", () => {
  it("maps CLIENT to clientId orgSlug", async () => {
    const { searchKnowledgeVector } = await import("@/lib/ai/knowledge-vector-search")

    mocks.prisma.$queryRawUnsafe.mockResolvedValue([])

    await searchKnowledgeVector("methanol SOP", makeUser({ role: Role.CLIENT, clientId: "client-abc" }))

    expect(mocks.prisma.$queryRawUnsafe).toHaveBeenCalled()
    const call = mocks.prisma.$queryRawUnsafe.mock.calls[0]
    expect(call[2]).toBe("client-abc")
  })

  it("maps internal user to eipl orgSlug", async () => {
    const { searchKnowledgeVector } = await import("@/lib/ai/knowledge-vector-search")

    mocks.prisma.$queryRawUnsafe.mockResolvedValue([])

    await searchKnowledgeVector("safety procedure", makeUser({ role: Role.TERMINAL_ADMIN }))

    expect(mocks.prisma.$queryRawUnsafe).toHaveBeenCalled()
    const call = mocks.prisma.$queryRawUnsafe.mock.calls[0]
    expect(call[2]).toBe("eipl")
  })
})

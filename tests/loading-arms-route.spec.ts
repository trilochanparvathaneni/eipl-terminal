import { beforeEach, describe, expect, it, vi } from "vitest"

const findManyMock = vi.fn()
const authorizeMock = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loadingArm: {
      findMany: findManyMock,
    },
  },
}))

vi.mock("@/lib/auth/authorize", () => ({
  authorize: authorizeMock,
}))

describe("GET /api/loading-arms", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns arms with backward-compatible loadingArms alias", async () => {
    authorizeMock.mockResolvedValue({
      ctx: { requestId: "req-1" },
      error: null,
    })

    const arms = [
      { id: "arm-1", armNo: 1 },
      { id: "arm-2", armNo: 2 },
    ]
    findManyMock.mockResolvedValue(arms)

    const { GET } = await import("@/app/api/loading-arms/route")
    const response = await GET(new Request("http://localhost/api/loading-arms") as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.arms).toEqual(arms)
    expect(body.loadingArms).toEqual(arms)
  })

  it("filters by gantryId when provided", async () => {
    authorizeMock.mockResolvedValue({
      ctx: { requestId: "req-2" },
      error: null,
    })
    findManyMock.mockResolvedValue([])

    const { GET } = await import("@/app/api/loading-arms/route")
    await GET(new Request("http://localhost/api/loading-arms?gantryId=g-1") as any)

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bay: {
            gantryId: "g-1",
          },
        },
      })
    )
  })
})

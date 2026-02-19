import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { assertConversationAccess } from "@/lib/comms/membership"

export const maxDuration = 55

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodeEvent(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new TextEncoder().encode(payload)
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { error: accessError } = await assertConversationAccess(params.id, user!)
  if (accessError) {
    return new Response(JSON.stringify({ error: accessError.message }), {
      status: accessError.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Resolve cursor from ?lastId= param, or use now() to avoid replaying history
  const url = new URL(req.url)
  const lastId = url.searchParams.get("lastId")

  let cursor: Date
  if (lastId) {
    const ref = await prisma.commMessage.findUnique({
      where: { id: lastId },
      select: { createdAt: true },
    })
    cursor = ref?.createdAt ?? new Date()
  } else {
    cursor = new Date()
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encodeEvent("connected", { conversationId: params.id })
      )

      let activeCursor = cursor

      while (true) {
        await sleep(2000)

        if (req.signal.aborted) break

        try {
          const msgs = await prisma.commMessage.findMany({
            where: {
              conversationId: params.id,
              deletedAt: null,
              createdAt: { gt: activeCursor },
            },
            include: {
              sender: { select: { id: true, name: true, role: true } },
              mentions: {
                include: {
                  mentionedUser: { select: { id: true, name: true, role: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          })

          if (msgs.length > 0) {
            for (const msg of msgs) {
              controller.enqueue(encodeEvent("message", { message: msg }))
            }
            const last = msgs[msgs.length - 1]
            controller.enqueue(encodeEvent("cursor", { lastId: last.id }))
            activeCursor = last.createdAt
          }
        } catch {
          // DB hiccup — keep loop alive, will retry next tick
        }
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

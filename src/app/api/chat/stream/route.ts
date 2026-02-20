import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { getGeminiClient, GEMINI_CHAT_MODEL } from "@/lib/ai/gemini-client"
import { checkChatRateLimit } from "@/lib/ai/rate-limiter"
import { buildSystemPrompt } from "@/lib/ai/system-prompt"
import { GEMINI_TOOL_DECLARATIONS, executeTool } from "@/lib/ai/chat-tools"
import type { ChatToolContext } from "@/lib/ai/chat-tools"
import { randomUUID } from "crypto"
import type { Content } from "@google/generative-ai"

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "chat:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { conversationId, message } = await req.json()
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const rateCheck = checkChatRateLimit(user!.id)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rateCheck.retryAfterMs },
      { status: 429 }
    )
  }

  const requestId = randomUUID()
  const toolCtx: ChatToolContext = { user: user!, requestId }

  // ── Load or create conversation ───────────────────────────────────────────
  let convId = conversationId
  if (!convId) {
    const conv = await prisma.chatConversation.create({
      data: { userId: user!.id, title: message.slice(0, 100) },
    })
    convId = conv.id
  } else {
    const conv = await prisma.chatConversation.findFirst({
      where: { id: convId, userId: user!.id },
    })
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { conversationId: convId, role: "user", content: message },
  })

  // Load last 20 messages for history
  const history = await prisma.chatMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  })

  // Convert history (excluding the last user message) to Gemini Content[]
  const geminiHistory: Content[] = history
    .slice(0, -1) // exclude the message we just added
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }))

  // ── Set up Gemini model with tools ────────────────────────────────────────
  const model = getGeminiClient().getGenerativeModel({
    model: GEMINI_CHAT_MODEL,
    systemInstruction: buildSystemPrompt(user!),
    tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS }],
  })

  const chat = model.startChat({ history: geminiHistory })

  // ── SSE streaming ─────────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`)
        )
      }

      try {
        sendEvent("conversation", { conversationId: convId })

        let currentMessage: string = message
        let continueLoop = true

        while (continueLoop) {
          continueLoop = false

          const result = await chat.sendMessageStream(currentMessage)

          let assistantText = ""
          const functionCalls: { name: string; args: Record<string, unknown> }[] = []

          for await (const chunk of result.stream) {
            // Text delta
            const text = chunk.text()
            if (text) {
              assistantText += text
              sendEvent("delta", { content: text })
            }

            // Function calls
            const calls = chunk.functionCalls()
            if (calls?.length) {
              functionCalls.push(...calls.map((fc) => ({ name: fc.name, args: fc.args as Record<string, unknown> })))
            }
          }

          if (functionCalls.length > 0) {
            // Save assistant message with tool call info
            await prisma.chatMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: assistantText || null,
                metadata: { tool_calls: functionCalls.map((fc) => fc.name) },
              },
            })

            // Execute each tool and collect responses
            const functionResponses: Content = {
              role: "user",
              parts: [],
            }

            for (const fc of functionCalls) {
              sendEvent("tool_call", { name: fc.name, params: fc.args })

              const toolResult = await executeTool(fc.name, JSON.stringify(fc.args), toolCtx)

              sendEvent("tool_result", {
                name: fc.name,
                result: toolResult.data,
                citations: toolResult.citations,
              })

              // Save tool result message
              await prisma.chatMessage.create({
                data: {
                  conversationId: convId,
                  role: "tool",
                  toolName: fc.name,
                  content: JSON.stringify(toolResult.data),
                  metadata: { citations: toolResult.citations },
                },
              })

              ;(functionResponses.parts as any[]).push({
                functionResponse: {
                  name: fc.name,
                  response: toolResult.data,
                },
              })
            }

            // Feed tool results back; Gemini expects them as next message
            currentMessage = functionResponses as any
            continueLoop = true
          } else {
            // Final text response — save and finish
            if (assistantText) {
              await prisma.chatMessage.create({
                data: {
                  conversationId: convId,
                  role: "assistant",
                  content: assistantText,
                },
              })
            }
          }
        }

        await prisma.chatConversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        })

        sendEvent("done", {})
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Internal error"
        sendEvent("error", { message: errMsg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

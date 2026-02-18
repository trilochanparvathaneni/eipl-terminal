import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { getOpenAIClient, CHAT_MODEL } from "@/lib/ai/openai-client"
import { checkChatRateLimit } from "@/lib/ai/rate-limiter"
import { buildSystemPrompt } from "@/lib/ai/system-prompt"
import { CHAT_TOOL_DEFINITIONS, executeTool } from "@/lib/ai/chat-tools"
import type { ChatToolContext } from "@/lib/ai/chat-tools"
import { randomUUID } from "crypto"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

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

  // Rate limit
  const rateCheck = checkChatRateLimit(user!.id)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rateCheck.retryAfterMs },
      { status: 429 }
    )
  }

  const requestId = randomUUID()
  const toolCtx: ChatToolContext = { user: user!, requestId }

  // Create or load conversation
  let convId = conversationId
  if (!convId) {
    const conv = await prisma.chatConversation.create({
      data: {
        userId: user!.id,
        title: message.slice(0, 100),
      },
    })
    convId = conv.id
  } else {
    // Verify ownership
    const conv = await prisma.chatConversation.findFirst({
      where: { id: convId, userId: user!.id },
    })
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }
  }

  // Save user message
  await prisma.chatMessage.create({
    data: {
      conversationId: convId,
      role: "user",
      content: message,
    },
  })

  // Load last 20 messages as context
  const history = await prisma.chatMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  })

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(user!) },
    ...history.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: m.content || "",
          tool_call_id: m.toolCallId || "",
        }
      }
      if (m.role === "assistant" && m.toolCallId) {
        // This is an assistant message with tool calls stored in metadata
        return {
          role: "assistant" as const,
          content: m.content || null,
          tool_calls: m.metadata ? (m.metadata as any).tool_calls : undefined,
        }
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content || "",
      }
    }),
  ]

  // SSE streaming
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data as object })}\n\n`))
      }

      try {
        sendEvent("conversation", { conversationId: convId })

        let continueLoop = true
        while (continueLoop) {
          continueLoop = false

          const completion = await getOpenAIClient().chat.completions.create({
            model: CHAT_MODEL,
            messages,
            tools: CHAT_TOOL_DEFINITIONS,
            stream: true,
          })

          let assistantContent = ""
          const toolCalls: Record<string, { id: string; name: string; arguments: string }> = {}

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta

            // Text content
            if (delta?.content) {
              assistantContent += delta.content
              sendEvent("delta", { content: delta.content })
            }

            // Tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { id: tc.id || "", name: tc.function?.name || "", arguments: "" }
                }
                if (tc.id) toolCalls[idx].id = tc.id
                if (tc.function?.name) toolCalls[idx].name = tc.function.name
                if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
              }
            }
          }

          const toolCallArray = Object.values(toolCalls)

          if (toolCallArray.length > 0) {
            // Save assistant message with tool calls
            await prisma.chatMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: assistantContent || null,
                metadata: {
                  tool_calls: toolCallArray.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: { name: tc.name, arguments: tc.arguments },
                  })),
                },
              },
            })

            // Add assistant message with tool_calls to conversation
            messages.push({
              role: "assistant",
              content: assistantContent || null,
              tool_calls: toolCallArray.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            })

            // Execute each tool call
            for (const tc of toolCallArray) {
              sendEvent("tool_call", { toolCallId: tc.id, name: tc.name, params: tc.arguments })

              const result = await executeTool(tc.name, tc.arguments, toolCtx)

              sendEvent("tool_result", {
                toolCallId: tc.id,
                name: tc.name,
                result: result.data,
                citations: result.citations,
                recordIds: result.recordIds,
              })

              // Save tool result message
              await prisma.chatMessage.create({
                data: {
                  conversationId: convId,
                  role: "tool",
                  content: JSON.stringify(result.data),
                  toolCallId: tc.id,
                  toolName: tc.name,
                  metadata: { citations: result.citations, recordIds: result.recordIds },
                },
              })

              // Add tool result to conversation
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result.data),
              })
            }

            // Continue the loop to get the assistant's response after tool results
            continueLoop = true
            assistantContent = ""
          } else {
            // No tool calls — save final assistant message
            if (assistantContent) {
              await prisma.chatMessage.create({
                data: {
                  conversationId: convId,
                  role: "assistant",
                  content: assistantContent,
                },
              })
            }
          }
        }

        // Update conversation timestamp
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

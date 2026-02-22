import { getSessionUser } from "@/lib/auth-utils"
import { guardAssistAction } from "@/lib/assist/action-route-guard"
import { detectAssistIntent } from "@/lib/assist/intent"
import { toAssistRole } from "@/lib/assist/policy"
import { buildBayAvailabilityResponse, buildDocumentActions } from "@/lib/assist/ops-response"
import { getOpsSnapshot } from "@/lib/assist/snapshot"
import { prisma } from "@/lib/prisma"
import { getUserRole, isClientRole } from "@/lib/security/rbac"
import { redactAssistantResponse, sanitizeForClient } from "@/lib/security/redaction"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"

const requestSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
})

const responseSchema = z.object({
  reply_text: z.string(),
  urgency: z.enum(["low", "medium", "high"]),
  action_buttons: z.array(
    z
      .object({
        label: z.string(),
        url: z.string(),
        tooltip: z.string().optional(),
      })
      .strict()
  ),
  headline: z.string().optional(),
  terminal_state: z.enum(["OPEN", "LIMITED", "PAUSED"]).optional(),
  metrics: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        tooltip: z.string(),
      })
    )
    .optional(),
  blockers: z
    .array(
      z.object({
        text: z.string(),
        severity: z.enum(["low", "medium", "high"]).optional(),
      })
    )
    .optional(),
})

const SYSTEM_INSTRUCTION = `
You are EIPL Assist for Visakhapatnam terminal operations (LPG, POL, Liquid Chemicals).
Always prioritize safety policy and role boundaries.
Respond ONLY in strict JSON:
{
  "reply_text":"string",
  "urgency":"low|medium|high",
  "action_buttons":[{"label":"string","url":"string","tooltip":"string"}]
}
URLs must be relative internal routes only.
`.trim()

async function requestStructuredCompletion(params: {
  openai: OpenAI
  model: string
  message: string
}) {
  return params.openai.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: params.message },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "eipl_assist_response",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply_text: { type: "string" },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
            action_buttons: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  url: { type: "string" },
                  tooltip: { type: "string" },
                },
                required: ["label", "url"],
              },
            },
          },
          required: ["reply_text", "urgency", "action_buttons"],
        },
      },
    },
  })
}

async function persistChatLog(params: {
  userMessage: string
  botResponse: string
  urgency: "low" | "medium" | "high"
  userId?: string | null
  intent?: string | null
}) {
  try {
    const chatLogId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    await prisma.$executeRaw`
      INSERT INTO "ChatLog" ("id", "createdAt", "userMessage", "botResponse", "urgency", "intent", "isPublicFAQ", "userId")
      VALUES (${chatLogId}, NOW(), ${params.userMessage}, ${params.botResponse}, ${params.urgency}, ${params.intent ?? null}, false, ${params.userId ?? null})
    `
  } catch (error) {
    console.error("Failed to persist chat log:", error)
  }
}

function safeActionButtons(actions: Array<{ label: string; url: string; tooltip?: string }>) {
  return actions.map((action) => {
    const guarded = guardAssistAction(action)
    return {
      label: guarded.label,
      url: guarded.href,
      tooltip: guarded.replaced ? "Contact support for this action." : action.tooltip ?? guarded.tooltip,
    }
  })
}

function buildDocumentHelpResponse() {
  return {
    reply_text:
      "Upload SOPs, permits, or compliance documents in Document Vault. EIPL Assist indexes uploaded text and uses it for contextual guidance.",
    urgency: "low" as const,
    headline: "Document intelligence",
    terminal_state: "OPEN" as const,
    metrics: [
      {
        key: "doc_support",
        label: "Supported files",
        value: "PDF, TXT, MD, CSV",
        tooltip: "These formats can be indexed for Assist knowledge retrieval.",
      },
    ],
    blockers: [],
    action_buttons: buildDocumentActions(),
  }
}

export async function POST(request: NextRequest) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? process.env.CHATGPT_API_KEY
  const OPENAI_MODEL = process.env.OPENAI_MODEL ?? process.env.CHATGPT_MODEL ?? "gpt-4o-mini"

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsedBody: z.infer<typeof requestSchema>
  try {
    parsedBody = requestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Invalid request body. Expected { message: string }." }, { status: 400 })
  }

  const assistRole = toAssistRole(sessionUser.role)
  const role = getUserRole(sessionUser)
  const clientRole = isClientRole(role)
  const intent = detectAssistIntent(parsedBody.message)

  try {
    if (intent === "bay_availability") {
      const snapshot = await getOpsSnapshot({
        userRole: sessionUser.role,
        terminalId: sessionUser.terminalId,
        clientId: sessionUser.clientId,
      })
      const computed = buildBayAvailabilityResponse({
        snapshot,
        role: assistRole,
        message: parsedBody.message,
      })

      const payload = {
        reply_text: computed.replyText,
        urgency: computed.urgency,
        headline: computed.headline,
        terminal_state: computed.terminalState,
        metrics: computed.metrics,
        blockers: computed.blockers,
        action_buttons: computed.actions,
      }
      const roleSafe = clientRole
        ? {
            ...payload,
            ...redactAssistantResponse(role, {
              reply_text: payload.reply_text,
              urgency: payload.urgency,
              action_buttons: payload.action_buttons,
            }),
          }
        : payload

      await persistChatLog({
        userMessage: parsedBody.message,
        botResponse: roleSafe.reply_text,
        urgency: roleSafe.urgency,
        userId: sessionUser.id,
        intent,
      })

      return NextResponse.json(roleSafe, { headers: { "x-eipl-response-mode": "live" } })
    }

    if (intent === "document_help") {
      const payload = buildDocumentHelpResponse()
      await persistChatLog({
        userMessage: parsedBody.message,
        botResponse: payload.reply_text,
        urgency: payload.urgency,
        userId: sessionUser.id,
        intent,
      })
      return NextResponse.json(payload, { headers: { "x-eipl-response-mode": "live" } })
    }

    if (!OPENAI_API_KEY || !OPENAI_MODEL) {
      return NextResponse.json(
        { error: "Missing OPENAI API configuration. Set OPENAI_API_KEY (or CHATGPT_API_KEY)." },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
    let completion
    try {
      completion = await requestStructuredCompletion({
        openai,
        model: OPENAI_MODEL,
        message: parsedBody.message,
      })
    } catch (modelError) {
      const errText = modelError instanceof Error ? modelError.message.toLowerCase() : ""
      const canRetryWithDefault =
        OPENAI_MODEL !== "gpt-4o-mini" &&
        (errText.includes("model") || errText.includes("not found") || errText.includes("does not exist"))
      if (!canRetryWithDefault) {
        throw modelError
      }
      completion = await requestStructuredCompletion({
        openai,
        model: "gpt-4o-mini",
        message: parsedBody.message,
      })
    }

    const rawText = completion.choices[0]?.message?.content
    if (!rawText) {
      return NextResponse.json({ error: "Model returned an empty response." }, { status: 502 })
    }

    const validated = responseSchema.parse(JSON.parse(rawText))
    const payload = redactAssistantResponse(role, {
      reply_text: validated.reply_text,
      urgency: validated.urgency,
      action_buttons: safeActionButtons(validated.action_buttons),
    })

    await persistChatLog({
      userMessage: parsedBody.message,
      botResponse: payload.reply_text,
      urgency: payload.urgency,
      userId: sessionUser.id,
      intent: "general",
    })

    return NextResponse.json(payload, { headers: { "x-eipl-response-mode": "live" } })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown chat error"
    const errorStatus = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 0
    const isQuotaIssue =
      errorStatus === 429 ||
      errorMessage.toLowerCase().includes("insufficient_quota") ||
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("quota")

    let payload: {
      reply_text: string
      urgency: "low" | "medium" | "high"
      headline?: string
      terminal_state?: "OPEN" | "LIMITED" | "PAUSED"
      metrics?: Array<{ key: string; label: string; value: string; tooltip: string }>
      blockers?: Array<{ text: string; severity?: "low" | "medium" | "high" }>
      action_buttons: Array<{ label: string; url: string; tooltip?: string }>
    }

    try {
      const snapshot = await getOpsSnapshot({
        userRole: sessionUser.role,
        terminalId: sessionUser.terminalId,
        clientId: sessionUser.clientId,
      })
      const computed = buildBayAvailabilityResponse({
        snapshot,
        role: assistRole,
        message: parsedBody.message,
      })
      payload = {
        reply_text: `${computed.replyText} Live model is unavailable, so this is data-driven fallback output.`,
        urgency: computed.urgency,
        headline: computed.headline,
        terminal_state: computed.terminalState,
        metrics: computed.metrics,
        blockers: computed.blockers,
        action_buttons: computed.actions,
      }
    } catch {
      payload = clientRole
        ? {
            reply_text: "Terminal data temporarily unavailable. Please check your bookings page.",
            urgency: "medium",
            action_buttons: safeActionButtons([
              { label: "View my bookings", url: "/bookings", tooltip: "Track your booking and truck status." },
              { label: "Upload pending documents", url: "/client/documents", tooltip: "Upload required documents." },
              { label: "Contact support", url: "/contacts/control-room", tooltip: "Open support contacts." },
            ]),
          }
        : {
            reply_text:
              "EIPL Assist is in fallback mode. Continue with HSE checklist, gate-in docs, and control room escalation.",
            urgency: isQuotaIssue ? "medium" : "high",
            action_buttons: safeActionButtons([
              { label: "Open HSE", url: "/hse", tooltip: "Open HSE dashboard and check active controls." },
              { label: "Contact Control Room", url: "/contacts/control-room", tooltip: "Escalate blocked movement to control room." },
              { label: "Open Dashboard", url: "/dashboard", tooltip: "Use dashboard while AI services recover." },
            ]),
          }
    }

    if (clientRole) {
      payload = {
        ...payload,
        reply_text: sanitizeForClient(payload.reply_text),
        action_buttons: redactAssistantResponse(role, {
          reply_text: payload.reply_text,
          urgency: payload.urgency,
          action_buttons: payload.action_buttons,
        }).action_buttons,
        blockers: [],
      }
    }

    await persistChatLog({
      userMessage: parsedBody.message,
      botResponse: payload.reply_text,
      urgency: payload.urgency,
      userId: sessionUser.id,
      intent: isQuotaIssue ? "quota_fallback" : "runtime_fallback",
    })

    return NextResponse.json(payload, { headers: { "x-eipl-response-mode": "fallback" } })
  }
}

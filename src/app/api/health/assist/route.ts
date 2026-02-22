import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getSessionUser } from "@/lib/auth-utils"
import { getUserRole, isInternalRole } from "@/lib/security/rbac"

type ErrorCategory =
  | "none"
  | "config"
  | "auth"
  | "quota"
  | "model"
  | "network"
  | "rate_limit"
  | "unknown"

function categorizeError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 0

  if (!message && status === 0) return "unknown"
  if (status === 401 || message.includes("invalid api key") || message.includes("unauthorized")) return "auth"
  if (status === 429 || message.includes("quota") || message.includes("insufficient_quota")) return "quota"
  if (message.includes("rate limit")) return "rate_limit"
  if (status === 404 || message.includes("model") || message.includes("does not exist") || message.includes("not found")) return "model"
  if (message.includes("network") || message.includes("timeout") || message.includes("fetch failed")) return "network"
  return "unknown"
}

async function probeModel(openai: OpenAI, model: string) {
  await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Health probe." },
      { role: "user", content: "ok" },
    ],
    max_completion_tokens: 5,
  })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = getUserRole(user)
  if (!isInternalRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const key = process.env.OPENAI_API_KEY ?? process.env.CHATGPT_API_KEY
  const configuredModel = process.env.OPENAI_MODEL ?? process.env.CHATGPT_MODEL ?? "gpt-4o-mini"
  const fallbackModel = "gpt-4o-mini"
  const providerConfigured = Boolean(key)

  const base = {
    ok: false,
    provider: "openai",
    provider_configured: providerConfigured,
    model_configured: configuredModel,
    model_attempted: configuredModel,
    fallback_model: fallbackModel,
    fallback_attempted: false,
    fallback_used: false,
    last_error_category: "none" as ErrorCategory,
    timestamp: new Date().toISOString(),
  }

  if (!providerConfigured) {
    return NextResponse.json(
      {
        ...base,
        last_error_category: "config" as ErrorCategory,
      },
      { status: 200 }
    )
  }

  const openai = new OpenAI({ apiKey: key })
  try {
    await probeModel(openai, configuredModel)
    return NextResponse.json({
      ...base,
      ok: true,
    })
  } catch (error) {
    const firstCategory = categorizeError(error)
    const modelRetryAllowed =
      configuredModel !== fallbackModel &&
      (firstCategory === "model" ||
        (error instanceof Error &&
          (error.message.toLowerCase().includes("model") || error.message.toLowerCase().includes("not found"))))

    if (!modelRetryAllowed) {
      return NextResponse.json({
        ...base,
        last_error_category: firstCategory,
      })
    }

    try {
      await probeModel(openai, fallbackModel)
      return NextResponse.json({
        ...base,
        ok: true,
        model_attempted: fallbackModel,
        fallback_attempted: true,
        fallback_used: true,
        last_error_category: "none" as ErrorCategory,
      })
    } catch (fallbackError) {
      return NextResponse.json({
        ...base,
        model_attempted: fallbackModel,
        fallback_attempted: true,
        last_error_category: categorizeError(fallbackError),
      })
    }
  }
}

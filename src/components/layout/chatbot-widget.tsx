"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { MessageCircle, X, Send, Bot, ArrowRight, Loader2 } from "lucide-react"
import type { CopilotMessage, ChatAction } from "@/lib/copilot/response-builder"
import { AssistActionButton, resolveActionHref } from "@/components/layout/assist-action-button"
import { ApprovalChatCard } from "@/components/intelligence/ApprovalChatCard"
import EIPLBotMessage from "@/components/layout/EIPLBotMessage"
import type { AssistResponse, ChatRole as AssistChatRole } from "../../../types/assistResponse"
import { guardAssistAction } from "@/lib/assist/action-route-guard"

type ChatRole = any

type ChatMessage = {
  id: string
  sender: "bot" | "user"
  text: string
  actions?: ChatAction[]
  assistResponse?: AssistResponse
  approvalCard?: CopilotMessage["approvalCard"]
  geminiPayload?: {
    reply_text?: string
    action_buttons?: Array<{ label: string; url: string; urgency?: string; tooltip?: string }>
    response_mode?: "live" | "fallback"
    headline?: string
    terminal_state?: "OPEN" | "LIMITED" | "PAUSED"
    metrics?: Array<{ key: string; label: string; value: string; tooltip: string }>
    blockers?: Array<{ text: string; severity?: "low" | "medium" | "high" }>
  }
  breakdown?: string[]
  recommendedActions?: string[]
  source?: string
  timestamp?: string
  isOpsMetric?: boolean
  isLoading?: boolean
  error?: string
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const SUGGESTED_CHIPS = [
  "How many trucks in terminal?",
  "Safety report",
  "Bay utilization",
  "Open dashboard",
]

const CHAT_REQUEST_TIMEOUT_MS = 12000

type StructuredChatResponse = {
  reply_text: string
  urgency: "low" | "medium" | "high"
  action_buttons: Array<{ label: string; url: string; tooltip?: string }>
  headline?: string
  terminal_state?: "OPEN" | "LIMITED" | "PAUSED"
  metrics?: Array<{ key: string; label: string; value: string; tooltip: string }>
  blockers?: Array<{ text: string; severity?: "low" | "medium" | "high" }>
}

type ChatResponseMode = "live" | "fallback"

function toAssistRole(role: any): AssistChatRole {
  return role === "CLIENT" || role === "TRANSPORTER" ? "external_client" : "internal_ops"
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function getRecommendedActionTarget(text: string): ChatAction | null {
  const t = text.toLowerCase()
  if (t.includes("hse") || t.includes("safety") || t.includes("incident") || t.includes("stop-work")) {
    return { id: "rec-hse", label: text, href: "/hse" }
  }
  if (t.includes("dashboard")) {
    return { id: "rec-dashboard", label: text, href: "/dashboard" }
  }
  if (t.includes("controller") || t.includes("bay assignment")) {
    return { id: "rec-controller", label: text, href: "/controller/console" }
  }
  if (t.includes("booking")) {
    return { id: "rec-bookings", label: text, href: "/bookings" }
  }
  if (t.includes("report")) {
    return { id: "rec-reports", label: text, href: "/reports" }
  }
  if (t.includes("gate")) {
    return { id: "rec-gate", label: text, href: "/security/gate" }
  }
  return null
}

function isStructuredChatResponse(data: unknown): data is StructuredChatResponse {
  if (!data || typeof data !== "object") return false
  const payload = data as StructuredChatResponse
  const metricsOk =
    payload.metrics === undefined ||
    (Array.isArray(payload.metrics) &&
      payload.metrics.every(
        (metric) =>
          typeof metric?.key === "string" &&
          typeof metric?.label === "string" &&
          typeof metric?.value === "string" &&
          typeof metric?.tooltip === "string"
      ))
  const blockersOk =
    payload.blockers === undefined ||
    (Array.isArray(payload.blockers) &&
      payload.blockers.every((blocker) => typeof blocker?.text === "string"))
  return (
    typeof payload.reply_text === "string" &&
    (payload.urgency === "low" || payload.urgency === "medium" || payload.urgency === "high") &&
    Array.isArray(payload.action_buttons) &&
    payload.action_buttons.every((button) => typeof button?.label === "string" && typeof button?.url === "string") &&
    metricsOk &&
    blockersOk
  )
}

export function ChatbotWidget({ role }: { role: ChatRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      sender: "bot",
      text: "Hi! I'm EIPL Assist. Ask me about metrics, safety, or navigation.",
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const assistRole = useMemo(() => toAssistRole(role), [role])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function runAction(action: ChatAction) {
    if (action.action === "signout") {
      signOut({ callbackUrl: "/login" })
      return
    }
    const href = resolveActionHref(action)
    const guarded = guardAssistAction({ label: action.label, href })
    router.push(guarded.href)
    setOpen(false)
  }

  const requestChatResponse = useCallback(async (userText: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || `Assistant request failed (${res.status})`)
      }

      const payload = await res.json()
      if (!isStructuredChatResponse(payload)) {
        throw new Error("Assistant returned an invalid response format.")
      }

      const headerMode = res.headers.get("x-eipl-response-mode")
      const responseMode: ChatResponseMode = headerMode === "live" ? "live" : "fallback"

      return { payload, responseMode }
    } finally {
      clearTimeout(timeout)
    }
  }, [])

  const handleMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = { id: makeId(), sender: "user", text: trimmed }
    const loadingId = makeId()
    setMessages((prev) => [...prev, userMessage, { id: loadingId, sender: "bot", text: "EIPL Assist is typing...", isLoading: true }])
    setInput("")
    setIsSending(true)

    try {
      const { payload, responseMode } = await requestChatResponse(trimmed)
      const geminiPayload: NonNullable<ChatMessage["geminiPayload"]> = {
        reply_text: payload.reply_text,
        action_buttons: payload.action_buttons.map((button) => ({
          ...button,
          urgency: payload.urgency,
        })),
        response_mode: responseMode,
        ...(("headline" in payload || "metrics" in payload || "blockers" in payload || "terminal_state" in payload)
          ? {
              headline: payload.headline,
              terminal_state: payload.terminal_state,
              metrics: payload.metrics,
              blockers: payload.blockers,
            }
          : {}),
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                sender: "bot" as const,
                text: payload.reply_text,
                geminiPayload,
                isLoading: false,
              }
            : m
        )
      )
    } catch (err) {
      const errorText =
        err instanceof Error && err.name === "AbortError"
          ? "EIPL Assist timed out. Please try again."
          : err instanceof Error && err.message
            ? err.message
            : "EIPL Assist is temporarily unavailable. Please try again."
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                sender: "bot" as const,
                text: errorText,
                error: errorText,
                isLoading: false,
              }
            : m
        )
      )
    } finally {
      setIsSending(false)
    }
  }, [isSending, requestChatResponse])
  function handleChip(chip: string) {
    handleMessage(chip)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-blue-700 bg-blue-700 text-white shadow-xl transition-[background-color,border-color,color,box-shadow,transform] motion-standard hover:bg-blue-800"
        aria-label="Open assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-x-5 bottom-20 z-[70] flex max-h-[calc(100vh-6.5rem)] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl sm:left-auto sm:right-5 sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2.5">
            <Bot className="h-4 w-4 text-blue-700" />
            <div>
              <p className="text-sm font-semibold text-slate-900">EIPL Assist</p>
              <p className="text-xs text-slate-600">Your operational assistant for metrics and safety.</p>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message, idx) => (
              <div key={message.id}>
                {/* Message bubble */}
                {message.sender === "bot" && message.geminiPayload ? (
                  <EIPLBotMessage payload={message.geminiPayload} />
                ) : (
                  <div
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                      message.sender === "user"
                        ? "ml-auto border border-blue-700 bg-blue-700 text-white"
                        : "border border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-slate-600">EIPL Assist is typing...</span>
                    </div>
                    ) : (
                      <>
                      {/* Main text */}
                      {message.isOpsMetric ? (
                        <p className="font-medium">{message.text}</p>
                      ) : (
                        message.text
                      )}

                      {/* Breakdown */}
                      {message.breakdown && message.breakdown.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
                          {message.breakdown.map((line, i) => (
                            <li key={i} className={/^\s*[-*]/.test(line) || line.startsWith("  ") ? "ml-2" : ""}>
                              {line || "\u00A0"}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Structured assist contract */}
                      {message.assistResponse && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs font-semibold text-slate-900">{message.assistResponse.headline}</p>
                          <p className="mt-0.5 text-xs text-slate-700">{message.assistResponse.summary}</p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            {message.assistResponse.status.label} ({message.assistResponse.status.severity})
                          </p>

                          {message.assistResponse.metrics.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {message.assistResponse.metrics.slice(0, 4).map((m) => (
                                <div key={`${m.label}-${m.value}`} title={m.hint || `${m.label}: ${m.value}`} className="rounded border border-slate-200 bg-white px-2 py-1">
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</p>
                                  <p className="text-xs font-semibold text-slate-900">{m.value}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {message.assistResponse.blockers && (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                {message.assistResponse.blockers.title}
                              </p>
                              <ul className="mt-1 space-y-1 text-xs text-slate-700">
                                {message.assistResponse.blockers.items.slice(0, 3).map((item, i) => (
                                  <li key={`${item.text}-${i}`}>- {item.text}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {message.assistResponse.actions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.assistResponse.actions
                                .filter((a) => !a.visibility || a.visibility.includes(assistRole))
                                .slice(0, 3)
                                .map((action) => (
                                  <AssistActionButton
                                    key={action.id}
                                    title={action.tooltip}
                                    action={action}
                                    onNavigate={() => setOpen(false)}
                                    className={
                                      action.primary
                                        ? "rounded-md border border-blue-700 bg-blue-700 px-3 py-1.5 text-[12px] font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-blue-800"
                                        : "rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-slate-100"
                                    }
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {message.recommendedActions && message.recommendedActions.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                            Recommended
                          </p>
                          <ul className="mt-1 space-y-1 text-xs">
                            {message.recommendedActions.map((action, i) => (
                              (() => {
                                const mappedAction = getRecommendedActionTarget(action)
                                return (
                                  <li key={i}>
                                    {mappedAction ? (
                                      <button
                                        type="button"
                                        title={`Open ${mappedAction.label}`}
                                        onClick={() => runAction(mappedAction)}
                                        className="flex w-full items-start gap-1 rounded-md border border-blue-700 bg-blue-50 px-2 py-1 text-left text-blue-800 transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-blue-100"
                                      >
                                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span>{action}</span>
                                      </button>
                                    ) : (
                                      <div className="flex items-start gap-1 text-slate-700">
                                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span>{action}</span>
                                      </div>
                                    )}
                                  </li>
                                )
                              })()
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Source footer */}
                      {message.source && (
                        <p className="mt-1.5 text-[10px] text-slate-600">
                          {message.source}
                          {message.timestamp && ` - ${relativeTime(message.timestamp)}`}
                        </p>
                      )}
                      </>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <AssistActionButton
                        key={action.id}
                        action={action}
                        onNavigate={() => setOpen(false)}
                        className={
                          action.primary
                            ? "rounded-md border border-blue-700 bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-blue-800"
                            : "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-slate-100"
                        }
                      />
                    ))}
                  </div>
                )}

                {message.approvalCard && (
                  <div className="mt-2">
                    <ApprovalChatCard payload={message.approvalCard} />
                  </div>
                )}

                {/* Suggested chips after welcome message */}
                {idx === 0 && message.sender === "bot" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTED_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChip(chip)}
                        disabled={isSending}
                        className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 transition-[background-color,border-color,color,box-shadow,transform] motion-fast hover:bg-slate-100"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSending) {
                    e.preventDefault()
                    handleMessage(input)
                  }
                }}
                placeholder="Ask: metrics, safety, navigate..."
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition-[background-color,border-color,color,box-shadow,transform] motion-standard placeholder:text-slate-500 focus:border-blue-700 focus:shadow-[0_0_0_2px_rgba(29,78,216,0.18)]"
              />
              <button
                type="button"
                onClick={() => handleMessage(input)}
                disabled={isSending || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-white transition-[background-color,border-color,color,box-shadow,transform] motion-standard hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


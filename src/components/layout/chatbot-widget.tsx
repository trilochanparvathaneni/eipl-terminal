"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { MessageCircle, X, Send, Bot, ArrowRight, Loader2 } from "lucide-react"
import { getNavItems } from "@/lib/rbac"
import { classifyIntent } from "@/lib/copilot/intent-classifier"
import type { CopilotMessage, ChatAction } from "@/lib/copilot/response-builder"

type ChatRole = any

type ChatMessage = {
  id: string
  sender: "bot" | "user"
  text: string
  actions?: ChatAction[]
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
const CHAT_MAX_RETRIES = 2

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

export function ChatbotWidget({ role }: { role: ChatRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      sender: "bot",
      text: "Hi! I'm EIPL Assist. Ask me about metrics, safety, or navigation.",
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const navItems = useMemo(() => getNavItems(role), [role])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function runAction(action: ChatAction) {
    if (action.action === "signout") {
      signOut({ callbackUrl: "/login" })
      return
    }
    if (action.href) {
      router.push(action.href)
      setOpen(false)
    }
  }

  const getNavReply = useCallback((query: string): ChatMessage | null => {
    const q = query.trim().toLowerCase()

    if (q.includes("sign out") || q.includes("logout") || q.includes("log out")) {
      return {
        id: makeId(),
        sender: "bot",
        text: "You can sign out from here.",
        actions: [{ id: "signout", label: "Sign out", action: "signout" }],
      }
    }

    if (q.includes("notification")) {
      return {
        id: makeId(),
        sender: "bot",
        text: "Opening notifications.",
        actions: [{ id: "notifications", label: "Notifications", href: "/notifications" }],
      }
    }

    const directMatch = navItems.find((item) => q.includes(item.label.toLowerCase()))
    if (directMatch) {
      return {
        id: makeId(),
        sender: "bot",
        text: `Opening ${directMatch.label}.`,
        actions: [{ id: directMatch.href, label: directMatch.label, href: directMatch.href }],
      }
    }

    const keywordMatch = navItems.find((item) =>
      q.split(/\s+/).some((token) => item.label.toLowerCase().includes(token))
    )
    if (keywordMatch) {
      return {
        id: makeId(),
        sender: "bot",
        text: `Did you mean ${keywordMatch.label}?`,
        actions: [{ id: keywordMatch.href, label: keywordMatch.label, href: keywordMatch.href }],
      }
    }

    return null
  }, [navItems])

  const requestOpsResponse = useCallback(
    async (toolId: string, extractedParams: Record<string, string>) => {
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= CHAT_MAX_RETRIES; attempt += 1) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS)

        try {
          const res = await fetch("/api/chat/ops", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolId, extractedParams }),
            signal: controller.signal,
          })
          clearTimeout(timeout)

          if (!res.ok) {
            const payload = await res.json().catch(() => null)
            const message = payload?.text || payload?.error || `Assistant request failed (${res.status})`
            throw new Error(message)
          }

          return (await res.json()) as CopilotMessage
        } catch (err) {
          clearTimeout(timeout)
          lastError = err instanceof Error ? err : new Error("Unknown assistant error")
          if (attempt < CHAT_MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
          }
        }
      }

      throw lastError ?? new Error("Assistant request failed")
    },
    []
  )

  const handleMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMessage: ChatMessage = { id: makeId(), sender: "user", text: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Classify intent
    const intent = classifyIntent(trimmed, role)

    // Permission denied
    if (intent.permissionDenied) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          sender: "bot",
          text: "You don't have access to this data. Contact your administrator if you believe this is an error.",
          error: `Permission denied for ${intent.toolId}`,
        },
      ])
      return
    }

    // Navigation intent — handle locally
    if (intent.category === "navigation" || !intent.toolId) {
      const navReply = getNavReply(trimmed)
      if (navReply) {
        setMessages((prev) => [...prev, navReply])
        return
      }

      // Fallback
      const quickActions: ChatAction[] = navItems.slice(0, 4).map((item) => ({
        id: item.href,
        label: item.label,
        href: item.href,
      }))
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          sender: "bot",
          text: "I can help with navigation or ops questions. Choose a destination or ask about metrics:",
          actions: quickActions,
        },
      ])
      return
    }

    // Ops / Safety / Action intent — call server
    const loadingId = makeId()
    setMessages((prev) => [
      ...prev,
      { id: loadingId, sender: "bot", text: "Fetching data...", isLoading: true },
    ])

    try {
      const data = await requestOpsResponse(intent.toolId, intent.extractedParams)

      // Replace loading message with response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...data,
                id: loadingId,
                sender: "bot" as const,
                isLoading: false,
              }
            : m
        )
      )
    } catch (err) {
      const errorText =
        err instanceof Error && err.name === "AbortError"
          ? "EIPL Assist timed out. Retrying usually resolves this."
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
    }
  }, [role, navItems, getNavReply, requestOpsResponse])

  function handleChip(chip: string) {
    handleMessage(chip)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-[#0f172a] text-slate-100 shadow-xl transition-all duration-300 ease-in-out hover:bg-[#1e293b]"
        aria-label="Open assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-x-5 bottom-20 z-[70] flex max-h-[calc(100vh-6.5rem)] w-auto flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-md sm:left-auto sm:right-5 sm:w-[360px]">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
            <Bot className="h-4 w-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">EIPL Assist</p>
              <p className="text-xs text-slate-400">Your operational assistant for metrics and safety.</p>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message, idx) => (
              <div key={message.id}>
                {/* Message bubble */}
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                    message.sender === "user"
                      ? "ml-auto bg-white/15 text-slate-50"
                      : "bg-white/[0.06] text-slate-100"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-slate-400">Fetching data...</span>
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
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                          {message.breakdown.map((line, i) => (
                            <li key={i} className={line.startsWith("•") || line.startsWith("  ") ? "ml-2" : ""}>
                              {line || "\u00A0"}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Recommended Actions */}
                      {message.recommendedActions && message.recommendedActions.length > 0 && (
                        <div className="mt-2 border-t border-white/10 pt-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                                        onClick={() => runAction(mappedAction)}
                                        className="flex w-full items-start gap-1 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-left text-sky-200 transition-all duration-300 ease-in-out hover:bg-sky-500/20"
                                      >
                                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span>{action}</span>
                                      </button>
                                    ) : (
                                      <div className="flex items-start gap-1 text-slate-300">
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
                        <p className="mt-1.5 text-[10px] text-slate-400">
                          {message.source}
                          {message.timestamp && ` · ${relativeTime(message.timestamp)}`}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => runAction(action)}
                        className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-all duration-300 ease-in-out hover:bg-white/[0.1]"
                      >
                        {action.label}
                      </button>
                    ))}
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
                        className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-200 transition-all duration-300 ease-in-out hover:bg-sky-500/25"
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
          <div className="border-t border-white/10 p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleMessage(input)
                  }
                }}
                placeholder="Ask: metrics, safety, navigate..."
                className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none transition-all duration-300 ease-in-out placeholder:text-slate-400 focus:border-sky-400/70 focus:shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              />
              <button
                type="button"
                onClick={() => handleMessage(input)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1e3a8a] text-white transition-all duration-300 ease-in-out hover:bg-[#1e40af]"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

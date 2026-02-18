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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export function ChatbotWidget({ role }: { role: ChatRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      sender: "bot",
      text: "Hi! I'm the EIPL Ops Digital Twin. Ask me about metrics, safety, or navigate the app.",
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
      const res = await fetch("/api/chat/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: intent.toolId,
          extractedParams: intent.extractedParams,
        }),
      })

      const data: CopilotMessage = await res.json()

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
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                sender: "bot" as const,
                text: "Something went wrong. Please check your connection and try again.",
                error: "Network error",
                isLoading: false,
              }
            : m
        )
      )
    }
  }, [role, navItems, getNavReply])

  function handleChip(chip: string) {
    handleMessage(chip)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-700"
        aria-label="Open assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <Bot className="h-4 w-4 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">EIPL Ops Digital Twin</p>
              <p className="text-xs text-slate-500">Metrics, safety, and navigation</p>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-[360px] space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message, idx) => (
              <div key={message.id}>
                {/* Message bubble */}
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                    message.sender === "user"
                      ? "ml-auto bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-slate-500">Fetching data...</span>
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
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                          {message.breakdown.map((line, i) => (
                            <li key={i} className={line.startsWith("•") || line.startsWith("  ") ? "ml-2" : ""}>
                              {line || "\u00A0"}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Recommended Actions */}
                      {message.recommendedActions && message.recommendedActions.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Recommended
                          </p>
                          <ul className="mt-0.5 space-y-0.5 text-xs text-indigo-700">
                            {message.recommendedActions.map((action, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{action}</span>
                              </li>
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
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
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
          <div className="border-t border-slate-200 p-2.5">
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
                className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-300"
              />
              <button
                type="button"
                onClick={() => handleMessage(input)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
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

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { MessageCircle, X, Send, Bot } from "lucide-react"
import { getNavItems } from "@/lib/rbac"

type ChatRole = any

type ChatAction = {
  id: string
  label: string
  href?: string
  action?: "signout"
}

type ChatMessage = {
  id: string
  sender: "bot" | "user"
  text: string
  actions?: ChatAction[]
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatbotWidget({ role }: { role: ChatRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      sender: "bot",
      text: "Hi, I can help you navigate this app. Try: open reports, go to bookings, notifications, or sign out.",
    },
  ])

  const navItems = useMemo(() => getNavItems(role), [role])

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

  function getBotReply(query: string): ChatMessage {
    const q = query.trim().toLowerCase()

    if (!q) {
      return { id: makeId(), sender: "bot", text: "Type a question or command, like open dashboard." }
    }

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

    const quickActions: ChatAction[] = navItems.slice(0, 4).map((item) => ({
      id: item.href,
      label: item.label,
      href: item.href,
    }))

    return {
      id: makeId(),
      sender: "bot",
      text: "I can help with navigation. Choose a quick destination:",
      actions: quickActions,
    }
  }

  function submitMessage() {
    const text = input.trim()
    if (!text) return

    const userMessage: ChatMessage = { id: makeId(), sender: "user", text }
    const botReply = getBotReply(text)
    setMessages((prev) => [...prev, userMessage, botReply])
    setInput("")
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
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <Bot className="h-4 w-4 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Ops Assistant</p>
              <p className="text-xs text-slate-500">Navigation and quick actions</p>
            </div>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                    message.sender === "user"
                      ? "ml-auto bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {message.text}
                </div>
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
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitMessage()
                  }
                }}
                placeholder="Ask: open dashboard, reports..."
                className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-300"
              />
              <button
                type="button"
                onClick={submitMessage}
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

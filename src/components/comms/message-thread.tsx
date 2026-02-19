"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageComposer } from "./message-composer"
import { Button } from "@/components/ui/button"
import { CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface MentionedUser {
  id: string
  name: string
  role: string
}

interface MessageMention {
  id: string
  mentionedUser: MentionedUser
  mentionType: string
}

interface Message {
  id: string
  body: string
  createdAt: string
  deletedAt: string | null
  sender: { id: string; name: string; role: string }
  mentions: MessageMention[]
}

interface MessageThreadProps {
  conversationId: string
  currentUserId: string
  onCreateTask: (messageId: string, messageBody: string) => void
}

function renderBody(body: string, mentions: MessageMention[]) {
  if (mentions.length === 0) return <span>{body}</span>

  // Highlight @mentions in the body text
  const parts: React.ReactNode[] = []
  let remaining = body

  for (const mention of mentions) {
    const tag = `@${mention.mentionedUser.name}`
    const idx = remaining.indexOf(tag)
    if (idx !== -1) {
      if (idx > 0) parts.push(remaining.slice(0, idx))
      parts.push(
        <span
          key={mention.id}
          className={cn(
            "px-1 rounded text-xs font-semibold",
            mention.mentionType === "INTERNAL"
              ? "bg-primary/10 text-primary"
              : "bg-amber-100 text-amber-700"
          )}
        >
          {tag}
        </span>
      )
      remaining = remaining.slice(idx + tag.length)
    }
  }
  if (remaining) parts.push(remaining)
  return <>{parts}</>
}

export function MessageThread({ conversationId, currentUserId, onCreateTask }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/comms/conversations/${conversationId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        if (data.messages.length > 0) {
          lastMessageIdRef.current = data.messages[data.messages.length - 1].id
        }
      }
    } catch {
      // ignore
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()

    const url = lastMessageIdRef.current
      ? `/api/comms/conversations/${conversationId}/stream?lastId=${lastMessageIdRef.current}`
      : `/api/comms/conversations/${conversationId}/stream`

    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener("message", (e) => {
      const payload = JSON.parse(e.data)
      setMessages((prev) =>
        prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]
      )
    })

    es.addEventListener("cursor", (e) => {
      const payload = JSON.parse(e.data)
      lastMessageIdRef.current = payload.lastId
    })

    return () => {
      es.close()
      esRef.current = null
    }
  }, [conversationId, fetchMessages])

  // Read-receipt: mark conversation read on open and as new messages arrive
  useEffect(() => {
    if (!conversationId) return
    fetch(`/api/comms/conversations/${conversationId}/read`, { method: "PATCH" }).catch(() => {})
  }, [conversationId, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender.id === currentUserId
          return (
            <div
              key={msg.id}
              className={cn("flex gap-3", isOwn && "flex-row-reverse")}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                {msg.sender.name.charAt(0).toUpperCase()}
              </div>
              <div className={cn("max-w-[70%] space-y-1", isOwn && "items-end")}>
                <div className={cn("flex items-center gap-2", isOwn && "flex-row-reverse")}>
                  <span className="text-xs font-medium">{msg.sender.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {hoveredId === msg.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title="Create task from message"
                      onClick={() => onCreateTask(msg.id, msg.body)}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm leading-relaxed",
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {renderBody(msg.body, msg.mentions)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <MessageComposer conversationId={conversationId} onSent={fetchMessages} />
    </div>
  )
}

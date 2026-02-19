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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/comms/conversations/${conversationId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
      }
    } catch {
      // ignore
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()
    intervalRef.current = setInterval(fetchMessages, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMessages])

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

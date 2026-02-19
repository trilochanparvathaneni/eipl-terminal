"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MentionPicker } from "./mention-picker"
import { Send } from "lucide-react"

interface Mention {
  userId: string
  mentionType: "INTERNAL" | "EXTERNAL"
  name: string
}

interface MessageComposerProps {
  conversationId: string
  onSent: () => void
}

export function MessageComposer({ conversationId, onSent }: MessageComposerProps) {
  const [body, setBody] = useState("")
  const [mentions, setMentions] = useState<Mention[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleChange(value: string) {
    setBody(value)

    // Detect @ trigger: find @ preceded by space/start before cursor
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
    } else {
      setMentionQuery(null)
    }
  }

  function handleMentionSelect(user: { id: string; name: string; mentionType: "INTERNAL" | "EXTERNAL" }) {
    // Replace the @query in the text
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const textBefore = body.slice(0, cursor)
    const atIndex = textBefore.lastIndexOf("@")
    const newBody =
      body.slice(0, atIndex) + `@${user.name} ` + body.slice(cursor)

    setBody(newBody)
    setMentionQuery(null)
    setMentions((prev) => {
      if (prev.some((m) => m.userId === user.id)) return prev
      return [...prev, { userId: user.id, mentionType: user.mentionType, name: user.name }]
    })

    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/comms/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          mentions: mentions.map((m) => ({ userId: m.userId, mentionType: m.mentionType })),
        }),
      })

      if (res.ok) {
        setBody("")
        setMentions([])
        setMentionQuery(null)
        onSent()
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !mentionQuery) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === "Escape") {
      setMentionQuery(null)
    }
  }

  return (
    <div className="border-t p-3 bg-background relative">
      {mentionQuery !== null && (
        <MentionPicker
          query={mentionQuery}
          conversationId={conversationId}
          onSelect={handleMentionSelect}
          onClose={() => setMentionQuery(null)}
        />
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... Use @ to mention someone"
            className="min-h-[60px] max-h-[200px] resize-none pr-2"
            disabled={sending}
          />
          {mentions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {mentions.map((m) => (
                <span
                  key={m.userId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                >
                  @{m.name}
                  <button
                    type="button"
                    className="hover:text-destructive"
                    onClick={() => setMentions((prev) => prev.filter((x) => x.userId !== m.userId))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="mb-0.5"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Enter to send · Shift+Enter for new line · @ to mention
      </p>
    </div>
  )
}

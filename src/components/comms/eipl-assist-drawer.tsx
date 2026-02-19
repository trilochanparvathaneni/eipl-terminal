"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, FileText, MessageSquarePlus } from "lucide-react"

interface EiplAssistDrawerProps {
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AssistAction = "summarize" | "draft_reply" | null

export function EiplAssistDrawer({ conversationId, open, onOpenChange }: EiplAssistDrawerProps) {
  const [action, setAction] = useState<AssistAction>(null)
  const [response, setResponse] = useState<string>("")
  const [loading, setLoading] = useState(false)

  async function runAssist(type: AssistAction) {
    if (!type || loading) return

    setAction(type)
    setResponse("")
    setLoading(true)

    try {
      // Fetch last 20 messages from this conversation
      const msgRes = await fetch(
        `/api/comms/conversations/${conversationId}/messages?limit=20`
      )
      let messages: { sender: { name: string }; body: string }[] = []
      if (msgRes.ok) {
        const data = await msgRes.json()
        messages = data.messages
      }

      const threadText = messages
        .map((m) => `${m.sender.name}: ${m.body}`)
        .join("\n")

      const prompt =
        type === "summarize"
          ? `Please summarize the following conversation thread concisely:\n\n${threadText}`
          : `Based on this conversation thread, draft a professional reply:\n\n${threadText}`

      // Stream via existing chat endpoint
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      })

      if (!res.ok) {
        setResponse("Failed to get AI response. Please try again.")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.event === "delta") {
              setResponse((prev) => prev + event.content)
            }
          } catch {
            // skip malformed
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setAction(null)
      setResponse("")
      setLoading(false)
    }
    onOpenChange(value)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            EIPL Assist
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            AI-powered actions for this conversation thread.
          </p>

          <div className="flex gap-2">
            <Button
              variant={action === "summarize" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => runAssist("summarize")}
              disabled={loading}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Summarize Thread
            </Button>
            <Button
              variant={action === "draft_reply" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => runAssist("draft_reply")}
              disabled={loading}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
              Draft Reply
            </Button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {action === "summarize" ? "Summarizing thread..." : "Drafting reply..."}
              </span>
            </div>
          )}

          {response && (
            <div className="flex-1 rounded-md border bg-muted/30 p-4 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {action === "summarize" ? "Summary" : "Suggested Reply"}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{response}</p>
            </div>
          )}

          {!loading && !response && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Sparkles className="h-10 w-10 mx-auto text-violet-200" />
                <p className="text-sm text-muted-foreground">
                  Choose an action to get AI assistance with this conversation.
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

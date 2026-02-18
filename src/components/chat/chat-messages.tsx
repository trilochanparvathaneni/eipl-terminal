"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant" | "tool"
  content: string | null
  toolCallId?: string
  toolName?: string
  metadata?: any
}

interface ChatMessagesProps {
  messages: Message[]
  isStreaming: boolean
}

function formatContent(content: string): React.ReactNode {
  // Simple markdown: bold, lists, code blocks
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-muted rounded p-2 text-xs overflow-x-auto my-1">
            <code>{codeLines.join("\n")}</code>
          </pre>
        )
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Bold
    let formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')

    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />
      )
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: formatted.replace(/^\d+\.\s/, "") }} />
      )
    } else if (line.trim() === "") {
      elements.push(<br key={i} />)
    } else {
      elements.push(<p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />)
    }
  }

  return <div className="space-y-1">{elements}</div>
}

export function ChatMessages({ messages, isStreaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Filter out tool messages from display
  const visibleMessages = messages.filter((m) => m.role !== "tool")

  if (visibleMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Ask me anything about terminal operations</p>
          <p className="text-xs mt-1">I can look up bookings, trips, incidents, and documents</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {visibleMessages.map((msg) => (
        <div
          key={msg.id}
          className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
        >
          {msg.role === "assistant" && (
            <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-4 w-4" />
            </div>
          )}
          <div
            className={cn(
              "rounded-lg px-3 py-2 max-w-[75%] text-sm",
              msg.role === "user"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            {msg.content ? (
              msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                formatContent(msg.content)
              )
            ) : msg.role === "assistant" && isStreaming ? (
              <span className="inline-block w-2 h-4 bg-current animate-pulse" />
            ) : null}
          </div>
          {msg.role === "user" && (
            <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

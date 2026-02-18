"use client"

import { useState, useCallback } from "react"
import { ConversationList } from "@/components/chat/conversation-list"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { DataPanel } from "@/components/chat/data-panel"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant" | "tool"
  content: string | null
  toolCallId?: string
  toolName?: string
  metadata?: any
  createdAt?: string
}

interface ToolCallEvent {
  toolCallId: string
  name: string
  params: string
  result?: any
  citations?: { documentId: string; snippet: string }[]
  recordIds?: { type: string; id: string }[]
}

export function ChatPageClient() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id)
    setToolCalls([])
    try {
      const res = await fetch(`/api/chat/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(
          data.conversation.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCallId: m.toolCallId,
            toolName: m.toolName,
            metadata: m.metadata,
          }))
        )
      }
    } catch {
      // ignore
    }
  }, [])

  const handleNewConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setToolCalls([])
  }, [])

  const handleSend = useCallback(
    async (message: string) => {
      if (isStreaming) return

      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)

      const assistantMsg: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      }
      setMessages((prev) => [...prev, assistantMsg])

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to send message" }))
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: `Error: ${err.error || err.message}` } : m
            )
          )
          setIsStreaming(false)
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

              switch (event.event) {
                case "conversation":
                  if (!conversationId) {
                    setConversationId(event.conversationId)
                    setRefreshKey((k) => k + 1)
                  }
                  break

                case "delta":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, content: (m.content || "") + event.content }
                        : m
                    )
                  )
                  break

                case "tool_call":
                  setToolCalls((prev) => [
                    ...prev,
                    {
                      toolCallId: event.toolCallId,
                      name: event.name,
                      params: event.params,
                    },
                  ])
                  break

                case "tool_result":
                  setToolCalls((prev) =>
                    prev.map((tc) =>
                      tc.toolCallId === event.toolCallId
                        ? {
                            ...tc,
                            result: event.result,
                            citations: event.citations,
                            recordIds: event.recordIds,
                          }
                        : tc
                    )
                  )
                  break

                case "done":
                  break

                case "error":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, content: (m.content || "") + `\n\nError: ${event.message}` }
                        : m
                    )
                  )
                  break
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "Failed to connect to chat service" } : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [conversationId, isStreaming]
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel - Conversations */}
      {leftOpen && (
        <div className="w-64 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversations</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLeftOpen(false)}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <ConversationList
            activeId={conversationId}
            onSelect={loadConversation}
            onNew={handleNewConversation}
            refreshKey={refreshKey}
          />
        </div>
      )}

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-2 border-b flex items-center gap-2">
          {!leftOpen && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLeftOpen(true)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-semibold text-sm flex-1">
            {conversationId ? "Chat" : "New Conversation"}
          </h1>
          {!rightOpen && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightOpen(true)}>
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ChatMessages messages={messages} isStreaming={isStreaming} />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>

      {/* Right panel - Data */}
      {rightOpen && (
        <div className="w-72 border-l flex flex-col bg-muted/30">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Data Used</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightOpen(false)}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
          <DataPanel toolCalls={toolCalls} />
        </div>
      )}
    </div>
  )
}

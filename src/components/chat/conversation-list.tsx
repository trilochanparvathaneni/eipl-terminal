"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquarePlus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Conversation {
  id: string
  title: string | null
  updatedAt: string
  _count: { messages: number }
}

interface ConversationListProps {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  refreshKey: number
}

export function ConversationList({ activeId, onSelect, onNew, refreshKey }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [refreshKey])

  async function fetchConversations() {
    setLoading(true)
    try {
      const res = await fetch("/api/chat/conversations?limit=50")
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (activeId === id) onNew()
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onNew}>
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-muted text-sm",
                activeId === conv.id && "bg-muted"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <span className="flex-1 truncate">{conv.title || "Untitled"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => handleDelete(e, conv.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

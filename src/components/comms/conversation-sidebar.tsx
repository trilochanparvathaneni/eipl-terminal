"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { NewConversationDialog } from "./new-conversation-dialog"
import { Plus, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface Conversation {
  id: string
  title: string
  audience: string
  _count: { messages: number }
  createdAt: string
}

interface ConversationSidebarProps {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationSidebar({ activeId, onSelect }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchConversations() {
    try {
      const res = await fetch("/api/comms/conversations")
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

  async function fetchUnreadCounts() {
    try {
      const res = await fetch("/api/comms/conversations/unread-counts")
      if (res.ok) {
        const data = await res.json()
        setUnreadCounts(data.unreadCounts)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchConversations()
    fetchUnreadCounts()
  }, [])

  function handleCreated(id: string) {
    fetchConversations()
    onSelect(id)
    setDialogOpen(false)
  }

  function handleSelect(id: string) {
    onSelect(id)
    setTimeout(fetchUnreadCounts, 800)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDialogOpen(true)}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        )}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              Start one
            </Button>
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            className={cn(
              "w-full text-left rounded-md px-3 py-2.5 transition-colors",
              activeId === conv.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-foreground"
            )}
            onClick={() => handleSelect(conv.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    conv.audience === "INTERNAL_ONLY"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700",
                    activeId === conv.id && "bg-white/20 text-white"
                  )}
                >
                  {conv.audience === "INTERNAL_ONLY" ? "Internal" : "Mixed"}
                </span>
                {(unreadCounts[conv.id] ?? 0) > 0 && (
                  <span
                    className={cn(
                      "min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                      activeId === conv.id
                        ? "bg-white text-primary"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {unreadCounts[conv.id] > 99 ? "99+" : unreadCounts[conv.id]}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] mt-0.5 opacity-70">
              {conv._count.messages} message{conv._count.messages !== 1 ? "s" : ""}
            </p>
          </button>
        ))}
      </div>

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}

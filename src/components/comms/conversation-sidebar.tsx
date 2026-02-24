"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { NewConversationDialog } from "./new-conversation-dialog"
import { Plus, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

type ConvContextType = "BOOKING" | "CLIENT" | "TRANSPORTER" | "INCIDENT"

interface Conversation {
  id: string
  title: string
  audience: string
  contextType?: ConvContextType | null
  contextLabel?: string | null
  _count: { messages: number }
  createdAt: string
}

const CONTEXT_PILL: Record<ConvContextType, string> = {
  BOOKING:     "bg-sky-100 text-sky-700",
  CLIENT:      "bg-emerald-100 text-emerald-700",
  TRANSPORTER: "bg-amber-100 text-amber-700",
  INCIDENT:    "bg-red-100 text-red-700",
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
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground"
          onClick={() => setDialogOpen(true)}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <p className="py-4 text-center text-xs text-muted-foreground">Loading...</p>
        )}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
            <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
              Start one
            </Button>
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            className={cn(
              "w-full rounded-md px-3 py-2.5 text-left transition-all duration-300 ease-in-out",
              activeId === conv.id
                ? "bg-slate-200 text-slate-900"
                : "text-slate-700 hover:bg-slate-100"
            )}
            onClick={() => handleSelect(conv.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Context type badge */}
                {conv.contextType && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      activeId === conv.id
                        ? "bg-slate-700 text-white"
                        : CONTEXT_PILL[conv.contextType]
                    )}
                    title={conv.contextLabel ?? conv.contextType}
                  >
                    {conv.contextType.charAt(0) + conv.contextType.slice(1).toLowerCase()}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    conv.audience === "INTERNAL_ONLY"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-amber-100 text-amber-700",
                    activeId === conv.id && "bg-slate-700 text-white"
                  )}
                >
                  {conv.audience === "INTERNAL_ONLY" ? "Internal" : "Mixed"}
                </span>
                {(unreadCounts[conv.id] ?? 0) > 0 && (
                  <span
                    className={cn(
                      "min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                      activeId === conv.id
                        ? "bg-white text-slate-900"
                        : "bg-white/90 text-slate-900"
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

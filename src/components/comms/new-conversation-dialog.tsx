"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: NewConversationDialogProps) {
  const [title, setTitle] = useState("")
  const [audience, setAudience] = useState<"INTERNAL_ONLY" | "MIXED">("INTERNAL_ONLY")
  const [memberSearch, setMemberSearch] = useState("")
  const [memberResults, setMemberResults] = useState<
    { id: string; name: string; role: string }[]
  >([])
  const [selectedMembers, setSelectedMembers] = useState<
    { id: string; name: string; role: string }[]
  >([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function searchMembers(query: string) {
    if (!query.trim()) {
      setMemberResults([])
      return
    }
    try {
      const res = await fetch(`/api/comms/mentions/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        const all = [...data.internal, ...data.external].filter(
          (u: any) => !selectedMembers.some((m) => m.id === u.id)
        )
        setMemberResults(all)
      }
    } catch {
      // ignore
    }
  }

  function addMember(user: { id: string; name: string; role: string }) {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === user.id) ? prev : [...prev, user]
    )
    setMemberResults([])
    setMemberSearch("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/comms/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          audience,
          memberUserIds: selectedMembers.map((m) => m.id),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setTitle("")
        setAudience("INTERNAL_ONLY")
        setSelectedMembers([])
        onCreated(data.conversation.id)
      } else {
        const data = await res.json()
        setError(data.error || "Failed to create conversation")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="conv-title">Title</Label>
            <Input
              id="conv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Conversation title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="flex gap-4">
              {(["INTERNAL_ONLY", "MIXED"] as const).map((a) => (
                <label key={a} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="audience"
                    value={a}
                    checked={audience === a}
                    onChange={() => setAudience(a)}
                    className="accent-primary"
                  />
                  {a === "INTERNAL_ONLY" ? "Internal only" : "Mixed (includes clients)"}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Add Members (optional)</Label>
            <div className="relative">
              <Input
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value)
                  searchMembers(e.target.value)
                }}
                placeholder="Search team members..."
              />
              {memberResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
                  {memberResults.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                      onClick={() => addMember(u)}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                  >
                    {m.name}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMembers((prev) => prev.filter((x) => x.id !== m.id))
                      }
                      className="hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

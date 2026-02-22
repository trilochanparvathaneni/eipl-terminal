"use client"

import { useState, useEffect, useRef } from "react"
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
import { X } from "lucide-react"

type ContextType = "BOOKING" | "CLIENT" | "TRANSPORTER" | "INCIDENT"

interface ContextResult {
  id: string
  label: string
}

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}

const CONTEXT_TYPES: { value: ContextType; label: string; color: string }[] = [
  { value: "BOOKING",     label: "Booking",     color: "bg-sky-500/20 text-sky-200" },
  { value: "CLIENT",      label: "Client",      color: "bg-emerald-500/20 text-emerald-200" },
  { value: "TRANSPORTER", label: "Transporter", color: "bg-amber-500/20 text-amber-200" },
  { value: "INCIDENT",    label: "Incident",    color: "bg-red-500/20 text-red-200" },
]

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

  // Related-to context
  const [contextType, setContextType] = useState<ContextType | "">("")
  const [contextSearch, setContextSearch] = useState("")
  const [contextResults, setContextResults] = useState<ContextResult[]>([])
  const [selectedContext, setSelectedContext] = useState<ContextResult | null>(null)
  const contextDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("")
      setAudience("INTERNAL_ONLY")
      setMemberSearch("")
      setMemberResults([])
      setSelectedMembers([])
      setContextType("")
      setContextSearch("")
      setContextResults([])
      setSelectedContext(null)
      setError(null)
    }
  }, [open])

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

  function handleContextTypeChange(value: ContextType | "") {
    setContextType(value)
    setContextSearch("")
    setContextResults([])
    setSelectedContext(null)
  }

  function handleContextSearchChange(q: string) {
    setContextSearch(q)
    setSelectedContext(null)
    if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
    if (!q.trim() || !contextType) {
      setContextResults([])
      return
    }
    contextDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/comms/context-search?type=${contextType}&q=${encodeURIComponent(q)}`
        )
        if (res.ok) {
          const data = await res.json()
          setContextResults(data.results || [])
        }
      } catch {
        // ignore
      }
    }, 300)
  }

  function selectContextResult(result: ContextResult) {
    setSelectedContext(result)
    setContextSearch(result.label)
    setContextResults([])
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
          ...(contextType && selectedContext
            ? {
                contextType,
                contextId: selectedContext.id,
                contextLabel: selectedContext.label,
              }
            : {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onCreated(data.conversation.id)
      } else {
        const data = await res.json()
        setError(data.error || "Failed to create conversation")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedContextMeta = CONTEXT_TYPES.find((c) => c.value === contextType)

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

          {/* Related to */}
          <div className="space-y-1.5">
            <Label>Related to (optional)</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={contextType}
              onChange={(e) => handleContextTypeChange(e.target.value as ContextType | "")}
            >
              <option value="">None</option>
              {CONTEXT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>

            {contextType && !selectedContext && (
              <div className="relative">
                <Input
                  value={contextSearch}
                  onChange={(e) => handleContextSearchChange(e.target.value)}
                  placeholder={`Search ${selectedContextMeta?.label ?? ""}...`}
                />
                {contextResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
                    {contextResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => selectContextResult(r)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {contextType && selectedContext && (
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${selectedContextMeta?.color}`}
                >
                  {selectedContextMeta?.label}: {selectedContext.label}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContext(null)
                      setContextSearch("")
                    }}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
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
                      <span className="text-xs text-slate-400">{u.role}</span>
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
                      <X className="h-3 w-3" />
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

"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface MentionUser {
  id: string
  name: string
  email: string
  role: string
}

interface MentionPickerProps {
  query: string
  conversationId?: string
  onSelect: (user: MentionUser & { mentionType: "INTERNAL" | "EXTERNAL" }) => void
  onClose: () => void
}

export function MentionPicker({ query, conversationId, onSelect, onClose }: MentionPickerProps) {
  const [results, setResults] = useState<{ internal: MentionUser[]; external: MentionUser[] }>({
    internal: [],
    external: [],
  })
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        if (conversationId) params.set("conversationId", conversationId)
        const res = await fetch(`/api/comms/mentions/search?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, conversationId])

  const total = results.internal.length + results.external.length

  if (!loading && total === 0) return null

  return (
    <div className="absolute bottom-full mb-1 left-0 w-72 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
      {loading && (
        <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
      )}

      {results.internal.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
            Internal Team
          </div>
          {results.internal.map((user) => (
            <button
              key={user.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
              onClick={() => onSelect({ ...user, mentionType: "INTERNAL" })}
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.role}</p>
              </div>
            </button>
          ))}
        </>
      )}

      {results.external.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
            External Clients
          </div>
          {results.external.map((user) => (
            <button
              key={user.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
              onClick={() => onSelect({ ...user, mentionType: "EXTERNAL" })}
            >
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700 flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

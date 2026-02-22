"use client"

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Search } from "lucide-react"
import { Role } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "@/hooks/use-debounce"
import { getSearchableRoutes, CATEGORY_CONFIG } from "@/lib/search-routes"
import { searchRoutes, groupResultsByCategory, highlightMatch } from "@/lib/search"
import type { SearchableRoute } from "@/lib/search-routes"

interface GlobalSearchProps {
  role: Role
  className?: string
  onTour?: () => void
}

export const GlobalSearch = forwardRef<HTMLInputElement, GlobalSearchProps>(
  function GlobalSearch({ role, className, onTour }, ref) {
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const debouncedQuery = useDebounce(query, 300)
    const listRef = useRef<HTMLDivElement>(null)

    const routes = useMemo(() => getSearchableRoutes(role), [role])
    const matches = useMemo(() => searchRoutes(debouncedQuery, routes), [debouncedQuery, routes])
    const grouped = useMemo(() => groupResultsByCategory(matches), [matches])

    // Reset active index when results change
    useEffect(() => {
      setActiveIndex(-1)
    }, [debouncedQuery])

    // Scroll active item into view
    useEffect(() => {
      if (activeIndex < 0 || !listRef.current) return
      const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
      item?.scrollIntoView({ block: "nearest" })
    }, [activeIndex])

    const runAction = useCallback((route: SearchableRoute) => {
      setOpen(false)
      setQuery("")
      setActiveIndex(-1)

      if (route.id === "signout") {
        signOut({ callbackUrl: "/login" })
        return
      }

      if (route.id === "product-tour") {
        onTour?.()
        return
      }

      router.push(route.path)
    }, [router, onTour])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!open || matches.length === 0) {
          if (e.key === "Escape") {
            setOpen(false)
            ;(e.target as HTMLInputElement).blur()
          }
          return
        }

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault()
            setActiveIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0))
            break
          case "ArrowUp":
            e.preventDefault()
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1))
            break
          case "Enter":
            e.preventDefault()
            if (activeIndex >= 0) {
              runAction(matches[activeIndex].route)
            } else if (matches.length > 0) {
              runAction(matches[0].route)
            }
            break
          case "Escape":
            setOpen(false)
            setActiveIndex(-1)
            ;(e.target as HTMLInputElement).blur()
            break
        }
      },
      [open, matches, activeIndex, runAction]
    )

    // Build a flat index counter across grouped categories
    let flatIndex = 0

    return (
      <div className={className ?? "relative flex w-full min-w-0 items-center"} data-tour="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-listbox"
          aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setActiveIndex(-1) }, 120)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages and actions  ( / )"
          className="w-full min-w-0 rounded-full border border-slate-200 bg-white py-3 pl-10 pr-5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 ease-in-out focus:border-sky-400/70 focus:shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />

        {open && (
          <div
            ref={listRef}
            id="global-search-listbox"
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {matches.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-slate-600">No matching pages or actions.</div>
            ) : (
              <div className="py-1">
                {Array.from(grouped.entries()).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-3 pt-2 pb-1">
                      <Badge className={`${CATEGORY_CONFIG[category]} text-[10px] font-medium border-0 px-2 py-0`}>
                        {category}
                      </Badge>
                    </div>
                    {items.map((match) => {
                      const idx = flatIndex++
                      return (
                        <button
                          key={match.route.id}
                          id={`search-item-${idx}`}
                          data-index={idx}
                          role="option"
                          aria-selected={idx === activeIndex}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => runAction(match.route)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                            idx === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900">
                            {highlightMatch(match.route.name, debouncedQuery)}
                          </span>
                          {match.route.path && (
                            <span className="font-mono text-xs text-slate-500">{match.route.path}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

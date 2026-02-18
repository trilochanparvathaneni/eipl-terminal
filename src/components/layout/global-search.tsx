"use client"

import { forwardRef, useMemo, useState } from "react"
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
}

export const GlobalSearch = forwardRef<HTMLInputElement, GlobalSearchProps>(
  function GlobalSearch({ role, className }, ref) {
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const debouncedQuery = useDebounce(query, 300)

    const routes = useMemo(() => getSearchableRoutes(role), [role])
    const matches = useMemo(() => searchRoutes(debouncedQuery, routes), [debouncedQuery, routes])
    const grouped = useMemo(() => groupResultsByCategory(matches), [matches])

    function runAction(route: SearchableRoute) {
      setOpen(false)
      setQuery("")

      if (route.id === "signout") {
        signOut({ callbackUrl: "/login" })
        return
      }

      router.push(route.path)
    }

    return (
      <div className={className ?? "relative w-full max-w-[560px]"} data-tour="search">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              e.preventDefault()
              runAction(matches[0].route)
            }
            if (e.key === "Escape") {
              setOpen(false)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder="Search pages and actions ( / )"
          className="h-8 w-full rounded-full border border-transparent bg-slate-100 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-300 focus:bg-white"
        />

        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {matches.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-slate-500">No matching pages or actions.</div>
            ) : (
              <div className="py-1">
                {Array.from(grouped.entries()).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-3 pt-2 pb-1">
                      <Badge className={`${CATEGORY_CONFIG[category]} text-[10px] font-medium border-0 px-2 py-0`}>
                        {category}
                      </Badge>
                    </div>
                    {items.map((match) => (
                      <button
                        key={match.route.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runAction(match.route)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-100"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {highlightMatch(match.route.name, debouncedQuery)}
                        </span>
                        {match.route.path && (
                          <span className="text-xs text-slate-400 font-mono">{match.route.path}</span>
                        )}
                      </button>
                    ))}
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

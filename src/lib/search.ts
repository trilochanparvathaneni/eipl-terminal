import React from "react"
import type { SearchableRoute, RouteCategory } from "./search-routes"

export interface SearchMatch {
  route: SearchableRoute
  score: number
  matchedField: "name" | "keyword" | "path" | "category"
}

export function searchRoutes(
  query: string,
  routes: SearchableRoute[],
  { maxResults = 8 }: { maxResults?: number } = {}
): SearchMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return routes.slice(0, maxResults).map((route) => ({ route, score: 0, matchedField: "name" as const }))

  const matches: SearchMatch[] = []

  for (const route of routes) {
    const nameLower = route.name.toLowerCase()
    const pathLower = route.path.toLowerCase()
    const categoryLower = route.category.toLowerCase()
    const priorityBonus = route.priority ?? 0

    let score = 0
    let matchedField: SearchMatch["matchedField"] = "name"

    if (nameLower === q) {
      score = 100
    } else if (nameLower.startsWith(q)) {
      score = 80
    } else if (nameLower.includes(q)) {
      score = 60
    } else if (route.keywords.some((kw) => kw.toLowerCase().startsWith(q) || kw.toLowerCase().includes(q))) {
      score = 50
      matchedField = "keyword"
    } else if (pathLower.includes(q)) {
      score = 40
      matchedField = "path"
    } else if (categoryLower.includes(q)) {
      score = 30
      matchedField = "category"
    }

    if (score > 0) {
      matches.push({ route, score: score + priorityBonus, matchedField })
    }
  }

  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, maxResults)
}

export function groupResultsByCategory(matches: SearchMatch[]): Map<RouteCategory, SearchMatch[]> {
  const groups = new Map<RouteCategory, SearchMatch[]>()
  for (const match of matches) {
    const cat = match.route.category
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(match)
  }
  return groups
}

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length)

  return React.createElement(React.Fragment, null,
    before,
    React.createElement("mark", { className: "bg-yellow-200 text-inherit rounded-sm px-0.5" }, match),
    after
  )
}

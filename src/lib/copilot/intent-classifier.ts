import { Role } from "@prisma/client"
import { hasPermission } from "@/lib/rbac"
import { PATTERN_RULES } from "./patterns"

export type IntentCategory = "navigation" | "ops-metric" | "action-request" | "safety-hse"

export interface ClassifiedIntent {
  category: IntentCategory
  toolId: string | null
  confidence: number
  extractedParams: Record<string, string>
  rawQuery: string
  permissionDenied?: boolean
}

export function classifyIntent(query: string, userRole: Role): ClassifiedIntent {
  const q = query.trim().toLowerCase()

  if (!q) {
    return { category: "navigation", toolId: null, confidence: 0, extractedParams: {}, rawQuery: query }
  }

  // Priority order: safety-hse → ops-metric → action-request
  const priorityOrder: IntentCategory[] = ["safety-hse", "ops-metric", "action-request"]

  let bestMatch: { rule: typeof PATTERN_RULES[0]; score: number } | null = null

  for (const priority of priorityOrder) {
    const rulesForCategory = PATTERN_RULES.filter((r) => r.category === priority)

    for (const rule of rulesForCategory) {
      let score = 0

      // Check regex patterns (higher confidence)
      for (const pattern of rule.patterns) {
        if (pattern.test(q)) {
          score = Math.max(score, 0.9)
          break
        }
      }

      // Check keyword matches
      if (score === 0) {
        for (const keyword of rule.keywords) {
          if (q.includes(keyword)) {
            score = Math.max(score, 0.75)
            break
          }
        }
      }

      // Partial keyword matching (individual words)
      if (score === 0) {
        const queryWords = q.split(/\s+/)
        const keywordWords = rule.keywords.flatMap((k) => k.split(/\s+/))
        const matchCount = queryWords.filter((w) => keywordWords.includes(w)).length
        if (matchCount >= 2) {
          score = 0.5 + matchCount * 0.05
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { rule, score }
      }
    }

    // If we found a match at this priority level, stop
    if (bestMatch && bestMatch.score >= 0.7) break
  }

  if (bestMatch) {
    // Check permission
    if (!hasPermission(userRole, bestMatch.rule.requiredPermission)) {
      return {
        category: bestMatch.rule.category,
        toolId: bestMatch.rule.toolId,
        confidence: bestMatch.score,
        extractedParams: {},
        rawQuery: query,
        permissionDenied: true,
      }
    }

    return {
      category: bestMatch.rule.category,
      toolId: bestMatch.rule.toolId,
      confidence: bestMatch.score,
      extractedParams: extractParams(q),
      rawQuery: query,
    }
  }

  // Fallback to navigation
  return {
    category: "navigation",
    toolId: null,
    confidence: 0.3,
    extractedParams: {},
    rawQuery: query,
  }
}

function extractParams(query: string): Record<string, string> {
  const params: Record<string, string> = {}

  // Extract status filters
  const statusMatch = query.match(/status\s*[=:]?\s*(open|closed|pending|approved|rejected|cancelled)/i)
  if (statusMatch) params.status = statusMatch[1].toUpperCase()

  // Extract severity
  const severityMatch = query.match(/severity\s*[=:]?\s*(low|medium|high|critical)/i)
  if (severityMatch) params.severity = severityMatch[1].toUpperCase()

  // Extract truck number
  const truckMatch = query.match(/truck\s*(?:number|no\.?|#)?\s*([A-Z0-9-]+)/i)
  if (truckMatch) params.truckNumber = truckMatch[1]
  if (!params.truckNumber) {
    const plateLike = query.match(/\b([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4})\b/i)
    if (plateLike) params.truckNumber = plateLike[1].toUpperCase()
  }

  return params
}

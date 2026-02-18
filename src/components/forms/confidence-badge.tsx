"use client"

import { Badge } from "@/components/ui/badge"

interface ConfidenceBadgeProps {
  confidence: number
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100)

  if (confidence > 0.8) {
    return (
      <Badge variant="default" className="bg-green-600 text-[10px] px-1.5 py-0">
        {pct}%
      </Badge>
    )
  }

  if (confidence > 0.5) {
    return (
      <Badge variant="default" className="bg-yellow-500 text-[10px] px-1.5 py-0">
        {pct}%
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
      {pct}%
    </Badge>
  )
}

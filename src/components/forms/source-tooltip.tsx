"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface SourceTooltipProps {
  sourceQuote?: string
  pageOrSection?: string
}

export function SourceTooltip({ sourceQuote, pageOrSection }: SourceTooltipProps) {
  if (!sourceQuote && !pageOrSection) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {sourceQuote && (
            <p className="text-xs italic mb-1">&ldquo;{sourceQuote}&rdquo;</p>
          )}
          {pageOrSection && (
            <p className="text-[10px] text-muted-foreground">Source: {pageOrSection}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

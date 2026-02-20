"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReactNode } from "react"

interface HelpTooltipProps {
  description: string
  label?: string
  learnMoreHref?: string
  side?: "top" | "right" | "bottom" | "left"
  children?: ReactNode
}

export function HelpTooltip({
  description,
  label = "More information",
  learnMoreHref,
  side = "top",
  children,
}: HelpTooltipProps) {
  const trigger = children ?? (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <TooltipProvider delayDuration={180}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-64 text-xs leading-relaxed">
          <p>{description}</p>
          {learnMoreHref && (
            <Link href={learnMoreHref} className="mt-1 inline-block text-blue-600 hover:underline">
              Learn more
            </Link>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface LabeledHelpProps {
  text: string
  tooltip: string
  className?: string
}

export function LabeledHelp({ text, tooltip, className }: LabeledHelpProps) {
  return (
    <span className={className}>
      {text}{" "}
      <HelpTooltip description={tooltip} label={`${text} information`} />
    </span>
  )
}

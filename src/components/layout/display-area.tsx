import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface DisplayAreaProps {
  children: ReactNode
  className?: string
}

export function DisplayArea({ children, className }: DisplayAreaProps) {
  return <section className={cn("luxury-display-area luxury-section-spacing", className)}>{children}</section>
}

interface DisplayPanelProps {
  children: ReactNode
  className?: string
}

export function DisplayPanel({ children, className }: DisplayPanelProps) {
  return <div className={cn("luxury-surface p-6 lg:p-8", className)}>{children}</div>
}

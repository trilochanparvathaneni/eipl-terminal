"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getWelcomeContent } from "@/lib/tour/tour-steps"
import {
  Search,
  Bell,
  Bot,
  LayoutDashboard,
  CalendarDays,
  Radio,
  Users,
  ClipboardList,
  FolderOpen,
  FileText,
  Truck,
  Shield,
  HardHat,
  BarChart3,
  FileCheck,
  Upload,
  AlertTriangle,
  Crosshair,
} from "lucide-react"

const ICON_MAP: Record<string, React.ElementType> = {
  search: Search,
  bell: Bell,
  bot: Bot,
  layout: LayoutDashboard,
  calendar: CalendarDays,
  radio: Radio,
  users: Users,
  clipboard: ClipboardList,
  folder: FolderOpen,
  "file-text": FileText,
  truck: Truck,
  shield: Shield,
  "hard-hat": HardHat,
  "bar-chart": BarChart3,
  "file-check": FileCheck,
  upload: Upload,
  alert: AlertTriangle,
  crosshair: Crosshair,
}

interface WelcomeModalProps {
  open: boolean
  role: string
  onStartTour: () => void
  onSkip: () => void
}

export function WelcomeModal({ open, role, onStartTour, onSkip }: WelcomeModalProps) {
  const content = getWelcomeContent(role)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <LayoutDashboard className="h-7 w-7 text-indigo-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            {content.heading}
          </DialogTitle>
          <DialogDescription className="text-center">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {content.features.map((feature) => {
            const Icon = ICON_MAP[feature.icon] || LayoutDashboard
            return (
              <div
                key={feature.label}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="text-sm text-slate-700">{feature.label}</span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          This is a demo environment. Use the provided credentials to explore.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Skip
          </button>
          <button
            onClick={onStartTour}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Start Tour
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

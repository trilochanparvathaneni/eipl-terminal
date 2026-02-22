"use client"

import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { guardAssistAction } from "@/lib/assist/action-route-guard"

type ActionButton = {
  label: string
  url: string
  urgency?: "high" | "medium" | "low" | string
  tooltip?: string
}

type EiplBotPayload = {
  reply_text?: string
  action_buttons?: ActionButton[]
  response_mode?: "live" | "fallback"
  headline?: string
  terminal_state?: "OPEN" | "LIMITED" | "PAUSED"
  metrics?: Array<{ key: string; label: string; value: string; tooltip: string }>
  blockers?: Array<{ text: string; severity?: "low" | "medium" | "high" }>
}

const EIPLBotMessage = ({ payload }: { payload?: EiplBotPayload | null }) => {
  const router = useRouter()
  if (!payload) return null
  const guardedButtons = (payload.action_buttons ?? []).map((button, index) => ({
    ...guardAssistAction(button),
    urgency: button.urgency,
    key: `${button.label}-${index}`,
  }))

  return (
    <div className="eipl-bot-bubble my-3 w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-4 text-gray-100 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">EIPL Assist</span>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            payload.response_mode === "live"
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
              : "border-amber-500/40 bg-amber-500/20 text-amber-200"
          }`}
        >
          {payload.response_mode === "live" ? "Live" : "Fallback"}
        </span>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-relaxed">{payload.reply_text}</div>
      {payload.headline && <div className="mt-2 text-xs font-semibold text-sky-300">{payload.headline}</div>}
      {payload.metrics && payload.metrics.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {payload.metrics.map((metric) => (
            <div
              key={`${metric.key}-${metric.label}`}
              title={metric.tooltip}
              className="rounded-lg border border-gray-700 bg-gray-900/60 p-2"
            >
              <p className="text-[10px] uppercase tracking-wider text-gray-400">{metric.label}</p>
              <p className="text-sm font-semibold text-gray-100">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
      {payload.blockers && payload.blockers.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">Blockers</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-100">
            {payload.blockers.map((blocker, index) => (
              <li key={`${blocker.text}-${index}`}>- {blocker.text}</li>
            ))}
          </ul>
        </div>
      )}

      {guardedButtons.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-700 pt-3">
          <span className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Required Actions</span>

          {guardedButtons.map((btn) => {
            const isHighUrgency = btn.urgency === "high"
            const buttonClasses = isHighUrgency
              ? "border-red-700 bg-red-600 text-white hover:bg-red-500"
              : "border-blue-700 bg-blue-600 text-white hover:bg-blue-500"

            return (
              <button
                key={btn.key}
                title={btn.replaced ? btn.replacementReason : btn.tooltip}
                onClick={() => router.push(btn.href)}
                className={`flex w-full items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-md transition-all ${buttonClasses}`}
              >
                {isHighUrgency ? "! " : ""}
                {btn.label}
                {btn.replaced && (
                  <AlertCircle
                    className="ml-1.5 h-3.5 w-3.5"
                    aria-label="Action redirected to support because destination is unavailable"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default EIPLBotMessage

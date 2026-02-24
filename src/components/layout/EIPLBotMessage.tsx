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
  const isFallback = payload.response_mode !== "live"
  const guardedButtons = (payload.action_buttons ?? []).map((button, index) => ({
    ...guardAssistAction(button),
    urgency: button.urgency,
    key: `${button.label}-${index}`,
  }))

  return (
    <div
      className={`eipl-bot-bubble my-3 w-full max-w-md rounded-xl border bg-[#F8FAFC] p-4 text-slate-900 shadow-md ${
        isFallback ? "border-slate-300 border-l-4 border-l-red-500" : "border-slate-200"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">EIPL Assist</span>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            payload.response_mode === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {payload.response_mode === "live" ? "Live" : "Fallback"}
        </span>
      </div>

      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{payload.reply_text}</div>
      {payload.headline && <div className="mt-2 text-xs font-semibold text-slate-700">{payload.headline}</div>}
      {payload.metrics && payload.metrics.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {payload.metrics.map((metric) => (
            <div
              key={`${metric.key}-${metric.label}`}
              title={metric.tooltip}
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{metric.label}</p>
              <p className="text-sm font-semibold text-slate-900">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
      {payload.blockers && payload.blockers.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Blockers</p>
          <ul className="mt-1 space-y-1 text-xs text-red-800">
            {payload.blockers.map((blocker, index) => (
              <li key={`${blocker.text}-${index}`}>- {blocker.text}</li>
            ))}
          </ul>
        </div>
      )}

      {guardedButtons.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3">
          <span className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Required Actions</span>

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

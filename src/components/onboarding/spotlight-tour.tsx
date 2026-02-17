"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { TourStep } from "@/lib/tour/tour-steps"
import { cn } from "@/lib/utils"

interface SpotlightTourProps {
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
}

interface Position {
  top: number
  left: number
  width: number
  height: number
}

function getTooltipStyle(
  target: Position,
  placement: TourStep["placement"],
  tooltipWidth: number,
  tooltipHeight: number
) {
  const gap = 12
  const style: React.CSSProperties = { position: "fixed" }

  switch (placement) {
    case "bottom":
      style.top = target.top + target.height + gap
      style.left = target.left + target.width / 2 - tooltipWidth / 2
      break
    case "top":
      style.top = target.top - tooltipHeight - gap
      style.left = target.left + target.width / 2 - tooltipWidth / 2
      break
    case "right":
      style.top = target.top + target.height / 2 - tooltipHeight / 2
      style.left = target.left + target.width + gap
      break
    case "left":
      style.top = target.top + target.height / 2 - tooltipHeight / 2
      style.left = target.left - tooltipWidth - gap
      break
  }

  // Clamp to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  if ((style.left as number) < 8) style.left = 8
  if ((style.left as number) + tooltipWidth > vw - 8) style.left = vw - tooltipWidth - 8
  if ((style.top as number) < 8) style.top = 8
  if ((style.top as number) + tooltipHeight > vh - 8) style.top = vh - tooltipHeight - 8

  return style
}

export function SpotlightTour({ steps, onComplete, onSkip }: SpotlightTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetPos, setTargetPos] = useState<Position | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = steps[currentStep]

  const updateTargetPosition = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetPos({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    } else {
      setTargetPos(null)
    }
  }, [step])

  useEffect(() => {
    updateTargetPosition()
    window.addEventListener("resize", updateTargetPosition)
    window.addEventListener("scroll", updateTargetPosition, true)
    return () => {
      window.removeEventListener("resize", updateTargetPosition)
      window.removeEventListener("scroll", updateTargetPosition, true)
    }
  }, [updateTargetPosition])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onSkip()
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentStep < steps.length - 1) goNext()
        else onComplete()
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) goBack()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  })

  function goNext() {
    setTransitioning(true)
    setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, steps.length - 1))
      setTransitioning(false)
    }, 200)
  }

  function goBack() {
    setTransitioning(true)
    setTimeout(() => {
      setCurrentStep((s) => Math.max(s - 1, 0))
      setTransitioning(false)
    }, 200)
  }

  const isLast = currentStep === steps.length - 1
  const padding = 6

  // Spotlight cutout via box-shadow
  const spotlightStyle: React.CSSProperties = targetPos
    ? {
        position: "fixed",
        top: targetPos.top - padding,
        left: targetPos.left - padding,
        width: targetPos.width + padding * 2,
        height: targetPos.height + padding * 2,
        borderRadius: 8,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
        transition: "all 300ms ease-in-out",
        zIndex: 9998,
        pointerEvents: "none" as const,
      }
    : {
        position: "fixed" as const,
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9998,
      }

  // Calculate tooltip position
  const tooltipWidth = 320
  const tooltipHeight = 180
  const tooltipStyle = targetPos
    ? getTooltipStyle(targetPos, step.placement, tooltipWidth, tooltipHeight)
    : { position: "fixed" as const, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

  return (
    <div className="fixed inset-0 z-[9997]">
      {/* Click overlay to prevent interaction */}
      <div className="fixed inset-0" onClick={onSkip} />

      {/* Spotlight cutout */}
      <div style={spotlightStyle} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{ ...tooltipStyle, zIndex: 9999 }}
        className={cn(
          "w-80 rounded-xl bg-white p-4 shadow-2xl transition-opacity duration-200",
          transitioning ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="mb-1 text-xs font-medium text-indigo-600">
          Step {currentStep + 1} of {steps.length}
        </div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          {step.title}
        </h3>
        <p className="mb-4 text-sm text-slate-500">{step.description}</p>

        {/* Progress dots */}
        <div className="mb-3 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentStep
                  ? "w-4 bg-indigo-600"
                  : i < currentStep
                    ? "w-1.5 bg-indigo-300"
                    : "w-1.5 bg-slate-200"
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={goBack}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? onComplete : goNext}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

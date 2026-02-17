"use client"

import { useState } from "react"
import { WelcomeModal } from "./welcome-modal"
import { SpotlightTour } from "./spotlight-tour"
import { getTourSteps } from "@/lib/tour/tour-steps"

type TourPhase = "welcome" | "touring" | "done"

interface ProductTourProps {
  active: boolean
  role: string
  onComplete: () => void
}

export function ProductTour({ active, role, onComplete }: ProductTourProps) {
  const [phase, setPhase] = useState<TourPhase>("welcome")

  if (!active) return null

  const steps = getTourSteps(role)

  function handleStartTour() {
    setPhase("touring")
  }

  function handleSkip() {
    setPhase("done")
    onComplete()
  }

  function handleTourComplete() {
    setPhase("done")
    onComplete()
  }

  if (phase === "welcome") {
    return (
      <WelcomeModal
        open
        role={role}
        onStartTour={handleStartTour}
        onSkip={handleSkip}
      />
    )
  }

  if (phase === "touring") {
    return (
      <SpotlightTour
        steps={steps}
        onComplete={handleTourComplete}
        onSkip={handleSkip}
      />
    )
  }

  return null
}

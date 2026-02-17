"use client"

import { useState, useCallback, useEffect } from "react"

function getStorageKey(userId: string) {
  return `eipl_tour_seen_${userId}`
}

export function useProductTour(userId: string | undefined) {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (!userId) return
    const seen = localStorage.getItem(getStorageKey(userId))
    if (!seen) {
      // Delay to ensure dashboard renders first
      const timer = setTimeout(() => setShouldShow(true), 500)
      return () => clearTimeout(timer)
    }
  }, [userId])

  const completeTour = useCallback(() => {
    if (!userId) return
    localStorage.setItem(getStorageKey(userId), "true")
    setShouldShow(false)
  }, [userId])

  const startTour = useCallback(() => {
    setShouldShow(true)
  }, [])

  const resetTour = useCallback(() => {
    if (!userId) return
    localStorage.removeItem(getStorageKey(userId))
    setShouldShow(true)
  }, [userId])

  return { shouldShow, startTour, completeTour, resetTour }
}

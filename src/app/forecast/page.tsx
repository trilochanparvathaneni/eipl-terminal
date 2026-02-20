"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { computeForecast } from "@/lib/forecast/engine"
import { DEFAULT_PARAMS } from "@/lib/forecast/types"
import type { ForecastParams, ForecastInput, ScheduledTruck } from "@/lib/forecast/types"
import { ForecastChart } from "@/components/forecast/ForecastChart"
import { RiskScoreCard } from "@/components/forecast/RiskScoreCard"
import { RecommendationList } from "@/components/forecast/RecommendationList"
import { SimulationPanel } from "@/components/forecast/SimulationPanel"
import { HelpTooltip } from "@/components/ui/help-tooltip"

// Shape of the raw data returned by GET /api/forecast
interface ForecastApiResponse {
  generatedAt: string
  currentState: {
    currentBayOccupancy: number
    currentInsideYard: number
    currentOutsideQueue: number
    totalBays: number
  }
  scheduledTrucks: ScheduledTruck[]
  historicalStats: {
    avgTurnaroundMin: number | null
    sampleSize: number
  }
}

export default function ForecastPage() {
  const [rawData, setRawData] = useState<ForecastApiResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [params, setParams] = useState<ForecastParams>({ ...DEFAULT_PARAMS })
  const [isComputing, setIsComputing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    setFetchError(null)

    try {
      const res = await fetch("/api/forecast")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      const data: ForecastApiResponse = await res.json()
      setRawData(data)
      setLastRefreshed(new Date())
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch forecast data")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build the forecast input from raw API data + current params
  const forecastInput = useMemo<ForecastInput | null>(() => {
    if (!rawData) return null
    return {
      now: new Date(rawData.generatedAt),
      params,
      scheduledTrucks: rawData.scheduledTrucks,
      currentBayOccupancy: rawData.currentState.currentBayOccupancy,
      currentInsideYard: rawData.currentState.currentInsideYard,
      currentOutsideQueue: rawData.currentState.currentOutsideQueue,
      totalBays: rawData.currentState.totalBays,
    }
  }, [rawData, params])

  // Run the forecast engine client-side — instant (<10 ms), no server round-trip
  const forecastResult = useMemo(() => {
    if (!forecastInput) return null
    return computeForecast(forecastInput)
  }, [forecastInput])

  // Signal brief "computing" state when params change (for UX feedback)
  const prevParamsRef = { current: params }
  const handleParamsChange = useCallback((next: ForecastParams) => {
    setIsComputing(true)
    setParams(next)
    // The memo will recompute synchronously; flip the flag off after a paint
    requestAnimationFrame(() => setIsComputing(false))
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Forecast &amp; Recommendations
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              2-hour congestion forecast · deterministic queue simulation
              {lastRefreshed && (
                <span className="ml-2">
                  · refreshed {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isLoading || isRefreshing}
          className="gap-2"
          title="Refresh forecast input from latest live operational data."
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh live data
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardContent className="py-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-48 bg-slate-100 rounded" />
                  <div className="h-36 bg-slate-100 rounded" />
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-8">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardContent className="py-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-slate-100 rounded-full mx-auto w-32" />
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-100 rounded" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && fetchError && (
        <Card className="shadow-sm border-red-200 bg-red-50/40">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to load forecast data
            </p>
            <p className="text-xs text-red-500 mt-1">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchData()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!isLoading && !fetchError && forecastResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: chart + recommendations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart card */}
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-4">
                  <ForecastChart
                    buckets={forecastResult.buckets}
                    totalBays={rawData?.currentState.totalBays}
                  />
                  <div className="mt-2 text-xs text-slate-500 inline-flex items-center gap-1">
                    <span>Forecast chart</span>
                    <HelpTooltip description="What it is: 2-hour congestion projection. Why it matters: Helps plan actions before queue buildup." />
                  </div>
                </CardContent>
              </Card>

            {/* Historical stats banner (if available) */}
            {rawData?.historicalStats.avgTurnaroundMin != null && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-6 text-xs">
                <span className="text-slate-500">
                  Historical (last 30 days):
                </span>
                <span className="font-semibold text-slate-800">
                  Avg turnaround{" "}
                  <span className="text-indigo-700">
                    {rawData?.historicalStats.avgTurnaroundMin} min
                  </span>
                </span>
                <span className="text-slate-400">
                  based on {rawData?.historicalStats.sampleSize} completed trips
                </span>
              </div>
            )}

            {/* Recommendations */}
            <RecommendationList
              recommendations={forecastResult.recommendations}
            />
            <div className="text-xs text-slate-500 inline-flex items-center gap-1">
              <span>Recommendations</span>
              <HelpTooltip description="What it is: Suggested next actions. Why it matters: Reduces risk score and queue time." />
            </div>
          </div>

          {/* Right column: risk score + simulation */}
          <div className="space-y-6">
            <RiskScoreCard result={forecastResult} />
            <SimulationPanel
              params={params}
              onChange={handleParamsChange}
              isComputing={isComputing}
            />
            <div className="text-xs text-slate-500 inline-flex items-center gap-1">
              <span>Simulation controls</span>
              <HelpTooltip description="What it is: Scenario inputs for what-if testing. Why it matters: See impact before real changes." />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

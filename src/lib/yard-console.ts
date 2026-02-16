function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null
}

export function normalizeArmsPayload<T>(data: unknown): T[] {
  return (
    asArray<T>(data) ??
    asArray<T>((data as { loadingArms?: unknown } | null)?.loadingArms) ??
    asArray<T>((data as { arms?: unknown } | null)?.arms) ??
    []
  )
}

export function normalizeTripsPayload<T>(data: unknown): T[] {
  return (
    asArray<T>(data) ??
    asArray<T>((data as { trips?: unknown } | null)?.trips) ??
    asArray<T>((data as { truckTrips?: unknown } | null)?.truckTrips) ??
    []
  )
}

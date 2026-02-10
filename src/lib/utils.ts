import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    CLIENT_APPROVED: 'bg-indigo-100 text-indigo-700',
    OPS_SCHEDULED: 'bg-purple-100 text-purple-700',
    TRUCK_DETAILS_PENDING: 'bg-yellow-100 text-yellow-700',
    QR_ISSUED: 'bg-cyan-100 text-cyan-700',
    ARRIVED_GATE: 'bg-orange-100 text-orange-700',
    IN_TERMINAL: 'bg-amber-100 text-amber-700',
    LOADED: 'bg-emerald-100 text-emerald-700',
    EXITED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-green-200 text-green-800',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-red-100 text-red-700',
    STOP_WORK: 'bg-red-200 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PASSED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    OPEN: 'bg-red-100 text-red-700',
    LOW: 'bg-yellow-100 text-yellow-700',
    MED: 'bg-orange-100 text-orange-700',
    HIGH: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

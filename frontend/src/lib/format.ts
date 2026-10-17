/** Shared formatting helpers — Indian rupee + en-IN dates. */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function inr(n: number): string {
  if (!Number.isFinite(n)) return '₹0'
  return inrFormatter.format(Math.round(n))
}

export function inrDetailed(n: number): string {
  if (!Number.isFinite(n)) return '₹0'
  return inrPrecise.format(n)
}

/** ₹1.2L / ₹45.5K for tight spaces (charts, badges). */
export function inrShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100000) return `₹${(n / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`
  if (abs >= 1000) return `₹${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`
  return inr(n)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function formatLongDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "Today", "Tomorrow", "in 5 days", "2 days overdue". */
export function dueLabel(iso: string, ref: Date = new Date()): string {
  const days = daysUntil(iso, ref)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days} days`
  if (days === -1) return '1 day overdue'
  return `${Math.abs(days)} days overdue`
}

export function daysUntil(iso: string, ref: Date = new Date()): number {
  const a = startOfDay(ref).getTime()
  const b = startOfDay(new Date(iso)).getTime()
  return Math.round((b - a) / 86400000)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

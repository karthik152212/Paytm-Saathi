import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import {
  Bus,
  GraduationCap,
  Info,
  MoreHorizontal,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Category } from '../data/types'

/* ------------------------------- layout ------------------------------- */

export function Card({
  className,
  children,
  as: As = 'div',
}: {
  className?: string
  children: ReactNode
  as?: 'div' | 'section' | 'article'
}) {
  return <As className={clsx('card', className)}>{children}</As>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-mute">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon size={15} aria-hidden />
          </span>
        ) : null}
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

/* -------------------------------- badges -------------------------------- */

export type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad' | 'teal'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-red-50 text-red-700',
  teal: 'bg-teal-50 text-teal-700',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  const Icon = icon
  return (
    <span className={clsx('chip', TONE_CLASSES[tone], className)}>
      {Icon ? <Icon size={12} strokeWidth={2.4} aria-hidden /> : null}
      {children}
    </span>
  )
}

/* ------------------------------ progress ------------------------------ */

export function ProgressBar({
  value,
  tone = 'brand',
  className,
  label,
}: {
  value: number
  tone?: 'brand' | 'good' | 'warn' | 'bad' | 'teal'
  className?: string
  label?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const bar =
    tone === 'bad'
      ? 'bg-red-500'
      : tone === 'warn'
        ? 'bg-amber-500'
        : tone === 'good'
          ? 'bg-emerald-500'
          : tone === 'teal'
            ? 'bg-teal-500'
            : 'bg-brand-500'
  return (
    <div
      className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', bar)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

/* ------------------------------- stat card ------------------------------- */

export function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = 'brand',
  loading,
}: {
  icon: LucideIcon
  label: string
  value: string
  caption?: ReactNode
  tone?: 'brand' | 'teal' | 'warn' | 'neutral'
  loading?: boolean
}) {
  const iconTone =
    tone === 'teal'
      ? 'bg-teal-50 text-teal-600'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-600'
        : tone === 'neutral'
          ? 'bg-slate-100 text-slate-500'
          : 'bg-brand-50 text-brand-600'
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={clsx('rounded-xl p-2.5', iconTone)}>
          <Icon size={18} strokeWidth={2.2} aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
        {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-100" /> : value}
      </p>
      {caption ? <p className="mt-1 text-xs text-ink-mute">{caption}</p> : null}
    </Card>
  )
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 w-full animate-popIn rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-mute">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-ink-mute transition hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line bg-slate-50/70 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------ empty state ------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-slate-50/60 px-6 py-10 text-center">
      <div className="rounded-full bg-white p-3 text-ink-mute shadow-card">
        <Icon size={20} aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-ink-mute">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ---------------------------- segmented control ---------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-white p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              active ? 'bg-ink text-white shadow-sm' : 'text-ink-mute hover:bg-slate-100 hover:text-ink',
            )}
          >
            {o.label}
            {typeof o.count === 'number' ? <span className="ml-1 opacity-70">{o.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ category icon ------------------------------ */

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Food: UtensilsCrossed,
  Transport: Bus,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Education: GraduationCap,
  Other: MoreHorizontal,
}

const CATEGORY_TONE: Record<Category, string> = {
  Food: 'bg-amber-50 text-amber-600',
  Transport: 'bg-brand-50 text-brand-600',
  Shopping: 'bg-violet-50 text-violet-600',
  Bills: 'bg-sky-50 text-sky-600',
  Education: 'bg-teal-50 text-teal-600',
  Other: 'bg-slate-100 text-slate-500',
}

export function CategoryIcon({ category, size = 34 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICON[category]
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-xl', CATEGORY_TONE[category])}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.1} aria-hidden />
    </span>
  )
}

export function categoryTone(category: Category): string {
  return CATEGORY_TONE[category]
}

/* -------------------------------- helpers -------------------------------- */

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2.5 text-xs leading-relaxed text-brand-800">
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-mute">{hint}</span>
      ) : null}
    </label>
  )
}


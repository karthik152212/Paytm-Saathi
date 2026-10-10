import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import {
  Bell,
  CalendarClock,
  ChevronRight,
  Info,
  Menu,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { ROUTES, navigate } from '../../router'
import type { RouteId } from '../../router'
import { useApp } from '../../state/AppContext'
import { Avatar, Badge } from '../ui'
import { budgetRows, nextBill } from '../../data/selectors'
import { scoreTransactions } from '../../safety/riskScoring'
import { inr } from '../../lib/format'

/* ------------------------------- toggle ------------------------------- */

export function SimpleModeToggle({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useApp()
  const on = state.settings.simpleMode
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => dispatch({ type: 'settings/simpleMode', value: !on })}
      className={clsx(
        'group inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        on
          ? 'border-teal-500 bg-teal-50 text-teal-700'
          : 'border-line bg-white text-ink-mute hover:border-brand-300 hover:text-brand-700',
      )}
      title="Simple Mode uses larger text and plainer wording"
    >
      <span
        className={clsx(
          'relative inline-flex h-4 w-7 items-center rounded-full transition',
          on ? 'bg-teal-500' : 'bg-slate-300',
        )}
      >
        <span
          className={clsx(
            'inline-block h-3 w-3 transform rounded-full bg-white transition',
            on ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
      {compact ? null : <span>Simple Mode</span>}
    </button>
  )
}

/* ------------------------------ notifications ------------------------------ */

interface Notice {
  id: string
  icon: typeof Bell
  tone: 'brand' | 'warn' | 'bad' | 'teal'
  title: string
  body: string
  route: RouteId
}

function useNotices(): Notice[] {
  const { state } = useApp()
  return useMemo(() => {
    const notices: Notice[] = []
    const alerts = scoreTransactions(state)
    const high = alerts.filter((a) => a.severity === 'high')
    const med = alerts.filter((a) => a.severity === 'medium')

    if (high.length || med.length) {
      notices.push({
        id: 'safety',
        icon: ShieldAlert,
        tone: high.length ? 'bad' : 'warn',
        title: `${high.length + med.length} payment${high.length + med.length === 1 ? '' : 's'} to review`,
        body: high.length
          ? `${high.length} high-priority illustrative alert${high.length === 1 ? '' : 's'} in your Safety Center.`
          : 'Some payments differ from your usual pattern — check them.',
        route: 'safety',
      })
    }

    const bill = nextBill(state)
    if (bill) {
      notices.push({
        id: 'bill',
        icon: CalendarClock,
        tone: bill.overdue ? 'warn' : 'brand',
        title: bill.overdue ? `${bill.bill.name} is overdue` : `${bill.bill.name} due soon`,
        body: `${inr(bill.bill.amount)} · ${
          bill.overdue ? `${Math.abs(bill.daysLeft)} days late` : `in ${bill.daysLeft} day${bill.daysLeft === 1 ? '' : 's'}`
        }`,
        route: 'bills',
      })
    }

    const warnings = budgetRows(state).filter((r) => r.status !== 'ok')
    if (warnings.length) {
      const w = warnings[0]
      notices.push({
        id: 'budget',
        icon: Target,
        tone: w.status === 'over' ? 'bad' : 'warn',
        title:
          w.status === 'over'
            ? `${w.category} budget crossed`
            : `${w.category} budget at ${w.used}%`,
        body:
          w.status === 'over'
            ? `You are ${inr(Math.abs(w.remaining))} over the ${inr(w.limit)} limit.`
            : `${inr(w.remaining)} left before the limit.`,
        route: 'budgets',
      })
    }

    return notices
  }, [state])
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notices = useNotices()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 z-50 w-[19rem] animate-popIn overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink">Notifications</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-ink-mute hover:bg-slate-100"
          aria-label="Close notifications"
        >
          <X size={15} />
        </button>
      </div>
      {notices.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-ink-mute">You are all caught up.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {notices.map((n) => {
            const Icon = n.icon
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(n.route)
                    onClose()
                  }}
                  className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <span
                    className={clsx(
                      'mt-0.5 rounded-lg p-1.5',
                      n.tone === 'bad'
                        ? 'bg-red-50 text-red-600'
                        : n.tone === 'warn'
                          ? 'bg-amber-50 text-amber-600'
                          : n.tone === 'teal'
                            ? 'bg-teal-50 text-teal-600'
                            : 'bg-brand-50 text-brand-600',
                    )}
                  >
                    <Icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-mute">{n.body}</span>
                  </span>
                  <ChevronRight size={14} className="mt-1 shrink-0 text-slate-300" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex items-start gap-2 bg-slate-50 px-4 py-2.5 text-[11px] leading-relaxed text-ink-mute">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
        Notifications are generated in this browser from demo data. Nothing is sent anywhere.
      </div>
    </div>
  )
}

/* ------------------------------ sidebar ------------------------------ */

function NavList({ current, onNavigate }: { current: RouteId; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {ROUTES.map((r) => {
        const Icon = r.icon
        const active = r.id === current
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              navigate(r.id)
              onNavigate?.()
            }}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-soft hover:bg-slate-100 hover:text-ink',
            )}
          >
            <Icon
              size={17}
              strokeWidth={2.1}
              className={active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}
              aria-hidden
            />
            <span className="flex-1">{r.label}</span>
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden /> : null}
          </button>
        )
      })}
    </nav>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-card">
        <Sparkles size={17} strokeWidth={2.3} aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-tight text-ink">Paytm Saathi</span>
        <span className="block text-[10.5px] font-medium text-ink-mute">From Payments to Progress</span>
      </span>
    </div>
  )
}

/* -------------------------------- shell -------------------------------- */

export function Shell({ current, children }: { current: RouteId; children: ReactNode }) {
  const { state, resetDemo } = useApp()
  const [panelOpen, setPanelOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const notices = useNotices()
  const currentDef = ROUTES.find((r) => r.id === current)

  return (
    <div className="min-h-screen">
      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-line bg-white lg:flex">
        <div className="px-4 pb-4 pt-5">
          <BrandMark />
          <div className="mt-3">
            <Badge tone="teal">Demo data · simulated</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <NavList current={current} />
        </div>
        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={state.profile.name} size={34} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{state.profile.name}</p>
                <p className="truncate text-[11px] text-ink-mute">{state.profile.subtitle}</p>
              </div>
            </div>
            <div className="mt-3">
              <SimpleModeToggle />
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="-ml-1 grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-soft lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} aria-hidden />
            </button>
            <div className="lg:hidden">
              <BrandMark />
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-ink">{currentDef?.label}</p>
              <p className="text-[11px] text-ink-mute">{currentDef?.hint}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:inline-flex">
                <SimpleModeToggle compact />
              </span>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPanelOpen((v) => !v)}
                  aria-label={`Notifications, ${notices.length} items`}
                  aria-expanded={panelOpen}
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-soft transition hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <Bell size={17} aria-hidden />
                  {notices.length > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {notices.length}
                    </span>
                  ) : null}
                </button>
                {panelOpen ? <NotificationPanel onClose={() => setPanelOpen(false)} /> : null}
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-line bg-white py-1 pl-1 pr-3 sm:flex">
                <Avatar name={state.profile.name} size={26} />
                <span className="text-xs font-semibold text-ink">{state.profile.name.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-14">
          <div key={current} className="animate-fadeUp">
            {children}
          </div>
        </main>

        <footer className="border-t border-line bg-white px-4 py-5 text-center text-[11px] leading-relaxed text-ink-mute sm:px-6 lg:px-8">
          Paytm Saathi is an independent demonstration prototype using simulated financial data. It is not
          affiliated with, endorsed by, or connected to Paytm. No real accounts, payments, messages or fraud
          detection are involved.
        </footer>
      </div>

      {/* mobile drawer */}
      {mobileNav ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMobileNav(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs overflow-y-auto bg-white p-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMobileNav(false)}
                className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <Badge tone="teal" className="mb-3">
              Demo data · simulated
            </Badge>
            <NavList current={current} onNavigate={() => setMobileNav(false)} />
            <div className="mt-4 rounded-xl bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={state.profile.name} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{state.profile.name}</p>
                  <p className="truncate text-[11px] text-ink-mute">{state.profile.subtitle}</p>
                </div>
              </div>
              <div className="mt-3">
                <SimpleModeToggle />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset all demo data? Your edits will be discarded.')) resetDemo()
                  setMobileNav(false)
                }}
                className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Reset demo data
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden"
        aria-label="Primary mobile"
      >
        <div className="flex overflow-x-auto">
          {ROUTES.map((r) => {
            const Icon = r.icon
            const active = r.id === current
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(r.id)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-w-[74px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10.5px] font-semibold transition',
                  active ? 'text-brand-700' : 'text-ink-mute',
                )}
              >
                <Icon size={18} strokeWidth={2.1} aria-hidden />
                {r.short}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

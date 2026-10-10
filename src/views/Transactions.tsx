import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  CreditCard,
  Flag,
  Search,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../state/AppContext'
import { searchTransactions } from '../data/selectors'
import type { Category, Transaction } from '../data/types'
import { CATEGORIES } from '../data/types'
import { formatTime, inr } from '../lib/format'
import { Badge, Card, CategoryIcon, EmptyState, PageHeader, Segmented } from '../components/ui'
import { scoreTransactions } from '../safety/riskScoring'

type DirectionFilter = 'All' | 'debit' | 'credit'

export function Transactions() {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [direction, setDirection] = useState<DirectionFilter>('All')
  const [openId, setOpenId] = useState<string | null>(null)

  const flaggedIds = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of scoreTransactions(state)) {
      if (a.severity === 'high' || a.severity === 'medium') {
        map.set(a.transaction.id, a.headline)
      }
    }
    return map
  }, [state])

  const rows = useMemo(
    () => searchTransactions(state, { query, category, direction }),
    [state, query, category, direction],
  )

  const debits = rows.filter((r) => r.direction === 'debit')
  const credits = rows.filter((r) => r.direction === 'credit')
  const debitTotal = debits.reduce((s, t) => s + t.amount, 0)
  const creditTotal = credits.reduce((s, t) => s + t.amount, 0)
  const hasFilters = query.trim() !== '' || category !== 'All' || direction !== 'All'

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Every payment in this demo account — search, filter, and open a row for the full detail."
        actions={<Badge tone="teal">Simulated data · not a real Paytm account</Badge>}
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              className="field pl-9"
              placeholder="Search by merchant, note, category or amount…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search transactions"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<DirectionFilter>
              ariaLabel="Filter by direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'All', label: 'All' },
                { value: 'debit', label: 'Money out' },
                { value: 'credit', label: 'Money in' },
              ]}
            />
            {hasFilters ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setQuery('')
                  setCategory('All')
                  setDirection('All')
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Segmented<Category | 'All'>
            ariaLabel="Filter by category"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'All', label: 'All categories', count: rows.length },
              ...CATEGORIES.map((c) => ({
                value: c,
                label: c,
                count: state.transactions.filter(
                  (t) => t.category === c && (direction === 'All' || t.direction === direction),
                ).length,
              })),
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Results</p>
            <p className="text-lg font-bold text-ink">{rows.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Money out</p>
            <p className="text-lg font-bold text-ink">{inr(debitTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Money in</p>
            <p className="text-lg font-bold text-emerald-600">{inr(creditTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Net</p>
            <p className={clsx('text-lg font-bold', creditTotal - debitTotal >= 0 ? 'text-emerald-600' : 'text-ink')}>
              {inr(creditTotal - debitTotal)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Search}
              title="No transactions match those filters"
              body="Try a shorter search term, pick a different category, or clear the filters to see all 30 demo transactions."
              action={
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setQuery('')
                    setCategory('All')
                    setDirection('All')
                  }}
                >
                  Reset filters
                </button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <Row
                key={t.id}
                t={t}
                flag={flaggedIds.get(t.id)}
                open={openId === t.id}
                onToggle={() => setOpenId(openId === t.id ? null : t.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Row({
  t,
  open,
  onToggle,
  flag,
}: {
  t: Transaction
  open: boolean
  onToggle: () => void
  flag?: string
}) {
  const credit = t.direction === 'credit'
  const date = new Date(t.date)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const yesterday = new Date(today.getTime() - 86400000)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset sm:px-5',
          open && 'bg-slate-50',
        )}
      >
        <CategoryIcon category={t.category} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{t.merchant}</span>
            {t.flagged ? (
              <Badge tone="bad" icon={Flag}>
                Flagged in demo
              </Badge>
            ) : flag ? (
              <Badge tone="warn" icon={Flag}>
                Review
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-mute">
            <span>{t.category}</span>
            <span aria-hidden>·</span>
            <span>{isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            <span aria-hidden>·</span>
            <span>{formatTime(t.date)}</span>
            <span aria-hidden>·</span>
            <span>{t.method}</span>
          </span>
        </span>
        <span className="text-right">
          <span
            className={clsx(
              'flex items-center justify-end gap-1 text-sm font-bold',
              credit ? 'text-emerald-600' : 'text-ink',
            )}
          >
            {credit ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} className="text-slate-400" aria-hidden />}
            {credit ? '+' : '−'}
            {inr(t.amount)}
          </span>
          <span className="mt-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">
            {credit ? 'Credit' : 'Debit'}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={clsx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="animate-fadeUp border-t border-line bg-slate-50/70 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Transaction ID" value={t.id.toUpperCase()} />
            <Detail label="Date & time" value={`${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${formatTime(t.date)}`} />
            <Detail label="Payment method" value={t.method} />
            <Detail label="Category" value={t.category} />
            <Detail label="Direction" value={credit ? 'Credit (money in)' : 'Debit (money out)'} />
            <Detail label="Amount" value={inr(t.amount)} />
            <div className="col-span-2">
              <Detail label="Note" value={t.note} />
            </div>
          </div>

          {t.flagged || flag ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50/70 p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-red-700">
                <Flag size={13} aria-hidden />
                Illustrative risk alert — needs review
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-red-800/90">
                {t.flagReason ?? flag}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-red-700/80">
                This is a demonstration result computed from simple rules on simulated data — it is not a
                production fraud-detection model and it does not mean the payment is confirmed fraud.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
            <CreditCard size={13} aria-hidden />
            <span>Processed through {t.method}</span>
            <span aria-hidden>·</span>
            <Calendar size={13} aria-hidden />
            <span>{date.toLocaleDateString('en-IN', { weekday: 'long' })}</span>
          </div>
        </div>
      ) : null}
    </li>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">{value}</p>
    </div>
  )
}

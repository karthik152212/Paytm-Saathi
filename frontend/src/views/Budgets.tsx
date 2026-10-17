import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Pencil, Plus, Target, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../state/AppContext'
import { budgetRows, budgetTotals, daysLeftInMonth, spendingByCategory, unbudgetedSpending } from '../data/selectors'
import type { Category } from '../data/types'
import { CATEGORIES } from '../data/types'
import { inr, pct } from '../lib/format'
import { Badge, Card, EmptyState, Field, InfoNote, Modal, PageHeader, ProgressBar, SectionHeader } from '../components/ui'

export function Budgets() {
  const { state, dispatch, simple } = useApp()
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => budgetRows(state), [state])
  const totals = useMemo(() => budgetTotals(state), [state])
  const byCat = useMemo(() => spendingByCategory(state), [state])
  const unbudgeted = useMemo(() => unbudgetedSpending(state), [state])
  const daysLeft = daysLeftInMonth()
  const missing = CATEGORIES.filter((c) => !state.budgets.some((b) => b.category === c))

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Monthly limits per category. Spent amounts are derived from your transactions — never typed in."
        actions={
          <>
            <Badge tone={totals.status === 'over' ? 'bad' : totals.status === 'warning' ? 'warn' : 'good'}>
              {totals.used}% used
            </Badge>
            {missing.length > 0 ? (
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <Plus size={15} aria-hidden />
                Add budget
              </button>
            ) : null}
          </>
        }
      />

      {/* summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Total budget" value={inr(totals.limit)} caption={`${rows.length} categories`} />
        <Summary label="Spent so far" value={inr(totals.spent)} caption={`${100 - daysLeft} days into the month`} />
        <Summary
          label="Remaining"
          value={inr(totals.remaining)}
          caption={simple ? 'Money you can still spend' : `${daysLeft} day(s) left in this month`}
          tone={totals.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}
        />
        <Summary
          label="Utilisation"
          value={`${totals.used}%`}
          caption={
            simple
              ? totals.used >= 75
                ? 'You have used most of this month’s budget'
                : 'You are on track'
              : totals.status === 'over'
                ? 'Combined limit crossed'
                : totals.status === 'warning'
                  ? 'Approaching the combined limit'
                  : 'Within the combined limit'
          }
          tone={totals.status === 'over' ? 'text-red-600' : totals.status === 'warning' ? 'text-amber-600' : 'text-ink'}
        />
      </div>

      {/* how it works */}
      <Card className="mt-4 p-4 sm:p-5">
        <SectionHeader
          title="How your budget is calculated"
          subtitle="Three numbers, no mystery"
          action={<Info size={16} className="text-brand-500" aria-hidden />}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Step n="1" title="Limit" body={`You set a monthly ceiling for a category — for example ${inr(6000)} on Food.`} />
          <Step
            n="2"
            title="Spent"
            body="Saathi adds up every debit in that category for the current month from your transaction list."
          />
          <Step
            n="3"
            title="Remaining"
            body={`Remaining = limit − spent. Utilisation = spent ÷ limit. Above 75% you get a warning, above 100% it is over.`}
          />
        </div>
        <div className="mt-3">
          <InfoNote>
            If you change a limit below, the progress bar, warning state, dashboard totals and assistant answers all
            update immediately because they read the same numbers.
          </InfoNote>
        </div>
      </Card>

      {/* rows */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((r) => {
          const over = r.status === 'over'
          const warn = r.status === 'warning'
          return (
            <Card key={r.category} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">{r.category}</h3>
                    {over ? (
                      <Badge tone="bad" icon={AlertTriangle}>
                        Over by {inr(Math.abs(r.remaining))}
                      </Badge>
                    ) : warn ? (
                      <Badge tone="warn" icon={AlertTriangle}>
                        {r.used}% used
                      </Badge>
                    ) : (
                      <Badge tone="good" icon={CheckCircle2}>
                        On track
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-mute">
                    {inr(r.spent)} spent of {inr(r.limit)} limit
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditing(r.category)}
                  aria-label={`Edit ${r.category} budget`}
                >
                  <Pencil size={14} aria-hidden />
                  Edit
                </button>
              </div>

              <div className="mt-3">
                <ProgressBar
                  value={r.used}
                  tone={over ? 'bad' : warn ? 'warn' : 'brand'}
                  label={`${r.category} budget utilisation`}
                />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{r.used}% used</span>
                  <span className={clsx('font-semibold', r.remaining < 0 ? 'text-red-600' : 'text-ink-mute')}>
                    {r.remaining >= 0 ? `${inr(r.remaining)} left` : `${inr(Math.abs(r.remaining))} over`}
                  </span>
                </div>
              </div>

              <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-ink-soft">
                {simple
                  ? over
                    ? 'You have spent more than you planned here. Cut back for the rest of the month.'
                    : warn
                      ? 'You have used most of this budget. Slow down a little.'
                      : 'You are within your limit. Keep going.'
                  : over
                    ? `You are ${pct(Math.abs(r.remaining), r.limit)}% over the limit. Reduce ${r.category} spending for the remaining ${daysLeft} day(s), or raise the limit if it was set too low.`
                    : warn
                      ? `At ${r.used}% with ${daysLeft} day(s) left, you are spending faster than the month is passing. Aim to keep the last ${daysLeft} day(s) under ${inr(
                          Math.max(0, r.remaining / Math.max(1, daysLeft)),
                        )} a day.`
                      : `Healthy. You could safely spend about ${inr(
                          Math.round(r.remaining / Math.max(1, daysLeft)),
                        )} a day on ${r.category} for the rest of the month.`}
              </p>
            </Card>
          )
        })}

        {missing.length > 0 ? (
          <Card className="flex flex-col justify-center p-5">
            <EmptyState
              icon={Target}
              title={`${missing.length} categor${missing.length === 1 ? 'y has' : 'ies have'} no budget`}
              body={
                unbudgeted.amount > 0
                  ? `Spending still shows up in your totals, but it is not being limited. ${inr(
                      unbudgeted.amount,
                    )} currently sits outside your budgets (${unbudgeted.categories.join(', ')}).`
                  : 'Spending still shows up in your totals, but it is not being limited. Add a limit to start tracking it.'
              }
              action={
                <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                  <Plus size={15} aria-hidden />
                  Add a budget
                </button>
              }
            />
          </Card>
        ) : null}
      </div>

      {/* breakdown by category spend */}
      <Card className="mt-4 p-4 sm:p-5">
        <SectionHeader
          title="Spending against limits"
          subtitle="Every budgeted category this month"
          action={<TrendingUp size={16} className="text-brand-500" aria-hidden />}
        />
        <div className="space-y-3">
          {rows.map((r) => {
            const max = Math.max(r.limit, r.spent, 1)
            const width = Math.min(100, (r.spent / max) * 100)
            const limitPct = Math.min(100, (r.limit / max) * 100)
            return (
              <div key={r.category} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-ink-soft">{r.category}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className={clsx(
                      'h-full rounded-lg transition-[width] duration-500',
                      r.status === 'over' ? 'bg-red-400' : r.status === 'warning' ? 'bg-amber-400' : 'bg-brand-400',
                    )}
                    style={{ width: `${width}%` }}
                  />
                  <span
                    className="absolute inset-y-0 w-0.5 bg-ink/50"
                    style={{ left: `${limitPct}%` }}
                    title={`Limit ${inr(r.limit)}`}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-xs font-semibold text-ink">
                  {inr(r.spent)} <span className="text-ink-mute">/ {inr(r.limit)}</span>
                </span>
              </div>
            )
          })}
          {byCat.Other > 0 && !state.budgets.some((b) => b.category === 'Other') ? (
            <div className="flex items-center gap-3 opacity-70">
              <span className="w-24 shrink-0 text-xs font-semibold text-ink-soft">Other</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                <div className="h-full rounded-lg bg-slate-300" style={{ width: '100%' }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs font-semibold text-ink-mute">{inr(byCat.Other)}</span>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] text-ink-mute">
          The vertical line marks your limit. Grey bars are categories you have not budgeted yet.
        </p>
      </Card>

      <BudgetEditor
        category={editing}
        onClose={() => setEditing(null)}
        onSave={(limit) => {
          if (editing) dispatch({ type: 'budget/set', category: editing, limit })
          setEditing(null)
        }}
      />

      <AddBudgetModal
        open={adding}
        missing={missing}
        onClose={() => setAdding(false)}
        onAdd={(category, limit) => {
          dispatch({ type: 'budget/add', category, limit })
          setAdding(false)
        }}
      />
    </div>
  )
}

function Summary({
  label,
  value,
  caption,
  tone = 'text-ink',
}: {
  label: string
  value: string
  caption: string
  tone?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className={clsx('mt-1 text-2xl font-bold tracking-tight', tone)}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-mute">{caption}</p>
    </Card>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
          {n}
        </span>
        <span className="text-xs font-bold text-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">{body}</p>
    </div>
  )
}

function BudgetEditor({
  category,
  onClose,
  onSave,
}: {
  category: Category | null
  onClose: () => void
  onSave: (limit: number) => void
}) {
  const { state } = useApp()
  const existing = state.budgets.find((b) => b.category === category)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState('')

  const currentKey = category ?? ''
  if (currentKey !== key) {
    setKey(currentKey)
    setValue(existing ? String(existing.limit) : '')
    setError('')
  }

  const submit = () => {
    const n = Number(value)
    if (!value.trim() || !Number.isFinite(n)) {
      setError('Enter a number, for example 6000.')
      return
    }
    if (n <= 0) {
      setError('A budget must be greater than zero.')
      return
    }
    if (n > 1000000) {
      setError('That looks too large for a monthly category budget.')
      return
    }
    onSave(Math.round(n))
  }

  const spent = category ? (spendingByCategory(state)[category] ?? 0) : 0

  return (
    <Modal
      open={category !== null}
      onClose={onClose}
      title={`Edit ${category ?? ''} budget`}
      description="Spent amount is calculated from your transactions and never changes here."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            Save budget
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Monthly limit (₹)" error={error} hint="Whole rupees. The dashboard updates as soon as you save.">
          <input
            className="field"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/[^\d]/g, ''))
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
        </Field>
        <div className="rounded-xl bg-surface p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-mute">Spent so far</span>
            <span className="font-semibold text-ink">{inr(spent)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-ink-mute">New remaining</span>
            <span className={clsx('font-semibold', spent > Number(value || 0) ? 'text-red-600' : 'text-emerald-600')}>
              {inr(Number(value || 0) - spent)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-ink-mute">New utilisation</span>
            <span className="font-semibold text-ink">
              {Number(value) > 0 ? pct(spent, Number(value)) : 0}%
            </span>
          </div>
        </div>
        <InfoNote>
          Budget = a spending limit you choose. Utilisation = spent ÷ limit. 75% or more shows a warning; over 100%
          shows as over-budget.
        </InfoNote>
      </div>
    </Modal>
  )
}

function AddBudgetModal({
  open,
  missing,
  onClose,
  onAdd,
}: {
  open: boolean
  missing: Category[]
  onClose: () => void
  onAdd: (category: Category, limit: number) => void
}) {
  const [category, setCategory] = useState<Category | ''>('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const current = category || missing[0] || ''

  const submit = () => {
    if (!current) {
      setError('Pick a category first.')
      return
    }
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    onAdd(current as Category, Math.round(n))
    setCategory('')
    setValue('')
    setError('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a budget"
      description="Set a monthly limit for a category that does not have one yet."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            Add budget
          </button>
        </>
      }
    >
      {missing.length === 0 ? (
        <p className="text-sm text-ink-mute">Every category already has a budget.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Category">
            <select
              className="field"
              value={current}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {missing.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monthly limit (₹)" error={error}>
            <input
              className="field"
              inputMode="numeric"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/[^\d]/g, ''))
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="2500"
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import {
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../state/AppContext'
import { splitBills } from '../data/selectors'
import type { Bill, Category } from '../data/types'
import { CATEGORIES } from '../data/types'
import { dueLabel, formatDayMonth, inr } from '../lib/format'
import { Badge, Card, EmptyState, Field, InfoNote, Modal, PageHeader } from '../components/ui'

const DUE_SOON_DAYS = 7

export function Bills() {
  const { state, dispatch, simple } = useApp()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Bill | null>(null)

  const { overdue, upcoming, paid } = useMemo(() => splitBills(state), [state])
  const dueSoon = upcoming.filter((r) => r.daysLeft <= DUE_SOON_DAYS)
  const dueSoonTotal = dueSoon.reduce((s, r) => s + r.bill.amount, 0)
  const upcomingTotal = upcoming.reduce((s, r) => s + r.bill.amount, 0)

  return (
    <div>
      <PageHeader
        title="Bills & Reminders"
        subtitle="Keep every due date in one place. Marking a bill paid only updates this demo."
        actions={
          <>
            <Badge tone={overdue.length > 0 ? 'bad' : 'good'} icon={BellRing}>
              {overdue.length > 0 ? `${overdue.length} overdue` : 'Nothing overdue'}
            </Badge>
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden />
              Add bill
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Due in 7 days</p>
          <p className="mt-1 text-2xl font-bold text-ink">{inr(dueSoonTotal)}</p>
          <p className="mt-1 text-[11px] text-ink-mute">{dueSoon.length} bill{dueSoon.length === 1 ? '' : 's'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">All upcoming</p>
          <p className="mt-1 text-2xl font-bold text-ink">{inr(upcomingTotal)}</p>
          <p className="mt-1 text-[11px] text-ink-mute">{upcoming.length} still to pay</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Paid</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{paid.length}</p>
          <p className="mt-1 text-[11px] text-ink-mute">Marked paid in this session</p>
        </Card>
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <InfoNote>
          Everything here is an in-app demonstration. Saathi does not initiate payments, send SMS or email, or claim
          any device notification was delivered. Use your own banking app for real bills.
        </InfoNote>
      </Card>

      {/* overdue */}
      {overdue.length > 0 ? (
        <Section title="Overdue" subtitle="Past their due date — clear these first" tone="bad" className="mt-5">
          <ul className="space-y-3">
            {overdue.map(({ bill, daysLeft }) => (
              <BillCard
                key={bill.id}
                bill={bill}
                daysLeft={daysLeft}
                onPay={() => dispatch({ type: 'bill/pay', id: bill.id })}
                onEdit={() => setEditing(bill)}
                onDelete={() => setConfirmDelete(bill)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {/* upcoming */}
      <Section
        title="Upcoming"
        subtitle={`${upcoming.length} bill${upcoming.length === 1 ? '' : 's'} waiting`}
        tone="brand"
        className="mt-5"
      >
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No bills waiting"
            body="Every bill on your list is marked paid. Add a new reminder to keep track of the next one."
            action={
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <Plus size={15} aria-hidden />
                Add a bill
              </button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map(({ bill, daysLeft }) => (
              <BillCard
                key={bill.id}
                bill={bill}
                daysLeft={daysLeft}
                onPay={() => dispatch({ type: 'bill/pay', id: bill.id })}
                onEdit={() => setEditing(bill)}
                onDelete={() => setConfirmDelete(bill)}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* paid */}
      {paid.length > 0 ? (
        <Section title="Paid" subtitle="Settled in this demo" tone="good" className="mt-5">
          <div className="space-y-3">
            {paid.map(({ bill }) => (
              <div key={bill.id}>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink line-through decoration-slate-300">
                      {bill.name}
                    </p>
                    <p className="text-[11px] text-ink-mute">
                      {inr(bill.amount)} · paid {bill.paidDate ? formatDayMonth(bill.paidDate) : ''}
                    </p>
                  </div>
                  <Badge tone="good">Paid</Badge>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => dispatch({ type: 'bill/unpay', id: bill.id })}
                  >
                    <RefreshCw size={13} aria-hidden />
                    Undo
                  </button>
                 </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Step
          title="Days until due"
          body={simple ? 'How many days are left before the due date.' : 'Computed from today’s date to the due date: negative means overdue.'}
        />
        <Step
          title="Recurring"
          body="A small repeat icon means the bill comes back every month — recharges, utilities and subscriptions."
        />
        <Step
          title="Mark as paid"
          body={simple ? 'Tap “Mark paid” to move it to the Paid list.' : 'Moves the bill to the Paid section and updates your reminders immediately. No real payment is triggered.'}
        />
      </div>

      <BillForm
        mode="add"
        bill={adding ? PLACEHOLDER_BILL : null}
        onClose={() => setAdding(false)}
        onSave={(draft) => {
          dispatch({
            type: 'bill/add',
            bill: {
              id: `b${Date.now().toString(36)}`,
              name: draft.name,
              amount: draft.amount,
              dueDate: draft.dueDate,
              status: 'upcoming',
              recurring: draft.recurring,
              category: draft.category,
            },
          })
          setAdding(false)
        }}
      />

      <BillForm
        mode="edit"
        bill={editing}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          if (editing) {
            dispatch({
              type: 'bill/update',
              id: editing.id,
              patch: {
                name: draft.name,
                amount: draft.amount,
                dueDate: draft.dueDate,
                recurring: draft.recurring,
                category: draft.category,
              },
            })
          }
          setEditing(null)
        }}
      />

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        description="The reminder will be removed from this browser."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (confirmDelete) dispatch({ type: 'bill/remove', id: confirmDelete.id })
                setConfirmDelete(null)
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">This only affects local demo data.</p>
      </Modal>
    </div>
  )
}

const PLACEHOLDER_BILL: Bill = {
  id: '',
  name: '',
  amount: 0,
  dueDate: new Date().toISOString(),
  status: 'upcoming',
  recurring: false,
  category: 'Bills',
}

function Section({
  title,
  subtitle,
  tone,
  children,
  className,
}: {
  title: string
  subtitle: string
  tone: 'bad' | 'brand' | 'good'
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          className={clsx(
            'text-base font-bold',
            tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-700' : 'text-ink',
          )}
        >
          {title}
        </h2>
        <span className="text-xs text-ink-mute">{subtitle}</span>
      </div>
      {children}
    </section>
  )
}

function BillCard({
  bill,
  daysLeft,
  onPay,
  onEdit,
  onDelete,
}: {
  bill: Bill
  daysLeft: number
  onPay: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const overdue = daysLeft < 0
  const soon = daysLeft >= 0 && daysLeft <= 3
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-brand-200 sm:flex-row sm:items-center">
      <span
        className={clsx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          overdue ? 'bg-red-50 text-red-600' : soon ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600',
        )}
      >
        <CalendarClock size={18} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{bill.name}</p>
          {bill.recurring ? (
            <Badge tone="neutral" icon={RefreshCw}>
              Monthly
            </Badge>
          ) : null}
          {overdue ? (
            <Badge tone="bad">{dueLabel(bill.dueDate)}</Badge>
          ) : soon ? (
            <Badge tone="warn" icon={Clock}>
              {dueLabel(bill.dueDate)}
            </Badge>
          ) : (
            <Badge tone="neutral" icon={Clock}>
              {dueLabel(bill.dueDate)}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-ink-mute">
          Due {formatDayMonth(bill.dueDate)} · {bill.category} ·{' '}
          {daysLeft < 0 ? `${Math.abs(daysLeft)} day(s) late` : daysLeft === 0 ? 'today' : `in ${daysLeft} day(s)`}
        </p>
      </div>

      <p className="text-lg font-bold text-ink sm:text-right">{inr(bill.amount)}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onPay}>
          <Check size={14} aria-hidden />
          Mark paid
        </button>
        <button type="button" className="btn-ghost" onClick={onEdit} aria-label={`Edit ${bill.name}`}>
          <Pencil size={14} aria-hidden />
        </button>
        <button type="button" className="btn-danger" onClick={onDelete} aria-label={`Delete ${bill.name}`}>
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </li>
  )
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-mute">{body}</p>
    </div>
  )
}

interface Draft {
  name: string
  amount: number
  dueDate: string
  recurring: boolean
  category: Category
}

function BillForm({
  mode,
  bill,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit'
  bill: Bill | null
  onClose: () => void
  onSave: (draft: Draft) => void
}) {
  const [form, setForm] = useState({
    name: '',
    amount: '',
    dueDate: '',
    recurring: false,
    category: 'Bills' as Category,
  })
  const [error, setError] = useState('')
  const [seed, setSeed] = useState('')

  const key = `${mode}:${bill?.id ?? 'new'}:${bill?.dueDate ?? ''}`
  if (key !== seed) {
    setSeed(key)
    setForm({
      name: bill?.name ?? '',
      amount: bill?.amount ? String(bill.amount) : '',
      dueDate: bill ? bill.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      recurring: bill?.recurring ?? false,
      category: bill?.category ?? 'Bills',
    })
    setError('')
  }

  const submit = () => {
    if (!form.name.trim()) {
      setError('Give the bill a name, like "Electricity".')
      return
    }
    const n = Number(form.amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!form.dueDate) {
      setError('Pick a due date.')
      return
    }
    onSave({
      name: form.name.trim(),
      amount: Math.round(n),
      dueDate: new Date(form.dueDate).toISOString(),
      recurring: form.recurring,
      category: form.category,
    })
    setError('')
  }

  return (
    <Modal
      open={bill !== null}
      onClose={onClose}
      title={mode === 'add' ? 'Add a bill' : 'Edit bill'}
      description={mode === 'add' ? 'A reminder only — Saathi will not pay it for you.' : 'Update the details of this reminder.'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            {mode === 'add' ? 'Add bill' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bill name">
          <input
            className="field"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Electricity bill"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" error={error}>
            <input
              className="field"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, '') })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="1420"
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              className="field"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            className="field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
          />
          <span>
            <span className="font-semibold text-ink">Repeats every month</span>
            <span className="block text-[11px] text-ink-mute">For recharges, utilities and subscriptions</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

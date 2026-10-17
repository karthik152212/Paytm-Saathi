import { useMemo, useState } from 'react'
import { CalendarDays, Check, Pencil, Plus, PiggyBank, Trash2, TrendingUp } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { contributionsFor, goalRows, savedThisMonth } from '../data/selectors'
import type { SavingsGoal } from '../data/types'
import { formatDayMonth, inr } from '../lib/format'
import { Badge, Card, EmptyState, Field, InfoNote, Modal, PageHeader, ProgressBar, SectionHeader } from '../components/ui'

const EMPTY_GOAL = { name: '', target: '', date: '', note: '' }

export function Goals() {
  const { state, dispatch, simple } = useApp()
  const [contributing, setContributing] = useState<SavingsGoal | null>(null)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SavingsGoal | null>(null)

  const rows = useMemo(() => goalRows(state), [state])
  const saved = savedThisMonth(state)
  const totalTarget = rows.reduce((s, r) => s + r.goal.target, 0)
  const totalSaved = rows.reduce((s, r) => s + r.saved, 0)
  const overall = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Savings Goals"
        subtitle="Money you have deliberately set aside. Contributions are recorded locally in this browser."
        actions={
          <>
            <Badge tone="teal">{inr(saved)} added this month</Badge>
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden />
              New goal
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Total saved</p>
          <p className="mt-1 text-2xl font-bold text-ink">{inr(totalSaved)}</p>
          <p className="mt-1 text-[11px] text-ink-mute">Across {rows.length} goal{rows.length === 1 ? '' : 's'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Combined target</p>
          <p className="mt-1 text-2xl font-bold text-ink">{inr(totalTarget)}</p>
          <p className="mt-1 text-[11px] text-ink-mute">{inr(Math.max(0, totalTarget - totalSaved))} still to go</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Overall progress</p>
          <p className="mt-1 text-2xl font-bold text-ink">{overall}%</p>
          <ProgressBar className="mt-2" value={overall} tone="teal" label="Overall savings progress" />
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-4 p-5">
          <EmptyState
            icon={PiggyBank}
            title="No savings goals yet"
            body="Create a goal such as an emergency fund or a new laptop, then add your first contribution."
            action={
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <Plus size={15} aria-hidden />
                Create your first goal
              </button>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const contribs = contributionsFor(state, r.goal.id)
            return (
              <Card key={r.goal.id} className="flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{r.goal.name}</h3>
                      {r.progress >= 100 ? (
                        <Badge tone="good" icon={Check}>
                          Complete
                        </Badge>
                      ) : (
                        <Badge tone="teal">{r.progress}%</Badge>
                      )}
                    </div>
                    {r.goal.note ? <p className="mt-0.5 text-xs text-ink-mute">{r.goal.note}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1.5"
                      onClick={() => setEditing(r.goal)}
                      aria-label={`Edit ${r.goal.name}`}
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1.5"
                      onClick={() => setConfirmDelete(r.goal)}
                      aria-label={`Delete ${r.goal.name}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Saved</p>
                    <p className="text-xl font-bold text-ink">{inr(r.saved)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Target</p>
                    <p className="text-sm font-semibold text-ink-soft">{inr(r.goal.target)}</p>
                  </div>
                </div>

                <ProgressBar className="mt-2" value={r.progress} tone="teal" label={`${r.goal.name} progress`} />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">{inr(r.remaining)} to go</span>
                  {r.goal.targetDate ? (
                    <span className="flex items-center gap-1 text-ink-mute">
                      <CalendarDays size={13} aria-hidden />
                      {formatDayMonth(r.goal.targetDate)}
                    </span>
                  ) : null}
                </div>

                {contribs.length > 0 ? (
                  <div className="mt-3 rounded-xl bg-surface p-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">
                      Recent contributions
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {contribs.slice(0, 3).map((c) => (
                        <li key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-ink-soft">{formatDayMonth(c.date)}</span>
                          <span className="font-semibold text-teal-700">+{inr(c.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => setContributing(r.goal)}
                  >
                    <TrendingUp size={15} aria-hidden />
                    Add money
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="mt-4 p-4 sm:p-5">
        <SectionHeader title="What these numbers mean" subtitle="Plain and honest" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Step
            title="Progress"
            body={simple ? 'Saved ÷ target, shown as a percentage.' : 'Progress = saved ÷ target. It stops at 100% visually even if you contribute more.'}
          />
          <Step title="Remaining" body="Target − saved. The exact amount still missing." />
          <Step
            title="This is a demo"
            body="Goal projections are illustrative. Saathi does not invest money, and nothing here is investment advice."
          />
        </div>
        <div className="mt-3">
          <InfoNote>
            Contributing money in Saathi only changes local demo data. No real transfer happens, and your bank
            balance is untouched.
          </InfoNote>
        </div>
      </Card>

      <ContributeModal
        goal={contributing}
        onClose={() => setContributing(null)}
        onSubmit={(amount) => {
          if (contributing) dispatch({ type: 'goal/contribute', goalId: contributing.id, amount })
          setContributing(null)
        }}
      />

      <GoalForm
        mode="edit"
        goal={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) dispatch({ type: 'goal/update', id: editing.id, patch })
          setEditing(null)
        }}
      />

      <GoalForm
        mode="add"
        goal={adding ? ({ ...EMPTY_GOAL } as unknown as SavingsGoal) : null}
        onClose={() => setAdding(false)}
        onSave={(patch) => {
          dispatch({
            type: 'goal/add',
            goal: {
              id: `g${Date.now().toString(36)}`,
              name: patch.name ?? 'New goal',
              target: patch.target ?? 10000,
              saved: 0,
              targetDate: patch.targetDate,
              note: patch.note ?? '',
            },
          })
          setAdding(false)
        }}
      />

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        description="This removes the goal and its contribution history from this browser."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (confirmDelete) dispatch({ type: 'goal/remove', id: confirmDelete.id })
                setConfirmDelete(null)
              }}
            >
              Delete goal
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          {confirmDelete ? `${inr(confirmDelete.saved)} has been saved in this goal. Deleting it will not move that
          money anywhere — this is only demo data.` : ''}
        </p>
      </Modal>
    </div>
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

function ContributeModal({
  goal,
  onClose,
  onSubmit,
}: {
  goal: SavingsGoal | null
  onClose: () => void
  onSubmit: (amount: number) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [seed, setSeed] = useState('')

  if ((goal?.id ?? '') !== seed) {
    setSeed(goal?.id ?? '')
    setValue('')
    setError('')
  }

  const remaining = goal ? Math.max(0, goal.target - goal.saved) : 0

  const submit = () => {
    const n = Number(value)
    if (!value.trim() || !Number.isFinite(n)) {
      setError('Enter an amount, for example 1000.')
      return
    }
    if (n <= 0) {
      setError('Contribution must be greater than zero.')
      return
    }
    if (n > 1000000) {
      setError('That amount looks too large for this demo.')
      return
    }
    onSubmit(Math.round(n))
  }

  return (
    <Modal
      open={goal !== null}
      onClose={onClose}
      title={`Add money to ${goal?.name ?? ''}`}
      description={`Currently ${inr(goal?.saved ?? 0)} of ${inr(goal?.target ?? 0)}`}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            Add contribution
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Amount (₹)"
          error={error}
          hint={remaining > 0 ? `${inr(remaining)} left to reach your target.` : 'This goal is already complete — you can still add more.'}
        >
          <input
            className="field"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/[^\d]/g, ''))
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="1000"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[500, 1000, 2500, 5000].map((n) => (
            <button key={n} type="button" className="btn-ghost" onClick={() => setValue(String(n))}>
              +{inr(n)}
            </button>
          ))}
        </div>
        {goal && Number(value) > 0 ? (
          <div className="rounded-xl bg-surface p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-mute">New saved amount</span>
              <span className="font-semibold text-ink">{inr(goal.saved + Number(value))}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-ink-mute">New progress</span>
              <span className="font-semibold text-teal-700">
                {Math.min(100, Math.round(((goal.saved + Number(value)) / goal.target) * 100))}%
              </span>
            </div>
          </div>
        ) : null}
        <InfoNote>
          Adding a contribution updates your goal progress, your “saved this month” total and your available balance
          immediately — all of it stays on this device.
        </InfoNote>
      </div>
    </Modal>
  )
}

function GoalForm({
  mode,
  goal,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit'
  goal: SavingsGoal | null
  onClose: () => void
  onSave: (patch: Partial<SavingsGoal>) => void
}) {
  const [form, setForm] = useState({ name: '', target: '', date: '', note: '' })
  const [error, setError] = useState('')
  const [seed, setSeed] = useState('')

  const key = `${mode}:${goal?.id ?? ''}`
  if (key !== seed) {
    setSeed(key)
    setForm({
      name: goal?.name ?? '',
      target: goal?.target ? String(goal.target) : '',
      date: goal?.targetDate ? goal.targetDate.slice(0, 10) : '',
      note: goal?.note ?? '',
    })
    setError('')
  }

  const submit = () => {
    if (!form.name.trim()) {
      setError('Give your goal a name, like "Emergency fund".')
      return
    }
    const n = Number(form.target)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a target amount greater than zero.')
      return
    }
    if (n > 10000000) {
      setError('That target looks too large for this demo.')
      return
    }
    onSave({
      name: form.name.trim(),
      target: Math.round(n),
      targetDate: form.date ? new Date(form.date).toISOString() : undefined,
      note: form.note.trim(),
    })
    setForm(EMPTY_GOAL)
    setError('')
  }

  return (
    <Modal
      open={goal !== null}
      onClose={onClose}
      title={mode === 'add' ? 'New savings goal' : 'Edit goal'}
      description={mode === 'add' ? 'What are you saving for?' : 'Update the target, date or description.'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            {mode === 'add' ? 'Create goal' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Goal name">
          <input
            className="field"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Emergency fund"
          />
        </Field>
        <Field label="Target amount (₹)" error={error}>
          <input
            className="field"
            inputMode="numeric"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value.replace(/[^\d]/g, '') })}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="50000"
          />
        </Field>
        <Field label="Target date (optional)">
          <input
            type="date"
            className="field"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Why this goal? (optional)">
          <input
            className="field"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Three months of basic expenses"
          />
        </Field>
      </div>
    </Modal>
  )
}


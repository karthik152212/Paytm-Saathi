import { useState } from 'react'
import { AlertTriangle, Database, Info, RefreshCcw, ShieldCheck, Sparkles, User } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { STORAGE_KEY } from '../data/types'
import { Avatar, Badge, Card, Field, InfoNote, Modal, PageHeader, SectionHeader } from '../components/ui'
import { SimpleModeToggle } from '../components/layout/Shell'
import { inr } from '../lib/format'
import { availableBalance, budgetTotals, spendingThisMonth } from '../data/selectors'

export function Settings() {
  const { state, dispatch, resetDemo } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  const [name, setName] = useState(state.profile.name)
  const [saved, setSaved] = useState(false)

  const totals = budgetTotals(state)
  let storageSize = '0 KB'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? ''
    storageSize = `${(new Blob([raw]).size / 1024).toFixed(1)} KB`
  } catch {
    storageSize = 'unavailable'
  }

  const saveProfile = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    dispatch({ type: 'profile/update', name: trimmed })
    setName(trimmed)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Settings & Simple Mode"
        subtitle="Preferences, demo data and how this prototype stores information."
        actions={<Badge tone="teal">Stored only in this browser</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* profile */}
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Your profile" subtitle="A simple demo identity — no login, no account" icon={User} />
          <div className="flex items-center gap-3">
            <Avatar name={state.profile.name} size={48} />
            <div>
              <p className="text-sm font-bold text-ink">{state.profile.name}</p>
              <p className="text-xs text-ink-mute">{state.profile.subtitle}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Field label="Display name" hint={saved ? 'Saved locally.' : 'Used in the dashboard greeting.'}>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
              />
            </Field>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={saveProfile} disabled={!name.trim()}>
                Save profile
              </button>
              <button type="button" className="btn-ghost" onClick={() => setName(state.profile.name)}>
                Revert
              </button>
            </div>
          </div>
        </Card>

        {/* simple mode */}
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Simple Mode" subtitle="Larger text and plainer wording, same features" />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
            <div>
              <p className="text-sm font-semibold text-ink">Turn on Simple Mode</p>
              <p className="text-xs text-ink-mute">Applies immediately across every screen.</p>
            </div>
            <SimpleModeToggle />
          </div>
          <ul className="mt-3 space-y-2 text-xs text-ink-soft">
            <li className="flex gap-2">
              <span className="text-brand-600">·</span> Type is larger and easier to read throughout the app.
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">·</span> Financial jargon is replaced with everyday words — for example
              “you have used most of this month’s budget” instead of “budget utilisation: 82%”.
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">·</span> Risk wording becomes gentle and direct: “This payment looks
              different from your usual activity. Check it before taking action.”
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">·</span> Nothing is removed — every feature stays available.
            </li>
          </ul>
          <div className="mt-3">
            <InfoNote>Your choice is remembered on this device, even after a refresh.</InfoNote>
          </div>
        </Card>

        {/* demo data */}
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Demo data" subtitle="What is currently stored" icon={Database} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Transactions" value={String(state.transactions.length)} />
            <Stat label="Budgets" value={String(state.budgets.length)} />
            <Stat label="Goals" value={String(state.goals.length)} />
            <Stat label="Bills" value={String(state.bills.length)} />
            <Stat label="Chat messages" value={String(state.chat.length)} />
            <Stat label="Storage used" value={storageSize} />
          </div>
          <div className="mt-3 rounded-xl bg-surface p-3 text-xs text-ink-soft">
            <p>
              <strong>Balance:</strong> {inr(availableBalance(state))} · <strong>Spent this month:</strong>{' '}
              {inr(spendingThisMonth(state))} · <strong>Budget left:</strong> {inr(totals.remaining)}
            </p>
            <p className="mt-1 break-all text-[11px] text-ink-mute">LocalStorage key: {STORAGE_KEY}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
              <RefreshCcw size={14} aria-hidden />
              Reset demo data
            </button>
          </div>
          <div className="mt-3">
            <InfoNote>
              Resetting restores the original seeded scenario: sample transactions, budgets, goals, bills and a fresh
              conversation. Your edits will be discarded after confirmation.
            </InfoNote>
          </div>
        </Card>

        {/* about */}
        <Card className="p-4 sm:p-5">
          <SectionHeader title="About this prototype" subtitle="What it is — and what it is not" icon={Sparkles} />
          <div className="space-y-3 text-xs leading-relaxed text-ink-soft">
            <p className="rounded-xl bg-brand-50 p-3 text-brand-800">
              <strong>Paytm Saathi — From Payments to Progress.</strong> An AI-powered personal finance companion for
              students, senior citizens and first-time digital-payment users. Built as an independent demonstration
              prototype.
            </p>
            <p>
              <strong>It does not:</strong> connect to any bank or Paytm account, process payments, send SMS or email,
              call an external AI service, or perform production fraud detection.
            </p>
            <p>
              <strong>It does:</strong> compute every number from a seeded, internally consistent dataset; persist your
              edits in LocalStorage; and answer questions using transparent local rules.
            </p>
            <p className="rounded-xl bg-slate-100 p-3 text-ink-soft">
              Not affiliated with, endorsed by, or connected to Paytm. All data is simulated. Nothing here is
              financial advice.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral" icon={ShieldCheck}>
              No API keys
            </Badge>
            <Badge tone="neutral" icon={Database}>
              No backend
            </Badge>
            <Badge tone="neutral" icon={Info}>
              Offline capable
            </Badge>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        description="This restores the original seeded scenario."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                resetDemo()
                setName(state.profile.name)
                setConfirmReset(false)
              }}
            >
              <RefreshCcw size={14} aria-hidden />
              Reset everything
            </button>
          </>
        }
      >
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle size={18} aria-hidden />
          </span>
          <div className="text-sm leading-relaxed text-ink-soft">
            <p>
              Your budget edits, goal contributions, bill updates, profile name and conversation will be replaced by
              the original sample data.
            </p>
            <p className="mt-2 text-xs text-ink-mute">This cannot be undone.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-ink">{value}</p>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  Eye,
  Flag,
  Info,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  ThumbsUp,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../state/AppContext'
import { navigate } from '../router'
import { formatDayMonth, formatTime, inr } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from '../components/ui'
import {
  RULES,
  SAFETY_CHECKLIST,
  describeAlertForSimpleMode,
  safetySummary,
  scoreTransactions,
  severityLabel,
} from '../safety/riskScoring'
import type { RiskAlert } from '../safety/riskScoring'

const SEVERITY_STYLE: Record<string, { chip: string; box: string; bar: string }> = {
  high: { chip: 'bg-red-50 text-red-700', box: 'border-red-200 bg-red-50/50', bar: 'bg-red-500' },
  medium: { chip: 'bg-amber-50 text-amber-700', box: 'border-amber-200 bg-amber-50/40', bar: 'bg-amber-500' },
  low: { chip: 'bg-slate-100 text-slate-600', box: 'border-line bg-slate-50/60', bar: 'bg-slate-400' },
}

export function Safety() {
  const { state, simple } = useApp()
  const alerts = useMemo(() => scoreTransactions(state), [state])
  const summary = useMemo(() => safetySummary(alerts), [alerts])
  const [open, setOpen] = useState<string | null>(alerts[0]?.id ?? null)

  const highAlert = alerts.find((a) => a.severity === 'high')

  return (
    <div>
      <PageHeader
        title="Safety Center"
        subtitle="Learn to spot payments that look different from your usual activity."
        actions={
          <Badge tone="warn" icon={ShieldAlert}>
            Illustrative alerts · simulated data
          </Badge>
        }
      />

      {/* disclaimer */}
      <Card className="border-brand-200 bg-brand-50/60 p-4 sm:p-5">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card">
            <Info size={18} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Please read this before you act on anything here</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Every alert below is a <strong>demonstration result</strong> computed from simulated transactions using
              four simple, transparent rules (listed further down). Saathi is not a fraud-detection system, it does not
              talk to any bank, and a flagged payment is <strong>not</strong> confirmed fraud — it only means the
              payment is worth a second look.
            </p>
          </div>
        </div>
      </Card>

      {/* summary */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={ShieldAlert}
          label="High priority"
          value={summary.high}
          caption={simple ? 'Check these first' : 'Score 60+ · multiple rules triggered'}
          tone="red"
        />
        <SummaryCard
          icon={Eye}
          label="Needs review"
          value={summary.medium}
          caption={simple ? 'Worth a look today' : 'Score 40–59 · two rules triggered'}
          tone="amber"
        />
        <SummaryCard
          icon={CircleCheck}
          label="Quick check"
          value={summary.low}
          caption={simple ? 'Probably fine' : 'Score 25–39 · a single rule triggered'}
          tone="slate"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Rules applied"
          value={RULES.length}
          caption="Transparent, deterministic, explainable"
          tone="brand"
        />
      </div>

      {/* guided demo scenario */}
      {highAlert ? (
        <Card className="mt-4 overflow-hidden border-red-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50/70 px-4 py-3 sm:px-5">
            <Flag size={15} className="text-red-600" aria-hidden />
            <p className="text-sm font-bold text-red-700">Demo scenario — open this one during your presentation</p>
            <Badge tone="bad">High priority</Badge>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-lg font-bold text-ink">{highAlert.headline}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {highAlert.transaction.merchant} · {inr(highAlert.transaction.amount)} ·{' '}
                {formatDayMonth(highAlert.transaction.date)} at {formatTime(highAlert.transaction.date)}
              </p>
              <ul className="mt-3 space-y-2">
                {highAlert.triggers.map((t) => (
                  <li key={t.code} className="flex gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                    <span>
                      <strong className="text-ink">{t.label}.</strong>{' '}
                      <span className="text-ink-soft">{t.explanation}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-red-600">Recommended safe action</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                {simple ? describeAlertForSimpleMode(highAlert) : highAlert.recommendation}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" className="btn-primary" onClick={() => navigate('transactions')}>
                  Review this transaction
                </button>
                <button type="button" className="btn-ghost" onClick={() => navigate('assistant')}>
                  Ask the assistant
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* alert list */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Illustrative transaction alerts"
            subtitle="Sorted by risk score · tap one to see exactly why it was flagged"
            action={<Badge tone="neutral">{alerts.length} found</Badge>}
          />
          {alerts.length === 0 ? (
            <Card className="p-5">
              <EmptyState
                icon={ShieldCheck}
                title="No alerts right now"
                body="None of your demo transactions triggered a rule. That is a normal, healthy state."
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  open={open === a.id}
                  simple={simple}
                  onToggle={() => setOpen(open === a.id ? null : a.id)}
                />
              ))}
            </ul>
          )}

          <Card className="mt-4 p-4 sm:p-5">
            <SectionHeader
              title="How the risk score works"
              subtitle="Four rules. No black box. No machine learning."
            />
            <ul className="space-y-3">
              {RULES.map((r) => (
                <li key={r.code} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-card">
                    <Lock size={14} aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">{r.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">{r.rule}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
              Weights: demo marker 40 · large amount 25 · burst of payments 25 · unusual hour 15. A transaction scores
              high at 60+, medium at 40+, and low at 25+. Ordinary payments never appear here, and nothing is ever
              labelled as confirmed fraud.
            </p>
          </Card>
        </div>

        {/* checklist */}
        <div>
          <SectionHeader title="Scam-prevention checklist" subtitle="Six habits that stop almost every common scam" />
          <Card className="p-4">
            <ul className="space-y-3.5">
              {SAFETY_CHECKLIST.map((item, i) => {
                const icons = [Lock, Smartphone, Eye, ShieldCheck, Flag, ThumbsUp]
                const Icon = icons[i % icons.length]
                return (
                  <li key={item.id} className="flex gap-3">
                    <span
                      className={clsx(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                        i < 2 ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600',
                      )}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold leading-snug text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">{item.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="mt-4 border-teal-200 bg-teal-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-teal-800">
              <AlertTriangle size={15} aria-hidden />
              Remember
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-teal-800/90">
              Never share your OTP or UPI PIN with anyone — not even someone claiming to be from your bank, Paytm or
              the police. If anyone asks, it is a scam. Independently verify any request for money by calling the
              official number yourself.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof ShieldAlert
  label: string
  value: number
  caption: string
  tone: 'red' | 'amber' | 'slate' | 'brand'
}) {
  const tones = {
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
    brand: 'bg-brand-50 text-brand-600',
  }
  return (
    <Card className="p-4">
      <span className={clsx('inline-flex rounded-xl p-2.5', tones[tone])}>
        <Icon size={17} strokeWidth={2.2} aria-hidden />
      </span>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-mute">{caption}</p>
    </Card>
  )
}

function AlertRow({
  alert,
  open,
  simple,
  onToggle,
}: {
  alert: RiskAlert
  open: boolean
  simple: boolean
  onToggle: () => void
}) {
  const style = SEVERITY_STYLE[alert.severity]
  const t = alert.transaction
  return (
    <li className={clsx('overflow-hidden rounded-2xl border bg-white shadow-card transition', open ? style.box : 'border-line')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span className={clsx('h-10 w-1.5 shrink-0 rounded-full', style.bar)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-ink">{t.merchant}</span>
            <span className={clsx('chip', style.chip)}>{severityLabel(alert.severity)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-mute">
            {alert.headline} · {formatDayMonth(t.date)}, {formatTime(t.date)}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-bold text-ink">{inr(t.amount)}</span>
          <span className="block text-[11px] text-ink-mute">score {alert.score}</span>
        </span>
        <ChevronDown
          size={16}
          className={clsx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="animate-fadeUp border-t border-line bg-white/70 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Why this was flagged</p>
          <ul className="mt-2 space-y-2.5">
            {alert.triggers.map((tr) => (
              <li key={tr.code} className="rounded-lg bg-white p-3 shadow-card">
                <p className="text-[13px] font-semibold text-ink">
                  {tr.label} <span className="ml-1 text-[11px] font-normal text-ink-mute">+{tr.weight} points</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">{tr.explanation}</p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-mute">Recommended safe action</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {simple ? describeAlertForSimpleMode(alert) : alert.recommendation}
          </p>

          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-ink-mute">
            Illustrative risk alert · demonstration result based on simulated data and simple rules — not a production
            fraud-detection model, and not a claim that this payment is fraud.
          </p>
        </div>
      ) : null}
    </li>
  )
}

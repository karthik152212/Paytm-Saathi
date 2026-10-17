import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BotMessageSquare,
  CalendarClock,
  Info,
  PiggyBank,
  Search,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../state/AppContext'
import { navigate } from '../router'
import {
  availableBalance,
  budgetTotals,
  categorySeries,
  insights,
  monthlySeries,
  savedThisMonth,
  searchTransactions,
  spendingThisMonth,
  spendingInsight,
  weeklySeries,
} from '../data/selectors'
import { formatLongDate, inr, inrShort, pct } from '../lib/format'
import { Badge, Card, CategoryIcon, EmptyState, PageHeader, ProgressBar, SectionHeader, Segmented } from '../components/ui'
import type { Category } from '../data/types'
import { CATEGORIES } from '../data/types'
import { SimpleModeToggle } from '../components/layout/Shell'

const PIE_COLORS: Record<string, string> = {
  Food: '#F59E0B',
  Transport: '#00BAF2',
  Shopping: '#8B5CF6',
  Bills: '#0EA5A4',
  Education: '#10B981',
  Other: '#94A3B8',
}

interface ChartPayload {
  payload?: { full?: string; label?: string; value?: number }
  name?: string | number
  value?: number
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartPayload[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]
  const value = p.value ?? p.payload?.value ?? 0
  const title = typeof p.name === 'string' ? p.name : (label ?? p.payload?.label ?? p.payload?.full ?? '')
  const sub = p.payload?.full && p.payload.full !== title ? p.payload.full : null
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-pop">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{sub ?? title}</p>
      <p className="text-sm font-bold text-ink">{inr(value)}</p>
      {sub ? <p className="text-[11px] text-ink-mute">{title}</p> : null}
    </div>
  )
}

export function Overview() {
  const { state, simple } = useApp()
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<Category | 'All'>('All')

  const balance = availableBalance(state)
  const spent = spendingThisMonth(state)
  const saved = savedThisMonth(state)
  const budget = budgetTotals(state)
  const insight = spendingInsight(state)
  const actionCards = insights(state)

  const weekly = useMemo(() => weeklySeries(state), [state])
  const monthly = useMemo(() => monthlySeries(state), [state])
  const cats = useMemo(() => categorySeries(state), [state])
  const recent = useMemo(
    () => searchTransactions(state, { query, category: catFilter }).slice(0, 7),
    [state, query, catFilter],
  )

  const top = cats.reduce((a, b) => (a.value > b.value ? a : b), { name: 'Food' as Category, value: 0 })
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${state.profile.name.split(' ')[0]}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{formatLongDate()}</span>
            <span aria-hidden>·</span>
            <span className="font-medium text-ink-soft">Your money, made easier to understand.</span>
          </span>
        }
        actions={
          <>
            <Badge tone="teal">Demo data</Badge>
            <span className="lg:hidden">
              <SimpleModeToggle compact />
            </span>
            <button type="button" className="btn-primary" onClick={() => navigate('assistant')}>
              <BotMessageSquare size={15} aria-hidden />
              Ask Saathi
            </button>
          </>
        }
      />

      {/* summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Wallet}
          tone="brand"
          label="Available balance"
          value={inr(balance)}
          caption={
            simple
              ? 'Money you can spend right now'
              : 'Opening balance + credits − debits − goal contributions'
          }
        />
        <SummaryCard
          icon={TrendingUp}
          tone="warn"
          label="Spending this month"
          value={inr(spent)}
          caption={simple ? 'What you have spent so far' : `${searchTransactions(state, { direction: 'debit' }).length} payments recorded`}
        />
        <SummaryCard
          icon={PiggyBank}
          tone="teal"
          label="Saved this month"
          value={inr(saved)}
          caption={simple ? 'Money set aside in your goals' : 'Contributions added to savings goals'}
        />
        <SummaryCard
          icon={Target}
          tone="brand"
          label="Remaining budget"
          value={inr(budget.remaining)}
          caption={
            simple
              ? budget.status === 'over'
                ? 'You have used up this month’s budget'
                : 'Left across all your budgets'
              : `${budget.used}% of ${inr(budget.limit)} used · ${state.budgets.length} budgets`
          }
          toneValue={budget.status === 'over' ? 'text-red-600' : budget.status === 'warning' ? 'text-amber-600' : undefined}
        />
      </div>

      {/* natural language insight */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Info size={18} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
              {simple ? 'What is happening with your money' : 'Spending insight'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink">
              {simple
                ? `You have spent ${inr(spent)} so far this month. ${top.value > 0 ? `${top.name} is where most of your money went.` : ''} You still have ${inr(
                    budget.remaining,
                  )} of your budget left.`
                : insight}
            </p>
          </div>
        </div>
        {budget.limit > 0 ? (
          <div className="border-t border-line bg-slate-50/60 px-4 py-3 sm:px-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-soft">
                {simple ? 'Budget used' : 'Combined budget utilisation'}
              </span>
              <span className="font-bold text-ink">{budget.used}%</span>
            </div>
            <ProgressBar value={budget.used} tone={budget.status === 'over' ? 'bad' : budget.status === 'warning' ? 'warn' : 'brand'} label="Combined budget utilisation" />
            <p className="mt-1.5 text-[11px] text-ink-mute">
              {simple
                ? budget.used >= 75
                  ? 'You have used most of this month’s budget.'
                  : 'You are doing fine so far.'
                : `${inr(budget.spent)} spent of ${inr(budget.limit)} across ${state.budgets.length} category budgets.`}
            </p>
          </div>
        ) : null}
      </Card>

      {/* charts row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <SectionHeader
            title={simple ? 'Spending each day' : 'Weekly spending'}
            subtitle={simple ? 'The last seven days' : 'Last 7 days · debits only'}
            action={<Badge tone="brand">{inr(weekly.reduce((s, d) => s + d.value, 0))} total</Badge>}
          />
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: number) => inrShort(v)}
                  width={54}
                />
                <Tooltip cursor={{ fill: 'rgba(0,186,242,0.06)' }} content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={46}>
                  {weekly.map((d, i) => (
                    <Cell key={d.label + i} fill={i === weekly.length - 1 ? '#00BAF2' : '#A5E3FB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionHeader
            title={simple ? 'Where money went' : 'By category'}
            subtitle={simple ? 'This month' : 'This month · share of spending'}
          />
          {cats.length === 0 ? (
            <EmptyState icon={Info} title="No spending yet" body="Category totals appear once you have debits this month." />
          ) : (
            <>
              <div className="relative h-[168px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cats}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {cats.map((c) => (
                        <Cell key={c.name} fill={PIE_COLORS[c.name] ?? '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Top</p>
                    <p className="text-sm font-bold text-ink">{top.name}</p>
                    <p className="text-[11px] text-ink-mute">{pct(top.value, spent)}%</p>
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {cats.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[c.name] ?? '#94A3B8' }} aria-hidden />
                    <span className="flex-1 text-ink-soft">{c.name}</span>
                    <span className="font-semibold text-ink">{inr(c.value)}</span>
                    <span className="w-8 text-right text-ink-mute">{pct(c.value, spent)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* actionable insights */}
      <div className="mt-4">
        <SectionHeader
          title="Actionable insights"
          subtitle={simple ? 'Things worth doing next' : 'Computed from your transactions, budgets and bills'}
          action={
            <button type="button" className="btn-quiet" onClick={() => navigate('budgets')}>
              Review budgets
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {actionCards
            .filter((i) => i.id !== 'next-action')
            .map((i) => {
              const icon =
                i.id === 'top-category'
                  ? TrendingUp
                  : i.id.startsWith('budget')
                    ? Target
                    : i.id === 'next-bill'
                      ? CalendarClock
                      : PiggyBank
              const Icon = icon
              return (
                <Card key={i.id} className="flex flex-col p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={
                        'rounded-lg p-2 ' +
                        (i.kind === 'warn'
                          ? 'bg-amber-50 text-amber-600'
                          : i.kind === 'good'
                            ? 'bg-teal-50 text-teal-600'
                            : 'bg-brand-50 text-brand-600')
                      }
                    >
                      <Icon size={16} aria-hidden />
                    </span>
                    <p className="text-[13px] font-bold leading-snug text-ink">{i.title}</p>
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-mute">
                    {simple ? plainBody(i.id) : i.body}
                  </p>
                  {i.action ? (
                    <button
                      type="button"
                      className="mt-3 self-start text-xs font-bold text-brand-700 hover:underline"
                      onClick={() =>
                        navigate(
                          i.action?.includes('budget')
                            ? 'budgets'
                            : i.action?.includes('bill')
                              ? 'bills'
                              : i.action?.includes('goal')
                                ? 'goals'
                                : i.action?.includes('Review')
                                  ? 'transactions'
                                  : 'goals',
                        )
                      }
                    >
                      {i.action} →
                    </button>
                  ) : null}
                </Card>
              )
            })}
        </div>
        {actionCards.find((i) => i.id === 'next-action') ? (
          <Card className="mt-4 flex flex-col gap-3 border-brand-200 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:p-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card">
              <Target size={17} aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {simple ? 'Do this next' : 'Your next action'}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-relaxed text-ink">
                {actionCards.find((i) => i.id === 'next-action')?.body}
              </p>
            </div>
          </Card>
        ) : null}
      </div>

      {/* recent + monthly trend */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <SectionHeader
            title="Recent transactions"
            subtitle="Search or filter your latest payments"
            action={
              <button type="button" className="btn-quiet" onClick={() => navigate('transactions')}>
                View all
              </button>
            }
          />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="field pl-9"
                placeholder="Search merchant or category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search recent transactions"
              />
            </div>
            <Segmented<Category | 'All'>
              ariaLabel="Filter by category"
              value={catFilter}
              onChange={setCatFilter}
              options={[
                { value: 'All' as const, label: 'All' },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching transactions"
              body="Try a different merchant name or clear the category filter."
              action={
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setQuery('')
                    setCatFilter('All')
                  }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="-mx-1 divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => navigate('transactions')}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <CategoryIcon category={t.category} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{t.merchant}</span>
                      <span className="block truncate text-[11px] text-ink-mute">
                        {t.category} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                        {t.method}
                      </span>
                    </span>
                    <span
                      className={
                        'flex items-center gap-1 text-[13px] font-bold ' +
                        (t.direction === 'credit' ? 'text-emerald-600' : 'text-ink')
                      }
                    >
                      {t.direction === 'credit' ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} className="text-slate-400" aria-hidden />}
                      {t.direction === 'credit' ? '+' : '−'}
                      {inr(t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5 lg:col-span-2">
          <SectionHeader
            title={simple ? 'Spending each month' : 'Monthly trend'}
            subtitle={simple ? 'The last six months' : 'Last 6 months · all sources combined'}
          />
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: number) => inrShort(v)}
                  width={54}
                />
                <Tooltip cursor={{ fill: 'rgba(0,186,242,0.06)' }} content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {monthly.map((m, i) => (
                    <Cell key={m.key} fill={i === monthly.length - 1 ? '#0EA5A4' : '#A7F3EE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
            {simple
              ? 'Your spending has been fairly steady over the last few months.'
              : 'Older months use seeded historical aggregates; the current month is computed from your transaction list.'}
          </p>
        </Card>
      </div>
    </div>
  )
}

function plainBody(id: string): string {
  const map: Record<string, string> = {
    'top-category': 'This is where most of your money went this month.',
    'budget-usage': 'You have used a large part of this month’s budget already.',
    'budget-over': 'You have spent more than you planned for this month.',
    'next-bill': 'A payment is coming up. Keep the money ready.',
    'saving-opportunity': 'You have some budget left over that you could put into a goal.',
  }
  return map[id] ?? ''
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
  toneValue,
}: {
  icon: typeof Wallet
  label: string
  value: string
  caption: string
  tone: 'brand' | 'warn' | 'teal'
  toneValue?: string
}) {
  const iconTone =
    tone === 'teal' ? 'bg-teal-50 text-teal-600' : tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'
  return (
    <Card className="p-4 sm:p-5">
      <div className={iconTone + ' inline-flex rounded-xl p-2.5'}>
        <Icon size={18} strokeWidth={2.2} aria-hidden />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className={'mt-1 text-2xl font-bold tracking-tight ' + (toneValue ?? 'text-ink')}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-mute">{caption}</p>
    </Card>
  )
}


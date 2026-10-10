import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BotMessageSquare, Send, Sparkles, Trash2, User } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../state/AppContext'
import { SUGGESTED_QUESTIONS, answer } from '../assistant/engine'
import { Badge, Card, PageHeader } from '../components/ui'
import { inr } from '../lib/format'
import { availableBalance, budgetTotals } from '../data/selectors'

export function Assistant() {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages = state.chat

  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, thinking])

  useEffect(() => {
    if (!thinking) return
    const t = window.setTimeout(() => setThinking(false), 200)
    return () => window.clearTimeout(t)
  }, [thinking])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || thinking) return
    const reply = answer(trimmed, state)
    dispatch({
      type: 'chat/push',
      message: { id: `u${Date.now().toString(36)}`, role: 'user', text: trimmed, date: new Date().toISOString() },
    })
    setDraft('')
    setThinking(true)
    // Push the computed answer on the next tick so the UI shows a real, complete response.
    window.setTimeout(() => {
      dispatch({
        type: 'chat/push',
        message: { id: `a${Date.now().toString(36)}`, role: 'assistant', text: reply, date: new Date().toISOString() },
      })
      setThinking(false)
    }, 180)
  }

  const totals = budgetTotals(state)

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask about your spending, budgets, bills and goals in plain language."
        actions={
          <>
            <Badge tone="brand" icon={Sparkles}>
              Prototype assistant · local rules · no API key
            </Badge>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => dispatch({ type: 'chat/clear' })}
              aria-label="Clear conversation"
            >
              <Trash2 size={14} aria-hidden />
              Clear
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="flex flex-col overflow-hidden lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <BotMessageSquare size={17} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Saathi Assistant</p>
              <p className="text-[11px] text-ink-mute">
                Reads your live demo data · answers instantly · never calls an external AI
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Ready
            </span>
          </div>

          <div ref={listRef} className="max-h-[52vh] min-h-[320px] flex-1 space-y-4 overflow-y-auto bg-surface/60 px-4 py-5 sm:px-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={clsx('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {m.role === 'assistant' ? (
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
                    <BotMessageSquare size={14} aria-hidden />
                  </span>
                ) : null}
                <div
                  className={clsx(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-card sm:max-w-[75%]',
                    m.role === 'user'
                      ? 'rounded-br-md bg-ink text-white'
                      : 'rounded-bl-md border border-line bg-white text-ink',
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p
                    className={clsx(
                      'mt-1.5 text-[10px]',
                      m.role === 'user' ? 'text-white/60' : 'text-ink-mute',
                    )}
                  >
                    {new Date(m.date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {m.role === 'user' ? (
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600">
                    <User size={14} aria-hidden />
                  </span>
                ) : null}
              </div>
            ))}

            {thinking ? (
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
                  <BotMessageSquare size={14} aria-hidden />
                </span>
                <div className="rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-3 shadow-card">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* suggestions */}
          <div className="border-t border-line bg-white px-4 py-3 sm:px-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                className="field max-h-32 min-h-[44px] resize-none"
                placeholder="Ask anything about your money…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(draft)
                  }
                }}
                aria-label="Message the assistant"
              />
              <button
                type="button"
                className="btn-primary h-[44px] px-4"
                onClick={() => send(draft)}
                disabled={!draft.trim() || thinking}
                aria-label="Send message"
              >
                <Send size={16} aria-hidden />
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
              Answers are computed locally from your transactions, budgets, goals and bills. The assistant distinguishes
              its calculations from general suggestions and does not provide professional financial advice.
            </p>
          </div>
        </Card>

        {/* sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">What it can see</p>
            <ul className="mt-2.5 space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Balance</span>
                <span className="font-semibold text-ink">{inr(availableBalance(state))}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Transactions</span>
                <span className="font-semibold text-ink">{state.transactions.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Budgets</span>
                <span className="font-semibold text-ink">{state.budgets.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Budget left</span>
                <span className="font-semibold text-ink">{inr(totals.remaining)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Goals</span>
                <span className="font-semibold text-ink">{state.goals.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">Bills pending</span>
                <span className="font-semibold text-ink">
                  {state.bills.filter((b) => b.status === 'upcoming').length}
                </span>
              </li>
            </ul>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">What it is good at</p>
            <ul className="mt-2.5 space-y-1.5 text-xs text-ink-soft">
              <li>· Spending summaries and top categories</li>
              <li>· Affordability checks against your balance</li>
              <li>· Practical saving plans with real numbers</li>
              <li>· Upcoming and overdue bills</li>
              <li>· Budget explanations in plain English</li>
              <li>· Financial terms and scam-safety advice</li>
            </ul>
          </Card>

          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs font-bold text-amber-800">Honest limitation</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
              This is a rule-based prototype, not a large language model. It will say so when a question falls outside
              its supported intents instead of inventing an answer. No API key is required to run it.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

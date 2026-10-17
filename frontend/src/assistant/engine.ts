import type { AppState, Category } from '../data/types'
import { CATEGORIES } from '../data/types'
import {
  availableBalance,
  budgetRows,
  budgetTotals,
  daysLeftInMonth,
  goalRows,
  incomeThisMonth,
  savedThisMonth,
  searchTransactions,
  spendingByCategory,
  spendingThisMonth,
  splitBills,
  topCategory,
} from '../data/selectors'
import { daysUntil, formatDayMonth, inr, pct } from '../lib/format'

/* ==================================================================
 * assistant/engine.ts — a rule-based financial assistant.
 *
 * It runs entirely in the browser with NO API key and NO network
 * call. Every number in an answer is computed from the app's live
 * state through the shared selectors, so answers always match the
 * dashboard.
 *
 * It is labelled in the UI as a "Prototype assistant".
 * ================================================================== */

export const SUGGESTED_QUESTIONS = [
  'Where did most of my money go?',
  'Can I afford another ₹1,000 purchase?',
  'How can I save ₹5,000 this month?',
  'Which bills are due soon?',
  'Explain my budget in simple words.',
] as const

const GLOSSARY: Record<string, string> = {
  upi:
    'UPI (Unified Payments Interface) lets you move money directly between bank accounts using a phone number or a UPI ID. You approve each payment with a 4–6 digit UPI PIN. Your UPI PIN is only ever entered by you, inside your own banking app.',
  emi:
    'EMI means Equated Monthly Instalment — a fixed amount you pay every month until a purchase or loan is fully paid. A ₹24,000 purchase over 12 EMIs costs about ₹2,000 a month, before any interest.',
  credit:
    'A credit means money coming IN to your account — salary, refund or a friend repaying you. On your dashboard credits are shown in green with an up arrow.',
  debit:
    'A debit means money going OUT — a payment, bill or purchase. Every debit reduces your available balance.',
  budget:
    'A budget is simply a spending limit you set for one category for one month. Think of it as a jar: once the jar is empty, you stop spending from it until next month.',
  interest:
    'Interest is the cost of borrowing money, or the earnings on money you save. It is usually shown as a yearly percentage (for example 12% a year) on the amount involved.',
  'compound interest':
    'Compound interest is interest that earns its own interest. Saving ₹10,000 at 7% a year becomes about ₹10,700 after a year; leave it and next year you earn on ₹10,700 too. This is why starting early matters so much.',
  inflation:
    'Inflation is the yearly rise in prices. If inflation is 6%, something costing ₹100 today costs about ₹106 next year — which is why money sitting idle slowly loses value.',
  autopay:
    'AutoPay (or e-mandate) is a standing instruction that lets a merchant collect a fixed amount from your account on a schedule — common for recharges, subscriptions and utility bills. You can usually cancel it from inside your banking or UPI app.',
  refund:
    'A refund is money returned to you after a cancelled or returned purchase. It normally reaches the original payment method in 3–7 working days.',
  'net worth':
    'Your net worth is what you own (savings, investments) minus what you owe (loans). At its simplest it is a one-line snapshot of your financial health.',
  balance:
    'Your available balance is the money you can spend right now: your opening balance plus everything credited, minus everything debited and everything you have moved into savings goals.',
  savings:
    'Savings is money you deliberately set aside instead of spending. In Saathi, money you move into a goal is counted as saved — it still belongs to you, it is simply earmarked.',
}

const SAFETY_ANSWER = `Here is the short, safe version:

• Never share your OTP or UPI PIN — not with anyone, ever. No bank, wallet or support agent will ask for them.
• Never install an app or share your screen to "confirm a refund". That is how strangers take over a phone.
• If someone asks you to pay or release money, hang up and call back on a number you already trust.
• Open your banking app yourself instead of tapping a link in a message.

Saathi flags unusual payments to help you notice them sooner — it never blocks, reverses or reports anything. Open the Safety Center to see the illustrative alerts computed from your demo data.`

interface Intent {
  id: string
  match: (q: string) => boolean
  answer: (q: string, s: AppState) => string
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

function parseAmount(q: string): number | null {
  const m = q.replace(/,/g, '').match(/(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|l|h|lakh|lac)?\b/i)
  if (!m) return null
  let n = Number.parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  const unit = (m[2] ?? '').toLowerCase()
  if (unit === 'k' || unit === 'thousand') n *= 1000
  if (unit === 'l' || unit === 'lakh' || unit === 'lac') n *= 100000
  return Math.round(n)
}

function categoryFrom(q: string): Category | null {
  const map: Record<string, Category> = {
    food: 'Food',
    foods: 'Food',
    grocery: 'Food',
    groceries: 'Food',
    restaurant: 'Food',
    eating: 'Food',
    transport: 'Transport',
    travel: 'Transport',
    cab: 'Transport',
    fuel: 'Transport',
    shopping: 'Shopping',
    clothes: 'Shopping',
    bill: 'Bills',
    bills: 'Bills',
    subscription: 'Bills',
    education: 'Education',
    course: 'Education',
    fees: 'Education',
  }
  for (const [k, v] of Object.entries(map)) if (q.includes(k)) return v
  return null
}

/* ----------------------------- intents ----------------------------- */

const INTENTS: Intent[] = [
  {
    id: 'greeting',
    match: (q) => /^(hi|hello|hey|namaste|good morning|good evening|hii)\b/.test(q) || q === 'yo',
    answer: (_q, s) =>
      `Hello ${s.profile.name.split(' ')[0]} — good to see you.\n\nI read your demo transactions, budgets, goals and bills directly, so every number I give you comes from your own dashboard.\n\nAsk me where your money went, whether you can afford something, or how to save a specific amount.`,
  },

  {
    id: 'afford',
    match: (q) => has(q, 'afford', 'can i buy', 'can i purchase', 'should i buy', 'enough to buy', 'enough money'),
    answer: (q, s) => {
      const amount = parseAmount(q) ?? 1000
      const balance = availableBalance(s)
      const cat = categoryFrom(q) ?? 'Other'
      const rows = budgetRows(s)
      const row = rows.find((r) => r.category === cat)
      const spentAfter = row ? row.spent + amount : 0
      const pctAfter = row ? pct(spentAfter, row.limit) : 0
      const totals = budgetTotals(s)
      const upcoming = splitBills(s).upcoming
      const due7 = upcoming.filter((r) => r.daysLeft <= 7).reduce((sum, r) => sum + r.bill.amount, 0)
      const afterBalance = balance - amount

      const lines: string[] = []
      lines.push(`Let's check it against your actual numbers for a ${inr(amount)} purchase in ${cat}:`)
      lines.push('')
      lines.push(
        `1. Available balance — you have ${inr(balance)}. After this purchase you would have ${inr(
          afterBalance,
        )}.`,
      )
      if (row) {
        lines.push(
          `2. ${cat} budget — ${inr(row.spent)} of ${inr(row.limit)} used. After this you would be at ${inr(
            spentAfter,
          )} (${pctAfter}% of the limit) with ${inr(row.limit - spentAfter)} left.`,
        )
      } else {
        lines.push(`2. ${cat} budget — you do not have a budget set for ${cat}, so nothing is being tracked there.`)
      }
      lines.push(
        `3. Bills ahead — ${inr(due7)} is due in the next 7 days across ${upcoming.filter((r) => r.daysLeft <= 7).length} bill(s).`,
      )
      lines.push('')

      const problems: string[] = []
      if (afterBalance < 0) problems.push('it would overdraw your balance')
      if (due7 > afterBalance - 1000) problems.push(`your bills due soon (${inr(due7)}) need that room`)
      if (row && spentAfter > row.limit) problems.push(`it would push your ${cat} budget ${pct(spentAfter, row.limit)}% of the way`)
      if (totals.remaining < 0) problems.push('your combined budgets are already crossed')

      if (problems.length === 0) {
        lines.push(
          `Verdict: yes, you can comfortably afford ${inr(
            amount,
          )} right now. Balance stays positive, your ${cat} budget absorbs it, and your upcoming bills are covered.`,
        )
      } else {
        lines.push(`Verdict: I would hold off. This purchase would mean ${problems.join(', ')}.`)
      }
      lines.push('')
      lines.push('This is a calculation on your demo data, not financial advice.')
      return lines.join('\n')
    },
  },

  {
    id: 'save',
    match: (q) => has(q, 'save', 'saving', 'cut back', 'reduce my', 'spend less', 'how do i save'),
    answer: (q, s) => {
      const target = parseAmount(q) ?? 5000
      const rows = budgetRows(s)
      const daysLeft = daysLeftInMonth()
      const headroomRows = rows
        .map((r) => ({ ...r, room: Math.max(0, r.remaining) }))
        .filter((r) => r.room > 0)
        .sort((a, b) => b.room - a.room)
      const headroom = headroomRows.reduce((sum, r) => sum + r.room, 0)

      const byCat = spendingByCategory(s)
      const discretionary = (byCat.Food ?? 0) + (byCat.Shopping ?? 0) + (byCat.Other ?? 0)
      const elapsed = Math.max(1, new Date().getDate())
      const dailyBurn = discretionary / elapsed
      const trimmed = Math.round(dailyBurn * 0.25 * daysLeft)

      const subs = s.bills.filter((b) => b.recurring && b.status === 'upcoming')
      const subSaving = subs.reduce((sum, b) => sum + b.amount, 0)

      const levers: { label: string; amount: number }[] = []
      let remaining = target
      if (headroom > 0) {
        const take = Math.min(headroom, remaining)
        levers.push({
          label: `Redirect unspent budget — you still have ${inr(headroom)} left across ${
            headroomRows.length
          } budgets (${headroomRows.map((r) => `${r.category} ${inr(r.room)}`).join(', ')}).`,
          amount: take,
        })
        remaining -= take
      }
      if (remaining > 0 && trimmed > 0) {
        const take = Math.min(trimmed, remaining)
        levers.push({
          label: `Trim everyday spending — you are averaging about ${inr(
            Math.round(dailyBurn),
          )} a day on food, shopping and extras. Cutting a quarter of that for the next ${daysLeft} day(s) frees up to ${inr(
            trimmed,
          )}.`,
          amount: take,
        })
        remaining -= take
      }
      if (remaining > 0 && subSaving > 0) {
        levers.push({
          label: `Review recurring bills — ${subs.map((b) => `${b.name} ${inr(b.amount)}`).join(', ')} run every month. Pausing one frees room.`,
          amount: Math.min(subSaving, remaining),
        })
        remaining = Math.max(0, remaining - Math.min(subSaving, remaining))
      }

      const already = savedThisMonth(s)
      const total = levers.reduce((sum, l) => sum + l.amount, 0)

      const lines: string[] = []
      lines.push(`Here is a concrete plan to save ${inr(target)} with ${daysLeft} day(s) left this month:`)
      lines.push('')
      levers.forEach((l, i) => {
        lines.push(`${i + 1}. ${l.label} → ${inr(l.amount)}`)
      })
      lines.push('')
      lines.push(
        `That comes to ${inr(total)}${remaining > 0 ? `, which is ${inr(remaining)} short of your target` : ', which covers your target'}.`,
      )
      lines.push(
        `For context, you have already set aside ${inr(already)} this month, and your balance is ${inr(availableBalance(s))}.`,
      )
      lines.push('')
      lines.push('These are suggestions based on your own demo numbers — not professional financial advice.')
      return lines.join('\n')
    },
  },

  {
    id: 'bills',
    match: (q) => has(q, 'bill', 'due soon', 'payment due', 'recharge due', 'what do i owe', 'upcoming payment'),
    answer: (_q, s) => {
      const { overdue, upcoming, paid } = splitBills(s)
      const lines: string[] = []
      if (overdue.length === 0 && upcoming.length === 0) {
        return 'You have no bills waiting. Everything on your list is already marked paid.'
      }
      if (overdue.length > 0) {
        lines.push('Overdue first:')
        overdue.forEach((r) =>
          lines.push(
            `  • ${r.bill.name} — ${inr(r.bill.amount)}, ${Math.abs(r.daysLeft)} day(s) overdue`,
          ),
        )
        lines.push('')
      }
      lines.push('Coming up:')
      upcoming.slice(0, 5).forEach((r) =>
        lines.push(
          `  • ${r.bill.name} — ${inr(r.bill.amount)}, ${
            r.daysLeft === 0 ? 'due today' : r.daysLeft === 1 ? 'due tomorrow' : `in ${r.daysLeft} days`
          } (${formatDayMonth(r.bill.dueDate)})`,
        ),
      )
      const due7 = upcoming.filter((r) => r.daysLeft <= 7).reduce((sum, r) => sum + r.bill.amount, 0)
      const due14 = upcoming.filter((r) => r.daysLeft <= 14).reduce((sum, r) => sum + r.bill.amount, 0)
      lines.push('')
      lines.push(`Total due in the next 7 days: ${inr(due7)}. Within 14 days: ${inr(due14)}.`)
      if (paid.length > 0) lines.push(`${paid.length} bill(s) are already marked paid this period.`)
      lines.push('')
      lines.push('Marking a bill paid in Saathi only updates this demo — no real payment is made.')
      return lines.join('\n')
    },
  },

  {
    id: 'budget',
    match: (q) => has(q, 'budget', 'how much can i spend', 'limit'),
    answer: (_q, s) => {
      const rows = budgetRows(s)
      const totals = budgetTotals(s)
      const daysLeft = daysLeftInMonth()
      const lines: string[] = []
      lines.push('In plain words, a budget is a spending limit for one category for this month.')
      lines.push('')
      lines.push(
        `You have ${rows.length} budgets adding up to ${inr(totals.limit)}. You have used ${inr(
          totals.spent,
        )} of that — ${totals.used}% — leaving ${inr(totals.remaining)} with ${daysLeft} day(s) to go.`,
      )
      lines.push('')
      rows.forEach((r) => {
        const plain =
          r.status === 'over'
            ? `over by ${inr(Math.abs(r.remaining))}`
            : r.used >= 75
              ? `you have used most of this budget`
              : r.used >= 40
                ? `about half used`
                : `still comfortably within limits`
        lines.push(
          `  • ${r.category}: ${r.used}% used — ${inr(r.spent)} of ${inr(r.limit)} (${plain})`,
        )
      })
      const byCat = spendingByCategory(s)
      if (byCat.Other > 0 && !rows.some((r) => r.category === 'Other')) {
        lines.push('')
        lines.push(
          `Note: ${inr(byCat.Other)} sits in "Other" with no budget. That is where the flagged demo payments landed.`,
        )
      }
      lines.push('')
      lines.push(
        totals.status === 'over'
          ? 'You are past your combined limit, so it is worth trimming for the rest of the month.'
          : totals.status === 'warning'
            ? 'You have used most of this month’s budget while there are still days left, so slow down a little.'
            : 'You are on pace. Keep going and you will finish the month inside every limit.',
      )
      return lines.join('\n')
    },
  },

  {
    id: 'spending',
    match: (q) =>
      has(
        q,
        'spend',
        'spent',
        'money go',
        'where did',
        'expenses',
        'expense',
        'top category',
        'most of my money',
        'biggest',
        'largest',
        'category',
      ),
    answer: (_q, s) => {
      const byCat = spendingByCategory(s)
      const total = spendingThisMonth(s)
      const entries = CATEGORIES.map((c) => ({ c, v: byCat[c] }))
        .filter((e) => e.v > 0)
        .sort((a, b) => b.v - a.v)
      const top = topCategory(s)
      const txns = searchTransactions(s, { direction: 'debit' })
      const lines: string[] = []
      if (total === 0) return 'You have not recorded any spending this month yet.'
      lines.push(`You have spent ${inr(total)} this month across ${txns.length} payments.`)
      lines.push('')
      entries.forEach((e) =>
        lines.push(`  • ${e.c} — ${inr(e.v)} (${pct(e.v, total)}%)`),
      )
      lines.push('')
      lines.push(
        `Most of your money went to ${top.category}: ${inr(top.amount)}, which is ${pct(
          top.amount,
          total,
        )}% of everything you spent.`,
      )
      const second = entries[1]
      if (second) {
        lines.push(
          `${second.c} was next at ${inr(second.v)} — that is ${inr(top.amount - second.v)} less than ${top.category}.`,
        )
      }
      lines.push('')
      lines.push('These totals come straight from your transaction list, so they match your dashboard exactly.')
      return lines.join('\n')
    },
  },

  {
    id: 'balance',
    match: (q) => has(q, 'balance', 'how much do i have', 'money do i have', 'account balance'),
    answer: (_q, s) => {
      const balance = availableBalance(s)
      const income = incomeThisMonth(s)
      const spend = spendingThisMonth(s)
      const saved = savedThisMonth(s)
      return [
        `Your available balance is ${inr(balance)}.`,
        '',
        `This month you received ${inr(income)} and spent ${inr(spend)}. You also moved ${inr(
          saved,
        )} into your savings goals.`,
        income - spend >= 0
          ? `That leaves ${inr(income - spend)} of this month's income unspent.`
          : `You have spent ${inr(spend - income)} more than you received this month — worth watching.`,
        '',
        'Balance = opening balance + credits − debits − money moved into goals. All figures are simulated demo data.',
      ].join('\n')
    },
  },

  {
    id: 'goals',
    match: (q) => has(q, 'goal', 'saving goal', 'emergency fund', 'laptop', 'trip', 'how am i doing on'),
    answer: (_q, s) => {
      const rows = goalRows(s)
      if (rows.length === 0) return 'You have not created a savings goal yet. Add one from the Savings Goals screen.'
      const lines: string[] = ['Here is where your goals stand:', '']
      rows.forEach((r) => {
        lines.push(
          `  • ${r.goal.name} — ${inr(r.saved)} of ${inr(r.goal.target)} (${r.progress}%), ${inr(
            r.remaining,
          )} to go${
            r.goal.targetDate
              ? `, target ${new Date(r.goal.targetDate).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}`
              : ''
          }`,
        )
      })
      lines.push('')
      lines.push(
        `You have added ${inr(savedThisMonth(s))} this month. Goal figures are illustrative projections, not investment advice.`,
      )
      return lines.join('\n')
    },
  },

  {
    id: 'safety',
    match: (q) =>
      has(q, 'scam', 'fraud', 'otp', 'upi pin', 'phishing', 'suspicious', 'safety', 'safe from', 'hacked', 'stolen'),
    answer: () => SAFETY_ANSWER,
  },

  {
    id: 'income',
    match: (q) => has(q, 'income', 'salary', 'stipend', 'earned', 'credit in'),
    answer: (_q, s) => {
      const income = incomeThisMonth(s)
      const spend = spendingThisMonth(s)
      return [
        `You received ${inr(income)} this month.`,
        `You spent ${inr(spend)}, so ${inr(Math.abs(income - spend))} ${
          income >= spend ? 'is still unspent' : 'more than you received was spent'
        }.`,
        '',
        'Credits come from your seeded demo income entries — this prototype has no bank connection.',
      ].join('\n')
    },
  },

  {
    id: 'explain',
    match: (q) =>
      has(q, 'what is', 'what does', 'explain', 'meaning of', 'define', 'mean by') &&
      glossaryKeyFor(q) !== null,
    answer: (q) => {
      const key = glossaryKeyFor(q)
      if (key) return `${key.toUpperCase()}\n\n${GLOSSARY[key]}`
      return `I do not have a definition for that one yet.\n\nI do explain: ${Object.keys(GLOSSARY)
        .slice(0, 8)
        .join(', ')}.\n\nOr ask me about your own numbers — for example "where did most of my money go?".`
    },
  },
]

/** Longest matching term wins, so "compound interest" beats "interest". */
function glossaryKeyFor(q: string): string | null {
  const matches = Object.keys(GLOSSARY).filter((k) => q.includes(k))
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.length - a.length)[0]
}

/* ----------------------------- fallback ----------------------------- */

function fallback(q: string, s: AppState): string {
  const balance = availableBalance(s)
  return [
    `I could not match "${q}" to a question I understand yet.`,
    '',
    'I am a prototype assistant running on local rules inside your browser — no cloud AI, no API key. That keeps your demo data private and the answers instant.',
    '',
    `Here is what I am good at with your numbers:`,
    `  • Spending summaries — "where did most of my money go?"`,
    `  • Affordability — "can I afford ₹1,500 more?" (your balance is ${inr(balance)})`,
    `  • Saving plans — "how can I save ₹5,000 this month?"`,
    `  • Bills — "which bills are due soon?"`,
    `  • Budgets — "explain my budget in simple words"`,
    `  • Safety — "how do I stay safe from UPI scams?"`,
    `  • Terms — "what is an EMI?"`,
    '',
    'I am not a financial adviser, and I never give investment advice.',
  ].join('\n')
}

export function answer(question: string, state: AppState): string {
  const q = question.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return 'Ask me anything about your money.'
  const intent = INTENTS.find((i) => i.match(q))
  if (!intent) return fallback(question.trim(), state)
  return intent.answer(q, state)
}

export function assistantMeta(): string {
  return `Prototype assistant · local rules · no API key`
}

export function assistantTypingDelay(text: string): number {
  return Math.min(900, 220 + text.length * 1.2)
}

export function nextBillCountdown(s: AppState): string {
  const { overdue, upcoming } = splitBills(s)
  const first = overdue[0] ?? upcoming[0]
  if (!first) return 'No bills pending'
  const d = daysUntil(first.bill.dueDate)
  if (d < 0) return `${first.bill.name} overdue by ${Math.abs(d)} day(s)`
  if (d === 0) return `${first.bill.name} due today`
  return `${first.bill.name} due in ${d} day(s)`
}

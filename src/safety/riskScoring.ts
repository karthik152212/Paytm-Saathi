import type { AppState, Transaction } from '../data/types'
import { medianDebitAmount } from '../data/selectors'
import { formatDayMonth, formatTime, inr } from '../lib/format'

/* ==================================================================
 * riskScoring.ts — a deterministic, fully transparent rule engine.
 *
 * This is a TEACHING tool for a prototype. It uses four simple,
 * explainable rules over simulated data. It is not a fraud-detection
 * model and it never claims a payment is confirmed fraud.
 * ================================================================== */

export type Severity = 'high' | 'medium' | 'low'

export interface RiskTrigger {
  code: 'flagged' | 'large-amount' | 'burst' | 'unusual-hour'
  label: string
  weight: number
  explanation: string
}

export interface RiskAlert {
  id: string
  transaction: Transaction
  score: number
  severity: Severity
  triggers: RiskTrigger[]
  headline: string
  recommendation: string
}

export const RULES: { code: RiskTrigger['code']; title: string; rule: string }[] = [
  {
    code: 'flagged',
    title: 'Explicit demo marker',
    rule: 'The transaction is marked as suspicious inside the sample dataset.',
  },
  {
    code: 'large-amount',
    title: 'Unusually large amount',
    rule: 'Amount is at least 5× your typical payment, and at least ₹5,000.',
  },
  {
    code: 'burst',
    title: 'Burst of payments',
    rule: 'Three or more debits happen within a 60-minute window.',
  },
  {
    code: 'unusual-hour',
    title: 'Unusual hour',
    rule: 'The payment happened between 12:00 AM and 5:00 AM.',
  },
]

const WEIGHTS: Record<RiskTrigger['code'], number> = {
  flagged: 40,
  'large-amount': 25,
  burst: 25,
  'unusual-hour': 15,
}

function severityFor(score: number): Severity {
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export function severityLabel(s: Severity): string {
  if (s === 'high') return 'High — verify before acting'
  if (s === 'medium') return 'Needs review'
  return 'Worth a quick check'
}

function burstIds(txns: Transaction[]): Set<string> {
  const debits = txns
    .filter((t) => t.direction === 'debit')
    .map((t) => ({ id: t.id, time: new Date(t.date).getTime() }))
    .sort((a, b) => a.time - b.time)

  const marked = new Set<string>()
  const HOUR = 60 * 60 * 1000
  for (let i = 0; i < debits.length; i++) {
    let count = 1
    for (let j = i + 1; j < debits.length && debits[j].time - debits[i].time <= HOUR; j++) {
      count++
    }
    if (count >= 3) {
      for (let j = i; j < debits.length && debits[j].time - debits[i].time <= HOUR; j++) {
        marked.add(debits[j].id)
      }
    }
  }
  return marked
}

export function scoreTransactions(s: AppState): RiskAlert[] {
  const median = medianDebitAmount(s)
  const largeThreshold = Math.max(5000, median * 5)
  const bursts = burstIds(s.transactions)

  const alerts: RiskAlert[] = []

  for (const t of s.transactions) {
    if (t.direction !== 'debit') continue
    const triggers: RiskTrigger[] = []
    const hour = new Date(t.date).getHours()

    if (t.flagged) {
      triggers.push({
        code: 'flagged',
        label: 'Marked in demo data',
        weight: WEIGHTS.flagged,
        explanation: t.flagReason ?? 'This transaction is marked as suspicious in the sample data.',
      })
    }

    if (t.amount >= largeThreshold) {
      triggers.push({
        code: 'large-amount',
        label: 'Unusually large amount',
        weight: WEIGHTS['large-amount'],
        explanation: `${inr(t.amount)} is well above your typical payment of about ${inr(median)}. The rule triggers at ${inr(
          Math.round(largeThreshold),
        )} (5× your typical amount, minimum ₹5,000).`,
      })
    }

    if (bursts.has(t.id)) {
      triggers.push({
        code: 'burst',
        label: 'Burst of payments',
        weight: WEIGHTS.burst,
        explanation: 'Three or more debits were recorded within the same 60-minute window — a pattern often seen when an account is being drained.',
      })
    }

    if (hour < 5) {
      triggers.push({
        code: 'unusual-hour',
        label: 'Unusual hour',
        weight: WEIGHTS['unusual-hour'],
        explanation: `This payment was made at ${formatTime(t.date)}, between 12:00 AM and 5:00 AM — outside your usual activity window.`,
      })
    }

    if (triggers.length === 0) continue

    const score = triggers.reduce((sum, tr) => sum + tr.weight, 0)
    const severity = severityFor(score)
    alerts.push({
      id: `alert-${t.id}`,
      transaction: t,
      score,
      severity,
      triggers,
      headline: headlineFor(triggers),
      recommendation: recommendationFor(severity, t),
    })
  }

  return alerts.sort((a, b) => b.score - a.score || new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime())
}

function headlineFor(triggers: RiskTrigger[]): string {
  if (triggers.some((t) => t.code === 'flagged')) return 'Payment to an unknown merchant at an unusual hour'
  if (triggers.filter((t) => t.code === 'burst').length && triggers.length > 1) return 'Several payments in a short window'
  if (triggers.some((t) => t.code === 'burst')) return 'Multiple payments within one hour'
  if (triggers.some((t) => t.code === 'large-amount')) return 'Amount much larger than usual'
  return 'Payment outside your usual pattern'
}

function recommendationFor(severity: Severity, t: Transaction): string {
  if (severity === 'high') {
    return `Stop before you act. Do not share your OTP or UPI PIN with anyone. Independently verify this ${inr(
      t.amount,
    )} payment — open your payment app directly (not through any link or call) and check whether you initiated it. If you did not, contact your bank using the number on the back of your card.`
  }
  if (severity === 'medium') {
    return `Review this ${inr(
      t.amount,
    )} payment to ${t.merchant}. If you recognise it, mark it as reviewed and continue. If you do not, verify it inside your payment app before making any further payment.`
  }
  return `Check whether you made this ${inr(
    t.amount,
  )} payment to ${t.merchant}. Large but planned purchases are common — this is a gentle prompt, not an accusation.`
}

export interface SafetySummary {
  high: number
  medium: number
  low: number
  total: number
  lastChecked: string
}

export function safetySummary(alerts: RiskAlert[]): SafetySummary {
  return {
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
    total: alerts.length,
    lastChecked: formatDayMonth(new Date().toISOString()),
  }
}

export interface ChecklistItem {
  id: string
  title: string
  body: string
}

export const SAFETY_CHECKLIST: ChecklistItem[] = [
  {
    id: 'otp',
    title: 'Never share your OTP or UPI PIN',
    body: 'No bank, wallet, police officer or "support agent" will ever ask for them. Anyone who does is not who they claim to be.',
  },
  {
    id: 'verify',
    title: 'Verify money requests independently',
    body: 'If someone asks you to pay or "unlock" money, hang up and call the person or company on a number you already trust.',
  },
  {
    id: 'links',
    title: 'Do not open payment links from messages',
    body: 'Type the website or open the app yourself. Prize and refund links are the most common trap.',
  },
  {
    id: 'screenshare',
    title: 'Never install an app to "confirm a refund"',
    body: 'Screen-sharing and remote-access apps give a stranger full control of your phone and your money.',
  },
  {
    id: 'limits',
    title: 'Keep your UPI limit low',
    body: 'Set a daily transfer limit you would not mind losing. It is the cheapest insurance you can buy.',
  },
  {
    id: 'review',
    title: 'Review your transactions weekly',
    body: 'Small unrecognised amounts are how testing starts. Catching ₹5 early is how you prevent losing ₹50,000 later.',
  },
]

export function describeAlertForSimpleMode(a: RiskAlert): string {
  if (a.severity === 'high') {
    return 'This payment looks very different from your usual activity. Check it before you do anything else.'
  }
  if (a.severity === 'medium') {
    return 'This payment looks different from your usual activity. Check it before taking action.'
  }
  return 'This payment is larger than usual. It may be perfectly fine — just confirm it.'
}

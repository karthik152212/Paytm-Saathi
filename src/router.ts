import { useEffect, useState } from 'react'
import {
  BotMessageSquare,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type RouteId =
  | 'overview'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'bills'
  | 'safety'
  | 'assistant'
  | 'settings'

export interface RouteDef {
  id: RouteId
  label: string
  short: string
  icon: LucideIcon
  hint: string
}

export const ROUTES: RouteDef[] = [
  { id: 'overview', label: 'Overview', short: 'Overview', icon: LayoutDashboard, hint: 'Your money at a glance' },
  { id: 'transactions', label: 'Transactions', short: 'Activity', icon: Wallet, hint: 'Search and filter every payment' },
  { id: 'budgets', label: 'Budgets', short: 'Budgets', icon: Target, hint: 'Monthly limits per category' },
  { id: 'goals', label: 'Savings Goals', short: 'Goals', icon: PiggyBank, hint: 'Track what you are saving for' },
  { id: 'bills', label: 'Bills & Reminders', short: 'Bills', icon: Receipt, hint: 'Never miss a due date' },
  { id: 'safety', label: 'Safety Center', short: 'Safety', icon: ShieldCheck, hint: 'Spot unusual payments' },
  { id: 'assistant', label: 'AI Assistant', short: 'Ask', icon: BotMessageSquare, hint: 'Ask about your money' },
  { id: 'settings', label: 'Settings & Simple Mode', short: 'Settings', icon: Settings, hint: 'Preferences and demo data' },
]

const ROUTE_IDS = ROUTES.map((r) => r.id)

export function isRouteId(v: string): v is RouteId {
  return (ROUTE_IDS as string[]).includes(v)
}

function readHash(): RouteId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return isRouteId(raw) ? raw : 'overview'
}

export function navigate(route: RouteId): void {
  if (readHash() === route) return
  window.location.hash = `/${route}`
}

export function useRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(() =>
    typeof window === 'undefined' ? 'overview' : readHash(),
  )

  useEffect(() => {
    const onChange = () => {
      setRoute(readHash())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) window.location.hash = '/overview'
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}


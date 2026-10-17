import { AppProvider } from './state/AppContext'
import { Shell } from './components/layout/Shell'
import { useRoute } from './router'
import type { RouteId } from './router'
import { Overview } from './views/Overview'
import { Transactions } from './views/Transactions'
import { Budgets } from './views/Budgets'
import { Goals } from './views/Goals'
import { Bills } from './views/Bills'
import { Safety } from './views/Safety'
import { Assistant } from './views/Assistant'
import { Settings } from './views/Settings'

function renderView(route: RouteId) {
  switch (route) {
    case 'transactions':
      return <Transactions />
    case 'budgets':
      return <Budgets />
    case 'goals':
      return <Goals />
    case 'bills':
      return <Bills />
    case 'safety':
      return <Safety />
    case 'assistant':
      return <Assistant />
    case 'settings':
      return <Settings />
    case 'overview':
    default:
      return <Overview />
  }
}

function Router() {
  const route = useRoute()
  return (
    <Shell current={route}>
      {renderView(route)}
    </Shell>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}

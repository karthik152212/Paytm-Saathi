import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState } from '../data/types'
import { loadState, reducer, saveState } from '../data/store'
import type { Action } from '../data/store'

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  /** Simple Mode flag, convenient for components. */
  simple: boolean
  resetDemo: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [ready, setReady] = useState(false)

  // Persist every change.
  useEffect(() => {
    if (!ready) return
    saveState(state)
  }, [state, ready])

  // Skip the very first write (loadState already produced the current value).
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(t)
  }, [])

  // Reflect Simple Mode on <html> so CSS can scale the type.
  useEffect(() => {
    document.documentElement.dataset.simple = state.settings.simpleMode ? 'true' : 'false'
  }, [state.settings.simpleMode])

  const resetDemo = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, simple: state.settings.simpleMode, resetDemo }),
    [state, resetDemo],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

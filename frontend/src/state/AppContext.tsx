import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState } from '../data/types'
import { loadState, reducer, saveState } from '../data/store'
import type { Action } from '../data/store'
import { mutationFor } from '../services/mutations'
import { fetchHydrationPatch } from '../services/overviewService'
import { ApiError } from '../services/apiClient'
import type { ApiStatus } from '../services/apiClient'

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  /** Simple Mode flag, convenient for components. */
  simple: boolean
  resetDemo: () => void
  /** Backend connectivity: connecting on boot, then online or offline. */
  apiStatus: ApiStatus
  /** Re-attempt the backend connection (used by the status chip). */
  retryConnection: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [ready, setReady] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connecting')
  const hydrateTimer = useRef<number | undefined>(undefined)
  const hydrating = useRef(false)

  /** Pull the authoritative snapshot from the backend and merge it in. */
  const hydrate = useCallback(async () => {
    if (hydrating.current) return
    hydrating.current = true
    try {
      const patch = await fetchHydrationPatch()
      dispatch({ type: 'hydrate', patch })
      setApiStatus('online')
    } catch (error) {
      if (error instanceof ApiError && error.isUnavailable) setApiStatus('offline')
      else setApiStatus((prev) => (prev === 'connecting' ? 'offline' : prev))
    } finally {
      hydrating.current = false
    }
  }, [])

  /** Debounced re-hydrate so server-computed values win after each mutation. */
  const scheduleHydrate = useCallback(() => {
    window.clearTimeout(hydrateTimer.current)
    hydrateTimer.current = window.setTimeout(() => void hydrate(), 450)
  }, [hydrate])

  /**
   * Optimistic dispatch: the local reducer always runs first (instant UI,
   * works offline); the matching backend call is then fired in the
   * background. A transport/5xx failure flips the app into offline mode;
   * an HTTP 4xx means the backend is alive and we simply keep local state.
   */
  const dispatchWithApi = useCallback(
    (action: Action) => {
      dispatch(action)
      const mutate = mutationFor(action)
      if (!mutate) return
      void (async () => {
        try {
          await mutate()
          setApiStatus('online')
          scheduleHydrate()
        } catch (error) {
          if (error instanceof ApiError && error.isUnavailable) setApiStatus('offline')
        }
      })()
    },
    [scheduleHydrate],
  )

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

  // First contact with the backend.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const resetDemo = useCallback(() => {
    dispatchWithApi({ type: 'reset' })
  }, [dispatchWithApi])

  const retryConnection = useCallback(() => {
    setApiStatus('connecting')
    void hydrate()
  }, [hydrate])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch: dispatchWithApi,
      simple: state.settings.simpleMode,
      resetDemo,
      apiStatus,
      retryConnection,
    }),
    [state, dispatchWithApi, resetDemo, apiStatus, retryConnection],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/**
 * Safety alerts computed by the backend, joined back onto frontend state.
 *
 * Returns `null` when the backend is unreachable so callers keep their local
 * `scoreTransactions` result — the rules and weights are identical on both
 * sides, so the two sources agree.
 */

import type { AppState } from '../data/types'
import type { RiskAlert } from '../safety/riskScoring'
import { DEFAULT_USER_ID, apiGet } from './apiClient'
import { mapSafetyAlert } from './mappers'
import type { SafetyDto } from './types'

export async function fetchSafetyAlerts(state: AppState, signal?: AbortSignal): Promise<RiskAlert[] | null> {
  try {
    const dto = await apiGet<SafetyDto>(`/safety/alerts?user_id=${encodeURIComponent(DEFAULT_USER_ID)}`, signal)
    const alerts = dto.alerts
      .map((alert) => mapSafetyAlert(alert, state.transactions))
      .filter((alert): alert is RiskAlert => alert !== null)
    return alerts
  } catch {
    return null
  }
}

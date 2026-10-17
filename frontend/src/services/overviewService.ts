/**
 * The one-shot hydration call: /api/overview → reducer patch.
 * Everything the dashboard renders comes from here when the backend is up.
 */

import { DEFAULT_USER_ID, apiGet } from './apiClient'
import type { HydrationPatch } from './mappers'
import { mapOverview } from './mappers'
import type { OverviewDto } from './types'

export async function fetchHydrationPatch(
  userId: string = DEFAULT_USER_ID,
  signal?: AbortSignal,
): Promise<HydrationPatch> {
  const dto = await apiGet<OverviewDto>(`/overview?user_id=${encodeURIComponent(userId)}`, signal)
  return mapOverview(dto)
}

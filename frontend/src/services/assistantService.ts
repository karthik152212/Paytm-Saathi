/**
 * Assistant over HTTP with a local-engine fallback.
 *
 * The answer always comes from the backend's rule engine when it is up
 * (`/api/assistant/chat`). If the backend cannot be reached, the identical
 * local engine in `assistant/engine.ts` answers instead so the screen keeps
 * working offline — same rules, same numbers, no cloud AI either way.
 */

import { answer } from '../assistant/engine'
import type { AppState } from '../data/types'
import { DEFAULT_USER_ID, apiGet, apiPost } from './apiClient'
import type { ChatResponseDto } from './types'

export const ENGINE_LABEL = 'local-rules-v1'

export interface AssistantReply {
  reply: string
  source: 'backend' | 'local'
}

export async function askAssistant(
  message: string,
  state: AppState,
  userId: string = DEFAULT_USER_ID,
): Promise<AssistantReply> {
  try {
    const dto = await apiPost<ChatResponseDto>('/assistant/chat', { message, user_id: userId })
    if (dto.reply) return { reply: dto.reply, source: 'backend' }
  } catch {
    /* fall through to the local engine */
  }
  return { reply: answer(message, state), source: 'local' }
}

/** Suggested questions from the backend, or `null` so callers use the local list. */
export async function fetchSuggestedQuestions(): Promise<string[] | null> {
  try {
    const dto = await apiGet<{ questions: string[] }>('/assistant/suggested')
    return dto.questions.length > 0 ? dto.questions : null
  } catch {
    return null
  }
}

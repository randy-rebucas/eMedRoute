import { ApiError, apiRequest } from './api';
import { emitRefresh } from './events';
import { AiBriefResult, AiStatus, AiVisitNote } from './types';
import { useApiData } from './useApiData';

/**
 * The AI assistant: visit notes drafted from what the rep says, and a brief before a visit. Every
 * rep gets a few AI actions a month; Pro gets the full allowance. Drafts are never saved by the
 * server: the rep edits and saves them like their own notes.
 */
const AI_PATH = '/api/medical-representatives/ai';

export function useAiStatus() {
  return useApiData<AiStatus>(AI_PATH, { refreshOn: ['ai', 'subscription'] });
}

/** Room for the dictation box; the server takes up to 6000 characters. */
export const MAX_AI_NOTE_INPUT = 6000;

export async function draftVisitNote(visitId: string, text: string): Promise<AiVisitNote> {
  const draft = await apiRequest<AiVisitNote>(`${AI_PATH}/visit-note`, { method: 'POST', body: { visitId, text } });
  emitRefresh('ai');
  return draft;
}

export async function getVisitBrief(visitId: string, refresh = false): Promise<AiBriefResult> {
  const result = await apiRequest<AiBriefResult>(`${AI_PATH}/visit-brief`, { method: 'POST', body: { visitId, refresh } });
  if (result.brief && !result.cached) emitRefresh('ai');
  return result;
}

/** The month's AI actions are used up (AI_UPGRADE: Pro would give more). */
export function isAllowanceUsedUp(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'AI_UPGRADE' || err.code === 'AI_LIMIT');
}

/** Whether this status says the assistant can be offered at all. */
export function aiOffered(status: AiStatus | null | undefined): boolean {
  return !!status?.available && (status.limit > 0 || status.proMonthly > 0);
}

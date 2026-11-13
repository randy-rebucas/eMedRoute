import { router } from 'expo-router';
import { apiFetch } from './api';
import { emitRefresh } from './events';
import { SupportCategory, SupportCreateResponse, SupportRequest } from './types';
import { usePaginatedList } from './usePaginatedList';

const SUPPORT_PATH = '/api/medical-representatives/support';

export type SupportDraft = { category: SupportCategory; subject: string; message: string };

/**
 * A prefilled request handed from another screen (Plan, Team). Held in memory, not in the URL:
 * a link from outside the app must not be able to write a request for the rep to send.
 */
let draft: SupportDraft | null = null;

/** Open the new-request screen prefilled. */
export function openSupportDraft(next: SupportDraft): void {
  draft = next;
  router.push('/support/new');
}

/** The prefill for the screen that just opened, once. */
export function takeSupportDraft(): SupportDraft | null {
  const taken = draft;
  draft = null;
  return taken;
}

/** The rep's own support requests, newest first. */
export function useSupportRequests() {
  return usePaginatedList<SupportRequest>(SUPPORT_PATH, { limit: 20, refreshOn: ['support'] });
}

/** POST /support. Replies go to the account email. Returns the "SR-…" reference. */
export async function createSupportRequest(input: {
  subject: string;
  message: string;
  category: SupportCategory;
}): Promise<string> {
  const result = await apiFetch<SupportCreateResponse>(SUPPORT_PATH, { method: 'POST', body: input });
  emitRefresh('support');
  return result.reference;
}

/**
 * Where a request stands from the rep's side: `replied` = support wrote last and it's still
 * open (the rep should read it); `waiting` = the ball is with support.
 */
export type RequestState = 'replied' | 'waiting' | 'resolved' | 'closed';

export function requestState(request: Pick<SupportRequest, 'status' | 'replies'>): RequestState {
  if (request.status === 'resolved') return 'resolved';
  if (request.status === 'closed') return 'closed';
  const replies = request.replies ?? [];
  return replies[replies.length - 1]?.authorType === 'platform' ? 'replied' : 'waiting';
}

/** When anything last happened on the request: the newest reply, else when it was sent. */
export function lastActivity(request: Pick<SupportRequest, 'createdAt' | 'replies'>): string {
  const replies = request.replies ?? [];
  return replies[replies.length - 1]?.createdAt ?? request.createdAt;
}

/**
 * POST /support/:id/replies: answer support on the rep's own request (the reply email says to
 * reply from the app). A reply on a resolved or closed request reopens it.
 */
export async function replyToSupportRequest(id: string, message: string): Promise<void> {
  await apiFetch(`${SUPPORT_PATH}/${encodeURIComponent(id)}/replies`, { method: 'POST', body: { message } });
  emitRefresh('support');
}

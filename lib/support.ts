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

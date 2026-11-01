import { apiFetch } from './api';
import { emitRefresh } from './events';
import { SupportCategory, SupportCreateResponse, SupportRequest } from './types';
import { usePaginatedList } from './usePaginatedList';

const SUPPORT_PATH = '/api/medical-representatives/support';

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

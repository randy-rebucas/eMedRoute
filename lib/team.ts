import { apiFetch, query } from './api';
import { emitRefresh } from './events';
import { TeamState, TeamVisit } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const TEAM_PATH = '/api/medical-representatives/team';

/** The rep's team and any pending invite. Managers also get members (with counts) and pending invites. */
export function useTeam() {
  return useApiData<TeamState>(TEAM_PATH, { refreshOn: ['team'], offline: true });
}

/** Members' visits, newest first (managers). Private notes are never included. */
export function useTeamVisits(memberId: string | null) {
  return usePaginatedList<TeamVisit>(`${TEAM_PATH}/visits${query({ memberId })}`, { limit: 50, refreshOn: ['team', 'visits'], offline: true });
}

async function teamWrite<T = unknown>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const result = await apiFetch<T>(`${TEAM_PATH}${path}`, { method, body });
  emitRefresh('team', 'subscription');
  return result;
}

/** Start a team; you become its manager. 409 ALREADY_ON_TEAM. */
export const startTeam = (name: string) => teamWrite('', 'POST', { name });

/** Rename (manager). */
export const renameTeam = (name: string) => teamWrite('', 'PUT', { name });

/** Leave. The only manager can leave once everyone else has (409 TEAM_HAS_MEMBERS); the team then closes. */
export const leaveTeam = () => teamWrite('', 'DELETE');

/**
 * Invite by email (manager). The reply is the same whether or not the email has a rep account,
 * so the app always says the same thing.
 */
export const inviteRep = (email: string) => teamWrite('/invites', 'POST', { email });

/** Withdraw a pending invite (manager). `repId` is the invited rep's. */
export const withdrawInvite = (repId: string) => teamWrite(`/invites/${encodeURIComponent(repId)}`, 'DELETE');

/** Answer your own invite. Errors: TEAM_FULL, INVITE_CHANGED, NO_INVITE, ALREADY_ON_TEAM. */
export const answerInvite = (accept: boolean) => teamWrite('/invite', 'POST', { accept });

/** Remove a member (manager). Errors: USE_LEAVE, IS_MANAGER. */
export const removeMember = (repId: string) => teamWrite(`/members/${encodeURIComponent(repId)}`, 'DELETE');

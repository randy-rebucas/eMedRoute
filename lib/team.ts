import { apiFetch, query } from './api';
import { emitRefresh } from './events';
import { clinicTodayYmd } from './format';
import { TeamMember, TeamMemberStats, TeamState, TeamVisit } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const TEAM_PATH = '/api/medical-representatives/team';

/** The rep's team and any pending invite. Managers also get members (with counts) and pending invites. */
export function useTeam() {
  return useApiData<TeamState>(TEAM_PATH, { refreshOn: ['team', 'visits'], offline: true });
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

// ── The manager's month ─────────────────────────────────────────────────────

/** A member with no completed visit for this many days is flagged to the manager. */
export const QUIET_DAYS = 14;

/**
 * A member's month as two parts that add up to the bar: visits done, and the rest booked or
 * logged this month (waiting, approved, missed). Cancelled and declined aren't counted (server).
 */
export function memberMonth(s: TeamMemberStats): { done: number; open: number; total: number } {
  const done = Math.max(0, s.completedThisMonth);
  const total = Math.max(done, s.visitsThisMonth);
  return { done, open: total - done, total };
}

/** Whole days since the member's last completed visit (a UTC-midnight day), or null if none. */
export function daysSinceDone(lastVisitAt: string | null, today: string = clinicTodayYmd()): number | null {
  if (!lastVisitAt) return null;
  const last = Date.parse(`${lastVisitAt.slice(0, 10)}T00:00:00.000Z`);
  const now = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(last) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - last) / 86_400_000));
}

/** Busiest first this month, then by name, so the bars read as a ranking. */
export function byMonth(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => memberMonth(b.stats).total - memberMonth(a.stats).total || a.name.localeCompare(b.name));
}

/** The whole team's month: visits and how many are done. */
export function teamMonth(members: TeamMember[]): { total: number; done: number } {
  return members.reduce(
    (sum, m) => {
      const { total, done } = memberMonth(m.stats);
      return { total: sum.total + total, done: sum.done + done };
    },
    { total: 0, done: 0 }
  );
}

import { useMemo } from 'react';
import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { addDays, clinicHhmm, clinicTodayYmd } from './format';
import { PlainKey } from './i18n';
import { usePendingDeletes } from './undo';
import { ACTIVE_CLINIC_STATUSES, LogEntryInput, Visit } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const VISITS_PATH = '/api/medical-representatives/visits';

// ── Days and status ──────────────────────────────────────────────────────────

/** The visit's calendar day, "YYYY-MM-DD": the stored date's first 10 characters, never converted. */
export const visitDay = (visit: Pick<Visit, 'date'>) => visit.date.slice(0, 10);

/** The rep's own log entry (no clinic on MyClinicSoft behind it). */
export const isOwnLog = (visit: Pick<Visit, 'clinicId'>) => !visit.clinicId;

/** A clinic booking still waiting on, or approved by, the clinic. */
export const isOpenBooking = (visit: Pick<Visit, 'clinicId' | 'status'>) =>
  !isOwnLog(visit) && ACTIVE_CLINIC_STATUSES.includes(visit.status);

/**
 * What a visit's status pill says. One table for every screen, so a status always looks and reads
 * the same (word + icon + colour, never colour alone).
 */
export type VisitState = 'waiting' | 'approved' | 'checkedIn' | 'done' | 'declined' | 'missed' | 'cancelled' | 'log';

export function visitState(visit: Pick<Visit, 'clinicId' | 'status' | 'checkedInAt'>): VisitState {
  if (isOwnLog(visit)) return 'log';
  switch (visit.status) {
    case 'requested':
      return 'waiting';
    case 'scheduled':
      return visit.checkedInAt ? 'checkedIn' : 'approved';
    case 'completed':
      return 'done';
    case 'declined':
      return 'declined';
    case 'no-show':
      return 'missed';
    case 'cancelled':
      return 'cancelled';
  }
}

export const VISIT_STATE_LABEL: Record<VisitState, PlainKey> = {
  waiting: 'visits.state.waiting',
  approved: 'visits.state.approved',
  checkedIn: 'visits.state.checkedIn',
  done: 'visits.state.done',
  declined: 'visits.state.declined',
  missed: 'visits.state.missed',
  cancelled: 'visits.state.cancelled',
  log: 'visits.state.log',
};

/** Own log entries keep their own status word next to the Log pill. */
export const LOG_STATUS_LABEL: Record<string, PlainKey> = {
  scheduled: 'visits.logStatus.scheduled',
  completed: 'visits.logStatus.completed',
  cancelled: 'visits.logStatus.cancelled',
};

/** Who acts next on a visit, so the rep never wonders whether to call the clinic. */
export type NextStep =
  | { key: 'visits.next.waiting' }
  | { key: 'visits.next.arriveBy'; time: string }
  | { key: 'visits.next.checkedIn'; time: string }
  | { key: 'visits.next.completed' }
  | { key: 'visits.next.declined' }
  | { key: 'visits.next.missed' }
  | { key: 'visits.next.cancelledByYou' }
  | { key: 'visits.next.cancelledByClinic' }
  | null;

/** The next-step line. A declined visit with a clinic note shows the note instead (as the clinic's quote). */
export function nextStep(visit: Pick<Visit, 'clinicId' | 'status' | 'checkedInAt' | 'time' | 'cancelledBy'>): NextStep {
  switch (visitState(visit)) {
    case 'waiting':
      return { key: 'visits.next.waiting' };
    case 'approved':
      return { key: 'visits.next.arriveBy', time: visit.time };
    case 'checkedIn':
      return { key: 'visits.next.checkedIn', time: clinicHhmm(visit.checkedInAt) };
    case 'done':
      return { key: 'visits.next.completed' };
    case 'declined':
      return { key: 'visits.next.declined' };
    case 'missed':
      return { key: 'visits.next.missed' };
    case 'cancelled':
      return { key: visit.cancelledBy === 'clinic' ? 'visits.next.cancelledByClinic' : 'visits.next.cancelledByYou' };
    case 'log':
      return null;
  }
}

// ── Lists ────────────────────────────────────────────────────────────────────

export type VisitSegment = 'upcoming' | 'past' | 'log';
export type DateRange = 'any' | 'thisMonth' | 'lastMonth' | 'last90';

/** `from` / `to` days ("YYYY-MM-DD", inclusive) for a date filter, in the clinic's calendar. */
export function rangeDays(range: DateRange): { from?: string; to?: string } {
  const today = clinicTodayYmd();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (range) {
    case 'any':
      return {};
    case 'thisMonth':
      return { from: monthStart, to: addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1) };
    case 'lastMonth': {
      const lastMonthStart = `${addDays(monthStart, -1).slice(0, 8)}01`;
      return { from: lastMonthStart, to: addDays(monthStart, -1) };
    }
    case 'last90':
      return { from: addDays(today, -89), to: today };
  }
}

/** The list endpoint's `to` is inclusive of the whole day. */
const endOfDay = (ymd: string) => `${ymd}T23:59:59.999Z`;

const byDayThenTime = (a: Visit, b: Visit) => visitDay(a).localeCompare(visitDay(b)) || a.time.localeCompare(b.time);

/**
 * One Visits segment. The API filters by one status and a date range, so the segment rules are
 * finished here:
 * - upcoming: requested and approved visits (booked or own) from today on, soonest first
 * - past: everything up to today, except today's still-open visits, newest first
 * - log: the rep's own log entries, newest first
 */
export function useVisitList(segment: VisitSegment, range: DateRange) {
  const today = clinicTodayYmd();
  const { from, to } = rangeDays(range);
  const path =
    segment === 'upcoming'
      ? VISITS_PATH + query({ from: today })
      : segment === 'past'
        ? VISITS_PATH + query({ from, to: endOfDay(to && to < today ? to : today) })
        : VISITS_PATH + query({ from, to: to ? endOfDay(to) : undefined });

  const list = usePaginatedList<Visit>(path, {
    limit: segment === 'upcoming' ? 100 : 50,
    refreshOn: ['visits'],
    offline: true,
  });
  const pending = usePendingDeletes();

  const items = useMemo(() => {
    const shown = list.items.filter((v) => !pending.has(v._id));
    if (segment === 'upcoming') {
      return shown.filter((v) => ACTIVE_CLINIC_STATUSES.includes(v.status) && visitDay(v) >= today).sort(byDayThenTime);
    }
    if (segment === 'past') return shown.filter((v) => !(visitDay(v) >= today && ACTIVE_CLINIC_STATUSES.includes(v.status)));
    return shown.filter(isOwnLog);
  }, [list.items, pending, segment, today]);

  return { ...list, items };
}

export function useVisit(id: string | undefined) {
  return useApiData<Visit>(id ? `${VISITS_PATH}/${encodeURIComponent(id)}` : null, { refreshOn: ['visits'], offline: true });
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Log a visit of the rep's own (no clinic on MyClinicSoft). */
export async function createLogEntry(input: LogEntryInput): Promise<Visit> {
  const visit = await apiRequest<Visit>(VISITS_PATH, { method: 'POST', body: input });
  emitRefresh('visits', 'dashboard');
  return visit;
}

/** PUT takes the full object for own log entries. */
export async function updateLogEntry(id: string, input: LogEntryInput): Promise<Visit> {
  const visit = await apiRequest<Visit>(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  emitRefresh('visits', 'dashboard');
  return visit;
}

/** DELETE. An open clinic booking answers 409 VISIT_ACTIVE: cancel it instead. */
export async function deleteVisit(id: string): Promise<void> {
  await apiRequest(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emitRefresh('visits', 'dashboard');
}

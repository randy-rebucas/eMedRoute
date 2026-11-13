import { useMemo } from 'react';
import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { addDays, clinicHhmm, clinicTodayYmd, daysFromToday, formatDay } from './format';
import { PlainKey, TFunction } from './i18n';
import { usePendingDeletes } from './undo';
import { ACTIVE_CLINIC_STATUSES, LogEntryInput, RepVisitStatus, Visit, VisitOutcomes } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';

const VISITS_PATH = '/api/medical-representatives/visits';

// ── Days and status ──────────────────────────────────────────────────────────

/** The visit's calendar day, "YYYY-MM-DD": the stored date's first 10 characters, never converted. */
export const visitDay = (visit: Pick<Visit, 'date'>) => visit.date.slice(0, 10);

/** Visits on one calendar day, for a SectionList. */
export type DaySection<V extends Pick<Visit, 'date'> = Visit> = { day: string; data: V[] };

/** Consecutive visits on the same day, in the list's own order (soonest or newest first). */
export function byDay<V extends Pick<Visit, 'date'>>(visits: V[]): DaySection<V>[] {
  const sections: DaySection<V>[] = [];
  for (const v of visits) {
    const day = visitDay(v);
    const last = sections[sections.length - 1];
    if (last && last.day === day) last.data.push(v);
    else sections.push({ day, data: [v] });
  }
  return sections;
}

/** "Today", "Tomorrow", "Yesterday", else "Tuesday, Nov 18". */
export function dayHeading(t: TFunction, day: string): string {
  const n = daysFromToday(day);
  if (n === 0) return t('visits.day.today');
  if (n === 1) return t('visits.day.tomorrow');
  if (n === -1) return t('visits.day.yesterday');
  return formatDay(day, { weekday: 'long', month: 'short', day: 'numeric', ...(Math.abs(n) > 300 ? { year: 'numeric' } : {}) });
}

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

/**
 * A clinic booking's path so far, for the detail screen's progress line: what happened (with
 * when, where the API says so), what's happening now, and what's still to come. A visit that
 * ended early (declined, missed, cancelled) stops at that step. Own log entries have no path.
 */
export type ProgressStepId = 'requested' | 'answer' | 'approved' | 'declined' | 'checkIn' | 'checkedIn' | 'finish' | 'done' | 'missed' | 'cancelledByYou' | 'cancelledByClinic';
export type ProgressMark = 'done' | 'now' | 'todo' | 'stopped';
export type ProgressStep = { id: ProgressStepId; mark: ProgressMark; at?: string | null };

export function visitProgress(
  visit: Pick<Visit, 'clinicId' | 'status' | 'checkedInAt' | 'createdAt' | 'respondedAt' | 'cancelledBy'>
): ProgressStep[] {
  const state = visitState(visit);
  if (state === 'log') return [];
  const steps: ProgressStep[] = [{ id: 'requested', mark: 'done', at: visit.createdAt }];
  const approved: ProgressStep = { id: 'approved', mark: 'done', at: visit.respondedAt };
  switch (state) {
    case 'waiting':
      steps.push({ id: 'answer', mark: 'now' }, { id: 'checkIn', mark: 'todo' }, { id: 'finish', mark: 'todo' });
      break;
    case 'approved':
      steps.push(approved, { id: 'checkIn', mark: 'now' }, { id: 'finish', mark: 'todo' });
      break;
    case 'checkedIn':
      steps.push(approved, { id: 'checkedIn', mark: 'done', at: visit.checkedInAt }, { id: 'finish', mark: 'now' });
      break;
    case 'done':
      // A clinic may close a visit without checking the rep in first: only a real check-in shows.
      steps.push(approved, ...(visit.checkedInAt ? [{ id: 'checkedIn', mark: 'done', at: visit.checkedInAt } as ProgressStep] : []), { id: 'done', mark: 'done' });
      break;
    case 'declined':
      steps.push({ id: 'declined', mark: 'stopped', at: visit.respondedAt });
      break;
    case 'missed':
      steps.push(approved, { id: 'missed', mark: 'stopped' });
      break;
    case 'cancelled':
      // Cancelled before the clinic answered: there's no approval to show.
      if (visit.respondedAt) steps.push(approved);
      steps.push({ id: visit.cancelledBy === 'clinic' ? 'cancelledByClinic' : 'cancelledByYou', mark: 'stopped' });
      break;
  }
  return steps;
}

// ── Lists ────────────────────────────────────────────────────────────────────

export type VisitSegment = 'upcoming' | 'past' | 'log';
export type DateRange = 'any' | 'thisMonth' | 'lastMonth' | 'last90';
/** Past's outcome filter: one bucket of the server's `summary`, or all of them. */
export type Outcome = 'all' | keyof VisitOutcomes;

/** The statuses behind each outcome bucket (the server's `summary` counts the same way). */
export const OUTCOME_STATUSES: Record<keyof VisitOutcomes, RepVisitStatus[]> = {
  done: ['completed'],
  notSeen: ['no-show', 'declined'],
  cancelled: ['cancelled'],
  open: ['requested', 'scheduled'],
};

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
 * - past: everything up to today, except today's still-open visits, newest first; `outcome`
 *   narrows it to one bucket, and `summary` (from the first page) counts every bucket
 * - log: the rep's own log entries (asked for with `own=1`), newest first
 */
export function useVisitList(segment: VisitSegment, range: DateRange, outcome: Outcome = 'all') {
  const today = clinicTodayYmd();
  const { from, to } = rangeDays(range);
  const path =
    segment === 'upcoming'
      ? // Soonest first, open visits only: page 1 holds the next ones, not the farthest.
        VISITS_PATH + query({ from: today, status: ACTIVE_CLINIC_STATUSES.join(','), sort: 'asc' })
      : segment === 'past'
        ? VISITS_PATH +
          query({
            from,
            to: endOfDay(to && to < today ? to : today),
            status: outcome === 'all' ? undefined : OUTCOME_STATUSES[outcome].join(','),
            summary: '1',
          })
        : // `own=1`: the server returns only the rep's own log entries (still checked below).
          VISITS_PATH + query({ own: '1', from, to: to ? endOfDay(to) : undefined });

  const list = usePaginatedList<Visit, { summary?: VisitOutcomes }>(path, {
    limit: segment === 'upcoming' ? 100 : 50,
    refreshOn: ['visits'],
    offline: true,
    // The URL carries today's date; the saved copy must still open offline tomorrow (filtered below).
    cacheKey: `visits:${segment}:${segment === 'upcoming' ? '' : range}:${segment === 'past' ? outcome : ''}`,
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

  return { ...list, items, summary: segment === 'past' ? (list.extra?.summary ?? null) : null };
}

export function useVisit(id: string | undefined) {
  return useApiData<Visit>(id ? `${VISITS_PATH}/${encodeURIComponent(id)}` : null, { refreshOn: ['visits'], offline: true });
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Log a visit of the rep's own (no clinic on MyClinicSoft). */
export async function createLogEntry(input: LogEntryInput): Promise<Visit> {
  const visit = await apiRequest<Visit>(VISITS_PATH, { method: 'POST', body: input });
  emitRefresh('visits', 'dashboard', 'clinics');
  return visit;
}

/** PUT takes the full object for own log entries. */
export async function updateLogEntry(id: string, input: LogEntryInput): Promise<Visit> {
  const visit = await apiRequest<Visit>(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  emitRefresh('visits', 'dashboard', 'clinics');
  return visit;
}

/**
 * Save only the rep's private notes. A clinic booking takes `{ notes }` alone, even once closed
 * (the clinic never sees them); an own log entry's PUT needs the whole entry, sent back as it is.
 * Products and the clinic link are left out, so the server keeps them as stored.
 */
export async function saveVisitNotes(visit: Visit, notes: string): Promise<Visit> {
  const body: Partial<LogEntryInput> = isOwnLog(visit)
    ? {
        clinicName: visit.clinicName,
        clinicLocation: visit.clinicLocation,
        purpose: visit.purpose,
        date: visitDay(visit),
        time: visit.time,
        duration: visit.duration,
        status: visit.status as LogEntryInput['status'],
        notes,
      }
    : { notes };
  const saved = await apiRequest<Visit>(`${VISITS_PATH}/${encodeURIComponent(visit._id)}`, { method: 'PUT', body });
  emitRefresh('visits');
  return saved;
}

/** DELETE. An open clinic booking answers 409 VISIT_ACTIVE: cancel it instead. */
export async function deleteVisit(id: string): Promise<void> {
  await apiRequest(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emitRefresh('visits', 'dashboard', 'clinics');
}

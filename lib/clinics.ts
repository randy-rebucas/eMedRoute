import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { apiFetch, ApiError, apiRequest, errorMessage, query } from './api';
import { emitRefresh } from './events';
import { addDays, clinicHhmm, clinicTodayYmd } from './format';
import { BookingInput, Clinic, ClinicSlots, Visit } from './types';
import { useApiData } from './useApiData';
import { usePaginatedList } from './usePaginatedList';
import { visitDay } from './visits';

const CLINICS_PATH = '/api/medical-representatives/clinics';
const VISITS_PATH = '/api/medical-representatives/visits';

// ── Clinics seen this session ────────────────────────────────────────────────

/** Clinics from the last list loads, so the booking sheet and visit detail open without a refetch. */
const known = new Map<string, Clinic>();

/**
 * Clinics whose slots answered 404: they stopped taking reps (or dropped this rep). They leave
 * the list until the next sign-in.
 */
let dropped = new Set<string>();
const droppedListeners = new Set<() => void>();

export function dropClinic(id: string): void {
  dropped = new Set(dropped).add(id);
  known.delete(id);
  droppedListeners.forEach((l) => l());
}

/** Sign-out: the next account starts with no clinics remembered from this one. */
export function resetClinicCaches(): void {
  known.clear();
  dropped = new Set();
  droppedListeners.forEach((l) => l());
}

function useDropped(): Set<string> {
  return useSyncExternalStore(
    (l) => {
      droppedListeners.add(l);
      return () => droppedListeners.delete(l);
    },
    () => dropped,
    () => dropped
  );
}

/**
 * The bookable clinics, by name; `search` matches the name or city. `all` also lists clinics that
 * take rep visits but haven't accepted this rep, to request access to.
 */
export function useClinics(search: string, all = false) {
  const list = usePaginatedList<Clinic>(CLINICS_PATH + query({ search: search.trim() || undefined, scope: all ? 'all' : undefined }), {
    limit: 50,
    refreshOn: ['clinics'],
    // The directory and its rep hours still read offline; booking itself needs the connection.
    offline: true,
  });
  const gone = useDropped();
  const items = useMemo(() => {
    // Only bookable ones feed the booking sheet's cache.
    list.items.forEach((c) => c.canBook !== false && known.set(c.id, c));
    return list.items.filter((c) => !gone.has(c.id));
  }, [list.items, gone]);
  return { ...list, items };
}

/** Ask a clinic that hasn't accepted the rep to add them (MOBILE_API.md → clinics/[id]/access). */
export async function requestClinicAccess(clinicId: string, message?: string): Promise<void> {
  await apiRequest(`${CLINICS_PATH}/${encodeURIComponent(clinicId)}/access`, { method: 'POST', body: { message: message?.trim() || undefined } });
  emitRefresh('clinics');
}

/**
 * Leave a clinic's list. True when it stays bookable (it takes any rep). Throws ApiError
 * ACTIVE_VISITS (with `body.count`) for a clinic that takes only its own reps while visits are
 * waiting or approved there.
 */
export async function leaveClinic(clinicId: string): Promise<boolean> {
  const result = await apiRequest<{ canBook: boolean }>(`${CLINICS_PATH}/${encodeURIComponent(clinicId)}`, { method: 'DELETE' });
  emitRefresh('clinics');
  return !!result?.canBook;
}

/** Withdraw a waiting access request. */
export async function withdrawClinicAccess(clinicId: string): Promise<void> {
  await apiRequest(`${CLINICS_PATH}/${encodeURIComponent(clinicId)}/access`, { method: 'DELETE' });
  emitRefresh('clinics');
}

/**
 * One clinic: from this session's list loads, else the directory filtered to that id. Null once
 * loaded and not found: the rep can't book it any more.
 */
export function useClinic(id: string | null | undefined): { clinic: Clinic | null; loading: boolean } {
  const cached = id ? known.get(id) : undefined;
  const gone = useDropped();
  const { data, loading } = useApiData<Clinic[]>(id && !cached ? CLINICS_PATH + query({ id, limit: 1 }) : null);
  useEffect(() => {
    data?.forEach((c) => known.set(c.id, c));
  }, [data]);
  if (!id || gone.has(id)) return { clinic: null, loading: false };
  return { clinic: cached ?? data?.find((c) => c.id === id) ?? null, loading: !cached && loading };
}

// ── Visiting hours and days ──────────────────────────────────────────────────

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface HoursWindow {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  start: string;
  end: string;
}

/**
 * The clinic's `hours` lines ("Tue 15:00–17:00", from the server's describeWindows) as windows,
 * so the app can name the days in the rep's language and grey out days without hours.
 */
export function parseHours(hours: string[]): HoursWindow[] {
  const out: HoursWindow[] = [];
  for (const line of hours) {
    const m = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/.exec(line.trim());
    if (m) out.push({ dayOfWeek: DAY_INDEX[m[1]], start: m[2], end: m[3] });
  }
  return out;
}

/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD" day. */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00.000Z`).getUTCDay();

/** A clinic is "due a visit" when the rep's last completed one is older than this, and none is booked. */
export const DUE_AFTER_DAYS = 30;

/**
 * The clinic's next rep-hours window that hasn't ended yet, on the clinic's clock: today's if one
 * is still open or to come, else the first one in the next seven days. Null without hours.
 */
export function nextHours(hours: string[], now: Date = new Date()): { day: string; start: string; end: string } | null {
  const windows = parseHours(hours);
  if (!windows.length) return null;
  const today = clinicTodayYmd();
  const time = clinicHhmm(now);
  for (let i = 0; i <= 7; i++) {
    const day = addDays(today, i);
    const open = windows
      .filter((w) => w.dayOfWeek === weekdayOf(day) && (i > 0 || w.end > time))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (open.length) return { day, start: open[0].start, end: open[0].end };
  }
  return null;
}

/** The clinic's rep hours on one day, "15:00–17:00, 18:00–19:00" (earliest first); "" when none. */
export function hoursOn(hours: string[], day: string): string {
  return parseHours(hours)
    .filter((w) => w.dayOfWeek === weekdayOf(day))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((w) => `${w.start}–${w.end}`)
    .join(', ');
}

export interface BookingDay {
  /** "YYYY-MM-DD" */
  day: string;
  /** The clinic has rep hours on this weekday. */
  open: boolean;
}

/** Today through `maxAdvanceDays` ahead, in the clinic's calendar. */
export function bookingDays(clinic: Pick<Clinic, 'hours' | 'maxAdvanceDays'>): BookingDay[] {
  const weekdays = new Set(parseHours(clinic.hours).map((w) => w.dayOfWeek));
  const today = clinicTodayYmd();
  return Array.from({ length: clinic.maxAdvanceDays + 1 }, (_, i) => {
    const day = addDays(today, i);
    return { day, open: weekdays.has(new Date(`${day}T00:00:00.000Z`).getUTCDay()) };
  });
}

/**
 * The day's slots with seats left. `gone`: the slots answered 404, so the clinic stopped taking
 * reps (or dropped this rep) and is removed from the list.
 */
export function useSlots(clinicId: string | null, day: string | null) {
  const [state, setState] = useState<{ data: ClinicSlots | null; loading: boolean; error: string | null; gone: boolean }>({
    data: null,
    loading: false,
    error: null,
    gone: false,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!clinicId || !day) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null, data: s.data?.date === day ? s.data : null }));
    apiRequest<ClinicSlots>(`${CLINICS_PATH}/${encodeURIComponent(clinicId)}/slots${query({ date: day })}`)
      .then((data) => live && setState({ data, loading: false, error: null, gone: false }))
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) {
          dropClinic(clinicId);
          emitRefresh('clinics');
          setState({ data: null, loading: false, error: null, gone: true });
        } else {
          setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
        }
      });
    return () => {
      live = false;
    };
  }, [clinicId, day, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

// ── Booking writes ───────────────────────────────────────────────────────────

/**
 * Ask the clinic for a visit: it starts as `requested`. Errors the sheet handles by code:
 * 402 SUBSCRIPTION_REQUIRED, 400 SLOT_UNAVAILABLE, 409 SLOT_FULL, 409 DUPLICATE_REQUEST,
 * 400 INVALID_PRODUCTS, 404 (the clinic can't be booked).
 */
export async function requestVisit(input: BookingInput): Promise<Visit> {
  const visit = await apiRequest<Visit>(VISITS_PATH, { method: 'POST', body: input });
  emitRefresh('visits', 'dashboard');
  return visit;
}

/**
 * Move a booking to a new day and time; the clinic answers again (back to `requested`).
 * Errors: SLOT_UNAVAILABLE, SLOT_FULL, VISIT_CHANGED, VISIT_CLOSED.
 */
export async function moveVisit(id: string, date: string, time: string): Promise<Visit> {
  const visit = await apiRequest<Visit>(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: { date, time } });
  emitRefresh('visits', 'dashboard');
  return visit;
}

/** Cancel a booking; the clinic is told. Errors: VISIT_CHANGED, VISIT_CLOSED. */
export async function cancelVisit(id: string): Promise<Visit> {
  const visit = await apiRequest<Visit>(`${VISITS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: { status: 'cancelled' } });
  emitRefresh('visits', 'dashboard');
  return visit;
}

/** For DUPLICATE_REQUEST: the open booking the rep already has with this clinic that day. */
export async function findOpenBooking(clinicId: string, day: string): Promise<Visit | null> {
  const json = await apiFetch<{ data?: Visit[] }>(
    VISITS_PATH + query({ clinicId, from: day, to: `${day}T23:59:59.999Z`, limit: 20 })
  );
  return (
    (json.data ?? []).find((v) => visitDay(v) === day && (v.status === 'requested' || v.status === 'scheduled')) ?? null
  );
}

/** The first day with hours on or after `from`, else the first day. */
export function firstOpenDay(days: BookingDay[], from?: string): string | null {
  const start = from ? days.findIndex((d) => d.day >= from) : 0;
  const pick = days.slice(Math.max(0, start)).find((d) => d.open) ?? days.find((d) => d.open) ?? days[0];
  return pick?.day ?? null;
}

/** Remember which day the sheet shows across slot reloads. */
export function useBookingDay(days: BookingDay[], initial?: string) {
  const [day, setDay] = useState<string | null>(() => firstOpenDay(days, initial));
  useEffect(() => {
    if (!day && days.length) setDay(firstOpenDay(days, initial));
  }, [days, day, initial]);
  return [day, setDay] as const;
}

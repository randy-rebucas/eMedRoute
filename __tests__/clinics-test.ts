import { hoursOn, nextHours } from '@/lib/clinics';
import { clinicHistory } from '@/components/ClinicRow';
import type { Clinic } from '@/lib/types';

// English messages straight from the keys' params, enough to check which message was picked.
const t = ((key: string, params?: Record<string, unknown>) => `${key}${params ? ' ' + JSON.stringify(params) : ''}`) as any;

const clinic = (over: Partial<Clinic>): Clinic => ({
  id: 'c',
  name: 'Sunrise Clinic',
  location: 'Katipunan',
  city: null,
  linked: false,
  canBook: true,
  hours: [],
  slotMinutes: 30,
  maxAdvanceDays: 14,
  instructions: null,
  ...over,
});

describe('nextHours', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('takes today’s window while it hasn’t ended, then the next day with hours', () => {
    // Friday 13 Nov 2026, 14:00 in Manila.
    jest.setSystemTime(new Date('2026-11-13T06:00:00.000Z'));
    const hours = ['Fri 15:00–17:00', 'Fri 09:00–10:00', 'Tue 13:00–15:00'];
    expect(nextHours(hours)).toEqual({ day: '2026-11-13', start: '15:00', end: '17:00' });

    // 17:30: today's are over, so next Tuesday's.
    jest.setSystemTime(new Date('2026-11-13T09:30:00.000Z'));
    expect(nextHours(hours)).toEqual({ day: '2026-11-17', start: '13:00', end: '15:00' });
  });

  it('wraps to the same weekday a week on, and gives null without readable hours', () => {
    jest.setSystemTime(new Date('2026-11-13T10:00:00.000Z')); // Fri 18:00
    expect(nextHours(['Fri 09:00–10:00'])).toEqual({ day: '2026-11-20', start: '09:00', end: '10:00' });
    expect(nextHours([])).toBeNull();
    expect(nextHours(['by appointment'])).toBeNull();
  });
});

describe('clinicHistory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-13T02:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('says nothing for an older server that sends no history', () => {
    expect(clinicHistory(t, clinic({}))).toBeNull();
  });

  it('puts a booked visit first, even when the last one was long ago', () => {
    const h = clinicHistory(t, clinic({ lastVisit: '2026-08-01', nextVisit: { date: '2026-11-14', time: '09:30' } }));
    expect(h?.tone).toBe('booked');
    expect(h?.text).toContain('clinics.history.booked');
  });

  it('marks a clinic due after 30 days without a visit, not before', () => {
    expect(clinicHistory(t, clinic({ lastVisit: '2026-10-14', nextVisit: null }))?.tone).toBe('plain'); // 30 days
    expect(clinicHistory(t, clinic({ lastVisit: '2026-10-13', nextVisit: null }))?.tone).toBe('due'); // 31 days
  });

  it('counts a never-visited clinic as due only when it added the rep', () => {
    expect(clinicHistory(t, clinic({ linked: true, lastVisit: null, nextVisit: null }))?.tone).toBe('due');
    expect(clinicHistory(t, clinic({ linked: false, lastVisit: null, nextVisit: null }))?.tone).toBe('plain');
  });
});

describe('hoursOn', () => {
  // 2026-11-17 is a Tuesday, 2026-11-18 a Wednesday.
  const hours = ['Tue 18:00–19:00', 'Thu 09:00–11:00', 'Tue 15:00–17:00'];

  it("reads the day's windows, earliest first", () => {
    expect(hoursOn(hours, '2026-11-17')).toBe('15:00–17:00, 18:00–19:00');
  });

  it('is empty on a day without rep hours, or with unreadable lines', () => {
    expect(hoursOn(hours, '2026-11-18')).toBe('');
    expect(hoursOn(['Tuesdays after lunch'], '2026-11-17')).toBe('');
  });
});

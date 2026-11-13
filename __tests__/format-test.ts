import { addDays, clinicHhmm, clinicYmd, daysFromToday, formatMoney, formatTime } from '@/lib/format';

describe('formatMoney', () => {
  it('shows pesos with two decimals, a real minus sign, and a dash for no amount', () => {
    expect(formatMoney(1234.5)).toBe('₱1,234.50');
    expect(formatMoney(0)).toBe('₱0.00');
    expect(formatMoney(-1234.5)).toBe('−₱1,234.50');
    expect(formatMoney(2500.005)).toBe('₱2,500.01');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(NaN)).toBe('—');
  });
});

describe('Manila day math', () => {
  afterEach(() => jest.useRealTimers());

  it('takes the calendar day and clock on Manila time (UTC+8), whatever the phone’s zone', () => {
    // 16:30 UTC is 00:30 the next day in Manila.
    expect(clinicYmd(new Date('2026-11-12T16:30:00.000Z'))).toBe('2026-11-13');
    expect(clinicYmd(new Date('2026-11-12T15:59:00.000Z'))).toBe('2026-11-12');
    expect(clinicHhmm('2026-11-12T16:30:00.000Z')).toBe('00:30');
    expect(clinicHhmm(null)).toBe('');
  });

  it('counts whole days from today in Manila', () => {
    jest.useFakeTimers({ now: new Date('2026-11-12T16:30:00.000Z') }); // Nov 13, 00:30 in Manila
    expect(daysFromToday('2026-11-13')).toBe(0);
    expect(daysFromToday('2026-11-14T00:00:00.000Z')).toBe(1);
    expect(daysFromToday('2026-11-12')).toBe(-1);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('shows a clinic wall-clock time in 12-hour form', () => {
    expect(formatTime('14:30')).toBe('2:30 PM');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('')).toBe('');
  });
});

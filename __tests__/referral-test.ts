import { joinedThisMonth } from '@/lib/referral';

describe('joinedThisMonth', () => {
  // Nov 13, 2026, 10:00 in Manila.
  const now = new Date('2026-11-13T02:00:00Z');

  it('counts clinics that joined in the current Manila month', () => {
    const clinics = [
      { name: 'A', joinedOn: '2026-11-01T03:00:00Z' },
      { name: 'B', joinedOn: '2026-11-12T23:00:00Z' },
      { name: 'C', joinedOn: '2026-10-20T03:00:00Z' },
    ];
    expect(joinedThisMonth(clinics, now)).toBe(2);
  });

  it('uses Manila days at the month edge, not UTC', () => {
    // Oct 31 17:00 UTC is Nov 1 01:00 in Manila: this month.
    expect(joinedThisMonth([{ name: 'A', joinedOn: '2026-10-31T17:00:00Z' }], now)).toBe(1);
    // Oct 31 15:00 UTC is Oct 31 23:00 in Manila: last month.
    expect(joinedThisMonth([{ name: 'B', joinedOn: '2026-10-31T15:00:00Z' }], now)).toBe(0);
  });

  it('ignores unreadable dates and empty lists', () => {
    expect(joinedThisMonth([{ name: 'A', joinedOn: 'nope' }], now)).toBe(0);
    expect(joinedThisMonth([], now)).toBe(0);
  });
});

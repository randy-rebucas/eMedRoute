import { cycleDays, daysLeft, openBillingRequest, yearlyMonthsFree } from '@/lib/plan';

describe('daysLeft', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  it('counts a part day as a day and stops at zero', () => {
    expect(daysLeft('2026-11-14T12:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-11-14T13:00:00Z', now)).toBe(2);
    expect(daysLeft('2026-11-13T11:00:00Z', now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
  });
  it('sizes the meter to one paid period', () => {
    expect(cycleDays('monthly')).toBe(30);
    expect(cycleDays('yearly')).toBe(365);
  });
});

describe('yearlyMonthsFree', () => {
  it('says how many months the yearly price saves', () => {
    expect(yearlyMonthsFree({ monthly: 500, yearly: 5000 })).toBe(2);
    expect(yearlyMonthsFree({ monthly: 500, yearly: 6000 })).toBe(0);
    expect(yearlyMonthsFree({ monthly: 0, yearly: 0 })).toBe(0);
  });
});

describe('openBillingRequest', () => {
  const r = (category: string, status: string, createdAt: string) => ({ category, status, createdAt });
  it('finds the newest billing request still waiting on support', () => {
    const list = [
      r('billing', 'resolved', '2026-11-12'),
      r('technical', 'open', '2026-11-13'),
      r('billing', 'open', '2026-11-10'),
      r('billing', 'in-progress', '2026-11-11'),
    ];
    expect(openBillingRequest(list)?.createdAt).toBe('2026-11-11');
    expect(openBillingRequest([r('billing', 'closed', '2026-11-01')])).toBeNull();
  });
});

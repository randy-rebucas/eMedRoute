import { byMonth, daysSinceDone, memberMonth, teamMonth } from '@/lib/team';
import { TeamMember } from '@/lib/types';

const member = (name: string, visitsThisMonth: number, completedThisMonth: number, lastVisitAt: string | null = null): TeamMember => ({
  id: name,
  name,
  email: `${name}@x.ph`,
  territory: null,
  role: 'member',
  stats: { visitsThisMonth, completedThisMonth, upcoming: 0, pendingRequests: 0, lastVisitAt },
});

describe('memberMonth', () => {
  it('splits the month into done and the rest', () => {
    expect(memberMonth(member('a', 6, 4).stats)).toEqual({ done: 4, open: 2, total: 6 });
  });
  it('never shows a negative rest when counts disagree', () => {
    expect(memberMonth(member('a', 1, 3).stats)).toEqual({ done: 3, open: 0, total: 3 });
  });
});

describe('daysSinceDone', () => {
  it('counts whole days from the stored day, not the phone clock', () => {
    expect(daysSinceDone('2026-10-30T00:00:00.000Z', '2026-11-13')).toBe(14);
    expect(daysSinceDone('2026-11-13T00:00:00.000Z', '2026-11-13')).toBe(0);
  });
  it('is null when there was never a completed visit', () => {
    expect(daysSinceDone(null, '2026-11-13')).toBeNull();
  });
});

describe('byMonth and teamMonth', () => {
  const team = [member('Ben', 2, 2), member('Ana', 6, 4), member('Cy', 2, 0)];
  it('ranks busiest first, ties by name', () => {
    expect(byMonth(team).map((m) => m.name)).toEqual(['Ana', 'Ben', 'Cy']);
  });
  it('totals the team', () => {
    expect(teamMonth(team)).toEqual({ total: 10, done: 6 });
  });
});

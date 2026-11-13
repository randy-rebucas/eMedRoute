import { inboxByDay } from '@/lib/inbox';
import { InboxItem } from '@/lib/types';

const item = (id: string, createdAt: string, read = false): InboxItem => ({
  id,
  kind: 'visit',
  title: 'Visit approved',
  message: 'Sunrise Clinic approved your visit.',
  screen: 'visits',
  entityId: 'v1',
  read,
  createdAt,
});

describe('inboxByDay', () => {
  it('groups by Manila day, keeping the server’s newest-first order', () => {
    const days = inboxByDay([
      item('a', '2026-11-13T09:00:00.000Z'), // 17:00 Manila, Nov 13
      item('b', '2026-11-12T23:30:00.000Z'), // 07:30 Manila, Nov 13 (still Nov 12 in UTC)
      item('c', '2026-11-12T15:00:00.000Z'), // 23:00 Manila, Nov 12
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-11-13', '2026-11-12']);
    expect(days[0].data.map((i) => i.id)).toEqual(['a', 'b']);
    expect(days[1].data.map((i) => i.id)).toEqual(['c']);
  });

  it('returns nothing for an empty inbox', () => {
    expect(inboxByDay([])).toEqual([]);
  });
});

import { paidAmount, sponsorCover, sponsorshipGroups, sponsorshipSummary } from '@/lib/sponsorships';
import { Sponsorship } from '@/lib/types';

const NOW = new Date('2026-11-13T04:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString();

function s(over: Partial<Sponsorship> & { id: string }): Sponsorship {
  return {
    status: 'accepted',
    initiatedBy: 'clinic',
    awaitingYou: false,
    message: null,
    clinic: { id: `c-${over.id}`, name: `Clinic ${over.id}` },
    rep: { id: 'r', name: 'Rep', company: null },
    paidThrough: null,
    active: false,
    payments: [],
    createdAt: day(-60),
    respondedAt: null,
    endedAt: null,
    endedBy: null,
    ...over,
  };
}

const pay = (months: number, amount: number, paidAt: string, refunded = false) => ({ months, amount, paidAt, refunded });

describe('sponsorshipGroups', () => {
  it('puts unpaid or lapsed first, then running plans soonest to end, then open offers', () => {
    const later = s({ id: 'later', active: true, paidThrough: day(80) });
    const sooner = s({ id: 'sooner', active: true, paidThrough: day(5) });
    const unpaid = s({ id: 'unpaid' });
    const offer = s({ id: 'offer', status: 'pending', initiatedBy: 'rep' });
    const asks = s({ id: 'asks', status: 'pending', awaitingYou: true });
    const ended = s({ id: 'ended', status: 'ended' });
    const g = sponsorshipGroups([later, offer, sooner, ended, asks, unpaid]);
    expect(g.waiting.map((x) => x.id)).toEqual(['asks']);
    expect(g.current.map((x) => x.id)).toEqual(['unpaid', 'sooner', 'later', 'offer']);
    expect(g.past.map((x) => x.id)).toEqual(['ended']);
  });
});

describe('sponsorshipSummary', () => {
  it('counts running plans, the next to end, waiting, unpaid, and money paid without refunds', () => {
    const list = [
      s({ id: 'a', active: true, paidThrough: day(40), payments: [pay(3, 7000, day(-50)), pay(1, 2500, day(-20), true)] }),
      s({ id: 'b', active: true, paidThrough: day(6), payments: [pay(1, 2500, day(-24))] }),
      s({ id: 'c', paidThrough: day(-3), payments: [pay(1, 2500, day(-33))] }),
      s({ id: 'd', status: 'pending', awaitingYou: true }),
    ];
    const sum = sponsorshipSummary(list);
    expect(sum.paying).toBe(2);
    expect(sum.next?.id).toBe('b');
    expect(sum.waiting).toBe(1);
    expect(sum.toPay).toBe(1);
    expect(sum.totalPaid).toBe(12000);
    expect(paidAmount(list[0])).toBe(7000);
  });

  it('has no next plan when nothing is running', () => {
    expect(sponsorshipSummary([s({ id: 'x' })]).next).toBeNull();
  });
});

describe('sponsorCover', () => {
  it('measures days left against the latest paid term and flags the last 7 days', () => {
    const c = sponsorCover(s({ id: 'a', active: true, paidThrough: day(45), payments: [pay(1, 2500, day(-100)), pay(3, 7000, day(-45))] }), NOW);
    expect(c).toEqual({ left: 45, share: 0.5, soon: false });
    expect(sponsorCover(s({ id: 'b', active: true, paidThrough: day(7), payments: [pay(1, 2500, day(-23))] }), NOW)?.soon).toBe(true);
  });

  it('caps at full when renewals stack, and is absent for plans not running', () => {
    expect(sponsorCover(s({ id: 'a', active: true, paidThrough: day(50), payments: [pay(1, 2500, day(-1))] }), NOW)?.share).toBe(1);
    expect(sponsorCover(s({ id: 'b', paidThrough: day(-1) }), NOW)).toBeNull();
    expect(sponsorCover(s({ id: 'c', status: 'pending' }), NOW)).toBeNull();
  });
});

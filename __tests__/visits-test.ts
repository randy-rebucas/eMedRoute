import { canDeliver, ClinicHolding, holdingShares, holdingsFor, holdingTotals } from '@/lib/deliveries';
import { clinicTodayYmd } from '@/lib/format';
import { todaysStops } from '@/lib/route';
import type { Delivery } from '@/lib/types';
import { visitProgress, visitState } from '@/lib/visits';
import { durationsWith } from '@/components/VisitLogForm';

describe('visitState', () => {
  it('reads a booking’s status, and an own entry as a log', () => {
    expect(visitState({ clinicId: 'c', status: 'requested' })).toBe('waiting');
    expect(visitState({ clinicId: 'c', status: 'scheduled' })).toBe('approved');
    expect(visitState({ clinicId: 'c', status: 'scheduled', checkedInAt: '2026-11-01T01:00:00Z' })).toBe('checkedIn');
    expect(visitState({ status: 'scheduled' })).toBe('log');
  });
});

describe('canDeliver', () => {
  it('matches the server: approved or completed bookings, linked own entries unless cancelled', () => {
    expect(canDeliver({ clinicId: 'c', status: 'scheduled' })).toBe(true);
    expect(canDeliver({ clinicId: 'c', status: 'requested' })).toBe(false);
    expect(canDeliver({ linkedClinicId: 'c', status: 'completed' })).toBe(true);
    expect(canDeliver({ linkedClinicId: 'c', status: 'cancelled' })).toBe(false);
    expect(canDeliver({ status: 'completed' })).toBe(false);
  });
});

describe('holdingsFor', () => {
  const delivery = (status: Delivery['status'], quantity: number, unit: string, receivedQuantity?: number) =>
    ({
      _id: `${status}-${unit}`,
      clinicId: 'c1',
      clinicName: 'Sunrise',
      status,
      createdAt: '2026-10-01T00:00:00Z',
      lines: [{ productId: 'p', quantity, unit, receivedQuantity }],
    }) as unknown as Delivery;

  it('adds received and pending per clinic and unit, ignoring rejected and cancelled', () => {
    const rows = holdingsFor('p', [
      delivery('received', 20, 'boxes', 18),
      delivery('pending', 5, 'Boxes'),
      delivery('rejected', 9, 'boxes'),
      delivery('received', 30, 'tablets'),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: 'boxes', received: 18, pending: 5 }),
        expect.objectContaining({ unit: 'tablets', received: 30, pending: 0 }),
      ])
    );
  });
});

describe('todaysStops', () => {
  it('takes today’s visits with an address, in time order, one stop per address', () => {
    const today = `${clinicTodayYmd()}T00:00:00.000Z`;
    const stops = todaysStops([
      { _id: '2', clinicName: 'B', clinicLocation: 'Makati', date: today, time: '15:00' },
      { _id: '1', clinicName: 'A', clinicLocation: 'Pasig', date: today, time: '09:00' },
      { _id: '3', clinicName: 'A', clinicLocation: 'Pasig', date: today, time: '11:00' },
      { _id: '4', clinicName: 'C', clinicLocation: '', date: today, time: '10:00' },
      { _id: '5', clinicName: 'D', clinicLocation: 'Taguig', date: '2020-01-01T00:00:00.000Z', time: '08:00' },
    ]);
    expect(stops.map((s) => s.id)).toEqual(['1', '2']);
  });
});

describe('visitProgress', () => {
  const at = { createdAt: '2026-11-01T01:00:00Z', respondedAt: '2026-11-01T03:00:00Z' };
  const ids = (v: Parameters<typeof visitProgress>[0]) => visitProgress(v).map((s) => `${s.id}:${s.mark}`);

  it('has no path for an own log entry', () => {
    expect(visitProgress({ status: 'completed' })).toEqual([]);
  });

  it('walks an open booking: what happened, what is now, what is to come', () => {
    expect(ids({ clinicId: 'c', status: 'requested', ...at })).toEqual(['requested:done', 'answer:now', 'checkIn:todo', 'finish:todo']);
    expect(ids({ clinicId: 'c', status: 'scheduled', ...at })).toEqual(['requested:done', 'approved:done', 'checkIn:now', 'finish:todo']);
    expect(ids({ clinicId: 'c', status: 'scheduled', checkedInAt: '2026-11-02T01:00:00Z', ...at })).toEqual([
      'requested:done',
      'approved:done',
      'checkedIn:done',
      'finish:now',
    ]);
  });

  it('carries the API times on the steps that happened', () => {
    const steps = visitProgress({ clinicId: 'c', status: 'scheduled', checkedInAt: '2026-11-02T01:00:00Z', ...at });
    expect(steps.map((s) => s.at ?? null)).toEqual([at.createdAt, at.respondedAt, '2026-11-02T01:00:00Z', null]);
  });

  it('shows a check-in on a completed visit only when there was one', () => {
    expect(ids({ clinicId: 'c', status: 'completed', ...at })).toEqual(['requested:done', 'approved:done', 'done:done']);
    expect(ids({ clinicId: 'c', status: 'completed', checkedInAt: '2026-11-02T01:00:00Z', ...at })).toContain('checkedIn:done');
  });

  it('stops at the step that ended it', () => {
    expect(ids({ clinicId: 'c', status: 'declined', ...at })).toEqual(['requested:done', 'declined:stopped']);
    expect(ids({ clinicId: 'c', status: 'no-show', ...at })).toEqual(['requested:done', 'approved:done', 'missed:stopped']);
    expect(ids({ clinicId: 'c', status: 'cancelled', cancelledBy: 'rep', createdAt: at.createdAt })).toEqual(['requested:done', 'cancelledByYou:stopped']);
    expect(ids({ clinicId: 'c', status: 'cancelled', cancelledBy: 'clinic', ...at })).toEqual([
      'requested:done',
      'approved:done',
      'cancelledByClinic:stopped',
    ]);
  });
});

describe('durationsWith', () => {
  it('keeps a saved length that is not a chip, in order', () => {
    expect(durationsWith(30)).toEqual([15, 30, 45, 60, 90, 120]);
    expect(durationsWith(20)).toEqual([15, 20, 30, 45, 60, 90, 120]);
  });
});

describe('holdingTotals / holdingShares', () => {
  const row = (clinicId: string, unit: string, received: number, pending: number): ClinicHolding => ({
    clinicId,
    clinicName: clinicId,
    unit,
    received,
    pending,
    lastAt: '2026-11-01T00:00:00.000Z',
  });

  it('totals across clinics only when every row shares a unit (any case)', () => {
    expect(holdingTotals([row('a', 'boxes', 10, 2), row('b', 'Boxes', 5, 0)])).toEqual({ received: 15, waiting: 2, unit: 'boxes' });
    expect(holdingTotals([row('a', 'boxes', 10, 0), row('a', 'packs', 3, 0)])).toBeNull();
    expect(holdingTotals([])).toBeNull();
  });

  it('scales each bar against the largest row in its own unit', () => {
    expect(holdingShares([row('a', 'boxes', 10, 10), row('b', 'boxes', 5, 0), row('a', 'packs', 3, 0)])).toEqual([1, 0.25, 1]);
    expect(holdingShares([row('a', 'boxes', 0, 0)])).toEqual([0]);
  });
});

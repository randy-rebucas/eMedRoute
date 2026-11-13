import { canDeliver, holdingsFor } from '@/lib/deliveries';
import { clinicTodayYmd } from '@/lib/format';
import { todaysStops } from '@/lib/route';
import type { Delivery } from '@/lib/types';
import { visitState } from '@/lib/visits';

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

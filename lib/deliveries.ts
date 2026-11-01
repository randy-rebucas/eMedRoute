import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { PlainKey } from './i18n';
import { Delivery, DeliveryInput, DeliveryStatus, Visit } from './types';
import { useApiData } from './useApiData';

const DELIVERIES_PATH = '/api/medical-representatives/deliveries';

/** Most lines one delivery may carry (server: MAX_DELIVERY_LINES). */
export const MAX_DELIVERY_LINES = 20;

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, PlainKey> = {
  pending: 'deliveries.status.pending',
  received: 'deliveries.status.received',
  rejected: 'deliveries.status.rejected',
  cancelled: 'deliveries.status.cancelled',
};

/**
 * Whether a visit can carry a delivery (server: deliveryClinicOf): an approved or completed
 * booking, or an own log entry linked to a clinic, unless cancelled.
 */
export function canDeliver(visit: Pick<Visit, 'clinicId' | 'linkedClinicId' | 'status'>): boolean {
  if (visit.clinicId) return visit.status === 'scheduled' || visit.status === 'completed';
  return !!visit.linkedClinicId && visit.status !== 'cancelled';
}

/** The deliveries recorded on one visit, newest first. */
export function useVisitDeliveries(visitId: string | undefined | null) {
  return useApiData<Delivery[]>(visitId ? DELIVERIES_PATH + query({ visitId, limit: 100 }) : null, {
    refreshOn: ['deliveries'],
    offline: true,
  });
}

/** Every delivery that carried a product, for its "where it is". */
export function useProductDeliveries(productId: string | undefined | null) {
  return useApiData<Delivery[]>(productId ? DELIVERIES_PATH + query({ productId, limit: 100 }) : null, {
    refreshOn: ['deliveries'],
    offline: true,
  });
}

export type ClinicHolding = {
  clinicId: string;
  clinicName: string;
  /** Units the clinic confirmed. */
  received: number;
  /** Units still waiting for the clinic to confirm. */
  pending: number;
  unit: string;
  lastAt: string;
};

/**
 * "Where it is": one row per clinic and unit for a product, from its deliveries (boxes and packs
 * don't add up, so they stay apart). Received counts what the clinic confirmed; pending is
 * waiting on the clinic; rejected and cancelled count for nothing.
 */
export function holdingsFor(productId: string, deliveries: Delivery[]): ClinicHolding[] {
  const byClinic = new Map<string, ClinicHolding>();
  for (const d of deliveries) {
    if (d.status !== 'received' && d.status !== 'pending') continue;
    for (const line of d.lines) {
      if (line.productId !== productId) continue;
      const key = `${d.clinicId}|${line.unit.toLowerCase()}`;
      const row = byClinic.get(key) ?? { clinicId: d.clinicId, clinicName: d.clinicName, received: 0, pending: 0, unit: line.unit, lastAt: d.createdAt };
      if (d.status === 'received') row.received += line.receivedQuantity ?? line.quantity;
      else row.pending += line.quantity;
      if (d.createdAt > row.lastAt) row.lastAt = d.createdAt;
      byClinic.set(key, row);
    }
  }
  return [...byClinic.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function createDelivery(input: DeliveryInput): Promise<Delivery> {
  const delivery = await apiRequest<Delivery>(DELIVERIES_PATH, { method: 'POST', body: input });
  emitRefresh('deliveries');
  return delivery;
}

/** Only while the clinic hasn't answered (409 DELIVERY_CLOSED after). */
export async function cancelDelivery(id: string): Promise<void> {
  await apiRequest(`${DELIVERIES_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emitRefresh('deliveries');
}

import { apiRequest, query } from './api';
import { emitRefresh } from './events';
import { PlainKey } from './i18n';
import { Delivery, DeliveryInput, DeliveryStatus, Visit } from './types';
import { useApiData } from './useApiData';

const DELIVERIES_PATH = '/api/medical-representatives/deliveries';

/** Most lines one delivery may carry (server: MAX_DELIVERY_LINES). */
export const MAX_DELIVERY_LINES = 20;
/** Longest unit a line may carry (server rule; same as a product's pack-size unit). */
export const MAX_DELIVERY_UNIT = 50;

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
  return useApiData<Delivery[]>(visitId ? DELIVERIES_PATH + query({ visitId }) : null, {
    refreshOn: ['deliveries'],
    offline: true,
    allPages: true,
  });
}

/** Every delivery that carried a product, for its "where it is". */
export function useProductDeliveries(productId: string | undefined | null) {
  return useApiData<Delivery[]>(productId ? DELIVERIES_PATH + query({ productId }) : null, {
    refreshOn: ['deliveries'],
    offline: true,
    allPages: true,
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

/**
 * Totals across every clinic when all rows share one unit (boxes and packs don't add up); null
 * when they differ or there are none.
 */
export function holdingTotals(rows: ClinicHolding[]): { received: number; waiting: number; unit: string } | null {
  if (!rows.length) return null;
  const unit = rows[0].unit;
  if (rows.some((r) => r.unit.toLowerCase() !== unit.toLowerCase())) return null;
  return { received: rows.reduce((n, r) => n + r.received, 0), waiting: rows.reduce((n, r) => n + r.pending, 0), unit };
}

/** Each row's bar length (0–1): its units against the largest row in the same unit. */
export function holdingShares(rows: ClinicHolding[]): number[] {
  const max = new Map<string, number>();
  for (const r of rows) {
    const key = r.unit.toLowerCase();
    max.set(key, Math.max(max.get(key) ?? 0, r.received + r.pending));
  }
  return rows.map((r) => {
    const m = max.get(r.unit.toLowerCase()) ?? 0;
    return m ? (r.received + r.pending) / m : 0;
  });
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

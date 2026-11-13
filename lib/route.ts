import { Linking } from 'react-native';
import { daysFromToday } from './format';
import { Dashboard } from './types';
import { visitDay } from './visits';

type RouteVisit = Pick<Dashboard['nextVisits'][number], '_id' | 'clinicName' | 'clinicLocation' | 'date' | 'time'>;

export type RouteStop = { id: string; clinicName: string; address: string; time: string };

/**
 * Today's stops in visit order: scheduled visits dated today that have an address, one stop per
 * address (two visits at the same clinic are one stop, at the earlier time).
 */
export function todaysStops(visits: RouteVisit[]): RouteStop[] {
  const seen = new Set<string>();
  return visits
    .filter((v) => daysFromToday(visitDay(v)) === 0 && !!v.clinicLocation?.trim())
    .sort((a, b) => a.time.localeCompare(b.time))
    .flatMap((v) => {
      const address = `${v.clinicName}, ${v.clinicLocation!.trim()}`;
      if (seen.has(address)) return [];
      seen.add(address);
      return [{ id: v._id, clinicName: v.clinicName, address, time: v.time }];
    });
}

/** Stops Google Maps takes between the start and the destination. */
export const MAX_WAYPOINTS = 9;

/** How many stops `openRoute` leaves out (those after the 9th, before the last). */
export function stopsLeftOut(stops: RouteStop[]): number {
  return Math.max(0, stops.length - 1 - MAX_WAYPOINTS);
}

/**
 * Open Google Maps with directions from where the rep is, through every stop in order. A Google
 * Maps link on both platforms: Apple Maps links take no stops in between. The Maps apps take up
 * to 9 stops in between; a phone browser (iPhone without Google Maps) takes 3 and drops the rest.
 */
export async function openRoute(stops: RouteStop[]): Promise<void> {
  if (!stops.length) return;
  const destination = stops[stops.length - 1].address;
  const waypoints = stops.slice(0, -1).slice(0, MAX_WAYPOINTS).map((s) => s.address);
  const params = [`api=1`, `travelmode=driving`, `destination=${encodeURIComponent(destination)}`];
  if (waypoints.length) params.push(`waypoints=${encodeURIComponent(waypoints.join('|'))}`);
  await Linking.openURL(`https://www.google.com/maps/dir/?${params.join('&')}`);
}

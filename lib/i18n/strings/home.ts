import { defineStrings } from '../types';

// Area "home": app/(app)/(tabs)/home.tsx, NextVisitCard.
export default defineStrings({
  en: {
    greeting: 'Hi, {name}',
    greetingNoName: 'Welcome back',
    nextVisit: 'Next visit',
    today: 'Today',
    tomorrow: 'Tomorrow',
    directions: 'Directions',
    directionsA11y: 'Directions to {clinic}',
    noNextVisit: 'No visits scheduled',
    noNextVisitHint: 'Approved bookings and planned visits from your log show here.',
    'count.thisMonth': 'visits this month',
    'count.waiting': 'waiting on a clinic',
    'count.expiring': 'products expiring',
    upcoming: 'Coming up',
    allUpcoming: { one: 'See {count} upcoming visit', other: 'See all {count} upcoming visits' },
    offlineSubject: 'your last-loaded summary',
  },
  fil: {
    greeting: 'Hi, {name}',
    greetingNoName: 'Maligayang pagbabalik',
    nextVisit: 'Susunod na pagbisita',
    today: 'Ngayon',
    tomorrow: 'Bukas',
    directions: 'Directions',
    directionsA11y: 'Directions papunta sa {clinic}',
    noNextVisit: 'Walang naka-schedule na pagbisita',
    noNextVisitHint: 'Dito lalabas ang mga approved na booking at nakaplanong pagbisita mula sa log mo.',
    'count.thisMonth': 'pagbisita ngayong buwan',
    'count.waiting': 'naghihintay sa clinic',
    'count.expiring': 'produktong mag-e-expire',
    upcoming: 'Paparating',
    allUpcoming: 'Tingnan ang {count} paparating na pagbisita',
    offlineSubject: 'huling na-load na buod mo',
  },
});

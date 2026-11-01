import { defineStrings } from '../types';

// Area "clinics": (tabs)/clinics.tsx, ClinicRow. Clinic names and times are never translated.
export default defineStrings({
  en: {
    intro: 'Clinics that take rep visits. Book a slot in their rep hours.',
    search: 'Search by clinic name or city',
    linked: 'Linked',
    book: 'Book a slot',
    empty: 'No clinics are taking rep bookings from you yet.',
    noMatch: 'No clinics match your search.',
  },
  fil: {
    intro: 'Mga clinic na tumatanggap ng rep visit. Mag-book ng slot sa rep hours nila.',
    search: 'Maghanap ayon sa pangalan ng clinic o lungsod',
    linked: 'Naka-link',
    book: 'Mag-book ng slot',
    empty: 'Wala pang clinic na tumatanggap ng booking mula sa iyo.',
    noMatch: 'Walang clinic na tugma sa hinanap mo.',
  },
});

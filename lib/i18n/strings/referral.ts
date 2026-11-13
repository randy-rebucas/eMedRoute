import { defineStrings } from '../types';

// Area "referral": app/(app)/referral.tsx, lib/referral. Codes, links and clinic names come from
// the server and are never written here. Filipino: needs native review.
export default defineStrings({
  en: {
    intro: 'Share your code with clinics you work with. A clinic that signs up with it, or enters it on its billing page, adds you to its reps, so you can sponsor its plan.',
    codeLabel: 'Your code',
    codeA11y: 'Your referral code, {code}',
    share: 'Share signup link',
    shareMessage: 'Register your clinic on MyClinicSoft with my code {code}: {link}',
    newCode: 'Get a new code',
    newCodeTitle: 'Get a new code?',
    newCodeBody: 'Your current code and link stop working. Clinics that already joined keep you as their rep.',
    newCodeConfirm: 'Get new code',
    clinicsTitle: 'Clinics that joined',
    clinicsCount: '{count} so far',
    clinicJoined: 'Joined {date}',
    empty: 'No clinics yet. Clinics appear here once they sign up with your code.',
    offlineSubject: 'your code',
  },
  fil: {
    intro: 'I-share ang code mo sa mga clinic na kasama mo. Kapag nag-sign up ang clinic gamit ito, o inilagay ito sa billing page nila, magiging rep ka nila at puwede mo nang i-sponsor ang plan nila.',
    codeLabel: 'Ang code mo',
    codeA11y: 'Ang referral code mo, {code}',
    share: 'I-share ang signup link',
    shareMessage: 'I-register ang clinic mo sa MyClinicSoft gamit ang code kong {code}: {link}',
    newCode: 'Kumuha ng bagong code',
    newCodeTitle: 'Kumuha ng bagong code?',
    newCodeBody: 'Hindi na gagana ang kasalukuyang code at link mo. Mananatili kang rep ng mga clinic na sumali na.',
    newCodeConfirm: 'Kumuha ng bago',
    clinicsTitle: 'Mga clinic na sumali',
    clinicsCount: '{count} sa ngayon',
    clinicJoined: 'Sumali noong {date}',
    empty: 'Wala pang clinic. Lalabas dito ang mga clinic kapag nag-sign up sila gamit ang code mo.',
    offlineSubject: 'ang code mo',
  },
});

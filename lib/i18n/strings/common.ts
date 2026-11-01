import { defineStrings } from '../types';

// Area "common": shared components and words. See lib/i18n/registry.ts and lib/i18n/GLOSSARY.md.
export default defineStrings({
  en: {
    cancel: 'Cancel',
    tryAgain: 'Try again',
    tryAgainTitle: 'Try Again',
    back: 'Back',
    goBack: 'Go back',
    next: 'Next',
    done: 'Done',
    save: 'Save',
    ok: 'OK',
    signOut: 'Sign out',
    tapToRetry: '{error} Tap to retry.',
    optional: '(optional)',

    // lib/api, useApiData, usePaginatedList (shown only when the server sent no message)
    somethingWrong: 'Something went wrong. Please try again.',
    failedToLoad: 'Failed to load. Pull to retry.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    network: "Can't reach the server. Check your connection and try again.",
    tooManyAttempts: 'Too many tries. Wait a few minutes.',
    requestFailed: 'Request failed ({status})',
    needsConnection: "You're offline. This needs a connection; what you typed is still here.",

    // AppHeader
    'header.yourProfile': 'Your profile',

    // OfflineBanner. `subject` is a noun phrase from the screen ("your visits"; Filipino without "ang").
    'offline.yourRecords': 'your saved data',
    'offline.banner': 'Offline. Showing {subject}. Pull down to try again.',
    'offline.bannerWhen': 'Offline. Showing {subject} from {when}. Pull down to try again.',

    // Language picker (Settings)
    'language.title': 'Language',
    'language.choose': 'Choose a language',
    'language.system': 'Same as phone',
    'language.systemNow': 'Same as phone ({language})',
    'language.en': 'English',
    'language.fil': 'Filipino',
  },
  fil: {
    cancel: 'Kanselahin',
    tryAgain: 'Subukan ulit',
    tryAgainTitle: 'Subukan Ulit',
    back: 'Bumalik',
    goBack: 'Bumalik',
    next: 'Susunod',
    done: 'Tapos na',
    save: 'I-save',
    ok: 'OK',
    signOut: 'Mag-sign out',
    tapToRetry: '{error} I-tap para subukan ulit.',
    optional: '(opsyonal)',

    somethingWrong: 'May nangyaring mali. Pakisubukan ulit.',
    failedToLoad: 'Hindi ma-load. Hilahin pababa para subukan ulit.',
    sessionExpired: 'Nag-expire na ang session mo. Mag-sign in ulit.',
    network: 'Hindi maabot ang server. Tingnan ang internet connection mo at subukan ulit.',
    tooManyAttempts: 'Masyadong maraming subok. Maghintay ng ilang minuto.',
    requestFailed: 'Hindi natuloy ang request ({status})',
    needsConnection: 'Offline ka. Kailangan nito ng connection; nandito pa rin ang tinype mo.',

    'header.yourProfile': 'Ang profile mo',

    'offline.yourRecords': 'naka-save na data',
    'offline.banner': 'Offline. Ipinapakita ang {subject}. Hilahin pababa para subukan ulit.',
    'offline.bannerWhen': 'Offline. Ipinapakita ang {subject} (naka-save noong {when}). Hilahin pababa para subukan ulit.',

    'language.title': 'Wika',
    'language.choose': 'Pumili ng wika',
    'language.system': 'Kapareho ng phone',
    'language.systemNow': 'Kapareho ng phone ({language})',
    'language.en': 'English',
    'language.fil': 'Filipino',
  },
});

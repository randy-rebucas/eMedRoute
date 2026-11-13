import { defineStrings } from '../types';

// Area "common": shared components and words. See lib/i18n/registry.ts and lib/i18n/GLOSSARY.md.
export default defineStrings({
  en: {
    cancel: 'Cancel',
    tryAgain: 'Try again',
    tryAgainTitle: 'Try Again',
    back: 'Back',
    goBack: 'Go back',
    done: 'Done',
    save: 'Save',
    ok: 'OK',
    signOut: 'Sign out',
    tapToRetry: '{error} Tap to retry.',
    optional: '(optional)',
    undo: 'Undo',
    dismiss: 'Dismiss',
    notSet: 'not set',
    pickDate: 'Pick a day',
    pickTime: 'Pick a time',

    // lib/api, useApiData, usePaginatedList (shown only when the server sent no message)
    somethingWrong: 'Something went wrong. Please try again.',
    failedToLoad: 'Failed to load. Pull to retry.',
    loadMoreFailed: "Couldn't load more.",
    sessionExpired: 'Your session has expired. Please sign in again.',
    network: "Can't reach the server. Check your connection and try again.",
    tooManyAttempts: 'Too many tries. Wait a few minutes.',
    requestFailed: 'Request failed ({status})',
    needsConnection: "You're offline. This needs a connection; what you typed is still here.",
    // Edit screens wait for the server's copy: editing a saved one could undo newer changes.
    editNeedsConnection: "You're offline. Connect to edit this, so newer changes aren't saved over.",

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
    done: 'Tapos na',
    save: 'I-save',
    ok: 'OK',
    signOut: 'Mag-sign out',
    tapToRetry: '{error} I-tap para subukan ulit.',
    optional: '(opsyonal)',
    undo: 'I-undo',
    dismiss: 'Isara',
    notSet: 'wala pa',
    pickDate: 'Pumili ng araw',
    pickTime: 'Pumili ng oras',

    somethingWrong: 'May nangyaring mali. Pakisubukan ulit.',
    failedToLoad: 'Hindi ma-load. Hilahin pababa para subukan ulit.',
    loadMoreFailed: 'Hindi ma-load ang iba pa.',
    sessionExpired: 'Nag-expire na ang session mo. Mag-sign in ulit.',
    network: 'Hindi maabot ang server. Tingnan ang internet connection mo at subukan ulit.',
    tooManyAttempts: 'Masyadong maraming subok. Maghintay ng ilang minuto.',
    requestFailed: 'Hindi natuloy ang request ({status})',
    needsConnection: 'Offline ka. Kailangan nito ng connection; nandito pa rin ang tinype mo.',
    editNeedsConnection: 'Offline ka. Kumonekta para ma-edit ito, para hindi mapalitan ang mas bagong pagbabago.',

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

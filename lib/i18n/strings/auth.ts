import { defineStrings } from '../types';

// Area "auth": app/(auth)/*, components/auth.tsx, lib/auth.tsx. See lib/i18n/GLOSSARY.md.
export default defineStrings({
  en: {
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    backToSignIn: 'Back to sign-in',

    'otp.a11y': '{length}-digit code, {entered} of {length} entered',
    'otp.a11yIncorrect': '{length}-digit code, {entered} of {length} entered, incorrect',
    'otp.hint': 'Double tap to type the code',
    'otp.fieldA11y': '{length}-digit code',

    'login.title': 'Sign in',
    'login.subtitle': 'For reps visiting clinics on MyClinicSoft. Use the email and password from your invite.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.signIn': 'Sign in',
    'login.missingFields': 'Enter your email and password.',
    'login.newRep': 'New rep?',
    'login.register': 'Register on the web',

    // Refusals (sign-in codes in MOBILE_API.md)
    'setup.title': 'Set your password first',
    'setup.message': 'Open the invite email to set your password, then sign in here.',
    'inactive.title': "Your account isn't active yet",
    'inactive.message': 'Your registration still needs to be paid for or activated. If you think this is a mistake, contact support.',
    'inactive.support': 'Contact support',

    'twoStep.title': 'Enter your code',
    'twoStep.subtitle': 'Open your authenticator app and type the 6-digit code for MyClinicSoft.',
    'twoStep.verify': 'Verify',
    'twoStep.expiresIn': 'This sign-in expires in',
    'twoStep.expiresInA11y': 'This sign-in expires in {minutes} minutes {seconds} seconds',
    'twoStep.expiredTitle': 'Sign-in timed out',
    'twoStep.expired': 'The code has to be entered within 5 minutes. Sign in again to get a new chance.',

    'notify.title': 'Know when clinics answer',
    'notify.subtitle': 'Turn on notifications so you never have to call a clinic to ask.',
    'notify.answers': 'When a clinic approves, declines or cancels your visit',
    'notify.visitDay': 'When the clinic checks you in, completes your visit or marks you as not arriving',
    'notify.reminders': 'A reminder before a visit, and when a product is about to expire',
    'notify.team': 'When a manager invites you to their team',
    'notify.later': 'You can change this anytime in Settings.',
    'notify.allow': 'Turn on notifications',
    'notify.notNow': 'Not now',

    'offline.title': 'No Internet Connection',
    'offline.message': 'Please check your internet connection and try again.',
    'maintenance.title': "We'll Be Right Back",
    'maintenance.message': 'MyClinicSoft is temporarily unavailable while we do some maintenance. Please try again in a little while.',

    'notice.signOutEverywhereFailed':
      "You're signed out on this device, but we couldn't confirm your other devices were signed out. Sign in and try again, or change your password.",
  },
  fil: {
    showPassword: 'Ipakita ang password',
    hidePassword: 'Itago ang password',
    backToSignIn: 'Bumalik sa sign-in',

    'otp.a11y': '{length}-digit na code, {entered} sa {length} ang nailagay',
    'otp.a11yIncorrect': '{length}-digit na code, {entered} sa {length} ang nailagay, mali',
    'otp.hint': 'I-double tap para i-type ang code',
    'otp.fieldA11y': '{length}-digit na code',

    'login.title': 'Mag-sign in',
    'login.subtitle': 'Para sa mga rep na bumibisita sa mga clinic sa MyClinicSoft. Gamitin ang email at password mula sa invite mo.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.signIn': 'Mag-sign in',
    'login.missingFields': 'Ilagay ang email at password mo.',
    'login.newRep': 'Bagong rep?',
    'login.register': 'Mag-register sa web',

    'setup.title': 'I-set muna ang password mo',
    'setup.message': 'Buksan ang invite email para i-set ang password mo, saka mag-sign in dito.',
    'inactive.title': 'Hindi pa aktibo ang account mo',
    'inactive.message': 'Kailangan pang bayaran o i-activate ang registration mo. Kung sa tingin mo ay mali ito, kontakin ang support.',
    'inactive.support': 'Kontakin ang support',

    'twoStep.title': 'Ilagay ang code mo',
    'twoStep.subtitle': 'Buksan ang authenticator app mo at i-type ang 6-digit na code para sa MyClinicSoft.',
    'twoStep.verify': 'I-verify',
    'twoStep.expiresIn': 'Mag-e-expire ang sign-in na ito sa loob ng',
    'twoStep.expiresInA11y': 'Mag-e-expire ang sign-in na ito sa loob ng {minutes} minuto at {seconds} segundo',
    'twoStep.expiredTitle': 'Nag-time out ang sign-in',
    'twoStep.expired': 'Kailangang ilagay ang code sa loob ng 5 minuto. Mag-sign in ulit para sa bagong pagkakataon.',

    'notify.title': 'Malaman agad ang sagot ng clinic',
    'notify.subtitle': 'I-on ang notifications para hindi mo na kailangang tumawag sa clinic para magtanong.',
    'notify.answers': 'Kapag in-approve, tinanggihan o kinansela ng clinic ang pagbisita mo',
    'notify.visitDay': 'Kapag na-check in ka ng clinic, natapos ang pagbisita, o minarkahan kang hindi dumating',
    'notify.reminders': 'Paalala bago ang pagbisita, at kapag malapit nang mag-expire ang isang produkto',
    'notify.team': 'Kapag inimbitahan ka ng isang manager sa team niya',
    'notify.later': 'Puwede mo itong baguhin kahit kailan sa Settings.',
    'notify.allow': 'I-on ang notifications',
    'notify.notNow': 'Hindi muna',

    'offline.title': 'Walang Internet',
    'offline.message': 'Tingnan ang internet connection mo at subukan ulit.',
    'maintenance.title': 'Babalik Kami Agad',
    'maintenance.message': 'Pansamantalang hindi magamit ang MyClinicSoft habang may maintenance. Pakisubukan ulit mamaya.',

    'notice.signOutEverywhereFailed':
      'Naka-sign out ka na sa device na ito, pero hindi namin makumpirma kung na-sign out na rin ang iba mong device. Mag-sign in at subukan ulit, o palitan ang password mo.',
  },
});

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

    // Photo bands (AuthBand): the first impression of each screen.
    'band.login': 'Book clinic visits from the road, and hear back the moment a clinic answers.',
    'band.register': 'Your clinic visits, products and deliveries, in one app.',

    'login.title': 'Sign in',
    'login.subtitle': 'For reps visiting clinics on MyClinicSoft. We’ll text a code to your mobile.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.missingFields': 'Enter your email and password.',
    'login.newRep': 'New rep?',
    'login.register': 'Create an account',
    'login.phone': 'Mobile number',
    'login.phoneHint': 'The number you verified when you signed up, e.g. 0917 123 4567',
    'login.sendCode': 'Text me a code',
    'login.badPhone': 'Enter a mobile number like 0917 123 4567.',
    'login.or': 'or use your email and password',
    'login.signInPassword': 'Sign in with password',

    'code.title': 'Enter your code',
    'code.subtitle': 'If {phone} is the verified number of a rep account, a 6-digit code is on its way.',
    'code.signIn': 'Sign in',
    'code.changeNumber': 'Use a different number',
    'code.noText': 'No text? Only numbers verified at sign-up get codes. Use your email and password instead.',
    'inactive.usePassword': 'To pay the activation fee, go back and sign in with your email and password.',

    // Refusals (sign-in codes in MOBILE_API.md)
    'setup.title': 'Set your password first',
    'setup.message': 'Open the invite email to set your password, then sign in here.',
    'inactive.title': "Your account isn't active yet",
    'inactive.message': 'Your account turns on once the activation fee is paid. Pay it now, or contact support if you think this is a mistake.',
    'inactive.support': 'Contact support',

    'twoStep.title': 'Enter your code',
    'twoStep.subtitle': 'Open your authenticator app and type the 6-digit code for MyClinicSoft.',
    'twoStep.verify': 'Verify',
    'twoStep.expiresIn': 'This sign-in expires in {time}',
    'twoStep.expiresInA11y': 'This sign-in expires in {minutes} minutes {seconds} seconds',
    'twoStep.expiredTitle': 'Sign-in timed out',
    'twoStep.expired': 'The code has to be entered within 5 minutes. Sign in again to get a new chance.',

    'notify.title': 'Know when clinics answer',
    'notify.subtitle': 'Turn on notifications so you never have to call a clinic to ask.',
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

    'band.login': 'Mag-book ng pagbisita sa clinic habang nasa daan, at malaman agad kapag sumagot ang clinic.',
    'band.register': 'Ang mga pagbisita mo sa clinic, produkto at deliveries, nasa iisang app.',

    'login.title': 'Mag-sign in',
    'login.subtitle': 'Para sa mga rep na bumibisita sa mga clinic sa MyClinicSoft. Magte-text kami ng code sa mobile mo.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.missingFields': 'Ilagay ang email at password mo.',
    'login.newRep': 'Bagong rep?',
    'login.register': 'Gumawa ng account',
    'login.phone': 'Mobile number',
    'login.phoneHint': 'Ang number na na-verify mo noong nag-sign up ka, hal. 0917 123 4567',
    'login.sendCode': 'I-text sa akin ang code',
    'login.badPhone': 'Maglagay ng mobile number gaya ng 0917 123 4567.',
    'login.or': 'o gamitin ang email at password mo',
    'login.signInPassword': 'Mag-sign in gamit ang password',

    'code.title': 'Ilagay ang code mo',
    'code.subtitle': 'Kung ang {phone} ang na-verify na number ng isang rep account, papunta na ang 6-digit na code.',
    'code.signIn': 'Mag-sign in',
    'code.changeNumber': 'Gumamit ng ibang number',
    'code.noText': 'Walang text? Ang mga number lang na na-verify sa sign-up ang nakakatanggap ng code. Gamitin na lang ang email at password mo.',
    'inactive.usePassword': 'Para mabayaran ang activation fee, bumalik at mag-sign in gamit ang email at password mo.',

    'setup.title': 'I-set muna ang password mo',
    'setup.message': 'Buksan ang invite email para i-set ang password mo, saka mag-sign in dito.',
    'inactive.title': 'Hindi pa aktibo ang account mo',
    'inactive.message': 'Mao-on ang account mo kapag nabayaran na ang activation fee. Bayaran ito ngayon, o kontakin ang support kung sa tingin mo ay mali ito.',
    'inactive.support': 'Kontakin ang support',

    'twoStep.title': 'Ilagay ang code mo',
    'twoStep.subtitle': 'Buksan ang authenticator app mo at i-type ang 6-digit na code para sa MyClinicSoft.',
    'twoStep.verify': 'I-verify',
    'twoStep.expiresIn': 'Mag-e-expire ang sign-in na ito sa loob ng {time}',
    'twoStep.expiresInA11y': 'Mag-e-expire ang sign-in na ito sa loob ng {minutes} minuto at {seconds} segundo',
    'twoStep.expiredTitle': 'Nag-time out ang sign-in',
    'twoStep.expired': 'Kailangang ilagay ang code sa loob ng 5 minuto. Mag-sign in ulit para sa bagong pagkakataon.',

    'notify.title': 'Malaman agad ang sagot ng clinic',
    'notify.subtitle': 'I-on ang notifications para hindi mo na kailangang tumawag sa clinic para magtanong.',
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

# eMedRoute

eMedRoute (by MyClinicSoft) is the mobile app for pharmaceutical and medical-device representatives who visit clinics on
MyClinicSoft: book visits in a clinic's rep hours, keep a visit log, carry product sheets, and
(for managers) see the team's visits.

- **Backend:** `../clinic-management` (not changed from here). The contract is
  `../clinic-management/MOBILE_API.md` → "Medical representative app"; route handlers are under
  `app/api/medical-representatives/`.
- **Sibling app:** `../clinic-management-mobile` (eMCR, the patient app). Its plumbing was copied
  here on purpose (no shared package yet): `lib/api.ts`, `storage.ts`, `push.ts`,
  `offlineCache.ts`, `useApiData.ts`, `usePaginatedList.ts`, `i18n`, `theme.ts`, `format.ts`, and
  `components/ui.tsx`, `ErrorState`, `OfflineBanner`, `AppHeader`, `auth.tsx`, `LanguagePicker`,
  `NotificationResponder`.

## Stack

Expo SDK 57, React Native 0.86, Expo Router, TypeScript (versions match eMCR). Expo has changed:
read https://docs.expo.dev/versions/v57.0.0/ before using an Expo API.

## Run

```sh
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL: your machine's LAN IP on a phone, e.g. http://192.168.1.20:3000
npm start
npm run typecheck
npm run lint    # Expo's ESLint config (eslint.config.js)
npm test        # Jest with jest-expo: pure logic and hooks, __tests__/*-test.ts
```

The React Compiler lint rules are off in `eslint.config.js`: the app doesn't use the compiler.

Push needs a development build (`eas build --profile development`), not Expo Go on Android, and an
EAS project id: `eas init` is still required (it writes `extra.eas.projectId` to `app.json`); until
then the app can't get a push token.

### Local backend

`pnpm dev` in `../clinic-management` with the local MongoDB in Docker. Never point the app at
production while developing.

A local test rep exists in the Docker database (created by hand for phase 1, not by a script):
`rep1@my-clinic.dev` and `rep2@my-clinic.dev`, both `Kestrel-Harbor-42`, company "Dev Pharma Inc.". Booking tests (phase 3)
also need a clinic with rep visiting hours on: `/medical-reps` → Visiting hours at
`my-clinic.localhost:3000` (admin `admin1@my-clinic.dev` / `devpassword`).

## Separate from eMCR on the same phone

A rep can also be a patient. This app has its own bundle id (`solutions.myclinicsoft.emedroute`),
scheme (`emedroute`), icon (the mark on navy), SecureStore keys (all `rep_…`), offline
cache folder (`rep-offline`) and push registration (`/api/medical-representatives/devices`).

## Decisions to keep in mind

- **Plan:** booking with clinics and recording deliveries need a rep plan (or a team seat); the
  visit log and products stay free. Both use the server's `repBookingAccess` and answer
  `402 SUBSCRIPTION_REQUIRED`; the app shows the same state from `/subscription` →
  `canBookClinics`.
- **Clinic sponsorship:** a rep can pay for a clinic's MyClinicSoft plan (Professional,
  ₱2,500/month with 5/10/15 % off for 3/6/12 months; prices come from the server). Unlike the rep
  plan, the app opens the PayMongo checkout URL from `POST /sponsorships/[id]/checkout` in an
  in-app browser session (`expo-web-browser` `openAuthSessionAsync`); PayMongo's success/cancel
  page sends the browser back to `emedroute://sponsorships` (the `returnUrl` in the
  request). Screen: `app/(app)/sponsorships.tsx`.
- **Export compliance:** `ITSAppUsesNonExemptEncryption` is `false`. The app's only own
  encryption (XChaCha20-Poly1305 in `lib/offlineCache.ts`) protects the rep's own data on the
  phone, and the network uses Apple's HTTPS; both fall under Apple's exemptions. Revisit it if
  the app ever encrypts anything else.
- **`react-dom`** stays: Expo Router expects it, and it never reaches the phone bundle.

## Layout

```
app/(auth)/        login, two-step (authenticator code), enable-notifications
app/(app)/(tabs)/  home, visits, clinics, products, more
app/(app)/         visits/[id] (+ edit, move), visits/log, clinics/[id]/book, products/[id], products/new,
                   plan, team (+ visits), profile, settings,
                   change-password, support
lib/               api (Bearer + single-flight refresh), auth, push, storage, i18n, types,
                   visits (status rules + lists), products, dashboard, undo (delete + Undo)
components/        shared UI; forms.tsx, pickers.tsx (native date/time, chips, segments),
                   StatusPill, VisitRow, NextVisitCard, ProductCards, Snackbar, Loading
scripts/           generate-brand.mjs (npm run brand)
```

## Build phases

1. **Foundation** (done): sign-in with two-step code, token refresh, device registration,
   Profile, Settings, Support.
2. **Own work** (done): Home, Visits with the own log, Products, offline cache, reminder push routing.
3. **Clinic booking** (done): Clinics, slot sheet, request/move/cancel, visit pushes.
4. **Teams and plan** (done): Team screens, manager view, Plan status, the paid-booking gate.

## Payments

Two payments open PayMongo's checkout page in the browser from inside the app (an
`expo-web-browser` auth session that returns to the app's link):

- the **activation fee** at sign-up (`lib/onboarding.ts`, `app/(auth)/activation.tsx`), and
- **clinic sponsorships** (`lib/sponsorships.ts`, `app/(app)/sponsorships.tsx`).

Only `https://*.paymongo.com` URLs from the server are opened. The rep plan and team seats are not
sold in the app: Plan shows status and prices from `GET /subscription`, and "Ask for a payment
link" opens a prefilled billing support request (the backend's `/subscription/checkout` and
`/team/checkout` are not called).

**Open item, app-store policy:** whether App Store / Play allow taking these payments through an
external PayMongo page (rather than in-app purchase) has not been settled. Check before
submitting to the stores.

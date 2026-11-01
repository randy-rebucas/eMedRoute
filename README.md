# MyClinicSoft Rep

Mobile app for pharmaceutical and medical-device representatives who visit clinics on
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
```

Push needs a development build (`eas build --profile development`), not Expo Go on Android, and an
EAS project id (`eas init` has not been run for this app yet).

### Local backend

`pnpm dev` in `../clinic-management` with the local MongoDB in Docker. Never point the app at
production while developing.

A local test rep exists in the Docker database (created by hand for phase 1, not by a script):
`rep1@my-clinic.dev` and `rep2@my-clinic.dev`, both `Kestrel-Harbor-42`, company "Dev Pharma Inc.". Booking tests (phase 3)
also need a clinic with rep visiting hours on: `/medical-reps` → Visiting hours at
`my-clinic.localhost:3000` (admin `admin1@my-clinic.dev` / `devpassword`).

## Separate from eMCR on the same phone

A rep can also be a patient. This app has its own bundle id (`solutions.myclinicsoft.rep`),
scheme (`myclinicsoft-rep`), icon (the mark on navy), SecureStore keys (all `rep_…`), offline
cache folder (`rep-offline`) and push registration (`/api/medical-representatives/devices`).

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

## Paying for a plan

The app never sells anything (App Store / Play payment rules): Plan and team seats show status and
prices from `GET /subscription`, and "Ask for a payment link" opens a prefilled billing support
request. The backend's checkout endpoints (`/subscription/checkout`, `/team/checkout`) are not
called. When the web has a page where a rep can pay, point those buttons at it instead.

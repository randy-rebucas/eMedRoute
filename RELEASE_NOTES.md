# eMedRoute release notes

## 1.0.2

Fixes from the 2026-11-15 standards audit: account deletion inside the app, a crash screen and
crash reports, a not-found screen, an update check, no more duplicate saves after a timeout,
unsaved-work warnings, double-tap protection, and accessibility and keyboard fixes.

**Deploy the backend first** (clinic-management `main` with PR #52), then run
`pnpm prod db:indexes --apply`: the new IdempotencyKey collection needs its unique and expiry
indexes. New routes: `GET /api/medical-representatives/app-config` (public),
`POST /api/medical-representatives/client-errors` (public, rate-limited),
`GET`/`POST /api/medical-representatives/profile/deletion-request`. On an older backend the
delete-account screen shows its error state, the update check does nothing and crash reports are
dropped; everything else works.

**Server settings:** set `EMEDROUTE_MIN_VERSION` and `EMEDROUTE_LATEST_VERSION` to turn on the
update check, and optionally `EMEDROUTE_IOS_STORE_URL` once the app is on the App Store (Android
falls back to the Play Store listing).

**Native config changed, so this needs a new store build, not an over-the-air update:**
- **iPad is now off** (`supportsTablet: false`): the app runs as an iPhone app on iPads. If an iPad
  build was ever published, put it back instead.
- The Android "draw over other apps" permission (`SYSTEM_ALERT_WINDOW`) is blocked.
- The unused Face ID usage text is gone from the iOS build.

### Store privacy declarations (update before submitting)

Crash reports are new. Each one carries only the error, the screen path, the app version and the
OS version: no account data and no screen contents. They are written to the server log, not stored.
- **Google Play, Data safety:** declare **App info and performance > Crash logs** as collected.
  Purpose: App functionality / Analytics. Not shared. Not linked to identity. Encrypted in transit.
- **Apple, App Privacy:** add **Diagnostics > Crash Data**, not linked to the user, not used for
  tracking.
- **Account deletion:** in Play Console (Data safety) and App Store Connect, the in-app path is
  Settings → Delete account; the web URL stays `https://www.myclinicsoft.solutions/delete-account`.

### Google Play "What's new" (under 500 characters)

```
• Ask for account deletion right in the app (Settings → Delete account)
• No more duplicate visits or deliveries when the connection drops while saving
• Leaving a form with typed changes now asks first
• Clear message when a visit or product was removed
• After signing in again, you're back where you were
• Easier to use with screen readers and large text
• Bug fixes and improvements
```

### Full notes

- **Account:** Settings → Delete account now files a deletion request in the app (reviewed by a
  person, finished within 30 days of confirming it's you) and shows its status and reference. It used
  to open an email form.
- **Reliability:**
  - A crash screen with Try again instead of a closed app; crashes are reported to the server log.
  - A not-found screen for old or mistyped links.
  - A required/optional update check.
  - Creating a visit log, a booking, a delivery or a product sends a one-time request key, so a resend
    after a timeout returns the first save instead of making a second one.
  - After a session expires, signing in again returns the same rep to the screen they were on.
  - Signing out clears the notification tray and the app badge.
  - The sign-up security check can no longer hold sign-up forever.
- **States:**
  - Visit and product screens say "no longer exists" for a deleted record instead of a retry that can't work.
  - Book and Move offer Try again when offline instead of saying the clinic is gone.
  - A failed refresh shows a banner when older data is still on screen.
  - Deliver shows an error with retry when products fail to load, instead of "No products".
- **Forms:**
  - Log, Deliver, AI notes, visit notes and the clinic access request ask before discarding typed text.
  - A support reply survives collapsing its row.
  - Double taps can't send twice (payments, password, support, team, AI, delete).
  - Next on the keyboard moves through sign-in, sign-up and change-password fields.
  - The keyboard no longer covers fields (offsets follow the real header height; support replies on iOS).
- **Notifications:** a support notification opens that request.
- **Sharing:** the referral link no longer appears twice on iOS.
- **Accessibility:**
  - 44pt touch targets on the password eye, Change photo and the shelf-life "Show" link.
  - Buttons keep their name for screen readers while loading.
  - Withdraw and Cancel delivery say which clinic and delivery they apply to.
  - Two English-only strings are now translated.
  - The booking-sent band grows with large text.
- **Design:** every font size now comes from one named scale (`textSize`) and the screen dim colour
  is a theme token. Nothing should look different.

Filipino strings added in this release need a native speaker's review.

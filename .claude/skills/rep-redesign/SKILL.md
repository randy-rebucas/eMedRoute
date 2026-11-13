---
name: rep-redesign
description: Redesign eMedRoute (the medical-rep mobile app, Expo/React Native) screen by screen, so each screen stops looking generic or AI-made. Keeps the teal/navy tokens and adds bundled stock photos, charts drawn from real data, and real fixes. Use when the user says "next screen", "continue the mobile redesign", "redesign the <X> screen/tab" in the rep app, or invokes /rep-redesign [screen].
---

# eMedRoute redesign: one screen per run

You are redesigning the rep app (`clinic-management-rep`, Expo SDK 57, RN 0.86, expo-router) one screen at a time. Home was the first screen done (2026-11-13) and is the reference. Each run takes **one screen** (the one the user names, or the next in the queue at the bottom; say which you picked). The goal: correct, specific to a pharma rep's field day, with photos and charts only where they help.

**Argument:** a screen, e.g. `visits`, `clinics`, `products`, `visits/[id]`, `plan`. With no argument, take the next queue item.

## 0. Before touching anything

1. Read `AGENTS.md`: Expo has changed, so check https://docs.expo.dev/versions/v57.0.0/ before using any Expo API you aren't sure of.
2. Load the `dataviz` skill before writing any chart.
3. Read the tokens and primitives, and reuse them instead of inventing new ones:
   - `lib/theme.ts` (colours, spacing, radius): **the colours are fixed**. Never add a hex outside this file; if a new token is truly needed, add it there with a comment saying why.
   - `lib/typography.ts` (`type` scale, `mono`), `components/ui.tsx` (`Card`, `Button`, `IconTile`, `SectionHeader`, `screenStyles`).
4. Read the reference implementations from Home:
   - `components/Photo.tsx`: `photos` registry + `ScrimPhoto` (photo under a navy gradient, decorative, text sits on the dark foot).
   - `components/WeeklyVisitsChart.tsx`: stacked bars built from Views, tap-to-inspect readout, average rule, legend, accessibility label per column.
   - `components/MonthLedger.tsx`: SVG completion ring + ruled ledger rows with amber flagged counts.
   - `components/NextVisitCard.tsx`: the navy hero (solid fill, no shadow).
   - `app/(app)/(tabs)/home.tsx`: how they compose.
5. i18n: every string lives in `lib/i18n/strings/<area>.ts` with **both `en` and `fil`**. Plurals are `{ one, other }` in English; Filipino usually takes one plain string. `t()` keys are typed, so a computed key like `` `home.${x}` `` fails typecheck. Branch to literal keys instead.

## 1. Audit the screen (function first)

Read the screen, its components, its `lib/*` data hook and the backend route it calls (`../clinic-management/app/api/medical-representatives/...`). List the defects before styling anything. Look for:
- counts or labels that don't match what the API returns (e.g. counting cancelled visits);
- loading, empty and error states that are missing, or shown at the same time;
- offline handling: `useApiData(..., { offline: true })` screens must still read correctly from the cached copy (stale days, pending deletes via `usePendingDeletes`);
- dead taps, controls that do nothing, tap targets under 44pt;
- text smaller than 12, or text not translated into `fil`.

Fix the cause at the narrowest level. If the screen needs data the API doesn't send (Home needed `weeklyVisits`), extend the backend route in `../clinic-management` on its own branch:
- use aggregation and existing indexes, scoped by `rep.ownerFilter`;
- add a vitest in `__tests__/api/medrep-*.test.ts`;
- make the field **optional** in `lib/types.ts`, and have the app hide that part when the field is missing, so either side can deploy first.

## 2. Design the screen

What makes it read as designed rather than generic:
- **Specific to the job.** Write copy in the rep's words ("Waiting on a clinic", "3 stops today · first at 09:30"). Lead with the one thing the rep came to the screen for.
- **No tile grids of equal boxes.** Prefer one ruled card (ledger rows with hairlines), a navy hero for the single most important item, and a photo where the screen has a mood or an empty state.
- **Photos** (see "Adding a photo" below). Use them for: a screen's top band, shortcut cards, and empty states. Not behind lists or forms. At most 2–3 per screen. Always use `ScrimPhoto` so the text sits on near-solid navy; raise `top`/`bottom` opacity if any text crosses a light part of the photo.
- **Charts** only when they answer a question the rep has on that screen. Examples:
  - Visits: per-clinic visit frequency, or days since the last visit.
  - Clinics: when each clinic's rep hours fall in the week.
  - Products: an expiry timeline.
  - Plan: usage against the plan limit.

  Build them from RN Views (bars, meters) or `react-native-svg` (rings, lines). No chart library.

  Every chart needs: a legend if it has 2 or more series, a readout line that updates on tap, an `accessibilityLabel` on each tappable mark, one axis, and figures in text colours (never the series colour).
- **Chart colours:** reuse the validated pair, `colors.accent` `#0EA5A4` (completed / primary series) with `colors.slate` `#4A6684` (secondary). It passes CVD ΔE 15.6 and normal-vision 17.9. It fails the validator's chroma floor because the brand colours are muted; that is accepted on purpose. For any new set, run `node <dataviz>/scripts/validate_palette.js "<hex,...>" --mode light` and fix any FAIL except chroma. Amber (`warning`/`warningSoft`) means "needs attention" only; red only for destructive actions.
- **Type:** use `mono` only for bare counts and dates. On Android, monospace spreads out sentences, decimals ("4 . 9") and clock times ("14 : 30"). For times, decimals and figures inside sentences, use `fontVariant: ['tabular-nums']` on the normal face.
- **Surfaces:** cards are `surface` + 1px `border` + `radius.lg`; no shadows, no gradients except the photo scrim.

### Adding a photo

1. Find free photos on Unsplash with the free licence filter, e.g. WebFetch `https://unsplash.com/s/photos/<topic>?license=free` and ask for the exact `images.unsplash.com/photo-<id>` ids. **Skip Unsplash+ (`plus.unsplash.com`)**: it's paid.
2. Download candidates into a fresh scratchpad folder, at `?fm=jpg&q=85&w=1400`.
3. Look at them before choosing. They should show a pharma rep's world (clinics, doctors, products, driving, notes). Avoid obvious foreign signage and cheesy staged poses.
4. Process into the app:
   `node .claude/skills/rep-redesign/scripts/process-photo.mjs <src.jpg> <name> <width> <height> [position]`
   This crops, desaturates 20% and writes `assets/photos/<name>.jpg`. Keep each file under ~60 KB: 1080×640 for a band, 640×440 for a tile.
5. Register the photo in `photos` in `components/Photo.tsx`, and add its source URL to `assets/photos/CREDITS.md`.

## 3. Verify

```bash
npx tsc --noEmit          # clean
npx expo lint             # clean
npx jest                  # all pass
# backend, if touched (in ../clinic-management):
npx vitest run __tests__/api/medrep-<name>.test.ts
```

Then **look at it** on the Android emulator. In earlier runs Metro (`:8081`), `next dev` (`:3000`) and an emulator were usually already running; check before starting anything.

```bash
export MSYS_NO_PATHCONV=1                              # Git Bash mangles /sdcard paths otherwise
adb devices
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml | grep -o 'text="[^"]\+"'   # what's on screen
adb exec-out screencap -p > <scratchpad>/shot.png     # then Read it
adb shell input swipe 540 1900 540 700 400            # scroll
adb shell input tap <x> <y>                           # tap a chart mark
```

`sleep` is blocked, so wait by looping on `uiautomator dump` until expected text appears.

The local test rep may have no data. To see charts or counts, **copy the screen file to the scratchpad first**, inject sample values marked `// PREVIEW`, screenshot, then restore the copy. Grep afterwards for `PREVIEW` to prove it's gone. Never insert fake rows into the database for this.

Check both an empty account and one with data. Check that text over photos is readable and that nothing collides. If the emulator isn't available, say plainly that the screen was not seen rendered.

## 4. Report

Lead with what changed for the rep on that screen, then:
- bugs fixed, each with its symptom;
- the new layout;
- photos used, with their Unsplash links (the user needs the sources);
- charts and why each is there;
- wording changes (en + fil);
- backend changes, and the deploy order;
- what wasn't verified.

Nothing is committed unless the user asks. Work on a branch (`feat/<screen>-redesign` in the app, `feat/rep-<thing>` in the backend). Update the **Progress** list below at the end of every run.

## Traps already hit

- `StyleSheet.absoluteFillObject` no longer exists in RN 0.86; use `StyleSheet.absoluteFill`.
- Node ESM can't import `C:/...` paths directly; use `createRequire('<repo>/package.json')('sharp')` (the bundled script already does this).
- Don't repeat an action on the same screen. Home's empty state first had a "Book a clinic" button, and the same shortcut was right below it.
- An unlinked visit may have no `clinicLocation`, so `todaysStops` (route) can be fewer than today's visits. Count visits for wording, and stops only for the route.
- Python patch scripts with `assert old in s` catch CRLF and whitespace mismatches before they silently do nothing.
- List filters use `FilterChips` (one scrolling row, bleeds to the edge on its own); `ChoiceChips` is for forms and wraps onto two rows.
- A header `gap` counts empty children: wrap `ThinProgress` + `OfflineBanner` and render them only when `stale || offline`.
- A chart that hides itself at zero must not be the only way out of its filter. Give the filtered empty state a "show all" action.
- Plural messages (`{ one, other }`) aren't `PlainKey`s: a lookup table of keys won't typecheck; use a `switch` returning `t('literal.key', { count })`.
- Expiry/visit dates are UTC midnights of a day: compare against the start of today in Manila (`parseVisitDay(localNow('Asia/Manila').day)`), never `new Date()`, or "expires today" lands in "expired".
- Android alert buttons render in capitals ("CANCEL"): match `text="CANCEL"` when tapping them through uiautomator.
- Don't load data on a screen just to decorate a row if the GET has side effects (the referral GET mints a code).
- `RepProfile.title` is an honorific (Mr., Ms., Dr.), max 20 chars: never present it as a job title.
- Android alerts hold three buttons at most: use a bottom sheet (`Modal`) for four or more choices.
- jest.mock factories may only use outer variables named `mock…`.
- Testing a picker on the emulator: `adb push` an image to /sdcard/Pictures, broadcast MEDIA_SCANNER_SCAN_FILE, and expect Expo Go's "choose which photos" step (tap Done) before the crop screen (CROP). Remove the test image afterwards.
- Expo Router 57 vendors React Navigation: hooks like `usePreventRemove` import from `expo-router/react-navigation`, not `@react-navigation/*` (not installed).
- Fast Refresh keeps `useState` initialisers: after changing how a screen picks its first value, leave and reopen the screen before judging it.
- A full Metro reload resets the app to Home. Re-navigate (tab bar y≈2220 on the 1080×2400 emulator) before screenshotting.

## Progress

Done:
- `home` (2026-11-13): photo greeting band (time-of-day greeting, today's stops line, territory tag), photo shortcuts, photo empty state, `MonthLedger`, `WeeklyVisitsChart`; backend `weeklyVisits` on `/api/medical-representatives/dashboard` (branch `feat/rep-home-trend`). App branch `feat/home-redesign`.
- `visits` tab (2026-11-13):
  - Upcoming: `WeekStrip` (next 7 days, a block per visit, tap a day to filter), list grouped by day (`SectionList`, `VisitRow inDay`: time first, one ruled card per day), photo empty state (`onTheRoad`).
  - Past: `OutcomeBar` (Done / Not seen / Cancelled / Never closed, a validated 4-colour set, doubles as the filter), date chips moved to `FilterChips`.
  - Home's ring now opens Past · This month · Done.
  - Backend (`feat/rep-visits-summary`): `summary=1` outcome counts on GET `/visits`; the past sort now orders by time within a day.
  - App branch `feat/visits-redesign` (stacked on the Home work).
- `clinics` tab (2026-11-13):
  - Photo band (`clinicSign`) with "n clinics take your visits · n due a visit", counted only when the whole bookable list is loaded and unfiltered.
  - `ClinicRow`: history chip (booked next, teal / due after 30 days, amber / last seen, neutral; never visited is due only for linked clinics), rep hours as a Monday-first week (tap a day to read it; "Next rep hours" by default; `nextHours` in `lib/clinics.ts`), navy monogram for linked clinics, Leave beside Book. Directory cached offline.
  - Backend (`feat/rep-clinics-coverage`): `lastVisit` / `nextVisit` per clinic on GET `/clinics` (one aggregation, bookings + linked log entries).
  - App branch `feat/clinics-redesign`. Tests: `__tests__/clinics-test.ts`.
- `products` tab (2026-11-13):
  - `ShelfLifeChart`: active products by days left (Expired / ≤30 / ≤90 / ≤180 / Later), tap to read, "Show them" opens Expiring. Red/amber fail CVD as a pair; accepted because each column is named on the axis and the two urgent ticks carry icons.
  - Search (name, maker, category; `lib/useDebounced.ts` now shared with Clinics), Expiring filter with count, catalog A–Z, rows as one ruled card with a one-year shelf-life meter and words instead of badges, photo empty state (`blisterPack`).
  - Home's expiring row opens Expiring and now counts already-expired stock too ("expired or expiring in 30 days").
  - Backend (`feat/rep-products-expiry`): GET `/products` adds `search`, `expiring=1`, `sort=name|expiry|newest`, `summary=1` (`expiry` buckets on Manila days); dashboard count includes expired.
  - App branch `feat/products-redesign`.
- `profile` (2026-11-13): navy hero with a 112 px picture (camera badge; tap for a sheet: Take a photo / Choose from your photos / Remove photo), honorific + name, company, territory; ruled cards for Contact (email locked with its note), About you (empty state links to Edit), Account dates; cached offline.
  - Picture upload: `lib/avatar.ts` `pickProfilePhoto` (expo-image-picker, square crop, expo-image-manipulator to 512 px JPEG q0.75, ~30 KB data URI) → existing PUT `/profile` `profileImage`. `components/Avatar.tsx` (photo or initials; `initialsOf` lives here now) used by AppHeader, More and Profile; the rep summary carries `profileImage` and is refreshed from `/session` right after sign-in.
  - New native deps (`expo-image-picker`, `expo-image-manipulator`, plugin text in app.json): needs a new store build, not an OTA update. Tests: `__tests__/avatar-test.ts`. No backend change. App branch `feat/profile-redesign`.
  - Also fixed on More: `title` is an honorific (Mr./Dr.), shown before the name, not as a job beside the company.
- `more` tab (2026-11-13): navy profile hero (avatar, title · company, territory, "Booking covered / needs a plan" chip, View profile; the duplicate Profile row is gone), every row carries its status line (`NavRow valueTone`: amber needs-you / teal all-set) from cached hooks: team invite or team, plan cover, sponsorships waiting/active, open support requests, language. Sign out now confirms. App version at the foot. The referral code is deliberately not fetched here (GET creates one). No photo, no backend change. App branch `feat/more-redesign`.

- `settings` (2026-11-13): navy hero answers "will clinic answers reach this phone?" from the account switch + the phone's OS permission (`pushState` in `lib/push.ts`: off / checking / on / ask / blocked / unavailable), with the one fix inline (Allow notifications, or Open phone settings); a ruled card of what push carries (clinic answers, day-before reminders, deliveries, expiring stock, access/team, sponsorships), retitled "What you miss while they're off" when off. Email switch removed: the backend never reads `emailNotifications` (reps get only account email). Sign out on this phone now confirms; offline banner + pull to refresh; load error shown when there's no saved copy. No photo, no chart, no backend change. App branch `feat/settings-redesign`.
- `visits/[id]` + `deliver`, `move`, `edit`, `log` (2026-11-13):
  - Detail: navy hero like Home's next visit (status, clinic, day, tabular time, place, next step + who acts, Directions only for a visit still ahead, Move hidden once checked in); clinic's words as a quote; `VisitProgress` stepper for bookings (`visitProgress` in `lib/visits.ts`: requested → approved → checked in → done with API times, ring = now, slate cross = ended early); "About the visit" ruled card with products as ≥48pt rows; private notes written in place (`saveVisitNotes`: `{ notes }` for bookings, even closed; whole entry for own logs); deliveries; Edit / Cancel / Delete at the foot.
  - Fixes: bookings had no way to write notes after the call (closedCantMove even said "only your notes can" change); Directions on last week's open visit; Move offered after check-in (would undo it); product links were inline text under 44pt; error banner far from the button that failed.
  - Sub-screens: Move's dead ends say "Go back" (`ErrorState actionLabel`, optional) and block checked-in visits; the current slot sits in a ruled card. Deliver's clear-expiry button read the hint ("Leave empty to…") as its label, now "Clear batch expiry". Log form: save error moved next to Save (was off screen at the top); a saved length that isn't a chip (e.g. 20 min) now shows as selected (`durationsWith`).
  - No photo (detail is data + actions; forms take none), no backend change. Tests in `__tests__/visits-test.ts`. App branch `feat/visit-detail-redesign`.
- `clinics/[id]/book` (2026-11-13): navy clinic hero (name, place, `clinicHistory` chip: booked next / due / last seen), the clinic's instructions as a quote, three numbered steps (day → time → purpose; the number turns into a teal tick once answered), time step captioned with that day's rep hours (`hoursOn` in `lib/clinics.ts`), footer summary "Sat, Nov 14 · 15:30 · 30 min" in tabular figures.
  - Fixes: the sheet opened on today after the clinic's hours had ended ("No slots left") — it now opens on `nextHours`' day; no plan was only discovered after typing and tapping Send — an amber "needs a plan" card with See plans shows up front (cached `useSubscription`); a same-day booking was only refused by the server — `clinic.nextVisit` on the chosen day now warns first; backing out or swiping down silently dropped a typed purpose — `usePreventRemove` (from `expo-router/react-navigation`) asks Discard / Keep editing; slot times used monospace and read "15 : 00" on Android (shared `SlotGrid`, Move benefits); Sent put a monospace time inside a sentence.
  - Sent state: photo band (`requestSent`, open planner), `VisitProgress` showing "The clinic answers · Now", and if push won't reach this phone (`pushState`), an amber line to check Visits; See visit + Done.
  - No chart (seat counts already sit on each slot), no backend change. Tests: `hoursOn` in `__tests__/clinics-test.ts`. App branch `feat/booking-redesign`.
- `products/[id]` + `edit`, `new`, `import` (2026-11-13):
  - Detail: navy hero (dosage-form icon, status chip, name, strength · maker; expiry date in tabular figures, days left as words or an amber/red chip, a one-year shelf-life meter like the catalog rows; inactive products say they aren't offered at visits or deliveries); "Product sheet" ruled card (description, category, dosage, packaging, pack size); `HoldingsChart` "Where it is" (one bar per clinic and unit, received teal / waiting slate, the validated pair; bars compare within a unit, `holdingShares`; summary "At 3 clinics · 36 boxes received · 14 waiting" only when one unit, `holdingTotals`; tap a clinic for "8 boxes waiting for the clinic · Last Nov 12"); Edit / Delete.
  - Fixes: counts used monospace inside sentences ("24 boxes received"); a failed deliveries load hid the section silently (now "Couldn't load where this product went. Try again"); Delete was greyed offline with no reason (now says it needs a connection); pull-to-refresh didn't refresh deliveries.
  - `ProductSheetCard` / `ExpiryBadge` removed from `ProductCards.tsx` (detail was the only user).
  - Form (`ProductForm`, new + edit): save error moved next to Save (was off screen at the top); a "Fill in the fields marked above" line by Save when required fields are empty; `usePreventRemove` asks Discard / Keep editing when anything changed (off while saving, so a successful save still leaves).
  - Import: the problem-rows card was red (red is for destructive), now amber on `warningSoft`; "Row 12" off monospace; the preview warns when ready rows have already expired ("3 of these have already expired…").
  - No photo (data + forms), no backend change. Tests: `holdingTotals` / `holdingShares` in `__tests__/visits-test.ts`. App branch `feat/product-detail-redesign`.
- `plan` (2026-11-13): `PlanHero` (in `components/PlanCard.tsx`, replaces `PlanCard`; `seatsLine` and now `notCoveredReason` still exported): covered by own plan = navy, "Until Dec 3 · Paid monthly", days-left meter on one paid period (caps at full; amber fill + "Ends soon" in the last 7 days, and Ask to extend turns primary); team seat = navy with a seats meter ("5 of 8 seats taken"); free = navy, no meter; not covered = photo hero (`doctorMeeting`, reused) with the reason. Then, when not covered, a "What needs a plan" ruled card (log / products Free, book / deliver Plan in amber) + "Clinics never pay for rep visits"; "What it costs" ruled card (monthly, yearly with "2 months free" from `yearlyMonthsFree`) + "Paid by debit or credit card."; the ask/extend action; Teams row with the seat price.
  - Fixes: a billing request already open was invisible, so reps could send the same payment-link request again; now "You asked for a payment link on Nov 12 · Reference SR-…" + See your requests (`openBillingRequest`, from the support list GET, no side effects). "Until Nov 3, 2026" was monospace inside a sentence; prices in monospace with decimals; header ThinProgress/OfflineBanner now render only when stale/offline.
  - Payment stays off the app (user decision 2026-11-01): the `/subscription/checkout` route exists but the app doesn't call it.
  - No backend change. Tests: `__tests__/plan-test.ts` (`daysLeft`, `cycleDays`, `yearlyMonthsFree`, `openBillingRequest`). App branch `feat/plan-redesign`.
- `sponsorships` (2026-11-13): navy hero "Paying for 2 clinics · Next to run out: Dr. Santos Clinic, Nov 18 · ₱25,625 paid so far" with amber chips (clinics waiting for you, accepted but unpaid); with no sponsorship at all, a photo hero (`handshake`, reused) carrying the intro. Waiting cards outlined amber (Accept / Decline). Current cards sorted unpaid-or-lapsed first, then running plans soonest to end, then open offers (`sponsorshipGroups`); each running one has a days-left meter against its latest paid term (`sponsorCover`; amber + "Runs out soon" inside the server's 7-day renewal reminder window, `RENEWAL_DAYS`). Prices as one ruled ledger (per-month line only for multi-month terms) + "Paid by debit or credit card…". Earlier sponsorships as short ruled rows ("Ended · Oct 14 · 2 payments · ₱2,500 · 1 refunded").
  - Fixes: Decline was one tap and tells the clinic at once (now confirmed); the money paid was never shown (payments line now "2 payments · ₱20,625", refunds left out, `paidAmount`); every card carried two full-width buttons and Renew was primary even with months left (now primary only when unpaid, lapsed or ≤7 days; End / Withdraw are red text actions, ≥44pt); prices were a grid of equal tiles in monospace with decimals (now tabular figures); header progress/offline rendered when not stale.
  - No chart beyond the per-card meter (a separate chart would repeat it), no backend change. Tests: `__tests__/sponsorships-test.ts`. App branch `feat/sponsorships-redesign`.
- `referral` (2026-11-13): the code leads on navy (normal face with tabular figures, not mono: monospace spread "REP - R8MWD8", which reads as a space; the server's alphabet has no 0/O/1/I/L), the link, Share signup link, "Hold the code or link to copy it" (no clipboard dep: `selectable` text). "How a clinic uses it" ruled card with 3 numbered steps (sign up with the link or enter the code on billing → added to its reps and joins your Clinics → either can offer a sponsorship), checked against `lib/rep-referral.ts`. Clinics that joined as one ruled card with "57 clinics · 2 this month" (`joinedThisMonth` in `lib/referral.ts`, Manila months) and "Showing the newest 50 of 57" past the server's cap; photo empty state (`clinicSign`, reused). Get a new code moved to a red NavRow at the foot.
  - Fixes: Share was disabled offline although the saved code is still the rep's (now works offline; only a new code needs a connection, said in a banner); header progress/offline rendered when not stale; Get a new code sat beside Share as an equal full-width button.
  - No chart (a count and "this month" answer the question), no backend change. Tests: `__tests__/referral-test.ts`. App branch `feat/referral-redesign`.
- `team` + `team/visits` (2026-11-13):
  - Manager: navy `TeamHero` (team name with rename, "You manage · 5 members", "Team plan until Dec 31, 2026" in tabular figures, seats meter via the now-exported `Meter` from `PlanCard.tsx`, amber when over-full with a chip and "Nobody on the team is covered until the seats cover all 5 members", "1 invite waiting for an answer"); `TeamMonthChart` "This month" (one bar per member, busiest first: done = accent, booked-not-done = slate, the validated pair; legend; shared 0…max axis; under each bar "Last done Nov 12" or amber "No completed visit in 24 days" / "No completed visit yet" at `QUIET_DAYS` 14; tap a bar → readout "Ana Cruz: 9 visits this month · 6 completed · 2 approved ahead · 1 waiting on a clinic" plus that member's Visits › and Remove, so the list doesn't repeat names); Team visits NavRow; invite card; pending invites as ruled rows; Team seats card (price, rule, ask for a link) when not free; Leave as a red row.
  - Member: the same hero ("Managed by …") + "What your managers see" ruled card + Leave row. Invite: navy card (chip, inviter, privacy line, Join / Decline; Decline now confirms). No team: photo band (`teamBriefing`), "What a team gives you" ruled card, start form.
  - Team visits: grouped by day like the Visits tab (`byDay` / `dayHeading` moved from the tab into `lib/visits.ts`, now generic), `FilterChips` instead of `ChoiceChips`, a filtered empty state with "Show everyone", header progress/offline only when stale/offline; member rows no longer show the rep-facing next step ("Arrive by 15:30") (`VisitRow`, member rows only).
  - Fixes: member counts used UTC days while Home uses Manila days, and "waiting" counted past-dated requests (a manager's own row disagreed with their Home); Decline was one tap; four equal monospace stat tiles per member; Leave as a full-width outline button; the photo title stretched with `flex: 1` onto the light part of the photo (keep `flex` off text inside `ScrimPhoto`).
  - `TeamMemberRow` deleted (replaced by the chart); unused team strings removed. Helpers `memberMonth`, `daysSinceDone`, `byMonth`, `teamMonth` in `lib/team.ts`, tests `__tests__/team-test.ts`.
  - Backend (`feat/rep-team`): member stats moved to `lib/rep-team-stats.ts` (Manila today/month, waiting from today on, as the dashboard); vitest `__tests__/api/medrep-team-stats.test.ts`. No field change, so either side can deploy first. App branch `feat/team-redesign`.
- `profile/edit`, `change-password`, `support` + `support/new` (2026-11-13):
  - Support list: one ruled card across the FlatList (first/last rows round the corners; separator is a child line, and every row has `borderRadius: 1`, since Android draws a rounded view's border on another path and square middle rows sat 1px off); each row says where it stands from the rep's side (`requestState` in `lib/support.ts`: Support replied = amber, Waiting for support = slate, Resolved = teal, Closed) with "Last Nov 12 · 1 reply" in tabular figures; an amber line up top when support answered something; expanding shows the thread (support's messages on `primarySoft`), the reference, and a **reply box**. Empty state is a ruled card, no photo (none fits; a list).
  - Fixes: the reply email says "Reply from the app if anything is still wrong" but the app had no way to reply (backend route added, below); "Open" was amber although it means the ball is with support (amber now means support replied); dates and the reference in monospace inside sentences.
  - New request: `ChoiceChips` instead of hand-made chips; error and a "Fill in the fields marked above" line next to Send (the error sat at the top, off screen under a long message); `usePreventRemove` asks Discard / Keep editing once something was typed (an untouched Plan/Team prefill leaves silently); the sent state is a ruled card with the reference in tabular figures.
  - Profile edit: starts from the server's copy only (it filled from the phone's saved copy, and the save sends every field, so a stale copy undid newer changes; offline says `common.editNeedsConnection`, like the other edit screens); sections Name / Contact / Work; email shown locked with its note; replacing a verified number warns in amber that sign-in codes go only to the number checked at sign-up (the server clears `phoneVerifiedAt` on a new number, and nothing in the app can verify it again); save error + "fill in" line next to Save; discard prompt.
  - Change password: error next to the button (the keyboard covered it at the top); the done state is a ruled card. No discard prompt on purpose (typed passwords shouldn't linger).
  - Backend (`feat/rep-support`): POST `/api/medical-representatives/support/[id]/replies` (own request only via `ownerFilter`, then the shared `addSupportReply` as requester: reopens resolved/closed, emails the platform team); vitest `__tests__/api/medrep-support-replies.test.ts`. The app's reply box needs it, so deploy the backend first (an older server answers 404 and the box shows the error).
  - `RepProfile.phoneVerifiedAt` added (optional; the server already sends it). Tests: `__tests__/support-test.ts`. App branch `feat/account-forms-redesign`.
- Auth screens (2026-11-13): `AuthBand` in `components/auth.tsx` (photo under the scrim, `BrandLogo tone="onNavy"` at the top, a lead line or title + line on the dark foot; `scrimTop` for light photos). Login: band (`doctorMeeting`) replaces the logo tile, forms unchanged. Register: compact band (`onTheRoad`) on step 1 only. Enable-notifications: band carries the title (`requestSent`, scrimTop 0.7; `visitNotes` was dropped because Home, the next screen, shows it), then `PushBringsRows` (new `components/PushBrings.tsx`, now shared with Settings) instead of its own four-line list, which left out deliveries, sponsorships and clinic access.
  - Fixes: login errors from the password half showed at the top, off screen with the band (`from: 'code' | 'password'` on the failure, shown above that half's button); register's details-step error (incl. the server's "email in use") showed at the top of a long form, now above Continue; two-step's countdown was monospace inside a sentence (`twoStep.expiresIn` now carries `{time}`, tabular figures).
  - `activation` and `two-step` are full-screen states and the code step: audited, no band (a photo there would sit behind a code field or a wait).
  - No new photos, no backend change. App branch `feat/auth-redesign`.

Queue: empty. Every screen has had a run. Not redesigned on purpose: `app/index.tsx` (a 10-line redirect) and the `_layout` files. Open items noted by runs but out of their scope: Deliver form loses typed lines on back; `REP_INACTIVE` on Referral shows a generic error; support-reply push has no `routeForNotification` case.

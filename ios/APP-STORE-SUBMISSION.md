# Vital Kauaʻi — App Store submission checklist

State of the native app as of 2026-07-05, and the remaining steps to ship
to the App Store. The Xcode project lives at `ios/App/App.xcodeproj`.

## Already in place (no action needed)

- Capacitor iOS shell loading the production portal (`capacitor.config.ts`),
  with in-app navigation whitelisted so Supabase auth, Stripe/Square
  checkout, and Vercel domains stay inside the WebView.
- Native Face ID / Touch ID re-entry lock (`@aparajita/capacitor-biometric-auth`,
  wired in `app/portal/layout.tsx` + `components/portal/BiometricGate.tsx`).
- Native journey reminders (`@capacitor/local-notifications`): six
  on-device notifications around each member's journey — one week and
  one day before arrival, then integration check-ins at 3/7/14/30 days
  home (`lib/native-notifications.ts`). Scheduled locally; no push
  server or APNs key needed, so it works ahead of Apple enrollment.
- Brand app icon (italic serif V, cream on forest) — 1024×1024, opaque,
  compiled into the asset catalog.
- Privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`): no tracking,
  UserDefaults access declared, collected data types (name, email, health
  info, member content) linked to identity for app functionality only.
- Export compliance declared in Info.plist (`ITSAppUsesNonExemptEncryption`
  = false — the app uses only standard HTTPS).
- iPhone locked to portrait (matches the PWA manifest); iPad supports all
  orientations.
- Release build verified compiling for device (unsigned) with Xcode 26.3.
- Privacy policy and terms already live on the site: `/privacy-policy`,
  `/terms-of-use` — use those URLs in the listing.
- App Review demo member provisioned in production
  (`applereview@vitalkauai.com`, "Kai Makana": Ceremony Scheduled,
  journey Aug 14 & 16 2026, agreements signed, active contribution).
  Password shared privately; enter it only in App Store Connect.
- Screenshots captured at required sizes, signed in as the demo member:
  `ios/screenshots/` (6 × iPhone 6.9" 1290×2796, 6 × iPad 13"
  2064×2752).
- Listing copy drafted for Rachel's review: `ios/APP-STORE-LISTING.md`.

## One-time setup (requires Rachel/Josh — cannot be done by tooling)

1. **Apple Developer Program enrollment** — decide the enrolling entity:
   - *Organization* (recommended): the App Store "Seller" is the org's
     legal name, and recognized nonprofits (IRS 501(c)(3) in the US) that
     distribute only free apps qualify for a **full fee waiver** ($0/yr
     instead of $99) — select the waiver option during enrollment or
     request it at developer.apple.com/contact/membership-fee-waiver/.
     Requirements: an incorporated legal entity (no DBAs/trade names), a
     free D-U-N-S number (check/request via enroll.apple.com/duns-lookup/;
     ~5 business days to issue + 2 more to reach Apple), a **work email on
     the org's own domain** and a **public website on that domain** —
     the vercel.app subdomain and a gmail address will not pass, so buy
     the org domain first — and an enroller with legal binding authority
     (Rachel as founder). Apple verifies before activating: budget 1–3
     weeks end-to-end.
   - *Individual*: same-day to ~48h and no D-U-N-S, but $99/yr (no waiver
     for individuals), the store shows the individual's personal legal
     name as Seller, and an app can only be transferred to a later org
     account **after** a version has been published — v1.0 would launch
     under the personal name. Guideline 4.2.6 also expects the app to
     ship from the content owner's own account. Fall back to this only if
     launch timing beats everything else.
2. **Sign in to Xcode** — Xcode → Settings → Accounts → add the enrolled
   Apple ID. Then open `ios/App/App.xcodeproj`, select the App target →
   Signing & Capabilities → check "Automatically manage signing" and pick
   the team. (This Mac currently has zero signing certificates; Xcode
   creates them on first automatic signing.)
3. **App Store Connect app record** — appstoreconnect.apple.com → My Apps
   → "+" → New App. Platform iOS, bundle ID `com.vitalkauai.app`
   (register it at developer.apple.com/account/resources/identifiers if
   the picker is empty), name "Vital Kauaʻi", primary language English
   (U.S.), plus an SKU (internal ID — `vital-kauai-ios` is fine). Under
   Pricing and Availability pick the $0 price; a free app needs no Paid
   Applications Agreement and no banking/tax setup. Consider limiting
   availability to the United States at first — EU distribution adds a
   DSA "trader status" declaration (org address published on the listing).

## Build → TestFlight → Review

4. **Archive and upload**: in Xcode, select "Any iOS Device (arm64)" then
   Product → Archive → in the Organizer choose Distribute App →
   **"TestFlight & App Store"** (it auto-bumps the build number and
   cloud-signs — no manual certificates ever needed). Avoid "TestFlight
   Internal Only": builds uploaded that way can never be submitted to the
   store. Bump `MARKETING_VERSION` for each public release. Processing
   after upload typically takes 5–30 minutes; because export compliance
   is pre-answered in Info.plist, the build is usable the moment
   processing finishes.
5. **TestFlight first**: internal testers must be App Store Connect team
   users (add Rachel + Josh under Users and Access, then TestFlight →
   Internal Testing group). Internal builds need no beta review — they're
   testable immediately. Run the real flows on device: login, Face ID
   re-entry, portal navigation, a payment page, video playback.
6. **Screenshots**: exactly two sets are required — one 6.9" iPhone set
   (1290×2796 or 1320×2868 portrait) and one 13" iPad set (2064×2752 or
   2048×2732 portrait); 1–10 images each, all smaller devices auto-scale.
   Capture from Simulator (iPhone 17 Pro Max + iPad Pro 13"): portal
   home, preparation content, integration/journey view, resources.
   Screenshots must show the app itself, signed in.
7. **Listing metadata**: description (lead with the member-portal purpose:
   preparation, integration, resources, and support for members), subtitle,
   keywords, support URL and privacy policy URL from the production domain.
8. **App Privacy questionnaire** in App Store Connect — answer to match the
   privacy manifest: collects Contact Info (name, email), Health & Fitness
   (intake/health context), User Content; all linked to identity, none used
   for tracking, no third-party advertising.
9. **Age rating questionnaire**: Apple's rating tiers since July 2025 are
   4+/9+/13+/16+/18+ (the old 12+/17+ are retired). Answer honestly:
   "Alcohol, Tobacco, or Drug Use or References" maps Infrequent → 13+
   and Frequent → 18+ (no middle tier); "medical or treatment
   information" maps Frequent → 16+. A preparation/integration portal
   realistically lands at 16+ or 18+ — comparable approved apps sit
   there (Mindbloom 18+, The Plant Medicine Path 18+, Field Trip 16+).
   You can raise the computed rating manually, never lower it.

## App Review notes (enter in the "Notes" field — this is the important part)

- **Demo account (required)**: the app is login-gated and accounts are
  provisioned by founders, so App Review needs working credentials.
  Provision a dedicated demo member via the founder dashboard with
  representative (non-real) content, and keep it active for the whole
  review window. Include email + password in the review notes; note that
  Face ID is an optional re-entry convenience layered on that login.
- **Purpose statement**: private member portal for a registered religious
  organization on Kauaʻi — preparation, integration, scheduling, and
  support for members participating in in-person ceremony. Membership is
  granted off-app after application and screening.
- **Payments (Guideline 3.1.3(e))**: all payments in the app are
  contributions for in-person, physical-world services (ceremony
  participation, lodging) — no digital content or subscriptions are sold,
  so Stripe/Square web payments apply instead of In-App Purchase.
- **Substance content (Guideline 1.4.3)**: the app sells no substances and
  provides no consumption instructions; it supports members of a religious
  organization with preparation and integration around in-person,
  legally-structured sacramental ceremony. Say this plainly in the notes
  rather than leaving the reviewer to infer it.
- **Account deletion (Guideline 5.1.1(v))**: the rule triggers on apps
  that "support account creation" — this app offers none (accounts are
  founder-provisioned), so the literal requirement does not apply, but
  Apple publishes no explicit carve-out for provisioned accounts. State
  the provisioning model plainly in the notes; if review pushes back,
  an in-app "request account deletion" action that staff complete
  manually is explicitly acceptable to Apple.
- **Sign in with Apple (Guideline 4.8)**: not required — the guideline
  exempts apps that exclusively use the org's own account system, and
  the portal has no third-party/social login. (Adding Google/Facebook
  login later would change this.)

## Known review risks, in order

1. **Guideline 4.2 (minimum functionality)** — the app is a remote-loading
   WebView shell, and 4.2 is actively enforced against "repackaged
   websites" through 2026. Native features shipped so far: Face ID
   re-entry lock and on-device journey reminders (arrival countdowns +
   integration check-ins). Remote push via APNs and a native camera
   flow are the strongest additions once enrollment lands. If rejected,
   use Reply to App Review first (same reviewer, faster) and consider
   booking a free "Meet with Apple" App Review consultation.
2. **Substance-related content** — mitigated by the review notes above
   and an honest 16+/18+ rating; the private, login-gated nature helps.
   Never itemize any payment as the purchase of a substance — services
   only (Guideline 1.4.3 has no religious-sacrament exemption). Keep
   dosage information out of the app entirely (Guideline 1.4.2).
3. **Demo account quality** — a sparse demo portal invites a 4.2
   rejection. Populate the demo member with a full journey arc:
   scheduled ceremony, preparation weeks, integration content, resources.

Expectations: Apple reviews ~90% of submissions in under 24 hours, but
first submissions get deeper scrutiny (1–3 days is common) and roughly
40% of first submissions are rejected — plan for one fix-and-resubmit
cycle rather than treating a rejection as a crisis.

## After approval

- Releases: keep "Manually release this version" for the first approval so
  launch timing stays in Rachel's hands.
- Each web deploy updates the app instantly (remote-loading shell) — App
  Store updates are only needed for native-shell changes (plugins, icon,
  Info.plist).

# Vital Kauaʻi — App Store submission checklist

State of the native app as of 2026-07-05, and the remaining steps to ship
to the App Store. The Xcode project lives at `ios/App/App.xcodeproj`.

## Already in place (no action needed)

- Capacitor iOS shell loading the production portal (`capacitor.config.ts`),
  with in-app navigation whitelisted so Supabase auth, Stripe/Square
  checkout, and Vercel domains stay inside the WebView.
- Native Face ID / Touch ID re-entry lock (`@aparajita/capacitor-biometric-auth`,
  wired in `app/portal/layout.tsx` + `components/portal/BiometricGate.tsx`).
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

## One-time setup (requires Rachel/Josh — cannot be done by tooling)

1. **Apple Developer Program enrollment** — decide the enrolling entity:
   - *Organization* (recommended): the seller name shown in the store is
     the org's legal name. Requires a D-U-N-S number and someone with
     legal authority to bind the entity. Nonprofits based in the US can
     request the $99/yr fee waiver.
   - *Individual*: faster (no D-U-N-S), but the store listing shows the
     individual's personal name as the seller.
2. **Sign in to Xcode** — Xcode → Settings → Accounts → add the enrolled
   Apple ID. Then open `ios/App/App.xcodeproj`, select the App target →
   Signing & Capabilities → check "Automatically manage signing" and pick
   the team. (This Mac currently has zero signing certificates; Xcode
   creates them on first automatic signing.)
3. **App Store Connect app record** — appstoreconnect.apple.com → My Apps
   → "+" → New App. Platform iOS, bundle ID `com.vitalkauai.app`
   (register it at developer.apple.com/account/resources/identifiers if
   the picker is empty), name "Vital Kauaʻi", primary language English (U.S.).

## Build → TestFlight → Review

4. **Archive and upload**: in Xcode, select "Any iOS Device (arm64)" then
   Product → Archive → Distribute App → App Store Connect. Before each
   upload, bump `CURRENT_PROJECT_VERSION` (build number) in the App
   target; bump `MARKETING_VERSION` for each public release.
5. **TestFlight first**: add Rachel + Josh as internal testers and run the
   real flows on device — login, Face ID re-entry, portal navigation,
   a payment page, video playback — before submitting for review.
6. **Screenshots**: required sizes are 6.9" iPhone and 13" iPad (the app
   targets both device families). Capture from Simulator: portal home,
   preparation content, integration/journey view, resources. Screenshots
   must show the app itself, signed in.
7. **Listing metadata**: description (lead with the member-portal purpose:
   preparation, integration, resources, and support for members), subtitle,
   keywords, support URL and privacy policy URL from the production domain.
8. **App Privacy questionnaire** in App Store Connect — answer to match the
   privacy manifest: collects Contact Info (name, email), Health & Fitness
   (intake/health context), User Content; all linked to identity, none used
   for tracking, no third-party advertising.
9. **Age rating questionnaire**: answer the drug-references question
   honestly — the content concerns a sacramental plant medicine within a
   religious organization. Expect a 17+ rating.

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
- **Account deletion (Guideline 5.1.1(v))**: the app offers no in-app
  account creation (accounts are founder-provisioned), which is what the
  deletion requirement keys on. Members can request removal through the
  support contact; if review pushes back, add a "Delete my account"
  request action in portal settings and resubmit.

## Known review risks, in order

1. **Guideline 4.2 (minimum functionality)** — the app is a remote-loading
   WebView shell. Face ID is currently the sole native feature. If the
   reviewer flags 4.2, the strongest next moves are push notifications
   (ceremony reminders, integration check-ins) and a native camera flow —
   both were already scoped as follow-ups in `capacitor.config.ts`.
2. **Substance-related content** — mitigated by the review notes above and
   the 17+ rating; the private, login-gated nature of the app helps.
3. **Demo account quality** — a sparse demo portal invites a 4.2 rejection.
   Populate the demo member with a full journey arc: scheduled ceremony,
   preparation weeks, integration content, resources.

## After approval

- Releases: keep "Manually release this version" for the first approval so
  launch timing stays in Rachel's hands.
- Each web deploy updates the app instantly (remote-loading shell) — App
  Store updates are only needed for native-shell changes (plugins, icon,
  Info.plist).

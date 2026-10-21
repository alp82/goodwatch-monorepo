# YepWatch Expo client

Initial client in this exact directory. Expo SDK 58, React Native 0.88, TypeScript, Expo Router and Expo Web; TanStack Query holds HTTP/private and confirmed shared state. React state handles forms and immediate pending interactions. The existing GoodWatch webapp is unchanged by this client.

```bash
cd yepwatch-app
npm ci --install-links
npm start
# Or npm run web
```

Requires Node 24. Public API origin defaults to `https://yepwatch.com`; this is a target configuration, not a deployed API claim. Copy `.env.example` to `.env.local` to override public development endpoints. No secrets belong in Expo public variables. The backend must explicitly allow the browser origin and provide cookie/CORS/CSRF protection. HTTP/WS outside loopback must use TLS.

## Implemented journey

Optional GoodWatch sign-in entry or guest → create/join by full link or code → lobby and viewing screens → country/services/moods/time/media settings → an intentionally public host episode proposal plus separate private progress/approval → bounded swipe round with equivalent buttons, veto and undo → confirmed shortlist → private preference and proposal consent → server decision and per-screen provider destination. Includes movies, shows to start, shows to continue, couch, remote and mixed groups. Host configures viewing contexts; other participants select an existing screen and can ask the host to add a separate screen. No proposal is inferred from private viewing history.

The short round must finish for every required participant before the shortlist appears. There are no early-match popups. Readiness and progress are server state; presence is `unknown` when the gateway cannot establish it. No timers invent other participants' activity. Shared outcomes can permit inference in small groups; the UI promises private individual payloads, not anonymity.

Country/service choices and show/episode lookup use the API. No embedded catalog shortlist, fabricated availability or viewing-history writes. All metadata choices remain searchable; no launch-country/service restriction. Offers for a show are labelled as title evidence unless the API explicitly gives episode evidence. Destination labels distinguish provider, where-to-watch and search links. A destination click never claims playback or a watch.

## Transport and identity

`@goodwatch/yepwatch-contracts` is a copied `file:../goodwatch-webapp/packages/yepwatch-contracts` dependency using `install-links=true`, with no root workspace change. The backend thread owns that package. After an additive contract edit at the same version, remove only this app's installed `node_modules/@goodwatch/yepwatch-contracts` copy and run `npm install --install-links` to refresh it.

All HTTP paths come from that contract under `/api/yepwatch/v1`. A native adapter stores room credentials with Expo SecureStore. Browser bearer material is never saved: HttpOnly cookies authorize requests; sessionStorage contains only room/participant routing IDs and expiry. Initial admissions use at least 32 random bytes and retain the same secret/body for an in-session uncertain retry. Commands allow one in flight and retain their complete envelope for uncertain retries. A conflict is not success.

The socket obtains a fresh authenticated one-use HTTP ticket and sends it in the first application frame. Tickets never enter URLs/subprotocols. A live label requires a valid shared snapshot. Reconnect uses bounded exponential backoff/jitter, a new ticket, a full shared view and private HTTP refetch. Background pause stops the transport; resume repairs it. Server snapshots can coalesce revisions. No normal polling; unavailable transport is visible with explicit manual refresh. Runtime validation rejects private additions to shared participants/snapshots.

Invites `/r/INVITE` stay intact through the optional sign-in request. Existing authenticated membership is restored before any new admission, including a new browser tab with only the HttpOnly cookie or manual code entry. Recovery network errors block readmission until retried, preserving the original host/participant. Own HTTP revisions are tracked separately from shared revisions and participant command sequence, so another actor's new round cannot be overwritten by a delayed response. Overlapping private repairs trigger a follow-up read. Failed private repair is visible even while the socket is live, disables room commands and exposes manual Refresh.

Expo's `yepwatch` scheme is configured for development. Verified universal/app links require native registration and association files at future hosting; no live hosting, DNS, store identifiers or association files were changed. The app IDs `dev.yepwatch.foundation` are local development placeholders. An installed app/store detour has no promised deferred invite recovery; reopen the original link/code.

GoodWatch member start/callback entry points are wired, but the API currently returns `not_implemented`. Callback UI never reports a verified login. Real member authorization, private account prefilling and native callback exchange remain required before the intended first release. Guests work independently of that gap.

## Checks and development previews

```bash
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run export:web
npm run export:native
npm run check:resolution
```

Browser component tests export only to `dist-test` and serve that directory on port 8097, leaving retained `dist`/8099 and `dist-real`/8100 untouched. They build an explicitly enabled isolated `/preview` and mock HTTP errors/admissions; they do not prove multiplayer. The preview defaults off and labels every action as unsubmitted. `check:resolution` examines web/iOS/Android sourcemaps and installed dependency resolution to establish that the local contract copy and client graphs do not import webapp React, server/Crate/cache/auth code. Native exports verify bundling, not device execution.

See [the verification evidence](docs/verification.md) and [creation regression](docs/creation-regression.md). The current [real-catalog report](artifacts/real-catalog-poc.json) proves three clients, two viewing screens, eight real candidates across all three kinds, explicit episode proposal/private approvals and a freshly rechecked server decision. It uses a finite 36-title local snapshot and memory rooms. [Real shortlist](artifacts/real-catalog-poc-shortlist-mobile.png), [chosen continuation](artifacts/real-catalog-poc-choice-mobile.png), [remote screen](artifacts/real-catalog-poc-remote-choice-mobile.png), [GoodWatch reference](artifacts/goodwatch-reference-desktop.png). The older `connected-poc*` artifacts record the initial synthetic test and its earlier protocol; they are historical evidence, not the current episode-proposal policy.

Styling borrows Gabarito, #060606 background, dark neutral panels, amber accents, spacing and rounded controls inspected in the actual GoodWatch webapp. Gabarito font copies include their OFL licence. No existing webapp asset was changed. No analytics/session replay is installed on private surfaces.

## Remaining integration boundaries

Real adapter integration now passes through the client on `http://127.0.0.1:8100`, API 15996 and gateway 4318. The finite local recommendation snapshot contains 36 real titles; metadata returned all 251 country and 964 service choices. The exercised mixed group used DE/Netflix/Disney Plus and chose Breaking Bad season 1 episode 1. This proves that sample's client/API/gateway path, not complete catalog-wide coverage or production room persistence. The full private recommendation snapshot remains inaccessible locally; continuation-only discovery can operate without it. Crate-backed client room operation and GoodWatch login remain unverified/incomplete. Episode agreement does not verify episode entitlement: title-scoped offers remain explicitly labelled.

The older synthetic runtime at 15997/4317 and retained 8099 were intentionally not restarted during the membership regression proof. Its old episode-proposal protocol is not the current complete demo; use 8100 for the latest full flow. Native device builds, VoiceOver/TalkBack, secure storage on device, installed links and actual provider handoff remain unverified. Android debug compilation was attempted but the available JDK 21 runtime lacks `jlink`; system JDK 27 is incompatible with the generated Gradle toolchain. iOS native compilation is unavailable on this Linux host. Cached room panels may remain visible after a transport expiry error until refresh; server expiry enforcement still rejects expired commands.

No root/shared build integration was changed. Later hosting must serve the Expo SPA for `/r/*` and `/room/*`, route namespaced HTTP separately from the exact WS upgrade, preserve secure cookies/origins and provide standard association files once app identifiers exist. Webapp/gateway Docker contract installation belongs to their owning threads. The current SDK-compatible dependency graph has npm advisories recorded in [npm-audit.json](artifacts/npm-audit.json); no forced SDK/webapp upgrades were made during this POC.

Official references checked for this build: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router installation](https://docs.expo.dev/router/installation/), [monorepo dependency isolation](https://docs.expo.dev/guides/monorepos/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [font loading](https://docs.expo.dev/versions/v58.0.0/sdk/font/), [system-browser auth](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/).

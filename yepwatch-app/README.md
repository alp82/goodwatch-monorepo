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

Guest → nickname → create a room → one shared viewing screen with an editable country suggestion → choose actual usable services → start a round → private voting → confirmed shortlist, consent and provider destination. The host's Start action expresses only the host's readiness; friends explicitly get ready on their chosen screen. Movies and shows to start are the guest defaults. Extra screens, media, mood and time live in optional settings. All catalog countries/services stay searchable; no subscriptions are guessed.

Continuing shows is reserved for GoodWatch sign-in using saved progress. Actual member auth/history is not connected, so this feature is visibly unavailable. There is no manual show-progress editor or fake login/history import. An older all-kind setup requires the host's explicit switch to guest modes; stored settings are never silently rewritten. Couch, remote and mixed viewing screens remain supported.
The round must finish for every required participant before the shortlist appears. There are no early-match popups. Readiness and progress are server state; presence is `unknown` when the gateway cannot establish it. No timers invent other participants' activity. Shared outcomes can permit inference in small groups; the UI promises private individual payloads, not anonymity.

Country/service choices and candidate/episode identities use the API. No embedded catalog shortlist, fabricated availability or viewing-history writes. All metadata choices remain searchable; no launch-country/service restriction. Offers for a show are labelled as title evidence unless the API explicitly gives episode evidence. Destination labels distinguish provider, where-to-watch and search links. A destination click never claims playback or a watch.

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

See [the verification evidence](docs/verification.md) and [creation regression](docs/creation-regression.md). The historical [all-kind prototype report](artifacts/real-catalog-poc.json) records three clients, two screens and eight real candidates before the signed-in-only continuation decision. Its manual progress flow is no longer available in this client. It uses a finite 36-title local snapshot and memory rooms. [Real shortlist](artifacts/real-catalog-poc-shortlist-mobile.png), [chosen continuation](artifacts/real-catalog-poc-choice-mobile.png), [remote screen](artifacts/real-catalog-poc-remote-choice-mobile.png), [GoodWatch reference](artifacts/goodwatch-reference-desktop.png). The older `connected-poc*` artifacts record the initial synthetic test and its earlier protocol; they are historical evidence, not the current episode-proposal policy.

Styling borrows Gabarito, #060606 background, dark neutral panels, amber accents, spacing and rounded controls inspected in the actual GoodWatch webapp. Gabarito font copies include their OFL licence. No existing webapp asset was changed. No analytics/session replay is installed on private surfaces.

## Remaining integration boundaries

Real adapter integration now passes through the client on `http://127.0.0.1:8100`, API 15996 and gateway 4318. The finite local recommendation snapshot contains 36 real titles; metadata returned all 251 country and 964 service choices. The exercised mixed group used DE/Netflix/Disney Plus and chose Breaking Bad season 1 episode 1. This proves that sample's client/API/gateway path, not complete catalog-wide coverage or production room persistence. The full private recommendation snapshot remains inaccessible locally; continuation-only discovery can operate without it. Crate-backed client room operation and GoodWatch login remain unverified/incomplete. Episode agreement does not verify episode entitlement: title-scoped offers remain explicitly labelled.

The older synthetic runtime at 15997/4317 and retained 8099 were intentionally not restarted during the membership regression proof. Its old episode-proposal protocol is not the current complete demo; use 8100 for the latest full flow. Native device builds, VoiceOver/TalkBack, secure storage on device, installed links and actual provider handoff remain unverified. Android debug compilation was attempted but the available JDK 21 runtime lacks `jlink`; system JDK 27 is incompatible with the generated Gradle toolchain. iOS native compilation is unavailable on this Linux host. Cached room panels may remain visible after a transport expiry error until refresh; server expiry enforcement still rejects expired commands.

No root/shared build integration was changed. Later hosting must serve the Expo SPA for `/r/*` and `/room/*`, route namespaced HTTP separately from the exact WS upgrade, preserve secure cookies/origins and provide standard association files once app identifiers exist. Webapp/gateway Docker contract installation belongs to their owning threads. The current SDK-compatible dependency graph has npm advisories recorded in [npm-audit.json](artifacts/npm-audit.json); no forced SDK/webapp upgrades were made during this POC.

Official references checked for this build: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router installation](https://docs.expo.dev/router/installation/), [monorepo dependency isolation](https://docs.expo.dev/guides/monorepos/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [font loading](https://docs.expo.dev/versions/v58.0.0/sdk/font/), [system-browser auth](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/).

## Current simplified guest POC

[Guest integration result](artifacts/guest-connected-poc.json) proves ordinary visible-UI creation, explicit DE/Netflix8 selection, first-click Start, seven real cards and confirmed votes/shortlist, then a fresh browser following the actual app-origin invite and two clients voting. This uses API15995, gateway4319, memory rooms and the finite36-title local catalog sample. [Default setup](artifacts/guest-defaults-mobile.png), [lobby](artifacts/guest-lobby-mobile.png), [voting](artifacts/guest-voting-mobile.png), [joined guest voting](artifacts/guest-joined-voting-mobile.png). Capabilities are omitted from reports/screenshots.

The new playable development client is `http://127.0.0.1:8101/`, served from `.expo/exports/guest-binary-20261021`; previous `dist-guest` is preserved for rollback. Original8099/8100 exports and rooms remain untouched. Tests only export `dist-test` on8097. `scripts/poc-guest-browser.cjs` defaults to8097; set `POC_APP_ORIGIN=http://127.0.0.1:8101` to verify the separate client using fresh rooms. Do not export over any directory currently serving a retained client.

Browser invitation URLs use the current app origin (or explicit `EXPO_PUBLIC_APP_ORIGIN`); native shares use that configured public app host, defaulting to `https://yepwatch.com`. The API origin is never used for invitation construction. Native association/device handling is still unverified.

Public failure details produce plain next steps for incomplete availability/search, known no matches, missing setup, and a loading catalog. Counters and scan internals stay out of the product flow. Uncertain writes still require retrying the same pending action; no automatic service substitution or command replay occurs.

Latest served8101 includes the reviewed legacy-round recovery. [Final served build/config/hash record](artifacts/served-8101-final.json) and [complete export manifest](artifacts/served-8101-build.json) identify the exact local output. The new export retains six previous hashed assets for already-open tabs. To roll back, verify and stop only the current8101 static listener, then run `EXPORT_DIR=dist-guest PORT=8101 node scripts/serve.cjs` from this directory. Do not restart APIs/gateways or overwrite the previous export.

## Binary voting update

The current8101 build has exactly **No** (`pass`) and **Watch** (`watch`) choices; left swipe is the same No action. Undo and historical `veto` records remain compatible, while the extra veto control/explanation is gone. Voting progress bars and own/participant completion fractions are removed. Neutral choosing/choices-made/finished states remain; public completed counts do not claim someone explicitly completed their round. Round copy makes no duration promise. Explicit finish-round, waiting for all required members, shortlist and final consent remain intact.

[Final binary build/config/hashes](artifacts/binary-voting-final.json), [source hashes](artifacts/binary-voting-source-hashes.json), [real voting screenshot](artifacts/binary-voting-real-mobile.png). The preceding `.expo/exports/guest-recovery-reviewed-20261021` is preserved for immediate rollback; the older `dist-guest` is also retained. Simulator controls remain in the separate local simulator; ordinary app create/join/invite routes recover the host through the existing HttpOnly room cookie, with no simulator counters or new app entry.

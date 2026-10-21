# Client verification, 2026-10-21

Client work stayed in `yepwatch-app/`, in the main checkout. No commits, pushes, deployments, issue publication, DNS/store/account changes, root workspace changes or edits to shared/server/webapp code. Contract additions were requested from and implemented by their backend owner, then consumed read-only.

## Current real-catalog connected POC

**Open http://127.0.0.1:8100/** for the current complete flow. API15996 and gateway4318 use actual GoodWatch catalog adapters, a finite **36-real-title local recommendation snapshot**, disposable local Valkey and **memory room storage**. No production room/table writes and no live Crate-backed client persistence claim. Backend metadata returned all **251 countries and 964 services**; the exercised group chose DE, Netflix and Disney Plus. This sample is a test fixture of real catalog records, not a product country/service/catalog restriction.

The [machine-readable report](../artifacts/real-catalog-poc.json) records **three independent browser clients, two viewing screens, eight real candidates spanning movies/shows-to-start/shows-to-continue, 133 shared frames and zero JavaScript errors**. The script [poc-real-browser.cjs](../scripts/poc-real-browser.cjs) drives visible landing create and fresh invite joins, configures two people sharing Our TV and another person on a separate screen, searches Breaking Bad through the API, selects canonical episode 62085 from backend episode choices, and explicitly presses **Propose this episode to group** as host. Each participant separately supplies private progress and approves that public proposal. Private inputs never generate a shared episode proposal.

Clients vote independently, reload one browser mid-round to restore private state and a fresh socket, finish every round before seeing a shortlist, propose the continuation title, consent individually and commit the server decision after fresh availability rechecking. Own choices do not advance other clients' cards. Received WS snapshots are checked for private own/participant choice fields. The chosen episode is Breaking Bad season 1 episode 1; title-scoped offers remain explicitly labelled as **not proof of this episode's entitlement**. A provider URL is a handoff, not proof of playback or viewing.

The same connected run blocks initial own HTTP reads, observes a private-state error while WS remains connected, verifies commands are disabled, then restores networking and recovers through the always-visible Refresh button. Independent repetition injected one private GET503 and verified manual recovery: [independent private-repair report](../artifacts/independent-private-repair-ui.json).

[Real shortlist screenshot](../artifacts/real-catalog-poc-shortlist-mobile.png), [chosen continuation](../artifacts/real-catalog-poc-choice-mobile.png), [remote screen](../artifacts/real-catalog-poc-remote-choice-mobile.png). Screenshots use mobile width with a taller viewport to capture the complete view. The development banner names real sample reads and memory rooms.

Gateway/backend owners retain API15996, WS4318, revision Valkey46397 and sample snapshot15990; both API/gateway explicitly allow app8100. Their runbooks own service credentials and processes. With those services ready, from `yepwatch-app/`:

```bash
EXPO_PUBLIC_ENABLE_FIXTURES=false \
EXPO_PUBLIC_API_ORIGIN=http://127.0.0.1:15996 \
EXPO_PUBLIC_WS_ORIGIN=ws://127.0.0.1:4318 \
EXPO_PUBLIC_DEVELOPMENT_NOTICE='Local POC: real catalog reads, finite 36-title sample, memory rooms.' \
npx expo export --platform web --source-maps --output-dir dist-real
EXPORT_DIR=dist-real PORT=8100 node scripts/serve.cjs
# In another terminal:
node scripts/poc-real-browser.cjs
```

## Creation and membership regression

[Detailed diagnosis and before/after evidence](creation-regression.md) covers the user-reported creation concern. On exact URL8099, clean creation and second creation with an existing cookie both returned200; the confirmed failure was reopened-invite admission replacing the host. The client now restores existing membership before admission. Direct invite, manual code, cookie-only new tab and fresh guest join were independently retested. Diagnostics redact invite capabilities; no API-created rooms substituted for the visible create control.

The test-output collision is also fixed: component tests build only `dist-test` on8097. Retained8099 `dist` and current8100 `dist-real` are separate. [Local isolation result](../artifacts/test-export-isolation.json) proves retained HTML hash unchanged across the tests. The independent reviewer verified all40 retained files plus HTTP HTML/three JS bundle hashes were unchanged and retained API15997/WS4317 throughout. Their test writes stayed in a separate source copy.

## Other checks

- Typecheck and Expo lint pass.
- **Fifteen** state/API/reconnect tests pass. Four new regression tests ran red before correction: delayed equal-sequence private state after another actor's new round, intermediate HTTP repair despite a newer push, dropped repair demand during an in-flight request, and a real HTTP response flushing headers then stalling its JSON body. The full request deadline includes body parsing and caller cancellation.
- Three browser component/entry tests pass: preserved invite through unsupported sign-in, guest cookie transport without bearer storage, unavailable-live honesty/no normal polling, mixed/all-kind views, keyboard voting, shortlist/episode caveats, mobile/desktop layout. These mock-HTTP/component checks are separate from actual connected POC evidence.
- Expo web exports pass for retained synthetic and current real-sample clients. Latest Android/iOS Hermes exports pass. [Dependency isolation evidence](../artifacts/resolution.json) checks local React/RN/Expo resolution, the copied shared contract and client sourcemaps; no webapp/server/database/cache source is present.
- GoodWatch was visually inspected in a real browser. Actual source supplied Gabarito, dark neutral surfaces, amber accents, spacing and rounded controls. [Reference screenshot](../artifacts/goodwatch-reference-desktop.png). No existing webapp assets were changed.
- Native generation succeeds. Android debug compilation was attempted: system Java27 failed Gradle semantic analysis, and the installed JDK21 runtime lacks `jlink` for an Android SDK transform. No APK/device execution is claimed. [Build log](../artifacts/android-build.log). Native projects are generated and ignored, not handwritten.
- Expo compatible-version check passes. SDK dependency npm advisories are recorded, not forced into unrelated upgrades.

## Historical synthetic POC

The earlier [connected-poc.json](../artifacts/connected-poc.json) and `connected-poc-*.png` record the initial synthetic catalog/memory-room check with85 shared frames. They predate the intentional public host episode-proposal protocol and are historical evidence. The older15997/4317 services were intentionally left unchanged while testing the new client membership guard against an unfixed server; retained8099 is useful for creation/resume regression. Use8100 and `poc-real-browser.cjs` for the current complete flow. The old `poc-browser.cjs` describes that earlier test and is not the current protocol runner.

## Remaining limits

The full private production recommendation snapshot is inaccessible locally; only the stated finite real sample was exercised. Member login remains `not_implemented`; no successful GoodWatch OAuth/native callback/account-prefill claim. No live Crate-backed client room persistence, installed native app, on-device SecureStore, VoiceOver/TalkBack, universal/app-link registration, real provider playback, production proxy/TLS or catalog-wide entitlement coverage was verified here. Duplicate same-name provider IDs remain distinct; no client alias/entitlement inference was invented.

Cached room panels may remain after a transport expiry error until refresh; server expiry enforcement rejects expired commands. This remaining UI follow-up was not expanded during the create/connected-POC priority. No episode choice writes viewing history. The full development/release milestone is not declared complete.

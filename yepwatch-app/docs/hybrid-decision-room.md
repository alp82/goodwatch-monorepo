# Hybrid decision room

The production client follows approved prototype `5c4e53cf`: one wall of every match, comparison facts on every poster, and separate inspection/Propose/Agree controls. Prototype stores, scripted participants and title lists are not included. The main view stays within the viewport; details use a drawer. Decision details have no trailer; the native/web voting player remains available.

## Rules and implementation

The portable [proposal contract3](../../goodwatch-webapp/packages/yepwatch-contracts/PROPOSAL.md) owns HTTP commands, shared/private projections, late-join rules, timings and version fences. New `/api/yepwatch/v1/proposal` paths and v3 pending/invite keys isolate this source from retained contract2 runtimes.

- Anyone can propose a current match. Proposing agrees for that caller. Replacing the proposal clears old agreements. Agree/Take back target the exact proposal, roster and own revision. Only a confirmed server decision after a fresh availability check renders Done.
- Late join preserves the proposal and existing agreements while adding a required participant. Agree may imply Yep for an unanswered newcomer, without a timing measurement. Nope/Undo can invalidate the proposal. Away/disconnect never removes anyone from quorum. Keep voting preserves the exact own card and agreement.
- Top score shows real GoodWatch scores; missing values say unknown. Shortest ranks known movies only, labels actual canonical episode durations separately and never substitutes show-average length. Quickest orders the server's current-roster average active Yep milliseconds lowest first, unknown last. Client measurements are self-reported observations, not verified human attention.
- Active exposure uses a monotonic clock for the exact interactive own voting card. It pauses for details, trailers, matches, background/Android blur and uncertain commands. A persisted observation marker makes missing elapsed measurements unavailable after reload; it never guesses from wall time. Above20minutes remains unavailable.
- Dice briefly highlights real matches and settles into local inspection only. Lenses and inspection never propose or agree. Poster inspection can name only a current shared match; generic lens/dice cues have no title. Authenticated peer cues expire after1.5seconds and are not renewed by presence heartbeats. Proposal/count motion comes from confirmed aggregate changes. No named approval list or individual timing is shared.

## Current local build

| Purpose | Endpoint |
| --- | --- |
| New web app | http://127.0.0.1:8133 |
| New guest API | http://127.0.0.1:15992 |
| New gateway | ws://127.0.0.1:4324/api/yepwatch/v1/proposal/realtime |
| Android Metro | http://127.0.0.1:8141 |
| Optional operator simulator | http://127.0.0.1:8126 |

The API uses a backend-owned disposable durable Crate room store and finite real catalog sample. DE/Netflix8 currently supplies7 cards. Full metadata remains available; this sample is not full-catalog proof. GoodWatch member login is honest501 on this isolated stack; retained contract2 member proof is separate. Unreviewed refresh work is excluded. Older8132/8140, APIs, gateways and installed foundation app are preserved.

Android is an actual locally compiled debug APK with arm64-v8a and x86_64, Temurin21/Gradle9.4.1/AGP9.2.1, Expo58/RN0.88. Its isolated staging-only identity is `dev.yepwatch.hybrid` / **YepWatch Hybrid** so it installs alongside `dev.yepwatch.foundation`. Main `app.json` stays unchanged. Generated output is ignored under `.expo/native-build/hybrid-r1/yepwatch-app/android/`; it is not a release/offline build and needs Metro8141. [Native build prerequisites](native-build.md) still apply. Linux cannot compile an iOS app; use the [Mac quickstart](ios-quickstart.md) with matching reachable HTTPS/WSS endpoints.

## USB phone test

Unlock the phone, enable USB debugging and accept this computer's RSA prompt. `adb devices -l` must show its serial as `device`. MTP visibility alone does not establish ADB authorization. Never use an unspecified adb target.

```sh
# Replace SERIAL with the authorized phone's exact serial. No uninstall/clear-data/reset.
ADB=/home/alp/Android/Sdk/platform-tools/adb
"$ADB" -s SERIAL install -r .expo/native-build/hybrid-r1/yepwatch-app/android/app/build/outputs/apk/debug/app-debug.apk
"$ADB" -s SERIAL reverse tcp:8141 tcp:8141
"$ADB" -s SERIAL reverse tcp:15992 tcp:15992
"$ADB" -s SERIAL reverse tcp:4324 tcp:4324
"$ADB" -s SERIAL reverse tcp:8133 tcp:8133
"$ADB" -s SERIAL shell am start -n dev.yepwatch.hybrid/.MainActivity
```

If installation reports a signature conflict, stop and ask the maintainer; do not uninstall or erase app data. Keep USB connected and the local processes running. These loopback addresses work only through the device-specific reverse mappings.

Create a guest room, confirm country and actual services, invite two friends through the browser link, then Yep/Nope/Undo. Inspect the matches, try lenses/dice, Propose, replace the proposal from another participant, Agree/Take back, and let everyone Agree to reach Done. Alternatively create a **fresh** session in the local8126 operator controller, enter its complete invite code through **Join with an invitation**, tap Ready, and explicitly Start in the controller. Artificial controller participants are a labelled development harness; product activity is never fabricated.

## Evidence and limits

`artifacts/hybrid/connected-browser.json` records three ordinary browser clients plus a late fourth: measured averages, proposal/withdraw/replacement, missing newcomer timing, Undo invalidation and fresh Done. `android-solo.json` records actual emulator create/setup/live WS/voting/Undo/lenses/propose/Done/background resume; `native-mixed.json` records actual emulator plus two browser identities, live replacement/withdrawal/Agree and Done. Real-artwork screenshots cover375x667/390x844/1440x900; component regressions cover the wall, no trailer, exact retry/reload Undo and paused exposure.

Physical USB execution is not yet proven: the phone was visible as Pixel MTP but absent from ADB during these checks. No iOS compilation, physical audio/player, production deployment/auth/account data or member-refresh verification is claimed. Earlier layout/guest-recovery followups retain their independently-unreviewed status; the blocked reviewer was not reassigned.

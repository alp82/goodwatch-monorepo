# Continuous Glow transport and solo simulator

This is an opt-in transport for the portable `@goodwatch/yepwatch-contracts/continuous` contractVersion2. Legacy paths, room projections, gateway defaults and running processes remain separate. HTTP commands stay in the YepWatch API; only the API can read/write Crate, catalog and accounts. This gateway receives a service bearer and participant-scoped shared leases, never database/account credentials.

## Local processes

| Component | Loopback address | Scope |
| --- | --- | --- |
| New actual Glow app | http://127.0.0.1:8131 | App owner; r3 visible integration verified |
| Continuous API | http://127.0.0.1:15994 | Backend owner; isolated disposable Crate on15987/tablev2 |
| Continuous gateway | ws://127.0.0.1:4321/api/yepwatch/v1/continuous/realtime | This package; PID1694346 at activation |
| Latest fixed continuous simulator | http://127.0.0.1:8124 | This package; PID2012931 at activation |
| Preserved first continuous simulator | http://127.0.0.1:8122 | Pre-admission-fix process; PID1790844 |
| Revision/activity broker | redis://127.0.0.1:46398 | Backend owner's isolated disposable Valkey |

The first integrated API uses an **explicitly synthetic catalog with durable disposable Crate room state**. That proves real transport/domain integration, not real-title selection, account linking or production catalog/storage. Later catalog changes must be coordinated with the backend/app owners and separately evidenced. Do not repoint a retained simulator demo to another API or restart its process without checking its memory/pending state first.

Existing app8101, prototype8130, old APIs/gateways, and simulator8120/8121 remain untouched. The latest simulator uses `yepwatch_sim_control_8124`, preserving all older control cookies. The first continuous8122 process was retained with its memory state; use8124 for the reviewed admission fix. All controller instances may share a browser profile. Browser room-cookie forwarding remains the exact HttpOnly Set-Cookie issued by the API, on literal127.0.0.1. No bearer appears in a URL, subprotocol, controller state, artifact or log.

```bash
cd yepwatch-realtime
npm ci
npm run build
# Prepare private mode0600 .poc/continuous-gateway.env using .continuous.env.example.
# Copy ONLY the gateway service bearer from the API owner, no other API secrets.
node --env-file=.poc/continuous-gateway.env dist/main.js
# Separate terminal; no service credential needed:
YEPWATCH_SIM_PORT=8124 npm run simulator:continuous
```

Do not start duplicates when4321/8124 are already running. The source default controller port remains8122; use the explicit8124 override above while older processes are retained. Simulator origins can be changed using `YEPWATCH_SIM_API_ORIGIN`, `YEPWATCH_SIM_WS_ORIGIN`, `YEPWATCH_SIM_APP_ORIGIN`, and its port with `YEPWATCH_SIM_PORT`. Every origin must be an explicit credential-free loopback origin without path/query/hash; production/remote targets are rejected before any connection. The simulator never starts/stops the API, app, broker or gateway.

Gateway v2 is selected by `YEPWATCH_CONTINUOUS=1`. Revision subscription is `yepwatch:v2:revision`, carrying only strict `{roomId,revision}`. Ephemeral fanout uses the separate `yepwatch:v2:activity`; no legacy channel payload changes. Standalone and three-master ioredis-compatible cluster configurations are supported. Health is `GET /api/yepwatch/v1/continuous/realtime/health`; both subscription and activity publication/subscription must be confirmed before live delivery.

## Authenticated ephemeral activity

The API exports the agreed types and owns one-use30s tickets plus signed rotating60s shared leases capped by room expiry. The gateway ACKs the subscription before the final authorized read, emits strict `room.snapshot`, then emits:

```ts
{ type: 'activity.session', roomId, sessionId, serverTime }
// Client sends ONLY after live snapshot/session, with a sequence starting at0:
{ type: 'activity', sessionId, sequence, view: 'voting' | 'matches' | 'trailer' | 'away',
  gesture?: 'reach' | 'handle' | 'release', beat?: 'answer' }
// Server stamps identity/time/expiry; the client cannot supply these fields:
{ type: 'activity', roomId, participantId, sessionId, sequence, serverTime, expiresAt,
  view, gesture?, beat? }
```

Session IDs are random and change per new authenticated socket; reconnect resets the sender sequence. Duplicate/out-of-order session sequences are dropped. Unknown keys, raw pointer coordinates, direction/value, clicked button, title, candidate/card/index, match/pick target and private fields are rejected. Every nested shared projection is also strictly checked, including catalog additions, failure details, matches/pickcounts and decision availability. Individual votes/picks/receipts/private cursors never pass through. Public common candidates/matches and aggregate pickcounts remain intentional API-owned outcomes.

View expiry is `expiresAt <= serverTime+6000ms`, also capped by the sender's current lease/room expiry. Gesture/answer pulse expiry is separately `serverTime+1500ms`. Foreground clients renew **only their actual view** within3s; heartbeats never invent gesture/answer events. Actual drag/touch emits neutral reach/handle/release; actual vote interaction may emit answer without direction/target. The client generates its fixed generic upward path locally, independent of the real swipe or controls. It suppresses sending/rendering when background, disconnected/degraded or private credentials fail.

Limits are4 activity frames/second with burst8 per socket, plus a local participant bucket8/second/burst16. The v2 total WebSocket input budget is64 frames/10s. Latest accepted state coalesces per session at250ms, with bounded pending/replay maps (2048), at most64 publications per flush and bounded broker commands. These are per gateway bounds; there is no global distributed connection/rate registry. Backpressure/payload/heartbeat/Origin/auth-timeout/connection/room bounds are inherited from the gateway and tested with actual sockets.

Own participant activity is excluded, including another device for that participant. Multiple remote sessions remain distinct: one normal socket closing can send `away` only for its own session, never mark the whole person offline. When authority/delivery cannot be confirmed, no activity is accepted/forwarded; leases expire and recipients clear by TTL/degraded state. Bus recovery requires a new authorized shared snapshot and actual fresh view renewal, never activity replay. Broker clocks are expected within2s; implausible future/expired envelopes are dropped. Presence is conservative activity evidence, not authoritative membership. No disconnect/background action removes a required voter or changes votes/picks/consent.

## Simulator controls

The controller always creates a fresh room; there is no arbitrary room/invite input. It forwards host admission cookie and opens the actual `/r/<invite>` app route. One to three named artificial people have independent native credentials, private views, sequenced commands and real authenticated sockets. The host stays manual in the actual app.

- Agreement steps answer real cards and pick the first current match; there is no mandatory completion step. Picking does not prevent continued choosing.
- Disagreement makes Sim Alex answer No; slow person delays the last artificial person's real actions by5×. Neither fabricates shared progress or removes anyone.
- Step/Yep/Nope/Undo/Ask for more issue actual private API commands. Each artificial actor has its own retained-card order. Private diagnostics are visible only in the authenticated operator page.
- Pick/clear pick are private commands. Late guest immediately joins the authoritative roster with zero votes and invalidates matches/picks. Disconnected people remain required; reconnect uses the same identity and a fresh ticket/session.
- Pause/resume affects future artificial automation only. Automatic actions require a real cached phase/action opportunity; there is no normal private-state polling, idle answer beat or random peer motion.
- Simulate view and neutral reach/handle/release are explicit artificial operator interactions. A successful real artificial vote emits only a generic answer/release pulse. No private target/value is sent as activity.
- Recover retains the exact command ID/sequence/body after an uncertain response. A newer shared revision during a private GET raises the repair target and triggers bounded follow-up reads. Process restart loses identities/pending commands; this tool does not claim recovery across restart. Fresh demo replacement is refused while a command is busy/pending. Initial admission/setup failures can require creating a new explicitly fresh demo; this is a local tool, not production credential persistence.

Old room membership/votes stay intact when a fresh demo replaces its sockets. No history/account state is fabricated or written. Default demo setup currently uses the synthetic API's DE/service1 context; configure a real viewing screen in the host app when moving to a separately verified real catalog.

## Evidence and reproducible checks

```bash
npm run build
# Disposable real Valkey/three-master cluster, legacy API fixture integration:
YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
# Explicit new15994/4321 integration; creates ONLY fresh test rooms:
YEPWATCH_TEST_CONTINUOUS_LIVE=1 node --import tsx --test test/continuous-simulator.test.ts
node --env-file=.poc/continuous-gateway.env --import tsx test/continuous-live-smoke.ts
```

`artifacts/continuous-live-smoke.json` records the actual new API/Crate+two-gateway+Valkey journey: three independent identities, browser HttpOnly admission/ticket/session, ticket replay denial, exact-envelope retry, immediate match, aggregate picks, latejoin invalidation, disconnect quorum preservation, fresh-session reconnect, fresh-check automatic Done and neutral cross-gateway trailer activity. It contains no invites, bearer/lease/service credentials or private vote payloads. This is explicitly synthetic-catalog evidence. Unit/fixture tests separately exercise strict nested privacy, coalescing, replay/TTL/rate caps, missing authority, lease expiry/revocation, invalid Origin/room, bus repair, heartbeat/backpressure and1012 restart. Real three-master Valkey tests exercise activity publication, subscriber disconnect recovery and compiled service start/drain; broker-test API is an explicit HTTP fixture.

For later deployment, route only continuous WS upgrade/health paths to this separate service and retain all HTTP commands in the API. API internal attach/view hooks require the service bearer; restrict their network reach separately. Keep proxy timeouts above heartbeat and support1012 drain/reconnect. No proxy/TLS/firewall/deployment changes are part of this work.

Current verification: build/typecheck **PASS** and the complete opted-in suite **33 tests PASS, zero skipped**, including the actual new15994/4321 simulator test. Command: `YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 YEPWATCH_TEST_CONTINUOUS_LIVE=1 npm test`. Visible simulator/Glow r3 proof also **PASS**: three initial clients, four after a late join;32 main-app shared frames,17 neutral activity frames, zero JavaScript errors/private shared fields. The real Valkey compiled-service test checks1012 client drain separately from ioredis cluster socket teardown, which has its own bounded disconnect timers.

## Visible one-operator proof

Run `node simulator-continuous/prove.cjs` with the new API/gateway/app available. It starts and stops **only its own ephemeral controller**, preserving retained8122, all older controllers and all services. It creates fresh rooms and uses visible operator controls plus the actual host app, with no injected host API commands. The proof is deliberately for the current synthetic two-card catalog; real-catalog/real-trailer validation must be separate. Playwright reuses `yepwatch-app/node_modules/@playwright/test` and its installed Chromium; no new runtime dependency.

`artifacts/continuous-simulator-proof.json` records **PASS** for independent private cards, isolation of one person's action, a neutral trailer view cue, disconnect/reconnect while still required, immediate matches/private picks, latejoin invalidation, automatic Done, disagreement without a majority substitute, and slow/pause/resume. It observed32 main-app shared and17 activity frames with zero private fields or JavaScript errors. Artificial bot sockets also receive their own snapshots, so the controller's combined frame counter differs. Screenshots:

- `continuous-simulator-independent-cards.png`
- `continuous-simulator-disconnected-wait.png`
- `continuous-simulator-latejoin-invalidation.png`
- `continuous-simulator-agreement-done.png` (one artificial person still has an unanswered card; picking/Done does not require completion)
- `continuous-simulator-disagreement.png`
- `continuous-simulator-slow-paused.png`

This proves generic trailer *activity*, not a playable trailer: synthetic candidates contain no real trailer URL. Physical-device behavior, full catalog coverage, linked-member auth/history, load and production TLS/routing are not claimed by this gateway proof.

## Independent admission-race follow-up

The reviewer reproduced a race in the first continuous simulator: Fresh could replace a demo while a late guest's successful join response was held, then insert that old-room actor into the replacement. The narrow fix blocks replacement while admission is active, reserves startup before any await, fences delayed admissions by room/generation before insertion, guards late socket creation after stop, and disables Create/Add while adding. An actual-API regression holds the response, verifies **zero replacement API POSTs**, preserves the original actor set, and checks cancellation of a second held admission without removing the API-admitted required voter. The immutable original pin remains intact; the fixed copy is `/tmp/yepwatch-continuous-gateway-review-20261022/fixed/`, described by `fixed-manifest.json`. Gateway transport source did not change.

Updated simulator8124 was started separately instead of restarting8122 or any older controller. Its cookie is isolated by port and it starts empty. Use8124 for current operator work;8122 remains the earlier pre-fix process. Independent reviewer fixed-pin verification PASS (26 tests passed,6 opt-in tests skipped in its isolated run); full owner suite33 passed with zero skips. Fixed-source synthetic visible rerun PASS with32 shared/17 activity frames and zero JavaScript errors. See `docs/verification/yepwatch-continuous-review.md` in the repository (owned by reviewer).

## Separate real-catalog stack

The real stack is now **API15993 → gateway4322 → app8132**, with backend-owned **separate disposable Crate15986/tablev2**, preserving synthetic15994/4321/8131. It shares only the isolated local Valkey46398 using the continuous revision/activity channels. Gateway4322 PID2045976 uses private mode0600 `.poc/continuous-real-gateway.env`, containing the service bearer and transport configuration only; it has no Crate/catalog/room/account keys. The backend seeded36 actual catalog records through SELECT-only reads. This is a finite local real sample, not full-catalog coverage or production state.

Actual authenticated three-identity/two-gateway real smoke **PASS**, including immediate match, private/aggregate picks, latejoin invalidation, disconnect quorum, fresh session reconnect, real browser-cookie admission, service-auth hooks and all-current-pick fresh-check automatic Done. DE / **Netflix provider8** returned7 real movie/new-show candidates; all7 have actual backdrop,score andgenres,6 have actual YouTube trailer URLs and1 is honestly missing. Evidence: `artifacts/continuous-real-readiness.json` and `continuous-live-real-smoke.json` (39 frames).

```bash
# Real gateway, already running; do not duplicate:
node --env-file=.poc/continuous-real-gateway.env dist/main.js
# Separate real simulator, already running on8125:
YEPWATCH_SIM_PORT=8125 \
YEPWATCH_SIM_API_ORIGIN=http://127.0.0.1:15993 \
YEPWATCH_SIM_WS_ORIGIN=ws://127.0.0.1:4322 \
YEPWATCH_SIM_APP_ORIGIN=http://127.0.0.1:8132 \
YEPWATCH_SIM_SERVICE_ID=8 YEPWATCH_SIM_CATALOG=real-sample \
npm run simulator:continuous
# Actual real protocol smoke, fresh rooms only:
YEPWATCH_LIVE_WS_ORIGIN=ws://127.0.0.1:4322 \
YEPWATCH_LIVE_CATALOG=real-sample YEPWATCH_LIVE_SERVICE_ID=8 \
node --env-file=.poc/continuous-real-gateway.env --import tsx test/continuous-live-smoke.ts
```

The real simulator defaults to the same safe explicit demo semantics with a validated positive provider ID and explicit catalog label. Synthetic defaults remain service1/synthetic; no production target or credential discovery is added. Its cookie is `yepwatch_sim_control_8125`, independent of all retained instances. The standalone visible harness accepts the same simulator origin/provider/mode environment flags and starts only its own ephemeral process; real screenshots/reports use `continuous-simulator-real-*` to preserve synthetic evidence. Real visible proof **PASS** against8132:7 real cards,3 initial clients/4 after latejoin,65 main-app shared frames,36 neutral activity frames, zero JavaScript errors/private shared fields. It covers the same independent cards/trailer cue/disconnect/reconnect/matches/picks/latejoin/Done/disagreement/slow cases. Evidence is `artifacts/continuous-simulator-real-proof.json` and six `continuous-simulator-real-*.png` scenario screenshots. Current real simulator8125 PID2111605 remains clean and ready; the proof used its own ephemeral controller and did not touch8125 or any retained demo. The real app owner's actual embedded-trailer/activity-video proof remains separately owned; this gateway report proves URLs and generic trailer activity, not video playback.

Final independent review: the gateway/admission fixed pin and final real-simulator configuration companion both **PASS**, with no unresolved finding. Reviewer used only its own isolated services, separately tested malformed configs/envs and provider override rejection, and preserved original/fixed evidence. Core gateway source remains identical to its reviewed pin. The final browser harness changed one accessible-label selector to support both8131's “shared matches” and8132's “matches”; that actual real visible run passed. Only runbook/evidence and this selector changed after the configuration companion was frozen.

Exact latest compiled-bundle loading was also checked on a separately started disposable gateway against real15993: fresh native ticket → authorized v2 snapshot → activity.session →1012 drain/process exit0 **PASS**, preserving all retained processes. `artifacts/continuous-current-build-smoke.json` records SHA256 `093e0307324905b2a67bde17de1de80af7fe09793d5a7342024e8774911901c4`. Existing gateways are deliberately not hot-reloaded by builds. An additive unused memberProgress path in the shared portable contract changes the bundle hash without changing this gateway's reviewed core protocol logic. Final source hashes/PIDs/limits are in `artifacts/continuous-handover.json`.

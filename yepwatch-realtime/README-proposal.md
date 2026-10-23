# Shared proposal gateway and phone peers

This isolated contract3 stack uses `@goodwatch/yepwatch-contracts/proposal`, the `/api/yepwatch/v1/proposal` prefix and `yepwatch:v3:revision` / `yepwatch:v3:activity` channels. Legacy and continuous contracts stay available on their existing listeners. HTTP owns every durable command; the gateway receives only a service bearer and scoped shared leases, with no catalog, account or database access.

## New local endpoints

| Component | Address | Owner |
| --- | --- | --- |
| API | http://127.0.0.1:15992 | Backend, isolated reviewed-source base |
| Web app | http://127.0.0.1:8133 | App owner |
| Native Metro | http://127.0.0.1:8141 | App owner |
| Gateway | ws://127.0.0.1:4324/api/yepwatch/v1/proposal/realtime | This package |
| Phone peer controller | http://127.0.0.1:8126 | This package |
| Revision/activity broker | redis://127.0.0.1:46401 | Backend-owned isolated Valkey |

Gateway4324 is active, PID2654867 at activation, against API15992's new disposable Crate15982 and isolated broker46401. Controller8126 is active as PID2665854. The API serves a finite real sample:7 DE/Netflix8 candidates (2 movies,5 new shows), with2 known movie viewing durations and honest missing episode durations. This new runtime is guest-only; member access returns501. Runtime evidence records device verification separately. Keep4322/4323, all old simulators, app8132 and Metro8140 unchanged. Do not start duplicate listeners or replace retained controller memory state.

```bash
cd yepwatch-realtime
npm run build
# Prepare ignored mode0600 .poc/proposal-gateway.env from .proposal.env.example.
# Copy ONLY the service bearer supplied privately by the API owner.
node --env-file=.poc/proposal-gateway.env dist/main.js
# Separate terminal; needs no gateway/service credential:
npm run simulator:proposal
```

The native app uses `EXPO_PUBLIC_WS_ORIGIN=ws://127.0.0.1:4324`. Exact gateway Origins are `http://127.0.0.1:4324` (RN endpoint Origin) and `http://127.0.0.1:8133` (browser). No wildcard or Origin override. The native owner handles ordinary USB port forwarding. Native missing Origin still requires a ticket; first-frame ticket redemption, room binding, signed rotating lease, audits, heartbeat, backpressure and1012 drain are unchanged.

## Use the phone with controlled peers

1. Open http://127.0.0.1:8126 and create a fresh room with1–3 artificial peers. The first peer is the host; the operator controls it too. The controller cannot attach to an existing room.
2. On the actual Android app, choose **Join a room** and paste the displayed ordinary invitation. The app inherits the single confirmed couch screen automatically; with multiple screens, choose your screen explicitly. It then sends assignment/readiness for its own confirmed context using ordinary protocol commands. There is no separate guest Ready button and no automatic proposal agreement. A browser may use the displayed8133 invitation link. There is no room-credential transfer or embedded-app dependency.
3. Press **Ready artificial peers + start choosing** in the controller after the joined app has finished automatic context readiness. This host action is unchanged: it requires at least one independently joined person, re-reads the roster and explicitly readies the controlled peers. The API still enforces everyone's protocol readiness.
4. Keep the phone manual. Use each peer's Yep/Nope/Undo, Propose/replace, Agree or Withdraw controls; or enable labelled automatic choosing. Agreement, disagreement and slow-person policies execute real private commands, not fake public counters. Explicit withdrawal pauses that peer until resumed.
5. Add a late peer, pause, disconnect or reconnect to observe real repair. Disconnect preserves required membership and agreements. Late join preserves a pending proposal but prevents Done until the newcomer has joined the current agreement; its lack of votes can temporarily remove the corresponding unanimous match. Undo or Nope can invalidate the proposal.

The controller is localhost-only and authenticated by a per-port HttpOnly cookie, so older8120/8121/8125 cookies remain usable in the same browser. Private bot diagnostics and ordinary invitation codes appear only on the local operator page. Native credentials remain server-side and are never emitted in room activity or logs. Identities and exact pending command envelopes are memory-only. After an uncertain result, Recover retries the same envelope. Fresh replacement is refused during admission or a busy/pending command. A process restart cannot recover those identities; preserve active controllers.

Default controller setup is DE/Netflix8 on the backend's explicitly finite real sample (`YEPWATCH_SIM_CATALOG=real-sample`). The controller supports loopback-only `YEPWATCH_SIM_API_ORIGIN`, `YEPWATCH_SIM_WS_ORIGIN`, `YEPWATCH_SIM_APP_ORIGIN`, `YEPWATCH_SIM_PORT`, plus a positive integer `YEPWATCH_SIM_SERVICE_ID`. No automatic production endpoint or credential discovery. Bot commands omit active exposure timing: artificial pace, random delays and HTTP latency are not human card exposure. Quickest stays unavailable when any required person's valid explicit Yep measurement is missing. The gateway exposes only the complete-roster aggregate, never individual timing.

## Shared data and action-only inspection

Strict nested runtime schemas permit current shared matches with `averageYepMs`, a revisioned proposal with anonymous `agreeCount`/`requiredCount`, and a fresh-checked decision fenced by `proposalVersion`. They reject proposer/approver identities, individual timing, own votes/agreements, current voting cards, old pick fields and unknown nested fields. Canonical viewing duration is explicitly movie or episode scoped; unknown stays null. A pending late-join proposal may remain shared while its all-Yep match is absent.

Existing neutral activity/session envelopes are extended only by:

```ts
inspection: { kind: 'poster', candidateId: 'CURRENT_SHARED_MATCH_ID' }
// Or targetless action cues:
inspection: { kind: 'lens' } | { kind: 'dice' }
```

Inspection requires matches view and actual current matches. Poster scope is checked against the sender's authorized snapshot, again before queued publication, and against each receiving client's current authorized snapshot. A pending proposal that is not a current match is not an inspectable poster. Answer beats require voting view, so they cannot be associated with inspection targets. Proposal and agreement actions produce no named ephemeral agreement event.

Inspection, gesture and answer cues expire at `serverTime+1500ms`; view presence expires within6s and is lease/room bounded. Ordinary view heartbeats contain no inspection pulse. Only actual poster/lens/dice actions produce these cues; there is no random idle activity. Client animations must expire/suppress cues on background, degraded authority or disconnect. Existing sequence/session fencing,4 frames/second with burst8, local participant bounds and250ms coalescing apply. Multi-device sessions expire independently; there is no authoritative global online registry or quorum removal.

## Verification

```bash
npm run build
# Disposable broker/cluster and API fixtures, no retained services:
YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
# Ordinary fresh-room actual15992/4324 integration, once both are ready:
YEPWATCH_TEST_PROPOSAL_LIVE=1 node --import tsx --test test/proposal-simulator.test.ts
# Visible actual app + separate ephemeral controller (never retained8126):
node simulator-proposal/prove.cjs
```

Fixture tests use actual WebSocket clients on two gateways, strict projection checks, scoped inspection, pending late join, pulse expiry, delivery failure and authorized repair. The dedicated real-Valkey test starts only its own disposable broker and compiled gateway. The opt-in simulator test uses the actual API with independent identities for replacement, withdrawal, implied missing timing, late join, undo invalidation, exact-envelope lost-ack repair and automatic fresh-check Done. That Node-native protocol test does not prove a USB Android device; app-owner device evidence must be recorded separately.

Actual API/simulator integration passed2 tests with zero skips. Visible operator proof also passed against the real8133 app:7 actual candidates,36 browser shared frames,10 neutral activity frames, zero JavaScript errors/private product fields. The manual browser was an independent phone-UI surrogate, not an Android claim. `artifacts/proposal-simulator-visible.json` records the journey; screenshots `proposal-simulator-independent.png`, `proposal-simulator-replacement-withdrawal.png`, `proposal-simulator-latejoin.png`, `proposal-simulator-done.png` and `proposal-simulator-manual-browser-done.png` show the actual controller and product UI. Invitations are masked. The proof starts/stops only its own ephemeral controller and never accesses retained8126 state.

Final combined verification: `YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 YEPWATCH_TEST_PROPOSAL_LIVE=1 npm test` passed39 tests, zero failures, with2 old retained continuous-stack opt-in tests deliberately skipped. Build/typecheck and JavaScript syntax checks passed. New proposal tests use actual authenticated WebSocket clients plus the real new API/Crate integration; recovery/compiled-start tests also use explicitly disposable API fixtures and Valkey. No new dependency was added. Gateway4324 serves bundle SHA256 `0fcab04e0f4577152b058980390a41b42cc3bcb7cd1cc4430034f90817685011`; `artifacts/proposal-source-manifest.json` pins the exact implementation and portable contracts separately from runtime/evidence records.

Production path routing/TLS, public exposure and deployment remain outside this local task. Later route only the proposal realtime upgrade/health paths to the new listener, keep commands in the API and protect the internal service hooks independently. No proxy, firewall, DNS, registration or production changes are made here.

### Live poster pointers

New clients opt in with `pointers: true` at authentication. Proposal activity optionally carries `pointer: {x, y, pressed, kind}` with normalized coordinates in [0,1], or null on release. This field is voting-view-only, is removed after 1.5 seconds, and is stripped for older clients. Client motion samples are bounded to one per 280ms; rendering interpolates between them. Heartbeats contain no pointer. Clients hold the horizontal contact coordinate during pressed voting gestures; no title, vote direction, or answer is sent. Peers receive identical neutral answer reactions.

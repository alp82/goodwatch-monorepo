# YepWatch realtime gateway

Isolated Node 24 / ws service. Durable mutations, account/catalog access, room credentials and private own state belong to the YepWatch HTTP API. This gateway has no Crate adapter, database credentials, OAuth implementation, HTTP room commands or UI. Only files in this directory are owned by this slice. No deployment configuration is included.

## Shared proposal flow

The isolated contract3 gateway and Android peer simulator are documented in [README-proposal.md](./README-proposal.md). Existing gateway modes and retained rooms remain separate.

## Continuous Glow v2

The additive contractVersion2 gateway and separate simulator are documented in [continuous transport/runbook](README-continuous.md). New local stack uses API15994, WS4321, app8131 and latest fixed simulator8124 (first continuous8122 retained). Legacy round-based rooms and controllers below remain separate and running. The first new integration uses disposable Crate with an explicitly synthetic catalog. A separate finite real-catalog stack now runs API15993/WS4322/app8132 with the latest real simulator at **http://127.0.0.1:8125**;7 real cards/6 trailers and a three-to-four-client visible flow passed. Both gateway/admission and simulator-config independent reviews passed. See the runbook for exact commands, evidence and sample limits.

## Solo multiplayer demo

The latest fixed instance is **http://127.0.0.1:8121**; start it with `YEPWATCH_SIM_PORT=8121 npm run simulator` if stopped. It can share a browser profile with original 8120 because control-cookie names are scoped by instance port. Open it to create a fresh demo with one to three clearly labelled artificial guests beside the actual host app. Automatic/manual steps, agreement, empty-shortlist disagreement, slow-person pacing, pause/resume and disconnect/reconnect use real independent API/WS identities. See [simulator instructions and evidence](simulator/README.md). Existing rooms/services are never selected or reset.

## Local build and run

From the monorepo root:

```bash
cd yepwatch-realtime
npm ci
npm run build
cp .env.example .env
# Populate YEPWATCH_GATEWAY_SECRET locally with the API's service secret.
# Start the API separately; set YEPWATCH_API_ORIGIN to its origin.
npm start
```

Default listener: `127.0.0.1:4311`. Startup refuses non-loopback binds. `npm run dev` uses tsx. The build typechecks sources/tests and bundles the local `file:../goodwatch-webapp/packages/yepwatch-contracts` TS entrypoint into `dist/main.js`; ws, ioredis and Zod remain runtime dependencies. It does not require Node to load uncompiled TypeScript from node_modules. No root workspace changes.

Optional **disposable** standalone bus (choose a free local port/name; never point fault tests at an existing service):

```bash
docker run --detach --rm --name yepwatch-realtime-dev-valkey \
  -p 127.0.0.1:46379:6379 valkey/valkey:8.1 \
  valkey-server --save '' --appendonly no
# After finishing local development, remove only that container:
docker stop yepwatch-realtime-dev-valkey
```

The gateway never logs request URLs, frames, tickets, signed leases, response bodies, participants or service credentials. The only startup message names the loopback port. Don't enable ioredis DEBUG logging with real credentials. Store secrets in local environment or ignored `.env`; never in Expo public settings.

| Environment | Meaning |
| --- | --- |
| `YEPWATCH_REALTIME_HOST` | `127.0.0.1` default; only loopback accepted |
| `YEPWATCH_REALTIME_PORT` | `4311` default |
| `YEPWATCH_API_ORIGIN` | `http://127.0.0.1:3000` default; origin only, no path/query/userinfo; trusted service endpoint |
| `YEPWATCH_GATEWAY_SECRET` | Required, at least 32 characters, same service bearer secret as API |
| `YEPWATCH_ALLOWED_ORIGINS` | Comma-separated browser origins; default localhost and 127.0.0.1 on port 8081 |
| `YEPWATCH_VALKEY_URL` | Standalone bus URL; default `redis://127.0.0.1:46379` |
| `YEPWATCH_VALKEY_NODES` | JSON array of `{host,port}` master discovery seeds; selects cluster mode over URL |
| `YEPWATCH_VALKEY_USER`, `YEPWATCH_VALKEY_PASSWORD` | Optional bus credentials; no DB credentials |

`GET /api/yepwatch/v1/realtime/health` returns 200 only after a confirmed subscriber ACK and while not draining; 503 otherwise. This checks delivery readiness, **not API/Crate health**. Individual authority failures mark affected clients degraded. All other non-upgrade HTTP paths return 404.

## Confirmed transport and authority contract

Coordinated directly with backend owner **S69:P50ai:G9wjs** and frontend owner **S69:P50ai:G8x8t**. Shared contracts are read-only dependencies; the backend owner added the internal interfaces/paths and `Shortlist.proposalVersion`.

1. Authenticated browser/native HTTP `POST paths.realtimeTicket(roomId)` issues `RealtimeTicket`. Backend owns credential/Origin/CSRF checks, durable one-use consumption and ticket expiry (30 seconds). Native requests use the existing documented room bearer credential/participant header; browser uses cookies.
2. Open `ws://127.0.0.1:4311/api/yepwatch/v1/realtime`. Expo can set `EXPO_PUBLIC_WS_ORIGIN=ws://127.0.0.1:4311`. Browser Origin must be allowlisted. A native connection may omit Origin, but always needs a valid ticket. No URL/query/subprotocol credentials: query strings and subprotocols are rejected entirely.
3. First application frame: `{"type":"authenticate","ticket":"<one-use HTTP ticket>","roomId":"<room>","lastRevision":null}`. `lastRevision` can be a previous safe integer; every reconnect gets a fresh full snapshot rather than event replay.
4. Gateway calls service-authenticated `POST paths.realtimeAttach`, exactly `/api/yepwatch/v1/realtime/internal/attach`, with `{ticket,roomId}`. Response `RealtimeAttachment`: `{roomId,participantId,lease,leaseExpiresAt,roomExpiresAt,capabilityEpoch,scope:"shared:read"}`. Numeric participant epoch; lease <=60 seconds and capped by room expiry.
5. Only after the global Valkey subscription ACK, gateway calls `POST paths.realtimeView`, exactly `/api/yepwatch/v1/realtime/internal/view`, with `{roomId,lease}`. `RealtimeViewResponse` contains **all attachment fields including a renewed signed lease**, plus `snapshot: SharedRoomSnapshot`. API rechecks durable membership, epoch, expiry and scope on every view. Gateway verifies all bindings, bounded expiry, unchanged participant/epoch and strict response shape. No generic storage/catalog endpoint is used. Both internal requests use `Authorization: Bearer <service-secret>`; redirects are refused.
6. Server frames are the shared contract's `room.snapshot`, `room.updated`, `degraded`, `restarting`, `error`, `pong`. Client may send `{type:"ping"}` after authentication; commands remain HTTP. Clients should say live only after a snapshot, show degraded/reconnecting explicitly, reconnect with jitter/backoff and a **new** ticket, and recover private pending state through authenticated HTTP. Full snapshots can skip revisions. No normal client polling.

Only a runtime-validated `SharedRoomSnapshot` reaches the socket. All objects are recursively strict, including candidates/episode identities, explicitly public host episodeProposals, provider offers, public participant activity, shortlist/consent count and decision. Unexpected own data, receipts, votes, history, individual consent, current card or participant-to-title/direction fields invalidate the entire projection; the gateway forwards no cached room payload when authority fails. Shortlist/decision before round completion is rejected. Shared deck/shortlist/decision identities are intentional shared content. The API is trusted for field semantics (for example, a title string must actually be a title); validation cannot detect private information deliberately embedded in an allowed string. Small-group outcome inference remains possible.

## Delivery, repair and presence

Valkey channel is the contract's `REVISION_CHANNEL = yepwatch:v1:revision`. Payload is strictly `{roomId,revision}` only. Unknown rooms, malformed messages, duplicate/older hints are ignored. Room hints are coalesced; no per-vote event trail or unbounded history is held.

Subscribe-before-read closes attachment races: a hint received during an in-flight snapshot raises the room's target revision; reads below that target are not sent. Bounded retries obtain a current projection; a future/unreadable revision leaves the connection degraded until the next hint/audit. Across bus state transitions, an epoch fences in-flight reads. Recovery first re-ACKs subscription then resnapshots. Monotonic per-socket revisions prevent rollback. Bus outages never become silent successful realtime.

The server audits only bounded active rooms every 10 seconds, with at most eight rooms running authorization/projection work simultaneously. Each socket gets its **own scoped authorized API read**, renewed lease and expiry timer; no participant can borrow somebody else's authorization. This repairs lost hints/revocations without client polling. API-side pending mutation markers, durable publication/retry/recovery and storage correctness remain API responsibilities. Pub/Sub is at-most-once and API commits may coalesce; no exactly-once or event replay guarantee. Under load, the audit queue can take longer than its nominal interval; hard lease/room expiry still closes access. A network partition cannot recall previously delivered data.

Cluster mode uses ioredis public master discovery, with a separate directly observable subscriber on one master and global non-sharded Pub/Sub. Publications on other masters propagate to it. This avoids ioredis Cluster hiding a subscriber-only replacement. Subscriber failure marks delivery degraded, selects another discovered master and resnapshots after ACK. Every two seconds a bounded subscription re-ACK checks the actual subscriber connection for silent failures. Complete cluster broadcast topology/partition health cannot be inferred from a local subscription ACK; the independent API audit repairs missed revisions. Cluster mode assumes routable announced node addresses and matching credentials; private/TLS production routing is outside this development package.

**Presence is conservatively `unknown` for every participant on every gateway**, overriding API presence hints. There is no shared presence registry in this implementation, so it does not claim online/offline based on a single device. Closing one socket/gateway does not mark somebody offline while another is connected. No timer creates pretend progress/activity. Disconnect never removes a required voter, changes readiness, supplies consent, updates history or mutates durable membership. Neutral readiness, included/waiting participation, completed counts, frozen round and consent count come only from API projections. API/catalog owns couch/remote/mixed screens, optional guests/members, full catalog coverage and movie/show-start/show-continue progress; the gateway neither restricts nor fabricates them.

## Bounds and shutdown

Defaults: 512 total sockets, 32 per peer IP (proxy headers are not trusted), four per participant per gateway, 128 active rooms, 128 sockets per room, eight concurrent room refreshes, 8 KiB incoming messages, 2 MB outbound queue/frame bound and API response bound, 3 seconds for first-frame authentication and API requests, exactly one preauth application frame, 20 incoming application/control frames per 10 seconds, at most two unauthenticated control frames, 32 fragments per message and 64 buffered receive chunks. No compression. Room/projection arrays and strings also have runtime bounds. Heartbeat sends protocol ping every 20 seconds; missing pong on the next heartbeat terminates. Slow or oversized sends close 1013; stalled close handshakes are forcibly terminated after 500 ms. A severely blocked transport may observe 1006 instead of the queued close code. Too-large incoming payloads close 1009.

These are development gateway resource limits, not new catalog coverage limits. An oversized valid projection degrades/closes explicitly; production limits need load/payload measurements and alignment with API room caps. Participant/IP caps are per process; aggregate admission/rate limits across gateways belong in later deployment/API work. No forwarded-IP spoofing or sticky-session correctness dependency.

SIGINT/SIGTERM stops readiness/upgrades, sends `restarting`, closes sockets with 1012 aborts in-flight internal API fetches and drains for at most 500 ms before termination. Existing sockets retain no authoritative state. Clients reattach anywhere using fresh tickets. HTTP server shutdown explicitly handles upgraded sockets. `createGateway().stats()` exposes only counts of connections, active rooms and backpressure closures for local tests/embedding; it contains no room/participant/choice identifiers.

## Verification

```bash
cd yepwatch-realtime
npm ci
npm run build
npm test
# Also run disposable real Valkey standalone + three-master cluster fault tests:
YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
# Include actual backend HTTP/service + two gateways (memory repo/synthetic catalog):
YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
```

The optional image flag creates uniquely named containers, binds standalone ports to loopback, and runs the three-master test container with host networking but each Valkey server bound to loopback and reserved client/bus ports. It stops/restarts/removes **only its own** containers. It never accesses existing Valkey data. Docker/image access is required. The compiled executable test requires `npm run build` first. Without the image flag these Docker tests are explicitly skipped, not claimed as verified.

Observed on Node 24.15.0, npm 11.12.1, local Valkey 8.1: build/typecheck passes; **19 tests pass with zero skips** using both opt-in flags. Actual WebSocket clients cover invalid/replayed/expired tickets, room/Origin binding, missing Origin with ticket, absent authority, unauthenticated timeout/frame budget, nested private-field rejection, duplicate/out-of-order/gap hints, subscribe/snapshot race, bus disconnect/recovery, missed notification audit, lease renewal/expiry/revocation, room expiry, payload/connection bounds, heartbeat, output bounds and a paused real socket reader hitting backpressure. Two simultaneous gateway instances share disposable real Valkey. The cluster test publishes from all three masters and kills only subscriber connections, proving degraded/resnapshot repair. The standalone test also spawns the **compiled `node dist/main.js` executable**, obtains a snapshot, checks health, sends SIGTERM during a held internal API fetch and observes 1012/clean bounded process exit. Fixture tickets/leases/API storage are explicit test doubles; these checks do not prove Crate or the real API's ticket security.

The opt-in `test/backend.integration.test.ts` starts the backend owner's **actual** local HTTP handler/domain service in its own subprocess, with an independent memory CAS repository and explicitly synthetic catalog, plus disposable Valkey and two gateway instances. It verifies native and browser-cookie HTTP ticket issuance, service-authenticated attach/view, replay rejection, couch/remote screens, guest movie/show-start candidates, hostReady start, neutral completed counts without vote fields, completion before shortlist, proposal/consent/decision, and a committed new round during bus outage followed by repair. It also checks that continuation setup, public episode proposal and private progress reads return 403 member_required; every deprecated manual-progress input state returns 400 invalid_request with structured recovery details; denials leave the room and nextSequence unchanged; and member sign-in remains honestly 501 not_implemented. No private keys appear in any captured WS frame. Integration exposed extra fixture episode fields; the backend owner corrected both the fixture and the actual nested shared projection instead of relaxing validation.

No production proxy, TLS, mobile-device, live Crate, actual account/OAuth, full catalog coverage, sustained load/latency, multi-host partition or deployment test is claimed. Real-handler integration uses injected memory storage and synthetic catalog, so it does not verify those production adapters.

To run the confirmed backend development server yourself, from the monorepo root, first set independent local secrets without printing them. The API requires both; the gateway requires only `YEPWATCH_GATEWAY_SECRET`:

```bash
export YEPWATCH_SECRET  # Set locally to an independent >=32-character API signing secret.
export YEPWATCH_GATEWAY_SECRET  # Set locally to the shared >=32-character service secret.
YEPWATCH_LOCAL_FIXTURES=1 YEPWATCH_LOCAL_PORT=15989 \
  YEPWATCH_REVISION_REDIS_URL=redis://127.0.0.1:46379 \
  node --experimental-transform-types goodwatch-webapp/app/server/yepwatch/local-test-server.ts
```

In another shell, run the gateway with that same service secret, `YEPWATCH_API_ORIGIN=http://127.0.0.1:15989` and `YEPWATCH_VALKEY_URL=redis://127.0.0.1:46379`. The API and gateway must allow the same browser Origin; default API allows `http://localhost:8081`. Commands and integration details were sent to the frontend owner. Automated tests stop all their own processes/containers; they do not leave a development service running.

## Later deployment routing

A future proxy must route the **exact** `/api/yepwatch/v1/realtime` WebSocket upgrade to gateway instances and preserve Origin/Upgrade/Connection, with appropriate idle timeouts and no response caching or established-socket retry. Route ordinary `/api/yepwatch/v1/**` HTTP commands/tickets to Remix. Keep `/api/yepwatch/v1/realtime/internal/attach` and `/view` service-only with bearer authentication; do not expose service credentials to browsers. Health is gateway-only. Rolling drains need a stop deadline exceeding the configured bound. Production listener/TLS/proxy/rate limits, firewall comments, credential distribution and DNS are separate authorized infrastructure work; none was changed here.

Primary references used: [ws API](https://github.com/websockets/ws/blob/master/doc/ws.md), [ioredis cluster and Pub/Sub](https://github.com/redis/ioredis#cluster), [Node HTTP shutdown](https://nodejs.org/api/http.html#serverclosecallback). Applicable repository context: root CONTEXT, Valkey ADRs 0003/0004, episode identity ADR 0012 and `docs/research/yepwatch-architecture-proposal.md`.

## Connected app POC handoff

At the app owner's request, an independent loopback POC set was started and retained for the three-browser UI smoke check: API `http://127.0.0.1:15997`, gateway `ws://127.0.0.1:4317/api/yepwatch/v1/realtime`, disposable Valkey `127.0.0.1:46397` (container `yepwatch-realtime-poc-4317`). Both API and gateway allow only the POC app Origin `http://127.0.0.1:8099`. API metadata and gateway readiness returned 200. These manually retained processes are separate from the automated tests and use memory storage/synthetic catalog only. UI smoke results belong to the app owner's handover.

Locally generated secrets/config are in ignored `.poc/api.env` and `.poc/gateway.env` with mode 0600. Never publish their contents. Restart commands from the repository root if those local files still exist:

```bash
node --env-file=yepwatch-realtime/.poc/api.env --experimental-transform-types \
  goodwatch-webapp/app/server/yepwatch/local-test-server.ts
node --env-file=yepwatch-realtime/.poc/gateway.env yepwatch-realtime/dist/main.js
```

Keep this POC set running until the app owner's handover or explicit done message. Then SIGTERM only these two Node processes, stop only `yepwatch-realtime-poc-4317`, and remove the ignored `.poc/` local secrets when no longer needed. Nothing here changes existing services or production routing.

Historical app-owner connected POC report, before the newer guest policy: **PASS**, three independent browser contexts, mixed two-screen group, canonical episode approval, movie/show-start/show-continue, independent own cards, reload/private-state recovery with a fresh socket, completion before shortlist, all-client consent and decision. Owner reported 85 shared frames and zero JavaScript errors; artifacts are `yepwatch-app/artifacts/connected-poc.json` and `connected-poc-*.png`. This UI evidence was produced by the app owner, distinct from gateway-owned automated tests. Memory/synthetic catalog limits remain explicit. The app owner requested retaining the local suite for orchestrator handover; do not stop it merely because the UI smoke completed.

A second gateway was requested for the real-title-sample POC: `ws://127.0.0.1:4318/api/yepwatch/v1/realtime` targets backend-owner API `http://127.0.0.1:15996`, permits `http://127.0.0.1:8099`, and shares the disposable revision bus on `46397`. Its local service-secret config is ignored `.poc/gateway-real-sample.env` (0600). The synthetic gateway on `4317` remains running. Gateway bus health alone does not establish that API `15996` or its real-sample catalog adapter is ready; an authorized ticket/snapshot smoke is required after backend confirmation. The real-title sample remains distinct from full catalog coverage and still uses memory room state, with no production room/table writes.

Privacy contract update: shared `episodeProposals` contains only explicitly host-proposed `{showId,episode:EpisodeIdentity,version}`. It is required and strictly validated, including every nested episode field. The gateway does not infer a proposal from private progress. Historical integration before the newer guest policy proposed an episode through the host-only HTTP command before each person submitted private progress/approval; those guest commands are now rejected by the API. A new WebSocket regression permits the explicit public proposal and rejects private progress fields embedded inside it. The historical 19-test run passed that prior contract slice, including explicit host proposals before private approvals. Current 19-test evidence instead exercises movie/show-start guests and denial of continuation/manual history, as described above. Running retained POC processes are intentionally not hot-reloaded by builds.

The backend owner subsequently started API `15996` with the same service secret and revision bus. Authorized browser smoke **PASS** on `4318`: Origin `8099` cookie admission returned no usable JSON bearer, HTTP ticket issuance succeeded, and the gateway delivered a strictly validated `room.snapshot` with required `episodeProposals`. Gateway health returned 200. Sanitized local evidence is ignored `.poc/real-sample-gateway-smoke.json`; the probe created only a disposable memory room. Frontend was sent the integrated READY signal. Gateway `4318` is retained (PID at handover: `3698029`); backend API process is owned by the backend thread. Synthetic `15997`/`4317` remain untouched.

At that ready signal, backend reported real canonical Breaking Bad continuation on DE/Netflix 8 working, but the title-sample snapshot on `15990` was empty after sampler timeout: real movie/show-start deck evidence remained unavailable pending backend seeding. The gateway's successful setup snapshot proves authenticated transport, not real candidate coverage or the subsequent real-title UI journey. Preserve that distinction in the app handover.

Backend follow-up: the local title snapshot on `15990` is now populated with **36 actual catalog records**, obtained by indexed name queries and primary-key reads, with no synthetic/padded IDs. API `15996` still uses memory room state and may read that finite sample on its next retry. The app owner is running a full-mode UI smoke; results remain owned by that thread. This supersedes the earlier empty-sample status, without establishing access to the private production full snapshot or full catalog coverage. Gateway `4318` needs no restart for catalog sample updates.

Real-client port separation: gateway `4318` now allowlists **both** `http://127.0.0.1:8099` and `http://127.0.0.1:8100`; backend owner restarted only real API `15996` with the same allowlist. Authorized browser-cookie admission → HTTP ticket → strict shared WS snapshot from Origin `8100` **PASS**. Sanitized local evidence is `.poc/real-sample-gateway-smoke-8100.json`. The API restart resets its memory rooms, so the separate real app export on `8100` must create fresh rooms. Retained synthetic API `15997`, gateway `4317` and app `8099` were not restarted by this thread.

Historical app-owner real-sample UI handover, before the newer guest policy: **PASS** at real app `8100`, three clients on two mixed viewing screens, eight real candidates across all three media kinds, an explicit public host episode proposal followed by private approvals, injected private-refresh failure/manual recovery, round completion before shortlist, all-client consent and a fresh final decision. Owner reported **133 shared frames and zero JavaScript errors**; final docs/evidence are under `yepwatch-app/`. This supersedes the earlier pending real-candidate/UI status. It proves the visible POC over the finite real-title sample and memory rooms, not production full catalog/storage coverage. Both gateways and the independently retained synthetic/real services remain running for orchestrator handover; the frontend explicitly requested retention after its successful smoke.

Guest-policy POC stack: a separate gateway `4319` targets fresh API `15995`, shares only the disposable revision bus `46397` and the existing service secret, and permits Origins `http://127.0.0.1:8097` and `http://127.0.0.1:8101`. Configuration is ignored mode-0600 `.poc/gateway-guest-defaults.env`. Origin `8097` authorized browser-cookie admission → ticket → strict shared WS snapshot **PASS**, with default kinds exactly `movie` and `show_start`. No restart or mutation was performed against retained user API `15996`, gateway `4318` or app `8100`.

The newer HTTP policy forbids guest manual history and gates continuation with `member_required`; member authentication is not implemented. Optional `start_round.hostReady` and typed HTTP failure details do not change gateway attach/view or shared WS validation. Gateway error types are imported from the portable contract, with no duplicate ErrorCode enum to update. Earlier all-three-kind/manual-progress positive integration evidence predates this policy and must not be represented as current guest behavior. The new `8101` API Origin initially returned 403 pending backend allowlist confirmation; gateway admission already allows it.

Backend owner then restarted only `15995` with both Origins enabled. The `8101` authorized browser-cookie → ticket → strict shared WS snapshot smoke now **PASS**, confirming defaults `movie`/`show_start`; frontend received READY. The earlier Origin 403 is resolved. Gateway `4319` remains running; no further fresh-stack restarts without owner coordination. Retained `15996`/`4318`/user `8100` were untouched.

Current guest-policy verification update: build/typecheck and the complete **19-test suite pass with zero skips** after migrating actual-handler integration to movies/show-start and `hostReady:true`. Denial assertions use the actual HTTP contract: 403 `member_required` for guest continuation setup, public episode proposals and private progress reads; 400 `invalid_request` with `manual_progress_not_supported` details for all deprecated manual progress inputs; 501 `not_implemented` for member sign-in. Denials preserve room state and command sequence. The positive path still covers two gateways, neutral progress, round completion, shortlist, consent, decision and bus outage repair. Tests used fresh disposable API/Valkey processes only; retained `15995`/`4319`, `15996`/`4318` and user room were not restarted or modified. Earlier all-three-kind/manual-progress/UI reports remain historical evidence of the prior scope, not current guest authorization.

Fixed simulator activation: latest private-repair and cookie-isolation fixes are active on **8121**, PID `3145807`, in an independent process. Original pre-fix **8120**, PID `2852397`, remains untouched with its memory demo/pending state. The new controller uses `yepwatch_sim_control_8121` and preserves the original generic cookie, so both controls work in the same browser profile. Host room-cookie forwarding is unchanged. Before replacement, 8121 was confirmed empty; all other app/API/gateway processes and retained rooms remain unchanged. See simulator README and `artifacts/simulator-cookie-isolation.json` for the two-instance shared-cookie-jar regression, live controls, hashes and PID evidence. Earlier `simulator-8121-activation.json` describes the superseded initial activation.

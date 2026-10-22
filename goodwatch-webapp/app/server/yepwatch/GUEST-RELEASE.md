> Superseded deployment topology: current source supports shared Redis and GoodWatch account linking, and uses stable table names. See [SCHEMA.md](SCHEMA.md) and [shared-services setup](../../../../yepwatch-realtime/release/SHARED-SERVICES.md). Earlier evidence below remains historical.

# Guest-only proposal 3 private beta

Prepared 2026-10-22 from clean committed `779a2752`, with read-only release r3 integrated as `d3702ac1` and separate capacity-control r4, separately from the dirty main checkout and frozen unreviewed member refresh. This is a deployable guest runtime and operator procedure, **not a production deployment or auth/retention signoff**. Hosting/container/proxy files belong to `yepwatch-realtime/release/`; no existing process, physical tester room, issuer, client registration or key is migrated by these commands.

## Build and process interface

From the clean `goodwatch-webapp` build context with its committed dependencies installed:

```sh
node app/server/yepwatch/build-release.mjs
cd build/yepwatch-release
npm ci --omit=dev --no-audit --no-fund
node server.mjs
```

The final read-only-source candidate supersedes the preserved r1/r2 cache-connected rehearsals. Earlier r1 functional reads could populate ordinary derived cache entries; that behavior is not part of this final release. No production room/account/issuer writes were made.

The build directory is self-contained: `server.mjs`, `operator.mjs`, **`title-snapshot.worker.js`**, `package.json`, `package-lock.json`. Preserve these adjacent paths. Optional `build-evidence.json` records the input graph and exact runtime dependencies. The generated lock is a subset of the committed lock, with no dependency upgrades: seven direct/25 total packages in this build. The worker uses the existing snapshot checksum/format validation and keeps preparation off the main thread. No dev runner, fixture identity, sample catalog, local issuer, auth runtime or refresh module is in the release input graph; the build refuses those inputs.

The small shared `title-snapshot/index.server.ts` seam accepts an explicit `get`/`getBuffer` reader only before the first load; default webapp single/cluster loading and stop behavior are unchanged. The release owns/disconnects its injected source connection.

Runtime command: `node build/yepwatch-release/server.mjs`, Node 24, `HOST=0.0.0.0`, `PORT=3000`. Image packaging is owned by the hosting thread; no full Remix build, query models or startup downloads are needed. Existing catalog modules are bundled; third-party packages come only from the generated lock. The optional Qdrant client dependency is inherited by existing filter helpers, but this guest popular/snapshot flow requires no Qdrant configuration or issuer connection.

`proposal-guest-catalog.server.ts` delegates the existing full catalog/filter/evidence/presentation methods. It does not enable member login or continue-show history. Guest defaults remain movies + new shows; member entry returns the existing honest unconfigured response. No account database or watch-history writes occur.

## Configuration

Secrets support either `NAME` **or** `NAME_FILE`, never both. Named files are read once before any catalog module is imported; one final newline is stripped. Do not provide an empty direct environment value alongside a `_FILE`. Keep the room key stable across replicas/restarts and store a recoverable copy separately from SQL backups.

| Setting | Purpose |
| --- | --- |
| `YEPWATCH_PROPOSAL_PUBLIC_ORIGIN=https://yepwatch.com` | Exact public HTTPS origin, no trailing slash |
| `YEPWATCH_PROPOSAL_ALLOWED_ORIGINS=https://yepwatch.com` | Optional explicit assertion of the same single browser origin; other values rejected |
| `YEPWATCH_PROPOSAL_CRATEDB_ORIGIN` | Private room-store HTTP(S) origin, distinct from catalog configuration |
| `YEPWATCH_PROPOSAL_CRATEDB_USERNAME`, `YEPWATCH_PROPOSAL_CRATEDB_PASSWORD_FILE` | Runtime room role and mounted password |
| `YEPWATCH_PROPOSAL_SECRET_FILE` | Independent room identity/lease/encryption key, at least 32 characters |
| `YEPWATCH_PROPOSAL_KEY_ID` | Stable operator name for that key/store; not the key itself |
| `YEPWATCH_PROPOSAL_GATEWAY_SECRET_FILE` | Independent API service bearer shared only with the gateway |
| `YEPWATCH_PROPOSAL_REVISION_REDIS_URL_FILE` | Dedicated password-bearing room fanout URL; never the catalog cache credential |
| `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER`, `CRATE_PASS_FILE` | Existing private full-catalog SQL reader |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS_FILE` | Existing full-catalog cache/snapshot cluster seed and credential |
| `REDIS_HOST2`, `REDIS_HOST3` | Optional additional seeds; omitted seeds reuse the first and the client discovers cluster peers |
| `REDIS_COMMAND_TIMEOUT_MS` | Existing cache deadline; local remote-network proof used 30000 ms; size for the actual private-network path |
| `YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS` | Enforced active reservations, default 20, configurable 1–100 |
| `YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE` | Global new create/join grants, default 20, configurable 1–120 |
| `YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE` | Global new command grants, default 600, configurable 1–2400 |
| `YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE` | Authenticated participant command grants, default 60, configurable 1–120 |
| `SOURCE_COMMIT` | Exact deployed commit/build label, exposed by health |
| `YEPWATCH_PROPOSAL_PROBE_MS` | Dependency probe interval, default 5000 ms |
| `YEPWATCH_PROPOSAL_SHUTDOWN_DELAY_MS`, `YEPWATCH_PROPOSAL_DRAIN_MS` | Default 8000 ms proxy removal delay + 12000 ms request drain; hard exit 25000 ms |

Release rejects `TITLE_SNAPSHOT_REDIS_URL` and local fixture/issuer/installer flags. It never loads `.env` implicitly. Supply the existing catalog cluster configuration explicitly. The full snapshot includes a smaller reference pool internally; YepWatch's existing ranked-key adapter uses the full snapshot universe, not that pool or the old 36-record development sample. No country/service launch shortlist is added.

Catalog/snapshot traffic needs the private Crate HTTP port and all cluster-discovered cache node ports, not merely one seed. The release captures source connection settings, removes general `REDIS_HOST*`/password configuration **before** helper imports, rejects single-cache overrides, and injects only GET/getBuffer into the snapshot loader. Startup and each dependency probe refuse an early-initialized general writer. Countries/episodes/details cache misses therefore read SQL or existing process memory, without shared derived-cache writes. No production MONITOR/ACL changes or credential permission audit was performed; the proof concerns the application connection/import path.

Gateway needs only its service bearer, internal API origin and dedicated fanout credential. It never receives room keys or catalog SQL/source-cache credentials. A dedicated derived cache is not required for this functional private-beta candidate: one cold 20-card flow including final choice took 7858 ms, and metadata requests took 205/192 ms with shared caches disabled on this development connection. This is not a concurrency/capacity result. Expect more SQL work on cold/repeated helper reads; monitor query rate and start/refill latency during a small beta. If measured load warrants caching, introduce an explicitly isolated release cache in a separate change; never re-enable the source shared writer as a shortcut.


## HTTP routing, readiness and shutdown

- Public app/browser fallback: `https://yepwatch.com`; ordinary API under `/api/yepwatch/v1/proposal/`; exact WebSocket path `/api/yepwatch/v1/proposal/realtime` goes to the dedicated gateway.
- **Do not publicly route `/api/yepwatch/v1/proposal/realtime/internal/*`.** Attach/view are container-network service-bearer hooks. Keep the API listener private and route only the intended public HTTP paths. Proxy/TLS/association-file/browser-fallback ownership stays with hosting/app threads.
- `GET /api/yepwatch/v1/proposal/health/live` reports event-loop liveness. `GET /api/yepwatch/v1/proposal/health/ready` returns 200 only after a real nonempty snapshot, catalog SQL/schema reads, room schema/key metadata, matching durable capacity controls and fanout ping all pass. It stays 503 indefinitely when a startup dependency is missing; there is no webapp-style timeout-to-green. Before first successful preflight it admits no rooms. Later dependency failures remove it from readiness while recoverable room reads/commands remain governed by their real stores.
- Probes are coalesced and cached. Failed/stale probes stay red; health carries coarse dependency names/build/mode only, not room IDs, votes, secret values or backend addresses. Readiness establishes usable dependencies, **not** comprehensive current offers/episode entitlement.
- SIGTERM immediately turns readiness red, keeps serving during the proxy-removal delay, then closes the listener and drains. Idle connections close; the bounded drain cuts lingering connections. Pending writes retain the existing exact-envelope/CAS recovery semantics. Repair/snapshot/cache/bus loops stop. Set container stop grace above 25 seconds (for example 30 seconds); the hosting health cadence/removal window must fit the delay. There is no new WebSocket server in this process.
- Runtime emits only coarse process lifecycle messages; it adds no request path/body logging. Avoid capability-bearing invite paths and request/query/body logging in proxy/operator tooling too. Existing catalog-query diagnostics are distinct from private vote payloads.

## Explicit provisioning: prepare/review, do not run on production yet

No runtime startup DDL or schema migration runs. Use a separate operator environment/credential and the same intended key/key ID. The command below creates `doc.yepwatch_room_v3`, the small `doc.yepwatch_room_v3_runtime` compatibility record and one `doc.yepwatch_room_v3_control` aggregate. Existing record mismatch fails rather than rewriting the store or rotating a key.

```sh
# Operator context, after reviewing target origin, key backup and cluster capacity:
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs provision --apply
# Switch to the restricted runtime credential for the read-only check:
node --env-file=/private/yepwatch-api.env build/yepwatch-release/operator.mjs check
```

Production provisioning defaults to 2 replicas and waits for 3 active shard copies; the existing installer uses 4 room shards plus 1 shard per related table. Confirm the intended three-node cluster and capacity first. For an **explicitly disposable loopback** single-node rehearsal only, add `--disposable-single-node`; it is refused for a non-loopback origin. A container rehearsal can run the operator on the host against its published loopback Crate port, or share the disposable Crate container's network namespace with origin `http://127.0.0.1:4200`.

Create roles/passwords through the established operator mechanism, with secrets supplied as parameters/private files, not shell-history SQL literals. The intended grants to existing roles are:

```sql
GRANT DQL, DML ON TABLE
  doc.yepwatch_room, doc.yepwatch_participant, doc.yepwatch_vote,
  doc.yepwatch_proposal, doc.yepwatch_agreement, doc.yepwatch_decision,
  doc.yepwatch_screen, doc.yepwatch_candidate, doc.yepwatch_command_receipt,
  doc.yepwatch_ticket, doc.yepwatch_member_grant, doc.yepwatch_member_intent,
  doc.yepwatch_control TO yepwatch_runtime;
GRANT DQL ON TABLE doc.yepwatch_runtime TO yepwatch_runtime;
GRANT DQL ON TABLE
  doc.movie, doc.show, doc.episode, doc.imdb_episode, doc.country,
  doc.streaming_service, doc.streaming_availability, doc.streaming_evidence,
  doc.movie_series, doc.season, doc.person, doc.person_appeared_in,
  doc.person_worked_on, doc.media_image, doc.media_video
TO yepwatch_catalog;
```

These are prepared role/table grants, not executed or independently reviewed production access. There is no schema-wide account-data grant. Catalog optional presentation reads require their referenced catalog tables; no user tracking tables are needed for guest episode lists. Crate's table-level `DML` also includes DELETE, so this is **not** a claim of SQL-enforced INSERT/UPDATE-only privilege; application code exposes no deletion endpoint. DQL/DML/DDL distinctions and syntax checked against official [Crate 5.10 privileges](https://cratedb.com/docs/crate/reference/en/5.10/admin/privileges.html) and [GRANT](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/grant.html), accessed 2026-10-22.

The metadata record detects a mismatched deployment key/config before serving rooms. It does not implement a keyring, automatic key rotation or a complete key-lifecycle policy. Back up the key/key ID independently; replacing the secret makes existing credentials/ciphertext incompatible. Never point this new release at the retained physical-test store as an accidental migration.

## Backup, expiry and cleanup

The release now uses [14 typed tables](SCHEMA.md) and [atomic publication](../../../../docs/adr/yepwatch-typed-room-storage.md), replacing the historical encrypted room blob. Use the new operator, not an R4 binary.

```sh
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs inventory
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs backup /private/backups/yepwatch-typed.jsonl --writers-stopped
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs purge-expired --apply --writers-stopped
```

Stop writers before backup or purge. Backup creates a new mode-0600 JSONL file containing every typed record, runtime metadata and controls, with a checksum/count. It contains private interaction data; token/verifier fields remain encrypted and the secret is not included. Restore only to an empty compatible store, records before room heads. Disposable backup/restore is tested; production restore and off-cluster backup scheduling remain operator work.

All records carry their room expiry, independently of credential expiry. Purge uses the database clock and removes expired heads/domain records, including unreferenced preparations. Active records and control/runtime configuration stay intact. No automatic schedule or live-version compaction is installed. Never delete unreferenced versions of an active room: an in-flight command may still be preparing publication. Full key rotation remains separate work.

## Enforced beta controls and operating envelope

R4 enforces global room reservations and new logical create/join/command grants through one dedicated Crate primary-key CAS aggregate. There is **no service-wide tester allowlist**. Public apex/APK access is not invite-only: room invites protect an existing room, while new room creation is public. Browser Origin does not authenticate native callers. Gateway local bounds (128 sockets/32 rooms) are distinct from API controls.

The defaults above are small-beta starting settings, not product promises or measured throughput. SQL `CURRENT_TIMESTAMP` determines 60-second fixed windows; permits near a boundary can authorize up to twice a minute's budget in a short interval. Cluster clocks must remain synchronized. A backward SQL window fails closed until it catches up. Each state update uses full primary key + `_seq_no` + `_primary_term`; a `CASE` in `SET` leaves control columns unchanged if the original window has elapsed. Crate 5.10 rejects the equivalent extra range predicate in a CAS `WHERE`, (also see official [Crate 5.10 OCC limitations](https://cratedb.com/docs/crate/reference/en/5.10/general/occ.html), checked 2026-10-22), so rowcount alone cannot authorize anything: an authoritative PK reread must prove the same digest/actor and original window. Bounded eight-attempt contention ends with retryable 503, even below the nominal cap. This single row deliberately trades peak throughput for a small, consistent global budget; no Valkey eviction or Pub/Sub delivery is authoritative.

Reservation precedes room insert; its original six-hour expiry becomes the room expiry, including after lost acknowledgement/process restart. Failed/uncertain inserts retain reservations until expiry, conservatively consuming capacity. Delayed expired inserts are fenced by the existing database-side room insert expression; late expired writes cannot create active capacity or extend lifetime. No room is deleted, quorum reduced or reservation released early on failure/disconnect/decision. `active()` rechecks the database clock and matching reservation on room reads as well. Expired reservation bookkeeping can be pruned on the next control operation; room rows remain stored.

Authenticated, preflight-valid new command attempts are charged before candidate/final-check work. Later domain validation or a CAS conflict can still reject after a grant; a grant is not a successful room mutation. Create/join admission identity and entire original request digest bind grants. Existing exact admission replay and retained accepted command receipts recover without new charges. In-window uncertain grants require the exact marker, authenticated actor and original window; marker eviction at rollover requires reauthorization, while domain sequence/receipt/CAS still prevents repeated effects. A receipt older than the retained 64 yields reconciliation, never an automatic fresh operation. Reserved-but-uninserted create replay recovers its original expiry even after a rate window changes. Denied attempts do not add identities or reset counters. No IP keys or forwarded-header assumptions are used.

Rate denial is HTTP 429 `limit_reached`, `retryable:true`, plus integer `Retry-After` seconds to the window boundary (1–60). Capacity/contention/uncertain permit responses use HTTP 503 `busy`, `retryable:true`, with `Retry-After` bounded to 1–21600 seconds. The client must retain the exact pending envelope/admission and wait; **the prior frozen guest client discards `limit_reached` and must receive the separate compatibility fix before r4 activation**. New quota does not promise that a repeatedly retried operation will succeed while other callers consume it.

These limits cover **new logical operations**, not raw HTTP requests, denied/replayed calls, snapshot/metadata reads, ticket churn, internal gateway view/repair traffic or concurrent catalog tasks. They are not complete request-flood protection, per-network fairness, or a lifetime disk budget. The typed control record retains at most the configured room reservations, current-window admission markers and current-window command/actor markers, with schema-bounded arrays; there is no unbounded identity-key namespace. Defaults are 20/20/600 markers respectively. Raising settings is not supported on a running store: fingerprint mismatch makes startup/readiness and guarded requests fail closed. Provisioning initializes controls only on an empty room store after refreshing it, with all writers stopped; it refuses reconstruction over existing history. All instances sharing a store must run this guarded release with the same configuration. Never mix an older unguarded API or reset/drop/recreate controls. A future policy change/import of existing rooms requires a separately reviewed quiesced migration preserving every unexpired reservation and window; no such migration is added here. Back up/restore the control row with room state and stop writers for consistency.

Current source-enforced bounds (`continuous-types.ts`, `types.ts`, `proposal-service.server.ts`, `proposal-http.server.ts`): 12 participants and 12 screens per room; 20-card pages, 120 retained candidates and 2000 seen identities per generation; 512000-byte assembled room-state limit before splitting into typed records; 64 retained command receipts per participant; 4 unconsumed/unexpired realtime tickets per participant (30-second ticket, bounded 60-second lease); fixed six-hour room expiry from creation, never extended by activity or restart. JSON commands/admissions are limited to 65536 bytes. Create has four attempts; join/commands have six CAS attempts. Those per-room caps do not replace the separate logical-operation controls and do not limit raw request frequency, simultaneous catalog work, total historical rooms, or expired-row accumulation. Historical receipt eviction requires reconciliation rather than indefinite exact replay. New generations reset seen history but not expiry.

Proposed initial operator envelope, requiring owner acceptance: **one API process and one gateway**, one supervised session with known invited testers, initially five simultaneously active rooms / 20 total people within the enforced 20-room maximum, and no public promotion. This lower supervised target is optional operational caution, not the admission-control mechanism; the database controls enforce the configured ceiling independently. The API memory observation above is only one process; reserve headroom for its whole snapshot and worker during reload. A publicly reachable release can exceed this envelope despite nonpublic distribution of its link.

Assign one present operator. Check container RSS/CPU/restarts, readiness, catalog SQL request load, Crate disk/shard health and `operator.mjs inventory` before/after each session and at least every 15 minutes while open. Inventory counts include retained expired rows. Establish starting row/disk counts; pause at 100 newly accumulated rows or 100 MiB new room-table disk usage, unexpected growth, sustained readiness loss, repeat catalog failures, or approach to configured container/disk limits. These conservative stop thresholds are proposed administrative tripwires, not claims of capacity or automatic alarms. Current lifecycle logs contain no per-route metrics; the operator must use container/database/proxy aggregate counters without logging capabilities or votes.

Response: first disable all public YepWatch API and WebSocket routes at the front proxy (plus app/APK distribution if closing the beta), then stop/drain only this release's gateway/API. Preserve Crate volumes, room keys and private backup. Do not restart continuously, rotate keys, delete expired rows, or change quorum as an incident workaround. Reopen only after the owner understands the cause and resets the supervised budget. A future automatic cleanup/tombstone protocol, raw-request protection and full key lifecycle remain separate unfinished rollout stages. This runbook is not acceptance of those risks on the owner's behalf.

## Evidence and release gates

R3 base proof on 2026-10-22 used a fresh standalone bundle, isolated Crate15979 and password-protected fanout46402; existing15992/4324/physical room and all issuer stacks stayed untouched. Full existing catalog/snapshot was read, not a sample or fixture identity. Loaded 255293 titles (ratings for 51 countries). The read-only-source candidate completed 39 source GET/getBuffer calls, loaded the snapshot in 13.7 seconds (13.4 seconds reading Redis), and became ready at 16.1 seconds. Its startup guard reported `derivedCache:disabled`, `sharedCatalogWriterInitialized:false`; repeated dependency probes and ordinary metadata/20-card flows ran with that guard. RSS 239550464 bytes, heap 18466200 bytes, about 0.96 CPU seconds at readiness. These are development-host observations, not production capacity or latency guarantees. Earlier preserved cache-connected candidates had transient first-read retries and different measurements; do not conflate their results with this final path.

Unchanged DE/Netflix8 produced 20 real cards (one movie / 19 new shows); native guest create/setup/start/Yep/propose/fresh-per-screen Done passed. Full catalog access does not prove every country's/provider's offers are known/current; unknown/known-empty/scan-budget distinctions and title-scoped episode evidence remain intact. Physical Pixel installation/interaction evidence belongs to the app thread; this release/container is not inferred tested on the device from earlier local app evidence.

23 functional/transport tests plus one bundled reader-seam test and focused strict TypeScript passed, including dependency failure/recovery, no readiness timeout-to-green, explicit-only provisioning, pre-import cache isolation, refusal of a preinitialized writer, caller-owned reader shutdown and existing proposal/CAS scenarios. Operator provision/check/inventory/backup and disposable restore proof passed. Idle SIGTERM made health red before close and exited cleanly; long in-flight forced-drain behavior is bounded by source but not separately fault-injected in that proof. Hosting owns the independent container/proxy rehearsal and immutable image/context evidence.

Before any real traffic: root approval of exact source/image/route/config, private catalog connectivity from the target container, separate provisioned room role/table/key backup, TLS/WSS/browser fallback, admission/operator exposure controls, a named backup/retention operator and the honest rate/retention/key-policy limits above. No deployment, production role/table write, purge, issuer/client change, refresh activation, push or paid resource was performed by this work.

R4 passed 32 functional/transport/control tests, one separately enabled real-Crate integration test, and focused strict TypeScript. R4 ordinary functional checks add configurable admission/command boundaries, exact retry/counter idempotency, refused changed policy, lost control acknowledgements without premature domain work, original reservation expiry, SQL-window rollover/backward handling, denied Start with zero catalog work, and old receipt eviction without repeated effects. The executable operator provision/check/inventory and format-2 backup-with-control checks pass in the same disposable harness. The disposable Crate harness uses two actual HTTP API instances on one test process plus an independently spawned recovery process, nine concurrent creates at cap three, actual SQL CASE fencing and injected lost acknowledgements after real commits. It restarts only its own Crate container, recovers the same actor/sequence, and seeds expiry solely in its disposable fixture before proving a replacement reservation and refused delayed expired insert. It reads no production catalog or account data; the full-catalog evidence above remains the separate r3 layer. This is ordinary functional/concurrency verification, not a new security review or public activation.

Reproduce from a clean build context (Docker, free loopback15978; harness creates/removes only its unique container):

```sh
node app/server/yepwatch/build-release.mjs
node --test app/server/yepwatch/proposal-release-control.test.ts app/server/yepwatch/proposal-release.test.ts
YEPWATCH_TEST_CONTROL_CRATE=1 node --test app/server/yepwatch/proposal-release-control-crate.test.ts
```

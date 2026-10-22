# Guest-only proposal 3 private beta

Prepared 2026-10-22 from clean committed `779a2752`, separately from the dirty main checkout and frozen unreviewed member refresh. This is a deployable guest runtime and operator procedure, **not a production deployment or auth/retention signoff**. Hosting/container/proxy files belong to `yepwatch-realtime/release/`; no existing process, physical tester room, issuer, client registration or key is migrated by these commands.

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
| `SOURCE_COMMIT` | Exact deployed commit/build label, exposed by health |
| `YEPWATCH_PROPOSAL_PROBE_MS` | Dependency probe interval, default 5000 ms |
| `YEPWATCH_PROPOSAL_SHUTDOWN_DELAY_MS`, `YEPWATCH_PROPOSAL_DRAIN_MS` | Default 8000 ms proxy removal delay + 12000 ms request drain; hard exit 25000 ms |

Release rejects `TITLE_SNAPSHOT_REDIS_URL` and local fixture/issuer/installer flags. It never loads `.env` implicitly. Supply the existing catalog cluster configuration explicitly. The full snapshot includes a smaller reference pool internally; YepWatch's existing ranked-key adapter uses the full snapshot universe, not that pool or the old 36-record development sample. No country/service launch shortlist is added.

Catalog/snapshot traffic needs the private Crate HTTP port and all cluster-discovered cache node ports, not merely one seed. The release captures source connection settings, removes general `REDIS_HOST*`/password configuration **before** helper imports, rejects single-cache overrides, and injects only GET/getBuffer into the snapshot loader. Startup and each dependency probe refuse an early-initialized general writer. Countries/episodes/details cache misses therefore read SQL or existing process memory, without shared derived-cache writes. No production MONITOR/ACL changes or credential permission audit was performed; the proof concerns the application connection/import path.

Gateway needs only its service bearer, internal API origin and dedicated fanout credential. It never receives room keys or catalog SQL/source-cache credentials. A dedicated derived cache is not required for this functional private-beta candidate: one cold 20-card flow including final choice took 7858 ms, and metadata requests took 205/192 ms with shared caches disabled on this development connection. This is not a concurrency/capacity result. Expect more SQL work on cold/repeated helper reads; monitor query rate and start/refill latency during a small beta. If measured load warrants caching, introduce an explicitly isolated release cache in a separate change; never re-enable the source shared writer as a shortcut.


## HTTP routing, readiness and shutdown

- Public app/browser fallback: `https://yepwatch.com`; ordinary API under `/api/yepwatch/v1/proposal/`; exact WebSocket path `/api/yepwatch/v1/proposal/realtime` goes to the dedicated gateway.
- **Do not publicly route `/api/yepwatch/v1/proposal/realtime/internal/*`.** Attach/view are container-network service-bearer hooks. Keep the API listener private and route only the intended public HTTP paths. Proxy/TLS/association-file/browser-fallback ownership stays with hosting/app threads.
- `GET /api/yepwatch/v1/proposal/health/live` reports event-loop liveness. `GET /api/yepwatch/v1/proposal/health/ready` returns 200 only after a real nonempty snapshot, catalog SQL/schema reads, room schema/key metadata and fanout ping all pass. It stays 503 indefinitely when a startup dependency is missing; there is no webapp-style timeout-to-green. Before first successful preflight it admits no rooms. Later dependency failures remove it from readiness while recoverable room reads/commands remain governed by their real stores.
- Probes are coalesced and cached. Failed/stale probes stay red; health carries coarse dependency names/build/mode only, not room IDs, votes, secret values or backend addresses. Readiness establishes usable dependencies, **not** comprehensive current offers/episode entitlement.
- SIGTERM immediately turns readiness red, keeps serving during the proxy-removal delay, then closes the listener and drains. Idle connections close; the bounded drain cuts lingering connections. Pending writes retain the existing exact-envelope/CAS recovery semantics. Repair/snapshot/cache/bus loops stop. Set container stop grace above 25 seconds (for example 30 seconds); the hosting health cadence/removal window must fit the delay. There is no new WebSocket server in this process.
- Runtime emits only coarse process lifecycle messages; it adds no request path/body logging. Avoid capability-bearing invite paths and request/query/body logging in proxy/operator tooling too. Existing catalog-query diagnostics are distinct from private vote payloads.

## Explicit provisioning: prepare/review, do not run on production yet

No runtime startup DDL or schema migration runs. Use a separate operator environment/credential and the same intended key/key ID. The command below creates only `doc.yepwatch_room_v3` plus the small `doc.yepwatch_room_v3_runtime` compatibility record. Existing record mismatch fails rather than rewriting the store or rotating a key.

```sh
# Operator context, after reviewing target origin, key backup and cluster capacity:
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs provision --apply
# Switch to the restricted runtime credential for the read-only check:
node --env-file=/private/yepwatch-api.env build/yepwatch-release/operator.mjs check
```

Production provisioning defaults to 2 replicas and waits for 3 active shard copies; the existing installer uses 4 room shards and 1 metadata shard. Confirm the intended three-node cluster and capacity first. For an **explicitly disposable loopback** single-node rehearsal only, add `--disposable-single-node`; it is refused for a non-loopback origin. A container rehearsal can run the operator on the host against its published loopback Crate port, or share the disposable Crate container's network namespace with origin `http://127.0.0.1:4200`.

Create roles/passwords through the established operator mechanism, with secrets supplied as parameters/private files, not shell-history SQL literals. The intended grants to existing roles are:

```sql
GRANT DQL, DML ON TABLE doc.yepwatch_room_v3 TO yepwatch_runtime;
GRANT DQL ON TABLE doc.yepwatch_room_v3_runtime TO yepwatch_runtime;
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

Implemented operator commands, with no purge command:

```sh
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs inventory
node --env-file=/private/yepwatch-operator.env build/yepwatch-release/operator.mjs backup /private/backups/yepwatch-room-20261022.jsonl
```

Inventory reports counts/expiry bounds without decrypting votes. Backup creates a **new** mode 0600 JSONL file, retaining encrypted payloads, expiry and durable repair markers, with a checksum/count on stdout and no secret included. For a consistent whole-table export, stop writers/gateways and let the table's refresh interval elapse first; each row is an intact aggregate, but a live multi-page export is not a global point-in-time snapshot. A local exported decided room was restored byte-for-byte into a separate disposable table and decrypted with its matching key. Preserve the original payload's `INDEX OFF STORAGE WITH (columnstore=false)` schema; default text column storage is unsuitable for the bounded large ciphertext.

For cluster disaster recovery, the operator should configure an existing off-cluster snapshot repository, include **both** room and runtime-metadata tables, and rehearse restore into an isolated target with the independently backed-up key. Example statements for an already configured repository, not executed here:

```sql
CREATE SNAPSHOT yepwatch_backup.pre_beta_20261022
TABLE doc.yepwatch_room_v3, doc.yepwatch_room_v3_runtime
WITH (wait_for_completion=true);
RESTORE SNAPSHOT yepwatch_backup.pre_beta_20261022
TABLE doc.yepwatch_room_v3, doc.yepwatch_room_v3_runtime
WITH (wait_for_completion=true);
```

Use an isolated target where those tables do not exist; do not restore `ALL` or central user/issuer metadata. Current official [CREATE SNAPSHOT](https://cratedb.com/docs/crate/reference/en/latest/sql/statements/create-snapshot.html) and [Crate 5.10 RESTORE SNAPSHOT](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/restore-snapshot.html) support table selection and blocking completion; existing target tables cause restore failure. Accessed 2026-10-22; a production repository/restore drill is still unverified.

Logical room TTL remains 6 hours. Expired rows are inaccessible through the normal room API but **remain physically stored**, including encrypted private fields and backups. Inventory/export do not redact them. No automatic deletion, tombstone compaction, distributed rate limiter or key rotation is added in this release. Do not run ad-hoc DELETE/TTL jobs while admitted/in-flight work could recreate a row: the existing aggregate/CAS protocol alone is not a deletion/recreation invariant. Plan a quiesced, separately reviewed retention stage and a finite beta operator/storage budget; these gaps remain explicit and are not silently described as solved by private-beta packaging.

## Evidence and release gates

## Explicit beta limits and operating envelope

There is **no API admission/command/IP rate limiter**, distributed rate cap, global room-count cap, or service-wide tester allowlist in this candidate. Public apex/APK access is not invite-only: room invites protect admission to an existing room, while new room creation is public. Browser Origin checks do not authenticate native callers. The gateway owner reports local bounds of 128 sockets/32 rooms; those are not API limits or an enforced beta budget.

Current source-enforced bounds (`continuous-types.ts`, `types.ts`, `proposal-service.server.ts`, `proposal-http.server.ts`): 12 participants and 12 screens per room; 20-card pages, 120 retained candidates and 2000 seen identities per generation; 512000-byte plaintext aggregate before encryption; 64 retained command receipts per participant; 4 unconsumed/unexpired realtime tickets per participant (30-second ticket, bounded 60-second lease); fixed six-hour room expiry from creation, never extended by activity or restart. JSON commands/admissions are limited to 65536 bytes. Create has four attempts; join/commands have six CAS attempts. These retry/body/state caps do **not** limit request frequency, simultaneous catalog work, total stored rooms, or expired-row accumulation. Historical receipt eviction requires reconciliation rather than indefinite exact replay. New generations reset seen history but not expiry.

Proposed initial operator envelope, requiring owner acceptance: **one API process and one gateway**, one supervised session with known invited testers, at most five simultaneously active rooms / 20 total people, and no public promotion. These are manual budgets, not measured capacity or enforced admission controls. The API memory observation above is only one process; reserve headroom for its whole snapshot and worker during reload. A publicly reachable release can exceed this envelope despite nonpublic distribution of its link.

Assign one present operator. Check container RSS/CPU/restarts, readiness, catalog SQL request load, Crate disk/shard health and `operator.mjs inventory` before/after each session and at least every 15 minutes while open. Inventory counts include retained expired rows. Establish starting row/disk counts; pause at 100 newly accumulated rows or 100 MiB new room-table disk usage, unexpected growth, sustained readiness loss, repeat catalog failures, or approach to configured container/disk limits. These conservative stop thresholds are proposed administrative tripwires, not claims of capacity or automatic alarms. Current lifecycle logs contain no per-route metrics or traffic-rate enforcement; the operator must use container/database/proxy aggregate counters without logging capabilities or votes.

Response: first disable all public YepWatch API and WebSocket routes at the front proxy (plus app/APK distribution if closing the beta), then stop/drain only this release's gateway/API. Preserve Crate volumes, room keys and encrypted backup. Do not restart continuously, rotate keys, delete expired rows, or change quorum as an incident workaround. Reopen only after the owner understands the cause and resets the supervised budget. A future automatic cleanup/tombstone protocol, distributed admission/command limits and full key lifecycle remain separate unfinished rollout stages. This runbook is not acceptance of those risks on the owner's behalf.

Local 2026-10-22 proof used a fresh standalone bundle, isolated Crate15979 and password-protected fanout46402; existing15992/4324/physical room and all issuer stacks stayed untouched. Full existing catalog/snapshot was read, not a sample or fixture identity. Loaded 255293 titles (ratings for 51 countries). The read-only-source candidate completed 39 source GET/getBuffer calls, loaded the snapshot in 13.7 seconds (13.4 seconds reading Redis), and became ready at 16.1 seconds. Its startup guard reported `derivedCache:disabled`, `sharedCatalogWriterInitialized:false`; repeated dependency probes and ordinary metadata/20-card flows ran with that guard. RSS 239550464 bytes, heap 18466200 bytes, about 0.96 CPU seconds at readiness. These are development-host observations, not production capacity or latency guarantees. Earlier preserved cache-connected candidates had transient first-read retries and different measurements; do not conflate their results with this final path.

Unchanged DE/Netflix8 produced 20 real cards (one movie / 19 new shows); native guest create/setup/start/Yep/propose/fresh-per-screen Done passed. Full catalog access does not prove every country's/provider's offers are known/current; unknown/known-empty/scan-budget distinctions and title-scoped episode evidence remain intact. Physical Pixel installation/interaction evidence belongs to the app thread; this release/container is not inferred tested on the device from earlier local app evidence.

23 functional/transport tests plus one bundled reader-seam test and focused strict TypeScript passed, including dependency failure/recovery, no readiness timeout-to-green, explicit-only provisioning, pre-import cache isolation, refusal of a preinitialized writer, caller-owned reader shutdown and existing proposal/CAS scenarios. Operator provision/check/inventory/backup and disposable restore proof passed. Idle SIGTERM made health red before close and exited cleanly; long in-flight forced-drain behavior is bounded by source but not separately fault-injected in that proof. Hosting owns the independent container/proxy rehearsal and immutable image/context evidence.

Before any real traffic: root approval of exact source/image/route/config, private catalog connectivity from the target container, separate provisioned room role/table/key backup, TLS/WSS/browser fallback, admission/operator exposure controls, a named backup/retention operator and the honest rate/retention/key-policy limits above. No deployment, production role/table write, purge, issuer/client change, refresh activation, push or paid resource was performed by this work.

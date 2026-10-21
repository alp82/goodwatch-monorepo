# YepWatch backend POC

Updated 2026-10-21. This is an executable guest-room foundation and connected local POC, not a production release or completed optional member sign-in. All authored code is confined to this directory, the portable contracts package, one namespaced Remix route and the two research proposals. Existing auth/filter/tracking implementations and package/lockfiles were not changed.

## What works

- `/api/yepwatch/v1`: guest create/join/invite resolution, authenticated shared+own snapshot, setup/screens/readiness, explicit public episode proposal, private progress, start/vote/undo/completion, shortlist/preference/proposal/consent/decision and new rounds.
- Movies, starting shows and continuing shows are supported by the real read adapters. Decks use existing GoodWatch filter/display/episode/evidence/link methods. Every occupied viewing screen must have qualifying country/service evidence; different screens may use different providers. A shared couch is configured once. No launch-country/service shortlist.
- Full country/service metadata and human-title show lookup. Raw service IDs remain distinct even when their names match; only existing `providerFamily` aliases are expanded during evidence evaluation.
- One bounded encrypted Crate aggregate per room; full-primary-key reads, `_seq_no`+`_primary_term` CAS, actor command sequencing, bounded receipts and recoverable lost acknowledgements. No assumed multi-row transaction or evictable-cache authority.
- Real authenticated one-use tickets and service-authenticated gateway attach/view hooks. HTTP commands commit before revision-only bus publication. Pending markers survive commit-before-publish failures; a bounded worker retries. The separate gateway owns actual sockets/presence and repairs missed Pub/Sub hints through scoped views.
- Browser room cookies are HttpOnly; native credentials are actual bearer capabilities. Re-admission with an existing room cookie/bearer resumes the same identity, preserving host membership. New participants need a fresh browser context/device, not silent replacement of an existing browser participant.

See [portable wire contract](../../../packages/yepwatch-contracts/README.md) and [API route](../../routes/api.yepwatch.v1.$.ts).

## Privacy and choosing behavior

Only `shared()` is eligible for broadcast. It explicitly projects nested screen/candidate/episode/provider/decision fields. Shared participation exposes nickname, screen, readiness, inclusion and completed-count plus nonauthoritative gateway presence. It contains no other person's current card, direction/value, private progress, private shortlist preference or individual consent. Aggregate unanimous outcomes permit inference in a small room; this is not anonymity.

A continuation episode comes from explicit host `propose_episode {expectedContextVersion,showId,episodeId}`. It becomes an intentionally shared `episodeProposals` entry and resets affected approvals/readiness. The server NEVER derives a queryable proposed episode from private histories. `GET .../shows/SHOW/progress` returns canonical aired regular episode choices, the caller's own input/conflicts and only an explicitly public proposal. Missing/unknown inputs do not become guessed history. Each person privately supplies progress and explicitly approves the public canonical episode, including rewind/spoiler disagreement. Existing canonical IDs and optional presentation labels remain separate. A vote/decision never marks history.

Every included person votes on every candidate, then explicitly completes. No early match interrupts the round. The initial shortlist is up to five unanimous `watch` candidates in deck order. Preferences are stored privately; initial host proposal + everyone’s versioned final consent decides. Empty shortlist means another round/context discussion, not fabricated agreement. Fairer shortlist ordering/explicit compromise remain product follow-up. Late arrivals wait until a new round; disconnect never silently removes a required person.

All current GoodWatch offer evidence is **title-scoped**. Show-start/continuation candidates carry a canonical episode but retain `availability.scope="title"`; neither approval nor final choice manufactures episode entitlement. Provider links use existing truthful provider/where-to-watch projection. The UI must keep this distinction visible. Missing/stale evidence yields unknown/unavailable, never a verified no-match. Finalization bypasses evidence cache for the chosen title and checks every required screen again. A concurrent consent/proposal change defeats the final CAS.

Clients must fence the entire snapshot by shared revision as well as caller sequence. `own.nextSequence` alone cannot reject an older own response after somebody else starts a new round; equal sequence is not equal room state. `own.roundCompleted` restores accepted completion after reconnect.

## Local checks

From repository root, using the existing Node 24/dependencies:

```sh
node --test goodwatch-webapp/app/server/yepwatch/foundation.test.ts goodwatch-webapp/app/server/yepwatch/catalog-adapter.test.ts
```

Disposable Crate only (never reuse existing containers/data):

```sh
docker run --rm -d --name yepwatch-api-crate-test \
  -p 127.0.0.1:15988:4200 -e CRATE_HEAP_SIZE=512m \
  crate:5.10.16 crate -Cdiscovery.type=single-node -Cnetwork.host=0.0.0.0
YEPWATCH_TEST_CRATE_ORIGIN=http://127.0.0.1:15988 \
  node --test goodwatch-webapp/app/server/yepwatch/crate.integration.test.ts
```

The integration test explicitly installs only `doc.yepwatch_room` on that disposable service with zero replicas. It exercises two repositories racing CAS/ticket consumption, immediate PK visibility without REFRESH, encrypted payloads, duplicate insertion, a committed real-Crate write whose acknowledgement is deliberately lost, receipt recovery and a fresh repository/service reading the durable result. It does not prove a three-node failover or disk/node-loss recovery. Stop only the container you created when it is no longer needed.

Core-only strict typecheck (from `goodwatch-webapp`):

```sh
./node_modules/.bin/tsc --noEmit --skipLibCheck --strict --target ES2022 \
  --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --types node \
  app/server/yepwatch/foundation.test.ts app/server/yepwatch/catalog-adapter.test.ts \
  app/server/yepwatch/crate.integration.test.ts app/server/yepwatch/node-http.server.ts
```

`tsc -p app/server/yepwatch/tsconfig.json` also checks the real adapters/route and their existing imports. At this checkpoint it reports six pre-existing imported `JsonData` errors in countries/discover/genres/cache and no YepWatch-owned diagnostic; those dirty/shared files are intentionally untouched. No generic dependency upgrade is required.

## Runnable HTTP integration

`createYepWatchHandler(service,{serviceSecret,allowedOrigins,secureCookies})` is injectable independently of Remix. `listenYepWatch(handler,port)` supplies a loopback-only Node test server. `local-test-server.ts` explicitly selects synthetic fixtures OR real read adapters; default room repository is memory. To use disposable Crate add `YEPWATCH_CRATEDB_ORIGIN=http://127.0.0.1:15988` and `YEPWATCH_INSTALL_DISPOSABLE_TABLE=1`; the local runner refuses non-loopback room databases. Real catalog reads still use the existing configured catalog reader, never that empty room database.

For synthetic integration, from root (provide independent random secrets of at least 32 characters through a private ignored environment file):

```sh
YEPWATCH_LOCAL_FIXTURES=1 YEPWATCH_LOCAL_PORT=15989 \
  node --env-file=/absolute/path/to/private-local.env \
  goodwatch-webapp/app/server/yepwatch/local-test-server.ts
```

Environment configuration:

| Variable | Meaning |
|---|---|
| `YEPWATCH_SECRET` | Server-only credential/lease and aggregate encryption key; retain securely across restarts. Rotation/key migration not implemented. |
| `YEPWATCH_GATEWAY_SECRET` | Independent service bearer for private attach/view. Never compiled into clients or passed in URLs. |
| `YEPWATCH_ALLOWED_ORIGINS` | Comma-separated exact browser origins; local runner default `http://localhost:8081`. Cookie writes require allowed Origin. |
| `YEPWATCH_LOCAL_PORT` | Loopback HTTP port, default15989. |
| `YEPWATCH_REVISION_REDIS_URL` | Local runner revision publisher endpoint, separate from durable state; channel `yepwatch:v1:revision`, JSON `{roomId,revision}` only. |
| `YEPWATCH_LOCAL_FIXTURES=1` | Explicit synthetic catalog. |
| `YEPWATCH_LOCAL_CATALOG=goodwatch` | Real existing GoodWatch catalog read adapters; use Vite Node config for existing `~/` imports. |
| `YEPWATCH_LOAD_LOCAL_ENV=1` | Explicitly load webapp `.env` locally without printing it. Do not export/commit its contents. |

Attach: `POST /api/yepwatch/v1/realtime/internal/attach {roomId,ticket}` with gateway bearer. Returns room/participant IDs, `scope:"shared:read"`, numeric participant capability epoch, signed lease and expiries. Ticket is 30 seconds maximum and one-use. View: `POST .../view {roomId,lease}` rechecks membership/epoch/expiry, projects shared state and returns a **renewed lease token** valid up to60 seconds/room expiry. Subscribe/ACK to bus before final initial view. Gateway closes on401/403/404/410; uncertain failures supply no data. No normal client polling.

The production Remix runtime reads `YEPWATCH_CRATEDB_ORIGIN`, `YEPWATCH_CRATEDB_USERNAME`, `YEPWATCH_CRATEDB_PASSWORD`, `YEPWATCH_SECRET`, `YEPWATCH_GATEWAY_SECRET`, `YEPWATCH_ALLOWED_ORIGINS`. It uses existing `getRedisCluster()` for revision publication. Missing configuration returns503. It never auto-installs tables/roles. Before any production rollout, an operator must separately provision/review least-privilege table access and the tested replica/durability settings; the local installer takes replicas0 or2 explicitly. Internal hooks also need private ingress routing, HTTPS and gateway upgrade/drain wiring; no deployment changes have been made.

## Real read-only catalog smoke

`catalog-smoke.ts` uses the real catalog adapter and memory-only rooms. `YEPWATCH_SMOKE_CONTINUATION=1` exercises the selected-show continuation path without the recommendation snapshot. Without it, the existing title snapshot must be reachable. Missing snapshot is an explicit unavailable result, not a movies-only substitute or proof of no intersection.

For a finite local snapshot, start a separate disposable loopback Valkey and run `seed-local-snapshot.ts` with `YEPWATCH_SEED_LOCAL_SAMPLE=1`, `YEPWATCH_LOAD_LOCAL_ENV=1`, `TITLE_SNAPSHOT_REDIS_URL=redis://127.0.0.1:15990`. This helper uses indexed name lookups and bounded real PK reads, existing snapshot encoder, no padded/fabricated identities, no ratings sidecar. It refuses non-loopback snapshot writes. Its sample is not a product geography/catalog restriction.

Example real runner, from `goodwatch-webapp`, with private env file supplied separately:

```sh
YEPWATCH_LOCAL_CATALOG=goodwatch YEPWATCH_LOCAL_FIXTURES=0 \
YEPWATCH_LOAD_LOCAL_ENV=1 YEPWATCH_LOCAL_PORT=15996 \
YEPWATCH_ALLOWED_ORIGINS=http://127.0.0.1:8099,http://127.0.0.1:8100 \
YEPWATCH_REVISION_REDIS_URL=redis://127.0.0.1:46397 \
TITLE_SNAPSHOT_REDIS_URL=redis://127.0.0.1:15990 \
TITLE_CARDS_REDIS_URL=redis://127.0.0.1:15990 \
TITLE_FILTER_REDIS_URL=redis://127.0.0.1:15990 REDIS_HOST= \
node --env-file=/absolute/path/to/private-local.env node_modules/vite-node/vite-node.mjs \
  --config app/server/yepwatch/vite.config.ts app/server/yepwatch/local-test-server.ts
```

The same local snapshot/cache overrides and `YEPWATCH_READ_ONLY_CATALOG=1` run `catalog-smoke.ts`. Real smoke observed251 countries,964 service IDs,20 show search results,62 regular aired episodes for the chosen show; a real continuation candidate and fresh final title evidence succeeded. A36-record local real-catalog sample produced11 eligible movie/start-show candidates and a fresh final watchability result. These are representative checks, not coverage/entitlement guarantees. The configured private production Valkey was unavailable locally; an initial broad sample reader timed out, then the small indexed reader succeeded. No production room/table/account/history writes were performed.

## Remaining work and limits

- Member sign-in/prefill remains explicit501, not simulated. Required shared changes must be coordinated before touching active auth work: extend `auth/auth.server.ts` current MCP-specific issuer resource/scopes/registered client callbacks; `auth/mcp-flow.server.ts` signed consent allowlist/UI for a YepWatch read scope; existing verifier/call-shape tests; exact browser/native callback and PKCE/state/audience/grant checks. YepWatch start/callback/link/prefill code can stay namespaced and owned here. Do not add another account database, duplicate OAuth provider, embedded native secret or share cookies across unrelated domains. Member tracking/taste/Seen/settings reads should reuse existing methods only after a valid linked member grant, with explicit saved-services confirmation for screens.
- Before production: rate/admission abuse controls, explicit leave/revoke/invite rotation, expiry redaction/retention worker and encrypted-key rotation. Current API denies expired rooms but does not yet erase expired ciphertext. Do not hard-delete a room row while delayed writes can recreate/resurrect identity; tombstone/cleanup policy needs its own tested boundary.
- POC bounds:12 people/screens,20 candidates,30 selected show inputs/proposals,64 retained receipts per actor, four outstanding tickets per person,6-hour room,512KB aggregate. These are implementation bounds, not confirmed permanent product limits. Candidate scanning is bounded1200 titles/12 seconds; budget or unknown evidence produces unavailable, not a catalog-wide empty-intersection assertion. Personal taste/Seen prefilling, stronger diverse/fair ranking, prior-round duplicate/veto carry-forward and explicit no-choice/compromise UX remain follow-up.
- Retry/consent correctness and multi-instance notification repair are tested at the stated scale only. Single-aggregate contention, real-phone native/background behavior, multi-node Crate failure, ingress/draining and full database coverage are not yet verified. Persistent presence is deliberately absent; gateway presence cannot finalize or silently change quorum.
- No product code outside owned paths, shared dependency/lockfile changes, production provisioning/config/DNS, issue publication, commit, push or deployment were performed by this thread.

## Owned file inventory

New files in this directory: `README.md`, `availability-adapter.ts`, `catalog-adapter.test.ts`, `catalog-adapter.ts`, `catalog-smoke.ts`, `crate.integration.test.ts`, `crypto.server.ts`, `errors.ts`, `foundation.test.ts`, `goodwatch.server.ts`, `http.server.ts`, `local-test-server.ts`, `machine.ts`, `node-http.server.ts`, `progress.ts`, `repository.server.ts`, `runtime.server.ts`, `seed-local-snapshot.ts`, `service.server.ts`, `test-support.ts`, `tsconfig.json`, `types.ts`, `validation.ts`, `vite.config.ts`.

Also new: `goodwatch-webapp/packages/yepwatch-contracts/{index.ts,README.md,package.json}` and `goodwatch-webapp/app/routes/api.yepwatch.v1.$.ts`. Updated existing owned proposals only: `docs/research/goodwatch-mobile-group-matcher.md` and `docs/research/yepwatch-architecture-proposal.md`. No shared package/lockfile integration change was needed.

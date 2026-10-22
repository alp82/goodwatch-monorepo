# Proposal protocol 3 local build

For the standalone guest-only private-beta build from clean `779a2752`, see
[GUEST-RELEASE.md](./GUEST-RELEASE.md). The original local-stack instructions below
remain for retained development rooms; they are not the release entrypoint.

Base `f5e06a2b`; approved prototype `5c4e53cf`. Implementation isolated at `/tmp/yepwatch-hybrid-backend-f5e06a2b`, excluding frozen unreviewed refresh and unrelated auth/analytics dirt. No commits, production writes, issuer registration or deployment.

## Modules and compatibility

- Portable `proposal.ts`/`PROPOSAL.md`: additive contract 3 export; continuous contract 2 unchanged. Published additively to main for app/gateway compilation.
- `proposal-machine.ts`: proposal/approval/timing over reviewed common setup/vote/page rules; explicit shared/own projections.
- `proposal-service.server.ts`: reviewed credential/admission/ticket/lease/receipt/CAS behavior adapted to separate namespace. Six bounded command CAS attempts, three checker attempts; checking commits before fresh network evidence. Durable pending index repairs after restart.
- `repository.server.ts`: explicit v3 table with same pending-check index semantics as v2; full-PK reads, `_seq_no`/`_primary_term` CAS. Crate truth; Valkey revision/activity only.
- `proposal-http.server.ts`/`proposal-runtime.server.ts`: namespaced validation/authorization/transport, existing Remix catchall dispatch; no client DB/cache and no production auto-DDL.
- `proposal-catalog.server.ts`: delegates existing catalog/filter/watchability/saved-progress methods; adds real movie viewing duration, leaves episode duration unknown rather than show average. Finite sample is not a launch-country/service restriction.
- `proposal-local-server.ts`: independent disposable runner; no issuer/reseeding. The existing local Node adapter now supports native and Remix-compatible Headers forms while preserving browser cookies.

Storage envelope stays `format:2` for existing member-read structural compatibility, with **required `flowVersion:3`, separate table, derivation labels, lease format3, `yepwatch3_` cookie, routes and public contract 3**. Internal old pick remains null compatibility storage, never a v3 command/projection. Internal decision retains checker version; public decision exposes exact proposal version. No migration or old-room reinterpretation.

## Runtime

New API15992 / gateway4324 / app8133 / Metro8141 / simulator8126. API uses new Crate15982 (`yepwatch-proposal-crate-20261022`) and Valkey46401 (`yepwatch-proposal-valkey-20261022`). Test-only Crate15981 (`yepwatch-proposal-verify-20261022`) was actually restarted for durability. All bind loopback. Existing15993+15984 shared process/stores/keys and all old stacks unchanged.

Private config `/tmp/yepwatch-hybrid-runtime-20261022/api.env`; gateway receives **only** `/tmp/yepwatch-hybrid-runtime-20261022/gateway-bearer.env`. Both mode0600; never commit/copy to public evidence. Read-only finite36-record catalog snapshot uses existing config. New room writes only disposable15982.

From isolated `goodwatch-webapp`:

```sh
node --env-file=/tmp/yepwatch-hybrid-runtime-20261022/api.env node_modules/vite-node/vite-node.mjs app/server/yepwatch/proposal-local-server.ts
```

Runner needs independent room/gateway secrets, explicit `YEPWATCH_CRATEDB_ORIGIN`, `YEPWATCH_REVISION_REDIS_URL`, `YEPWATCH_ALLOWED_ORIGINS`, `YEPWATCH_LOCAL_PORT=15992`, `YEPWATCH_LOCAL_CATALOG=goodwatch`. `YEPWATCH_INSTALL_DISPOSABLE_TABLE=1` only installs the disposable loopback table. Private catalog configuration is distinct from room storage. Production adapter takes separate `YEPWATCH_PROPOSAL_*` settings and never installs a table.

## Member seam and rollout limits

Handler accepts existing `ContinuousMembers` over new repository/read-only catalog adapter; no second account DB/issuer and no manual history. New callback must be explicitly allowlisted by existing public PKCE client configuration before enabling it. Retained local issuer currently allowlists15993/v2; new guest runtime returns unconfigured501, without registering clients or installing frozen refresh. Existing signed-in runtime remains available. New v3 browser/native member execution is not claimed.

Inherited bounds: logical TTL6 hours,12 people/12 screens,120 active cards,2000 seen-title keys,64 receipts/person,4 tickets/person, encrypted aggregate byte cap from `LIMITS.aggregateBytes`. These are resource limits, not unlimited suggestions. Unknown scan/coverage, known empty, exhaustion and capacity stay distinct. Disconnects keep quorum; no leave/kick/transfer UI.

Physical redaction/tombstone/key lifecycle and distributed command/admission limits remain public-rollout gates. Do not hard-delete while admitted in-flight writes could recreate/commit a room: retain deadline/tombstone denial through that horizon before compaction. This separate retention stage is not implemented and logical expiry is not physical deletion or production readiness.

## Verification

From repository root:

```sh
node --test goodwatch-webapp/app/server/yepwatch/proposal.test.ts goodwatch-webapp/app/server/yepwatch/proposal-catalog.test.ts goodwatch-webapp/app/server/yepwatch/proposal-catalog-paging.test.ts
YEPWATCH_TEST_PROPOSAL_CRATE_ORIGIN=http://127.0.0.1:15981 YEPWATCH_TEST_RESTART_CONTAINER=yepwatch-proposal-verify-20261022 node --test goodwatch-webapp/app/server/yepwatch/proposal-crate.integration.test.ts
```

Second command checks exact explicitly disposable container binding before restart. Ordinary tests cover proposal replacement/withdrawal/late join/Nope/undo, held-check races, committed lost acknowledgement and receipt replay, full-roster timing/missing implied measurement, canonical continuation pages/final saved maps. No new issuer/security probes or review-restriction workaround.

Observed actual local real-data smoke: unchanged DE/Netflix8 returned 7 cards (2 movies / 5 new shows),2 movie durations; measured Yep 1500 ms → proposal → fresh per-screen CAS Done. Sanitized `/tmp/yepwatch-hybrid-runtime-20261022/ordinary-smoke.json`; capabilities retained separately private. Finite sample only; no full-catalog or individual episode-entitlement claim. Gateway owner separately passed real API/controller multiplayer integration; app/physical Android evidence remains separate.

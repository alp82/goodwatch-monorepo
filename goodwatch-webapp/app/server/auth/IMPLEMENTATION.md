# Strict CrateDB adapter — #548

Better Auth is pinned exactly to **1.7.7**. This slice supplies the database adapter,
its tables and CI; it does not wire a new auth service into the member-facing app.
Supabase and production are unchanged.

## Interface and storage

`crateAuthAdapter({ sql, encryptionSecret, maxEnumeration? })` returns the Better Auth
adapter factory. Use `crateAuthTransport(origins)` for a bounded HTTP transport that
never logs statements/parameters and retries only reads/refreshes on another
coordinator. Writes are sent once. A non-test transport requires a payload secret
of at least 32 characters. Back up this secret; changing it without migrating the
stored ciphertext makes existing rows unreadable.

`migrateAuthTables(sql)` creates thirteen model tables and `auth_user_email`, all
under `doc.auth_`, with one unpartitioned shard, two replicas, REQUEST translog
persistence and `write.wait_for_active_shards=1`. It is explicit, not run on app
startup. All model tables use physical `id` keys; their logical values follow the
research: user UUID, digest(providerId, accountId), digest(token), clientId,
resource identifier, digest(clientId, resourceId), and
 digest(clientId, userId, referenceId). Lookup metadata is indexed in the same
atomic row; created/expiry columns are TIMESTAMP WITH TIME ZONE. Other dates use
ISO UTC inside the encrypted document and are restored using the auth schema.

Rows and operation receipts use authenticated AES-256-GCM encryption, including
raw core session tokens and historical write outcomes. Provider token hashes and
upstream encryption options still belong in the auth-service configuration.
Adapter output never includes receipt, version, lookup or tombstone metadata.

The strict call manifest comes from #531, including factory joins, delete-hook
pre-reads, batches and gated DB verification/rate-limit/preservation modes.
Unlisted predicates, OR, insensitive matching, ownership changes, invalid rotation
values and unlisted sorting throw. Renamed model/field names are normalized by the
factory. Native joins are not implemented; keep `advanced.database.joins` off.
Transactions are explicitly unsupported.

Every conditional mutation retains an operation id and its original outcome in
the same row. Business guards are checked before a bare key/seq/term CAS.
`consumeOne` creates a hidden tombstone; identifier cleanup cannot erase its
receipt. `incrementOne` supports both numeric increments and empty increments with
conditional sets. A zero/error is resolved from the retained receipt, or fails
closed as `IndeterminateAuthWriteError`; no logical increment is retried against a
fresh version. Bulk revocation throws on a competing mutation that leaves an
eligible row active. Normal association recreation replaces the complete document
by CAS and preserves receipts, preventing old Google credentials from leaking
into a new link. Ambiguous consent reference lookups throw.

## Running and CI

Requirements: Node 24+, Docker Compose, about 3 GiB for the cluster, loopback ports
15548–15550 and CrateDB's bootstrap requirements (`vm.max_map_count >= 262144`).
From `goodwatch-webapp`:

```bash
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth
```

The runner forces a local Unix Docker socket and refuses an existing project. It
pins `crate:5.10.12` by digest, verifies all three node names/versions and three
STARTED copies of every auth table, runs focused types/integration/conformance,
and removes project containers, volumes and network even after failures. Logs go
to ignored `scripts/auth-cratedb/results/`.

`.github/workflows/auth-cratedb.yml` adds job **auth-cratedb** on relevant PRs,
main changes and manual dispatch, using Node 24, a disposable Ubuntu runner,
locked installs and result artifacts. It needs no production secrets. Test-utils
1.7.7 lives in an isolated test workspace with Zod 4; the app keeps Zod 3.

The full generic upstream suite uses a conformance mode that can only be enabled
with the fixed local test transport. It allows synthetic models/operators that
are forbidden in production. A separate upstream core auth-flow suite runs the
strict adapter; only the harness's between-test unfiltered cleanup is replaced
with explicit local SQL.

## Verified on October 14, 2026

- Complete harness passed on Node **26.8.1** and **24.22.0**: **246 upstream tests**
  (238 generic conformance cases and 8 strict core-flow/harness cases), plus
  **25 integration tests**, zero failures/skips.
- 24 contenders across three coordinators: one winner for code consumption,
  refresh rotation versus revocation, case-folded signup, Google linking and
  client registration.
- Forced primary stop after application, with a replica paused: both consume and
  increment returned **SQL rowcount 0**, yet recovered their own winning outcome.
  An unreadable receipt produced an indeterminate failure. Later writes and
  identifier cleanup preserved earlier outcomes.
- Every inventoried shape/hook read and every model create/lookup are covered;
  unknown shapes/options, lost insert acknowledgements, default-limit overflow,
  encryption-key mismatch and concurrent bulk revocation are covered.
- Focused auth types, shell syntax and both locked-install dry runs passed.
  Whole-app typecheck has **174 existing diagnostics**, exactly matching the
  pre-change tree with identical installed dependencies; zero added diagnostics.

These are controlled local fault schedules, not a proof of every partition or
later CrateDB version. CrateDB 5.10.9 was not verified for this adapter; production
upgrade/rollout remains separate.

## Launch follow-ups and limitations

- **Multi-row issuance/revocation:** Better Auth's parent CAS, child issuance,
  encrypted replay-response storage and family sweep are not one transaction.
  A interrupted mint can strand a grant; a child minted during a family sweep can
  escape it. This adapter cannot make that protocol transaction atomic.
- **Cache/JWT revocation:** #531's missing active-session-index and standalone MCP
  JWT verification findings remain. A DB session mirror does not repair cache
  revocation or cause local JWT verification to consult DB revocation. The auth
  and MCP wiring needs a fail-closed policy for these paths.
- **Retention and claims:** email claims stay reserved after failed signup,
  address changes and user deletion. Tombstones/receipts have no background GC;
  receipts fail closed at 4,096 outcomes per row. Token/assertion/session/client
  tombstones cannot be reused through ordinary create. Coordinated maintenance
  and orphan recovery are required before production; do not delete recovery
  evidence while writers may still need it.
- **Enumeration:** default-limit overflow throws rather than returning an
  incomplete safety-sensitive list. Explicit pagination is preserved; matching
  populations above `maxEnumeration` (default/maximum 10,000) fail closed. Configure
  complete enumeration/population bounds in the auth service before launch.
- **Not exercised here:** live Valkey, Google OAuth, actual MCP clients, deployment
  and production. GitHub-runner status is recorded in the linked PR/ticket report.

## Source evidence

- [Map #529](https://github.com/alp82/goodwatch-monorepo/issues/529).
- [Base table/adapter design](https://github.com/alp82/goodwatch-monorepo/blob/ccr-fe57dab2-zqtzlr/docs/research/auth-on-cratedb.md).
- [#530 proof and failover correction](https://github.com/alp82/goodwatch-monorepo/blob/research/cratedb-cas-proof/docs/research/auth-on-cratedb-verification.md).
- [#531 exact-version inventory](https://github.com/alp82/goodwatch-monorepo/blob/research/better-auth-adapter-inventory/docs/research/better-auth-adapter-inventory.md).

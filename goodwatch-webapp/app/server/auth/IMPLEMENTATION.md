# Strict CrateDB adapter — #548

Better Auth and the regression harness use exactly **1.7.7**. This branch supplies
the database adapter, schema and CI. Auth-service wiring belongs to #549;
production and Supabase are unchanged.

Use the [copy rehearsal runbook](../../../../docs/auth-supabase-import-rehearsal.md)
for #551's Supabase importer.

## Interface and transport

`crateAuthAdapter({ sql, encryptionSecret, maxEnumeration? })` keeps its existing
factory interface. A non-test transport requires a secret of at least 32
characters. Changing the secret requires migrating ciphertext and keyed indexes.

`crateAuthTransport(origins, timeoutMs?, { username, password }?)` adds an optional,
backwards-compatible third argument for HTTP Basic authentication. Use dedicated
auth credentials, with DQL/DML on the auth tables only, and deny the general
webapp user those tables. Migrations require a separate privileged connection.
No production privileges are provisioned by this branch. The transport never logs
SQL or parameters. Reads can try another coordinator. Writes can switch
coordinators only after a proven connection-establishment failure (connection
refused, DNS resolution failure, or connection timeout before transmission).
Timeouts after transmission and server failures are never blindly replayed.

`CrateAuthRequestError` retains CrateDB's actual message, code and HTTP status.
Definite request refusals, including code 4000 for oversized indexed values,
propagate as refusals. Duplicate identities retain code `23505`. A possibly
applied write without its own readable receipt raises `IndeterminateAuthWriteError`.

## Storage and receipt recovery

`migrateAuthTables(sql)` explicitly creates thirteen model tables and the email
claim table under `doc.auth_`. Tables have one unpartitioned shard, two replicas,
REQUEST translog durability and `write.wait_for_active_shards=1`. Conditional reads
use primary-key Get and writes use only key/`_seq_no`/`_primary_term` CAS; business
predicates are rechecked on the decrypted row.

Both encrypted text columns use **INDEX OFF and columnstore=false**. Turning off
only the index still hits the DocValues 32,766-byte limit. These settings are
creation-time settings ([CrateDB storage documentation](https://cratedb.com/docs/guide/performance/storage.html)).
Migration checks reject incompatible earlier indexed/column-stored tables and old
email-claim schemas instead of silently reusing them.

The payload envelope is **v2**: AES-256-GCM binds `(table, physical id, purpose)` as
associated data, and authenticates the deleted flag inside the ciphertext. The
plaintext deleted column is an enumeration hint; each nominated row is reread by
PK and its authenticated deleted state checked. Ciphertext swaps fail integrity
verification; flipping the plaintext flag cannot resurrect a tombstone. Dates are
restored using Better Auth's model schema. Adapter results expose no envelope,
receipt, claim-generation or CAS metadata.

Receipts are a bounded ring of **256 operation IDs and base versions**, committed
in the same CAS as the payload. They contain no row snapshots, personal data or
provider tokens. The pending invocation already knows the result it submitted;
its receipt proves ownership of that result even after later writers. If its
receipt might have been evicted, recovery fails indeterminate. It never mistakes
an evicted winner for a losing operation. Association recreation starts a new
receipt ring and completely replaces the old document.

Deletion replaces the live payload with `{ id }` in an authenticated tombstone,
and clears lookup metadata and created/expiry columns. This erases personal data
and credentials from the current logical row without erasing receipt ownership.
It does not erase older database snapshots, backups or unmerged storage-engine
versions; those need an explicit retention and backup policy. Non-reusable token
keys remain tombstoned to prevent replay.

Verification identifiers and normalized email claim keys are domain-separated
HMACs. Raw reset/deletion identifiers exist only inside authenticated ciphertext;
lookup indexing never stores them in clear text. Better Auth's default plain
identifier configuration and its hashed configuration both remain compatible.
Email change and account deletion release the old claim after successful user
CAS. Claim generations fence delayed releases and A→B→A changes. A definite failed
user insert also releases its claim, including a supplied-id collision with an
existing different insert. Own-receipt recovery happens before collision cleanup;
claims already adopted by the current row or with uncertain ownership remain protected. A process crash or an ambiguous multi-row
failure can still leave an orphan claim: user and claim writes are not one
transaction, and uncertain ownership requires reconciliation rather than unsafe
address reuse.

## Enumeration and contention

The manifest follows #531's exact-version calls, including hook pre-reads,
renamed schema fields, batches, and gated verification/rate-limit/session modes.
Unlisted predicates, OR, insensitive matching, ownership changes, invalid
rotation fields and sorting fail closed. Google sign-in's unchanged `providerId`
assignment is accepted; changing the actual identity key is rejected. Batch PK
fan-out is model-aware. Native joins remain disabled and transactions unsupported.

Enumeration refreshes once, then reads ordered 100-ID pages up to
`maxEnumeration` (default and maximum 10,000), rereading and matching each key.
At Better Auth's factory default limit the strict adapter returns the complete
bounded population: its delete-hook pre-read swallows exceptions and deleteMany
ignores limits, so a truncation exception would silently skip hooks. Other explicit
limits and offsets remain supported; an explicit limit equal to the configured
factory default also returns the complete population. Populations over the safety
bound refuse mutation rather than silently truncate.

Plain assignments, bulk assignments and deletions retry up to 64 **proven** CAS
version conflicts with a fresh read and all predicates rechecked. Deleted rows
are never resurrected. `consumeOne` and `incrementOne` make one logical attempt;
computed deltas and guarded rotation/consumption are never blindly retried.

## Running and CI

Use Node 24+, Docker Compose, about 3 GiB of cluster memory, loopback ports
**15748–15750**, and `vm.max_map_count >= 262144`. The new ports avoid #549's local
cluster; its original loopback transport addresses remain accepted for callers.

```bash
cd goodwatch-webapp
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth
```

The runner pins CrateDB **5.10.12** by digest, checks three node names/versions and
three STARTED copies of every table, runs focused types, integration/failover,
upstream conformance and real Better Auth regressions, and removes only its own
project's containers, volumes and network. Logs are in ignored
`scripts/auth-cratedb/results/`. It refuses to reuse an existing test project.

`.github/workflows/auth-cratedb.yml`, job **auth-cratedb**, uses a disposable Ubuntu
runner, Node 24, locked dependency installs and uploaded evidence. No production
secret is needed. The isolated harness pins core/test-utils/oauth-provider 1.7.7
and compatible Zod 4; the webapp retains Zod 3. Generic conformance mode remains
restricted to registered local transports; core-flow and regression suites use
the strict adapter.

## Regression evidence

Verified on October 14, 2026 in [CI run 38629108690](https://github.com/alp82/goodwatch-monorepo/actions/runs/38629108690)
at code commit `e7033d40`, using Node **24.21.0** and the pinned three-node cluster:
**261 Vitest cases** (246 upstream cases plus 15 real Better Auth regressions)
and **25 integration/fault cases** passed with no failures or skips. Focused
adapter and harness types passed. Both primary-loss schedules returned SQL
rowcount 0 and recovered the invocation's own winning result. Whole-app typechecking
reports the same **174 baseline diagnostics**, with zero added or removed
diagnostics after normalizing the baseline checkout path.


Each blocking defect was reproduced red through Better Auth before its fix:
Google account updates failed with an indeterminate write, 103-session logout ran
zero hooks, and parallel session checks returned unauthorized failures. Additional
red regressions exposed plaintext reset identifiers and retained deletion data.
The large-payload regression also exposed the residual DocValues size limit.

The real Better Auth regression suite covers:

- 80 Google account updates with realistic provider token sizes, 300 session
  updates (crossing receipt-ring capacity), and 300 DB-rate-limited handler calls.
- Sign out everywhere, password reset and account deletion, each with 103
  sessions and 206 session-bound access/refresh tokens; every delete hook runs
  and every seeded token is revoked by the actual OAuth-provider plugin.
- Four simultaneous session checks and four concurrent Google sign-in handlers,
  with barriers forcing competing writes against the same version. Google callbacks
  enter through a disposable Better Auth endpoint calling its real OAuth sign-in
  handler; provider identity/token fixtures replace the external Google service.
- Sign-out racing session refresh, and OAuth logout racing a guarded rotation
  of the first captured refresh token; the remaining tokens are still revoked.
- Email reuse after address change/deletion, delayed claim release during ABA,
  hashed reset identifiers with a working reset link, erased profile/provider
  credentials, and a flipped tombstone that cannot restore authentication.
- Actual CrateDB code-4000 rejection through Better Auth, and a dedicated local
  database username/password with an unreachable coordinator.

The existing 246 upstream cases and 25 integration cases include 24-way races and
forced primary loss after application: consume and increment must recover their
own outcome even when CrateDB returns rowcount 0. Final run evidence and CI links
are recorded in #548 and PR #564. Focused types are required; the full app's
pre-existing type diagnostics are reported separately.

## Remaining safety boundaries and rollout prerequisites

- **Prerelease schema change:** v1 payloads/plain email claims and indexed tables
  are incompatible. #549/#551 must rebuild their disposable auth tables or perform
  an explicit offline migration/reimport before adopting this head. This branch
  does not delete or migrate another thread's data or any production data.
- **Privileged DB writes:** AEAD detects tampering and cross-row swaps, but cannot
  prevent rollback of an entire previously valid encrypted row or deliberate
  deletion/index corruption by a database administrator. DB write access is out
  of the authentication threat boundary; separate credentials and grants are
  required before rollout. Keeping the application credential away from the auth
  tables is part of that boundary.
- **Upstream hook failures:** Better Auth catches delete-hook pre-read and OAuth
  planning/revocation failures. Complete enumeration fixes the reproduced normal
  >100-session case, but an independent transient hook-read failure or revocation
  write failure can still be swallowed. An adapter alone cannot make those
  upstream phases atomic or require the endpoint to fail after a swallowed error.
  Monitor and reconcile failures; do not claim logout is an atomic transaction.
- **Issuance versus revocation:** parent rotation, child issuance, replay-response
  storage and family sweeps are separate writes. A child minted during a sweep
  can escape its captured set. Session/cache/JWT enforcement must remain
  authoritative; the adapter cannot repair that provider protocol.
- **Cache/JWT revocation:** #531's missing active-session index and standalone MCP
  JWT verification findings remain. A database mirror alone does not invalidate
  orphaned cached sessions or make a self-contained JWT consult revocation.
  Offline-access refresh tokens intentionally survive session logout upstream;
  launch policy must account for that distinction.
- **Scope of verification:** tests use real local CrateDB and real Better Auth/
  OAuth-provider calls with disposable identities. They do not contact live Google,
  deliver RP back-channel HTTP/JWT notifications, run live Valkey, or deploy.
  CrateDB versions other than the pinned 5.10.12 are unverified.

## Source evidence

- [Map #529](https://github.com/alp82/goodwatch-monorepo/issues/529).
- [#530 proof and failover correction](https://github.com/alp82/goodwatch-monorepo/blob/research/cratedb-cas-proof/docs/research/auth-on-cratedb-verification.md).
- [#531 exact-version inventory](https://github.com/alp82/goodwatch-monorepo/blob/research/better-auth-adapter-inventory/docs/research/better-auth-adapter-inventory.md).
- [Adversarial review](https://github.com/alp82/goodwatch-monorepo/pull/564#issuecomment-6176587280).

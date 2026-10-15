# Auth maintenance and safety — #565

Built on `auth/mcp-authorization` / draft #581, including wiring #573, adapter
#564 and member read tools #577. Branch `auth/maintenance-jobs`, draft #587,
map #529. This work does not deploy, migrate production, change production grants,
or merge a PR.

## Execution and job contract

When Better Auth is enabled, `runtime.server.ts` starts one maintenance worker per
process after constructing the auth service. It waits 60 seconds before the first
pass and 60 seconds after each completed or failed pass. Passes never overlap in
one process. Different processes can run together: decisions use authenticated
primary-key reads, row versions and conditional writes, with no expiring lock.
Shutdown stops scheduling and aborts at the next page boundary. An interrupted or
ambiguous write can safely be reconciled by the next pass; it is never reported
as a proven successful authentication operation.

Each job uses ordered keyset pages (100 rows in the worker, maximum 10,000 per
page), refreshes before nomination, and rereads every nominated row by primary
key. Maintenance does not use the adapter's bounded `findMany` or trust the
plaintext deleted hint. It can therefore repair a population that has already
exceeded the application enumeration bound. Cursors are process-local and a
restart begins again; a later pass catches rows inserted behind its cursor.
A pass's duration depends on stored rows, including retained replay barriers;
60 seconds is a scheduling delay, not a promise that every row is reconciled
within a minute.

| Job | Behavior |
| --- | --- |
| Email claims | Gives new reservations 15 minutes. Keeps a live owner's current address. Otherwise fences the user version, or inserts a missing-user barrier tied to the abandoned operation, before conditionally releasing the unchanged claim. |
| Orphan reconciliation | Collects unconfirmed users after 48 hours and releases their unchanged email claim; collects never-authorized clients after 24 hours, including partial DCR/CIMD registration leftovers; removes sessions/accounts of deleted users, obsolete browser credential versions, consents/tokens of missing or disabled clients, client-resource associations with missing parents, and tokens outside their current grant. Offline grants survive browser sign-out. Unbound refresh minting gets 15 minutes before collection. |
| Garbage collection | Expires sessions, verifications, OAuth tokens and client assertions; archives rotated refresh parents after their retry window; retires signing keys after verification grace; collects receipts after 24 hours; purges deleted rows after 30 days; repairs both the deleted flag and lookup hints from authenticated state. |
| Capacity reconciliation | Keeps live and recent pending reservations. Before freeing a missing, deleted or archived row's slot, writes an admission-generation fence. A paused create cannot use that freed slot later. Missing rows get 15 minutes. Empty actor ledgers are physically purged after 30 days. |
| Payload key rotation | Rewrites both encrypted columns under the active payload key with CAS, preserving logical data, indexes, claims, admission fences and receipt ownership. Competing changes are skipped and retried in later passes. |

The worker emits `goodwatch_auth_maintenance_total{job,outcome}` and
`goodwatch_auth_maintenance_last_completed_seconds`. Job/outcome labels are a
fixed bounded vocabulary; reports contain counts and model names. An unreadable row is skipped and counted in `goodwatch_auth_maintenance_quarantined_total{table}`. Its table and physical row ID are logged to stderr and Sentry, without payloads, credentials, IPs, SQL or parameters. This applies to every job, including claim-parent reads, individual capacity slots and key rotation. Audit marks skipped rows unsafe. Transport failures still fail the pass; they are not misreported as corrupt rows. Capacity runs first, and deletion/archive jobs return slots as each row completes. Pass failure emits a generic Sentry alert.
Monitor failed pages, capacity refusals and the age of the last completed pass;
a stalled worker affects cleanup/issuance capacity, while authorization checks
continue to fail closed. Do not interpret a failed pass as a completed sweep.

## Receipt and tombstone retention

The issue's original 4,096-receipt figure predates #564's reviewed implementation.
The current ring holds **256** operation IDs/base versions, with no old row
snapshots or credentials. New receipts have authenticated timestamps. Receipts
without a timestamp are stamped on their first maintenance pass and kept for
another 24 hours; unknown age is not treated as old age.

After 24 hours, receipts can be removed. An invocation still recovering an old
acknowledgement can then receive `IndeterminateAuthWriteError`, never a false
success or false proof that it lost. The ring may evict receipts sooner under
heavy contention; that already has the same fail-closed behavior. Never retry a
logical consume/increment automatically after an indeterminate result.

Deletion erases profile/credential data and retains an authenticated `{id}` barrier
for **30 days**, then garbage collection physically removes it by row-version CAS.
The rule includes admission-fenced rows; passes no longer retain all history forever.
Empty capacity ledgers also expire after 30 days. New ledger reservations clear the
empty timestamp, and a concurrent reservation makes a purge CAS lose.

Adapter inserts carry a **15-minute write lease**, enforced inside CrateDB with
`CURRENT_TIMESTAMP` and the NOT NULL encrypted-payload column. This keeps a delayed
insert from appearing after its barrier or ledger has been purged. A duplicate insert
still uses CrateDB's native 4091 duplicate-key outcome; conditional `INSERT SELECT`
is deliberately avoided because CrateDB reports duplicate inserts as rowcount zero.
Receipt-based ambiguous-write recovery remains unchanged. Recreating an association
or unused metadata client requires a fresh reservation and CAS of its barrier.

A missing-user barrier records the abandoned claim operation. A fresh email
reservation may adopt it by CAS under the same forced Supabase ID (#551); the
abandoned operation cannot. Successful adoption clears that privilege, so deleting
a successfully imported member does not leave a reusable import barrier.

Rotated refresh parents enter an authenticated **archived** state after their
explicitly configured **30-second** retry window (`refreshTokenReuseInterval: 30`). They leave active enumerations and admission capacity,
and their encrypted retry response is erased. Primary-key token lookup still
returns revoked protocol metadata so the provider can authenticate the client
and detect replay. That metadata lasts through the original refresh expiry,
then becomes the minimal tombstone. The plaintext `deleted` column nominates
both deleted and archived records; maintenance derives it from authenticated
state. Normal refresh traffic does not consume 90 days of live admission slots.

Logical erasure does not erase old Lucene versions, database snapshots, backups
or retained secret backups. Rollout must specify database snapshot and secret
backup retention together. No backup-retention or infrastructure policy is
silently changed here.

## Per-actor issuance bounds

There is **no global user or account cap**, and no site-wide 8,192-member ceiling.
Users resolve by physical ID or unique email claim; linked accounts enumerate per
member. An account create may only replace the exact tombstone it observed before
its insert attempt, so removing its quota does not let a paused create undo unlink. The runtime uses the following isolated actor ledgers:

| Model | Actor | Live/pending allowance |
| --- | --- | --- |
| Browser sessions | Member | 20; a new session revokes the oldest reservation's session and removes its Valkey entry |
| OAuth access/refresh tokens | Member | 1,024 per model |
| OAuth consents / owned clients | Member | 128 per model |
| Client resources / client assertions with an owner | Client | 128 per model |
| Verification rows | Identifier | 128 |

Actor identifiers are SHA-256 hashes inside bucket IDs. Verification identifiers
first use their permanent-root HMAC lookup key, so ledger IDs do not reveal
dictionary hashes of email addresses or verification identifiers. A full allowance refuses
only that actor. The Valkey active-session index is also clamped to 20 entries;
a missing cache index still falls back to the authoritative database. The reservation CAS includes pending inserts, so concurrent writers
cannot overbook it. Deletion and refresh-parent archiving install a generation fence
and return the matching slot immediately; a sweep handles crashed pending inserts
after 15 minutes. Generations survive ordinary reconnect/cleanup cycles. The
30-day ledger purge is safe because it outlasts the insert lease.

Anonymous DCR/CIMD clients have **no shared admission pool**. DCR is limited to
**30 attempts per trusted IP per hour** with Valkey's atomic expiring counter,
independently of Better Auth's generic limiter. The configured ingress must replace
the trusted IP header; untrusted forwarding headers do not override it. Missing IPs
share an `unknown` budget. No global registration budget can starve other IPs.
Never-authorized clients are collected after 24 hours; failed-registration child
reservations are recovered too. Client authorization history is authenticated and
written by CAS after consent creation. Collection either loses that CAS or issuance
fails closed. A collected, never-authorized metadata URL can register afresh without
waiting 30 days. Previously authorized clients survive grant disconnection.

Unconfirmed signups are collected after **48 hours**, beyond the 24-hour confirmation
window, using the user-version CAS. Their credential accounts are reconciled in the
same pass and their unchanged email claim is released. Verification racing collection
must win the user CAS to preserve the member.

The adapter still refuses enumerations above 10,000 rather than silently truncate
hooks. Member/client predicates are protected by their own allowances; static
resource/signing-key populations are operational configuration. Maintenance and
expiry scans use keyset pages independently of those application limits. No global
census of members or linked accounts is required.

**Rollout requirement:** migrate `doc.auth_capacity` with the thirteen model tables
and email claims (15 tables total). Importing #551's users/accounts requires no
capacity admission. Other issued auth rows must use the runtime's per-actor policy
and key ring. Older prerelease global-ledger/session data requires a disposable
rebuild or coordinated offline reimport; the audit rejects mismatched actor ledgers.
Never rebuild production automatically. Bounds changes require a coordinated audit.

## Keys and recovery

Three separate secrets/roles matter:

- `AUTH_CRATEDB_ENCRYPTION_SECRET` is the permanent lookup-index root. It derives
  email claim/verification HMACs and legacy v2 payload encryption. Preserve it
  across deploys and restore it with database snapshots. Never rotate it in place.
- `AUTH_CRATEDB_ENCRYPTION_KEYS` is a durable secret JSON key ring, with an active
  ID and up to 16 independent random secrets of at least 32 characters. New v3
  ciphertext authenticates its key ID and `(table, physical id, purpose)`.
  Example shape: `{"active":"2026-10","keys":{"2026-10":"<random secret>"},"allowLegacy":true}`.
  The runtime requires this configuration; absence/unknown keys fail closed.
- `BETTER_AUTH_SECRET` remains independent and stable. Better Auth also encrypts
  Google credentials, signing private keys and refresh retry responses with it.
  Rotating payload keys does not rotate this inner encryption layer.

Store these in the deployment's secret store, not the repository, image or
command line. Keep an access-controlled encrypted recovery copy, including
retired keys needed by retained database snapshots. Restore rehearsals must
prove login, email lookup, Google credential decryption and OAuth refresh/JWKS
using a matching snapshot and complete secret set.

Payload key rotation procedure:

1. Generate a new independent secret under a never-reused key ID. Distribute it
   to **every reader/writer**, retaining the old active ID and old keys first.
2. After all processes understand the new ID, switch every writer to it. Drain
   old writers, requests and jobs. An old writer can otherwise reintroduce old
   ciphertext behind a completed cursor.
3. Run the rotation job to completion over every model **and capacity**. Repeat
   until every page succeeds with zero conflicts. This does not change email
   claim keys or verification indexes.
4. Retain old decrypt keys through the rollback window. To certify retirement,
   run a complete pass with only the retained keys and `allowLegacy:false`, then
   the launch audit, with old writers drained. Every payload and receipt must
   authenticate. A key ID/hint alone is not proof of decryptability.
5. Remove retired keys from live configuration only after that proof; preserve
   recovery copies for snapshots still retained. Never log the JSON or secrets.

Changing the permanent root needs a different, **offline re-key migration**:
stop ingress and every writer/job, snapshot and restore an isolated copy,
decrypt with the old root/key ring, validate unique normalized live emails,
rebuild email claim HMAC primary keys with their current owner/generation,
recompute verification lookup HMACs, invalidate/reissue browser credential
version bindings, and reencrypt legacy envelopes. Validate
all lookups/claims, receipts, login and OAuth flows before atomically switching
all configuration and traffic. Keep rollback data/config together. There is
no online root-rotation switch or implemented root re-key tool in this PR;
regenerating the root during deployment is data loss, not maintenance.

Signing keys are different from payload keys. Better Auth persists them in
CrateDB, encrypting private keys inside the adapter envelope. JWT signing rotates
after **30 days**, on demand when minting needs a current key. Public keys remain
published for **24 hours after signing expiry**, longer than the 300-second MCP
access-token lifetime. Garbage collection then erases old signing material and
keeps the identity tombstone. Multiple concurrent mints can create multiple
valid keys; durable storage and the population cap still apply.

## Revocation and non-atomic steps

Browser sessions last 90 days, renewing at most daily. Cookie caching is off.
Every cached read rechecks the current CrateDB session/user; a missing Valkey
index cannot undo deletion. Database fallback uses the same strict adapter.
New sessions are bound to a private HMAC of the exact current password
credential (or the absence of a password for Google-only accounts). Email login
rechecks the current password at session creation; the successful response
rechecks the inserted session. Password changes therefore reject old sessions,
including a login paused before insertion. Reconciliation removes those rows
and their known Valkey keys. Missing credential bindings fail closed and require
sign-in. A bcrypt-to-scrypt upgrade restamps the new session; older browser
sessions bound to the previous stored hash also need to sign in again.

Sign-out deletes its exact browser session. Sign out everywhere/password reset
and other-device sign-out enumerate the complete bounded captured set and use
CAS deletion; a refresh cannot resurrect a deleted session. A concurrent fresh
login with still-valid credentials is a new sign-in, not part of that captured
set. Password changes additionally fence the old credential as described above.
No endpoint or multi-row sweep is advertised as a database transaction.

Offline MCP grants survive ordinary website sign-out and password changes, per
#534. Their browser session ID is a grant reference, not a live-session
requirement. MCP verifies the signature/expiry/issuer/audience and current
member, client, exact consent and grant version on every request. Disconnecting
one computer deletes that grant; reconnect creates a new version, so old JWTs
and refresh tokens cannot return. Already admitted requests can finish.

Terminal refresh revocation (including provider family deletion/reuse sweeps)
now **conditionally deletes matching grant versions before token writes**.
A client/member family sweep closes matching grants even if its captured token
set is empty. The revocation endpoint validates token/client ownership before
the provider's revoked-token family branch.
A child inserted after the captured sweep is therefore unusable at JWT/refresh
checks, and token-response binding rejects it. Normal rotation carries
`rotatedAt` and keeps the grant and its 30-second retry window. Each refresh
request pins the grant ID/version observed before issuance; signing cannot
adopt a new version if disconnect/reconnect races that request. Explicit refresh
revocation now disconnects that grant immediately for MCP JWTs as well. An opaque
access-token-only revocation is not a general JWT denylist; use Connected apps
disconnection for that contract. Upstream reuse sweeps can cover multiple
captured grants for the same member/client; this is not a per-computer
revocation guarantee for refresh-token replay.

Minting, parent rotation, child insertion, response persistence and sweeps remain
separate writes. Reconciliation catches missing parents, deleted/mismatched
grants, terminal unfenced revocations and abandoned unbound children. Archived refresh parents retain authenticated protocol evidence until their
original expiry without occupying the live enumeration/admission population. Sweep failure may require retry/reauthorization; it never proves an
unseen child was deleted. Session/credential/grant checks, not eventual cleanup,
provide the authorization decision.

Auth table write credentials must be dedicated and denied to the general app
credential (#562); the new capacity table needs the same protection. Encrypted
deleted state prevents resurrection and maintenance repairs the plaintext hint,
but a database administrator can still roll back or corrupt an entire valid
row/index. That privileged capability remains outside the auth threat boundary.
No production grants are provisioned here.

## Commands and local evidence

From `goodwatch-webapp`, with Node 24+ and the pinned local Docker images:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth:maintenance
```

The runner forces a local Unix Docker socket and fresh project
`goodwatch-auth-565`, with three CrateDB 5.10.12 nodes, three Valkey 8.1.10 masters,
a separate local data cache and Mailpit. Ports 15648–15650, 15701–15704 and
15625/15680 bind only loopback. It refuses to reuse an existing project and
removes only its containers, volumes and network on exit. It loads no dotenv.
Each serial maintenance test suite resets only this runner's fixture rows.
Ignored results are under `scripts/auth-maintenance/results/`.

`npm run auth:maintenance -- audit` is read-only apart from index refreshes;
unsafe/quarantined results exit 2. `run-once` also exits 2 after completing a pass with quarantined rows; `rotate` reports skipped counts and exits 2 for skipped/conflicting rows. Never retire a key after that incomplete result. `run-once` runs cleanup/reconciliation/rotation,
and `rotate` rewrites every encrypted storage table. They require explicit auth
CrateDB origins/credentials, permanent root and JSON key ring in the environment;
no dotenv, SMTP or production startup task is loaded. Successful output contains job counts; quarantined rows additionally log their table and physical ID. The manual CLI has no Valkey connection; surviving cache keys expire
normally and cannot override authoritative DB checks. The runtime worker can
also remove known orphan cache keys through its existing Valkey connection.

Validation includes real-store crash/late-writer races, admission contention,
reconnect fencing, retention beyond the adapter's enumeration bound, key-ring
restart/retirement, actual HTTP/JWKS signing rotation under a controlled clock,
and the existing auth/MCP HTTP suites. CI runs the same command in
`.github/workflows/auth-maintenance.yml`. Exact final counts and run links are
reported on #565 and draft #587. Production, hosted client relinking, root re-key
execution and backup restore execution remain rollout/rehearsal work, not claims
of this local verification.

## Earlier verification — October 14, 2026 (before adversarial follow-up)

At product-code commit `7c0c4ee3`, the clean local runner passed **53**
maintenance/auth/MCP cases with real Docker CrateDB and Valkey. The adapter runner
passed **25** integration/failover cases plus **262** upstream/conformance/core
regressions (**287** total); both lost-primary schedules recovered their own
outcome after SQL rowcount zero. Endpoint/cache/metrics regressions passed **63**
cases. Local Node was **26.8.1**. Focused auth types, focused Biome, shell syntax
and the production build passed (Sentry upload explicitly disabled). Full-app
types retain exactly **174** normalized baseline diagnostics against #581's
`b91ae3b0`, with none added or removed.

Node 24 CI passed the same
[53-case maintenance/auth runner](https://github.com/alp82/goodwatch-monorepo/actions/runs/38651541732)
and the
[287-case adapter runner](https://github.com/alp82/goodwatch-monorepo/actions/runs/38651545213).
The operator CLI's `audit`, `run-once` and subsequent audit with legacy decryption
disabled also succeeded against the disposable local store. Owned containers,
volumes and networks were removed after verification. No production operation,
merge, hosted-client relinking, root re-key execution or backup restore was run.


## Follow-up verification — October 15, 2026

Product-code commit `3a549edb` replaces the initial global caps and permanent
barriers with the actor/retention policies above. A clean disposable local Docker
run passed **72/72** maintenance/auth/MCP cases, including 19 additional cases and
strengthened existing assertions. Node 24 CI passed the same
[72 cases](https://github.com/alp82/goodwatch-monorepo/actions/runs/38661220849)
and the [287-case adapter suite](https://github.com/alp82/goodwatch-monorepo/actions/runs/38661226026)
(25 integration/failover plus 262 conformance/core). Both primary-loss schedules
returned rowcount zero and recovered the invocation's own outcome.

Repros cover account lifetime limits, isolation between actors, oldest-session
revocation and Valkey cleanup/index size, DCR's trusted-IP budget, unused and
partial registrations, metadata URL reuse, unconfirmed signup/claim collection,
quarantine continuation and CLI exit status, incremental slot return, physical
row/ledger purge, delayed insertion after purge, forced-ID import retry, account
unlink races, keyed verification actor identities, lookup repair and the exact
30-second refresh replay window.

Endpoint/cache/metrics regressions passed **63** cases. Focused auth types,
focused Biome, shell syntax and the production build passed with Sentry upload
disabled. Whole-app types still match all **174** normalized baseline diagnostics
from #581 / `b91ae3b0`, with zero additions or removals. Local Node was 26.8.1;
CI used Node 24. Owned fixture containers, volumes and network were removed.
No production operation, deployment or merge was performed.

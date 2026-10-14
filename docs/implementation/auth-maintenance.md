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
| Email claims | Gives new reservations 15 minutes. Keeps a live owner's current address. Otherwise fences the user version, or inserts a permanent missing-user tombstone, before conditionally releasing the unchanged claim. |
| Orphan reconciliation | Removes sessions/accounts of deleted users, obsolete browser credential versions, consents/tokens of missing or disabled clients, client-resource associations with missing parents, and tokens outside their current grant. Offline grants survive browser sign-out. Unbound refresh minting gets 15 minutes before collection. |
| Garbage collection | Expires sessions, verifications, OAuth tokens and client assertions; retires signing keys after verification grace; collects receipts after 24 hours; repairs deleted hints from authenticated state. |
| Capacity reconciliation | Keeps live and recent pending reservations. Before freeing a missing or deleted row's slot, writes a permanent admission-generation fence. A paused create cannot use that freed slot later. Missing rows get 15 minutes. |
| Payload key rotation | Rewrites both encrypted columns under the active payload key with CAS, preserving logical data, indexes, claims, admission fences and receipt ownership. Competing changes are skipped and retried in later passes. |

The worker emits `goodwatch_auth_maintenance_total{job,outcome}` and
`goodwatch_auth_maintenance_last_completed_seconds`. Job/outcome labels are a
fixed bounded vocabulary; reports contain counts and model names, not users,
emails, IPs, tokens, keys, SQL or parameters. Failure emits a generic Sentry alert.
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

Deletion erases profile/credential data from the logical row and retains an
AEAD-protected `{id}` barrier plus necessary admission fencing metadata. User,
session, verification, OAuth token/client/assertion and signing-key identities
are not recycled. Admission-fenced association tombstones also stay: deleting
one would let an arbitrarily delayed create escape its reclaimed capacity slot.
Garbage collection removes their receipts and sensitive data, **not these replay
or admission barriers**. Unadmitted reusable association/rate-limit tombstones
can be physically removed after 24 hours. Retained barriers increase physical
row count; maintenance streams them, while application bounds concern live and
pending admitted rows.

Logical erasure does not erase old Lucene versions, database snapshots, backups
or retained secret backups. Rollout must specify database snapshot and secret
backup retention together. No backup-retention or infrastructure policy is
silently changed here.

## Launch population bounds

The runtime enables CAS-backed admission for every model except `user`. Each
model has **64 deterministic buckets with 128 live/pending identities each**:
**8,192 admitted identities per model**, below the adapter's 10,000-row bound.
The buckets are distributed by the physical identity hash; a single bucket can
fill before the model total does. Full buckets refuse creation rather than
silently truncate a later revoke/delete hook. There is no unlimited-launch
claim and no eviction of another member's valid credentials.

Admission happens before insertion. A reservation counts even if insertion
crashes or its acknowledgement is lost. Reconciliation fences its physical row
before returning that capacity. A monotonic generation survives deletion and
recreation, so an old create cannot appear after multiple reconnect/cleanup
cycles. Concurrent creators cannot overbook the configured buckets. Different
bounds on different processes are rejected, not combined. Changing bounds or
bucket count needs an offline rebuild/reimport and a new audit.

User lookups use physical IDs or unique email claims; they never enumerate the
entire user table. The hard model cap also bounds every launch enumeration's
filtered subset, including global verification expiry, JWKS and resource lists.
The database rate limiter is not used by the runtime, but the same admission
policy applies if enabled. Bulk primary-key fan-out remains model-aware.

This cap is deliberately conservative. Capacity exhaustion can refuse sign-in,
refresh, registration or another auth operation until stale entries are
collected. DCR clients count too; endpoint rate limits are not a guarantee that
public registration cannot consume the cap. Monitor occupancy and plan capacity
before approaching the limit. Raising it above 10,000 without redesigning the
adapter's complete delete-hook enumeration is unsupported.

**Rollout requirement:** migrate the new `doc.auth_capacity` table explicitly
along with the thirteen model tables and email claims (15 tables total). #551's
import/rehearsal must use the same adapter `populationBounds: true` and payload
key ring as `createGoodwatchAuth`. Users themselves need no slot; their account
rows do. Existing prerelease rows written without admission are not silently
adopted: runtime reads reject them, and the launch audit reports them. Rebuild
only disposable stores here; production needs the coordinated migration plan.

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
recompute verification lookup HMACs, and reencrypt legacy envelopes. Validate
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

Terminal refresh revocation (including a provider family/reuse sweep) now
**conditionally deletes the matching grant version before token writes**.
A child inserted after the captured sweep is therefore unusable at JWT/refresh
checks, and token-response binding rejects it. Normal rotation carries
`rotatedAt` and keeps the grant and its 30-second retry window. Explicit refresh
revocation now disconnects that grant immediately for MCP JWTs as well. An opaque
access-token-only revocation is not a general JWT denylist; use Connected apps
disconnection for that contract. Upstream reuse sweeps can cover multiple
captured grants for the same member/client; this is not a per-computer
revocation guarantee for refresh-token replay.

Minting, parent rotation, child insertion, response persistence and sweeps remain
separate writes. Reconciliation catches missing parents, deleted/mismatched
grants, terminal unfenced revocations and abandoned unbound children. Rotated
refresh parents remain until expiry so the retry/reuse protocol still has its
evidence. Sweep failure may require retry/reauthorization; it never proves an
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
nonzero unsafe results exit 2. `run-once` runs cleanup/reconciliation/rotation,
and `rotate` rewrites every encrypted storage table. They require explicit auth
CrateDB origins/credentials, permanent root and JSON key ring in the environment;
no dotenv, SMTP or production startup task is loaded. Output contains only job
counts. The manual CLI has no Valkey connection; surviving cache keys expire
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

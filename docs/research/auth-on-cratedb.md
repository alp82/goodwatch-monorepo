# Better Auth on CrateDB

Research date: 2026-10-14. Status: design proposal from research, not an approved implementation plan. Follows [Self-hosted auth to replace Supabase](self-hosted-auth.md) after the decision: **no Postgres; the auth tables live in CrateDB.**

Two research passes produced this:

- **Better Auth source.** Read at tag `v1.7.7` (`db02f23`), covering core, `better-auth`, `@better-auth/oauth-provider`, `@better-auth/mcp`, `@better-auth/cimd` and `@better-auth/test-utils`.
- **CrateDB 5.10.** Its docs and Java source, read from the `crate/crate` repository on branch `5.10` (cratedb.com refused the sandbox), plus GoodWatch's own CrateDB code.

Behaviour marked **(verify)** was inferred from source, not observed on a running cluster.

## Summary

1. **It can be made reliable, but only with a strict, purpose-built adapter.** CrateDB gives exactly three guarantees that can be relied on:
   - Primary-key uniqueness is atomic.
   - A read by the full primary key sees every acknowledged write immediately.
   - `UPDATE`/`DELETE … WHERE <pk> AND _seq_no = ? AND _primary_term = ?` succeeds for exactly one writer.

   Anything else is refresh-lagged (about 1 s) and has no atomic condition. The adapter must turn every lookup that matters into a primary-key read and every conditional write into a compare-and-set on `_seq_no`.
2. **Better Auth 1.7.7 no longer needs transactions for its dangerous races.** The fixes for double auth-code redemption (GHSA-7w99) and refresh-token forks (GHSA-392p) rest on two adapter primitives, `consumeOne` and `incrementOne`, which must report exact affected-row counts. Implemented natively as primary-key read + CAS, they are as safe on CrateDB as on Postgres. Their built-in fallbacks are not, because they filter on non-key columns.
3. **Uniqueness becomes key design.** Better Auth relies on unique columns (`user.email`, `session.token`, `oauthClient.clientId`, the refresh and access tokens) and treats a duplicate `(providerId, accountId)` account as a permanent sign-in failure. Each becomes either the row's primary key (a hash of the value) or a small claim table keyed by it. Every community adapter for a non-transactional store (DynamoDB, Firestore, Cosmos) does the same.
4. **Single-use values go to Valkey; durable records go to CrateDB.** Sessions, rate limits, auth codes, password-reset tokens and OAuth state live in Valkey, where `getAndDelete` and `increment` are atomic. Users, accounts, signing keys and the OAuth provider's clients, tokens and consents live in CrateDB.
5. **What the missing transactions still cost:**
   - A crash between steps can leave an orphan row (for example a user without an account). Ordered, idempotent writes and a cleanup job handle it.
   - Revoking a whole refresh-token family after reuse is not atomic. That gap exists upstream on every database; Better Auth itself marks it as waiting for transactions.
   - Nobody else is known to run auth on CrateDB, so GoodWatch owns the adapter and its tests.
6. **CrateDB itself needs work first:**
   - Upgrade from 5.10.9 to 5.10.12 or later: 5.10.10 fixed an `INSERT … ON CONFLICT` race, and 5.10.11 had regressions, so skip it.
   - Give the auth tables a fixed replica count.
   - Encrypt the webapp's CrateDB traffic or keep it on a private network. It is plain HTTP with Basic auth today, and it would start carrying password hashes.

## What CrateDB guarantees

| Operation | Behaviour | Safe for |
| --- | --- | --- |
| `INSERT` with an existing primary key | Fails with `DuplicateKeyException`, code 4091. Exactly one concurrent insert wins: the row routes to one primary shard and is indexed with create semantics. | Uniqueness, claims |
| `INSERT … ON CONFLICT DO NOTHING` | rowcount 0 when the key exists | Idempotent creates (the tracking writer's pattern) |
| `INSERT … ON CONFLICT (pk) DO UPDATE` | Re-reads the current row and retries on version conflict, so `SET n = t.n + 1` is atomic per row. No `WHERE` on the conflict action. | Upserts, counters |
| `SELECT … WHERE` *every* PK column `= ?` (extra conditions allowed) | Real-time get from the translog; sees every acknowledged write | All lookups that matter |
| Any other `SELECT` | Sees data as of the last refresh: every 1 s by default, paused on a table idle for 30 s until the next query | Lists, cleanup, admin |
| `UPDATE/DELETE … WHERE pk = ? AND _seq_no = ? AND _primary_term = ?` | Compare-and-set; rowcount 0 when someone else wrote first. Only allowed with the full primary key. | Every conditional write |
| `UPDATE … WHERE pk = ? AND used_at IS NULL` | **Not a compare-and-set.** It runs as update-by-query on the last refresh, then applies the `SET` to the latest version without re-checking the condition. Two callers can both "win", and a row written under 1 s ago can be missed. | Nothing |
| `DELETE … RETURNING` | Does not exist (`INSERT/UPDATE … RETURNING` do, since 4.2) | — |
| Durability | Writes go to the primary and all active replicas before the acknowledgement. `translog.durability = REQUEST` (the default) syncs to disk before the acknowledgement. | — |

A rowcount of 0 from a compare-and-set does not always mean someone else won. CrateDB's resiliency page lists "retry of updates causes double execution" as very rare and still being worked on: after a primary failover, a retried write can report 0 although its first attempt landed. A client timeout leaves the same doubt. **On 0, read the row again and decide.** `crate.ts` already re-reads after a timeout in `upsert`.

GoodWatch already relies on these exact patterns. The tracking writer reads by full primary key, writes with a `_seq_no` / `_primary_term` check, retries, and creates with `ON CONFLICT DO NOTHING` (`tracking.server.ts:340-372`, `1630-1672`; ADRs 0008 and 0009).

## Where each piece of auth lives

| Data | Store | Why |
| --- | --- | --- |
| Sessions | Valkey (`secondaryStorage`), **and** CrateDB with `storeSessionInDatabase` | The Valkey cluster has no replicas and evicts keys that have a TTL under memory pressure (`volatile-lfu`). Sessions held only there would vanish with a node or under pressure, signing members out. The CrateDB copy is keyed by a hash of the token, so the lookup is a primary-key read. **(verify)** whether Better Auth falls back to the database when the Valkey key is missing; if not, the adapter's `secondaryStorage` can fall back itself. |
| Rate limits | Valkey | Atomic `increment`; losing a counter is harmless |
| Auth codes, password-reset tokens, OAuth state, change-email tokens | Valkey (leave `verification.storeInDatabase` off) | Consumed with atomic `getAndDelete`. Lost under eviction means "link expired, try again", which fails safe. Email verification itself is a stateless JWT with no row. |
| DPoP replay (`jti`) | Not used at first | Better Auth's authorization-server DPoP store needs `storeInDatabase: true`. Leave DPoP off until a client asks for it. `requireMcpAuth` accepts a custom `replayStore`, so the MCP route can use Valkey `SET NX EX` if needed. |
| Users, accounts | CrateDB | Durable records; uniqueness by key (below) |
| JWKS signing keys | CrateDB | Provisioned once at deploy; duplicates are harmless |
| OAuth clients (including CIMD clients), resources, client-resource links, access and refresh tokens, consents, client assertions | CrateDB | Durable; uniqueness by key (below) |
| CIMD metadata cache | Process memory | That is how `@better-auth/cimd` works |

## Table design

Every table is `CLUSTERED INTO 1 SHARDS`. Rules:

- No partitioning, which would weaken primary-key uniqueness.
- `TIMESTAMP WITH TIME ZONE` for times. Plain `TIMESTAMP` in CrateDB means without time zone, which is what `crate_schemas.py` uses today.
- Tokens are stored only as SHA-256 hashes, where Better Auth offers hashed storage.
- The primary key is the lookup key, so lookups are primary-key reads.

| Better Auth model | CrateDB table and primary key | How lookups and uniqueness work |
| --- | --- | --- |
| `user` | `auth_user (id)`: the Supabase UUID, kept for migrated users; new UUIDs for new ones | By id: primary-key read |
| `user.email` (unique) | `auth_user_email (email_norm)` → `user_id`, where `email_norm` = `lower(trim(email))` | **The claim.** Sign-up inserts it first; a duplicate key means "email taken" and is mapped to Postgres code `23505` with "duplicate key" in the message, so Better Auth's existing handling recognises it. `findOne(user where email)` = two primary-key reads. A change of email claims the new address, updates the user with a CAS, then deletes the old claim. |
| `account` (`providerId`, `accountId`), treated as unique | `auth_account (id)` with id = hash(`providerId`, `accountId`) | A second link of the same Google account hits the same key and fails, instead of creating the duplicate that breaks sign-in. Credential accounts use `accountId = user.id`, so the password lookup on sign-in is a primary-key read too. Listing a member's accounts is a refreshed query (below). |
| `session` | `auth_session (id)` with id = hash(token) | A lookup by token is a primary-key read. Listing a member's sessions is a refreshed query. |
| `jwks` | `auth_jwks (id)` | Tiny; read with a refresh |
| `oauthClient` (`clientId` unique) | `auth_oauth_client (client_id)` | Registration races hit the key. A CIMD client's `client_id` is its metadata URL. |
| `oauthResource` (`identifier` unique) | `auth_oauth_resource (identifier)` | One row: `https://goodwatch.app/mcp` |
| `oauthClientResource` (pair unique) | `auth_oauth_client_resource (id)` with id = hash(`clientId`, `resourceId`) | A duplicate maps to `23505`, which Better Auth already treats as "already linked" |
| `oauthAccessToken` (`token` unique) | `auth_oauth_access_token (id)` with id = hash(token) | Primary-key read by token |
| `oauthRefreshToken` (`token` unique) | `auth_oauth_refresh_token (id)` with id = hash(token) | Primary-key read by token. Rotation and revocation are `incrementOne` CAS operations. |
| `oauthConsent` | `auth_oauth_consent (id)` with id = hash(`clientId`, `userId`, `referenceId`) | One consent per member, client and reference. Saving is `ON CONFLICT DO UPDATE`. |
| `oauthClientAssertion` | `auth_oauth_client_assertion (id)` | Already a primary-key insert in Better Auth (the id is a digest of `jti`); safe as is |

Table settings:

- `number_of_replicas = '2'`: a copy on each of the three nodes. Not the `0-1` the other tables use, which drops to no replicas when only one node is up.
- `"write.wait_for_active_shards" = 1`, so sign-in keeps working through a node restart.
- `translog.durability = 'REQUEST'`.

The hourly snapshots already in place cover the tables.

## The adapter

Better Auth's `createAdapterFactory` takes `create`, `update`, `updateMany`, `findOne`, `findMany`, `delete`, `deleteMany` and `count`, plus the optional `consumeOne` and `incrementOne`. Leave `transaction` off; Better Auth then runs the steps in order with no rollback. Leave joins off too; the factory then issues the separate queries itself. The adapter goes through `crate.ts`, which exposes rowcount and CrateDB's error codes.

**Make it strict, not general.** Better Auth's where clauses support `eq`, `in`, `contains`, `OR` and more. A general translation to SQL would run silently on refresh-lagged data. Instead, the adapter keeps a **table of the access patterns** this plugin set uses, each mapped to a safe plan, and anything not in the table throws. A Better Auth upgrade that adds a new query shape then fails a test instead of introducing a race in production. The patterns:

| Pattern | Plan |
| --- | --- |
| Equality on the table's lookup key (id, email, token, (`providerId`, `accountId`), `clientId`, …) | Hash the value if needed, then a primary-key read |
| `create` | `INSERT` with the deterministic id. 4091 becomes `23505 duplicate key`. Better Auth only honours a passed id with `forceAllowId`; the adapter sets the id itself and returns the stored row, which the factory accepts. |
| `consumeOne(where)` | Primary-key read including `_seq_no` and `_primary_term`; check every predicate in code; `DELETE … WHERE pk AND _seq_no AND _primary_term`; rowcount 1 means consumed. On 0, read again: still there means retry, gone means another caller consumed it. |
| `incrementOne(where, set)` (refresh rotation and revocation, `revoked IS NULL`) | The same read-check-CAS, with `UPDATE … RETURNING` |
| `update` / `delete` by key | CAS with a short retry, as in the tracking writer |
| Lists by `userId` (accounts, sessions, consents, Connected apps, refresh-family revocation) | `REFRESH TABLE` on that one-shard table, then query. These are rare, member-initiated reads, so the refresh cost is acceptable. |
| Cleanup (`expiresAt < now`) | A plain query on the last refresh. Every read path still checks expiry itself. |

### Steps that were meant to be one transaction

| Flow | Order | If it stops halfway |
| --- | --- | --- |
| Sign-up with email | Email claim, then user, then credential account | A claim without a user, or a user without an account, older than 15 minutes is an orphan. A cleanup job removes it after a refresh. A new sign-up for that email reclaims a claim whose user row is missing (primary-key read, then CAS). |
| First Google sign-in | Email claim, then user, then Google account (whose deterministic id makes a retry idempotent) | Same as above |
| Linking Google to an existing user | Account insert | The deterministic id makes a second attempt a duplicate, not a second link |
| Client registration with resource links | Client, then links (both deterministic) | Retrying completes it |
| Refresh-token family revocation on reuse | Mark the reused token, refresh, revoke every token of the family by CAS, run twice | A token minted in the gap can survive one round. The cleanup job sweeps families with a revoked member. Upstream has the same gap. |

All migrated users have an account, so the cleanup rule never touches them. It also only acts on rows younger than a day, as a second guard.

## Security around the tables

- **Separate CrateDB user.** The auth tables are readable only by a dedicated CrateDB user that only the auth code uses, via CrateDB's `GRANT` on tables. The existing webapp user is denied those tables. A bug elsewhere in the app then cannot read password hashes.
- **Encrypted traffic.** `crate.ts` talks to CrateDB over plain HTTP with Basic auth. Before password hashes travel on it, enable TLS on CrateDB's HTTP endpoint or keep the traffic on the private network, with firewall rules carrying owner comments (AGENTS.md).
- **Hashed tokens.** Store tokens only as hashes (the primary keys above are already hashes), and keep signing keys encrypted at rest where the `jwt()` plugin offers it.

## Testing

1. **Conformance.** `@better-auth/test-utils` 1.7.7 publishes `testAdapter` with suites for normal operations, auth flows, case-insensitive matching, UUID ids and transactions. The suites read straight after writing, so run them against a real CrateDB (a container in CI) with the adapter's test mode refreshing after every write. Add a mode that does *not* refresh, to prove every flow uses primary-key reads.
2. **Races.** The suites contain no concurrency tests, so write them, each as `Promise.all` against a three-node CrateDB in CI:
   - Double redemption of one auth code.
   - Double rotation of one refresh token, and rotation racing revocation.
   - Two sign-ups with the same email in different letter case.
   - Two Google links of the same account.
   - Two registrations of one client.

   Each asserts exactly one winner.
3. **Strictness.** A test lists every adapter call made during the flow tests and fails on any pattern not in the table.
4. **Faults.** Stop a CrateDB node during the race tests, and fill Valkey to its memory limit. The expected result is refused requests and signed-out members, never two winners.

## What this changes in the other notes

- [Self-hosted auth](self-hosted-auth.md): the auth tables live in CrateDB, Valkey holds single-use values, and the migration writes through this adapter instead of Better Auth's Postgres-only script.
- **Migration.** A small importer reads `auth.users` and `auth.identities` from Supabase. It writes the email claim, the user (same UUID) and the accounts (deterministic ids) in that order with `ON CONFLICT DO NOTHING`, so it can be re-run safely.
- **Order of work.** Upgrading CrateDB and securing its traffic come before anything else.

## Open decisions

- Session durability: both Valkey and CrateDB (recommended), or Valkey only and accept sign-outs when a Valkey node is lost.
- Whether DPoP is needed at launch (it would bring the verification table into CrateDB).
- TLS on CrateDB's HTTP endpoint versus a private network only.
- How strict the orphan cleanup window is (15 minutes proposed).

## Sources

- Better Auth `v1.7.7`:
  - Adapter contract: `packages/core/src/db/adapter/index.ts`, `factory.ts`, `atomic-fallback.ts`
  - Schema: `get-tables.ts`, `packages/oauth-provider/src/schema.ts`
  - Atomic flows: `packages/oauth-provider/src/token.ts` (rotation, family invalidation and its TODO), `internal-adapter.ts` (`consumeVerificationValue`, `reserveVerificationValue`, the account lookup that rejects duplicates), `sign-up.ts`, `oauth2/link-account.ts`, `with-hooks.ts`
  - Tests: `packages/test-utils/src/adapter/*`
  - Upgrade notes: `docs/guides/1-7-upgrade-guide.mdx`
  - Security post: `docs/content/blogs/security-update-june-2026.mdx`
  - Community adapter list: `docs/lib/community-adapters-data.ts`
- CrateDB 5.10:
  - Docs: [optimistic concurrency control](https://cratedb.com/docs/crate/reference/en/5.10/general/occ.html), [storage and consistency](https://cratedb.com/docs/crate/reference/en/5.10/concepts/storage-consistency.html), [REFRESH](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/refresh.html), [resiliency](https://cratedb.com/docs/crate/reference/en/5.10/appendices/resiliency.html), `interfaces/http.rst` (error codes), release notes 5.10.10–5.10.12
  - Source: `UpdatePlanner.java`, `OptimizeCollectWhereClauseAccess.java`, `ProjectionToProjectorVisitor.java`, `TransportShardUpsertAction.java`
- GoodWatch: `goodwatch-webapp/app/utils/crate.ts`, `app/server/tracking.server.ts`, `docs/adr/0008-one-row-per-watch.md`, `docs/adr/0009-tracking-is-a-state-machine.md`, `docs/implementation/tracking/data-model.md`, `docs/private-redis.md`

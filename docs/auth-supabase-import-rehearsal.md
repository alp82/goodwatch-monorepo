# Supabase auth import: copy rehearsal for #551

This branch builds on [PR #564](https://github.com/alp82/goodwatch-monorepo/pull/564).
It delivers importer code and a fake-data rehearsal. No real Supabase, member data,
production database, Google account, deployment or cutover was accessed. Issue #551's
real-copy rehearsal and real-account sign-in acceptance remain for a later authorized
run. Keep #551 open until that evidence exists. Map: #529.

## Mapping and contract

- `auth.users.id` becomes Better Auth `user.id` verbatim; account `userId` is that
  same UUID. Member rows keep their existing `user_id`. Account row IDs follow
  #564's deterministic digest of `(providerId, accountId)`; they are not Supabase
  identity-row UUIDs.
- Email is trimmed and lowercased using the adapter's rule. Two source UUIDs with
  the same normalized email reject the entire import, including a confirmed versus
  unconfirmed pair. No merge, email-based linking or verification promotion occurs.
- `emailVerified` is exactly whether `email_confirmed_at` is non-null. Neither
  `confirmed_at`, identity `email_verified`, nor editable metadata can verify it.
- An email identity creates `providerId: credential`, `accountId: user.id`, with
  `encrypted_password` copied byte for byte. Empty hashes become null, preserving
  passwordless email accounts without inventing passwords. Google-only accounts
  receive no credential account.
- A Google identity creates `providerId: google`, `accountId: identity_data.sub`.
  Missing `sub` rejects; neither an email nor the identity row UUID is a fallback.
  Existing Supabase identity links are preserved by their `user_id` only. Provider
  access/refresh/ID tokens and Supabase sessions are not imported.
- Names/images use display metadata, with email-local-part/null fallbacks. Dates
  are validated and converted to Better Auth Date values; absent identity dates
  fall back to user dates.
- Unsupported providers, non-bcrypt hashes, missing identities/emails, orphan or
  duplicate identities, invalid dates, deleted/banned/anonymous/SSO/admin users
  reject before any auth writes. A non-null historical ban also requires review.
  Nothing is silently dropped or granted administrative permissions.

The CLI uses a dedicated Postgres client for each run; library callers must do the
same. The source is a bounded, repeatable-read, read-only snapshot. The importer
preflights **every row and target conflict before writes**, with limits of 100,000
users and 300,000 identities. Exceeding the bound is a rejection, not a partial
import. Target counts refresh indexes and scan encrypted users/accounts in keyset
pages of 500. They authenticate each v2 envelope with its table/key/purpose and
check its signed deletion state, rather than trusting the plaintext index hint.
They do not inherit Better Auth's 100-row enumeration default.

Writes go through #564's strict adapter and encrypted payload/receipt storage. The
import is insert-only: an existing row must match all mapped fields or the run
rejects; an old source never resets a changed password or transfers an identity.
Exact reruns do no writes. A partial run can resume missing accounts/users. Email
claim recovery and release belong to the adapter's lifecycle implementation;
the importer never deletes or transfers a claim to make a row fit.
Claim keys use the adapter's HMAC format. An unknown user-insert outcome can still
leave a claim without a visible user; `target_orphan_email_claim` rejects the next
run before writes. Keep the claim for adapter recovery or restore the isolated
target backup after establishing that no write is still in flight. The importer
does not guess that an unknown write failed or steal its reservation.

CrateDB has no multi-row transaction here. On an operational failure, the JSON
report says `failed` and includes actual after-counts where available. A failure
never says it rolled back. If `after_counts_unavailable` appears, recover the copy's
database/key and rerun dry mode before trusting counts. An advisory lock excludes
another importer on the same Postgres copy; **all target writers must also remain
stopped**. Different source copies sharing a target are not coordinated by this lock.

## Repeat the fake-data test

Requirements: Node 24+, npm, Docker Compose on a local Unix socket, free loopback
ports 15648 and 15651, `vm.max_map_count >= 262144`, and about 1.3 GiB container RAM.
Use the existing host bootstrap setting; the fake harness needs no production
secrets. Do not run any real-copy procedure tonight.

```bash
cd goodwatch-webapp
npm ci --ignore-scripts
npm run test:auth-importer
```

The runner refuses an existing project, creates pinned Postgres 16.10 and CrateDB
5.10.12 containers, and deletes only its own containers/volumes/network on exit.
It leaves other auth projects/ports alone. Its one-node CrateDB has unassigned
replicas; #564 separately tests the adapter's three-node fault behavior. No host
firewall changes are made. CI uses a separate secret-free disposable runner.

Evidence is in ignored `goodwatch-webapp/scripts/auth-importer/results/`: focused
types, integration/CLI tests, container logs, and timed dry/import/rerun JSON.
Only fake-data summaries belong in the repository or a public issue.

## Recorded fake rehearsal — October 14, 2026

- Node **24.22.0**, Postgres **16.10**, CrateDB **5.10.12**, adapter hardening from
  #564 at `e7033d40`: **26 tests passed**, zero failures/skips. Focused types,
  Biome and shell syntax passed. The hardened mapping case also passed on Node
  **26.8.1**.
- Empty target became **6 users, 7 accounts, 6 email claims**: 5 credential and
  2 Google accounts; 5 verified and 1 unverified user. Exact rerun created **0**
  users/accounts and left counts unchanged.
- Authenticated CLI timings: dry-run **652 ms**, import **606 ms**, rerun
  **377 ms**. The 507-user/508-account pagination and rerun test took **109.6 s**
  in total on the shared laptop. These fake fixtures do not estimate production
  duration; measure the authorized real copy separately.
- Password and locally signed Google ID-token sign-ins preserved UUIDs. An
  existing fake Wishlist row remained reachable through the signed-in UUID.
  Unconfirmed sign-in/implicit linking, wrong database credentials, malformed
  source rows and ownership conflicts were refused. Tombstone count audits used
  authenticated state even after plaintext deletion hints were changed.
- The final harness authenticated its CLI as the fake copy role and removed its
  own containers, volumes and network. No real Supabase or production was accessed.

## Later rehearsal using restored copies

These steps are a runbook, not authorization to read production. The owner must
authorize access to backups and a real-data copy, and separately authorize cutover.
Use already approved encrypted backups supplied to the operator; do not run a dump
from production as part of this code thread. Record backup provenance and snapshot
time privately. Auth and member-data copies must come from a consistent point;
ongoing Supabase signups/identity/password changes require a final frozen snapshot
or an explicitly designed delta procedure, not repeated stale imports.

1. **Create isolated copies.** Restore the Supabase auth backup into a local
   Postgres database named `auth_copy` bound to `127.0.0.1:15651`. Restore the member
   CrateDB data into a separate local CrateDB 5.10.12 cluster bound to
   `127.0.0.1:15648`, named `goodwatch-local-importer-551` with node `importer-551`.
   Check the actual restored database and cluster identity before adding markers.
   Use local restores, never SSH tunnels or port forwards to a live database.
   Do not run `prepare-fake.ts`, `fixtures.ts`, `run.sh`, or integration tests on
   restored real copies: those deliberately reset fake data.
2. **Prepare target storage.** With all auth/member writers stopped, explicitly
   call `migrateAuthTables` from #564 on the isolated target. If Better Auth data
   uses an incompatible prerelease schema or v1 payloads, stop: the adapter
   requires an approved offline conversion or a fresh copy without those
   experimental auth tables. Do not bypass its schema/envelope checks. If data
   already exists, retain its original encryption key; never replace it to make
   a mismatch disappear. Back up the local target and the payload key before
   writes. Check all source/member UUIDs that the sample will use, and record the
   sample member's existing Wishlist/ratings/settings privately.
3. **Mark only the restored source.** As the local copy administrator, execute:

   ```sql
   CREATE TABLE public.goodwatch_auth_import_copy (
     id integer PRIMARY KEY, kind text NOT NULL
   );
   INSERT INTO public.goodwatch_auth_import_copy VALUES (551, 'restored-copy');
   GRANT USAGE ON SCHEMA auth, public TO auth_copy_reader;
   GRANT SELECT ON auth.users, auth.identities,
     public.goodwatch_auth_import_copy TO auth_copy_reader;
   ```

   Create `auth_copy_reader` with only local copy access beforehand. It needs
   SELECT and the default permission to use PostgreSQL advisory locks, no source
   writes. Markers reduce accidental use; an operator must still verify provenance.
4. **Configure explicit copy endpoints.** In a private shell, set
   `AUTH_IMPORT_COPY_ONLY=yes`,
   `AUTH_IMPORT_SOURCE_URL=postgresql://auth_copy_reader:<encoded-copy-password>@127.0.0.1:15651/auth_copy`,
   `AUTH_IMPORT_CRATE_ORIGIN=http://127.0.0.1:15648`, and
   `AUTH_IMPORT_PAYLOAD_SECRET=<backed-up-target-secret-at-least-32-characters>`.
   For an authenticated CrateDB copy, also set `AUTH_IMPORT_CRATE_USERNAME` and
   `AUTH_IMPORT_CRATE_PASSWORD` as a complete pair for the copy's dedicated auth
   role. It needs `DQL`/`DML` on the auth tables and `DQL` on `sys.cluster` and
   `sys.nodes` for the CLI's copy-identity checks; table creation remains an
   administrator step. These are passed through the adapter's header-based credential support;
   never put credentials in the origin URL or reuse application environment names.
   Supply secrets through the operator's approved secret mechanism; do not commit
   them, put them in issue comments, or print them. The CLI loads no `.env` and
   rejects remote hosts, extra URL query options, wrong ports/database/node/version,
   missing markers and unknown flags before importing. It never creates tables.
5. **Dry-run first.** From `goodwatch-webapp`, with `umask 077`, execute
   `node scripts/auth-importer/import.ts > /private/evidence/dry-run.json`.
   Require exit 0, `status: planned`, zero issues, unchanged target counts, and
   independently matching SQL source totals. Classify collisions/unsupported rows
   privately by UUID. Stop and resolve them on a fresh copy using an approved
   decision; do not lowercase two UUIDs into one or promote unverified emails.
6. **Import and time it.** Execute
   `node scripts/auth-importer/import.ts --apply > /private/evidence/import.json`.
   Require exit 0 and `status: complete`. Record `elapsedMs`, wall time, versions,
   snapshot time and dataset size. For an initially empty auth target, require
   `after.users == source.users`,
   `after.accounts == source.credential + source.google`,
   `after.credential == source.credential`, `after.google == source.google`, and
   `after.emailClaims == source.users`. Identity totals must equal the two provider
   totals for this supported source. With an existing target, reconcile the
   before counts plus created/unchanged fields instead of expecting empty totals.
7. **Rerun before sign-ins.** Repeat dry/apply against the same snapshot. Require
   zero newly created users/accounts and identical before/after counts. A failed
   partial run resumes only after restoring the same target/key and stopping
   writers. After sign-ins refresh tokens or profiles, stale reruns can correctly
   reject mismatched rows; never overwrite those differences automatically.
8. **Start an isolated auth service on the copy.** Use #564's strict adapter and
   the same payload key. Set `verification.storeIdentifier: 'hashed'` and
   `advanced.database.defaultFindManyLimit: 10000` for complete bounded hook reads;
   require email verification and disable implicit account
   linking, including `requireLocalEmailVerified: true`. Configure existing-password
   verification for imported bcrypt and new Better Auth scrypt:

   ```ts
   import { compare } from 'bcryptjs'
   import { verifyPassword } from 'better-auth/crypto'

   password: {
     verify: async ({ hash, password }) => /^\$2[aby]\$/.test(hash)
       ? compare(password, hash)
       : verifyPassword({ hash, password }),
   }
   ```

   Better Auth's default hash function stays in place for new/reset passwords.
   Wiring this configuration into the member-facing service is a separate ticket.
   Keep mail captured locally and member/catalog/service connections pointed only
   to copies. A separately authorized Google rehearsal needs a test OAuth client
   and approved callback, plus consent from the sampled account holders; do not
   reuse production credentials/callbacks. Fake ID-token tests do not prove that
   redirect/client setup. Do not mark an unconfirmed real account verified merely
   to make a sample pass.
9. **Check the acceptance sample.** Record original UUID versus signed-in UUID for
   an existing password member, Google-only member and member with both methods.
   Check both methods for the latter. An unconfirmed member's password sign-in must
   be refused until a real verification flow completes; a new Google subject with
   that email must not silently link. From a signed session, load the sample
   member's pre-existing Wishlist/ratings/settings and compare with the copy's
   before record. Verify no member rows changed ownership. Measure each step.
10. **Report and reset copies.** Post counts, timings, tested account classes and
    pass/fail outcomes on #551 without identifiers, emails, hashes or tokens. Keep
    sensitive evidence privately. On a discrepancy, leave production unchanged,
    stop the rehearsal and restore the isolated target backup. Delete copies only
    under the operator's data-retention policy.

The future production run still needs the owner's cutover approval, source write
freeze, final consistent backup/copy, complete sample evidence, tested rollback,
encryption-key custody and resolution of #564's launch limitations. Supabase's
30-day read-only retention and the chosen session policy belong to map #529's
cutover plan. This importer has no production-mode flag.

## Sources

- [Supabase users/schema fields](https://supabase.com/docs/guides/auth/users): user
  UUIDs, confirmation timestamps, metadata and multiple identities.
- [Supabase identities/schema fields](https://supabase.com/docs/guides/auth/identities):
  identity IDs, provider IDs, user ownership and identity data.
- [Supabase user management/export](https://supabase.com/docs/guides/auth/managing-user-data):
  querying `auth.users` and `auth.identities` directly.
- [Better Auth Supabase migration guide](https://better-auth.com/docs/guides/supabase-migration-guide):
  credential/Google mappings and bcrypt compatibility. The generic guide's random
  account IDs and SQL inserts are adapted here to #564's deterministic/encrypted
  storage, full conflict preflight and resumable insert-only writes.
- Better Auth **1.7.7** installed source: `dist/api/routes/sign-in.mjs` and
  `dist/oauth2/link-account.mjs`. Google token updates repeat the unchanged
  `providerId`; the adapter permits that repeat and still rejects key changes.
- [CrateDB host-based authentication](https://cratedb.com/docs/crate/reference/en/5.10/admin/auth/hba.html):
  the fake harness trusts its loopback-bound administrator connection and requires
  password authentication for its dedicated copy role.
- [CrateDB privileges](https://cratedb.com/docs/crate/reference/en/5.10/admin/privileges.html):
  grant metadata reads on the two system tables used by the CLI's identity guard.

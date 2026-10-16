# Production cut-over checklist: Supabase Auth to Better Auth, and the MCP launch

Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), with the MCP launch [#572](https://github.com/alp82/goodwatch-monorepo/issues/572). Map: [#529](https://github.com/alp82/goodwatch-monorepo/issues/529). State of the sources: 2026-10-16; refreshed against main, the latest #547/#551/#552/#562/#563 comments and read-only private SSH checks. Better Auth remains off on production. This update authorizes no production operation.

Rules that come from the owner and bind every step:

- Better Auth and the MCP go live for every member at once. There is no preview phase. ([#536](https://github.com/alp82/goodwatch-monorepo/issues/536))
- Every production step waits for the owner's go. ([#529](https://github.com/alp82/goodwatch-monorepo/issues/529) notes)
- This agent can perform read-only checks by direct SSH to `root@10.0.0.x`. Never print secrets. Only the owner changes Coolify through its UI; no Coolify database/API writes.
- The owner chooses the cut-over window; preparation is not permission to start it (Q36, latest #552 comment).

Who: **Owner** decides, holds secrets and changes deployment settings; **Agent** prepares repository work and, only in an explicitly approved window, executes the reviewed private-network steps.

## Blocking prerequisites

Only unfinished gates are listed here. Each production action still needs the owner's chosen window.

- [ ] **Owner + Agent — Storage/grants (1.4).** Create the 15 approved auth tables including `doc.auth_capacity`, settings and table-scoped grants/DENYs, plus `user_mcp_action`. The prepared `goodwatch_auth` identity exists with zero grants; reuse its existing protected secret.
- [ ] **Owner — Secrets and recovery (1.5).** Put the permanent root, versioned key ring, Better Auth/Google/SMTP secrets and runtime configuration on both destinations through Coolify's UI. Back them up in the password manager before import (Q31); the importer uses the same root/key ring.
- [ ] **Owner — External setup and real acceptance (1.6, 2.7, 3.3).** Add Google's production callback, verify Purelymail, supply approved test accounts, and complete real password/Google/mail/member-data and MCP-client acceptance. #551's data rehearsal passed; real password/Google redirect sign-ins remain unproven.
- [ ] **Owner decides; Agent validates — Freeze, retention and rollback (2.2, 2.6).** Approve the recommendations below; rehearse the exact database fence and reversal on an isolated source copy and verify the hosted project's permissions before scheduling cut-over. A signup toggle or a stable user count alone is insufficient.
- [ ] **Owner + Agent — Maintenance observability.** Use the in-process worker; no additional cron is recommended. At launch initialize auth on every serving process and verify successful passes/alerts. See the maintenance recommendation below; there is no missing repository scheduler.
- [ ] **Owner — Cut-over go, backups, deployment and follow-up.** Choose the window; take final backups/frozen export; run the guarded import/audit; paste proxy files; set the privacy date and flags; complete smoke/rollback gates; create the dated 30-day shutdown follow-up. Agent performs the reviewed CLI/checks only with that go.

Completed prerequisites (not blockers):

- **#547 closed:** all three nodes run 5.10.16; `goodwatch_auth` exists, non-superuser, zero grants. Prepared secret is crate-01 `/root/.config/goodwatch/crate-credentials/goodwatch_auth`, root0600 under root0700. [Completion evidence](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/implementation/auth/cratedb-production/20261016-auth-preparation/README.md), PR #670 / `ec05a2f7`.
- **#562 closed:** HBA enforced on every coordinator; client migration and backup failover proved. [Rollout evidence](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/implementation/auth/cratedb-production-rollout.md), PR #599 / `5e3ac3a5`.
- **#563 closed:** isolated three-node snapshot + BLOB restore proved; 14m38.8s SQL restore, 22m54.4s through final copy recovery. [Report](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/implementation/auth/cratedb-restore-rehearsal-20261015.md).
- **#551 data rehearsal passed:** 718 users / 721 accounts / 718 claims; exact rerun created zero; hashes, Google subjects, original UUIDs and 300,082 member rows audited. Export/dry/apply/rerun wall time 6m43.1s, not a full cut-over estimate. Real sign-in acceptance remains above.
- **#591 landed** as `49c2db79`; Better Auth remains off. The prior current-main/tracking-writer integration gate is superseded by the landed stack.
- **Repo cookie and production-route gaps closed:** the follow-up PR linked in 1.8 adds proxy support and the guarded `production` importer. No proxy file is installed on merge, and nothing runs the importer automatically.
- PR #589 failover is already deployed; #588 is closed. The 16 privacy decisions in #571 are settled. Firewall hardening #669 is separate: the owner accepted private binding plus HBA for #547.

## Phase 1: prepare production (no member impact)

Do these in this order, on days before the cut-over.

- [x] **1.1 Upgrade crate-01 to 5.10.16 — done (#547 closed).**
  - Who: Owner + Agent. All three coordinators independently confirmed all nodes on 5.10.16; repeated read-only SSH on 2026-10-16 confirmed the topology. Do not repeat the upgrade.

- [x] **1.2 Prove a snapshot restore — done (#563 closed).**
  - Who: Agent. SQL tables, member rows and all referenced BLOB files restored to an isolated three-node copy; timings and cleanup are in the [restore report](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/implementation/auth/cratedb-restore-rehearsal-20261015.md).

- [x] **1.3 Enforce CrateDB passwords — done (#562 closed).**
  - Who: Owner + Agent. All coordinators enforce correct/missing/wrong-password checks; clients and credentialed backup/failover passed. No enforcement action remains.

- [ ] **1.4 Verify the prepared `goodwatch_auth` user, then create auth tables and grants.**
  - Who: Owner and Agent. Tickets: [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), [#562](https://github.com/alp82/goodwatch-monorepo/issues/562), [#572 comment](https://github.com/alp82/goodwatch-monorepo/issues/572#issuecomment-6179158883).
  - Do, in this order: require the #547 preparation receipt: `goodwatch_auth` exists with zero grants and authenticates on all three coordinators. The #547 preparation created this identity on 2026-10-16 with zero grants; auth tables remain absent until this step. Reuse its server-generated secret at `/root/.config/goodwatch/crate-credentials/goodwatch_auth` on crate-01 (root-owned 0600, parent 0700); do not regenerate it. Run the auth table migration from PR #564 with an admin identity. It covers 13 model tables, email claims and `doc.auth_capacity`. Create `user_mcp_action` from `docs/implementation/mcp-write-tools-schema.sql` (PR #584). It isn't declared in `crate_schemas.py`, so the daily `f/sync/populate_crate` flow never creates it. Set `number_of_replicas = '2'`, `write.wait_for_active_shards = 1` and `translog.durability = 'REQUEST'` on each auth table. Grant `DQL, DML ON TABLE doc.<approved_auth_table> TO goodwatch_auth` for each of the 15 approved `auth_*` tables explicitly; never grant on the schema/cluster, catalog tables or `user_mcp_action`. For importer topology verification, also grant `DQL ON TABLE sys.cluster, sys.nodes TO goodwatch_auth`; this adds system metadata reads only. Before inserting auth data, apply the table-specific DENY rules for other client roles required by the #562 production runbook.
  - Secret handoff: the owner copies that protected file into Coolify **UI only** as secret runtime `AUTH_CRATEDB_PASSWORD`, with `AUTH_CRATEDB_USERNAME=goodwatch_auth` and the approved private `AUTH_CRATEDB_ORIGINS`, for both deployment destinations. Never print the value or write to Coolify’s database/API. Keep the encrypted recovery copy from 1.5.
  - Verify: as admin, every approved auth table has the exact settings and all three copies STARTED. Correct password gives `current_user = goodwatch_auth`. Catalog reads, DDL and privilege changes fail for that user.
  - Roll back: `REVOKE DQL, DML ON TABLE <approved list> FROM goodwatch_auth`, then `DROP USER goodwatch_auth` only if this run created it. Do not drop the auth tables. (runbook "Dedicated runtime user", "Rollback and abort")

- [ ] **1.5 Store the secrets and back them up.**
  - Who: Owner. Tickets: [#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6180556817), [#565](https://github.com/alp82/goodwatch-monorepo/issues/565).
  - Do: put these in the deployment's secret store: `BETTER_AUTH_SECRET`, `AUTH_CRATEDB_ENCRYPTION_SECRET`, `AUTH_CRATEDB_ENCRYPTION_KEYS`, `AUTH_CRATEDB_USERNAME`/`PASSWORD`, `AUTH_GOOGLE_CLIENT_ID`/`SECRET`, `AUTH_SMTP_USER`/`PASSWORD`. Also set `BETTER_AUTH_URL`, `MCP_RESOURCE_URL` and `AUTH_TRUSTED_IP_HEADER` (a single-IP header that ingress overwrites). Keep an access-controlled encrypted recovery copy, including keys needed by retained snapshots.
  - Verify: the owner can retrieve the full matching secret set from the password-manager recovery copy without publishing it. Retain the matching keys for every retained target snapshot; the earlier copy rehearsal used disposable keys and does not prove production secret recovery.
  - Roll back: not applicable. Never regenerate the permanent root during a deploy. That is data loss.

- [ ] **1.6 Add the Google redirect and check Purelymail.**
  - Who: Owner. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: add `/api/auth/callback/google` (on the production origin) to the Google OAuth client. Confirm the Purelymail account can send as `hello@goodwatch.app`. Purelymail allows about 3,000 auth mails a day. Its connection limit is unpublished. ([#532](https://github.com/alp82/goodwatch-monorepo/issues/532))
  - Verify: do a real Google sign-in and a real mail on the production origin in step 2.7. Local tests used fixtures only.
  - Roll back: remove the redirect entry. Nothing else depends on it while the flag is off.

- [x] **1.7 Rehearse the data migration on a copy — passed, sign-in acceptance remains.**
  - Who: Agent. Latest #551 comment records dry 87.373s, apply 196.581s, exact rerun 114.084s; 718 users / 721 accounts and unchanged member ownership/counts. Both importer and integration adapters independently audited every mapping/hash. Copies and secrets were deleted.
  - Remaining Owner + Agent gate: real password, Google redirect, linked/unconfirmed and mail acceptance in 2.7; copy mapping and fake-data sign-ins do not prove those journeys. Keep #551 open until acceptance is satisfied.

- [x] **1.8 Complete cookie matching and the production importer route — repository work done.**
  - Who: Agent. Follow-up PR: [#675](https://github.com/alp82/goodwatch-monorepo/pull/675) (merge: `1c7034cdc1ffe13a0e598252bce1d91967f1bde7`). Traefik's member rule now accepts Supabase base/chunked cookies, `gw.session_token` and `__Secure-gw.session_token`. Both proxy scripts and cache/deploy docs are updated. Webapp `auth-cookie.ts`, cache identity/page-cache and metrics already shared the dual matcher; regressions now cover both Better Auth forms and lookalikes.
  - Verified: **38/38 balance checks; 71/71 search checks**, including the original 65 search checks. Anonymous responses set no sticky cookie; each auth name gets one on page routes, none on search. Importer **44/44** fake-store/CLI/receipt tests, focused types and Biome pass; all six final-head GitHub checks passed (adapter, importer, maintenance, MCP, wiring, webapp). Full webapp unit result: **3,099 passed, zero failed, one existing skip and one TODO** with repository dependency patches and concurrency=4; hosted webapp CI also passed.
  - Production importer: frozen local SELECT-only source → loopback SSH tunnel → dedicated `goodwatch_auth`; explicit `--allow-production`, recent frozen marker, shared durable root/key ring and signed dry/apply/rerun receipts. Exact commands are in 2.3 and the [#551 runbook on main](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/auth-supabase-import-rehearsal.md#production-route-for-552-step-23).
  - Nothing live changes on merge: Coolify installs proxy content only when the owner pastes it in 2.4. The importer is not scheduled or called by runtime. Roll back repository changes by reverting the follow-up PR; do not touch production.

- [x] **1.9 Land the stack with Better Auth off — done.**
  - Who: Owner + Agent. #591 merged as **`49c2db79`**; current main includes the auth stack and tracking repairs. Production remains on Supabase with Better Auth off. Do not re-merge individual auth PRs or the old integration branch. #597 remains a separate account-deletion follow-up.
  - This is not real Better Auth sign-in/MCP acceptance; 2.7 and 3.3 remain mandatory. Keep `/mcp` routing installation at 3.1; repository search configs already include it and are owner-pasted only.

## Phase 2: cut-over day

Needs the owner's go. Write down the start time and the operator. All steps are Owner and Agent unless noted.

- [ ] **2.1 Final backups and a named snapshot.**
  - Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: create a named CrateDB snapshot (`pre_auth_552_<timestamp>`, serialized with `/var/lock/backup_crate.lock` on crate-01). Take the approved encrypted Supabase backup. Save the current Traefik `goodwatch-balance.yaml` and the current `.env` for rollback.
  - Verify: snapshot state is `SUCCESS`. The Supabase backup restores. The saved files are readable.
  - Roll back: not applicable. These are the rollback material.

- [ ] **2.2 Freeze Supabase writes.**
  - Ticket: [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: Owner approves the database-fence recommendation below; Agent executes only in the chosen window. Announce a short auth-maintenance interval, disable signups/manual linking and Google entry, stop auth/member writers, install the rehearsed write fence, then take the final repeatable-read, read-only export. Keep the fence through 2.6. Anonymous browsing can continue; do not promise that existing sessions or refresh/sign-in will continue.
  - Verify: rejected direct Auth API signup, password/email update and Google link/callback attempts from approved test accounts; all managed auth-table DML/TRUNCATE probes reject, SELECT works. Compare privately keyed full-row digests plus users/identities counts before/after the final export. A stable count does not detect changed hashes, verification or identities.
  - Roll back: remove only the named cut-over fence triggers/function and restore the saved provider/signup settings, using the rehearsed reversal; verify writes with a test account before returning to Supabase.

- [ ] **2.3 Run the real import.**
  - Ticket: [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: follow the guarded production route and exact commands below. Use the final frozen local source, the existing dedicated target credentials and the same backed-up root/key ring as runtime. All auth/member writers and maintenance stay stopped. The profile requires dry run, then apply, then exact rerun; it never creates tables or starts services.
  - Verify: counts match the source (users, credential and Google accounts, email claims). The rerun creates zero rows. `npm run auth:maintenance -- audit` exits 0. Keep the report without identifiers on #551.
  - Roll back: on any discrepancy, stop and leave production unchanged. Restore the target from the 2.1 snapshot. Do not overwrite rows by hand. An orphan email claim after an unknown outcome is recovered through the adapter, not deleted by hand.

- [ ] **2.4 Install the cookie-aware Traefik rule.**
  - Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: follow "Owner steps" in `docs/webapp-deploys.md`: Coolify, Servers, abio, Proxy, Dynamic Configurations. Paste the file from 1.8.
  - Verify: `grep HeadersRegexp` on abio shows both cookie names. `curl -sI` without a cookie prints no `gw_instance`. With each auth cookie it prints one. Run `./bench.sh smoke` in `goodwatch-benchmark`.
  - Roll back: put the saved content back and save. If the site answers 404 or 503 and the old content is missing, delete the file so Coolify's own routers serve the site from abio alone.

- [ ] **2.5 Set the privacy date and turn the flags on.**
  - Ticket: [#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6183777144).
  - Do: set "Last updated" in `goodwatch-webapp/app/routes/privacy.tsx` to today and deploy. Set `BETTER_AUTH_ENABLED=true` with all the 1.5 secrets present, and `REC_CONNECTOR=on`. Flags are read at start, so restart or redeploy. Leave the `REC_MCP_*` flags unset (unset means on for everyone). The "please sign in again" banner shows for browsers that still hold the old cookie; the account-pages drive script checks this with a fake `sb-` cookie.
  - Verify: `/api/auth/*` answers. A browser with an old `sb-` cookie sees the banner once. `/privacy` shows the new date and sections. `/connect` answers 200.
  - Roll back: set `BETTER_AUTH_ENABLED=false` and redeploy. See "Rollback after members have signed in" below.

- [ ] **2.6 Make Supabase read-only.**
  - Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#536](https://github.com/alp82/goodwatch-monorepo/issues/536).
  - Do: retain the approved/rehearsed database write fence on all existing managed Auth tables for 30 days, keep legacy entry points disabled and allow only the protected read/export path. See the recommendation below, including managed-schema limitations and the Free-plan inactivity caveat. Create the dated follow-up in 4.2 now.
  - Verify: Auth writes, including existing-token password/email changes and refresh/session mutations, are refused; protected SQL reads/export work. Monitor daily fence inventory and rollback-data digest; never log those digests or member rows publicly.
  - Roll back: remove only the reviewed named fence and restore saved Auth settings before switching the flag off. First accept the post-cut-over divergence described below; never merge users by email.

- [ ] **2.7 Smoke test as real members.**
  - Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: with test accounts, run: a password sign-in of an imported member; Google sign-in (the real redirect, never tried before); sign-up with the confirmation mail; forgot and reset password; sign out; change password in Settings; a member whose email was never confirmed is refused. A member's existing Wishlist and ratings show under the same UUID.
  - Verify: each case passes. The mail arrives from `hello@goodwatch.app`. Sessions last 90 days and are renewed at most once a day (`gw.session_token`, cookie cache off).
  - Roll back: if sign-in fails for imported members, set the flag off at once and go to the rollback section.

## Phase 3: launch the MCP (#572)

Do this after Phase 2 is stable. Owner's go again.

- [ ] **3.1 Install the ranked-search routing.**
  - Who: Owner. Ticket: [#572 comment](https://github.com/alp82/goodwatch-monorepo/issues/572#issuecomment-6179707222), [PR #586](https://github.com/alp82/goodwatch-monorepo/pull/586).
  - Do: install the Traefik config that routes exact `/mcp` to the search roles. OAuth and well-known metadata stay on the page instances. Deploy MCP-capable roles and `MCP_RESOURCE_URL` first. Save the old file as in 2.4.
  - Paste timing: from 1.9 on, the repository's `goodwatch-proxy/traefik/goodwatch-search.yaml` (abio) and `goodwatch-search-instance.yaml` (vector1) already route `/mcp`. Coolify applies them only when pasted, so nothing changes on merge. Until this step, if either file has to be pasted again for another reason, remove `` || Path(`/mcp`) `` from its rule first. Otherwise `/mcp` moves to search roles that may run an image without MCP, before the launch.
  - Verify: the 71 search proxy checks (original 65 plus six cookie cases) and 38 balance checks pass locally with the same files. On production, an anonymous `POST /mcp` answers 401 with OAuth discovery, and the metadata URLs answer from page instances.
  - Roll back: restore the saved Traefik file.

- [ ] **3.2 Check `user_mcp_action` and the flags.**
  - Who: Agent. Ticket: [#572 comment](https://github.com/alp82/goodwatch-monorepo/issues/572#issuecomment-6179158883), [PR #584](https://github.com/alp82/goodwatch-monorepo/pull/584).
  - Do: confirm the table from 1.4 exists. Check the `REC_MCP_*` flags are unset or `on`: read tools, write tools and `REC_MCP_RANKED_SEARCH`.
  - Verify: `tools/list` shows 7 read tools, and 7 write tools for write-scoped members.
  - Roll back: set `REC_MCP_READ=off` and `REC_MCP_WRITE=off`. Both are read on every request. (`docs/implementation/mcp-read-tools.md`, `mcp-write-tools.md`)

- [ ] **3.3 Connect real clients on production.**
  - Who: Owner with a real account. Ticket: [#572](https://github.com/alp82/goodwatch-monorepo/issues/572).
  - Do: add GoodWatch as a custom connector in Claude.ai, in Claude Code and in ChatGPT. Go through sign-in, the consent page and Connected apps. Call a read tool and a write tool. Wait for the 5-minute access token to expire and call again (refresh). ChatGPT gives full read and write only on Business, Enterprise and Edu. Hosted Claude.ai and ChatGPT linking has never been run against these pages except one owner test of Claude.ai on the prototype. ([#529](https://github.com/alp82/goodwatch-monorepo/issues/529), [PR #591](https://github.com/alp82/goodwatch-monorepo/pull/591) "Untested")
  - Verify: Connected apps shows each client with "Last used". Disconnect one client: its token answers 401 and the others keep working.
  - Roll back: disconnect the test grants in Connected apps. If the endpoint misbehaves, use the flags in 3.2.

- [ ] **3.4 Announce to members.**
  - Who: Owner. Ticket: [#572](https://github.com/alp82/goodwatch-monorepo/issues/572).
  - Do: point members to `/connect` for the steps.
  - Verify: members connect on production. That is the done condition of #572.
  - Roll back: not applicable.

## Phase 4: watch, then close Supabase

- [ ] **4.1 Watch the first days.**
  - Who: Owner and Agent. Tickets: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#572](https://github.com/alp82/goodwatch-monorepo/issues/572).
  - Watch: sign-in errors; mail sending and the Purelymail limits (about 3,000 a day); the mail queue is in memory, so a crash can lose a mail and members must resend ([#573](https://github.com/alp82/goodwatch-monorepo/pull/573)); `goodwatch_auth_maintenance_total`, `goodwatch_auth_maintenance_last_completed_seconds` and `goodwatch_auth_maintenance_quarantined_total{table}` (a stalled worker is an alert); `goodwatch_mcp_tool_calls_total` and tool duration; rate limits (MCP 60 a minute and 1,000 an hour per member, ranked search 20 a day, DCR 30 an hour per IP); CrateDB 5xx on page routes.
  - Verify: no growing error rate. The last maintenance pass is recent. Quarantined rows stay at zero. Exit code 2 from the CLI means an incomplete result.
  - Roll back: see below.

- [ ] **4.2 Dated follow-up: shut Supabase down 30 days after the cut-over.**
  - Who: Owner. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#536](https://github.com/alp82/goodwatch-monorepo/issues/536).
  - Do: create the dated ticket or reminder on cut-over day: cut-over date plus 30 days. On that day, take a last Supabase backup, then shut Supabase Auth down.
  - Verify: no production path reads Supabase Auth. Members still sign in.
  - Roll back: after shutdown, only the backup remains. Keep it under the data-retention policy.

- [ ] **4.3 Remove the old cookie from the code.**
  - Who: Agent, then Owner for Traefik. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: after 4.2, drop the `sb-<ref>-auth-token` matching from Traefik, `auth-cookie.ts`, cache identity, metric labels and test scripts, and remove the Supabase code path behind the flag.
  - Verify: #552 is done when "members sign in on Better Auth on production and the old cookie is no longer needed".
  - Roll back: revert the commit and restore the saved Traefik file.

## Rollback after members have signed in

This is a proposal. #552 asks for "a written rollback path", and no source spells it out. The owner confirms or changes it.

- Within the 30 days, the flag can go back to `false`. The Supabase code path then serves sign-in again (flag off keeps it, [PR #573](https://github.com/alp82/goodwatch-monorepo/pull/573)). Supabase must first be taken out of read-only mode.
- What is lost: sessions made on Better Auth, accounts created after the cut-over, and password changes made after the import. They exist only in Better Auth. The importer is insert-only and not a sync tool, so there is no way back from the new system to Supabase. Export those rows before the flag goes off if they matter.
- Members' own data stays in CrateDB under the same UUIDs. Nothing moves on cut-over or rollback.
- MCP grants and Connected apps live in the auth tables. Turning the flag off ends them. Turn `REC_MCP_*` off first.
- The `gw.session_token` cookie outlives the flag. `app/utils/auth-cookie.ts` treats that cookie as a signed-in member whether or not Better Auth is on. With the flag back off, every request that still carries it skips the shared page cache, gets `no-store` and asks Supabase for a session, until the cookie expires (sessions last 90 days) or is removed. As part of the rollback, expire `gw.session_token` and `__Secure-gw.session_token` (a `Set-Cookie` with `Max-Age=0`), or accept that uncached load.
- A CrateDB-level rollback is a snapshot restore (1.2, 2.1). It needs a new concrete owner decision and loses writes after the snapshot. (runbook "Rollback and abort")

## Owner recommendations researched on 2026-10-16

These are recommendations awaiting the owner's decision, **not executed changes**.
The issue/repository evidence does not expose the current Supabase billing tier;
no billing access was used and no paid entitlement is assumed. The proposal uses
ordinary PostgreSQL triggers and standard Auth settings, not Team/Enterprise
hooks. Confirm the hosted project's actual SQL privileges before scheduling it.
Supabase documents Before User Created/Custom Access Token hooks for Free/Pro,
but Password Verification Attempt for Team/Enterprise; none is a universal
password-change/identity/session write barrier. [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).

### 2.2 — Short database-enforced freeze, with anonymous browsing available

**Recommendation:** choose a short auth-maintenance window and fence writes at
Postgres, with signup/manual-linking/provider toggles as additional protection.
Use a uniquely named, reversible statement trigger that raises a constant error
on INSERT/UPDATE/DELETE/TRUNCATE on **every existing base/partitioned table in
`auth`**, installed atomically with a bounded lock timeout after taking the
rollback inventory. A statement trigger also refuses zero-row probes. This
covers `auth.users`, `auth.identities`, sessions, refresh tokens and in-flight
Google callbacks; simply hiding buttons does not. Do not log SQL rows or errors
containing member information. Avoid changing Supabase-owned grants/roles.

This is our engineering recommendation, not a documented Supabase "read-only"
feature. Supabase documents triggers on `auth.users` and warns that a failing
trigger blocks signup and managed schema objects can change. Rehearse the exact
inventory, fence and DROP reversal with an isolated source copy before owner
approval, then confirm the hosted SQL role can create those triggers. If a
managed table denies that operation, **stop and obtain a Supabase-supported
freeze**, rather than silently using a partial fence. An approved production
window must include this validation, not discover it after export.
[User management and trigger guidance](https://supabase.com/docs/guides/auth/managing-user-data),
[Supabase troubleshooting: user writes and triggers](https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A).

Once the DDL transaction commits, take the consistent read-only export, restore
it locally and mark that copy with its actual freeze time. Leave the fence up
until cut-over succeeds or rollback restores Supabase. Existing sessions may
need a refresh that writes; new sign-ins update Auth storage. Therefore allow
anonymous browsing but show a clear maintenance response for auth/member writes
and budget a short sign-in interruption. This avoids a complex selective-field
freeze that could miss verification, account-linking or password updates. The
6m43.1s database rehearsal is a lower bound, not the maintenance-window promise.

Why the alternatives are insufficient: Supabase's signup toggle explicitly
allows existing users to sign in, and manual linking is a separate setting.
Network restrictions affect Postgres/pooler, **not Auth's HTTPS API**. Do not
substitute either for the write barrier.
[Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration),
[Network restrictions, limitations](https://supabase.com/docs/guides/platform/network-restrictions#limitations).

### 2.6 — Keep the same write fence for the 30-day rollback window

**Recommendation:** retain the rehearsed fence, disable legacy providers/signup/
manual-linking, and keep Supabase available only to protected SQL reads/exports
for 30 days. Do not call this continuing Supabase sign-in service: refreshing
sessions and authentication writes will fail. Keep the exact pre-freeze settings,
trigger inventory and reversal commands with the encrypted backup. Check daily
that no Auth table was added without the fence, no trigger was removed, and the
rollback data stayed unchanged. A Supabase schema upgrade may conflict with the
fence; coordinate with Supabase rather than dropping it unnoticed. This is a
reversible operational guard, not a security boundary against the project owner
or provider administrator. Ordinary table RLS cannot replace it for Auth's own
privileged database role. [Supabase Auth architecture](https://supabase.com/docs/guides/auth/architecture),
[Managed Auth-schema caution](https://supabase.com/docs/guides/auth/managing-user-data).

Do not pause the project as a substitute: paused projects do not provide the
required online read path. If the project is on Free, Supabase may automatically
pause it after a low-activity week; the owner must monitor availability/activity
and decide whether paid continuity is needed for the 30-day online requirement.
Paid projects are not subject to inactivity pausing. No plan change is made here.
[Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
Set the dated shutdown follow-up at cut-over +30 days; a final encrypted export
precedes shutdown. Returning to Supabase first removes only our named triggers
and restores settings, then explicitly accepts post-import account/password
changes being absent there. Do not run a reverse email-based merge.

### Maintenance jobs — No separate recurring run-once schedule at launch

**Recommendation:** use the existing in-process maintenance worker, with a
pre-start audit and per-process completion/failure/staleness monitoring. There is
no need for another cron carrying the auth credentials. Initialization is lazy:
`getBetterAuth()` creates the service and starts the worker, so enabling the flag
alone is not evidence of a running worker. During 2.7, exercise an auth request
on each serving process/destination and observe completed passes. It waits 60
seconds before its first pass and after each pass; page time makes that an
interval, not a completion SLA. Alert on failure/quarantine or completion age
beyond an observed full-pass duration plus a scheduling margin. Use manual
`auth:maintenance run-once` only for an explicitly authorized recovery; never
run it during the import freeze. If a future deployment needs cleanup while no
webapp is running, design a separate job then. Primary implementation:
[`runtime.server.ts` on main](https://github.com/alp82/goodwatch-monorepo/blob/main/goodwatch-webapp/app/server/auth/runtime.server.ts),
[`maintenance-worker.server.ts` on main](https://github.com/alp82/goodwatch-monorepo/blob/main/goodwatch-webapp/app/server/auth/maintenance-worker.server.ts),
[Maintenance execution contract](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/implementation/auth-maintenance.md#execution-and-job-contract).

## Exact production import commands for 2.3

Use the [merged #551 production runbook](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/auth-supabase-import-rehearsal.md#production-route-for-552-step-23)
for source-copy creation, the `frozen-production-552` marker, SELECT-only role,
private environment-file variables, storage grants, counts and failure recovery.
Do not run these until the owner selects the window and steps 1.4–1.6 and 2.1–2.2
are complete. Nothing in this task executed them against production.

In a separate terminal, after independently verifying the remote cluster:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -L 127.0.0.1:15648:10.0.0.11:4200 root@10.0.0.11
```

From `goodwatch-webapp`, with a fresh operator-owned 0700 directory and a 0600
secret environment file prepared as in the runbook:

```bash
set -euo pipefail
set +x
umask 077
source /private/goodwatch-auth-552/import.env
unset AUTH_IMPORT_COPY_ONLY
export AUTH_IMPORT_TARGET_PROFILE=production
export AUTH_IMPORT_CRATE_ORIGIN=http://127.0.0.1:15648
export AUTH_IMPORT_CRATE_USERNAME=goodwatch_auth
export AUTH_IMPORT_WRITERS_STOPPED=yes
export AUTH_IMPORT_RECEIPT=/private/goodwatch-auth-552/receipt.json

node scripts/auth-importer/import.ts --allow-production \
  > /private/goodwatch-auth-552/dry-run.json
node scripts/auth-importer/import.ts --allow-production --apply \
  > /private/goodwatch-auth-552/import.json
node scripts/auth-importer/import.ts --allow-production --apply --rerun \
  > /private/goodwatch-auth-552/rerun.json

export AUTH_CRATEDB_ORIGINS="$AUTH_IMPORT_CRATE_ORIGIN"
export AUTH_CRATEDB_USERNAME="$AUTH_IMPORT_CRATE_USERNAME"
export AUTH_CRATEDB_PASSWORD="$AUTH_IMPORT_CRATE_PASSWORD"
export AUTH_CRATEDB_ENCRYPTION_SECRET="$AUTH_IMPORT_PAYLOAD_SECRET"
export AUTH_CRATEDB_ENCRYPTION_KEYS="$AUTH_IMPORT_ENCRYPTION_KEYS"
npm run auth:maintenance -- audit > /private/goodwatch-auth-552/audit.log
```

Every exit must be zero; review aggregate source/target counts and exact-rerun
zero-created output before starting auth services. The signed receipt prevents
skipping dry-run/apply order, expires after 24 hours, and binds source rows,
marker, target node IDs/counts and keys. Partial failure does not advance it;
recover only under the runbook. Stop the owned SSH process after use and remove
private exports according to the approved retention policy. Never publish source
rows, fingerprints, member UUIDs or secret files.

## Sources

- Issues: [#529](https://github.com/alp82/goodwatch-monorepo/issues/529) and its five comments, [#536](https://github.com/alp82/goodwatch-monorepo/issues/536), [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), [#551](https://github.com/alp82/goodwatch-monorepo/issues/551), [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#553](https://github.com/alp82/goodwatch-monorepo/issues/553), [#562](https://github.com/alp82/goodwatch-monorepo/issues/562), [#563](https://github.com/alp82/goodwatch-monorepo/issues/563), [#565](https://github.com/alp82/goodwatch-monorepo/issues/565), [#572](https://github.com/alp82/goodwatch-monorepo/issues/572), [#588](https://github.com/alp82/goodwatch-monorepo/issues/588).
- PRs: #564, #573, #578, #581, #583, #584, #586, #587, #589, #590, #591.
- Runbooks: `docs/implementation/auth/cratedb-prereqs.md` (branch `auth/cratedb-prereqs`), `docs/auth-supabase-import-rehearsal.md` (branch `auth/supabase-importer`), `docs/implementation/auth-maintenance.md` (branch `auth/maintenance-jobs`), `goodwatch-webapp/app/server/auth/WIRING.md` and `docs/webapp-deploys.md` (branch `auth/integration`).
- Not in the checklist: [#553](https://github.com/alp82/goodwatch-monorepo/issues/553) (account deletion). No source says it blocks the cut-over. The owner decides whether it must ship first.

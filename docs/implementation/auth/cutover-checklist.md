# Production cut-over checklist: Supabase Auth to Better Auth, and the MCP launch

Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), with the MCP launch [#572](https://github.com/alp82/goodwatch-monorepo/issues/572). Map: [#529](https://github.com/alp82/goodwatch-monorepo/issues/529). State of the sources: 2026-10-15, about 04:30 UTC.

Rules that come from the owner and bind every step:

- Better Auth and the MCP go live for every member at once. There is no preview phase. ([#536](https://github.com/alp82/goodwatch-monorepo/issues/536))
- Every production step waits for the owner's go. ([#529](https://github.com/alp82/goodwatch-monorepo/issues/529) notes)
- The cloud session cannot reach the private network (`10.0.0.x`) or production secrets. ([#529 handover](https://github.com/alp82/goodwatch-monorepo/issues/529#issuecomment-6175164195))

Who is one of: **Owner** (decides and holds the secrets), **Laptop** (a session on the owner's laptop with private-network access), **Cloud** (the hosted Claude Code session, repository work only).

## Blocking prerequisites

Do not start the cut-over day until every box here is ticked. State as of the sources above.

- [ ] **crate-01 is still on 5.10.9.** crate-02 and crate-03 run 5.10.16. Upgrade crate-01 with the owner watching. First review the page failures seen during the crate-03 restart: 27 failed query lines and 9 new HTTP 5xx, even with PR #589 deployed. ([#547 Q25 report](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6184183348))
  - Why it matters: a table created on 5.10.16 stops a 5.10.9 node from rejoining. After auth tables exist, snapshot recovery is the only way back. (`docs/implementation/auth/cratedb-prereqs.md`, "Rollback and abort", branch `auth/cratedb-prereqs`)
- [ ] **#562: CrateDB does not enforce passwords.** HBA is off. Any caller can be `crate`. Auth must not launch until passwords are enforced on every node and every client is migrated. `backup.py` sends no credentials today. A cloud thread is preparing the code part on `auth/crate-credentials`. ([#562](https://github.com/alp82/goodwatch-monorepo/issues/562), runbook "Authentication finding and release gate")
- [ ] **#563: no CrateDB restore has ever been proven.** The owner waived the gate for the patch upgrade only. Restore a recent snapshot to an isolated three-node cluster, recover the BLOBs separately, and record the time. ([#563](https://github.com/alp82/goodwatch-monorepo/issues/563), [#547 waiver](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6177543732))
- [ ] **#551: the real-copy rehearsal has not run.** Only fake-data tests exist. Done means matching counts, sample sign-ins (password, Google, unconfirmed), a member's data visible, and a timed runbook for the real run. ([#551](https://github.com/alp82/goodwatch-monorepo/issues/551), `docs/auth-supabase-import-rehearsal.md` on `auth/supabase-importer`)
- [ ] **The importer has no production mode.** The CLI accepts only local copies on loopback ports and rejects remote hosts. "This importer has no production-mode flag." The owner must decide how the real run works, and it goes into the #551 runbook. (`docs/auth-supabase-import-rehearsal.md`, steps 4 and the closing paragraph)
- [ ] **Encryption keys are in the secret store and backed up.** `AUTH_CRATEDB_ENCRYPTION_SECRET` (permanent, never rotate in place), `AUTH_CRATEDB_ENCRYPTION_KEYS` (JSON key ring) and `BETTER_AUTH_SECRET`. Losing them orphans every email claim and lookup. ([#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6180556817), `docs/implementation/auth-maintenance.md` "Keys and recovery" on `auth/maintenance-jobs`)
- [ ] **The capacity table exists.** Migrate `doc.auth_capacity` together with the other auth tables, 15 in all. Importing users and accounts needs no capacity admission any more. The old line "run the import with admission enabled" in the #552 comment is superseded. (`auth-maintenance.md` "Rollout requirement", [PR #587](https://github.com/alp82/goodwatch-monorepo/pull/587))
- [ ] **The maintenance jobs are scheduled.** The runtime worker starts in every process that has Better Auth enabled. The owner decides whether a separate `auth:maintenance run-once` schedule is also wanted. No ticket decides this. ([#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6180556817), `auth-maintenance.md` "Execution and job contract")
- [ ] **The privacy "Last updated" date is set to the cut-over date.** File `goodwatch-webapp/app/routes/privacy.tsx`, today "October 15, 2026". ([#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6183777144))
- [ ] **The cookie rename is not in the code yet.** On `auth/integration` the Traefik member rule, `app/utils/auth-cookie.ts`, cache identity, the metrics audience label and the proxy test scripts still match `sb-<ref>-auth-token`. ([#552 body](https://github.com/alp82/goodwatch-monorepo/issues/552); checked with `git grep` on `origin/auth/integration`)
- [ ] **The stack lands as one merge commit of PR #591.** `auth/integration` combines #564, #573, #583, #581 (includes #577), #587, #584, #586, #590, #578 and #576, and is merged with current `main`. Merging the PRs one by one would deploy every intermediate state to production, because each push to `main` deploys, and those states were never tested together against current `main`. #591 also carries integration-only repairs. #597, account deletion, stays separate until after the cut-over. (step 1.9, [PR #591](https://github.com/alp82/goodwatch-monorepo/pull/591))

Already done, no action: PR #589 (CrateDB client failover) is merged and deployed as `ebe8581f`; #588 is closed. The 16 privacy points on #571 are settled. ([#588](https://github.com/alp82/goodwatch-monorepo/issues/588), [#529 04:05 update](https://github.com/alp82/goodwatch-monorepo/issues/529#issuecomment-6184112173))

## Phase 1: prepare production (no member impact)

Do these in this order, on days before the cut-over.

- [ ] **1.1 Upgrade crate-01 to 5.10.16.**
  - Who: Owner and Laptop. Ticket: [#547](https://github.com/alp82/goodwatch-monorepo/issues/547).
  - Do: follow the runbook's pre-checks, named snapshot, one-node decommission and recovery gates. Use the 2-hour graceful timeout and an HTTP wait of at least 7,500 seconds.
  - Verify: three nodes on 5.10.16, all health rows GREEN, all shard copies STARTED, 21 node checks pass, a new scheduled backup succeeds.
  - Roll back: before the new binary starts, restore the old image and restart policy. After new-format tables exist, only snapshot recovery works. (runbook "Rollback and abort")

- [ ] **1.2 Prove a snapshot restore.**
  - Who: Owner and Laptop. Ticket: [#563](https://github.com/alp82/goodwatch-monorepo/issues/563).
  - Do: restore a recent snapshot to a fresh isolated three-node cluster with the repository read-only. Recover the BLOB tables (`blob.search_index_files`) separately. Write the steps and timing into the runbook.
  - Verify: row counts, users and settings match.
  - Roll back: nothing in production changes. Delete the isolated cluster.

- [ ] **1.3 Enforce CrateDB passwords (HBA).**
  - Who: Owner and Laptop; code part by Cloud. Ticket: [#562](https://github.com/alp82/goodwatch-monorepo/issues/562).
  - Do: inventory every client (webapp, search roles, Windmill, monitoring, `backup.py`). Give each its own least-privilege user and roll the credentials out first. Then enable HBA node by node and keep a checked admin route.
  - Verify: a wrong or missing password is rejected on every node from a real app host, and every client still works, including the hourly backup.
  - Roll back: the plan written under #562. Turn HBA off on the node again and keep the admin route.

- [ ] **1.4 Verify the prepared `goodwatch_auth` user, then create auth tables and grants.**
  - Who: Owner and Laptop. Tickets: [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), [#562](https://github.com/alp82/goodwatch-monorepo/issues/562), [#572 comment](https://github.com/alp82/goodwatch-monorepo/issues/572#issuecomment-6179158883).
  - Do, in this order: require the #547 preparation receipt: `goodwatch_auth` exists with zero grants and authenticates on all three coordinators. The #547 preparation created this identity on 2026-10-16 with zero grants; auth tables remain absent until this step. Reuse its server-generated secret at `/root/.config/goodwatch/crate-credentials/goodwatch_auth` on crate-01 (root-owned 0600, parent 0700); do not regenerate it. Run the auth table migration from PR #564 with an admin identity. It covers 13 model tables, email claims and `doc.auth_capacity`. Create `user_mcp_action` from `docs/implementation/mcp-write-tools-schema.sql` (PR #584). It isn't declared in `crate_schemas.py`, so the daily `f/sync/populate_crate` flow never creates it. Set `number_of_replicas = '2'`, `write.wait_for_active_shards = 1` and `translog.durability = 'REQUEST'` on each auth table. Grant `DQL, DML ON TABLE doc.<approved_auth_table> TO goodwatch_auth` for each of the 15 approved `auth_*` tables explicitly; never grant on the schema/cluster, catalog tables or `user_mcp_action`. Before inserting auth data, apply the table-specific DENY rules for other client roles required by the #562 production runbook.
  - Secret handoff: the owner copies that protected file into Coolify **UI only** as secret runtime `AUTH_CRATEDB_PASSWORD`, with `AUTH_CRATEDB_USERNAME=goodwatch_auth` and the approved private `AUTH_CRATEDB_ORIGINS`, for both deployment destinations. Never print the value or write to Coolify’s database/API. Keep the encrypted recovery copy from 1.5.
  - Verify: as admin, every approved auth table has the exact settings and all three copies STARTED. Correct password gives `current_user = goodwatch_auth`. Catalog reads, DDL and privilege changes fail for that user.
  - Roll back: `REVOKE DQL, DML ON TABLE <approved list> FROM goodwatch_auth`, then `DROP USER goodwatch_auth` only if this run created it. Do not drop the auth tables. (runbook "Dedicated runtime user", "Rollback and abort")

- [ ] **1.5 Store the secrets and back them up.**
  - Who: Owner. Tickets: [#552 comment](https://github.com/alp82/goodwatch-monorepo/issues/552#issuecomment-6180556817), [#565](https://github.com/alp82/goodwatch-monorepo/issues/565).
  - Do: put these in the deployment's secret store: `BETTER_AUTH_SECRET`, `AUTH_CRATEDB_ENCRYPTION_SECRET`, `AUTH_CRATEDB_ENCRYPTION_KEYS`, `AUTH_CRATEDB_USERNAME`/`PASSWORD`, `AUTH_GOOGLE_CLIENT_ID`/`SECRET`, `AUTH_SMTP_USER`/`PASSWORD`. Also set `BETTER_AUTH_URL`, `MCP_RESOURCE_URL` and `AUTH_TRUSTED_IP_HEADER` (a single-IP header that ingress overwrites). Keep an access-controlled encrypted recovery copy, including keys needed by retained snapshots.
  - Verify: a second person can restore the full set from the recovery copy. The restore rehearsal in 1.7 uses the matching snapshot and secret set.
  - Roll back: not applicable. Never regenerate the permanent root during a deploy. That is data loss.

- [ ] **1.6 Add the Google redirect and check Purelymail.**
  - Who: Owner. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: add `/api/auth/callback/google` (on the production origin) to the Google OAuth client. Confirm the Purelymail account can send as `hello@goodwatch.app`. Purelymail allows about 3,000 auth mails a day. Its connection limit is unpublished. ([#532](https://github.com/alp82/goodwatch-monorepo/issues/532))
  - Verify: do a real Google sign-in and a real mail on the production origin in step 2.7. Local tests used fixtures only.
  - Roll back: remove the redirect entry. Nothing else depends on it while the flag is off.

- [ ] **1.7 Rehearse the real migration on a copy.**
  - Who: Laptop with the owner's approved backups. Ticket: [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: follow the ten steps in `docs/auth-supabase-import-rehearsal.md` ("Later rehearsal using restored copies"): isolated copies, migrate target tables, mark the source, dry run, import, rerun, start an isolated auth service, check the acceptance sample, report. Time every step.
  - Verify: `status: planned` with zero issues on the dry run, `status: complete` on import, `after.users == source.users`, `after.emailClaims == source.users`, rerun creates zero rows. Sample sign-ins work for password, Google, both-methods and unconfirmed members. A member's Wishlist, ratings and settings load under the same UUID.
  - Roll back: restore the isolated target backup. Production is untouched.

- [ ] **1.8 Write the cookie rename.**
  - Who: Cloud. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: everywhere `sb-<ref>-auth-token` is matched, also match `gw.session_token` and its `__Secure-` form on HTTPS. That covers the Traefik member-sticky rule in `goodwatch-proxy/traefik/goodwatch-balance.yaml`, `auth-cookie.ts`, cache identity and the page cache, the metrics audience label, and the proxy test scripts (`test-local.sh`, `test-search-local.sh`). Match both names during the switch. Update `docs/cache-identity.md` and `docs/webapp-deploys.md`. (`WIRING.md`: both cookie forms bypass the shared page cache.)
  - Verify: the unit tests for cache identity and metrics labels, and the 65 local Traefik checks, pass with both names. An anonymous response carries no `gw_instance` cookie. A request with either auth cookie gets one.
  - Roll back: revert the commit. Nothing is deployed yet.

- [ ] **1.9 Merge the stack and deploy with the flag off.**
  - Who: Owner decides; Cloud prepares; Owner deploys. Tickets: [#529 handover](https://github.com/alp82/goodwatch-monorepo/issues/529#issuecomment-6181206334), [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
  - Do: merge current `main` into #591 (`auth/integration`) together with the cookie rename from 1.8, re-run every suite and wait for its CI. Then merge #591 into `main` as one merge commit, not squashed and not PR by PR, so the branch history stays. Close #564, #573, #583, #581, #577, #587, #584, #586, #590, #578 and #576 as landed through #591. Keep #597 open for after the cut-over. Deploy with `BETTER_AUTH_ENABLED=false` and `REC_CONNECTOR` off. Production's `remix-serve` lacks `Response.json`, and the MCP and auth handlers fill it on every request (`f71756ac` on #581). Do not install the `/mcp` routing yet, and see the paste-timing caveat in 3.1.
  - Verify: the redesigned account pages work on Supabase on a page smoke (`webapp-deploys.md`): sign in, sign out, sign up (it shows "Check your inbox" at `/verify-email`), a reset with a real link (the page shows "You're signed in" and the header shows the member without a reload) and a password change in Settings. No page mentions connected apps. `/connect` and `/settings/connected-apps` answer 404. `/privacy` serves the June 2024 text. An anonymous `POST /mcp` answers 401, not 500. After the next 17:00 UTC `f/sync/populate_crate` run, `doc.user_mcp_action` still doesn't exist. Start-up time stays at about main's: Better Auth, nodemailer and the MCP SDK load only on first use.
  - Roll back: redeploy the previous image the documented way (`docs/webapp-deploys.md`). The flag is off, so no member state changed.

## Phase 2: cut-over day

Needs the owner's go. Write down the start time and the operator. All steps are Owner and Laptop unless noted.

- [ ] **2.1 Final backups and a named snapshot.**
  - Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: create a named CrateDB snapshot (`pre_auth_552_<timestamp>`, serialized with `/var/lock/backup_crate.lock` on crate-01). Take the approved encrypted Supabase backup. Save the current Traefik `goodwatch-balance.yaml` and the current `.env` for rollback.
  - Verify: snapshot state is `SUCCESS`. The Supabase backup restores. The saved files are readable.
  - Roll back: not applicable. These are the rollback material.

- [ ] **2.2 Freeze Supabase writes.**
  - Ticket: [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: stop new Supabase sign-ups and password changes, so the final copy is consistent. The importer needs "a source write freeze". How to freeze is not written in any ticket. **Owner decides.**
  - Verify: the user count in `auth.users` stays constant for 5 minutes.
  - Roll back: lift the freeze.

- [ ] **2.3 Run the real import.**
  - Ticket: [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
  - Do: follow the timed runbook from 1.7 and the production route the owner chose (see Blocking prerequisites). All auth and member writers stay stopped. Dry run first, then apply, then a rerun.
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
  - Do: set Supabase Auth to read-only for 30 days. How is not written in any ticket. **Owner decides**, and writes it into this file. Create the dated follow-up in 4.2 right now.
  - Verify: a write to Supabase Auth is refused; reads still work.
  - Roll back: lift read-only. This only helps if the flag is off again.

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
  - Verify: the 65 proxy checks pass locally with the same files. On production, an anonymous `POST /mcp` answers 401 with OAuth discovery, and the metadata URLs answer from page instances.
  - Roll back: restore the saved Traefik file.

- [ ] **3.2 Check `user_mcp_action` and the flags.**
  - Who: Laptop. Ticket: [#572 comment](https://github.com/alp82/goodwatch-monorepo/issues/572#issuecomment-6179158883), [PR #584](https://github.com/alp82/goodwatch-monorepo/pull/584).
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
  - Who: Owner and Laptop. Tickets: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#572](https://github.com/alp82/goodwatch-monorepo/issues/572).
  - Watch: sign-in errors; mail sending and the Purelymail limits (about 3,000 a day); the mail queue is in memory, so a crash can lose a mail and members must resend ([#573](https://github.com/alp82/goodwatch-monorepo/pull/573)); `goodwatch_auth_maintenance_total`, `goodwatch_auth_maintenance_last_completed_seconds` and `goodwatch_auth_maintenance_quarantined_total{table}` (a stalled worker is an alert); `goodwatch_mcp_tool_calls_total` and tool duration; rate limits (MCP 60 a minute and 1,000 an hour per member, ranked search 20 a day, DCR 30 an hour per IP); CrateDB 5xx on page routes.
  - Verify: no growing error rate. The last maintenance pass is recent. Quarantined rows stay at zero. Exit code 2 from the CLI means an incomplete result.
  - Roll back: see below.

- [ ] **4.2 Dated follow-up: shut Supabase down 30 days after the cut-over.**
  - Who: Owner. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#536](https://github.com/alp82/goodwatch-monorepo/issues/536).
  - Do: create the dated ticket or reminder on cut-over day: cut-over date plus 30 days. On that day, take a last Supabase backup, then shut Supabase Auth down.
  - Verify: no production path reads Supabase Auth. Members still sign in.
  - Roll back: after shutdown, only the backup remains. Keep it under the data-retention policy.

- [ ] **4.3 Remove the old cookie from the code.**
  - Who: Cloud, then Owner for Traefik. Ticket: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
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

## Sources

- Issues: [#529](https://github.com/alp82/goodwatch-monorepo/issues/529) and its five comments, [#536](https://github.com/alp82/goodwatch-monorepo/issues/536), [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), [#551](https://github.com/alp82/goodwatch-monorepo/issues/551), [#552](https://github.com/alp82/goodwatch-monorepo/issues/552), [#553](https://github.com/alp82/goodwatch-monorepo/issues/553), [#562](https://github.com/alp82/goodwatch-monorepo/issues/562), [#563](https://github.com/alp82/goodwatch-monorepo/issues/563), [#565](https://github.com/alp82/goodwatch-monorepo/issues/565), [#572](https://github.com/alp82/goodwatch-monorepo/issues/572), [#588](https://github.com/alp82/goodwatch-monorepo/issues/588).
- PRs: #564, #573, #578, #581, #583, #584, #586, #587, #589, #590, #591.
- Runbooks: `docs/implementation/auth/cratedb-prereqs.md` (branch `auth/cratedb-prereqs`), `docs/auth-supabase-import-rehearsal.md` (branch `auth/supabase-importer`), `docs/implementation/auth-maintenance.md` (branch `auth/maintenance-jobs`), `goodwatch-webapp/app/server/auth/WIRING.md` and `docs/webapp-deploys.md` (branch `auth/integration`).
- Not in the checklist: [#553](https://github.com/alp82/goodwatch-monorepo/issues/553) (account deletion). No source says it blocks the cut-over. The owner decides whether it must ship first.

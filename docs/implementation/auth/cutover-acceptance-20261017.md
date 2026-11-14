# Better Auth production cut-over: accepted 2026-10-17

Checklist: [PR #595](https://github.com/alp82/goodwatch-monorepo/pull/595).
Import: [#551 evidence](https://github.com/alp82/goodwatch-monorepo/issues/551#issuecomment-6227654238).
Ongoing cut-over tracking: [#552](https://github.com/alp82/goodwatch-monorepo/issues/552).
Shutdown and cleanup: [#683, due 2026-11-16](https://github.com/alp82/goodwatch-monorepo/issues/683).

## Timeline (UTC)

| Time | Evidence |
| --- | --- |
| 00:30 | Named CrateDB snapshot `goodwatch-db-backup-v2.pre_auth_552_20261017t003025z` created under `/var/lock/backup_crate.lock`; SUCCESS independently verified. |
| 00:36 | Owner verified proxy behavior: `gw_instance` only for members, www 301 retained. The repository www routers are in `5250bfae7f536c0dfbd1fe6bda17be5c11bb3b00`. |
| 00:41 | Authoritative freeze start: maintenance on, Supabase sign-ups off. Earlier deployments had removed the variable; import remained stopped until the restored freeze was confirmed at 00:42:50. |
| 00:43:11 / 00:46:20 | Fresh hosted counts both 724 users / 727 identities, 189.451 seconds apart; match owner dashboard count 724. |
| 00:46 | Encrypted full Supabase archive and frozen auth export created from one TLS-verified, repeatable-read/read-only snapshot. Restored auth tables exactly matched every exported row. |
| 00:48:59 | Production dry run completed: zero issues, empty target unchanged. |
| 00:49:16 | Public maintenance=true rechecked immediately before apply; both serving containers also passed maintenance-on / Better-Auth-off checks. |
| 00:52:19 | Apply completed: 724 users / 727 accounts / 724 email claims, zero issues. |
| 00:53:47 | Exact rerun completed: zero new users/accounts, unchanged totals, zero issues. |
| 00:54:49 | `npm run auth:maintenance -- audit` exited 0: 13 jobs, 1,451 live rows, zero unsafe/skipped/unadmitted/inconsistent. |
| 00:55 | Independent mappings and hosted-source count rechecked; all matched. Cluster 113 GREEN, zero missing/underreplicated shards. |
| 01:09 | Owner deployed launch flags. BETTER_AUTH_ENABLED was initially saved as `on`, which is not the required value. |
| 01:14 | Owner corrected BETTER_AUTH_ENABLED to `true`; Better Auth became live. Privacy date is October 17, 2026 (`ef80218b`). |
| About 01:21 | Owner replaced the incorrect Google client secret after `invalid_client` (the incorrect value was 37 characters; no value is recorded). Real Google sign-in then passed, without creating a duplicate user; count remained 724 at that check. |

Deployment/provider operations and real acceptance above were performed and reported by the owner. The backup/import/audit/count and mapping checks were executed by Codex. This documentation update changed no production setting.

## Import baseline and acceptance

| Count | Frozen source / expected | Target after exact rerun | Difference |
| --- | ---: | ---: | ---: |
| Users | 724 | 724 | 0 |
| Credential accounts (source email identities) | 385 | 385 | 0 |
| Google accounts | 342 | 342 | 0 |
| Accounts | 727 | 727 | 0 |
| Email claims (one per source user) | 724 | 724 | 0 |

Independent verification checked every UUID/owner, normalized email, verification value, claim owner, credential hash/null and Google subject; all payloads authenticated with the active runtime key. No hand-edited rows, identity merge or verification promotion. These are import-baseline counts, not a permanent ceiling on legitimate post-launch sign-ups.

The owner explicitly accepted the full checklist **2.7** matrix: existing member data visible; old-session banner; password sign-in; real Google redirect/sign-in without duplication; sign-up with mail from `hello@goodwatch.app`; forgot/reset password; change password; sign out. This closes #551's earlier real-sign-in acceptance gap. #551 remains closed; Phase 3 MCP-client acceptance is separate.

## Retention and remaining work

- Supabase sign-ups stay OFF during retention. No trigger/fence. The owner confirmed password-manager custody of BETTER_AUTH_SECRET, the permanent encryption root/key ring and the separate backup passphrase before import.
- [#683](https://github.com/alp82/goodwatch-monorepo/issues/683) schedules final encrypted backup, shutdown and legacy-cookie/Supabase-fallback cleanup on **2026-11-16**, 30 days after cut-over. Creating the issue completes the scheduling task; the retention period and actual shutdown remain ongoing/future work.
- #552 stays OPEN for first-days monitoring, retention/shutdown and removal of legacy `sb-` cookie/fallback support. Its done criterion includes the old cookie no longer being needed.
- Maintenance per-process completion/alert evidence remains a follow-up; the pre-launch audit passed. No additional cron was added.
- No Phase 2 functional action remains unaccepted by the owner. Verification limits remain explicit: this thread did not run `./bench.sh smoke` and no execution receipt for it was supplied; the backup restore proved the required auth tables, not a full managed Supabase platform/schema/extension restoration.
- Keep real MCP-client acceptance under #572/Phase 3; it is not established by auth sign-in acceptance.

Encrypted backup, frozen export, stopped source-copy volume, completed signed receipt and private reports remain root-protected on crate-01 under `/root/.config/goodwatch/auth-cutover-552/cutover_552_20261017T004626Z/`. The temporary copy and SSH forwards were stopped. Identifiers, source fingerprints, hashes and secret values remain private. Do not rerun the frozen importer after live member changes.

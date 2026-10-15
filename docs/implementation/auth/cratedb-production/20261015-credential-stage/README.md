# Credential staging execution — 2026-10-15 22:36–22:45 UTC

**Stopped on an unexpected backup-cron readback. The hourly Crate backup is currently unscheduled.**
The updater installed the reviewed backup files and password, then `crontab -` returned exit 0, but immediate
readback was empty. A separate read confirmed the root spool has only three generated comments, no jobs.
The original root crontab had exactly one job (Crate backup). Its complete protected rollback copy exists at
`/root/.config/goodwatch/crate-rollout-562/crontab.before` on **crate-01 / 10.0.0.11**.
No subsequent production mutation or attempted workaround was made. The cause is not established.
The next ordinary backup would have been **23:05 UTC**; it will not run unless the cron is restored.

Owner explicitly authorized this credential-only stage despite the previously documented stale contexts,
while retaining the stop-on-unexpected-result rule. HBA stayed off. No Crate restart, KILL, table creation,
snapshot creation/deletion, Coolify mutation, worker restart or main merge occurred.
Reviewed source was PR #599 commit `07974f544a1804cd6820290a631f4f22b78285e1`.

## Completed and verified

| Client / step | Result and evidence |
| --- | --- |
| Six identities | Generated on crate-01 using `secrets.token_hex(32)`. Files owned by root, mode 0600, parent mode 0700: `/root/.config/goodwatch/crate-credentials/{goodwatch_webapp,goodwatch_search,goodwatch_windmill,goodwatch_readonly,goodwatch_backup,goodwatch_monitoring}`. Created users and applied runbook grants, including backup DENY on both retained archive schemas. [Provision receipt](provision.jsonl). |
| Role probes | All six roles supplied passwords and returned the expected identity on all three coordinators. Catalog reads for the first four roles; zero-row DELETE on each search runtime table; Windmill sys.nodes; backup sys.snapshots; monitoring root GET. [18 role/coordinator results](verify-roles.jsonl). HBA-off accepts wrong passwords: these verify identity, grant access and plumbing, not password enforcement. No destructive grant probes. |
| Search / vector1 .20 | Changed only CRATE_USER/PASS in `/root/goodwatch/goodwatch-monorepo/goodwatch-search/.env` (now 0600), identity `goodwatch_search`. Rolled a, verified all coordinators, then b, verified all coordinators. Healthy + query models loaded after 18s / 16s; same image `3b52c297d2c04b6332cc6379709b03cc425ec4b4`. [A readiness](search-a-roll.txt), [A identities](search-a-verify.jsonl), [B readiness](search-b-roll.txt), [B identities](search-b-verify.jsonl). |
| Windmill / hq .10 | Updated goodwatch workspace variables `u/Alp/CRATE_PASS` (secret retained), then `u/Alp/CRATE_USER=goodwatch_windmill` through its authenticated API. Hosts unchanged. Exact secret readback checked in memory. Identity, sys.nodes and catalog query passed through all coordinators using the values fetched back from Windmill. [Receipt](windmill-config.jsonl). Worker-container and normal job-class checks remain outstanding; active jobs may retain old connections. No Crate resources existed to update. |
| Kuma / hq .10 | Monitors 16–18 now use Basic auth / `goodwatch_monitoring`. Used the service's Socket.IO `loginByToken`, `getMonitor`, `editMonitor` API with a short-lived in-memory token signed using the existing server key. Read SQLite only to obtain existing account/key; no backing DB writes. Exact readback confirmed only the intended auth fields changed. [Config](kuma-config.jsonl). Initial heartbeat probes were earlier than the next 60s interval; subsequent fresh [heartbeats](kuma-verify.jsonl) all UP at 22:43:48–51 UTC. |
| Backup / crate-01 .11 | Installed reviewed `backup.py`, `cleanup_legacy.py`, and root-only `/root/.config/goodwatch/crate-backup-password`. Helper with `CRATE_BACKUP_USER=goodwatch_backup` and that file passed identity checks on all coordinators and read latest successful snapshot `hourly_20261015_220501`. [Probe](backup-verify.jsonl). **Cron update failed readback; schedule absent**, see [stop receipt](backup-cron-stop.json). No manual backup/pruning invoked. |
| Cluster | Final reads at 22:45 UTC: 96 GREEN rows, 962 STARTED/STARTED copies, 21 passing checks; original IDs/version, allocation all, graceful settings unchanged. [Final health](final-health.jsonl). These reads still worked without a password, consistent with HBA remaining off. |

Passwords were never printed, put in command arguments or committed. Transfers used captured process memory and
SSH stdin. Root-only rollback material is on the affected servers:

- Vector1: `/root/.config/goodwatch/crate-rollout-562/search.env.before`.
- Hq: `/root/.config/goodwatch/crate-rollout-562/windmill.variables.before.json`.
- Hq Kuma volume: `/var/lib/docker/volumes/goodwatch-monitoring_uptime-kuma-data/_data/crate-rollout-562/monitor-{16,17,18}.before.json`, mode 0600 in a 0700 directory.
- Crate-01: `/root/.config/goodwatch/crate-rollout-562/{backup.py.before,cleanup_legacy.py.before,crontab.before}`.

## Requested next action: restore backup scheduling, then resume staging

**Requires an explicit resume decision under the owner's stop rule. Not executed.**
The smallest recovery is to reinstall the protected original crontab by filename (no secret is in it):

```bash
ssh root@10.0.0.11 crontab /root/.config/goodwatch/crate-rollout-562/crontab.before
```

Then compare `crontab -l` with that protected file in server memory; report only the match and number of backup jobs.
The restored original invocation still works while HBA is off because the new helper preserves unauthenticated
operation when neither backup variable is set. Do not enable HBA in that state.
After recovery is verified, prepare a protected **named file**, retaining every original entry/comment, and replace
only the backup command with the intended credential-bearing invocation below. Inspect it by variable names only,
install via `crontab /absolute/path/to/staged-file`, and verify exact readback before continuing. Investigate the
stdin installation failure before using that method again. No blind retries or overwrite of any newly added job.

```cron
5 * * * * CRATE_BACKUP_USER=goodwatch_backup CRATE_BACKUP_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password /root/.local/bin/uv run /root/goodwatch/goodwatch-monorepo/goodwatch-crate/backup.py >> /var/log/backup_crate.log 2>&1
```

## Owner Coolify checklist and remaining work

The exact **webapp secret file now exists** on **crate-01 (`root@10.0.0.11`)**:

```text
/root/.config/goodwatch/crate-credentials/goodwatch_webapp
```

In the **Coolify UI only**, application **Goodwatch Webapp**, UUID **gk4owk8**, covering **abio 10.0.0.21 and
vector1 10.0.0.20**, set runtime `CRATE_USER=goodwatch_webapp` and secret runtime `CRATE_PASS` to that file's value
using a secure owner-controlled transfer. Preserve `CRATE_HOSTS=10.0.0.11,10.0.0.12,10.0.0.13` and `CRATE_PORT=4200`.
Review preview variables too. Both page destinations still use their old settings. Deploy the reviewed PR build;
verify both running containers before any enforcement. Do not print the secret in chat, logs or an issue.

Still outstanding after the operational stop:

1. Restore and configure backup cron; retain credentials in Ansible inventory/reconciliation; observe a scheduled successful backup.
2. Configure and verify ad-hoc/manual script environments on the inventoried hosts with `goodwatch_readonly` (and explicit scoped identity for writers). No such script environment was changed this stage.
3. Verify Windmill from every actual worker host/container and observe representative scheduled ingestion, monitoring, BLOB and sitemap jobs. Let old work finish. No full-day observation has occurred.
4. Deploy the reviewed #599 image to page **and search** roles. Search's credential-only roll retained its old image; its identity probes are not proof that every old catalog transport sends auth under HBA. Never run search `copy-env` after identity separation.
5. Resolve stale contexts under #644 with the owner, then rerun all restart gates. No contexts were cancelled or remediated here.
6. Confirm external Grafana/ad-hoc clients, restore/BLOB evidence, maintenance scope and the outstanding critical-change review from map #529.
7. Only after every gate: the separately authorized Crate rolling enforcement, positive/negative password checks, then main merge. The latest user decision waives the pre-existing Qdrant timing failure reproduced on main as a merge blocker; other tests/gates remain applicable.

No code changed in this staging turn. Existing PR tests/build results are in the prior preflight evidence; they
were not rerun for this documentation-only execution record. A full production backup, script probes, worker job
canaries and HBA negative-password tests were not run.

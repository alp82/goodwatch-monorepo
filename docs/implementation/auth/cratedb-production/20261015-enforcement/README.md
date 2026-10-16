# Password enforcement execution — October 15–16, 2026 UTC

## Complete: all three nodes enforce passwords

The owner explicitly approved decommission with force=false, zero primaries then normal
`docker stop --timeout=-1` (SIGTERM, unlimited grace), in order **crate-02 → crate-03 → crate-01**.
No further KILLs. No SIGKILL/forced grace. First-node client failure requires HBA rollback and a stop.
Coolify stays owner-UI-only; existing page `admin` is permitted. Main merge follows successful enforcement/tests.

See the [runbook](../../cratedb-production-rollout.md). Every actual stop is host-managed by a transient systemd
unit, preserving unlimited grace even if the operator's SSH connection drops. Each attempt uses a unique unit.
The executor checks restart=no before changing allocation and rechecks zero primaries immediately before SIGTERM.

## Verified preparation

- Merged current main `c1d23766` as `06ae0838`; procedure commits `2e8590c3`, `bcd492d0`, `6925d194`.
- Crate tests **38/38**, renewed isolated mixed-node HBA rehearsal **431/431**, cleanup verified.
- Full webapp suite **2921 passed / 1 failed / 1 skipped / 1 TODO**. Failure is the previously reproduced/main owner-waived Qdrant connection-break timing test.
- Installed backup source SHA256 matches the reviewed source. Actual cron credentials identified as `goodwatch_backup`; read-only identity/snapshot queries succeeded with .11 excluded. [Receipt](backup-preflight.jsonl).
- Before-config/runtime copies protected on each host at `/root/cratedb-maintenance/562-enforce-20261015/`; reviewed render changes only HBA argv. Image/digest, mounts, volumes, private ports and other settings preserved. [Stage](stage.jsonl).
- Safety snapshot `pre_hba_562_20261015232836` independently SUCCESS. All **18 BLOB files / 126,888,186 bytes** copied to protected storage on .11 and SHA1 verified. [Snapshot](snapshot.jsonl), [BLOBs](blobs.jsonl).
- [#563](https://github.com/alp82/goodwatch-monorepo/issues/563) supplies the successful same-repository SQL and separate BLOB restore drill.
- Adversarial Opus reviews: [initial](opus-review.txt), [follow-up](opus-followup.txt). The follow-up conditionally approves once two executor blockers are fixed. Both were resolved before drain: restart=no assertion inside `drain.py`; explicit failed-gate rollback first restores allocation all and GREEN before its drain. Earlier node-order, SSH-stop-lifetime, PostgreSQL-tool and contradictory-document findings were also fixed. Source receipts record final executors.
- PostgreSQL probe prepared on .11; Docker .12 is 28.5.1, supports `--timeout`; systemd 249. StopSignal unset means SIGTERM.

## First node: crate-02

- Drain began **23:37:56 UTC**, acknowledged **23:44:56.807** (419.6s). Immediately rechecked zero primaries, zero missing shards, zero unsettled target copies and force=false.
- Normal stop unit `gw-crate-stop-562-12-234459`: Docker event **signal 15**, exit **143**, no OOM/SIGKILL. Container finished **23:45:05.844**. [Drain/stop receipt](drain-12.jsonl).
- Same original ID/image/volume/env/private binds, HBA=true; trusted loopback `crate` and users ready **23:45:48**. [Rejoin](rejoin-12.jsonl).
- Against **.12 only**: correct credentials passed for admin from both page hosts, search-a/b, actual Windmill worker, backup helper/snapshot read, all three stored Kuma monitor credentials, installed readonly profiles, and all six canonical roles. Missing/wrong HTTP cases returned401. [Gate](client-gates12.jsonl).
- PostgreSQL correct readonly password passed; missing crate/readonly and wrong readonly passwords refused with PGPASSWORD unset and passfile disabled. [PG gate](pg-gate12.jsonl).
- Actual page node-crate drivers preserved credential bytes and returned admin. Search BLOB GET through .12 followed the ordinary private redirect to .11 and passed. Actual ad-hoc script through the installed readonly launcher returned goodwatch_readonly. [Pages](page-driver12.jsonl), [BLOB](search-blob12.jsonl), [script](script-driver12.json).
- Allocation restored all **23:47:09.850**. All endpoints independently passed **96 GREEN / 962 STARTED/STARTED / 21 checks / allocation all** at **23:52 UTC**. [Recovery](recovery12.jsonl).
- Real Windmill canary pinned to .12 passed actual crate-python, deployed connector, monitoring/sitemap reads and authenticated BLOB HEAD. No production data writes. Job `01a141f9-36f0-9722-9ba3-f66d257cba95`. [Result](first-canary-v2-result.json).
- All Kuma monitors UP. Rechecked current page/search containers before the second drain after external replacements. [Kuma](kuma-after12.jsonl), [fresh app checks](apps-refresh12.jsonl).

### Operator probe corrections and observation limits

The first extra Windmill preview replaced `db.con` to restrict the endpoint but retained `db.cur` attached to its
closed old connection. It failed with ProgrammingError/Connection closed after its direct-driver check. Resetting
its cursor to the new connection fixed the probe; the corrected canary passed. [Sanitized error](first-canary-failure.json).
The first extra ad-hoc CLI probe lost the multiword SQL argument through SSH command parsing; the server returned SQL
parse400 for `SELECT`. The argument-preserving subprocess invocation passed. Neither was a production authentication
failure; no credential or deployed connector repair was made.

The first observer stopped when node check1 reported the expected two-node interval against configured three data
nodes. Read-only classification confirmed only this gateway count check; no missing primary. Planned rejoin restored
all21 checks. Later observers distinguish that expected transient condition; between-node gates remain strict.

External automatic page deployments replaced containers repeatedly. Tests discover the current containers, and
fresh gates recheck credentials. Captured logs have no terminal `crate.query` failure in retained samples, but these
are minima and do not prove complete-window zero errors; old removed-container logs are not retained by this run.

## Second node: crate-03 and the scheduled backup

- Drain acknowledged **2026-10-16 00:01:01.412 UTC**, after445.2s. Zero primaries/no missing shards and force=false checked before normal SIGTERM.
- Docker recorded **signal15 / exit143**, no OOM/SIGKILL; finished **00:01:10.697**. Original ID and unchanged image/volume/env/binds rejoined with HBA; admin/users ready **00:01:59**.
- Same full direct HTTP credential matrix and PostgreSQL positive/negative tests passed against **.13 only**. [Drain](drain-13.jsonl), [rejoin](rejoin-13.jsonl), [HTTP](client-gates13.jsonl), [PostgreSQL](pg-gate13.jsonl).
- Allocation all restored **00:03:10.711**. Independent gates on all three nodes passed **96 GREEN / 962 STARTED/STARTED / 21 checks** at **00:09 UTC**. [Recovery](recovery13.jsonl). Current page/search credentials rechecked; all Kuma monitors UP.
- Observer reads straddled the membership transition (node list before departure, gateway-count check after departure). Independent classification confirmed only the expected count check, no missing primaries. That transient observer condition was not a data-health or credential failure. [Classification](transient-checks13.json).
- **00:05 credential-bearing scheduled backup succeeded**, completing **00:06:33 UTC**. Hourly and daily snapshots created and verified; one expired hourly snapshot deleted. Both independently confirmed SUCCESS via crate-02. [Scheduler log](backup-0005.jsonl), [independent repository read](backup-0005-independent.jsonl).
- Before crate-01, actual installed backup credentials/helper again passed with .11 excluded and both alternatives enforcing HBA. [Receipt](backup-before11.jsonl).
- Additional nine worker hosts have no Crate-related root cron or systemd/cron files. [Inventory](expanded-cron-inventory.jsonl). Preserved pre-rotation Windmill admin credential also authenticates against .12, covering existing jobs that retain it; no job cancellation. [Receipt](old-windmill-credential.json).

## Intermediate main validation

Main `5ed9d256` merged as `b092b54e`. Auth/Crate source hashes are unchanged. Full webapp suite now **2965 passed,
1 owner-waived Qdrant timing failure, 1 skipped, 1 TODO**. Production build/precompression passed (**821 files**).

## Third node and final production gates

- Crate-01 drain began **00:11:16 UTC**, acknowledged **00:19:10.232** (473.3s). Zero primaries, no missing shards, no unsettled target copies and force=false checked immediately before normal stop.
- Unit `gw-crate-stop-562-11-001913` sent **signal15**; Docker exit **143**, no OOM/SIGKILL, finished **00:19:16.690**. [Drain/stop](drain-11.jsonl).
- While crate-01 was actually stopped, the **installed backup with actual cron credentials and unmodified coordinator order** encountered ConnectionError on .11 and succeeded as `goodwatch_backup` on enforcing .12. This proves the backup no longer depends on the restarted node. [Offline proof](backup-offline11.txt).
- Same original node ID and preserved settings rejoined with HBA; admin/users ready **00:20:09.602**. Full direct HTTP and PostgreSQL positive/negative gates passed against **.11 only**. [Rejoin](rejoin-11.jsonl), [HTTP](client-gates11.jsonl), [PG](pg-gate11.jsonl).
- Allocation all restored **00:21:28.123**. At **00:29:07–18 UTC**, all three endpoints independently passed **96 GREEN / 962 STARTED/STARTED / 21 checks / allocation all / force=false** with trusted local admin access. [Final recovery](recovery11.jsonl).
- Final runtime verification: HBA=true, original pinned image/volumes/env/bindings/limits, restart=always, restart counts0 and no active owned stop units on all nodes. [Config](final-config.jsonl). The operator observer exited; no extra restart or cleanup remains running.
- All **19 worker containers × 3 enforcing coordinators = 57** identity/sys/catalog checks passed. All **15 script hosts** passed each coordinator and the installed readonly helper (**60 records**). [Workers](final-worker-probes.jsonl), [scripts](final-readonly-probes.jsonl).
- Real default and highperf Windmill canaries passed all three enforcing nodes using the actual driver/deployed connector, monitoring/sitemap reads and authenticated BLOB HEAD, with no production writes. [Default](final-canary-python3-result.json), [highperf](final-canary-highperf-result.json).
- Fresh actual pages/search passed correct/missing/wrong credentials against [crate-01](final-apps11.jsonl), [crate-02](final-apps12.jsonl), [crate-03](final-apps13.jsonl). Both pages retain `admin`. Current page/search containers healthy and Kuma16–18 UP. [Status](final-client-status.jsonl).
- Ordinary monitoring, ingestion, catalog/vector and personal-order jobs succeeded after all nodes enforced. Episode-sync failures retain the **identical error-message hash** observed before the rollout; no auth markers. [Job metadata](final-windmill-ordinary.json), [classification](final-windmill-failure-classification.jsonl), [baseline](../20261015-credential-resume/windmill-failure-classification.jsonl).
- Retained page logs show576 recovered attempts and one cancelled BackendTimeoutError; search logs have no matching error events. This is a sampled lower bound, not a zero-error claim. External deployments removed prior containers during the window. [Impact](final-client-impact.jsonl).

## Current client inventory after enforcement

All SQL coordinators below are private **10.0.0.11/.12/.13:4200**, unless stated otherwise. Worker/script hosts are
**10.0.0.10–21, .30, .31, .32** (15 hosts). The initial six-host inventory and before/after fixes remain in the runbook.

| Client / hosts | Current identity and coordinator | Credential location / result |
| --- | --- | --- |
| Pages, abio .21 and vector1 .20 | `admin`, all three | Coolify **Goodwatch Webapp / gk4owk8**, existing runtime `CRATE_USER`, secret `CRATE_PASS`, `CRATE_HOSTS`, `CRATE_PORT`; owner UI only. Both actual containers passed every enforcing endpoint. No UI action required. |
| Search-a/b, vector1 .20 | `goodwatch_search`, all three | `/root/goodwatch/goodwatch-monorepo/goodwatch-search/.env`: `CRATE_USER`, `CRATE_PASS`; staged and rolled a then b before enforcement. Do not overwrite with page copy-env. Both healthy and authenticated. |
| Windmill, 19 containers on 15 hosts; default/highperf/native | `goodwatch_windmill`, all three | Workspace `goodwatch`: `u/Alp/CRATE_USER`, secret `u/Alp/CRATE_PASS`, `u/Alp/CRATE_HOSTS`. No Crate resources exist; clients use these variables. All container checks and both real worker-tag canaries passed. |
| Backup cron, crate-01 .11 | `goodwatch_backup`, all three with failover | Cron `CRATE_BACKUP_USER`, `CRATE_BACKUP_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password`; actual 00:05 scheduled run and actual .11-offline failover passed. `cleanup_legacy.py` shares helper, remains manual/destructive, was not executed. |
| Kuma16–18, hq .10 | `goodwatch_monitoring`, each respective node root HTTP | Stored monitor Basic Auth via supported application interface; all stored credentials tested against every enforcing node, latest heartbeats UP. |
| Scheduled monitoring, sitemap, ingestion/sync | Windmill role and workspace variables | Monitoring and ordinary jobs verified. Nightly language writer retains its first-coordinator design; no maintenance-window run was forced. |
| Manual readonly scripts, all15 hosts | `goodwatch_readonly`; profile .11 default, endpoint probes all three | `/root/.config/goodwatch/crate-readonly.env`, protected `crate-readonly-password`, `/usr/local/bin/gw-crate-readonly`. Installed helper and actual benchmark verified. Manual writers require explicit scoped maintenance credentials; the readonly role intentionally cannot write. |
| crash/Admin UI/one-off SQL, Crate hosts | Trusted local `crate` via container loopback; remote requires a named credential | Local admin checked on all three; unauthenticated remote administration now correctly fails. No password argv. No additional Crate cron found across all15 hosts. |
| Grafana Alloy/node-exporter, all15 hosts | Node/app metrics, no direct Crate SQL/HTTP target found | No Crate credential needed for inspected targets. External Grafana UI datasource settings and dormant operator-local scripts are outside the observed inventory. |

## Residuals and owner actions

The original **46 operation entries / 18 IDs** are gone, but #644's underlying problem recurred: two zero-byte
crate-02 operations (`distributed merge`, `collect`) for ID `ec6c1d3a-e751-cd36-cdbc-39d304289755`, started
**00:01:06.877 UTC**, have no matching `sys.jobs` row. [Receipt](final-context-recurrence.json),
[later sample](final-older-operations-later.jsonl). No further KILL or restart attempted. This is not an auth failure;
all final cluster/client gates passed. Keep #644 open for root-cause work.

No owner action is required to finish password enforcement. Optional future least-privilege page separation:
Coolify UI only, Goodwatch Webapp/gk4owk8 on both .20/.21, set `CRATE_USER=goodwatch_webapp` and secret `CRATE_PASS`
from crate-01 `/root/.config/goodwatch/crate-credentials/goodwatch_webapp` (root0600); preserve host/port settings,
redeploy and verify both app destinations. This was expressly optional and no Coolify setting was changed.
Auth identity/table cut-over and MCP remain separate work. This rollout does not create their tables.

## Final validation and merge readiness

Current main **3b91631c** merged as **a29c52cd**. Crate tests **38/38**, isolated HBA rehearsal **431/431**,
full webapp **2970 passed / 1 owner-waived Qdrant timing failure / 1 skipped / 1 TODO**, production build passed
and821 files precompressed. Auth/Crate source hashes remained unchanged through the main merges.
[Validation summary](validation-final.txt). The authorized PR merge follows this completed record.

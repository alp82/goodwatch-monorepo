# Production retry — live handover, not final

Owner go: 2026-10-14T20:47:56Z. Target: pinned CrateDB 5.10.16. Same owner restore-validation waiver; no restore drill was performed. Hard cutoff: 2026-10-15 02:30 UTC. No auth user, app code/config, HBA, firewall or table-setting change is authorized.

## Current state

- crate-01 / 10.0.0.11: 5.10.9, original process/image/env untouched; administrative coordinator and elected master.
- crate-02 / 10.0.0.12: pinned 5.10.16, original identity/volume/config retained, restart always; all 91 GREEN / 932 STARTED and 21 passing checks plus 18 source-client reads passed at 21:13 UTC. Its window captured 198 FAILED query lines in the webapp, zero in both search containers.
- crate-03 / 10.0.0.13: original 5.10.9 process still live after successful decommission SQL acknowledgement at 21:29:13.435795 UTC (878.374 seconds). Zero primaries; original process reports delaying graceful shutdown for active work. No target process on this node has started. The process must exit normally before target startup.
- crate-03 env is staged to the target, original container restart policy is temporarily no; allocation remains transient primaries. Explicit graceful-stop timeout is transient 2h, matching effective baseline; force=false and PRIMARIES unchanged. Administrative HTTP timeout is 7,500 seconds, outer SSH 7,530.
- Latest observed shard state: 931 STARTED copies and one unassigned replica, zero missing primaries. No server graceful abort or timeout was logged in the captured sample. The sampled sys.jobs view showed only the observer query; internal context identity is unproven.

## Safety artifacts

Fresh snapshot `goodwatch-db-backup-v2.pre_auth_547_20261014204756` succeeded in 22 seconds; requested 20:54:11.324 and verified 20:54:52.282 UTC. Eighteen BLOB files were SHA1/size verified and retained under `/root/cratedb-maintenance/547-20261014204756/blob-artifacts` on crate-01. Protected per-host before-env/Compose/runtime backups use the same maintenance directory on staged hosts. Old images are retained.

One owned maintenance row was inserted in existing doc.workflow_monitoring: key `maintenance_auth_547_20261014204756`, kind maintenance_probe, pipeline auth-prereqs. It was absent before insertion; current payload is crate02-up. Acknowledged writes/readbacks passed with crate-02 down and again through all endpoints after target startup. Clean up only this owned row at final verification; never touch member/auth rows.

## Resume/abort discipline

Do not send another decommission or recreate a live target. Current original request acknowledged success; wait for actual crate-03 exit, inspecting Docker status and the source/runtime evidence. No signal, forced stop or job cancellation is authorized. The server separately waits for active contexts after SQL acknowledgement for up to its configured two hours. Stop on a genuine failed gate/server abort.

For pre-target abort, restore crate-03 `.env` exact bytes/mode/owner from its protected `.env.before`, restore restart always, restore effective allocation all through a survivor, and inspect original decommission/exit state. If the original container exits, start its retained original image/volume under restored configuration; do not recreate on a new volume. The runbook requires investigating a live decommission before any restart. Do not downgrade the already successful crate-02 automatically. Require all three nodes GREEN/STARTED and all checks passing before declaring a clean stop. Do not RESET GLOBAL unknown setting layers; retaining transient baseline all / 2h is documented compensation.

Before any further node, reserve both documented two-hour server waits plus 30 minutes for recovery/postchecks before 02:30 UTC. No further decommission begins after 22:00 UTC. If the current node completes later, safely recover it to GREEN/STARTED, stop with exact mixed versions and report, without touching the final node.

## Client finding and evidence

The bounded read-only investigation completed in under seven minutes before production mutation. Actual installed node-crate 3.0.0 rotates statement coordinators .12, .13, .11, with no generic connection-error retry or host eviction. All inspected clients configured CRATE_HOSTS=.11,.12,.13, port 4200; wrapper default timeout 10 seconds. Historical per-failure host was not logged, so individual attribution is inference. Member catalog/search/data requests can fail/slow during a drain; lost write responses can be ambiguous. No app change is being made by this operation.

External webapp replacements continue. Incremental line-hash sampling retains earlier container counts; continuous read-only log followers were added during the crate-03 window to retain tails through later removals. Union hashes at final reporting; report captured minima where removed unsampled tails prevent a complete audit. Counts are SQL FAILED lines, not unique HTTP/member requests. Never commit raw SQL/parameters.

The local watcher first misclassified expected gateway expected-node warning 1 during the planned two-node phase; exact severity/description were inspected. All other checks remain mandatory and all 21 must pass after three-node rejoin. The first recreate helper compared mount-array order; repeated Docker inspections proved order varies and full canonical mount objects/config were identical. Corrected only local verification; no real acceptance gate was waived or production setting changed. See the dedicated evidence files.

## Required final handover

Finish every authorized step that remains possible within the window, or cleanly stop. Update this file and the main runbook with actual final versions, gates, snapshot/backup timing, per-node FAILED line counts and caveats. Commit/push to auth/cratedb-prereqs, never main; post the full outcome on #547; keep #547 open because auth-user work waits for #562. Do not merge.

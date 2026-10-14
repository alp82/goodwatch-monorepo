# Production attempt with restore-validation waiver — 2026-10-14

**Outcome: ABORTED before any 5.10.16 process started; clean-stop verification: PASSED.** Do not resume this attempt automatically. Target remains 5.10.16; actual running versions are crate-01 / crate-02 / crate-03 = 5.10.9 / 5.10.9 / 5.10.9.

The owner authorized the upgrade at 18:29:59 UTC and waived only restore-validation pre-check 3 at 18:46:29 UTC for this patch. Restore remains unvalidated. The snapshot, remaining pre-checks and per-node health gates were mandatory. User creation, HBA, firewall and table-setting changes were explicitly excluded.

## Timings and actions (UTC)

| Time | Action/result |
| --- | --- |
| 18:46:29 | Owner restore-validation waiver; live pre-checks rerun: 3 nodes at 5.10.9, 90 health rows GREEN, 920 copies STARTED/STARTED, 21 checks passed; exactly two copies of all 460 logical shards. |
| 18:57:03.721–18:57:30.939 | Named snapshot CREATE request completed in 27.218 seconds, serialized with existing backup lock. SUCCESS verified at 18:57:50.001. Repository metadata records finish 18:57:29.348. |
| 19:01:19–19:02:06 | Pulled the pinned official 5.10.16 image on all three hosts; retained original images. No target container started. |
| 19:06:11 | Only crate-02 staged: protected original .env/Compose/runtime backups, changed image reference only, suppressed restart policy to no. |
| 19:07:17.578 | Set transient allocation to primaries through crate-01. |
| 19:07:23.241 | Issued ALTER CLUSTER DECOMMISSION once for crate-02 ID r0IgCe17SPOgudkQIGsRQA through crate-01. |
| 19:07:53.261 | **First failed gate:** the operator helper's incorrectly short 30-second HTTP timeout expired. Stopped rollout; the server-side drain continued. |
| 19:09:23–19:09:28 | Restored crate-02 .env exact bytes/mode/owner and restart always; restored allocation all. Did not retry decommission or start another upgrade node. |
| 19:41:10.567 | Original observer reported all 920 copies STARTED/STARTED and original decommission SQL job absent. This was not proof of direct SQL readiness or daemon exit. |
| 19:42:09.971–19:42:16.365 | Original-image crate-02 recovery restart, normal SIGTERM and unlimited grace, 6.394 seconds; retained container/image/mounts. Docker events show original daemon had not exited automatically beforehand. |
| 2026-10-14T20:14:39.864490+00:00 | Three-node GREEN/STARTED abort gates passed. |

## Snapshot and retained recovery artifacts

Named safety snapshot: **goodwatch-db-backup-v2.pre_auth_547_20261014184629**, SUCCESS. Existing repository and cron were unchanged. Backups exclude BLOB tables: downloaded and verified SHA1/size for 18 unique files (126,677,290 bytes) referenced by two complete search manifests. Copies, manifests and protected configuration backups remain under `/root/cratedb-maintenance/547-20261014184629` on the relevant hosts; BLOB files are on crate-01 in `blob-artifacts/`. These are retained safety artifacts; no restore was attempted or validated.

Scheduled backup `goodwatch-db-backup-v2.hourly_20261014_200501` also succeeded: started 20:05:01.316, finished 20:06:49.485 UTC (108.169 seconds). The pre-upgrade snapshot and this scheduled backup predate the externally created table noted below.

## Operator errors and client observations

The operator used a 30-second timeout for a production decommission that can wait two hours for relocation; that caused the abort. The HTTP timeout did not cancel the server statement. The original job was monitored rather than retried/killed. Before consuming the original observer's all-STARTED result or probing direct SQL readiness, the operator selected an old-image restart after confirming crate-02 held zero primaries. That readiness check should have preceded the decision. Normal SIGTERM was used, with no SIGKILL/forced timeout. Restart then required replica recovery and rebalancing before the clean-stop gate.

Actual .20 application Docker logs show 1,962 failed Crate-query log lines in `gk4owk8-20261014T181405` (19:07:44.504–19:42:29.073), 5,341 CrateTimeoutError occurrences; search-a had one failed-query line at 19:15:19.584 and three timeout occurrences; search-b had none. Baseline had none. **These are log occurrences, not unique failed user requests.** No further failures were observed in the old webapp/search logs from 19:43 through the retained audit at 20:02:09 UTC, or in current-container logs audited at 20:14:39 UTC. The webapp was replaced externally at about 20:11 and again 20:14; the original container was removed. Its logs after 20:02:09 are therefore not covered by a continuous retained audit. Historical counts are preserved separately from replacement-container logs, rather than reset to zero.

All 18 final direct SQL reads from six native-source containers (three Windmill workers, webapp, search-a, search-b) through all three private endpoints succeeded. Direct probes prove endpoint reachability/readability, but did not prove native-client failover when a drained coordinator disables SQL. No missing primaries were observed during the abort. An approved maintenance write probe was planned but not executed because the first drain gate failed; no production DML probe row was created.

An additional exploratory read-only audit of settings['cluster']['decommission'] returned ColumnUnknownException/404 because that field is not exposed. No statement in that query changed settings; the existing graceful-stop settings remain PRIMARIES / false / 7200000ms.

## Final configuration and firewall

Final independent health gates passed through all three private endpoints at 2026-10-14T20:14:39.864490+00:00: 91 GREEN health rows, 932 STARTED/STARTED copies, no missing/underreplicated/initializing/relocating copies, all 21 checks passed, allocation all, original decommission job absent. Original images, command/HBA flags, environment, Compose files/rendering, mounts, private bindings and restart always matched the pre-run capture on all hosts; no OOM was observed. Final 18 reads also passed after the external webapp replacement, at 2026-10-14T20:16:11.453019+00:00, with endpoint latency 6.753–132 ms. Full verification completed at 2026-10-14T20:17:24.772585+00:00, well before the 2026-10-15 03:00 UTC cutoff.

Firewall inventory remains the documented private bindings on 10.0.0.11–13 ports 4200/4300/5432. Docker forwarding bypasses UFW INPUT; private destination binding is the observed boundary, not an independently enforced private-source allowlist. UFW/reconciler timers remained active. Legacy/generated rule-comment gaps are documented in the runbook. No firewall/HBA/auth changes were made. goodwatch_auth remains absent pending #562; all 120 captured non-system table metadata rows/settings match before/after.

Allocation is restored to effective baseline all. The transient all override remains because persistent/transient provenance was not established; RESET GLOBAL would risk removing an earlier persistent override. This is documented compensation, not a claim that settings layers are byte-identical.

## Cloud handover

Runbook: docs/implementation/auth/cratedb-prereqs.md. Evidence: this directory. Branch: auth/cratedb-prereqs. No merge or main push. #547 stays open: the upgrade and dedicated user are incomplete. Before another owner go, review native-client coordinator routing/drain/failover and correct administrative timeouts; do not mutate client configuration or resume from this failed attempt automatically. The owner restore waiver applies only to this patch upgrade and does not establish restore safety; it does not authorize resuming after a failed gate.

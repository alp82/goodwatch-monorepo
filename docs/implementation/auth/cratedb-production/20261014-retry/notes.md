# Production retry outcome — 2026-10-14T23:10:25.234990+00:00

**PARTIAL UPGRADE, ABORTED AND CLEANLY STOPPED.** Only crate-02 was upgraded to pinned **5.10.16**. Actual versions: crate-01 / 10.0.0.11 **5.10.9**, crate-02 / 10.0.0.12 **5.10.16**, crate-03 / 10.0.0.13 **5.10.9**. Crate-01 was never staged/decommissioned/restarted. No target process started on crate-03. Do not resume automatically; #547 stays open.

The owner go was 2026-10-14T20:47:56Z, retaining only the patch-specific restore-validation waiver and requiring finish/clean stop before 2026-10-15 02:30 UTC. No auth user, app code/config, HBA, manual firewall or table-setting changes were made by this operation. User creation waits for #562. Restoration remains unvalidated.

## Genuine failed gate and safe stop

At **22:24:55.948868 UTC**, the watcher observed unexpected new tables **doc.episode_translation** and **doc.season_translation**. This operation did not create them; actor unverified. The rollout stopped before target startup on crate-03. Both tables were retained unchanged; their creation metadata is **5.10.9**. Captured segment min-Lucene versions varied by hosting binary, so those metrics were not mistaken for table creation versions. The separately documented final-node cutoff reserve had already prevented any further decommission after 22:00.

Crate-03 original env bytes/mode/owner/rendering and restart always were restored at 22:25:31.945, allocation all at 22:25:33.457. Before choosing original-image recovery, all 93 current health rows were GREEN and all 956 copies STARTED, crate-03 held **zero primaries**, sampled SQL jobs were only current observer queries, and its direct SELECT 1 endpoint still timed out. Decommission SQL had acknowledged success, but the daemon still reported active work; internal context identities were not established.

The same retained original crate-03 container/image/volumes were restarted for **abort recovery**, using **normal SIGTERM with unlimited grace**, 22:28:16.707–22:28:25.740 (**9.033 seconds**). Docker events confirm signal 15, exit 143, no SIGKILL. No SQL KILL or graceful-stop force setting was used. This was not a forced upgrade. Original node identity was preserved and 5.10.9 rejoined; the successful crate-02 was not downgraded.

An early exploratory client probe saw a startup 404 before rejoin; later actual-source probes all passed. The final replica replay/rebalance completed at **22:42:56.465 UTC**. Independent gates through all three endpoints passed at 22:43 UTC: **93 GREEN rows, 956 STARTED/STARTED copies, all 21 checks passed**, no missing/underreplicated/initializing/relocating shards. Health was rechecked after the new scheduled backup at **2026-10-14T23:09:54.634129+00:00**. All 18 reads from three Windmill workers, current webapp and both search containers through every endpoint passed. No missing primaries were observed during this attempt.

## Timings and backup evidence

| UTC | Result |
| --- | --- |
| 20:48–20:53 | Bounded read-only client investigation; completed in under seven minutes before production mutation. |
| 20:54:11.324–20:54:33.324 | Fresh named safety snapshot CREATE request, **22.0 seconds**; SUCCESS verified 20:54:52.282. |
| 20:56:27 | Explicit dynamic graceful-stop timeout set to **2h**, same effective baseline; force=false and PRIMARIES unchanged. HTTP wait **7500 s**, outer SSH **7530 s**. |
| 21:04:02.920 | crate-02 decommission acknowledged after **224.911 s**; original process exited normally 21:04:11.292. |
| 21:06:05.743 | crate-02 target process started on pinned official digest, retaining identity and data. |
| 21:13 UTC | crate-02 passed all health/runtime/client gates before advancing. |
| 21:29:13.436 | crate-03 decommission acknowledged after **878.374 s**; actual process exit remained pending. |
| 22:24:55.949 | Unexpected external-table gate failed; rollout aborted. |
| 22:28:16.707–22:28:25.740 | Original-image crate-03 abort recovery restart, 9.033 s. |
| 22:42:56.465 / 22:43 | Settled cluster observed / independent endpoint gates confirmed. |
| 22:44:07.833 | Exactly one owned monitoring probe row removed after three-endpoint readback; absence confirmed through every endpoint. |
| 2026-10-14T23:05:01.979000+00:00–2026-10-14T23:05:22.395000+00:00 | Post-stop scheduled **hourly_20261014_230502 SUCCESS**, includes both newly observed external tables. |

Named safety snapshot: **goodwatch-db-backup-v2.pre_auth_547_20261014204756**, SUCCESS. Snapshots exclude BLOB tables: **18 unique files / 126,677,290 bytes**, SHA1 and size verified against two complete manifests, remain protected under `/root/cratedb-maintenance/547-20261014204756/blob-artifacts` on crate-01. Per-host original env/Compose/runtime backups use that protected maintenance directory. Original images are retained. Existing repository, cron and retention code were unchanged. Earlier hourly_20261014_220501 also succeeded, finishing 22:06:21 UTC; it and the named snapshot predate the external tables. No restore drill or destructive recovery was performed.

## Client diagnosis and counted impact

Actual inspected clients configured CRATE_HOSTS=.11,.12,.13, port 4200. Installed node-crate **3.0.0** selects SQL coordinators round robin, initially **.12, .13, .11**, with **no generic connection-error retry or unhealthy-host eviction**. The wrapper default is 10 seconds. Crate-02 was one configured coordinator, including the first choice for a new pool. Historical per-query destination was not logged, so individual failure attribution is inference. A member request can issue multiple SQL statements; one-in-three selections does not imply one-in-three members. Distributed queries can also fail when their coordinator survives. No app change was made to hide or repair this behavior. Lost write responses can be ambiguous; only existing readback/replay safeguards apply.

| Node window | Captured webapp FAILED query lines | Search-a | Search-b |
| --- | ---: | ---: | ---: |
| crate-02 | **198** | 0 | 0 |
| crate-03, including abort recovery | **4207** | 0 | 0 |
| crate-01 | Not attempted | — | — |

Crate-02 first/last observed failure: 21:00:35.452–21:06:18.305. Crate-03: 21:15:00.094–22:28:40.097. No later failures were captured through the final client window. These are **SQL log occurrences, not unique member/HTTP requests**. External app replacements continued; per-container counters were retained, and sampled/continuous-reader hashes unioned without double counting. Removed unsampled tails before followers attached can be missing, so counts are captured minima. No raw SQL/parameters were committed. Log followers/observers were stopped; a read-only process check found no matching leftover followers.

One owned row in existing doc.workflow_monitoring (key maintenance_auth_547_20261014204756, kind maintenance_probe, pipeline auth-prereqs) was absent before creation. Its acknowledged writes/readbacks passed while crate-02 was absent and after target rejoin, and its last payload crate02-up was retained through abort recovery on every endpoint. Cleanup removed exactly that row with key/kind/pipeline guards; all endpoints confirmed absence. No real auth/member rows were mutated.

## Configuration, firewall and operator verification corrections

All baseline runtime command/HBA flags, effective service env, data/backup mounts, private ports, limits, logging and restart always were compared. Only crate-02 image reference/binary changed as intended. All baseline table settings remain identical; the only added identities are the two external tables. goodwatch_auth remains absent. Effective allocation all and timeout 2h are restored/retained; their transient overrides remain to avoid RESET GLOBAL erasing unknown persistent layers.

Crate 4200/4300/5432 bindings remain private 10.0.0.11–13; worker firewall timers are active. Original read-only firewall inventory showed Docker forwarding bypasses UFW INPUT: private destination binding is the observed boundary, not an independently enforced general private-source ACL. Legacy/generated owner-comment gaps remain documented. No manual firewall changes; provider/external reachability was not independently tested.

Two local verification defects were corrected with read-only evidence: node-check 1 warns about expected data count 3 only during a planned two-node phase (all checks remain required at three-node gates); Docker mount arrays vary in order, so full mount objects were compared canonically. No real gate was waived or production setting changed for either correction. The earlier 30-second administrative timeout cause was fixed: this attempt's long decommission calls both completed successfully. Actual daemon exit remains an independent gate.

## Cloud handover

Runbook: docs/implementation/auth/cratedb-prereqs.md. Evidence: this directory, especially outcome.json, client-failure-summary.json, configuration-comparison.json and final endpoint/backup records. Branch auth/cratedb-prereqs; no merge/main push or PR creation. Remaining upgrades on crate-03 and crate-01 require **new owner go**, coordination with concurrent schema work and a reviewed actual-exit/active-context plan. Do not continue from the aborted stage automatically. Auth-user preparation remains excluded pending #562; restore waiver is patch-specific and did not establish restore safety.

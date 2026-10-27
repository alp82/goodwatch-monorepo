# Q64 rolling upgrade execution — October 27, 2026

**Stopped at the first post-node gate. Only crate-02 was upgraded, to 6.0.8.**
Crate-01 and crate-03 remain on 5.10.16. No further node stop, rollback, in-place downgrade,
decommission, drain, replica reduction, KILL or second restart was performed. The cluster recovered
145 GREEN tables and all 1,175 original copies STARTED. This is a mixed-version incident handover,
not a completed hop or an instruction to resume automatically.

Owner GO referenced `4e41ba973` and Q53/Q55/Q58–Q63, with the 23:00–04:00 UTC window. Started from
fresh `origin/main` `d505494ac52ff7ee636614b9a6da0637796fd119`, branch
`fix/644-q64-rolling-upgrade-execution`; approved runbook bytes matched that revision. The owner's
main checkout was not changed. Private working records are under `~/.cache/gw-work/644-q64`.

## Why progression stopped

At **23:28:13.337 UTC**, the after-node gate found a failed `sys.checks` row on crate-02:
**ID 3, severity 1**, saying that the listed tables need recreation for compatibility with
**future major versions**. The 5.10 coordinators reported no failed checks, and every node had no
failed `sys.node_checks`. All inventoried tables were created on 5.10.9 or 5.10.16, not 4.x.
The check describes a future-major advisory; it does not establish unreadable tables on 6.0.
The execution gate required zero failed checks and stopped rather than waiving that condition.
The earlier review/rehearsal did not distinguish this expected new-major advisory in the gate.
Do not infer that all 145 tables must be reindexed before this particular upgrade merely from
this warning. Any revised gate needs explicit review before a new GO.

**A separate, unresolved mixed-version policy discrepancy appeared during restoration.**
After acknowledged block/RESET/SET/unblock statements restoring YepWatch waits to 3, crate-01/03
report the original policy, but crate-02 continues reporting wait 2. It also did not report the
brief block while the 5.10 coordinators did. Re-reading later and executing the same approved
restoration for `yepwatch_agreement` through crate-02 did not resolve the disagreement. The
restoration SQL completed for all 14 tables; all coordinators report no remaining write blocks.
This is **not verified full restoration**. No write canary was used to infer the actual enforcement.
Distinguish a stale SQL/table-metadata view from underlying shard/index behavior before more changes;
no cause is established here, and no cache reset, table close/open, allocation manipulation or extra
restart was attempted. This discrepancy was not found in the local rehearsal.

The first failing gate's event and `after-608-02.log` are preserved. A concurrently running app
canary overwrote the sticky failure file with its own BLOB error several seconds later; neither
alarm was cleared and no next node was admitted. The first BLOB probe used automatic cross-host
redirects, which discarded HTTP credentials and produced 401. An allowlisted internal redirect
probe preserving credentials then passed HEAD/GET and SHA1 through all three coordinators using
the deployed search account. That was a probe correction, not a production permission change.
Q55's schema grant was **not** executed, since homogeneous 6.1.6 was never reached.

## Gates, preparation and timing

| UTC | Observation/action |
| --- | --- |
| 22:45:51 | Fresh gates and Q60 watcher began. Expected three 5.10.16 nodes, 145 GREEN, 1,175 STARTED, no moving copies, no active snapshot, no active deploy/maintenance found at entry. |
| About 22:54 | Exactly nine approved schedules disabled; full original configuration preserved privately and sanitized hashes retained. Fresh queue had 68 entries/17 running, none of the nine held heavy paths running. Light work left running. |
| 23:01:51 | Backup cron held using the exact Q37 named-file helper. Latest scheduled snapshot `hourly_20261027_220501` was SUCCESS, 567 shards, no failures. |
| 23:02:12–23:02:34 | Protected `q53_pre6_20261027` snapshot completed SUCCESS, 567 shards, no failures; verified on all coordinators. |
| Before first node | Verified shared BLOB SHA1 copy, private config backups, genuinely shared new repository path, old registrations read-only, pinned 6.0.8 image on all hosts, 14 waits lowered to 2, unchanged replicas. Full ten-minute <80% heap entry gate passed. |
| 23:17:16 | Final all-coordinator pre-stop gate passed; allocation primaries, rebalance none; all copies still STARTED. |
| 23:18:10.936 | Normal unlimited-grace SIGTERM stop dispatched for crate-02 via `gw-q53-608-02`. |
| 23:18:16.353 | Normal exit 143, PID 0, no OOM: about 5.4 seconds after dispatch. |
| 23:20:21.904 | Replacement started on pinned 6.0.8 with the same data volume and original memory/heap/HBA/network/ports; only approved repository mount/allowlist added. About 125.6 seconds between exit and new start, including operator verification. |
| 23:21:24.748 | Original persistent node ID seen directly and via survivor; allocation restored all at 23:21:25.672. |
| 23:24:06 | Recovery verification completed: 145 GREEN, all 1,175 routing copies STARTED, every node's own physical copies STARTED. Dispatch-to-verified-recovery about 5m55s. |
| 23:28:13 | Post-node gate failed on advisory check 3; progression ended before crate-03. Two-minute heap gate had passed (maxima about 61.1%, 32.6%, 65.5%). |
| 23:28:54 | Nine schedules restored exactly, with no explicit replay/catch-up; cron restored byte-for-byte. |
| 23:31:22 | Original wait-3 restoration statements completed; crate-02's readback discrepancy remains. All temporary write blocks removed. |

The transient stop unit explicitly dispatched `TimeoutStopSec=infinity`, `SendSIGKILL=no` and
`docker stop --timeout=-1`. It completed and was garbage-collected before `systemctl show` was
read. Its subsequent `LoadState=not-found` defaults (90 seconds/SendSIGKILL=yes) are **not** the
properties of the dispatched unit; the normal successful journal completion and Docker exit were
checked before replacement. Capture live unit properties immediately on any separately approved
future stop, as well as keeping the literal dispatch receipt.

Entry schema review accounted for 14 explicit `blocks.write=false` DDL renderings from the approved
morning restoration, and the current-main nullable `crawl_priority.last_opened_at` addition. No
replica/creation-version drift was waived. The Windmill credential probe's initial URL-shape
assertion happened before SQL: its actual configuration uses valid bare host:port values. Correctly
normalized cold reads then passed on all three nodes; missing/wrong passwords returned 401.

The fresh entry deploy gate passed, but later app-canary container names/images show webapp/API
deployments during this window (23:19–23:27). These were not initiated by this operator. A resumed
maintenance window needs a deploy hold owned by the deployment operator, not just an entry-time check.

## Watcher coverage and member impact

Across **1,310 recorded probes**, every page/discovery response was 200 and MCP was the expected401;
there were **zero observed unexpected responses, transport failures or >3s probes**. Maximum recorded
latency was **2.368074s**. Final resumed probes were normal through23:33:57; handover cutoff is
**23:33:58.436 UTC**. These observations do not establish uninterrupted service through the gap below.

**Operator error caused a monitoring gap during restoration.** At23:28:37 the cleanup set an unsupported
phase `handover-restoration`; the watcher exited on its next round and wrote a sticky
`{"monitor_error":"ValueError"}` abort marker. Last valid sample was23:28:31.505; the failure was
detected at23:33:04, the watcher restarted with valid phase `recovery`, and observations resumed
23:33:17.336. The abort marker was retained. Progression had already stopped on the system-check gate,
but restoration SQL continued during this unmonitored interval. This did not meet the continuous-watcher
requirement; no claim of zero member-visible errors is possible for that interval. No additional node
was stopped after either failure. The resumed watcher was for handover observations only and was
stopped last, along with the local heap collector. No upgrade process remains armed.

Completed-job history was paginated for failures ending between22:45:00 and23:33:58.436 UTC, including
children and jobs started before the gates: **zero failed/errored Windmill jobs found**. No reruns.

## Protected rollback artifacts and backup handover

- Snapshot is now **`goodwatch-pre6.q53_pre6_20261027`**, original path `/snapshots/v2`, read-only,
  `compress=true`. The legacy `/snapshots` registration is also read-only with compress preserved.
  DROP/CREATE REPOSITORY only changed registrations; no snapshot or repository files were deleted.
- BLOB rollback target: `/mnt/backup-cratedb/q53-pre6-20261027/blob`, **38 unique SHA1 objects,
  271,593,347 bytes**. All 21 references from the three saved build rows verified with expected lengths;
  SQL build metadata unchanged across the copy. Private config backups on hosts 11/12/13/20/21 are
  `/root/.config/goodwatch/q53-pre6-20261027/`; do not publish credentials or restore old image pins over
  the upgraded data directory.
- New shared host path `/mnt/backup-cratedb/snapshots-v6` passed cross-host and JVM-UID write/read
  checks. Only crate-02 has the new container mount/allowlist so far. The new writer registration
  `goodwatch-db-backup-v2` was deliberately **not created in this mixed cluster**. The shared proof
  file is retained; no dataset cleanup was attempted.
- Cron restored exactly from `/root/.config/goodwatch/644-q37-20261027T230151Z`:
  SHA256 `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`.
  The latest GO explicitly requested cron restoration at handover; this takes precedence over the
  runbook's early-mixed-stop advice to keep it held. **Restored cron does not mean working hourly
  backups:** its hardcoded V2 writer registration is absent. The next 00:05 UTC run is pending and
  expected unable to create a snapshot until a separately approved compatible writer route exists.
  Do not point 6.x writes at the protected 5.10 repository. The last verified recoverable point is
  the protected 23:02:34 snapshot plus BLOB pair; the RPO loss window continues to grow.
- No rollback occurred; Q61 accepted loss since the protected snapshot only if a restore is later
  approved. The owner retained the morning rollback decision under Q62.

## Final state, evidence and next decision

See [final summary](q64-summary.json), [receipts](q64-receipts.json.gz),
[page watcher](q64-pages.jsonl.gz), and [failed Windmill jobs](q64-windmill-failures.json).
The summary records the exact final probe range/counts, monitoring gap and all-coordinator health/policy comparisons.

| Item | Handover |
| --- | --- |
| crate-01 | 5.10.16, original PID/container, Docker always |
| crate-02 | 6.0.8 pinned `sha256:7b6af0abb4792123cfa225c8186471bbe81e039ef336af33095a181f4e8c17bf`, same node ID `r0IgCe17SPOgudkQIGsRQA`, new PID 3196234, Docker always with durable Compose pin/override |
| crate-03 | 5.10.16, original PID/container, Docker always |
| Allocation/rebalance | all / none, no exclusions or decommission change |
| Policies | Replicas/durability unchanged; waits restored in SQL and confirmed on 5.10 nodes, still reported 2 on crate-02 for 14 YepWatch tables; no write blocks remain |
| Jobs/cron | Exactly restored; no catch-up or failed-job rerun requested |
| Remaining hops | First hop incomplete; no 6.1/6.2/6.3/6.4 node started |
| Shard locks | No `ShardLockObtainFailedException` in new crate-02 JVM logs; final rebalance/placement test **not reached**, so lock clearance remains unproven |

Mixed-version `sys.shards` observations can duplicate rows and operation counts differ by coordinator.
The retained table/shard spot checks therefore cannot replace allocation routing plus each node's own
physical-copy checks, nor prove an orphan count. No new lock-removal claim is made from those counts.

**Recommended next owner decision:** authorize read-only diagnosis of the mixed table-policy view,
review check-3 handling, and choose a compatible backup-writing route before any new upgrade GO.
Do not automatically finish the hop to hide a failed gate; do not downgrade crate-02's data. An immediate
continued-upgrade or restore decision is outside this stopped execution; the owner retains it.

Validation is live read-only cluster/routing/policy checks, actual deployed app/search/YepWatch catalog/auth
cold reads, authenticated BLOB HEAD/GET/SHA1 through all coordinators, correct/missing/wrong worker-auth
reads, exact schedule/cron restoration, Docker runtime checks, watcher and complete failed-job history.
No fake production writes, restore drill or final placement test were run. No application source changed;
webapp test/typecheck and flow pytest suites were not rerun for this operational evidence-only commit.

# October28 immediate rolling-resume GO — stopped at workload entry

Owner replaced the next-night start with an immediate GO around00:51UTC, ending04:00UTC. Freshmain
**658edc8bb** had the exact approved`cdf4e7e1e` runbook bytes (SHA256
`db2dd28322abae505722d64ca739c6d3fa55ee035aff2d3fb5ecb5369383c79a`). Branch:
**fix/644-immediate-rolling-resume**. No owner checkout modification.

**Stopped at the first schedule/queue gate, before any production mutation.** Queue read at00:52UTC
contained65 jobs/14 running;56 schedules/53 enabled. One of the nine designated maintenance holds
was already running:

| Item | Live observation |
| --- | --- |
| Job | `f/tmdb_api/provider_detector` |
| ID | `01a17fb1-feb6-c0d2-651f-9ab682b96648` |
| Started | **2026-10-28 00:00:00.040195UTC** |
| Rechecked | **00:52:55.311UTC**, stillrunning/notcanceled, scriptjob |
| Argument | **mode=shadow**; no claim that it is publishing Crate changes |
| Progress |21loglines, no usable whitelisted numeric counter; total/percent/ETA unknown |

The source's current default runtime budget is3600seconds, but the running job's pinned deployed
code/defaults and actual completion were not assumed; **01:00 is not a promised completion time**.
Raw logs, arguments/resources and job results were not written to evidence; only selected nonsecret
mode/status/identity and numeric-progress fields were retained.

Gate interpretation: this active script is among the nine approved window holds, so it was treated
as incompatible active work without a provider-detector waiver. Shadow mode is relevant for an owner
decision; it is **not** evidence of Crate publication or measured overload. The current runbook's
[Q58 job-hold section](../../../crate-6-upgrade.md#q58--exactly-nine-approved-windmill-job-holds) says:

> Any incompatible active work or other failed gate triggers Q62 rather than an unapproved cancellation or additional hold.

No permission was inferred to cancel it, change its arguments, waive this gate, pause other work or
keep retrying after the first stop. The earlier Q50 workload waiver did not cover provider_detector.
A fresh owner GO can explicitly allow this active shadow job, or follow its actual completion;
**neither route is armed here**, and the former next-night plan does not start automatically either.

## Read-only handover state

Supplemental SELECT checks throughall3 coordinators confirmed:

- **crate-01 5.10.16; crate-02 6.0.8; crate-03 5.10.16.** No replacement attempted; no node timing toreport.
- **145 GREEN,1175STARTED**, allocationall/rebalancenone onall coordinators.
- Working V2 registration unchanged:fs`/snapshots/q65-mixed-20261027`,compress=true,readonly=false.
  Protectedpre6 remainsfs`/snapshots/v2`,compress=true,readonly=true.
- `hourly_20261028_000501` SUCCESS,567shards/no failures, finished00:13:19.969UTC;
  `daily_20261028_000501` SUCCESS,567/no failures, finished00:13:32.179UTC; agreement onall3.
- Completed Windmill failures from **00:51:51 through00:54:39.926UTC**: **zero**, including child jobs
  and failures of jobs started beforegates. No reruns.
- No snapshot/protection/BLOB copy, schedule change, cron hold, setting change, stop/start/decommission,
  replica or wait change, grant, KILL, cancellation or restore was executed. **Nothing required restoration.**
- Watcher and heap-history/full entry gates were **not started** after this first workload stop, so no
  fresh watcher-error/latency claim is made. No background monitor or upgrade process remains armed.
- Final crate-02 rebalance/lock test was not reached; lock clearance remains unproven. No rebalancechange.

[Summary](20261028-immediate-resume-workload-stop.json),
[sanitized queue/schedule/job/cluster/failure evidence](20261028-immediate-resume-workload-stop.json.gz).

Validation: live queue and direct job status/mode agreement; all-coordinator versions/health/copies/
repositories/backup agreement; complete failed-job pagination for theattempt; JSON/archive/credential-
pattern/local-link and diff checks. No app source changed; application suites/typecheck and flowpytest
were not rerun for an evidence-only first-gate stop. No push, issue comment or future action scheduled.

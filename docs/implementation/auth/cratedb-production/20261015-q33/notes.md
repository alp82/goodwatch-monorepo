# Q33 last-node production upgrade — in progress

Owner Q33 authorized crate-01 to pinned 5.10.16, under the existing patch-only restore-validation waiver. No HBA, auth user/tables, app/config, manual firewall, table-setting or member-data probe changes. Known concurrent tables accepted; only genuine health/recovery/decommission failures abort. Q33 supersedes the previous deadline/maintenance holds.

Live baseline: 94 GREEN rows, 958 STARTED copies, all 21 checks; 479 logical shards each on two distinct hosts. Original IDs retained; master crate-01 last. PR #604/#607 code verified on all four bundles: original pages f4be666b are descendants of 02b3ca5b; search-a/search-b exact 02b3ca5b.

Fresh named snapshot **goodwatch-db-backup-v2.pre_auth_547_20261015190551 SUCCESS**, CREATE **13.659s**, 2026-10-15T19:09:24.574674+00:00–2026-10-15T19:09:38.233692+00:00. Existing backup lock serialized creation. 18 unique BLOB artifacts / 126888186 bytes checksum-verified, retained under protected /root/cratedb-maintenance/547-20261015190551/blob-artifacts on crate-01. Env/rendered Compose/runtime before copies protected there; old images retained.

Before drain, 3-node GREEN/STARTED gates repeated and effective graceful settings verified PRIMARIES / force=false / timeout2h. Crate-01 staged with only image pin changed and restart temporarily suppressed. Allocation primaries; decommission exact ID xlclgwGeSHe18p5J4WvfFA through crate-02 with 7500s HTTP / 7530s outer SSH. Pending actual acknowledgement and normal process exit before target startup. Read-only health observer captures every current table without treating known/concurrent schema identities as failures.

## Client collection and concurrent deployment

Public GET probes cover home, movie, show, person, related panel and palette. Full ranked search API writes history/may start paid work, so no synthetic full search was issued in upgrade-only scope. Real catalog events are recorded separately; palette success does not establish uncached catalog failover.

An external automatic deployment replaced both pages with a9aa22e8 during the drain. Search stayed on 02b3ca5b. This operation did not deploy or change clients. Vector1's original page was followed before removal, retaining its redacted events; both new page logs are recovered from window start. The ABIO host uses older Python without dict-union support: the first observer thread failed, corrected to dict.update and reattached. The old ABIO f4be container/logs had already been removed by the concurrent deployment, leaving a coverage gap between its baseline sample and removal. A bounded read-only local log-drain check attempts recovery without querying Axiom or retaining raw logs. **Full-window counts must be labeled captured/minima, not complete zeros**. Retained structured events deduplicate by Docker timestamp/line SHA256; no SQL params, member values or raw exceptions retained.

Observed per-host timeouts are not automatically member failures: classify final crate.query failed/recovered/cancelled, link preceding attempt error classes by queryId, then examine guarded crate.recovery and crate.http outcomes per request/operation. Initial 503 crate.http events have hadCrateFailure=false; keep their attribution separate from database failures. Runtime replacement also prevents complete before/after HTTP counter deltas for removed pages; report retained structured HTTP failures plus exact deltas only where containers stayed the same.

## #547 scope/closure

Original #547 completion requires goodwatch_auth, still absent in read-only prechecks; #562 is open and Q33 does not authorize creating it. Upgrade completion alone does not fulfill that criterion; keep #547 open unless it is independently fulfilled. SQL/runbook/firewall/local-rehearsal work is already prepared.

## SQL acknowledgement passed; independent exit still pending

Decommission acknowledged SUCCESS at **2026-10-15T19:20:39.690256+00:00**, **542.78s** after 19:11:36.910 UTC. Crate-01 reached zero primaries and all 958 copies were STARTED. Its original daemon still logs active requests delaying shutdown; SQL job sampling shows only current observer SELECT jobs. This does not expose all internal task contexts: tagged 5.10.9 source requires both JobsLogs.activeRequests==0 and TasksService.numActive==0, polling every five seconds, with a separate two-hour wait after SQL acknowledgement. **No target has started yet, no forced stop or job cancellation.** Wait for normal exit; if the server aborts/times out, restore original staged config/restart policy and allocation per runbook and report.

One classified final failed SQL so far: **/api/poster-impressions POST**, CrateTimeoutError on first attempt to crate-01, about 10,003ms, additive INSERT/ON CONFLICT demand increment. Marked indeterminate and not replayed; correlated request HTTP503/hadCrateFailure=true. It is background poster demand telemetry, not an auth-state mutation by the operator. One cancelled read is recorded separately. Other captured SQL queries recover via surviving nodes; HTTP503 events with hadCrateFailure=false have separate attribution. Full-window totals remain minima due removed original ABIO logs.

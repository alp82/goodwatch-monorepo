# Postgres retirement follow-up ticket drafts

Decisions confirmed by user on 2026-09-10. These early drafts are superseded by the approved GitHub issues linked below. Original observation deadline remains September 11, 21:01 UTC; no early cutoff. Production firewall and application code remain unchanged by the research. The explicitly authorized orphan recovery is complete.

## 1. Repair targeted provider fetching and incomplete streaming publication

The priority flow passes initializer counts instead of provider IDs, so its provider fetch branch does no work. Publication then raises KeyError for titles with only unprocessed provider records.

Return/resolve actual provider document IDs for existing and newly initialized countries; validate the handoff contract. Publish verified country results while retaining existing data for pending/failed countries. Incomplete required streaming work keeps that title's demand pending; healthy titles may complete independently. Preserve late impressions and do not fabricate freshness timestamps. Distinguish a successful empty response from unavailable source data.

Acceptance: real provider fetches occur for selected titles; all-pending and mixed-country cases preserve appropriate availability; TV1859/226254/240442/245170 replay without KeyError; correct per-title completion/defer outcomes and Crate/Qdrant read-back are recorded. Verify aggregate/child availability consistency. Network ticket must pass before full publication validation.

[Research](postgres-retirement-streaming-publication.md).

## 2. Restore local-worker connectivity to CrateDB and Qdrant

Audit10.0.0.10–32 reached15 hosts;22–29 were inaccessible over SSH. Local workers cannot connect to Crate11–13:4200/5432 or Qdrant20:6333/6334 while host and remote-worker probes connect. Retain private service addresses; implement narrow persistent local-worker INPUT/UFW allowances and establish their owning configuration. Do not globally disable Docker isolation or expose services publicly. Only permit ports actually required by consumers; successful SQL-wire probing is not itself justification for opening5432.

For Qdrant strict writes, use an explicit deadline and bounded transient retries while preserving completion/lease/acknowledgment rules. Validate persistence and rollback, both local worker types where present, remote workers, and authenticated operations. Repeat formerly failing probes after each change.

The private10.0.0.10:15432 route is also unavailable locally, but every worker's configured Windmill database target connects; this is a latent limitation and outside the application Postgres retirement changes. Redis14–16 and Mongo17–19 tested paths pass; Redis UFW is inactive and advertised public Redis addresses remain separate follow-up work.

[10–17 audit](network-audit-10-17.md), [18–24 audit](network-audit-18-24.md), [25–32 audit](network-audit-25-32.md), [Qdrant research](postgres-retirement-qdrant-connectivity.md).

## 3. Keep anonymous homepage data warm without browser dependence

User intent is homepage UX: anonymous/shared homepage data should already be cached. Prefer direct requests or a narrowly scoped warmup mechanism that executes the actual production homepage data/cache path. Exclude personalized data and unrelated catalogue routes. Retain current default English/Germany coverage initially.

Identify actual cache keys, expiry and homepage data dependencies. Choose a bounded refresh cadence that refreshes before expiry; merely reading a non-sliding cache entry does not guarantee freshness after its TTL. Define failure behavior and report cache evidence, not simply HTTP200 or browser load. Avoid client-supplied arbitrary refresh/query inputs. Keep serving existing valid data during refresh failures where the cache contract supports it.

Acceptance: scheduled warmup exercises the same anonymous homepage data path as users; cold-cache population and subsequent cache hits are verifiable; routine refresh covers TTL rollover without unnecessarily waiting for images/assets; failures are visible and personalized data is untouched. The current browser-context timeout and obsolete URLs are removed from this narrowed warmup path or corrected if any browser remains necessary.

[Research](postgres-retirement-cache-warming.md).

## 4. Make crawler progress and retirement readiness trustworthy

Completed operational recovery: stopped orphaned provider root019aa915-5416-fd17-9882-9e6871c86879 and child019aa915-a956-0616-bc60-cc16768cc716 through supported cancellation/force-cancellation; restored schedule with overlap protection. Three subsequent scheduled runs passed and Mongo read-back verified newly updated provider records. Fresh full queue audit found no other execution started more than24h earlier.

Remaining work: monitor actual root executions; distinguish completed, failed, skipped, canceled and unknown; handle missing parent identity and seven-field cron/timezones; count all8 daily pipelines once; alert on stale roots or sustained absence of real progress. Recompute historical coverage from authoritative jobs and inspect material output, not root success alone.

Acceptance: no skip can satisfy readiness; sample totals reconcile with actual root jobs; long-running daily completion is captured; known external-source failures remain visible with agreed retry treatment. Wait through the existing observation window and review required pipeline/data evidence before storage cleanup. Keep full backups/rollback artifacts.

[Research and recovery](postgres-retirement-job-coverage.md).

## Published tickets — 2026-09-11

The user approved these ten tickets and removed the nonexistent-server audit (.22–29). Every ticket has the `ready-for-agent` label and verified native GitHub blocking links. The agreed final scope is in these issues.

- [#5: Retry streaming scrapes by country without repeating successful work](https://github.com/alp82/goodwatch-monorepo/issues/5)
- [#6: Publish partial streaming results while retaining durable country retries](https://github.com/alp82/goodwatch-monorepo/issues/6) — blocked by #5
- [#7: Retry transient Qdrant publication failures without rescraping](https://github.com/alp82/goodwatch-monorepo/issues/7)
- [#8: Warm anonymous homepage data without a browser](https://github.com/alp82/goodwatch-monorepo/issues/8)
- [#9: Detect stalled Windmill workflows and send deduplicated Discord alerts](https://github.com/alp82/goodwatch-monorepo/issues/9)
- [#10: Alert on overdue country retries and stalled publication](https://github.com/alp82/goodwatch-monorepo/issues/10) — blocked by #6, #7, #9
- [#11: Keep worker firewall access correct across Docker network recreation](https://github.com/alp82/goodwatch-monorepo/issues/11)
- [#12: Move Redis cluster traffic to private addresses and enable scoped UFW](https://github.com/alp82/goodwatch-monorepo/issues/12)
- [#13: Remove retired application Postgres infrastructure and pgAdmin](https://github.com/alp82/goodwatch-monorepo/issues/13) — blocked by #6, #7, #10
- [#14: Delete retained Postgres recovery artifacts after the retention deadline](https://github.com/alp82/goodwatch-monorepo/issues/14) — blocked by #13

# Postgres retirement review — September 15, 2026

> **Completed September 15, 2026 at 13:17:24 UTC.** The scoped Postgres/pgAdmin removal and postchecks passed. The post-cleanup priority run published and acknowledged show 148 and movie 718100 with matching Crate/Qdrant availability. Recovery artifacts are retained until **October 15, 2026 at 13:17:24 UTC** under #14. See [the final execution and recovery runbook](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/postgres-final-removal.md) and [PR #26](https://github.com/alp82/goodwatch-monorepo/pull/26). The assessments below are historical evidence from before final cleanup.

## Follow-up verification — September 15, 12:18 UTC

The duplicate-identity blocker below is resolved. This section supersedes the earlier blocker assessment; the original observations remain as historical evidence.

Independent live reads confirmed full unique country indexes in both source collections, an open maintenance gate and zero unresolved quarantines. Previously failing movie 18/526028 and TV 406/42412/69283 now have zero identity errors and zero pending repair flags. See [structural repair](research/provider-identity-repair-rollout.md) and [alias resolution](research/provider-alias-resolution.md) for the complete repair/archive evidence.

Fresh verification remains pending for 67,330 movie countries and 15,331 TV countries (82,661 total), down from the 84,662 reopen baseline. Eight pending records have recorded failures; they are not described as fresh or healthy. This is a progressing retained refresh backlog, distinct from structural identity ambiguity.

The completed-job API returned no failed priority or streaming roots starting after 09:30 UTC at this inspection. Scheduled priority root `01a0a4f6-4d1a-9111-66b1-3a6c89bbb18b`, started 12:07 UTC, completed with partial success and acknowledged two titles. The 12:00 scheduled streaming catch-up `01a0a498-5b30-482a-d83d-890d1881536a` was still running. All four affected schedules are enabled.

Current frontend, authenticated Crate and Redis, Qdrant collection, retained-host workers and shared etcd checks passed. Retired Postgres/proxy services remain stopped. Monitoring still has historical/current source incidents and incomplete coverage; this verification does not clear those incidents or assert all source pipelines are fresh.

**Ready to resume #13's final review. Permanent deletion still requires the outstanding processing/incident assessment, completed catch-up evidence and fresh scoped resource/backup preflight.** No infrastructure was deleted in this verification, and recovery retention has not started. Private fresh evidence uses the `recheck-*` files in the evidence directory below.

## Earlier decision — before repair

Issue #13's live deletion gate has not passed. Native Postgres/Patroni, proxy configuration, pgAdmin and recovery resources remain intact. No final cleanup timestamp exists, and #14's 30-day retention clock has not started.

The observation deadline passed, and #6/#7/#10 are closed. Fresh processing inspection found a material source-identity blocker that needs reconciliation before removal. This review does not equate infrastructure health or successful parent jobs with complete source processing.

## Current blocker: duplicate country identities

The September 14 22:00 UTC scheduled `f/tmdb_web/tmdb_init_providers` run (`01a09cc8-cb24-c962-b8af-feb92cdb5151`) completed at the Windmill level but returned `identity_error_count: 169348`, zero new movie/TV records, and 100 sampled duplicate-identity errors. That count represents reported errors, not distinct titles or duplicate groups.

The five newest failed priority roots inspected on September 15 all failed provider initialization on ambiguous existing country identities. Their start times ranged from 05:48:40 to 07:01:40 UTC. The latest root is `01a0a3de-c2ae-8dee-1fca-0950def1eb15` (movie 526028). These failures are distinct from concurrent IMDb HTTP 202 and TV Tropes rate-limit errors.

Read-only, indexed title lookups captured five representative source sets. Replaying the existing `identity_map` function against the saved records reproduces the failure without changing production:

| Source | TMDB ID | Records | Duplicate country groups | Groups with different offer snapshots |
| --- | ---: | ---: | ---: | ---: |
| Movie | 18 | 50 | 23 | 15 |
| Movie | 526028 | 58 | 29 | 11 |
| TV | 406 | 8 | 4 | 4 |
| TV | 42412 | 81 | 33 | 20 |
| TV | 69283 | 91 | 33 | 22 |

The sampled duplicates have distinct historical URL slugs for the same numeric title and country. Their timestamps and offers differ, including empty versus nonempty snapshots. Choosing the newest ObjectId, unioning offers, or deleting duplicates blindly would not establish current country truth. Existing country validation deliberately rejects these records; its behavior must not be weakened to pass the retirement gate.

### Proposed repair scope, pending user direction

1. Inventory affected identities in bounded, resumable reads; distinguish valid same-country duplicates from invalid URLs or conflicting stored country codes. Record exact IDs and snapshot hashes.
2. Preserve every original source document and published availability snapshot privately, with a recovery manifest. Establish a policy for the canonical document and retained retry state before mutation.
3. Coordinate all source/publication writers and fence each change against concurrent leases or updates. Preserve historical conflicting snapshots; use a fresh, validated country fetch to establish current offers. Failed or ambiguous fetches must retain published availability and durable retry state.
4. Verify one active identity per title/country, unchanged unrelated countries, and repeatability. Exercise representative movie/show priority runs through publication and acknowledgment, then complete the bounded reconciliation.
5. Reassess incidents, remaining daily coverage and source retry behavior. Repeat the final removal inventory and health checks before resuming #13.

This is additional MongoDB source-data reconciliation beyond deleting the retired Postgres infrastructure. No source records have been changed by this review.

## Verified positive evidence

- Current frontend returned HTTP 200. Authenticated Crate `SELECT 1` passed on `.11–13`; Redis authenticated PING passed on `.14–16`. Old Patroni/HAProxy/PgBouncer units remain inactive with no retired listeners. Crate containers and Windmill workers are running, and shared etcd remains active on `.11/.12`.
- Current Qdrant collection `media_fingerprint_v1` is green, with 191,695 points at inspection. The retired observer hard-codes the obsolete collection `media`; its 404 is not evidence that the current collection is down.
- Scheduled priority root `01a0a406-6ee3-5e89-d615-ad841336f3e2`, started September 15 at 07:45 UTC, successfully published and acknowledged movie 587928 and show 82658. Current Crate readback has demand/acknowledgment 90/90 and 132/132, respectively, with no remaining leases. Both title rows exist. Show 82658 has its expected Qdrant point and fingerprint vector. Movie 587928 has no DNA and its publication correctly reported zero vector upserts; it is not claimed as a successful vector write.
- Latest daily `populate_crate`, September 14 at 17:00 UTC (`01a09bb6-232d-6ce8-65d8-bc51d02058a7`), succeeded with all seven child branches and nonzero row counts. The persistent report records five useful post-shutdown executions.
- September 15 06:00 UTC streaming catch-up completed with partial success: 8,985 movie and 6,956 show rows, plus 21,921/8,175 respective availability rows. This establishes actual processing, not complete country freshness.
- September 15 scheduled ratings, DNA, details and vector publication report nonzero writes. The 07:30 vector sync reports 129 movie and 154 show upserts, zero retries and no publication errors.
- September 15 daily dump extraction processed 1,244,646 movie IDs and 231,635 TV IDs. The latest scheduled DNA generation returned 100 fingerprints.
- The original 2,282,167,152-byte export still matches SHA-256 `5299d930f8e1870c5ee10c3365d48e28a02eb2cbc3de944d3a102ef4de2f9d4b`. All ten existing checksum sidecars match, all three service-configuration archives open, and the three-constraint exception manifest matches its previously recorded checksum. Existing restore evidence is retained; no new restore was performed.

## Remaining evidence limits

- The temporary observer stopped September 11 at 21:05:58 UTC. Its 576 samples include 268 samples with failed checks; the final Windmill check returned HTTP 404 and its daily summary is empty. It cannot establish completed daily coverage.
- Persistent reports have active incidents and bounded/incomplete histories. Both country-backlog scopes are currently unknown; zero lower-bound counts must not be presented as no backlog. Publication backlog was reported healthy with complete observation at the sampled poll.
- Several successful daily initializers return `WINDMILL_TOO_BIG`. Parent success does not prove their outputs. Current Metacritic and TMDB details initializers were still running at inspection.
- A September 12 Metacritic initializer failed with a MongoDB socket timeout; subsequent completed runs and current source outputs still need an explicit recovery assessment.
- IMDb HTTP 202 and TV Tropes rate limits remain source-availability failures. Their current persistence/retry behavior needs assessment before explicitly accepting them for the deletion gate.
- Historical scheduled streaming failures include unmapped providers and publication-lease contention. The current successful catch-up is positive evidence but does not alone resolve all affected titles.

## Private evidence

Captured job records, source snapshots, monitoring reports, readback and checksums are retained with restricted permissions under:

`/home/alp/.local/state/goodwatch/postgres-retirement/final-20260915`

The deterministic read-only reproduction is:

```bash
goodwatch-flows/.venv/bin/python /home/alp/.local/state/goodwatch/postgres-retirement/final-20260915/duplicate_preflight.py
```

It exits 1 with `FAIL: captured source records still have ambiguous country identities`. Source snapshots and raw execution results must remain private.

# Deleted-show child rows (#676)

The delete-on-sync registry now includes all eight catalog tables with `show_id`:
`season`, `episode`, `season_translation`, `episode_translation`, `imdb_episode`,
`imdb_season`, `rotten_tomatoes_season`, and `metacritic_season`. Previously only
`season` was included. Both flagged-title deletion and the orphan sweep use this
registry, retaining the existing spike guard, per-run title budget, batching,
media-type isolation, and child-before-parent deletion order. Member-owned data
is retained.

## Historical Crate-parent diagnostic (not cleanup candidates)

Observed on 2026-10-26 at approximately 00:11–00:12 UTC using the Windmill
read-only preview recipe (`f.db.cratedb.CrateConnector`). Preview jobs
`01a1758c-5a1d-24c2-d6ac-ff402fde2fd2` (counts) and
`01a1758c-cef3-99e9-b002-6e06c0bf51d2` (grouped IDs) issued only SELECTs.
No stored scripts were changed or deployed. Counts and grouped totals agreed.
Production schema discovery found exactly these eight non-member tables with
`show_id`.

| Table | Rows without a Crate show | Distinct show IDs |
| --- | ---: | ---: |
| `season_translation` | 10 | 4 |
| `episode_translation` | 80 | 7 |
| `episode` | 1,489 | 77 |
| `imdb_episode` | 26,258 | 776 |
| `imdb_season` | 1,792 | 760 |
| `rotten_tomatoes_season` | 108 | 69 |
| `metacritic_season` | 44 | 19 |
| `season` | 0 | 0 |

Total: **29,781 rows without a Crate `show` row**. These are diagnostic
counts only, not deletion candidates. The earlier cleanup proposal based on
these IDs was incorrect and its SQL file has been removed. Do not use this
snapshot to delete data.

These tables' writers use Mongo as their show authority. A show that Mongo still
knows can legitimately lack a Crate `show` row, for example when its title is
missing, it has never entered a copy window, or a newer daily dump unflags it.
IMDb ingest maps IDs from Mongo; episode copy selects from Mongo and tolerates
a missing Crate show; translations use Crate episodes and Mongo; critic season
publication does not require a Crate show. A Crate-only anti-join therefore
includes valid rows that must be kept.

## Cleanup rule and operation after deploy

A show's catalog children are eligible for deletion only when either:

- Its Mongo `tmdb_tv_details` document is flagged `tmdb_deleted = true`.
- It is absent from Mongo `tmdb_tv_details` and from the TMDB daily dump
  (`tmdb_daily_dump_data`, `type = 'tv'`, accepting numeric and string IDs).

`plan_flagged_title_rows` plans the first case from explicit Mongo flags.
`sweep_orphaned_titles` plans the second case by checking both Mongo sources.
After deployment, the module's own normal runs clean real leftovers through
these paths, including rows whose Crate parent was already deleted. No one-off
Crate-only cleanup is needed. Existing spike guards and per-run budgets still
apply, so a backlog can require several runs; a guard refusal requires review.

After eligible leftovers have drained, remaining child rows belong to shows
Mongo still knows or the daily dump still lists, and must be retained even if
their Crate `show` rows are absent. Counts of missing Crate parents alone cannot
establish completion or authorize deletion.

## Correct-rule read-only counts

Recounted on 2026-10-26 at 00:23 UTC in preview job
`01a17597-2df9-0264-835c-59cabacc3314`. The preview loaded the reviewed local
`deleted_titles.py` into memory without deploying it, restricted the catalog
registry to these eight show-scoped children plus `show`, and called
`sweep_orphaned_titles(..., dry_run=True)` plus `plan_flagged_title_rows` with
Mongo's flagged IDs. Row counts used SELECTs over the resulting per-table IDs.
A connector wrapper exposed only SELECT; Mongo access used reads only.

| Table | Rows of Mongo-flagged shows | Rows absent from Mongo and dump |
| --- | ---: | ---: |
| `season_translation` | 12 | 0 |
| `episode_translation` | 84 | 0 |
| `episode` | 1,507 | 0 |
| `imdb_episode` | 26,258 | 0 |
| `imdb_season` | 1,792 | 0 |
| `rotten_tomatoes_season` | 108 | 0 |
| `metacritic_season` | 44 | 0 |
| `season` | 7 | 0 |

Total eligible child rows: **29,812**, all belonging to Mongo-flagged shows.
No show with catalog rows was absent from both Mongo and the daily dump in this
scope. These are raw eligibility counts before the runtime spike guards and
per-run budgets, not a prediction of a single run's deletions. The flagged plan
also includes children whose Crate `show` row still exists, so it is not a subset
of the historical Crate-parent diagnostic above. The two snapshots were taken
at different times as well.

No cleanup SQL is provided: use the module's own guarded runs after deployment.
No production DELETE, data repair, or deployment was performed.

## Verification

A failing regression run before the registry change demonstrated that orphan-only
children were omitted and child rows remained after show deletion. The new tests
cover all show-scoped catalog tables, multiple rows per show, overlapping child
IDs, deletion with and without a parent row, retaining another show and a movie
with the same ID, retaining member scores, idempotency, orphan-sweep dry run,
spike refusal, per-run budget, and 500-ID batching.

Commands used an isolated Python 3.12 environment under
`~/.cache/gw-work/676/venv` with test dependencies installed. No production env
was copied into the worktree. Full flows invocation:

```sh
TMPDIR=~/.cache/gw-work/676 PYTHONPATH=goodwatch-flows \
  ~/.cache/gw-work/676/venv/bin/pytest -q goodwatch-flows/tests
```

- Changed tree: 1,888 passed, 820 subtests passed, 89 skipped, 1 failed.
- Original main (`bb1265d4a`), same environment: 1,884 passed, 818 subtests passed,
  89 skipped, 1 failed.
- The same existing failure in both runs is
  `DeleteFromCrateTests.test_user_tables_are_untouched_and_all_derived_tables_are_covered`:
  the schema has `social_title_link`, `social_relevance`, and `social_link_report`,
  absent from the pre-existing title-keyed deletion registry. That separate gap
  is outside this show-scoped fix.
- Focused deletion suites: 42 passed, 2 subtests passed, the same 1 existing failure.
- Webapp `npm ci --include=dev` succeeded with `SHARP_IGNORE_GLOBAL_LIBVIPS=1`
  (the initial attempt tried to build against system libvips and failed).
  `npx tsc --noEmit` ran and reported 192 errors in unchanged webapp files.
  No webapp code changed, so this check runs against the same sources as main.
- `git diff --check` passed. No production DELETE, push, or deploy was performed.

Raw logs are local scratch artifacts under `~/.cache/gw-work/676/`:
`red.log`, `targeted.log`, `pytest-full.log`, `pytest-baseline.log`, and `tsc.log`.

Review follow-up: removed the unsafe Crate-parent-based SQL artifact and
regenerated the counts above with Mongo/daily-dump eligibility. Corrected
`FakeCrate._owned` to recognize every schema table with `show_id`. The three
focused deletion suites were rerun: 42 passed, 2 subtests passed, and the same
existing social-table coverage failure. `git diff --check` passed. Webapp sources
remain unchanged; the prior type-check result above still applies. Follow-up
logs: `review-targeted.log` and `corrected-count-results.json` in the same scratch
directory.

# Deleted-show child rows (#676)

The delete-on-sync registry now includes all eight catalog tables with `show_id`:
`season`, `episode`, `season_translation`, `episode_translation`, `imdb_episode`,
`imdb_season`, `rotten_tomatoes_season`, and `metacritic_season`. Previously only
`season` was included. Both flagged-title deletion and the orphan sweep use this
registry, retaining the existing spike guard, per-run title budget, batching,
media-type isolation, and child-before-parent deletion order. Member-owned data
is retained.

## Production read-only snapshot

Observed on 2026-10-26 at approximately 00:11–00:12 UTC using the Windmill
read-only preview recipe (`f.db.cratedb.CrateConnector`). Preview jobs
`01a1758c-5a1d-24c2-d6ac-ff402fde2fd2` (counts) and
`01a1758c-cef3-99e9-b002-6e06c0bf51d2` (grouped IDs) issued only SELECTs.
No stored scripts were changed or deployed. Counts and grouped totals agreed.
Production schema discovery found exactly these eight non-member tables with
`show_id`.

| Table | Orphan rows | Distinct show IDs |
| --- | ---: | ---: |
| `season_translation` | 10 | 4 |
| `episode_translation` | 80 | 7 |
| `episode` | 1,489 | 77 |
| `imdb_episode` | 26,258 | 776 |
| `imdb_season` | 1,792 | 760 |
| `rotten_tomatoes_season` | 108 | 69 |
| `metacritic_season` | 44 | 19 |
| `season` | 0 | 0 |

Total: **29,781 rows**. An orphan here means its `show_id` has no matching
`doc.show.tmdb_id`; this does not establish whether Mongo still has the show.
The normal orphan sweep also checks Mongo details and the TMDB daily dump,
so deploying the fix does not necessarily remove every row in this count.

The exact count SQL for each table is the following, substituting its name:

```sql
SELECT count(*) AS orphan_rows
FROM doc.episode AS child
LEFT JOIN doc.show AS parent ON child.show_id = parent.tmdb_id
WHERE parent.tmdb_id IS NULL;
```

IDs for the proposed one-off cleanup were read with:

```sql
SELECT child.show_id, count(*) AS orphan_rows
FROM doc.episode AS child
LEFT JOIN doc.show AS parent ON child.show_id = parent.tmdb_id
WHERE parent.tmdb_id IS NULL
GROUP BY child.show_id
ORDER BY child.show_id;
```

## Proposed cleanup, not executed

[Exact snapshot SQL](issue-676-orphan-cleanup.sql) contains the literal orphan
show IDs per table, batched to 500, and a SELECT before each DELETE to detect
restored parent rows. The DELETE syntax matches the existing production deletion
path (`show_id = ANY(...)`). No DELETE was sent to production or tested against
production. `season` needs no DELETE.

Recommendation: review and deploy the registry fix first. Recount and regenerate
the snapshot immediately before an independently authorized cleanup, and ensure
every parent preflight returns no rows. A snapshot is not a lock against concurrent
catalog changes; coordinate with sync when applying it. This artifact grants no
cleanup authorization.

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

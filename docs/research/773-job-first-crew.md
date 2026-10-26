# Job-first title crew selection (#773)

Implemented from main `45b4d909d` on October 26, 2026.
Issue: https://github.com/alp82/goodwatch-monorepo/issues/773.

## Selection

The previous job-or-department predicate let popular department colleagues
displace the actual director, writer, producer or composer. Each line now
uses its exact accepted jobs, and uses its department only when no accepted
job exists among the title's joined crew rows:

| Line | Jobs | Fallback department |
| --- | --- | --- |
| Directed by | Director, Co-Director | Directing |
| Written by | Writer, Screenplay, Story, Novel | Writing |
| Produced by | Producer | Production |
| Composed by | Original Music Composer, Music, Music Director | Sound |

Department colleagues never fill spare slots when an accepted job exists.
Multiple accepted credits for one person are grouped before the selection
limit. Page lines keep three people; director/composer credits keep five for
JSON-LD and MCP. Both read the same ordered CTEs, with the page taking the
first three. Ranking retains episode count, popularity and credit ID, with person
ID and name resolving remaining ties (including null credit IDs). The
selected arrays also explicitly order their rows. React keys use person IDs
because credit IDs can be null and each person now appears once per line.

`title-crew-sql.ts` owns these selections. `details.server.ts` uses the same
selected CTEs for visible `crew` and the `credits.directors`/`credits.composers`
arrays consumed by JSON-LD and MCP `get_title`. Show JSON-LD's producer field
intentionally uses `crew.producers`, rather than a separate Executive Producer
list: the structured producer names should match the visible Produced by line.
The unused `credits.executive_producers` query, cached field and type were
removed during review. Music Director and Co-Director count as exact jobs even
when the title has no Original Music Composer or Director credit respectively.
The OG title-image renderer loads the same details but displays no crew.
Discord cards use shared MCP title reads and currently display no crew names;
neither renderer has an independent crew query to change.

The movie details cache is now `details-movie-v3`; shows use
`details-show-v4`. Existing department-wide loader entries are not reused.
The in-process HTML cache is naturally replaced when the new server process
is deployed. No production cache was purged during this work.

## Shows

The copy flow stores aggregate crew jobs with episode counts, often without
departments. `created_by` becomes separate `Creator` credits. Exact jobs
match without requiring a department; Creator remains distinct from Director,
Writer and Producer. The existing episode-count ranking is preserved.

Both checked shows had only null departments: Breaking Bad (1396) had 118
crew credits, including one Creator; Stranger Things (66732) had 189,
including two Creators. Their four visible crew selections stayed unchanged.

## Read-only production Crate comparison

Captured the complete details SQL before and after the change, using an
injected query function rather than importing application services or
invoking cached details getters. Executed the before statement once per
title and the after statement against all three configured coordinators.
All after results agreed, and their director/composer `crew` and `credits`
arrays were identical in the initial implementation. The review follow-up
restores the historical five-person credits limit while page lines remain at
three; the first three still share exactly the same ranking and eligibility.

| Title / line | Before SQL | After SQL |
| --- | --- | --- |
| The Usual Suspects (629), directors | Bryan Singer, Alan Steinman, James D. Deck | Bryan Singer |
| The Usual Suspects (629), writers | Christopher McQuarrie | Christopher McQuarrie |
| The Usual Suspects (629), producers | Bryan Singer, Francine Maisler, Lisa Miller Katz | Bryan Singer, Michael McDonnell |
| The Usual Suspects (629), composers | Charleen Richards-Steeves, Tami Treadwell, John T. Cucci | John Ottman |
| Breaking Bad (1396), directors | Michelle MacLaren, Adam Bernstein, Vince Gilligan | Unchanged |
| Breaking Bad (1396), writers | Peter Gould, George Mastras, Moira Walley-Beckett | Unchanged |
| Breaking Bad (1396), producers | Melissa Bernstein, Stewart Lyons, Diane Mercer | Unchanged |
| Breaking Bad (1396), composers | Dave Porter | Unchanged |
| Stranger Things (66732), directors | Matt Duffer, Ross Duffer, Shawn Levy | Unchanged |
| Stranger Things (66732), writers | Matt Duffer, Ross Duffer, Paul Dichter | Unchanged |
| Stranger Things (66732), producers | Rand Geiger, Lampton Enochs, Kate Trefry | Unchanged |
| Stranger Things (66732), composers | Kyle Dixon, Michael Stein, Dan Romer | Unchanged |

The live before results differ from the older HTML example in the issue
because HTML can hold an older cached popularity ranking. This comparison
uses direct SQL for both sides.

Six additional SELECT-only fixtures using inline rows passed on Crate:
exact-job preference, department fallback, Music with a null department,
deduplicated writing jobs, null-credit ties and Creator remaining distinct
from Director. No production rows, caches or configuration were changed.
The compact results are in [773-job-first-crew.json](773-job-first-crew.json).
Full generated SQL, probe scripts and logs remain in
`~/.cache/gw-work/773/`, outside the repository. No credentials are committed.

Review measurements of the initial implementation found movie 629's query
cost increasing from 100 to 112 ms, and show queries increasing by about 25 ms
at the median. These are query costs behind the twelve-hour details cache,
not an extra cost on each cache hit. They were supplied in the Fable review;
the small follow-up changes were not independently rebenchmarked.

## Tests

- Regression tests first ran against the old predicate and failed on job
  priority, accepted writing/music jobs, duplicate people and null-credit ties.
- Initial focused suite: **68 passed, zero failed**. It covers the actual SQL
  selection through SQLite, title details shape/cache/error behavior, cache
  versioning, MCP compact details, media rollout and JSON-LD.
- Native Crate fixtures: **six passed**. Complete after statements for all
  three titles repeated across three coordinators with identical selection.
- `npm test`: **5,254 passed, 11 failed, eight skipped, one todo**. Nine
  functional/import failures also occurred in an untouched archive of the
  starting commit. The remaining two failures were unrelated rank/pool
  timing budgets under parallel load; both test files passed on isolated
  rerun (**15 passed**). The archive also had extra missing-root-fixture and
  timing failures, so its total is not directly comparable.
- `npx tsc --noEmit`: **192 diagnostics**, identical line-for-line to the
  untouched starting-commit archive. No new diagnostics remain.
- `pytest` in `goodwatch-flows`: **87 collection errors** for unavailable
  dependencies including `groq`, `croniter`, `wmill`, `mongomock`, `crate`
  and `mongoengine`. No flows code changed.
- `git diff --check`: passed.

Tests did not load production environment files or start application
servers. The changed application has not been deployed or verified as live
HTML; the production checks executed the generated SQL read-only.

## Review follow-up verification

- Node 24.15.0 native TypeScript focused run: **78 passed, zero failed**,
  including the original suites, watch actions, both added job variants,
  three-person page versus five-person credit limits, JSON-LD/MCP preserving
  five credits, and the trimmed credits shape having no executive producers.
- Two inline SELECT-only fixtures on production Crate confirmed Co-Director
  and Music Director each return three page names and five credit names from
  the same ordered CTE. No stored data was changed.
- `npx tsc --noEmit`: **192 existing diagnostics**, matching the prior
  baseline after allowing for shifted source line numbers; no new diagnostics.
- `git diff --check`: passed. No push, deployment or query-cost rebenchmark
  was performed for this follow-up.

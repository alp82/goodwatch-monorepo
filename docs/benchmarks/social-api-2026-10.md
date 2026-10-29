# Social API response budgets

Ticket 13 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784), measured on October 29, 2026. Base: `6ea81cf36` (`origin/main` when this work started).

## Findings

Two anonymous production GETs of `/api/social/title?type=movie&id=603` returned 503 in 10,122 and 10,247 ms. Both returned `{"items":[],"buzz":null}` with `Cache-Control: private, no-store` and no `Server-Timing`. Requests ran sequentially. No production store, configuration, or deployment was changed.

The request previously waited for a cache miss to finish and converted any title-read failure to 503. The 10-second interval matches the Crate client deadline. Repeated failures cannot populate the existing title cache, so every later miss can pay the same deadline. There was already a per-title cache with stale-while-refresh; the missing protection was a response budget for cold or unavailable reads, rather than a missing cache declaration.

The initial investigation did not identify the production backend failure. The follow-up below incorporates the owner's query-plan diagnosis. The endpoint does not expose its individual reads, and this task did not access production logs or run database statements. A stalled social SQL read reproduces the observed status, body, and duration locally. This demonstrates the failure mechanism, but does not establish a missing index, a bad join plan, or a particular unavailable coordinator. The change adds duration-only timing entries to help distinguish subsequent cache and store reads.

## Read path

| Read | Before | After |
| --- | --- | --- |
| Viewer session | Always resolved before checking the title feature flag | Resolved only in preview mode, with a 40 ms wait; timeout fails closed |
| Title Valkey cache | Guarded `MGET` of value and reset marker; five minutes fresh and five minutes stale | Same identity, lifetime, marker check, and stale refresh |
| Title SQL | Six-table join with duplicate ranking and limit 50; default 10-second Crate deadline | Staged post-ID lookups with the same filters and ordering; a shared one-second caller abort signal; at most 16 active title fills per process |
| Buzz Valkey cache | Thirty minutes fresh and thirty minutes stale, read after posts | Same cache; response waits at most 20 ms for optional buzz |
| Buzz SQL | Current `doc.buzz_snapshot`, only when posts exist | Same read with a one-second caller abort signal |

The title SQL reads `social_title_link`, `social_post`, `social_image`, `social_content_quality`, `social_relevance`, and `social_link_report`. It requires current passing quality and relevance verdicts, excludes reported, hidden, deleted, expired, changed, and disabled-lane links, and keeps the best post per duplicate group. No query calls an external social API. Valkey operations have the existing one-second command deadline. No application lock appears in this path; the cache coalesces compatible in-flight fills.

## Response and cache behavior

The title API waits at most 120 ms for posts and another 20 ms for optional buzz. Preview authentication can add at most 40 ms. These timer budgets exclude event-loop stalls, response serialization, and network time. An unavailable or delayed post read returns 200 with `{ items: [], buzz: null, pending: true }`. A completed empty read omits `pending`. Missing optional buzz preserves available posts.

A fill continues after its requesting visitor stops waiting and can populate the shared cache. Failed title fills back off for five seconds per key. Eight failed fills within ten seconds defer all title fills in the process for ten seconds. The backoff map holds at most 1,000 keys. Social reads use caller abort signals rather than short transport deadlines that could cool down healthy coordinators; closing an HTTP request does not guarantee that Crate immediately stops the server-side statement.

Every request still enters the guarded shared cache. There is no second local result cache or shared pending lookup that can skip another instance's report reset. Existing reset-marker checks reject outdated fills. Reports retain their existing write and invalidation behavior.

The endpoint remains `private, no-store`, including successful public reads and fallback empties. A browser or edge cache would delay removal of a reported post, so applying `PUBLIC_DATA_CACHE_CONTROL` here would weaken the existing contract. The internal cache shares only catalog data, with media type, TMDB ID, and sorted disabled lanes in its key. Development fixtures still bypass the shared title cache.

Timing entries contain durations only: `social_auth`, `social_items`, `social_store` when the store finishes before the response, `social_buzz`, and `social_total`. A cache hit or an unfinished background read has no `social_store` entry.

## Local measurements

The production tables and their cardinalities were unavailable under the GET-only production rule. Instead, the local harness ran the actual base and candidate production builds with a disposable loopback Valkey cluster and a loopback Crate protocol proxy. It forwarded unrelated fixture reads to the existing benchmark Crate service. Social reads used a deterministic news post with the normal response columns and controlled delays. This is a fault-injection benchmark, not a production-sized SQL performance benchmark.

Builds and servers used `env -i`, explicit loopback endpoints, empty external keys, and the benchmark TCP egress blocker. The harness and raw logs remain in `~/.cache/gw-perf/scratch-social/`; `bench.mjs` records its environment allowlist and fixture. It does not read dotenv files or production endpoints.

| Scenario | Status | End-to-end time | Result |
| --- | ---: | ---: | --- |
| Base, social store delayed 11 seconds | 503 | 10,011 ms | Empty title shape after Crate timeout |
| Candidate, same stalled store | 200 | 143 ms | Empty title shape; `social_items` 121.9 ms |
| Candidate, row API while store stalls | 200 | 188 ms | `{"row":null}`; `social_row` 149.7 ms |
| Candidate, cold fill delayed 300 ms | 200 | 134 ms | Empty title shape; fill continues |
| Candidate, next request after fill | 200 | 31 ms | Fixture post visible, buzz null |
| Candidate, warm title cache | 200 | 30 ms | Same post; title lookup 0.4 ms |
| Candidate, invalid media type | 400 | 6 ms | Existing validation error |

The last two successful post reads occurred while optional buzz still needed a delayed read, so they include its 20 ms response budget. These are individual local samples, not percentiles or capacity claims.

## Other social endpoints

- `/api/talked-about-now` awaited the same ten-minute retained ranking promise as the start row and could spend the full backend deadline on a cold read. Its API response now waits at most 150 ms and returns an uncached null row if the ranking is not ready. The existing fill can finish for subsequent requests. The start-page HTML reader and Hot on socials page behavior are unchanged.
- `/api/social/image/:postId` reads the stored image joined to its live post. It uses a one-second caller abort signal. Store failures return 503 with `no-store` and `Retry-After: 5`; successful JPEG cache policy is unchanged. `social_image` reports the read duration.
- `/api/social/wrong-title` is a POST action. Its GET remains 405. Its report visibility and cache invalidation writes are unchanged. No production action was invoked.

## Validation

The focused command passes 62 tests, including title budgets, optional buzz failure, fill admission and backoff, late cache population, stale delivery, remote-report invalidation, image failures, and the existing reset-marker regression tests:

```sh
cd goodwatch-webapp
node --test app/server/talked-about-now/*.test.ts app/utils/cache-reset-guard.test.ts
```

`npm run typecheck` reports the same 178 diagnostics before and after, with no new diagnostics after normalizing source positions.

The standard `goodwatch-benchmark/html-equivalence/run.sh local origin/main <candidate-worktree>` gate passes 348 documents with zero differences, without a class allowlist. It uses the existing fixture with social surfaces disabled. Social response behavior is covered separately by the enabled HTTP harness and focused tests. No landing-page scripts, styles, images, or rendered HTML changed, so Lighthouse and the script budget were not rerun.

The full `npm test` run does not pass. It reports failures outside social code in combined search, personal order, title snapshot seams, importer wiring, authentication notice checks, TV Time import, and score controls. A baseline run reproduces the shared failures; its initially incomplete archive also caused missing-fixture failures. Both runs stalled in the intro member-transition subprocess, which was terminated after more than two minutes. The TV Time file passed all 23 tests when rerun independently on both trees. The focused social and cache checks pass independently. Raw outputs are retained in the scratch directory; this task does not claim a clean full-suite result.

## Remaining verification

After the normal owner-managed rollout, repeat the sequential title GET and inspect final response timings and the existing Crate diagnostics. Confirm that real title posts appear after a successful fill and that reports remove them across instances. If fills consistently exceed one second or fail, investigate the recorded query and coordinator before changing an index or raising a timeout. This patch bounds the visible failure and supports cache recovery; it does not prove that the production store has recovered or that the underlying SQL plan is fast.

## Follow-up: stage social lookups

The owner identified the production bottleneck with separate read-only SQL measurements: links for movie 603
returned no rows in 127 ms, but adding the post join took 3,757 ms, adding images took 12,133 ms, and the full
query took 10.4 to 19.4 seconds. Crate built hash joins over large right-hand tables even when the title had no
links. This follow-up made no production database requests and changed no production systems.

`readSocialTitles` now reads visible title links first and returns immediately when there are none. It fetches
posts, quality verdicts, relevance verdicts, open or confirmed reports, and available image IDs with indexed
`post_id IN (...)` filters, in batches of at most 500 IDs. At most two statements run concurrently. It checks
current non-null content hashes, applies the same verdict gates, and selects the best post per duplicate group
before applying the limit. The title section uses its existing limit of 50, bounded to 1 through 100 by the
store. The ranking keeps its global limit of 400 and groups duplicates separately for each title.

The start row, `/api/talked-about-now`, Hot page, member start-page Hot entry, and Discord `/hot` share this
ranking reader. A repository-wide search found no independent MCP social-table reader or copy of these joins
on this branch. The original queries now live in `reference-social-sql.ts` for verification only.

One `AbortSignal.timeout(1_000)` covers all stages of a social read. Buzz and image reads also use caller abort
signals. The code no longer overrides the transport timeout to one second: with three coordinators that
transport setting could divide the budget into roughly 333 ms attempts, cool down each host, and affect
unrelated reads. The fake-transport regression test observes one aborted attempt, zero cooldown, and all three
coordinators remaining in rotation.

After eight failed title fills within ten seconds, the shared title-fill gate defers every key for ten seconds.
The existing sixteen-fill admission limit and five-second per-key backoff remain. An unfinished or failed items
read returns `{ items: [], buzz: null, pending: true }`; a completed empty result omits `pending`. The client
refetches pending data after 1,500 ms while `dataUpdateCount < 3`. Responses remain `private, no-store`.
Validation errors omit `Server-Timing` instead of sending an empty header.

### SQL equivalence and timings

The disposable local Crate 5.10.12 instance contained 190,540 posts, 190,539 images, 190,539 quality verdicts,
1,847 links, and 1,859 relevance verdicts. The small fixtures cover every eligibility gate, image status,
duplicate-group precedence, null scores, score/date/ID ordering, title-specific reports, multiple titles,
limits, and a batch boundary. Twelve title/ranking scenarios match the original SQL, both before and after
adding the unrelated corpus. Cross-title ties for the same post have no specified order in the original SQL;
the comparison normalizes only those ties.

| SQL read | Before, median ms | After, median ms |
| --- | ---: | ---: |
| Title without visible links | 36.7 | 2.1 |
| Title with visible links | 40.5 | 20.9 |
| Start row and API, eight titles | 43.7 | 23.4 |
| Hot page, member start entry, and Discord, twenty titles | 44.9 | 17.9 |

Each median uses three sequential local samples, including local HTTP overhead and the staged merge.
`EXPLAIN ANALYZE` profiles show the original reads advancing over as many as 190,541 documents in a query
operator. Staged post, quality, and image operators advance over at most 500 candidates per batch; relevance
can include the same post's verdicts for multiple titles. No staged statement joins the large tables.

These measurements establish bounded indexed lookups and equivalent results on static fixtures. They do not
reproduce production's distributed cluster, document sizes, or 10-second latency. Reproduce the checks with
[`scripts/social-staging`](../../goodwatch-webapp/scripts/social-staging/README.md). Raw statements, plans,
timings, and local harness logs remain in `~/.cache/gw-perf/scratch-social/follow-up/`.

### Follow-up validation

The focused social, client retry, cache-reset, and transport checks pass 70 tests:

```sh
cd goodwatch-webapp
TMPDIR="$HOME/.cache/gw-perf/scratch-social/follow-up" \
  node --test app/server/talked-about-now/*.test.ts app/ui/talked-about-now/query.test.ts \
  app/utils/cache-reset-guard.test.ts app/utils/crate-timeout.test.ts
```

Adding `app/server/discord/guest-commands.test.ts` to that command passes 151 tests.

Type checking reports the same 178 diagnostics before and after, with no new diagnostics after normalizing
source positions. HTML equivalence against `origin/main` passes 348 documents with zero differences and no
class allowlist. Social surfaces remain disabled in that HTML fixture; the SQL equivalence and API tests cover
the enabled data path separately.

After the owner deploys, repeat low-rate GETs of the title API and `/api/talked-about-now`, inspect the response
timings, and confirm that posts appear after a pending response. Production SQL measurements, a production
latency claim, and cross-instance report verification remain outside this task's permitted verification.

The movie-only local `bench.sh budget` check ran against both `origin/main` and the candidate, with loopback
services, an explicit environment allowlist, and blocked server egress. The scratch copy of the benchmark
command adds Docker host networking so Chromium can reach the loopback server. Each build received one
mobile Lighthouse sample at the budget's 2.7 CPU slowdown. Scores were 92 before and 91 after; LCP was
3,353 and 3,490 ms, with zero TBT and CLS in both. Script checks pass: 27 scripts and 295.0 KB before versus
294.8 KB after, below the 324 KB limit. Both builds fail the same image and total-byte budgets: 293.4 KB of
images versus the 92 KB limit, and about 716.9 KB total versus 529 KB. This is an existing local fixture failure;
the social patch changes no images or byte limits. These single samples do not establish a Lighthouse score
improvement or regression.

# Social API response budgets

Ticket 13 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784), measured on October 29, 2026. Base: `6ea81cf36` (`origin/main` when this work started).

## Findings

Two anonymous production GETs of `/api/social/title?type=movie&id=603` returned 503 in 10,122 and 10,247 ms. Both returned `{"items":[],"buzz":null}` with `Cache-Control: private, no-store` and no `Server-Timing`. Requests ran sequentially. No production store, configuration, or deployment was changed.

The request previously waited for a cache miss to finish and converted any title-read failure to 503. The 10-second interval matches the Crate client deadline. Repeated failures cannot populate the existing title cache, so every later miss can pay the same deadline. There was already a per-title cache with stale-while-refresh; the missing protection was a response budget for cold or unavailable reads, rather than a missing cache declaration.

The exact production backend failure remains unverified. The endpoint does not expose its individual reads, and this task did not access production logs or run database statements. A stalled social SQL read reproduces the observed status, body, and duration locally. This demonstrates the failure mechanism, but does not establish a missing index, a bad join plan, or a particular unavailable coordinator. The change adds duration-only timing entries to help distinguish subsequent cache and store reads.

## Read path

| Read | Before | After |
| --- | --- | --- |
| Viewer session | Always resolved before checking the title feature flag | Resolved only in preview mode, with a 40 ms wait; timeout fails closed |
| Title Valkey cache | Guarded `MGET` of value and reset marker; five minutes fresh and five minutes stale | Same identity, lifetime, marker check, and stale refresh |
| Title SQL | Six-table join with duplicate ranking and limit 50; default 10-second Crate deadline | Same filters and ordering; one-second Crate deadline; at most 16 active title fills per process |
| Buzz Valkey cache | Thirty minutes fresh and thirty minutes stale, read after posts | Same cache; response waits at most 20 ms for optional buzz |
| Buzz SQL | Current `doc.buzz_snapshot`, only when posts exist | Same read with a one-second Crate deadline |

The title SQL reads `social_title_link`, `social_post`, `social_image`, `social_content_quality`, `social_relevance`, and `social_link_report`. It requires current passing quality and relevance verdicts, excludes reported, hidden, deleted, expired, changed, and disabled-lane links, and keeps the best post per duplicate group. No query calls an external social API. Valkey operations have the existing one-second command deadline. No application lock appears in this path; the cache coalesces compatible in-flight fills.

## Response and cache behavior

The title API waits at most 120 ms for posts and another 20 ms for optional buzz. Preview authentication can add at most 40 ms. These timer budgets exclude event-loop stalls, response serialization, and network time. An unavailable or delayed post read returns 200 with the existing empty shape. Missing optional buzz preserves available posts.

A fill continues after its requesting visitor stops waiting and can populate the shared cache. Failed title fills back off for five seconds. The backoff map holds at most 1,000 keys. Store reads have finite transport deadlines; closing an HTTP request does not guarantee that Crate immediately stops the server-side statement.

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
- `/api/social/image/:postId` reads the stored image joined to its live post. Its Crate deadline is now one second. Store failures return 503 with `no-store` and `Retry-After: 5`; successful JPEG cache policy is unchanged. `social_image` reports the read duration.
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

# Slow server responses in October 2026

Investigation for ticket 4 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784), measured on October 29, 2026. Production requests were anonymous GETs, with at most two concurrent requests, no redirects followed, no subresource requests, and no load test. No production mutation requests, configuration changes, or deployments were made.

## Findings

Two code paths can hold an otherwise fast page request:

- An in-process page-cache hit without an accepted compression encoding decompressed the stored gzip body on Node's shared worker pool. A hit accepting Brotli or gzip wrote its stored bytes directly. Unrelated compression or crypto work can therefore delay only the uncompressed hit. A local regression reproduces that difference; this does not establish that pool contention caused the original production incident.
- Hot on socials shared a promise for ten minutes, then replaced it with a new blocking database read. A cold request and the first request after expiry could wait for the Crate timeout. The current snapshot read precedes parallel reads of the previous snapshot, display fields, and social posts. React's five-second render abort starts after loaders finish, so it does not bound these reads. Crate's default timeout is ten seconds per query. Encoding is not a loader input. Different instances, different cached page variants, or pool contention can explain a correlation with encoding; response headers from the original incident are unavailable.

The invalid-URL sweep also found a repeatable 500 for `/person/999999999999-missing`, for both clients and both encodings. Local schema inspection shows that `person.tmdb_id` and its credit-table references are Crate `INTEGER` columns. A parameterized local read with this ID fails with `Cannot cast value ... to type integer`. The route checked JavaScript's safe-integer limit, which is much larger. The fix rejects IDs outside the catalog's positive 32-bit range before profile or database work. A local production-build request changes from a 514 ms private 500 to a 10 ms private 404.

The invalid category `/movies/genre/drama` fails address validation before any catalog query. The category is `genres`, not `genre`. It remains a private 404. An anonymous root loader resolves the session and locale without a database read when no auth cookie is present. The original 2.2-second response has no demonstrated route-query cause.

A show request has more waits: correction-reset polling before the page-cache lookup, the essential title read, optional related titles and extras, and the episode grid. Correction polling uses the one-second Redis deadline; optional title reads have 150 ms browser and 1,000 ms crawler budgets; the episode grid has a 1,000 ms budget. These are possible contributors to the reported 1.28-second response. No timing trace links that particular production request to one of them.

## Changes

The page cache retains the original HTML alongside Brotli and gzip. An uncompressed hit writes those bytes directly. The original bytes count toward both the 4 MB entry limit and the 128 MB store limit, so cache memory stays bounded and fewer pages fit. Member bypass, admission, identity, validation, and expiry rules stay the same.

Hot on socials keeps its successful ranking for ten minutes, then serves it for at most ten more minutes while one shared refresh runs. A failed refresh backs off for a minute and does not extend that deadline. A cold or fully expired request waits at most 400 ms for the shared read. If it cannot obtain a ranking, it returns a private 503 with `Retry-After: 2`, rather than waiting for the database timeout or treating a transient read failure as a successful empty ranking. The read can finish for a subsequent request. A wrong-title report resets the ranking and prevents an older in-flight read from restoring it. The data layer can now serve a ranking up to twenty minutes old; the existing five-minute HTML lifetime plus five-minute stale window can add another ten minutes. This is a freshness tradeoff, not a claim that every first request will succeed while its data store is unavailable.

Document responses now preserve loader `Server-Timing`, including thrown Responses, and include the React `render` duration. The root loader contributes session and locale timing. Cache hits describe their current cache result instead of replaying the original render's timings. Loader durations can overlap and must not be added together.

## Local measurements

Both production builds used the same isolated catalog and title snapshot, separate disposable Valkey clusters, empty external keys, an explicit `env -i` allowlist, and a TCP preload that blocks non-loopback egress. A loopback SQL proxy allowed reads only and delayed the current buzz-snapshot read by two seconds. It returned a fixture ranking with one title. Another loopback control occupied four worker-pool threads with crypto work. These are fault-injection measurements, not production latency forecasts.

| Scenario | Before | After |
| --- | --- | --- |
| Cold Hot on socials, two-second snapshot read | 2,046 ms, 200 | 432 ms, private 503 with retry hint |
| Next Hot on socials request after the fill finished | 13 ms, 200 | 14 ms, 200 |
| Warm Brotli cache hit with the pool occupied | 3.3 ms | 3.3 ms |
| Warm uncompressed cache hit with the pool occupied | 997 ms | 3.3 ms |
| Invalid category, private 404 | 11.8 ms | 11.4 ms |
| Show in the local fixture, across runs | 60 to 546 ms | 490 to 579 ms |
| Overflowing person ID | 514 ms, 500 | 10 ms, private 404 |

Measure arrival of the final response headers. `curl`'s `time_starttransfer` can measure a preceding `103 Early Hints` response instead. The local fault-injection table and the final production sweep use Node's final `response` callback, which excludes informational responses.

## Verification

Run the focused Vitest tests from `goodwatch-webapp` with `npm run test:slow`. They cover cold-read deadlines, background fills, refresh sharing, failure backoff, the stale deadline, report invalidation, empty rankings, and document timing headers. The existing Node tests cover page-cache responses, byte limits, memory accounting, member bypass, resets, and share-list invalidation. Eight Vitest tests, 75 focused Node tests, 34 share-list tests, and 17 HTML-comparator tests pass. The full typecheck still reports 186 existing errors; comparison with the base found no new errors. The pool regression fails before the fix and passes afterward.

Run the document comparison with the benchmark databases already available:

```sh
HTML_EQUIVALENCE_CACHE="$HOME/.cache/gw-perf/scratch-slow/html-equivalence" \
  goodwatch-benchmark/html-equivalence/run.sh local <base-ref> <candidate-tree>
```

The runner uses the invoking checkout's installed dependencies and places its generated artifacts under the requested directory. The successful comparison covers 114 URLs as Chrome, Googlebot, and Bingbot: 342 documents, with self-comparisons to detect noise. The fixture contains 30 selected movies and 72 shows, but no people. The standard comparison does not enable Hot on socials. A separate comparison with its feature enabled and a fixture ranking produced identical normalized successful HTML before and after, including the title and serialized ranking.

## Production follow-up

The original spikes did not reproduce in the initial six checks: the three reported URLs returned in 99 to 179 ms. Those checks sent no HTML Accept header, so Early Hints did not affect their first-byte readings. The initial checks and all final document responses in the sweep lacked `Server-Timing`. The sweep found loader timings on 32 redirect responses; none described a slow final document.

The final-header sweep made **472 requests across 116 URLs**: four client/encoding variants per URL, plus two immediate repeats of every sample above 500 ms. Median latency was **101.65 ms**, p95 was **180.21 ms**, and the maximum was **1,625.71 ms**. No request failed at the transport layer.

| URL, browser without Accept-Encoding | Slow sample | Repeat 1 | Repeat 2 |
| --- | --- | --- | --- |
| `/movies/moods` | 1,321 ms | 348 ms | 86 ms |
| `/movie/999999999999-missing` | 672 ms | 102 ms | 109 ms |
| `/show/999999999999-missing` | 1,626 ms | 128 ms | 111 ms |
| `/shows/genres/drama` | 585 ms | 134 ms | 150 ms |

The originally reported URLs stayed below 500 ms in this sweep: Hot on socials ranged from 77 to 170 ms, the invalid category from 100 to 406 ms, and Breaking Bad from 71 to 152 ms. None of the four slow samples repeated above the threshold. All four person-ID overflow variants returned 500, as described above. The four 400 responses were the consent form without OAuth parameters.

The Movies → Moods hub sent 2,023,529 uncompressed bytes. Even its 86 ms cache hit took 1.31 seconds to transfer. Header latency and document transfer time are separate problems; reducing the hub's payload needs a follow-up that preserves its rendered content and loader contract. The local show fixture also exercises blocked external metadata fallbacks, so its timings do not establish a production-store cause.

The sweep includes public catalog, personal-page guest views, settings, static pages, auth forms, legacy redirects, and invalid title IDs, slugs, categories, list IDs, handles, and paths. Resource endpoints, prototype and development routes, credential callbacks, and mutation actions are excluded. A missing handle or list checks its failure path, not an existing account's content. No signed-in session was supplied, so member-specific data-store latency remains unmeasured.

After the owner deploys the code through the normal process, repeat any slow final-header sample with its cache result and timing header. Correlate sustained delays with the existing HTTP duration, event-loop delay, Crate diagnostics, Redis readiness, and breaker metrics on each page instance. Check correction polling for a slow show when its loader and render timings do not account for the response time. Production logs and per-instance metrics were not accessed in this task; no claim identifies the historical spikes' exact backend or host.

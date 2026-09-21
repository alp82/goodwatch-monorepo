# User-data loading measurements

Measured 2026-09-15 against the configured live CrateDB from the development workspace. Read-only analysis; no application behavior changed.

## Account and dataset

Resolved the account email supplied in the conversation through Supabase's `auth.users`, using a parameterized read. The identifier and credentials are not recorded here. A separate grouped count comparison confirmed this account ranks first by total rows across the five interaction tables.

| Data | Entries |
| --- | ---: |
| Scores | 1,002 |
| Wishlist | 353 |
| Watched | 975 |
| Favorites | 36 |
| Skipped | 137 |
| Total interaction rows | 2,503 |
| Distinct movie/show keys | 1,386 |

There are no nonempty reviews in this account. Review text is therefore not the source of its payload size.

## Final benchmark

One initial round plus ten measured rounds, reversing variant order on alternating rounds. Medians below exclude the initial round; ranges are observed minima/maxima, not production percentiles. Each variant executes five queries in parallel. Query/normalization time excludes the separately measured JSON serialization time.

| Variant | Median fetch + normalization | Observed range | JSON bytes | Gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| Existing full dataset | 98.9 ms | 55.1–154.8 ms | 159,882 | 28,829 |
| Example movie, ID 411088 | 28.3 ms | 23.6–30.1 ms | 123 | 124 |
| 24 titles, grouped `IN` filters | 31.4 ms | 29.0–36.7 ms | 3,538 | 741 |
| Same 24 titles, one `OR` branch per title | 90.3 ms | 73.2–143.6 ms | 3,538 | 754 |
| Five aggregate counts | 30.4 ms | 24.7–36.9 ms | 102 | 100 |

Full-data JSON serialization adds 1.94 ms median; the grouped batch adds 0.087 ms. First full fetch in this process was 120.3 ms. No database cache was flushed, so this is not a true cold-cache measurement. Preliminary runs placed the full fetch around 0.1 seconds too, with appreciable variance.

The 24-title batch is reproducible: the first 12 rated movies and first 12 rated shows in lexicographic media-key order. It is a populated synthetic batch, not a captured page viewport. It returned 24 scores, 23 watched entries, three wishlist entries and three favorites. The example movie returned one wishlist entry. Output uses the existing sparse `UserData` shape; a production scoped response should additionally make coverage/no-interaction explicit, so its exact size will differ.

Gzip values are local `gzipSync` measurements of JSON, not observed HTTP transfer sizes. Key order can change the compressed size slightly. HTTP headers, Remix hydration wrappers and compression settings are excluded.

## What the timings mean

This exercises the original `_getUserData` function, transpiled directly from [the application source](../../goodwatch-webapp/app/server/userData.server.ts), with the same `node-crate` driver and configured database hosts. Its query dependency is instrumented to record elapsed time and append predicates for the scoped variants. The disabled Redis wrapper and production logging are bypassed; original query text, parallelism and normalization execute for the full variant.

For full reads, database-reported per-query medians were approximately 3.6–9.3 ms, while client-observed query medians were 28–83 ms. The difference includes transport, response handling and driver overhead; this benchmark does not isolate those causes. The five query times must not be added, because they execute concurrently.

**This is not a signed-in browser or production-origin latency measurement.** Supabase session verification, API routing, browser network latency, JavaScript download/execution, React hydration and avatar image download are excluded. The measurements establish the cost and size of data retrieval; they do not attribute the user's entire visible delay to the database. The development workspace and production application can have different network paths to CrateDB.

## Implications

- The largest account's complete payload is about 160 KB raw / 29 KB gzipped. That is modest enough that full SSR remains a reasonable simpler first fix; the measurement does not establish a need for a major redesign solely to reduce bytes.
- Scoped reads reduce the measured initial data work by about 68–71 ms and make the payload much smaller. This is useful for detail pages and bounded result batches, and prevents cost growing with the entire account history.
- Predicate shape matters: use parameterized `user_id = ? AND ((media_type = ? AND tmdb_id IN (...)) OR ...)`, grouping IDs by media type. A long disjunction of composite keys erased much of the time benefit in this experiment. Both variants used the same IDs and parameterized values.
- Fetching the full map afterward would still perform the original five reads, plus the scoped first reads. It can be a transitional convenience for navigation, but is not necessary for the audited features and is not automatically simpler once partial-cache correctness is considered.
- Prefer initial verified auth + title state, then additional batches as needed, with separate counts/recent-activity/paginated wishlist queries. The server should select an initial rendered batch rather than trying to predict exact browser viewport dimensions. New result responses can include their personal state to avoid another browser request chain.
- Keep background fetching from disabling already-loaded controls or overwriting newer mutations. Missing/unloaded title state must remain distinct from confirmed false/null. Do not place an incomplete map under the existing complete-data query key.

See [consumer audit and migration design](user-data-loading-design.md) for the specific callers and cache/mutation changes. Shared-response caching and refreshed auth cookies also need correction before personalized SSR expands.

## Reproduction

The read-only [benchmark script](../../goodwatch-webapp/scripts/benchmark-user-data.mjs) loads the actual normalization function and runs the comparison. From `goodwatch-webapp`, with a private local file containing only the target user ID:

```sh
node --env-file=.env scripts/benchmark-user-data.mjs /path/to/private-user-id-file /tmp/goodwatch-user-data-results.json
```

It prints aggregate statistics and writes per-query timing/row-count samples, without user IDs, title IDs, reviews, credentials or raw interaction records. It uses the existing installed `node-crate` and `esbuild` packages. The checked-in artifact [user-data-loading-measurements.json](user-data-loading-measurements.json) contains the final run's aggregate samples.

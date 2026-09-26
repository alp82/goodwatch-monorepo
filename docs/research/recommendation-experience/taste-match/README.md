# Taste match for any 100 titles

This page answers [#174](https://github.com/alp82/goodwatch-monorepo/issues/174) for the
[recommendation experience map](https://github.com/alp82/goodwatch-monorepo/issues/172): can GoodWatch show a taste
match on any list of up to 100 titles in under 50 ms, without a Qdrant call per request?

Measured on 2026-09-26 against production Crate, Qdrant, and Redis. All access was read-only.

## Answer

Yes, with a wide margin. Keep every title's fingerprint in webapp memory and keep one taste vector per person in Redis.
A request then costs one Redis `GET` (p50 1.0 ms, p95 1.3 ms) and an in-process dot product for 100 titles
(p50 0.07 ms, p95 0.12 ms). Qdrant and Crate stay off the request path.

| Scoring path for 100 titles | p50 | p95 | Fits 50 ms | Notes |
| --- | --- | --- | --- | --- |
| In webapp memory, `uint8` scores | 0.07 ms | 0.12 ms | Yes | About 31 MB for 241,258 titles, including the id map |
| In webapp memory, `float32` vectors | 0.08 ms | 0.13 ms | Yes | About 84 MB, including the id map |
| Qdrant, one `GET /points` by id | 10.1 ms | 13.7 ms | Yes | Adds a Qdrant call to every page, which the map rules out |
| Crate, one `SELECT fingerprint_scores` | 81.9 ms | 106.3 ms | No | Reads the object column row by row |

## Recommendation

1. **Title vectors live in webapp memory.** Store the 74 raw fingerprint scores as `uint8` (they are integers 0 to 10,
   so this is lossless) plus one `float32` inverse norm per title. Cosine against a unit-length taste vector is then
   `dot(raw, taste) * invNorm`. Load them at boot from a compact snapshot, not from Crate (see
   [Loading the catalog](#loading-the-catalog)).
2. **Compute the taste vector in the shape Qdrant already uses**, over all ratings instead of the newest 50 of each:
   - `P` is the weighted mean of liked titles (score 6 and up, weight `score - 5`, so 6 counts 1 and 10 counts 5),
     plus Want to See titles at weight 0.5.
   - `N` is the weighted mean of disliked titles (score 5 and below, weight `6 - score`).
   - `taste = 2P - N`, or `P` when there are no dislikes. Inputs are the unit-length `fingerprint_v1` vectors.

   It predicts held-out ratings as well as today's recommend call (mean AUC 0.635 against 0.637) and uses Want to See.
   If exact parity with today's "Recommended for you" row matters more, use the same formula with the 50 and 50 cap:
   it reproduces the recommend API (overlap@50 of 0.98).
3. **Store the vector in Redis**, one small key per person (74 `float32`, a 101-point quantile table, a version, and
   the rating count; under 1 KB). Rebuild it after each rating, rating removal, or Want to See change. A rebuild
   costs about 25 to 35 ms and runs off the request path. On a missing key, rebuild inline.
4. **Guests don't need storage.** Their interactions already reach the server with each request
   (`scored_items` in `guest-recommendations.server.ts`), and building a vector from a few hundred ratings in memory
   takes well under 1 ms.
5. **Show the match as a per-person percentile**, not as raw cosine: `match = round(50 + 0.49 * percentile)`, where
   `percentile` places the title's cosine in that person's own distribution over the reference pool. See
   [Calibration](#calibration).
6. **Move "Recommended for you" to a plain vector query** with the stored vector. That replaces today's seed `GET`
   and `recommend` pair with one Qdrant query, and the row's order then agrees with the match on its cards.

## Method

- **Users:** the 20 members with the most ratings (75 to 990 ratings each, 8,421 ratings from 225 raters in total).
  Ratings come from Crate `user_score` and Want to See from `user_wishlist`, joined to titles with essence tags as
  production does.
- **Title vectors:** `fingerprint_v1` is the 74 fingerprint scores in `CoreScores` order, normalized for cosine.
  The scripts rebuild it from Crate `movie.fingerprint_scores` and `show.fingerprint_scores` (241,258 titles; Qdrant
  holds 224,542 points). Where the same seed titles were picked, local cosine matched the scores Qdrant returned to within 3e-7.
- **Baseline:** one production-equivalent `recommend` call per user (`average_vector`, the newest 50 liked and
  50 disliked titles sent as vectors, the same filter and exclusions as `user-recommendations.server.ts`,
  `hnsw_ef` 128, limit 50). The local candidate pool is the same filter applied to the Crate catalog
  (2,758 to 3,893 titles per user).
- **Latency:** measured from the host that runs the webapp container (`abio`, 10.0.0.21) over the private network, 60
  runs each with a fresh random set of 100 titles from the 58,628 titles with at least 1,000 votes and a poster.
  In-process scoring ran in Node 26 on a development machine, 5,000 runs after warm-up.
- **Load:** about 165 Qdrant reads in total (40 `recommend`, 120 `GET /points`, a few counts), spaced 0.25 to 1 s
  apart.

## Taste vector agreement with the recommend API

Overlap@50 is the share of the recommend API's 50 titles that the stored vector also ranks in its top 50. Spearman
compares the order of those 50 titles. AUC comes from five-fold holdout on each user's ratings: the chance that a
held-out liked title scores above a held-out disliked one.

| Taste vector | Mean overlap@50 | Min overlap@50 | Mean Spearman | Mean holdout AUC |
| --- | --- | --- | --- | --- |
| Qdrant formula, newest 50 and 50 (today) | 0.98 | 0.94 | 0.96 | 0.637 |
| Qdrant formula, all ratings | 0.59 | 0.24 | 0.56 | 0.625 |
| Qdrant formula, all ratings, score weighted | 0.62 | 0.28 | 0.52 | 0.634 |
| Same, plus Want to See at 0.5 (recommended) | 0.62 | 0.30 | 0.51 | 0.635 |
| Mean liked minus mean disliked | 0.03 | 0.00 | 0.18 | 0.647 |
| Score-weighted sum, `score - 5.5` | 0.34 | 0.00 | 0.27 | 0.592 |
| Same, centered on the catalog mean | 0.18 | 0.00 | 0.18 | 0.601 |

Findings:

- **A stored vector reproduces today's output.** Qdrant's `average_vector` target is `2 * mean(positive) -
  mean(negative)`, so the same arithmetic in the webapp gives the same ranking. The misses (up to 3 titles out of 50
  for 8 users) come from tie order when picking the newest 50 ratings and from approximate HNSW search.
- **The weighting barely changes quality.** Every variant that keeps the `2P - N` shape lands at AUC 0.625 to 0.637,
  which is within noise for 20 users. "Mean liked minus mean disliked" scores a slightly higher AUC but ranks a
  completely different top 50 (overlap 0.03). All fingerprint vectors point the same way (every score is at least 0),
  so the plain difference keeps only what separates likes from dislikes and surfaces odd titles.
- **Fingerprint taste is a modest signal.** An AUC around 0.63 means a liked title outranks a disliked one about
  two times in three. That is enough to order a page, not enough to promise "you'll love this".

Per user:

| User | Ratings | Liked/disliked | Want to See | Today: overlap | Today: Spearman | Recommended: overlap | Recommended: Spearman | Today: AUC | Recommended: AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `3a8e67d6` | 990 | 893/97 | 346 | 0.98 | 0.92 | 0.50 | 0.32 | 0.66 | 0.62 |
| `fdf4a92a` | 336 | 266/70 | 71 | 0.94 | 0.95 | 0.56 | 0.61 | 0.57 | 0.56 |
| `0765b834` | 329 | 266/63 | 201 | 0.98 | 0.92 | 0.30 | 0.35 | 0.56 | 0.54 |
| `a632ceed` | 250 | 199/51 | 80 | 1.00 | 1.00 | 0.50 | 0.51 | 0.71 | 0.69 |
| `bd2113e9` | 238 | 217/21 | 0 | 0.98 | 0.90 | 0.50 | 0.38 | 0.62 | 0.64 |
| `04c96753` | 231 | 196/35 | 4 | 1.00 | 1.00 | 0.62 | 0.53 | 0.72 | 0.74 |
| `bef6a8e5` | 223 | 191/32 | 1 | 0.98 | 1.00 | 0.46 | 0.19 | 0.51 | 0.51 |
| `0220a501` | 214 | 192/22 | 7 | 0.98 | 1.00 | 0.40 | 0.37 | 0.68 | 0.68 |
| `f9d6f839` | 199 | 59/140 | 14 | 0.94 | 0.88 | 0.88 | 0.74 | 0.66 | 0.67 |
| `ee55b0fc` | 200 | 192/8 | 3 | 1.00 | 0.99 | 0.68 | 0.68 | 0.54 | 0.51 |
| `2774c415` | 199 | 158/41 | 14 | 0.96 | 0.87 | 0.68 | 0.50 | 0.72 | 0.72 |
| `4d220087` | 199 | 172/27 | 18 | 1.00 | 1.00 | 0.62 | 0.64 | 0.57 | 0.55 |
| `79f97995` | 127 | 120/7 | 3 | 0.98 | 1.00 | 0.64 | 0.42 | 0.64 | 0.62 |
| `f753f88e` | 105 | 86/19 | 2 | 0.98 | 0.94 | 0.82 | 0.45 | 0.65 | 0.62 |
| `c427eb6f` | 100 | 75/25 | 30 | 0.98 | 0.94 | 0.88 | 0.69 | 0.62 | 0.61 |
| `258a211d` | 100 | 72/28 | 0 | 0.96 | 0.88 | 0.66 | 0.53 | 0.68 | 0.68 |
| `ed871d10` | 100 | 24/76 | 0 | 1.00 | 0.97 | 0.66 | 0.69 | 0.67 | 0.69 |
| `68c64873` | 81 | 38/43 | 4 | 1.00 | 1.00 | 0.62 | 0.45 | 0.79 | 0.78 |
| `a0a7e235` | 75 | 50/25 | 0 | 1.00 | 1.00 | 0.74 | 0.62 | 0.71 | 0.73 |
| `8473d80e` | 75 | 60/15 | 16 | 0.98 | 0.97 | 0.70 | 0.54 | 0.47 | 0.53 |

User ids are shortened to their first 8 characters.

## Scoring latency and memory

### In webapp memory

| Layout for 241,258 titles | Size | Score 100 titles, p50 | p95 | p99 |
| --- | --- | --- | --- | --- |
| `uint8` raw scores + `float32` inverse norm | 17.9 MB + 1.0 MB | 0.068 ms | 0.117 ms | 0.139 ms |
| `float32` unit vectors | 71.4 MB | 0.078 ms | 0.127 ms | 0.145 ms |
| `float16` unit vectors (not benchmarked) | 35.7 MB | similar | | |
| Id to row `Map` (241,258 entries) | 10.7 MB | included above | | |
| Ids as `Float64Array` | 1.9 MB | | | |

- Most of the 0.07 ms is the `Map` lookup for 100 point ids, not the arithmetic. Scoring the whole catalog through
  the same map takes 61 ms p50, which is only relevant when building a person's quantile table (58,628 titles,
  roughly 15 ms).
- Building the arrays and map from a binary snapshot took 101 ms.
- The benchmark ran on an AMD Ryzen 9 9950X3D. The webapp host has 8 cores; even a tenfold slower core stays under
  2 ms.
- The webapp container used 2.1 GB when measured and has no memory limit, so about 31 MB more is safe.

### Fetched per request

From the webapp host, 60 runs each:

| Store | Call | p50 | p95 | Max |
| --- | --- | --- | --- | --- |
| Qdrant | `POST /collections/media_fingerprint_v1/points` with 100 ids, `fingerprint_v1` only, no payload | 10.1 ms | 13.7 ms | 20.5 ms |
| Crate | `SELECT tmdb_id, fingerprint_scores FROM movie ... UNION ALL ... show` with `= ANY(?)` | 81.9 ms | 106.3 ms | 116.3 ms |
| Redis | `GET` of one key (the stored taste vector) | 1.0 ms | 1.3 ms | 2.7 ms |

The same benchmark from the Coolify host (10.0.0.10) gave the same picture: Qdrant 10.2 ms and 16.1 ms, Crate
84.2 ms and 110.1 ms, Redis 0.9 ms and 1.3 ms.

Qdrant by id fits the budget but adds a Qdrant call to every page that shows a match, which is the fan-out the map
forbids after [#136](https://github.com/alp82/goodwatch-monorepo/issues/136). Crate misses the budget.

### Loading the catalog

Don't load the catalog from Crate's object column. From the webapp host, 20,000 rows of `fingerprint_scores` took
12.4 s and returned 23.4 MB of JSON, so the full 241,258 titles would take about 2.5 minutes and 280 MB at every
boot. Instead, let the Windmill job that publishes fingerprint vectors write a compact snapshot (point ids as
`float64` plus the `uint8` scores, about 20 MB) to one Redis key with a version key next to it. The webapp reads it at
boot and when the version changes. A title that is missing from the snapshot, such as one published minutes ago,
shows no match until the next snapshot. Check Redis `maxmemory` before adding the 20 MB key.

## Where the taste vector lives

| Option | Read per request | Refresh after a rating | Verdict |
| --- | --- | --- | --- |
| Redis key per person | 1.0 ms p50, 1.3 ms p95 | Rebuild and `SET`, about 25 to 35 ms, off the request path | Recommended |
| Crate row (`user_taste`) | About 9 ms (small Crate reads measured 8.6 to 12.5 ms p50) | `UPDATE`, visible only after the table refresh | Slower, and a stale read right after rating is likely |
| Qdrant collection of user vectors | About 10 ms | One Qdrant write per rating | Adds Qdrant traffic on both paths; rejected |
| In-process LRU only | 0 ms on a hit | Rebuild on every cold miss; invalidation breaks with more than one instance | Use only as a short-lived cache in front of Redis |

Refresh cost, measured from the webapp host:

| Step | Cost |
| --- | --- |
| Read ratings and Want to See from Crate (one statement) | p50 12.5 ms, p95 18.9 ms for 1,355 rows; p50 8.6 to 9.2 ms, p95 under 10 ms for 91 to 214 rows |
| Build the vector from in-memory title vectors | Under 1 ms |
| Build the 101-point quantile table over 58,628 reference titles | About 15 ms |
| Redis `SET` | About 1 ms |

A rating also needs the vector rebuilt before the next page renders. Run the rebuild after the rating write commits,
and have readers rebuild inline when the version is older than the person's latest rating. Production has 8,421
ratings in total, so the write load is negligible. A later incremental update (keep the weighted sums and counts,
adjust them for the changed title) would cut the rebuild to microseconds, but it isn't needed.

## Calibration

Cosine between fingerprint vectors runs high because every fingerprint score is at least 0. Today's
`match_percentage = min(round(cosine * 100), 99)` shows most cards between 80 and 94 percent, and the difference
between a strong and a weak match is a few points.

Distributions below use the recommended vector on a typical Discover page: the first three pages (120 titles) by
popularity with at least 1,000 votes and a poster, not filtered by what the person has seen. The reference pool is
the 58,628 titles with at least 1,000 votes and a poster.

| User | Today's display: p5, p25, p50, p75, p95 | Percentile: p5, p25, p50, p75, p95 | Titles out of 120 by percentile: 0-20, 20-40, 40-60, 60-80, 80-90, 90-100 |
| --- | --- | --- | --- |
| `3a8e67d6` | 75, 82, 90, 92, 94 | 1, 7, 42, 67, 93 | 39, 16, 30, 22, 5, 8 |
| `2774c415` | 64, 75, 85, 90, 95 | 0, 4, 35, 71, 97 | 44, 20, 18, 13, 7, 18 |
| `f9d6f839` | 81, 86, 88, 91, 94 | 13, 36, 54, 72, 91 | 13, 23, 34, 25, 18, 7 |
| `c427eb6f` | 74, 82, 90, 92, 95 | 0, 9, 53, 77, 96 | 38, 13, 14, 30, 11, 14 |
| `a0a7e235` | 79, 85, 87, 90, 94 | 10, 32, 55, 75, 98 | 14, 24, 28, 30, 9, 15 |

Pooled over all 20 users, raw cosine on the page has p5 0.669, p50 0.872, and p95 0.941. The full per-user table is
in [`results/calibration.json`](results/calibration.json).

Proposed mapping:

- At each refresh, store 101 quantiles of the person's cosine over the reference pool (404 bytes).
- `percentile = interpolate(cosine, quantiles, 0..100)`.
- `match = round(50 + 0.49 * percentile)`, so the display runs from 50 to 99 percent. A floor of 50 avoids showing
  "3% match" on popular titles far from someone's taste, which happens on about a third of a Discover page.

Pooled over the 20 users on the Discover page, this mapping gives:

| Displayed match | Share of cards |
| --- | --- |
| 90 to 99 | 16% |
| 75 to 89 | 27% |
| 60 to 74 | 24% |
| 50 to 59 | 33% |

The percentile also holds up on titles the person rated but that were left out of the vector (80/20 split):

| Held-out titles | Median percentile | Shown as 90 or more | Shown below 60 |
| --- | --- | --- | --- |
| Loved (9 or 10) | 75 | 39% | 6% |
| Liked (6 to 10) | 68 | 33% | 11% |
| Disliked (1 to 5) | 41 | 16% | 25% |

Card guidance: emphasize 90 and above, show 75 to 89 plainly, and consider hiding or muting the chip below 60 so a
page doesn't read as a wall of low numbers. With about two in three pairs ordered correctly (AUC 0.63), the number
supports "worth a look" framing better than "you'll love this".

## Limits

- The sample is the 20 heaviest raters. People with a handful of ratings will get noisier vectors; this
  measurement doesn't show where the match becomes useful. A cautious start is to show it from 5 liked titles.
- Overlap@50 against today's API measures agreement, not quality. The holdout AUC is the quality signal, and it
  can't tell the top variants apart with 20 users.
- In-process timings come from a development machine, not the webapp container.
- Title vectors in the snapshot are only as fresh as the last snapshot, which the loading plan above accepts.

## Reproduce

Scripts are in [`scripts/`](scripts/) and raw outputs in [`results/`](results/). They read connection settings from
the main checkout's `goodwatch-webapp/.env`, refuse non-`SELECT` SQL and non-read Qdrant paths, and cap Qdrant
calls.

1. `python3 load_catalog.py` pages the fingerprint catalog out of Crate into `catalog.npz`.
2. `uv run --with scipy --with numpy --with requests python exp1.py` runs one recommend call per user and writes
   `exp1.json`.
3. `python3 holdout.py` and `python3 calibrate.py` run locally on the saved catalog and ratings.
4. `node --expose-gc inmem_bench.mjs` benchmarks in-process scoring (export `ids.f64`, `raw.u8`, and `cand.f64` from
   `catalog.npz` first).
5. `python3 make_remote.py 60 2 | ssh root@<webapp host> python3 -` and
   `python3 make_refresh.py | ssh root@<webapp host> python3 -` run the network timings with only the Python standard
   library on the host. Credentials travel inside the piped script and are never written to the host's disk.

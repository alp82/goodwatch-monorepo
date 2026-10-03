# Slow related-title calls to Qdrant

Research for [#245](https://github.com/alp82/goodwatch-monorepo/issues/245), a child of the map
[#237 "Serve a viral traffic spike"](https://github.com/alp82/goodwatch-monorepo/issues/237).
Researched on 2026-10-03 from the repository, earlier tickets, and Qdrant's documentation. The private hosts were not
reachable, so nothing here is a new live measurement. Claims that need a live check are marked **Not verified**.

## Summary

- **The ticket's numbers are stale.** The 970 ms average and the 1,353 timeouts cover 2026-09-22 to 2026-09-24. The
  cause was found and fixed on 2026-09-25 in [#136](https://github.com/alp82/goodwatch-monorepo/issues/136): two
  `is_empty` filter clauses on fields without a payload index. After the fix, live recommend calls averaged 41 to 57 ms
  in Qdrant, with no timeouts.
- **The remaining time is mostly outside Qdrant.** After the fix, the webapp logged 139 ms p50 and 429 ms p95 per
  related-title call, against about 50 ms in Qdrant. The rest is the gRPC client's decoding of a 226 KB response and a
  busy single Node process.
- **Qdrant is not the bottleneck of the primary spike scenario.** A spike on one title page needs four Qdrant calls
  once, then Redis serves the result for 24 hours. The risks are the cold-miss stampede, the 10-second timeout on the
  page's critical path, and optimizer merges that share the host's CPUs.
- **Related titles don't need Qdrant on the request path.** The filtered candidate set is about 12,000 titles. The
  webapp already holds every title's fingerprint, votes, score, and artwork flags in memory (the title snapshot). A
  scan in the webapp, or a precompute in the pipeline, can replace the call.
- **A second Qdrant node is an availability decision, not a latency decision.** It doesn't shorten a call. A two-node
  cluster also can't change collections while one node is down.

## What the 2026-09-24 telemetry shows

Source: `docs/prototypes/search-arena/results/bench/infra.json`, block
`qdrant.telemetry_since_restart_2026-09-22T19:53Z`. All durations are server side.

| Call | Count | Average | Maximum |
|---|---|---|---|
| gRPC `Recommend`, succeeded | 46,928 | 970.3 ms | 60,641 ms |
| gRPC `Recommend`, timed out at 60 s | 1,353 | | |
| gRPC `Get` (the seed vector read) | 53,701 | 15.8 ms | |
| gRPC `Scroll`, succeeded | 8,026 | 2,139 ms | |
| REST `points/query` (search) | 405 | 90.0 ms | 6,594 ms |
| Payload bytes read from disk | 3.04 TB | | |

Other facts from the same file:

- **Host:** `gw-vector1` (10.0.0.20), 16 vCPU, 31 GB RAM with 18.8 GB available. The `qdrant-main` container has no
  CPU or memory limit.
- **Neighbors on the host:** a Windmill high-performance worker (6 vCPU, 19.6 GiB limit), a Windmill default worker
  (2 vCPU, about 50% CPU), and two Convex backends.
- **Collection `media_fingerprint_v1`:** 191,659 points, 191,632 indexed vectors, 12 segments, 6 shards, replication
  factor 1, status green, 120 payload indexes, 2.1 GB on disk.
- **Vector:** `fingerprint_v1`, 74 dimensions, cosine, in RAM (about 57 MB). No quantization.
- **Payload:** `on_disk_payload: true`.
- **HNSW:** `m` 16, `ef_construct` 200, `full_scan_threshold` 1000.
- **Optimizer:** `indexing_threshold` 1000, `default_segment_number` 2.
- **Search pool:** 16 high-CPU threads, 64 high-IO threads.
- **Network:** 1.9 ms p50 for a keep-alive `GET /` from the webapp container. The network is not the cause.
- **Webapp logs, same day:** gRPC recommend 2,694 ms p50 and 10,281 ms p95 on the client (n=572).

The telemetry was collected after the index fix of 2026-09-22 (HNSW thresholds, `adult` index). So the missing HNSW
graph did not cause these numbers. The 3.04 TB of payload reads in about 39 hours (about 21 MB/s on average) pointed at
payload reads from disk.

## What was already fixed

[#136](https://github.com/alp82/goodwatch-monorepo/issues/136) found the cause and closed on 2026-09-25.

- **Cause:** almost every recommend call filters with `must_not: is_empty poster_path` and `is_empty backdrop_path`.
  Neither field had a payload index. The payload is on disk, so Qdrant read the whole payload (about 2.3 KB) of every
  candidate for each clause. A `count` with the related-titles filter took 282 ms with the clauses and 3 ms without.
  Payload reads ran at about 197 MB/s, or about 89 MB per call.
- **Fix in production (2026-09-25 11:23 UTC):** `keyword` payload indexes on `poster_path` and `backdrop_path`. Commit
  `5703807d` keeps `goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py` in step.
- **Fix in the webapp:** commit `cc535ceb` sets a 10-second timeout on the gRPC client. The default was 300 seconds.

Qdrant's documentation matches the cause:

- "we recommend creating a payload index for each field used in filtering conditions to avoid disk access. Once you
  create the field index, Qdrant will preserve all values of the indexed field in RAM regardless of the payload storage
  type." ([Storage](https://qdrant.tech/documentation/manage-data/storage/))
- "Queries that filter on unindexed fields are not only slower; they can also unnecessarily consume cluster
  resources." ([Indexing](https://qdrant.tech/documentation/manage-data/indexing/))

Measurements from #136, live traffic at about 1 recommend call per second:

| | Before | After the index | After the webapp deploy |
|---|---|---|---|
| Live gRPC recommend, average | 432 ms | 41 ms | 57 ms |
| Related-title probe, server p50 / p95 | 441 / 619 ms | 37 / 49 ms | 47 / 81 ms |
| Webapp `RECOMMEND` log, p50 / p95 | 277 / 760 ms | 124 / 651 ms | 139 / 429 ms |
| Payload read rate | 197 MB/s | 13 MB/s | 14 MB/s |

The third window overlapped a segment merge with HNSW rebuilds: 19 segments, collection yellow, `qdrant-main` at about
900% CPU.

**Not verified:** whether these numbers still hold on 2026-10-03, and why calls reached 60 seconds between 2026-09-22
and 2026-09-24 but not after the restart of 2026-09-24 20:21 UTC (84,420 calls, 411 ms average, 9.1 s maximum, no
timeouts, still before the index). Nobody recorded what the host was doing in the first window. CPU contention with
Windmill and the daily `killall -9 windmill` cron (disabled on 2026-09-27) are candidates, not findings.

## Every Qdrant call on the webapp's request path

All paths below are under `goodwatch-webapp/app`. Prototype routes are left out.

Two clients exist:

- **gRPC:** `utils/qdrant.ts` wraps `@qdrant/js-client-grpc`. Timeout 10 seconds. `QDRANT_URL` names port 6334.
- **REST:** `server/search-ranking/qdrant-http.server.ts` uses `node:http` with keep-alive and 16 sockets. Timeout
  8 seconds. It rewrites port 6334 to 6333.

Every `recommend()` call in `utils/qdrant.ts` makes **two** Qdrant requests: a `Get` that reads the seed vectors, then
a `Recommend` that sends them as raw vectors and excludes the seeds with `has_id`. All calls use the named vector
`fingerprint_v1` in `media_fingerprint_v1`.

| Feature | Code | Query shape | Cache in front |
|---|---|---|---|
| Related titles on movie and show pages | `server/related.server.ts`, called from the loaders of `routes/movie.$movieKey.tsx` and `routes/show.$showKey.tsx`, and from `routes/api.related.tsx` | 1 positive, limit 100, `hnsw_ef` 64, 25 payload fields including `streaming_availability`. The code keeps the top 32. | Redis, 24 hours, one key per title and target media type |
| Related titles by fingerprint trait | Same code through `routes/api.related.tsx` with `fingerprintKey` | Adds a range of plus or minus 1 on `fingerprint_scores_v1.<key>` and one more payload field | Redis, 24 hours, one key per title, trait, and target type |
| Related by category | `getRelatedByCategory`, `routes/api.related-by-category.tsx` | For each category, one movie and one show call with a `should` list of `streaming_availability` values | Redis, 24 hours, outer and inner keys |
| Discover with similar titles (old path) | `server/discover.server.ts` | Up to several positives, limit 5000, `hnsw_ef` 128, payload `tmdb_id` | Redis, 30 minutes |
| Discover title filter, similar titles | `server/title-filter/id-sets.server.ts` | 1 positive, limit 5000, `hnsw_ef` 128, no payload, filter on votes and `is_empty poster_path` | Redis, 30 minutes, with an in-process lock per key |
| Recommended for you, members | `server/user-recommendations.server.ts` | With taste match: one `Search` with the stored taste vector, `hnsw_ef` 128. Otherwise up to 50 positives and 50 negatives, `average_vector`. | Redis, 1 minute |
| Guest recommendations | `server/guest-recommendations.server.ts` | Same two shapes as members | None (`ttlMinutes: 0`) |
| Interest discovery (taste quiz) | `server/interest-discovery.server.ts` | Up to 50 positives and 50 negatives, limit 40, or two `Scroll` calls of 20 | None |
| Fingerprint preview | `server/fingerprint-preview.server.ts` | Liked titles as positives, limit 16, votes of 50,000 or more, trait score filter | None |
| Search ranking | `server/search-ranking/rank-search.server.ts` | REST `points/query/batch`, two or three rounds per search | Out of scope here. See the search footprint ticket of the map. |
| Search display fields | `server/combined-search/reading-retrieval.server.ts` | REST retrieve by ids | Out of scope here |

### The related-titles query in detail

`getRelatedTitles` in `server/related.server.ts` sends this filter:

- `must`: `goodwatch_overall_score_voting_count >= 10000`, `goodwatch_overall_score_normalized_percent >= 60`,
  `media_type` equals the target type (sent twice).
- `must_not`: `is_empty poster_path` and `is_empty backdrop_path` (each sent twice), `has_id` for the source title.

Every filtered field has a payload index in `qdrant_schemas.py`: both ranges, `media_type`, `poster_path`,
`backdrop_path`, `streaming_availability`, and all 74 `fingerprint_scores_v1.<name>` keys.

The filter matches about 8,936 movies or 2,909 shows (#136). That is about 750 movies per segment across 12 segments.
`full_scan_threshold` is 1000 KB, and Qdrant counts "1Kb = 1 vector of size 256"
([configuration file, v1.19.1](https://github.com/qdrant/qdrant/blob/v1.19.1/config/config.yaml)), so the threshold is
about 3,460 vectors of 74 dimensions. Below it, "the query planner will use full-scan search instead of HNSW index
traversal". So related titles are an exact scan over the filtered points, not an HNSW search. The scan is cheap. HNSW
settings, `hnsw_ef`, and quantization don't affect this query.

What still costs time in Qdrant is the payload: 100 results times 25 fields, read from disk, in a 226 KB response.

### What a title page costs

The loaders of the movie and show routes await `prefetchRelatedTitlesState` next to the title details. On a cold cache
that is two cache keys (related movies, related shows) and **four Qdrant requests** (two `Get`, two `Recommend`). The
page waits for them. If Qdrant stalls, the page waits up to 10 seconds before it renders without related titles.

The `cached()` helper in `utils/cache.ts` has no lock and no stale-while-revalidate:

- Concurrent misses for one key all call Qdrant.
- An entry expires with `SETEX` after 24 hours. The next request pays the full cost.
- A thrown error is not cached, so a failing Qdrant is called again on every request.

Client cost, measured on 2026-09-25 with `goodwatch-webapp/scripts/qdrant-client-bench.ts`
(`docs/implementation/search-ranking/README.md`, 150 titles, p50 / p95 in ms):

| Request | Client | Wall | Qdrant | Client overhead |
|---|---|---|---|---|
| Seed read, 0.8 KB | gRPC | 5 / 19 | 0.5 / 2.6 | 4.7 / 14 |
| `recommend`, 226 KB | gRPC | 109 / 158 | 47 / 81 | 60 / 85 |
| `recommend`, 226 KB | `node:http` | 63 / 94 | 46 / 76 | 16 / 23 |

## Causes, one by one

| Suspected cause | Verdict | Evidence |
|---|---|---|
| Missing payload indexes for filters | **Was the main cause. Fixed.** | #136: 282 ms against 3 ms for a `count`; 197 MB/s of payload reads fell to 13 MB/s |
| Unindexed segments and optimizer thresholds | Fixed on 2026-09-22 for search. Not a cause for related titles, which scan exactly. Merges still matter as CPU load. | `indexed_vectors` 191,632 of 191,659. During a merge, #136 saw 19 segments and about 900% CPU. |
| Large payloads returned | **Remaining cost.** | 226 KB per call for 100 results. The code keeps 32. `streaming_availability` is about half of what reaches the HTML, and the prefetch drops it. |
| gRPC client decoding | **Remaining cost.** | 60 ms p50 of client overhead against 16 ms over `node:http` |
| Webapp CPU | **Remaining cost.** | #136: one Node process at about 85% CPU. Webapp p95 was 429 ms against 81 ms in Qdrant. |
| Six shards on one node | Small, constant overhead. Not measured alone. | Each query fans out to 6 shards and 12 or more segments. Qdrant recommends "at least 2 shards per node" to allow growth ([Distributed deployment](https://qdrant.tech/documentation/scaling/distributed_deployment/)). Self-hosted Qdrant can't reshard, so changing this means a new collection. |
| CPU contention with Windmill | Plausible for the 60-second tail. **Not verified.** | Neighbors may use 8 of 16 vCPUs. Qdrant has no limit and no reservation. No host metrics were recorded for the slow window. |
| Recommend with many examples | Not a cause for related titles (one example). | With `average_vector`, "the performance of this strategy is on-par with regular search". `best_score` is "linearly impacted by the amount of examples" ([Explore](https://qdrant.tech/documentation/search/explore/)). The webapp only uses `average_vector`. |
| Limit 5000 in Discover | A real cost for that path, rare in traffic. **Not measured.** | Two call sites, both cached for 30 minutes |
| No quantization | Not a cause. | 57 MB of vectors in RAM, 74 dimensions, exact scan |

## How Qdrant load behaves in a spike

The primary scenario of the map is one or a few URLs. This is reasoning from the code, not a measurement.

- **One title page:** the first requests miss Redis together. Each sends four Qdrant requests. After the first result
  lands (about 150 ms), Redis serves everyone for 24 hours. At 500 requests per second, that is a burst of a few
  hundred Qdrant requests, once. A lock in `cached()` reduces it to four.
- **A share list or the home page:** **not verified** whether these routes call Qdrant at all. No call site was found
  in their loaders through the modules listed above.
- **The long tail:** crawlers on title and person pages produced about 1 recommend call per second on 2026-09-25. This
  load is steady and doesn't grow with a spike on one URL.
- **Qdrant down or slow:** every cold title page waits up to 10 seconds. This is the failure that hurts in a spike.

## Options

### 1. Trim the existing query

- **Needs:** limit 32 instead of 100 on the default path (the code sorts by the Qdrant score there, so the top 32 are
  the same). Drop `streaming_availability` from the default payload. Remove the duplicate clauses. Replace the `Get`
  plus `Recommend` pair with one Query API request with `recommend` by point id, and send the movie and show queries
  in one `query/batch`.
- **Gain:** about a third of the payload reads and response size. One round trip instead of four. Estimated, not
  measured.
- **Risk:** low. The trait path re-ranks 100 results, so it keeps limit 100. A missing seed point must still return an
  empty list. The earlier design sent vectors to avoid a lookup and deletion race.
- **Benchmark:** `qdrant-client-bench.ts --related=150` before and after, plus a result comparison on 150 titles.

### 2. Move `utils/qdrant.ts` to `node:http`

- **Needs:** the REST client that search already uses. Round scores with `Math.fround` to keep them identical to gRPC.
- **Gain:** about 44 ms of client CPU per recommend call at the median (measured, #147). It frees the Node event loop.
- **Risk:** medium. Six modules share the client.
- **Benchmark:** the same script. It already measures both transports.

### 3. Stampede lock, stale-while-revalidate, and a short timeout

- **Needs:** the `cached()` change that the map already lists under "Not yet specified": one load per key, and stale
  entries served while a refresh runs. Store entries longer than they are fresh. For the page prefetch, a timeout of
  about 1 second, after which the page renders without related titles and the client fetches them.
- **Gain:** Qdrant is off the critical path for every title that was ever cached. The 10-second worst case becomes
  1 second. The map already accepts title data that is up to 24 hours stale.
- **Risk:** low. Redis has no `maxmemory` (4.57 GB used on one node on 2026-09-27), so longer retention needs a size
  check. Two entries of 32 titles per title page.
- **Benchmark:** the map's load script on a cold and a warm title page, with Qdrant paused (`docker pause qdrant-main`
  on a test window agreed with the owner) to prove that pages still render.

### 4. Compute related titles in the webapp from the title snapshot

- **Needs:** the title snapshot (`server/title-snapshot/`) already holds, per title, the 74 fingerprint scores, the
  inverse norm, votes, the GoodWatch score, and the poster and backdrop flags. A scan filters about 238,000 rows and
  scores about 12,000 with a 74-term dot product. Display fields for the 32 winners come from Crate or a cached title
  record.
- **Gain:** no Qdrant request for related titles. The estimate is under 5 ms of CPU per call. Not measured.
- **Risk:** medium. **Not verified** that the snapshot's cosine over raw scores matches `fingerprint_v1` in Qdrant
  closely enough. A comment in `server/utils/recommend.ts` says the same cosine orders both. Needs a parity check on
  150 titles. The snapshot must be loaded in production regardless of feature modes. The 16 rating fields that the
  cards show are not in the snapshot. Titles analyzed after the last snapshot have no related titles until the next
  one.
- **Benchmark:** a script that compares the top 32 against Qdrant for 150 titles, and times the scan in the webapp
  container.

### 5. Precompute related titles in the pipeline

- **Needs:** a Windmill step after the vector copy. Only about 12,000 titles can appear as results, so a brute-force
  matrix product for all 191,659 source titles is small. Store 32 point ids and scores per title and target type in
  Crate or Redis (about 0.5 KB per list, about 200 MB in total, estimated). The webapp reads the list and the display
  fields.
- **Gain:** the same as option 4, and it also works before the snapshot loads. Popular titles only would be smaller,
  but the long tail is what crawlers hit.
- **Risk:** medium. A new pipeline step and a new table or key family. Lists go stale when a result title loses its
  artwork or drops below the vote threshold, until the next run. Storing full cards instead of ids would be about
  27 GB, so store ids.
- **Benchmark:** run time of the step, the size on disk, and read latency from the webapp under the load script.

### 6. Tune the collection and the node

- **Needs, in order of value:**
  - Set `optimizer_cpu_budget` so merges leave CPUs for searches. The default "0" keeps "1 or more CPUs unallocated".
  - Set the payload memory tier to `cached` for this 2.1 GB collection. The host has 18.8 GB available. Qdrant
    describes `cached` as "fast to access" and `cold` (the default) as lower RAM with higher latency.
  - Give `qdrant-main` a CPU reservation, or cap the Windmill workers below the host's capacity.
- **Not worth doing:** quantization (the vectors are 57 MB), HNSW changes (related titles scan exactly), and fewer
  shards (needs a new collection for an unmeasured gain).
- **Gain:** a shorter tail during merges, and fewer disk reads for payloads. Not measured.
- **Risk:** low for the budget and the payload tier. **Not verified:** whether the payload tier can change on an
  existing collection in 1.19.1 without a rebuild.
- **Benchmark:** the probe of #136 (1 request per second, three query types) during a forced merge, before and after.

### 7. Move Windmill off the host

- **Needs:** move the high-performance worker and the default worker from `gw-vector1` to a spare host in
  10.0.0.10 to 10.0.0.32. The map's host survey decides which. The same worker group also runs on 10.0.0.10.
- **Gain:** removes the only unexplained cause of the 60-second tail. Not measured.
- **Risk:** low. The Convex backends stay unless they move too. Windmill jobs on this host can't reach Qdrant on the
  published port anyway without the firewall allowance described in
  `docs/research/postgres-retirement-qdrant-connectivity.md`.
- **Benchmark:** recommend p95 and maximum from `/metrics` over a week before and after, next to the host's CPU.

### 8. Add a second node with replication

- **Needs:** a second host with `goodwatch-qdrant/replica/docker-compose.yml`, which bootstraps from the first node.
  Then replicate each of the 6 shards with `POST /collections/{name}/cluster` and `replicate_shard`. Raise
  `replication_factor` to 2 in `qdrant_schemas.py`. Point the webapp at both nodes, or at a load balancer.
- **Gain:** reads survive the loss or restart of one node. Read capacity roughly doubles. Latency per call doesn't
  improve.
- **Risk:** high compared with the gain.
  - "A two-node cluster can't form a majority if either node is unavailable", and "The cluster cannot perform
    collection operations when one node is down"
    ([Horizontal scaling](https://qdrant.tech/documentation/scaling/horizontal-scaling/)). Qdrant recommends three
    nodes.
  - Every write goes to both nodes. The publication flows and their retry budget
    (`docs/qdrant-publication-retries.md`) need a new check.
  - Upgrades, snapshots, and `/metrics` become per node.
  - The gRPC client takes one URL, so failover needs a proxy or client code.
- **Benchmark:** the load script against recommend with one node stopped, and write latency of
  `f/sync/copy/vector_data` before and after.

## What to measure live

Run these from a host in 10.0.0.0/24. Set `KEY` to the read-only API key. All commands are read-only.

1. Current collection state and config:

   ```sh
   curl -s -H "api-key: $KEY" http://10.0.0.20:6333/collections/media_fingerprint_v1 \
     | jq '.result | {status, optimizer_status, points_count, indexed_vectors_count, segments_count, config, payload_indexes: (.payload_schema | length)}'
   curl -s -H "api-key: $KEY" http://10.0.0.20:6333/collections/media_fingerprint_v1/cluster | jq .result
   ```

2. Recommend latency and failures since the last restart. Take two samples a known time apart and subtract:

   ```sh
   curl -s -H "api-key: $KEY" http://10.0.0.20:6333/metrics \
     | grep -E '^(grpc|rest)_responses_(total|fail_total|avg_duration_seconds|max_duration_seconds)' \
     | grep -E 'Recommend|Get|Scroll|Search|points/query'
   curl -s -H "api-key: $KEY" 'http://10.0.0.20:6333/telemetry?details_level=3' > telemetry-$(date -u +%FT%H%MZ).json
   ```

   The metric names come from Qdrant's [monitoring page](https://qdrant.tech/documentation/ops-monitoring/monitoring/).
   **Not verified:** the exact label values on 1.19.1.

3. Client and server time for related titles, from the webapp host:

   ```sh
   cd goodwatch-webapp
   QDRANT_URL=http://10.0.0.20:6334 QDRANT_API_KEY=$KEY node scripts/qdrant-client-bench.ts --related=150 --passes=2
   ```

4. Qdrant alone under concurrency. Save the body as `related.json`, then raise `-c` from 1 to 64:

   ```json
   {
     "query": { "recommend": { "positive": [1000000000603] } },
     "using": "fingerprint_v1",
     "filter": {
       "must": [
         { "key": "goodwatch_overall_score_voting_count", "range": { "gte": 10000 } },
         { "key": "goodwatch_overall_score_normalized_percent", "range": { "gte": 60 } },
         { "key": "media_type", "match": { "value": "movie" } }
       ],
       "must_not": [
         { "is_empty": { "key": "poster_path" } },
         { "is_empty": { "key": "backdrop_path" } }
       ]
     },
     "limit": 100,
     "with_payload": ["tmdb_id", "title", "release_year", "poster_path", "backdrop_path", "streaming_availability"],
     "params": { "hnsw_ef": 64 }
   }
   ```

   ```sh
   oha -z 60s -c 16 -m POST -H "api-key: $KEY" -H "Content-Type: application/json" -D related.json \
     http://10.0.0.20:6333/collections/media_fingerprint_v1/points/query
   ```

   One seed keeps its payload pages warm. For a fair number, rotate seeds, or read the result as a best case. The
   payload list here is shorter than production's 25 fields. Use the `PAYLOAD` list from the bench script for an exact
   copy.

5. Host contention, during step 4 and during a scheduled `f/sync/copy/vector_data` run:

   ```sh
   ssh root@10.0.0.20 'uptime; docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"'
   curl -s -H "api-key: $KEY" http://10.0.0.20:6333/metrics | grep collection_running_optimizations
   ```

6. How often title pages miss the cache: count `RECOMMEND` log lines against title page requests in the webapp logs
   over the same hour. #136 saw 450 calls for 1,383 title page requests.

The map's baseline ticket (#241) is the right place for steps 2, 3, 5, and 6.

## Recommendation, ordered by cost

1. **Measure first (steps 1 to 6).** Hours. The ticket's numbers predate the fix. The decision needs current ones.
2. **Lock, stale-while-revalidate, and a 1-second timeout for the page prefetch (option 3).** Small. It covers the
   spike scenario and a Qdrant outage. The map already plans the `cached()` change.
3. **Trim the query (option 1).** Small. Less payload and one round trip.
4. **Optimizer CPU budget and cached payload tier (option 6).** Small, and reversible.
5. **Move Windmill off `gw-vector1` (option 7).** Small to medium. Depends on the host survey.
6. **Related titles from the title snapshot (option 4), or precomputed (option 5).** Medium. It takes related titles
   off Qdrant for good. Choose option 4 if the parity check passes, since it needs no new pipeline step.
7. **`node:http` for the remaining gRPC calls (option 2).** Medium. Less valuable once option 4 or 5 lands.
8. **A second node (option 8).** Highest cost. Don't do it for latency. Consider it only if a Qdrant restart or host
   loss must not degrade the site, and then plan for three nodes or accept the two-node limits.

## Open decisions for the owner

- Should title pages render without related titles when Qdrant is slow, with the client fetching them afterward?
- Is a related-titles list that is up to 24 hours old, or as old as the last title snapshot, acceptable? The map
  accepts 24 hours for title data.
- In-webapp scan (option 4) or pipeline precompute (option 5), if related titles leave Qdrant?
- May Windmill workers leave `gw-vector1`, and do the Convex backends stay?
- Is Qdrant availability during a restart or host loss a goal of this map? If not, the second node is out.
- May a test pause `qdrant-main` for a minute to prove the degraded path?

## Not verified

- Current recommend latency, timeouts, segment count, and optimizer state on 2026-10-03.
- The cause of the 60-second calls between 2026-09-22 and 2026-09-24, beyond the missing indexes.
- The cost of six shards on one node, and the cost of limit 5000 in Discover.
- Whether the snapshot's cosine matches `fingerprint_v1` for ranking, and whether the snapshot always loads in
  production.
- Whether the payload memory tier can change in place on 1.19.1.
- The gain of every option. Only the client overhead (option 2) and the index fix have measurements.
- Who calls `routes/api.related-by-category.tsx`.
- Label values of the `/metrics` series on 1.19.1, and the `jq` paths against the live responses.

## Sources

- Local: `docs/prototypes/search-arena/results/bench/infra.json`, `docs/implementation/search-ranking/README.md`,
  `docs/research/qdrant-range-count-ranking.md`, `docs/research/postgres-retirement-qdrant-connectivity.md`,
  `docs/qdrant-publication-retries.md`, `goodwatch-qdrant/main/docker-compose.yml`,
  `goodwatch-qdrant/replica/docker-compose.yml`, `goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py`,
  `goodwatch-webapp/scripts/qdrant-client-bench.ts`, and the webapp files named above. The task named a
  `goodwatch-vector/` directory. It doesn't exist in the repository.
- Tickets: [#136](https://github.com/alp82/goodwatch-monorepo/issues/136) (cause, fix, and measurements).
- Qdrant: [Indexing](https://qdrant.tech/documentation/manage-data/indexing/),
  [Storage](https://qdrant.tech/documentation/manage-data/storage/),
  [Optimizer](https://qdrant.tech/documentation/ops-optimization/optimizer/),
  [Explore](https://qdrant.tech/documentation/search/explore/),
  [Distributed deployment](https://qdrant.tech/documentation/scaling/distributed_deployment/),
  [Horizontal scaling](https://qdrant.tech/documentation/scaling/horizontal-scaling/),
  [Monitoring](https://qdrant.tech/documentation/ops-monitoring/monitoring/),
  [Quantization](https://qdrant.tech/documentation/manage-data/quantization/), and the
  [default configuration file for v1.19.1](https://github.com/qdrant/qdrant/blob/v1.19.1/config/config.yaml). The
  documentation pages describe the current release, not 1.19.1 specifically.

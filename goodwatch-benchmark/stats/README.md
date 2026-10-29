# Profile Stats benchmark

This benchmark uses synthetic member data and local catalog metadata. It does not read member tables from the source bench, start a server with dotenv files, or contact production.

## Create the fixture

Run from the repository root. Reserve these loopback ports for this ticket: Crate at 15873, cache at 6473, snapshot at 6476, and page servers at 3307 and 3308. The cache also uses cluster bus port 16473. The fixture reads public catalog fields and table definitions from the existing local bench at port 15870. It writes only to the cluster named `gw-perf-stats`.

```sh
mkdir -p "$HOME/.cache/gw-perf/scratch-stats"
docker run -d --rm --name gw-perf-stats-crate \
  -p 127.0.0.1:15873:4200 -e CRATE_HEAP_SIZE=512m crate:5.10.12 \
  -Cdiscovery.type=single-node -Cnetwork.host=0.0.0.0 -Ccluster.name=gw-perf-stats
docker run -d --rm --name gw-perf-stats-cache --network host \
  valkey/valkey:8 valkey-server --port 6473 --bind 127.0.0.1 \
  --cluster-enabled yes --cluster-announce-ip 127.0.0.1 --save '' --appendonly no
docker exec gw-perf-stats-cache valkey-cli -p 6473 cluster addslotsrange 0 16383
docker run -d --rm --name gw-perf-stats-snapshot \
  -p 127.0.0.1:6476:6379 valkey/valkey:8 valkey-server --save '' --appendonly no
python3 goodwatch-benchmark/stats/fixture.py
```

Wait for `cluster_state:ok` from `docker exec gw-perf-stats-cache valkey-cli -p 6473 cluster info` before measuring.

The fixture has 700 scored movies, 300 scored shows, and 100 unscored movies. It repeats local catalog metadata under synthetic IDs, adds synthetic credits and trope arrays, and gives titles distinct years within each score to keep poster ranking deterministic. The 250-label trope arrays deliberately repeat labels. Both implementations must count each label once per title. No source member rows are copied. The member ID is `stats-synthetic`, with public profile `/u/stats_synthetic/stats`.

## Measure the Stats reads

Provide a clean base worktree with webapp dependencies installed or linked. Keep that worktree and all output under the ticket scratch directory.

```sh
scratch="$HOME/.cache/gw-perf/scratch-stats"
node goodwatch-benchmark/stats/run.mjs "$scratch/base" "$scratch/base-real"
node goodwatch-benchmark/stats/run.mjs . "$scratch/after-real" "$scratch/base-real"
```

The runner bundles the real Stats model, catalog reads, concurrency queue, and Redis cache. Only the member-data adapter and title URL formatter are replaced. It makes five cold computations and five warm lookups, saves per-read Server-Timing values, row counts, response sizes, and optimized EXPLAIN plans, and checks all 16 visibility projections. Warm lookups must make no catalog queries.

EXPLAIN uses fixture constants. Crate 5.10.12 leaves parameter placeholders in a parameterized EXPLAIN and reports a generic Collect plan, even when a literal primary-key query uses Get. The benchmark executes parameterized reads and records literal plans separately.

Set `STATS_ACTIVITY_CHECK=1` to apply the activity regression check to the base too. It sets the synthetic owner's `taste:touched` marker and holds catalog reads behind a gate. Three visitors must return before that gate opens. The unchanged base fails this check. The candidate also checks the real Redis script's ordering guard: an older computation must not replace a newer value.

The cache is disposable. Both runners clear all keys in that cache. Do not point them at another Redis.

## Measure the full page

Publish a snapshot from the synthetic catalog with the repository's development publisher. Use an empty environment and the loopback egress guard from the local verification recipe. The snapshot Redis is separate from the app cache.

```sh
cd goodwatch-webapp
env -i PATH="$PATH" HOME="$HOME" \
  TMPDIR="$HOME/.cache/gw-perf/scratch-stats" \
  NODE_OPTIONS=--import=/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/bench2/block-egress.mjs \
  CRATE_HOSTS=127.0.0.1 CRATE_PORT=15873 CRATE_USER=crate CRATE_PASS= \
  TITLE_SNAPSHOT_REDIS_URL=redis://127.0.0.1:6476 SENTRY_AUTH_TOKEN= \
  node node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs \
  scripts/write-title-snapshot.ts --movies=800 --shows=300
```

Build both worktrees with the same isolated build recipe used by `goodwatch-benchmark/html-equivalence/run.sh`. From the candidate repository root, run:

```sh
node goodwatch-benchmark/stats/pages.mjs "$HOME/.cache/gw-perf/scratch-stats/base"
```

The page runner starts each production build with `env -i`, validated loopback endpoints, empty external keys, disabled page caching, and the egress guard. It checks readiness, requires a portrait with 1,000 scores, records cold and warm Server-Timing values and cache sizes, and probes a request immediately after an activity marker. It stops only the child PIDs it started.

It compares normalized rendered markup byte for byte outside the Remix loader assignment, and compares parsed loader values separately. SQL result order can change object property insertion order without changing any values. Output stays under `~/.cache/gw-perf/scratch-stats/pages/`.

For the broader repository gate, use `goodwatch-benchmark/html-equivalence/run.sh` with `GW_HTML_CHECK_CRATE_PORT=15873` and `GW_HTML_CHECK_EXTRA_PATHS='["/u/stats_synthetic/stats"]'`. That gate uses the shared bench snapshot at port 15871; the targeted page runner uses the separate 1,100-title snapshot at port 6476.

## Clean up

```sh
docker stop gw-perf-stats-crate gw-perf-stats-cache gw-perf-stats-snapshot
```

See [the measurement report](../../docs/benchmarks/profile-stats-data.md) for results and limitations.

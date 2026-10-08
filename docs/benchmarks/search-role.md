# Search role benchmark

This page belongs to "Benchmark the search role behind the webapp's route and behind the proxy" for the map "Serve a
viral traffic spike". It feeds "Decide whether search becomes its own service".

**Status on October 8, 2026: not measured.** The measurement scripts are written. The build was written by Codex and
is not reviewed. No container was started, no search was sent, and this page holds no result table. See
[What stopped the work](#what-stopped-the-work).

## What the benchmark compares

- **Variant 1, proxy in front:** the load generator sends `/api/combined-search` and `/api/command-palette` straight
  to the search role.
- **Variant 2, webapp in front:** the load generator sends them to the page role, which calls the search role's
  internal endpoints.
- **Encoder settings in the search role:** one encoder with N threads, K encoders with their own threads, and
  ONNX Runtime thread spinning on or off.
- **In-flight limit:** 4 (today) and 64, so that the limit doesn't hide the search role's capacity.

## Planned method

The method follows "Measure the search footprint in the webapp process"
(`docs/research/viral-spike/search-footprint.md` on the branch `research/search-footprint`), so that the numbers
compare:

- **Host:** the generator host, 4 vCPUs, which also runs k6. Every result must state that limit.
- **Containers:** one page role and one search role of the same image, on their own Docker network, with their own
  throwaway Valkey (a single-node cluster). The title snapshot keys are copied in. Crate and Qdrant are production,
  read only.
- **No paid call and no write:** the search role runs with `GW_BENCH_NO_WRITES=1` and recorded readings. The
  environment holds no reading key.
- **Page mix:** 2 warm title pages and 2 title page misses per second, 60 seconds, open model. The page role runs
  with `PAGE_CACHE=off`, so a warm page is still rendered, as in the footprint measurement.
- **Search load:** 5, 20, and 40 ranked searches per second with `discover: true`, three runs each. The vector cache
  is off, so every search runs the encoder. The title lookup cache is warmed by one pass before the load, so the load
  sends no TMDB request per search.
- **Per run:** page p95 warm and miss, search p50 and p95, the share of searches that end ranked within 1,500 ms, the
  busy share, CPU per thread group and resident memory per process, and the event-loop delay of both processes.
- **Also planned:** 20 command palette lookups per second per variant, searches without pages for the page role's
  main-thread time per search in variant 2, and one run per variant in which the search role is stopped after 20
  seconds.

## Scripts

All in [`search-role/scripts/`](search-role/scripts/). None of them has run against containers yet.

| Script | What it does |
| --- | --- |
| `build-inputs.py` | Builds `readings.json` and the query list from the search arena captures of the branch `proto/search-simplify` |
| `setup.sh` | Creates the Docker network and the throwaway Valkey |
| `copy-snapshot.mjs` | Copies the title snapshot keys from the production cache cluster (read only) |
| `titles.mjs` | Writes the movie paths for the title page misses from one `SELECT` on Crate |
| `start.sh` | Starts the page role or the search role with settings and waits until it's ready |
| `warm.py` | One search at a time over the query list. Warms the title lookups and selects the texts that end ranked |
| `mixed.js` | The k6 script: page mix, ranked searches, palette lookups, and the outcome counters |
| `run.sh` | One run, with CPU per thread group, memory, event-loop delay, stage times, and k6's numbers |
| `matrix.sh` | The runs in order. Waits while another measurement runs and stays out of the data job windows |

## Settings the build adds

Requested from Codex. Not reviewed, so the names are the request's, and the behavior isn't confirmed.

| Setting | Values | Effect |
| --- | --- | --- |
| `WEBAPP_ROLE` | `page`, `search`, `both` (default) | The page role loads no models, no search index, and no people index |
| `SEARCH_ROLE_URL` | A base URL, page role only | Set: variant 2, the page role's routes call the search role. Unset: variant 1, the page role answers busy for a search and from TMDB for the palette |
| `SEARCH_ROLE_KEY` | A shared secret | The search role's internal endpoints answer 404 without it |
| `SEARCH_ROLE_TIMEOUT_MS`, `SEARCH_ROLE_BODY_TIMEOUT_MS`, `SEARCH_ROLE_PALETTE_TIMEOUT_MS` | 2000, 15000, 500 | Time until the search role's headers, its whole body, and a palette answer |
| `SEARCH_ENCODER_WORKERS` | 1 to 16, default 1 | Number of encoders. Each loads both models with `SEARCH_ENCODER_THREADS` threads |
| `SEARCH_ENCODER_SPINNING` | `0`, `1`, unset | ONNX Runtime's `session.intra_op.allow_spinning` |
| `GW_BENCH_NO_WRITES` | `1` | No history row, and the reading stage never touches the search store: a recorded reading or a basic search |
| `GW_BENCH_READINGS` | A file | Recorded readings by reading text |
| `GW_BENCH_NO_VECTOR_CACHE` | `1` | Every search runs the encoder |
| `GW_BENCH_TITLE_TTL_MS` | Milliseconds | Lifetime of the in-process title lookup cache |

### Variant 2's internal contract, as requested

- `POST <SEARCH_ROLE_URL>/internal/search` with `X-Search-Role-Key` and the JSON body
  `{ q, filters, lesserKnown, allTitles, fullList, accountId, networkIdentity }`. The page role sends it after the
  session check, so the account id is a value, not a promise. The answer is the browser's newline-delimited JSON
  stream without taste, or 503 with `Retry-After` when the search role's in-flight limit is reached.
- The page role passes a guest's body through unchanged and adds taste to a member's `batch` line. No answer within
  the timeout, a connection error, or another status becomes the existing busy answer.
- `GET <SEARCH_ROLE_URL>/internal/command-palette?q=` answers `{ titles }`. On any failure the page role answers from
  TMDB.

## One finding from reading the code

`onnxruntime-node` runs a session's `run` on the JavaScript thread that calls it, so K encoders are K worker threads
with their own sessions. Each encoder then holds its own copy of both models, about 1.3 GB by the footprint
measurement. Four single-thread encoders need about 5.3 GB for the models alone, which doesn't fit next to a page
role and k6 on the generator host's 7.75 GB. The plan was to measure 2 and 3 single-thread encoders and 2 encoders
with 2 threads. This is read from memory of the library's binding and from the footprint numbers. It wasn't confirmed
by a run.

## What stopped the work

- The production settings that the containers need (Crate, Qdrant, TMDB, Supabase) were copied from the production
  container to the generator host, host to host, without printing a value, as the footprint measurement did.
- Right after that, the session's permission check refused two local commands, with the reasons "Production Reads" and
  "Credential Materialization": reading Codex's log, and showing the diff of Codex's changes. Both are needed to
  review the build.
- The lane didn't work around the refusals. It removed the copied settings files from the generator host again and
  stopped.

## What wasn't verified

- Nothing was measured.
- The build wasn't reviewed or started. It's a local commit on the lane's branch and isn't pushed, because the lane
  couldn't read it. `npm run typecheck` reports no error in a file the build touches, and the tests of
  `app/server/search-runtime/` and `app/server/role.test.ts` pass (17 of 17). The other test files weren't run.
- That a ranked search in this setup writes nothing to production Crate. The planned check: row counts of
  `doc.search_history`, `doc.search_interpretations`, and `doc.search_spending` before and after a warm pass.
- The scripts. They were written from the footprint measurement's scripts and haven't run.

## State of the generator host

`/opt/gw-search-role/work/` holds `readings.json` and `queries-all.json` (test set texts, no visitor data, no
credentials). No container, network, image, or settings file of this benchmark exists there.

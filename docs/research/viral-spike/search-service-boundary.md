# Where a service boundary cuts through search

This page answers "Research: where a service boundary cuts through search" for the map "Serve a viral traffic spike".
It feeds "Decide whether search becomes its own service". It lists facts and contracts. It makes no recommendation and
changes no code.

Read on October 8, 2026, from `main` at commit `aef43052`. Paths are relative to `goodwatch-webapp/` unless they start
with `docs/` or `goodwatch-flows/`. Line numbers refer to that commit.

## How to read this page

- **Read from code** means the statement follows from the cited lines.
- **Measured** means a number from "Measure the search footprint in the webapp process"
  (`docs/research/viral-spike/search-footprint.md` on the branch `research/search-footprint`), from
  `docs/implementation/search-ranking/README.md`, or from an issue resolution. Those numbers were not measured again.
- **Inferred** marks arithmetic on measured numbers, or a conclusion that no code line or measurement states directly.
- Nothing was run against a server. No search was sent, because a search writes a history row to production Crate.

## Summary

- **One search touches every store.** A ranked search with a fresh reading sends 3 to 5 Qdrant requests, about 12 to
  18 Crate statements, 5 Redis commands, 2 TypeSafe requests, and up to 5 TMDB requests, all from the main thread
  (inferred from the code, by counting calls).
- **The 84 ms has no profile.** The raw rows of the footprint measurement show three things: a basic search costs
  23 ms, an English ranked search 76 ms, and a non-English ranked search 202 ms. The encoder isn't part of it: searches
  that encoded nothing cost the same. The 84 ms leaves out the reading's bookkeeping, the history row, the session
  check, and member taste.
- **Search has eight ties to the rest of the webapp.** The two that carry state are the command palette (it reads the
  search index's title table in process) and member taste (it needs the title snapshot and the taste store). The
  title snapshot holds no title text, so it can't replace the title table for the palette.
- **Three of the five boundaries add no network contract.** In process, a worker thread, and a search role of the
  same image keep today's browser contract. A dedicated service adds one contract with the webapp and moves the
  Windmill contract to the service. An encoding service adds one contract and makes the model contract three-way.
- **Memory per page-serving instance:** about 2.35 GB today, 0.59 GB when search leaves it entirely, and 0.84 GB when
  it keeps the search index (measured on October 4, 2026, before the index load moved to a worker thread).

## What changed since the footprint measurement

The footprint page describes the build of commit `dba07e44` (October 4, 2026). Since then:

| Change | Source | Effect on the footprint page |
| --- | --- | --- |
| At most 4 searches run per process, and a further one gets a 503 busy answer | "Answer busy when too many searches are in flight", `app/server/search-runtime/admission.server.ts:9-50`, `limits.server.ts:5-15` | Its option 4 is built. No load number yet |
| The encoder's thread count is a setting, by default half the cores and at most 4 | "Make the search encoder's thread count a setting", `limits.server.ts:20-28` | Its option 1 is built. Both production instances log 4 threads |
| The encoder starts for a search only after a fresh reading is claimed, and the models don't load without a storage key | "Start the search encoder only when a reading is possible", `app/server/combined-search/search.server.ts:61`, `:535-543` | Its option 5 is built. "A basic search still runs the encoder" no longer holds |
| The search index and the title snapshot load in worker threads | "Parse the search index and build the title snapshot off the main thread", `app/server/search-ranking/search-index.server.ts:285-346` | The 2.4 to 2.6 s stall is gone (69 to 109 ms per index reload on the measurement host). Idle memory was about 0.2 GB lower, and the peak during an index load 0.4 to 0.5 GB higher for about 8 s |
| The model files are in the image | "Prepare vector1 and the app for a second webapp instance", `Dockerfile:38-42`, `:54`, `:59` | "The Dockerfile doesn't download them" no longer holds. No model volume is needed |
| The title snapshot starts at server start | `app/entry.server.tsx:29` | "The title snapshot starts with the first page request" no longer holds |
| Two webapp instances run, on abio and vector1 | The map's Notes and Decisions so far | Every per-process number now applies twice |
| Readiness waits for the first index load | `search-index.server.ts:240-249`, `docs/webapp-deploys.md:40-41` | New. It doesn't wait for the encoder |

One statement of the footprint page doesn't match the code: it names the title snapshot as another source for the
command palette's titles. The snapshot's columns hold point ids, genres, release days, votes, popularity, scores,
flags, moods, and fingerprints, and no title text (`app/server/title-snapshot/snapshot.server.ts:53-71`,
`format.server.ts:111-122`).

## 1. The stages of one search

`POST /api/combined-search` runs the route (`app/routes/api.combined-search.ts`) and then `combinedSearch`
(`app/server/combined-search/search.server.ts:439-685`). Stages 2 to 5 overlap in time: the title lookup, the session
check, and the taste load run alongside the reading.

"Memory" is state in the process. "Session", "taste", and "quota" are named where a stage reads or writes them.

| # | Stage | What it does | Process memory | Redis | Crate | Qdrant | Outside | Session, taste, quota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Route (`api.combined-search.ts:17-149`) | Origin check, in-flight limit, body of at most 8,192 bytes, filter parsing, network identity from the trusted header | In-flight counter (`admission.server.ts:11`) | None | None | None | None | Quota: 4 in flight per process, else 503 |
| 1 | Session check (`api.combined-search.ts:77-86`, `app/utils/auth.ts:16-28`) | Resolves the account from the cookie while the search starts. The response waits for it, because it carries the session cookies (`:137`) | Session memo per process (`app/utils/auth-session.ts`) | None | None | None | Supabase, for a signed-in person | Session: read |
| 2 | Member taste (`taste-rows.server.ts:11-20`) | Loads the member's taste while the search runs. Guests get none | Title snapshot (`app/server/taste/member.server.ts:155-177`) | `taste:v2:<user>` and `taste:touched:<user>` | Ratings and Want to See, only on a rebuild | None | None | Taste: read. Feature flag `filterBar` |
| 3 | People step (`search.server.ts:468-478`, `app/server/search-people/people.server.ts:177-197`) | Finds names inside a longer phrase and narrows the search to the people's shared credits | People index, about 55,000 people, refreshed after 24 hours (`people.server.ts:48-94`). Credits cache, 1,000 people for 1 hour (`:56-57`, `:124`) | None | `person` at load. `person_appeared_in` and `person_worked_on` per named person on a cache miss (`:129-142`) | None | None | None |
| 4 | Title lookup (`search.server.ts:92-230`, `:293-307`) | TMDB multi-search, up to 5 pages, then the catalog rows of the matches | Lookup cache, 200 texts for 10 minutes (`:84-91`) | None | `movie` and `show` by id (`catalog.server.ts:48-64`) | None | TMDB | None |
| 5 | Language step (`language.server.ts:88-104`) | Routes the text as English or not, from word lists. A paid translation exists behind `SEARCH_TRANSLATION_ENABLED`, off by default | Word lists in code | Only with translation on | Only with translation on | None | OpenRouter, only with translation on | Quota, only with translation on |
| 6 | Reading (`search-runtime/runtime.server.ts:152-379`, `store.server.ts`) | Cache lookup, then for a fresh reading: budget check, admission, two parallel Jev requests with a 1,500 ms deadline, settlement, cache write | Storage key for digests and sealing (`store.server.ts:68-96`). Keep-alive connections to TypeSafe (`runtime.server.ts:36-59`) | Reading cache for 24 hours, lock, lease of 16 concurrent, rate counters of 240 per minute overall and 20 per scope (`coordination.server.ts:5-34`, `:55`) | `search_interpretations`, `search_spending`, `search_control` (`store.server.ts:97-279`) | None | TypeSafe | Session: the account scope waits for it (`runtime.server.ts:218-222`). Quota: rate limits, 1 USD per day and 5 USD per month (`store.server.ts:12-13`, `:134-140`) |
| 7 | Query encoding (`search-ranking/query-encoder.server.ts:247-303`, `query-encoder.worker.js`) | One batch per model, early (texts known without the reading, started at the claim) and late (what the reading adds) | Two ONNX sessions in one worker thread. Vector cache of 500 requests (`:228`). Queue limit of 32 (`:23`) | None | None | None | None | None |
| 8 | Qdrant calls (`rank-search.server.ts:327-364`, `:694`, `:710`, `:816`) | A reference's profile or seed vectors (0 or 1 request), the top lists (1), the non-English rescore (0 or 1), the pool scores (1) | Keep-alive agent with 16 sockets (`qdrant-http.server.ts:60-70`) | None | None | `media_fingerprint_v1`, `search_reference_profiles` | None | None |
| 9 | Ranking (`rank-search.server.ts:399-1080`, `serve.server.ts:85-106`) | Query parsing, the filter as a row test over the title table, scoring, the non-English mix statistics, the blend with the title lookup. Deadline of 1,500 ms | The search index (`search-index.server.ts:131-156`) | None | None | None | None | Quota: a ranking past its deadline keeps its in-flight slot (`serve.server.ts:97`) |
| 10 | Display fields (`search.server.ts:362-415`, `reading-retrieval.server.ts:633-680`) | Payloads and reason chips of the first 50 titles from Qdrant, catalog rows of up to 100 titles, one row per IMDb title, people to show | Known-for cache (`people.server.ts:199`) | None | `movie` and `show` by id. Known-for titles of shown people | `media_fingerprint_v1`, one retrieve | None | None |
| 11 | Taste on the rows (`api.combined-search.ts:117-123`, `taste-rows.server.ts:31-57`) | Adds `tasteMatch` and `moved` to each row for a member | Taste from stage 2 | None | None | None | None | Taste: applied |
| 12 | Response | Newline-delimited JSON: a `reading` line when the interpretation is known, then a `batch` or `error` line | None | None | None | None | None | None |
| 13 | History row (`search.server.ts:653-670`, `store.server.ts:304-335`) | Written after the response, with the sealed text, the account, the outcome, the ranker version, and the stage times | Storage key | None | `search_history` insert | None | None | Session: the account id |

A search without a reading, or one the ranking can't serve, runs the basic search in place of stages 7 to 10: two
Crate full-text statements, the catalog rows, and the blend (`search.server.ts:233-265`, `:597-646`). The reasons are
in `serve.server.ts:54-72`: no reading, index not loaded, encoder not ready, encoder queue full, timeout, error.

### Calls per search, counted from the code

| Store | Cached reading | Fresh reading |
| --- | --- | --- |
| Qdrant | 3 to 5 requests | 3 to 5 requests |
| Crate | About 3 to 9 statements (catalog rows, credits, known-for titles, history), plus 1 on a Redis miss of the reading cache | About 12 to 18 statements: the above plus 2 selects and 2 inserts for the claim, 1 select for the dispatch, and 2 selects, 1 update, and 1 insert for the settlement |
| Redis | 1 `GET` | 1 `GET`, 3 `EVAL`, 1 `SET` |
| TypeSafe | None | 2 requests, more after a 529 answer |
| TMDB | 0 to 5 requests | 0 to 5 requests |

The counts are inferred by counting calls in the cited functions. They weren't traced on a server.

### Where each store's client lives

- **Crate, for search text:** search has its own HTTP path that bypasses the general SQL logger and uses only the
  first host of `CRATE_HOSTS` (`catalog.server.ts:5-27`). The index loader tries every host (`search-index-build.server.ts:101-123`).
  The people credits use the general client (`people.server.ts:4`).
- **Redis:** the webapp's cluster client (`coordination.server.ts:2`). All search keys share the hash tag
  `{goodwatch-search-v2}`, so they sit in one slot on one node (`coordination.server.ts:5-11`).
- **Qdrant:** search has its own REST client over `node:http` (`qdrant-http.server.ts`), separate from the gRPC client
  that related titles use.

## 2. Where the main-thread time goes

### What the 84 ms is

Measured in the footprint measurement: 83.5 ms of main-thread CPU per search, averaged over 168 ranked searches, one
at a time, on a 4-core host, on the build of `dba07e44`. The search asked for 100 rows (`discover: true`), every
search ran the encoder, and the TMDB lookup was cached.

The 84 ms doesn't include these, because the measurement build replaced or skipped them:

- The reading's bookkeeping: cache lookup, claim, dispatch, both Jev requests, and settlement. For a fresh reading
  that's about 9 Crate statements, 5 Redis commands, 2 TypeSafe requests, the digests, and the sealing.
- The history insert.
- The session check and member taste (the measurement sent no session).
- The TMDB lookup after the first pass.

No CPU profile of a search exists. The footprint page lists one as an option that isn't built.

### What the raw rows show

Computed for this page from the measurement's raw rows (`search-footprint/raw/pass1.jsonl` to `pass3.jsonl`), which
hold per-search CPU time per thread group:

| Group | n | Main thread, average | Note |
| --- | --- | --- | --- |
| All ranked searches, pass 3 | 168 | 83.5 ms | Median 71.0, 10th percentile 51.1, 90th percentile 113.2, maximum 280.2 |
| English ranked | 158 | 76.0 ms | Response 111 KB on average |
| Non-English ranked (`native-vector-only`) | 10 | 202.4 ms | Response 104 KB on average |
| English ranked that encoded nothing | 10 | 88.2 ms (68.4 ms in pass 2) | The encoder threads used no CPU in these searches |
| Basic search, pass 2 | 28 | 23.0 ms | Response 11 KB |
| All ranked, first pass against second | 140 | 92.1 ms against 79.8 ms | The first pass fetched the TMDB pages. It was also the first run of each code path |
| Basic, first pass against second | 28 | 40.4 ms against 23.0 ms | Same |

Other threads: V8's helper threads used 13.8 ms per search on top (garbage collection and compilation, inferred from
the thread name). The libuv pool used 0.1 ms.

Across the English ranked searches, the main-thread time correlates weakly with the response size (0.09 to 0.25 over
the three passes) and with the encoder's CPU time (0.22 to 0.43).

### What follows from them

| Share | Size | Basis |
| --- | --- | --- |
| Work a basic search also does: the route, the people step, the language step, a cached title lookup, catalog rows, a blend, a small response | About 23 ms | Measured for the basic search. Inferred as a floor for a ranked search, because the two paths share those steps and not the rest |
| The ranking, the display fields, and the 100-row response, for an English search | About 50 ms | Inferred: 76 ms minus 23 ms |
| The extra of a non-English search | About 125 ms | Inferred: 202 ms minus 76 ms |
| The TMDB lookup on a cache miss | At most 12 to 17 ms | Inferred from the first pass, which also paid for first runs of the code |
| Receiving the encoder's vectors | Not visible | Searches without encoding cost the same |

### What runs on the main thread inside those shares

Read from code. None of these has its own CPU number.

- **Building the Qdrant requests.** Every vector is turned into a plain array (`rank-search.server.ts:518`) and
  serialized with `JSON.stringify` (`qdrant-http.server.ts:119`). The pool-score request repeats the list of all pool
  ids in the filter of every query (`rank-search.server.ts:762-779`).
- **Parsing the Qdrant responses.** `JSON.parse` of the whole body per request (`qdrant-http.server.ts:127`, `:154`).
  The client's header comment gives 200 KB to 1 MB for large responses (`qdrant-http.server.ts:10-11`). Depths: 500
  for main lists, 300 for part lists, 2,000 for each non-English list (`ranking.server.ts:54-58`).
- **The filter as a row test.** One pass over every row of the title table per search, a second with an era
  (`search-filter.server.ts:94-110`).
- **Scoring.** Z-scores and weighted sums over the candidate pool per signal (`rank-search.server.ts:825-1000`).
- **The non-English mix statistics.** Two passes over the int8 vectors of every title, 384 and 768 dimensions
  (`rank-search.server.ts:179`, `:733-748`). Measured in the ranking benchmark at 33 ms on the benchmark machine, with
  production processors estimated 2 to 3 times slower (`docs/implementation/search-ranking/README.md`, "Index files").
  This and the rescore request are the code paths only a non-English search with English chips takes.
- **The blend.** It runs twice per search since the list has 100 titles: once for the first 50 and once for all
  (`rank-search.server.ts:1032-1055`). It includes the fuzzy title match over the index's title names
  (`title-blend.server.ts:144-150`).
- **The display stage.** Parsing 50 payloads with fingerprint scores, building reason chips, and one title match per
  row (`reading-retrieval.server.ts:633-680`, `search.server.ts:382-415`).
- **The response.** `JSON.stringify` of the batch, about 105 KB (`api.combined-search.ts:98-99`).
- **The reading.** Unsealing and parsing a cached reading, and decoding it twice: once for the chips and once for the
  ranking's fields (`search.server.ts:560-564`, `:343-347`, `reading-retrieval.server.ts:781-818`).

### Stage timings that bound single pieces

These are wall times, not CPU times.

| Piece | Timing | Source | What it bounds |
| --- | --- | --- | --- |
| Scoring and blend | 12 ms at p50, 38 ms at p95 | Measured on September 25, 2026 on the webapp host, one search at a time (`README.md`, "Rollout: stage timings and shadow mode") | Synchronous code, so wall time equals main-thread time. Measured for a 50-title list, before the second blend pass and before the fuzzy title bound |
| Qdrant rounds 1 and 2, wall minus Qdrant's own time | 8 ms and 13 ms at p50 | Same measurement: 43 against 35 ms, 28 against 15 ms | An upper bound for building and parsing those two requests, since it also holds the network time |
| Qdrant, wall minus Qdrant's own time, in production | 71 ms at p50 for a fresh reading, 195 ms for a cached one | Footprint page, production stage times: 170 against 99 ms, 418 against 223 ms | Includes waiting for the event loop next to page renders |
| Display | 42 ms at p50, 116 ms at p95 | Footprint page, production stage times | Includes the Qdrant retrieve and the Crate statements |

## 3. Ties between search and the rest of the webapp

| # | Tie | What crosses | Source |
| --- | --- | --- | --- |
| 1 | Command palette and the index's title table | `GET /api/command-palette` scans the folded titles and original titles of the loaded search index in process, sorts by the table's votes, and maps rows to point ids. It then reads display fields from the title cards cache and stores the answer per prefix in Redis for 6 hours. It uses the index's text rule `fold`. While no index is loaded, it starts the index load and answers from TMDB | `app/server/command-palette.server.ts:30-44`, `:48-72`, `:82-122`, `:127-151`, `app/routes/api.command-palette.ts` |
| 2 | Title snapshot | The ranking doesn't read it. Three things near search do: member taste (tie 4), the palette's TMDB fallback (it sorts known titles first, `command-palette.server.ts:144-149`), and Discover's results endpoint (tie 7). The snapshot has no title text | `app/server/taste/index.server.ts:16-20`, `app/server/title-snapshot/snapshot.server.ts:53-71` |
| 3 | Session check | The route verifies the session with the webapp's auth module. The account id feeds the per-account rate scope before a paid call, the history row, and the taste load. The response carries the session's `Set-Cookie` headers. A failed check stops the search with a 503 | `app/routes/api.combined-search.ts:77-86`, `:137`, `app/utils/auth.ts:16-28`, `search-runtime/runtime.server.ts:218-222` |
| 4 | Member taste | For a member with the filter bar on, each row gets `tasteMatch` and `moved`. The taste module reads the title snapshot and the taste store in Redis, and rebuilds from Crate when the stored taste is stale. The request's `forYou` switch decides `moved` | `app/server/combined-search/taste-rows.server.ts`, `app/server/taste/member.server.ts:155-177`, `app/domain/for-you.ts` |
| 5 | Quotas and budgets | Shared across processes: the reading cache, the lock, the 16 concurrent paid readings, and the rate counters in Redis, and the spending and the halt switch in Crate. Per process: the in-flight limit of 4, the encoder queue of 32, the vector cache, the title lookup cache. The network identity comes from a header the proxy must set (`SEARCH_TRUSTED_IP_HEADER`). Without it every guest shares one scope | `search-runtime/coordination.server.ts`, `store.server.ts:111-205`, `limits.server.ts`, `api.combined-search.ts:64-70`, `goodwatch-proxy/traefik/goodwatch-instance.yaml:16-20` |
| 6 | History row | One `search_history` insert per search after the response, sealed with `SEARCH_STORAGE_KEY`. The same key seals stored readings and derives every cache key and rate scope | `search.server.ts:653-670`, `store.server.ts:68-96`, `:304-335` |
| 7 | Discover's free-text search | The Discover loader runs no search. The browser posts to `/api/combined-search` with `discover: true`, keeps the title keys, and sends them to `/api/discover/results` as `ranked`. That endpoint filters the list in memory with the title snapshot and uses no search code. The filter bar's choices become the search's eligibility in a module both sides share | `app/ui/discover/useDiscoverSearch.ts:39-88`, `app/domain/discover-search.ts:47-64`, `app/routes/api.discover_.results.ts`, `app/routes/discover.($type).tsx:306-307` |
| 8 | Prototype search routes | `prototype.jev-search` and `prototype.jev-vector` have no production guard. Each request calls TypeSafe directly and Qdrant through the general client. They share no code with the search modules: no encoder, no index, no admission, no spending record. `prototype.combined-search` and `prototype.search-translation` answer 404 in production | `app/routes/prototype.jev-search.tsx:11-29`, `prototype.jev-vector.tsx:7-20`, `prototype.combined-search.tsx:8`, `prototype.search-translation.tsx:5`, `app/server/prototype-jev-search.server.ts:195`, `:235`, `:425-459`, `app/server/prototype-jev-vector.server.ts:72`, `:113`, `:750-754`, `:888` |

Smaller ties, all read from code:

- **Start at import.** Importing `search.server.ts` starts the index load, the model load, the people index, and the
  TypeSafe pings (`search.server.ts:60-65`). The server bundle imports every route at start, so every process that
  runs the image loads search. No setting turns it off, other than leaving out `SEARCH_STORAGE_KEY`, which skips only
  the models (`limits.server.ts:30-33`).
- **Readiness.** `/health/ready` waits for the first index load (`search-index.server.ts:240-249`).
- **The per-minute process line** reports the encoder's state (`app/server/process-stats.server.ts:8`, `:22-26`).
- **Shutdown and metrics.** Search registers with the webapp's shutdown sequence and its metrics registry
  (`query-encoder.server.ts:164`, `search-index.server.ts:221`, `admission.server.ts:7`).
- **Shared types and pure code.** The server's blend and title match live in a UI module that the browser also
  imports (`app/ui/search/search-model.tsx:36`, `:58`, imported at `search.server.ts:3-8`). The browser imports the
  response types from server modules (`useDiscoverSearch.ts:7-12`). The reason chips read the fingerprint labels from
  a UI module (`reading-retrieval.server.ts:10`).
- **Feature flags.** `REC_FILTER_BAR` decides whether the route serves 100 rows and whether taste is added
  (`api.combined-search.ts:90-91`, `taste-rows.server.ts:15`). `REC_NAVIGATION` gates the palette endpoint.
- **Other endpoints.** `GET /api/search-config` returns a version string and is fetched only by the old search page
  (`app/ui/search/SearchJourney.tsx:216`). `GET /api/search` is the TMDB search that the palette's fallback uses
  through `getSearchResults`. `/search?q=` redirects to `/discover?q=` while the filter bar is on
  (`app/routes/search.tsx:30-41`).
- **Build.** The encoder worker and the index worker are separate entry files next to the server bundle
  (`vite.config.js:26`, `:31`). The image's model stage depends on `query-models.server.ts` and one script
  (`Dockerfile:38-42`).

## 4. The contract with Windmill

ADR 0002 states it: the model names, the text preparation, and the vector names form one contract between Windmill
and the webapp, and a change means embedding the catalog again and releasing both sides together
(`docs/adr/0002-local-text-embeddings-for-search.md`, "Consequences"). Its parts, read from code:

| Part | Webapp side | Windmill side |
| --- | --- | --- |
| Models, pooling, query prefix, normalization | `search-ranking/query-models.server.ts:46-105`, `query-encoder.worker.js:43-102`. Queries are cut at 128 tokens (`query-encoder.worker.js:17`) | `goodwatch-flows/windmill/f/search/text_encoder.py:49-62`. The `bge-base` model file and both tokenizer files have the same SHA-256 on both sides. The multilingual model file differs (the webapp uses the Xenova export) |
| Collections and vector names | `rank-search.server.ts:76-84`: `media_fingerprint_v1`, `search_reference_profiles`, `fingerprint_v1`, `fingerprint_v1_raw`, `text_en_v1`, `text_multi_v1`, `terms_bm25f_v1` | `f/search/embed_titles.py`, the fingerprint publish |
| Payload keys in filters and display | `search-filter.server.ts:38-93`, `reading-retrieval.server.ts:574-583` | The Qdrant writers |
| Point ids | Movies at 1e12 plus the TMDB id, shows at 2e12 (`reading-retrieval.server.ts:639-640`) | Same scheme |
| Index files | Ten gzipped JSON files per build, read from the blob table `search_index_files` through the manifest row in `search_index_builds` (`search-index-build.server.ts:22-33`, `:101-123`). The loader doesn't check the manifest's `format` field | `f/search/build_indexes.py` (`FORMAT_VERSION = 1`), `f/search/index_builders.py` |
| Text rules | `search-ranking/text-rules.server.ts`, a port | `f/search/terms.py` |
| Intent examples | The query's intent vector is compared with example vectors from the index file (`references.server.ts:171`) | Encoded by the index build with `multilingual-e5-small` |
| Crate tables | `search_interpretations`, `search_spending`, `search_control`, `search_history`, `search_index_builds`, `search_index_files` | Defined in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py:832-920`, `:1084` |

A second contract keys the stored readings: `d4+/<Jev model>/<question version>/<language mode>/<language version>`
(`search-runtime/runtime.server.ts:176`). A change to any part makes every cached reading a miss.

## 5. The five candidate boundaries

For each: what crosses the boundary, what the far side must hold, and what must be released together. Memory and
copy counts are in [section 6](#6-memory-and-copies).

### A. In process (today)

- **Contract:** function calls. The only network contract is the browser's:
  - Request: `POST /api/combined-search`, JSON of at most 8,192 bytes:
    `{ q, filters, lesserKnown, allTitles, discover, forYou }` (`api.combined-search.ts:56-114`). `filters` is
    `{ type, anime, genres, minYear, maxYear, streaming }` (`combined-search/search-filters.ts:3-15`).
  - Response: `application/x-ndjson`, `private, no-store, no-transform`. A line `{ kind: "reading", reading }`, then
    `{ kind: "batch", batch }` or `{ kind: "error", error }`. `batch` is `SearchBatch`: `q`, `rows`, `reading`,
    `metadata`, `errors`, `mode`, `elapsedMs`, `chargedNano`, `people`, `creditScope` (`search.server.ts:67-80`).
  - Other answers: 503 with `Retry-After: 2` when 4 searches are in flight, 400, 403, 405, 413.
- **Far side holds:** nothing new.
- **Released together:** the webapp and Windmill, as in section 4.
- **Per process, not shared between instances:** the in-flight limit, the encoder queue, the vector cache, the title
  lookup cache, the credits cache. Two instances admit 8 searches in flight.

### B. A ranking worker thread

No such thread exists. The cut that the code offers is `rankSearch` with `prepareSearch`
(`rank-search.server.ts:268`, `:399`).

- **Request across the thread boundary:** the decoded reading (`ReadingFields`: flags, concrete words, phrases, 74
  weights, chips, `reading-retrieval.server.ts:760-773`), the request (`query`, `text`, `nonEnglish`, and the allowed
  title lookup rows of 6 fields each, `title-blend.server.ts:17-24`), and the eligibility with its filters. The
  people step's `onlyTitles` list rides in the filters.
- **Response:** `RankedSearch`: up to 100 titles of 5 fields each, the ranker version, the build id, the timings, and
  the Qdrant rounds (`rank-search.server.ts:120-138`, `title-blend.server.ts:39-45`). A few kilobytes (inferred from
  the shapes). The 105 KB response is built after the ranking, in the display stage.
- **What doesn't cross as it is:**
  - Today's early start hands a promise of the prepared part from one call to the next (`search.server.ts:537-543`,
    `rank-search.server.ts:411`). Across threads that becomes two messages tied by an id.
  - `servingFallback` reads the index's and the encoder's state synchronously before a search
    (`serve.server.ts:63-72`). The main thread would need that state mirrored.
  - The deadline's timer and the in-flight hold run where the route runs (`serve.server.ts:85-106`).
- **The worker must hold:** the search index, its own Qdrant connections, and a path to the encoder. Module state is
  per thread, so a worker that imports the encoder module starts its own encoder worker, with its own vector cache
  (inferred from how `query-encoder.server.ts:83-87` keeps its state).
- **The index:** it's a mix of typed arrays, string arrays, and maps (`search-index.server.ts:41-156`). Today a
  per-load worker hands it to the main thread in bounded pieces, and typed arrays move without a copy
  (`search-index-pieces.server.ts:92-95`). Strings and maps are copied. If the index lives in the ranking worker, the
  command palette on the main thread needs its own copy of the title table's `titles`, `originalTitles`, `votes`,
  `pointIds`, and `flags`, or a message to the worker per uncached prefix.
- **Stays on the main thread:** the route, the session, taste, the people step, the title lookup, the reading and its
  bookkeeping, the display stage, the response, the history row.
- **Leaves the main thread:** building and parsing the ranking's Qdrant requests, the row filter, scoring, the mix
  statistics, the blend. How many of the 84 ms that is isn't measured.
- **Released together:** nothing new. The worker needs its own entry file in the build, like the three that exist
  (`vite.config.js:26-32`).

### C. A search role of the same image

One more container of the same image answers the search endpoint, and the page-serving containers don't load search.
The footprint measurement ran this shape with a measurement patch. `main` has no such setting.

- **Contract:** the browser contract of boundary A, unchanged, reached through a proxy path rule. The page role and
  the search role exchange no requests. They meet only in the shared stores.
- **The search role must load:** everything search loads today (index, models, people index), and the title snapshot,
  because member taste needs it (`app/server/taste/member.server.ts:155-157`). The snapshot loads at server start in
  every process (`app/entry.server.tsx:29`).
- **The search role must be given:** the same environment as the page role. That includes the session settings
  (the route verifies the cookie itself), `SEARCH_STORAGE_KEY`, the TypeSafe and TMDB keys, the Crate, Redis, and
  Qdrant settings, the feature flags, `APP_ORIGIN` for the origin check, and the trusted address header from the
  proxy.
- **The page role must stop:** the three start calls at import (`search.server.ts:60-65`), the palette's own index
  start (`command-palette.server.ts:33-36`), and the readiness check for the index. Today nothing switches them.
- **The command palette** has three shapes, each read from the code's existing paths:
  - Route `/api/command-palette` to the search role too. Its code is already in the image.
  - Keep the index in the page role. The page role then keeps 0.25 GB and the index reloads.
  - Let the page role answer from TMDB, which is the existing fallback while no index is loaded.
- **Released together:** one image and one commit for both roles, so the code can't drift. Whether both roles switch
  at the same moment in a deploy isn't verified. The Windmill contract stays as in section 4.
- **Per process:** the in-flight limit of 4 now counts only the search role's searches.
- **Measured for this shape,** on one 4-core host with a second container: 20 searches per second left the warm page
  p95 at 154 ms (footprint page, "Search in a second process on the same host").

### D. A dedicated service that owns the whole search

No such service exists. Two request shapes are possible, and they differ in who verifies the session.

**Shape 1: the webapp's route stays in front.**

- **Request from the webapp:** today's arguments of `combinedSearch` (`search.server.ts:439-450`): the text,
  `{ includeAdult, lesserKnown, filters }`, `{ accountId, networkIdentity }`, `{ allTitles, rows }`, and a way to
  cancel. Today the account id is a promise that resolves while the search runs (`api.combined-search.ts:78-86`). Over
  a network call, either the search waits for the session check, or the account id arrives in a second message.
- **Response:** the same two-step stream: the reading chips, then the batch.
- **The webapp keeps:** the origin check, the body limit, the session check and its cookies, the network identity,
  the feature flag that decides `rows`, and taste. For a member, the webapp must parse the batch to add taste to its
  rows (`taste-rows.server.ts:31-57`). For a guest it could pass the bytes through (inferred).
- **In-flight limit:** it could sit on either side. Today it's taken before the body is read.

**Shape 2: the proxy sends the browser's request straight to the service.**

- **Contract:** the browser contract of boundary A.
- **The service must also hold:** the session verification with its settings, and member taste: the title snapshot,
  the taste store, the rebuild from Crate, and the `for-you` ranking. That's the taste module, not search code.

**In both shapes the service must hold or reach:**

- The search index, loaded from Crate's blob table, with its 5-minute check for a new build.
- Both models (882 MB of files) and the encoder.
- The people index and the credits tables.
- Crate: `movie` and `show` (catalog rows and the basic search's full-text statements), `person`,
  `person_appeared_in`, `person_worked_on`, `search_interpretations`, `search_spending`, `search_control`,
  `search_history`, `search_index_builds`, `search_index_files`.
- Redis: the `{goodwatch-search-v2}` keys.
- Qdrant: `media_fingerprint_v1` and `search_reference_profiles`.
- TMDB, TypeSafe, and OpenRouter when translation is on.
- `SEARCH_STORAGE_KEY`, unchanged. A different key makes every stored reading unreadable and every cache key and rate
  scope different (`store.server.ts:68-96`).
- The trusted network identity, as a field of the request or as a header from the proxy.

**Code the service would take with it or copy:** the blend and title match in `app/ui/search/search-model.tsx`, which
the browser also imports, the fingerprint labels and key order, the search filters module, the webapp's Crate and
Redis clients, the shutdown and readiness module, and the metrics registry.

**The command palette:** an endpoint on the service that maps a prefix to title ids, or its own copy of the
`title_table` index file (6 MB as JSON, `README.md`, "Webapp") with the `fold` rule, or the TMDB fallback. The title
snapshot can't serve it.

**The basic search** lives inside `combinedSearch` (`search.server.ts:597-646`). If the service owns the whole search
and doesn't answer, the webapp has no search path left in its own code. The palette's TMDB fallback is the only
fallback outside it.

**Released together:**

- The service and Windmill, for everything in section 4. The webapp leaves that contract.
- The service and the webapp, for the request and the batch. The row shape is shared with the browser's code
  (`Row`, `app/ui/search/search-model.tsx:18-35`).
- The reading's contract string, if the service changes how it builds the Jev requests.

### E. A dedicated service that owns only encoding

No such service exists. The cut is `encodeQueryTexts` (`query-encoder.server.ts:247-275`).

- **Request:** `{ english?: string[], multilingual?: string[] }`: the query or its leftover words, facet phrases,
  coverage units, negated clauses, the intent text, and English chips. The service adds the query prefixes
  (`query-encoder.worker.js:50`).
- **Response:** one L2-normalized vector per text, in order: 768 floats for `english`, 384 for `multilingual`, with
  the queue and encode times. About 3 KB and 1.5 KB per text as raw float32 (inferred from the dimensions).
- **Calls per ranked search:** up to 2, early and late (`rank-search.server.ts:317-326`, `:485-495`). None when the
  vector cache has the request. Some searches encode nothing.
- **The service must hold:** the two models and tokenizers. No Crate, Redis, or Qdrant, no keys, no index.
- **The webapp keeps:** the search index, the ranking with all of its main-thread work, Qdrant, the reading, and
  every tie of section 3.
- **State that has to cross or move:**
  - `servingFallback` reads `ready`, `pending`, and `maxPending` synchronously (`serve.server.ts:68-70`), and the
    process line reads them each minute. Over a network call that becomes a failed or refused request.
  - The vector cache can sit on either side. In the webapp it stays per instance.
  - The queue: one worker encodes one request at a time, because parallel encodes split the same cores
    (`query-encoder.worker.js:3-4`, `:137-175`). One service would queue the requests of every webapp instance.
- **Search text leaves the process.** The code comments state that search text stays in the process and isn't written
  to a shared store or logged (`search.server.ts:81-83`, `query-encoder.server.ts:224-227`). Texts would travel to
  the service over the private network.
- **What it doesn't move:** the main-thread time. Encoding already runs off the main thread, and searches without
  encoding cost the same main-thread time (section 2). Measured in the footprint measurement: with every vector
  cached and the encoder idle, 20 searches per second still took the main thread to 95%.
- **Released together:** the model contract becomes three-way. Windmill embeds the titles and the intent examples,
  the service holds the query models, pooling, prefixes, and the 128-token cut, and the webapp holds the vector
  names, the dimensions, and the index files whose example vectors must come from the same model. The webapp's image
  no longer needs the model stage.

### Latency of a hop

Measured in the footprint measurement: a round trip between two hosts on the private network took 0.58 ms on average
and 1.7 ms at most. Not measured: a search response through a proxy, and a stream that passes through the webapp.

## 6. Memory and copies

### Measured sizes

From the footprint measurement, on `dba07e44`, one process, 73 to 93 seconds after start:

| Loaded | Resident | Peak |
| --- | --- | --- |
| No search, two starts (includes the title snapshot) | 557 MB, 618 MB | 584 MB, 632 MB |
| Search index only | 840 MB | 1,096 MB |
| Query encoder only | 1,920 MB (1,552 MB in another start) | 2,300 MB |
| Everything, as in production | 2,351 MB | 2,544 MB |
| Both models in a bare Node process | 1.27 to 1.45 GB over a 56 MB process | Not recorded |
| Model files on disk | 882 MB | |

Production held 2.54 to 2.77 GB per process on October 4, 2026. Since the index load moved to a worker thread, idle
memory was about 0.2 GB lower and the peak during an index load about 2.9 GB for about 8 seconds (resolution of
"Parse the search index and build the title snapshot off the main thread", measured on a branch build). Current
production memory wasn't read for this page.

### Per boundary

N is the number of page-serving webapp instances (2 today). S is the number of search or encoder processes.

| Boundary | Memory per page-serving instance | Memory of the far side | Model copies in memory | Index copies in memory | Model files on disk |
| --- | --- | --- | --- | --- | --- |
| A. In process | About 2.35 GB (measured) | None | N | N | In the image on every webapp host |
| B. Ranking worker thread | About 2.35 GB plus one more JavaScript heap (not measured) | Same process | N | N, plus N copies of the title table if the palette keeps its own | Same as A |
| C. Search role, palette routed to it or served from TMDB | About 0.59 GB (measured as "no search") | About 2.35 GB resident, 2.54 GB peak per search process (measured) | S | S | In the image on every host that runs either role, loaded only by the search role |
| C. Search role, palette keeps the index | About 0.84 GB (measured as "search index only") | Same | S | S plus N | Same |
| D. Dedicated service, whole search | About 0.59 GB. About 0.84 GB if the palette keeps the whole index. A copy of only the title table isn't measured | 1.7 to 1.9 GB (an inference of the footprint page, not measured). More in shape 2, which adds the title snapshot | S | S, plus N only if the palette keeps the index | In the service's image only |
| E. Dedicated service, encoding only | About 0.84 GB (measured as "search index only") | 1.3 to 1.5 GB (measured for both models in a bare Node process) | S | N | In the service's image only |

Totals for N = 2 and S = 1, by arithmetic on the rows above (inferred):

| Boundary | Total resident |
| --- | --- |
| A or B | About 4.7 GB |
| C, palette routed or from TMDB | About 3.5 GB |
| C, palette keeps the index | About 4.0 GB |
| D, shape 1, palette without the index | About 2.9 to 3.1 GB |
| E | About 3.0 to 3.2 GB |

Each further page-serving instance adds about 2.35 GB under A and B, about 0.59 GB under C and D, and about 0.84 GB
under E or wherever the palette keeps the index.

### CPU, where it was measured

- **Encoder threads:** 344 ms of CPU per ranked search with 4 threads, 183 ms with 2, on 4 cores. They move with the
  models: to the search role under C, to the service under D and E. Under A and B they stay next to page renders.
- **Main thread:** 84 ms per search stays in the page-serving process under A and E. Under B an unmeasured part
  moves to the worker thread, on the same cores. Under C and D it leaves the page-serving process, apart from the
  route's own work in D's shape 1.
- **Same host or not:** the footprint measurement ran C on one 4-core host that was 94 to 99% busy. A search process
  on another host wasn't measured.

## What wasn't verified

- **No search was run.** Stage order, call counts, and contract shapes come from reading the code, not from a trace.
- **No CPU profile.** The split of the 84 ms in section 2 is arithmetic on per-search totals and wall-time stage
  timings. The share of JSON work, of the blend, and of the display stage isn't known.
- **The 84 ms on today's code.** It was measured on `dba07e44`, on 4 cores, with recorded readings. The reading's
  bookkeeping, the history row, the session check, and member taste aren't in it. It wasn't measured on abio's 8
  cores or on vector1.
- **Current memory.** Production's processes weren't read for this page. The per-boundary numbers use the October 4
  measurement, which predates the index worker and the models in the image.
- **A dedicated service's memory.** The 1.7 to 1.9 GB is the footprint page's inference. A copy of only the title
  table for the palette wasn't sized.
- **A ranking worker thread.** Nothing was prototyped. The size of its messages, the cost of copying, and the heap of
  a second thread are inferred.
- **The search role in production.** How a second role of the same image would be deployed and routed, and whether
  both roles switch together in a deploy, wasn't checked. The role switch doesn't exist in `main`.
- **Windmill's side of the contract.** Only the model pins, the format version, the file names, and the schema file
  were read. The Qdrant writers and the index builders weren't read line by line.
- **The reachability of the two unguarded prototype routes in production.** Read from code only. No request was sent.
- **Whether both instances' proxies set the trusted address header.** Read from the proxy draft's comment only.
- **The Supabase call rate of the session check** on the search route (the map states one call per 30 seconds per
  member, and the search route wasn't traced).

## Sources

- Code on `main` at `aef43052`, cited inline.
- `docs/adr/0002-local-text-embeddings-for-search.md`.
- `docs/implementation/search-ranking/README.md`: "Architecture", "Performance benchmark", "Index files", "Rollout:
  stage timings and shadow mode", "Follow-up: search latency".
- `docs/research/viral-spike/search-footprint.md` and `search-footprint/raw/` on the branch `research/search-footprint`
  (commit `243efbe1`).
- Resolutions of "Measure the search footprint in the webapp process", "Make the search encoder's thread count a
  setting", "Answer busy when too many searches are in flight", "Start the search encoder only when a reading is
  possible", and "Parse the search index and build the title snapshot off the main thread".
- The Notes and Decisions so far of the map "Serve a viral traffic spike".
- `docs/webapp-deploys.md`, `goodwatch-proxy/traefik/goodwatch-instance.yaml`,
  `goodwatch-flows/windmill/f/search/text_encoder.py`, `build_indexes.py`, and `f/sync/models/crate_schemas.py`.

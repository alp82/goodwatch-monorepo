# Baseline cost and latency of production search (2026-09-23)

Measured from the dev machine (about 22 ms round trip to the 10.0.0.x network) against
production stores, read-only. Jev was called directly with the production request builders
(`attributeRequest`, `fingerprintRequest`, model `jev-1.13.0`), nothing was persisted.
Total Jev spend for this measurement: about 52,000 input tokens, roughly $0.0025.

Scripts (in `goodwatch-webapp/scripts/`, run with
`npx vite-node --config scripts/arena-vite.config.mjs <script>`):

- `arena-jev-cost.ts`: uncached readings, token usage from the API `usage` field, and the dimension-count scaling.
- `arena-stages.ts` (needs `ARENA_TIMED_FETCH=1`; `VECTOR_ONLY=1` forces the Qdrant path): per-call stage timings. The cache is read with Redis GET and Crate SELECT only.
- `arena-timed-undici.ts`: a timing wrapper around undici fetch, loaded through the alias config.

## 1. Jev cost per uncached reading

Price, taken from `runtime.server.ts`: 42 nano-USD per input token. Output tokens are free.

| query | attribute questions | attribute input tokens | fingerprint input tokens (148 q) |
|---|---|---|---|
| submarine standoff with a mutiny | 26 | 3,446 | 4,416 |
| cozy mystery in an english village | 27 | 3,577 | 4,413 |
| lighthouse keeper slowly losing his mind in winter | 30 | 4,004 | 4,416 |
| heist crew of retired grandmothers | 27 | 3,579 | 4,414 |
| chess prodigy rivalry in cold war moscow | 29 | 3,870 | 4,417 |
| scifi with sunglasses | – | 3,290 | 4,410 |
| dark comedy about a wedding | – | 3,429 | 4,411 |

- Mean is about 8,000 input tokens per search: 3,600 for the attribute request and 4,414 for the fingerprint request.
- Cost is about $0.00034 per uncached search, or **$0.34 per 1,000 searches**. The $1/1000 budget is achievable. Jev uses about a third of it, which leaves about $0.66 for anything else.
- The fingerprint request is 55% of the tokens. Its cost is fixed at about 330 + 27.6 tokens per question (2 questions per dimension).
  - 1 dimension: 381 tokens. 15 dimensions: 1,167. 30 dimensions: 2,010. 74 dimensions: 4,414.
- The attribute request costs about 130 to 140 tokens per question, because each flag carries three long criteria. It grows by about 140 tokens per content word in the query (up to 12 words).
- Scenarios, per 1,000 searches:
  - Fingerprint cut to 30 dimensions with the attribute request unchanged: 5,610 tokens, **$0.24**.
  - Only a 30-dimension fingerprint: 2,010 tokens, **$0.084**.
  - Attribute request with short criteria: a guess of about half the tokens, not measured.
- Admission reserves 2 × 65,536 × 42 nano (about $0.0055) per attempt before settling. That reserve counts against the daily and monthly caps while a request is in flight, not against the real cost.

## 2. Jev latency (uncached, both requests in parallel, n=9)

| request | p50 | max |
|---|---|---|
| attribute | 284 ms | 379 ms |
| fingerprint (148 q) | 375 ms | 442 ms |
| stage (max of the two) | about 380 ms | 442 ms |

The fingerprint request with fewer questions was faster: 2 questions took 259 ms, 30 took 290 ms and 60 took 292 ms. Cutting it to 30 dimensions saves about 80 ms.

## 3. Downstream stages (8 queries, cached readings, dev machine)

The first pass is the cold one, and it is the one to trust. On the second pass TMDB and the Crate caches were warm.

| stage | calls | p50 | max |
|---|---|---|---|
| reading cache lookup (Redis GET, Crate on a Redis miss) | 1 | 54 ms | 159 ms (Crate) |
| Crate essence phrase (`phrase_prefix`) | 19 | 85 ms | 226 ms |
| Crate essence words | 30 | 74 ms | 224 ms |
| Crate keyword fallback (`ANY(keywords)`) | 3 | 56 ms | 60 ms |
| Crate trope-name fallback | 2 | 258 ms | 275 ms |
| Crate trope-to-title pool | 3 | 137 ms | 163 ms |
| Crate display rows | 14 | 62 ms | 136 ms |
| metadata/eligibility (`metadataFor`) | 8 | 63 ms | 79 ms |
| TMDB title lookup (1 page for all 8) | 8 | 140 ms | 215 ms (warm: 25 ms) |
| Qdrant fingerprint query, 2000-point pool (18 runs) | 18 | 190 ms | 286 ms |
| Qdrant retrieve of display payloads (100) | 18 | 72 ms | 160 ms |
| `retrieveD4` total | 8 | 396 ms | 1,177 ms |
| after the reading (retrieve, then metadata) | 8 | 458 ms | 1,239 ms |

- Slow tails come from the sequential fallbacks, not from any single query.
  - "like groundhog day" took 1,177 ms. It ran the keyword, trope-name and trope-title fallbacks, then the Qdrant fill (341 ms query + 112 ms retrieve).
  - "scifi with sunglasses" took 673 ms and made 15 Crate calls, mostly next-phrase retries that found 0 rows.
- Crate's own `duration` for a 300-row essence words query is 40 to 46 ms.

## 4. Catalog size

| | Crate: all | Crate: eligible (votes ≥ 2000, not adult) | Crate: eligible with essence text | Qdrant: all | Qdrant: eligible |
|---|---|---|---|---|---|
| movie | 1,343,695 | 51,545 | 38,014 | 110,791 | 38,906 |
| show | 246,404 | 10,627 | 10,102 | 80,844 | 11,399 |
| total | 1,590,099 | 62,172 | 48,116 | 191,635 | 50,305 |

- Qdrant holds only fingerprinted titles.
- About 13.5k eligible Crate movies have no essence text and no Qdrant point.
- Qdrant's eligible show count is higher than Crate's, probably because the vote-count payload is stale.

## 5. Network location matters (dev machine vs app server 10.0.0.10)

| request | dev machine | app server | server-side time |
|---|---|---|---|
| Qdrant query, pool of 2000 with used-dimension payloads (348 KB response) | p50 about 290 ms (247 to 731 ms) | p50 about 85 ms (73 to 100 ms) | 70 to 80 ms |
| Qdrant query, 100 points, no payload | about 52 ms | about 8 ms | 5 to 7 ms |
| Crate `SELECT 1` | 45 ms | 3 ms | – |
| Crate essence words, 300 rows | 160 ms | 52 ms | 40 to 46 ms |

- Every sequential round trip from the dev machine adds about 40 to 45 ms, and more for large responses. The Crate and Qdrant timings in section 3 therefore overstate production by roughly 2 to 3 times.
- Estimated production timings from the app server:
  - Downstream p50 is about 200 ms. The worst sequential fallback path is about 500 ms.
  - End to end, uncached: Jev about 380 ms plus downstream, so about 0.6 s at p50 and about 0.9 s at the tail.
- Payload transfer dominates the Qdrant pool query: 2000 points × used dimensions. Scoring takes 5 ms.

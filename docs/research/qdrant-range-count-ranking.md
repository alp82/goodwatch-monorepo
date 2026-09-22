# Qdrant: ranking by the count of in-range payload dimensions

Research for replacing the fingerprint part of the D4 search ranking with "count of wanted dimensions scoring 6..10 plus count of avoided dimensions scoring 0..4", with cosine or the weighted sum as a tiebreaker. Researched on 2026-09-22.

## Scope and sources

The collection is `media_fingerprint_v1` in `goodwatch-webapp/app/server/combined-search/d4.server.ts` (`MEDIA_COLLECTION`). It holds a 74-dim `fingerprint_v1` cosine vector and a payload object `fingerprint_scores_v1.<dimension>` with integers 0..10. `goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py` creates an `integer` payload index for every `fingerprint_scores_v1.<name>` key (line 139). The server image is `qdrant/qdrant:latest` (`goodwatch-qdrant/main/.env`). The webapp pins `@qdrant/js-client-rest` at `^1.12.0` (`goodwatch-webapp/package.json`); the installed copy under `node_modules` is `1.19.0`.

This note uses three kinds of source, in this order of trust:

1. **Docs.** The Qdrant documentation at `https://qdrant.tech/documentation/` and the API reference at `https://api.qdrant.tech/`.
2. **Source.** The Qdrant repository on `master` (fetched 2026-09-22), its OpenAPI spec `docs/redoc/master/openapi.json` at tags `v1.7.4`, `v1.8.0`, `v1.9.0`, and the GitHub release notes and PR list.
3. **Client.** The generated OpenAPI types shipped in `@qdrant/js-client-rest@1.19.0` at `goodwatch-webapp/node_modules/@qdrant/js-client-rest/dist/types/openapi/generated_schema.d.ts`.

The running server was checked after the research: `GET /` on the REST port (6333, not the 6334 gRPC port that `QDRANT_URL` names) reports version 1.15.4 with 191,623 points and 74 integer indexes on `fingerprint_scores_v1.*`. Formula queries are therefore available; the `min_should` fixes from 1.19.0 are not.

## Summary

- **Yes, natively, with a formula query.** Since Qdrant 1.14.0 a query can rescore prefetch candidates with a `formula`. A filter condition inside the formula evaluates to `1.0` or `0.0`, so `sum` over one `range` condition per wanted and avoided dimension is exactly the in-range count. `$score` (the prefetch cosine) or the raw payload keys serve as a tiebreaker inside the same `sum`.
- **The formula only rescores the prefetch set.** The docs say "Formula queries can only be used as a rescoring step." The source confirms it: `do_rescore_with_formula` iterates the deduplicated prefetch points only. Recall is therefore bounded by the cosine prefetch, exactly as it is today by the 2000-point pool in `retrieve`.
- **Payload indexes are used.** Condition checkers and payload variables are built from the segment's field indexes when one exists for the key. The docs ask for an index on every key used in the formula. Every `fingerprint_scores_v1.<name>` key already has an integer index with `range: true` (the default).
- **`min_should` exists since 1.8.0** and takes `range` conditions on dotted keys. It is a filter (hard cutoff at `min_count`), not a ranking. It is the right tool to widen the candidate pool ("at least k in-range dimensions") but can't order results on its own.
- **The installed client (1.19.0) types both `FormulaQuery` and `MinShould`.** The `^1.12.0` pin allows an install that predates formula queries; bump it to `^1.19.0`.
- **A sparse vector is the only alternative that counts exactly without a prefetch bound**, because the sparse index is exact and uses dot product. It needs a re-publication of every point and its speed on dense posting lists is undocumented. Recommendation: start with the formula query, which needs no data change; measure; try the sparse encoding only if prefetch recall is the problem.

## 1. `min_should`

**Docs.** The [Filtering concepts page](https://qdrant.tech/documentation/concepts/filtering/) does not mention `min_should` (the string is absent from the page as of 2026-09-22). The [Query points API reference](https://api.qdrant.tech/api-reference/search/query-points) documents the `Filter` object with four clauses: `must` ("All conditions must match"), `should` ("At least one of those conditions should match"), `must_not` ("All conditions must NOT match"), and `min_should` ("At least minimum amount of given conditions should match") with required fields `conditions` (array of `Condition`) and `min_count` (unsigned integer, minimum 1).

**Source.** `MinShould` first appears in `docs/redoc/master/openapi.json` at tag [`v1.8.0`](https://github.com/qdrant/qdrant/blob/v1.8.0/docs/redoc/master/openapi.json) and is absent at `v1.7.4`, so it shipped in 1.8.0. The feature request is [issue #3331](https://github.com/qdrant/qdrant/issues/3331). Recent fixes: [PR #9401](https://github.com/qdrant/qdrant/pull/9401) (merged 2026-06-19) stopped an empty `min_should` with `min_count > 0` from matching everything, and [PR #8217](https://github.com/qdrant/qdrant/pull/8217) (merged 2026-02-25) guarded the cardinality estimator. Both are relevant to `qdrant/qdrant:latest`: the estimator PR suggests `min_should` with many conditions is handled by an approximate cardinality estimate, not by a naive combination count.

**Semantics.** `Condition` is a union that includes `FieldCondition` (with `range`) and a nested `Filter`. Nothing in the schema restricts `min_should` conditions to `match`, so a `range` on a dotted key is valid. Keys use the jq-like path syntax from the [Nested key](https://qdrant.tech/documentation/concepts/filtering/#nested-key) section (`key.subkey`, available as of 1.1.0). The `Range` fields are `lt`, `gt`, `gte`, `lte` ("point.key >= range.gte" and so on, per the OpenAPI descriptions).

Exact JSON for our keys:

```json
{
  "must": [ { "key": "is_adult", "match": { "value": false } } ],
  "min_should": {
    "min_count": 3,
    "conditions": [
      { "key": "fingerprint_scores_v1.absurdist_humor", "range": { "gte": 6 } },
      { "key": "fingerprint_scores_v1.dark_comedy",     "range": { "gte": 6 } },
      { "key": "fingerprint_scores_v1.gore",            "range": { "lte": 4 } }
    ]
  }
}
```

`min_should` ANDs with `must` and `must_not`. It is a filter: a point either passes or not. It does not add to the score, so on its own it can't rank by count.

## 2. Formula queries (score boosting)

**Docs.** [Search Relevance, "Score Boosting"](https://qdrant.tech/documentation/search/search-relevance/#score-boosting), "Available as of v1.14.0". The [Hybrid Queries page](https://qdrant.tech/documentation/concepts/hybrid-queries/) has a shorter "Custom Scoring with a Formula Query" section with the same version note. The [v1.14.0 release](https://github.com/qdrant/qdrant/releases/tag/v1.14.0) lists "Allow server-side score boosting with user-defined formula."

The expression list, quoted from the Search Relevance page:

- `constant` - "A floating point number. e.g. 0.5."
- `"$score"` - "Reference to the score of the point in the prefetch. This is the same as `"$score[0]"`." With several prefetches, `"$score[1]"` and so on address each one.
- `payload key` - "Any plain string will refer to a payload key. This uses the jsonpath format used in every other place, e.g. `key` or `key.subkey`. It will try to extract a number from the given key."
- `condition` - "A filtering condition. If the condition is met, it becomes 1.0, otherwise 0.0."
- `mult`, `sum`, `div`, `abs`, `pow`, `sqrt`, `log10`, `ln`, `exp`, `geo distance`, `decay` (`lin_decay`, `exp_decay`, `gauss_decay`), `datetime`, `datetime key`.

The master OpenAPI spec also lists `MaxExpression`, `MinExpression`, and `AcoshExpression`, which the 1.19.0 client types and the docs list don't have yet.

On defaults: "It is possible to define a default for when the variable (either from payload or prefetch score) is not found. This is given in the form of a mapping from variable to value. If there is no variable and no defined default, a default value of 0.0 is used." The same page then says "If a score or variable is not available and there is no default value, it will return an error." The two sentences conflict; treat missing variables as an error and set `defaults` for anything that can be absent.

The docs' own example uses a condition as a 0/1 term inside `mult`, which is the pattern we need:

```json
"formula": {
  "sum": [
    "$score",
    { "mult": [ 0.5,  { "key": "tag", "match": { "any": ["h1", "h2", "h3", "h4"] } } ] },
    { "mult": [ 0.25, { "key": "tag", "match": { "any": ["p", "li"] } } ] }
  ]
}
```

**Source.** `lib/segment/src/index/query_optimization/rescore_formula/formula_scorer.rs` on master: `eval_expression` handles `VariableId::Condition(id)` by calling `self.condition_checkers[*id].check(point_id)` and converting the boolean to a score; a test case asserts `new_condition_id(0)` evaluates to `1.0` for a match-all checker and `0.0` for match-none. Payload variables go through `get_parsed_payload_value`, which reads the retriever for the path or falls back to `defaults`, else errors with "No value found in a payload nor defaults".

**Client types.** In `generated_schema.d.ts` of `@qdrant/js-client-rest@1.19.0`: `Query` is a union that includes `FormulaQuery`; `FormulaQuery` is `{ formula: Expression; defaults?: {...} }`; `Expression` is `number | string | Condition | GeoDistance | ... | MultExpression | SumExpression | ...`; `Filter.min_should?: MinShould` with `MinShould = { conditions: Condition[]; min_count: number }`. So `client.query(collection, { prefetch, query: { formula: ... } })` type-checks without casts. The `^1.12.0` range in `package.json` would accept a 1.12.x or 1.13.x install that has no `FormulaQuery`; the pin should move to `^1.19.0` before relying on it.

## 3. Performance

**Rescoring scope.** Docs: "Formula queries can only be used as a rescoring step." The OpenAPI `prefetch` description: "Sub-requests to perform first. If present, the query will be performed on the results of the prefetches." Source `lib/segment/src/segment/read_view/formula_rescore.rs`: `do_rescore_with_formula` dedups the prefetch results into a set of point offsets, builds a scorer via `self.payload_index.formula_scorer(...)`, scores each candidate, applies `score_threshold`, then keeps `k_largest(limit)`. Cost is linear in the prefetch size, and nothing outside the prefetch is ever scored.

**Index use.** `lib/segment/src/index/struct_payload_index/read_view/payload_index_read.rs`: `formula_scorer` builds `payload_retrievers` through `retrievers_map` and `condition_checkers` through `convert_conditions`, the same converter the filter path uses. `read_view/value_retriever/mod.rs` comments: "prepare extraction of the variables from field indices or payload." and passes `self.field_indexes` to `variable_retriever`. Docs: "Payload variables used within the formula also benefit from having payload indices. Please try to always have a payload index set up for the variables used in the formula for better performance." The [indexing page](https://qdrant.tech/documentation/concepts/indexing/) says integer indexes default to `lookup: true, range: true`, and warns: "If you set `"range": false` and still use a range filter, it may lead to significant performance issues." Our schema uses the plain `"integer"` schema, so both flags are at their defaults.

**Lazy evaluation.** Docs: "Multiplication and division are lazily evaluated, meaning that if a 0 is encountered, the rest of the operations don't execute (for example, `0.0 * condition` won't check the condition)." Put constants first inside `mult`.

**Payload on disk.** The OpenAPI description of `on_disk_payload` (default `true`): "If true - point's payload will not be stored in memory. It will be read from the disk every time it is requested. ... Note: those payload values that are involved in filtering and are indexed - remain in RAM." Since every `fingerprint_scores_v1.*` key is indexed, condition checks and variable reads for those keys don't hit disk. Unindexed keys in a formula would.

**Prefetch limit.** Docs (Hybrid Queries): "the prefetches must have a `limit` of at least `limit + offset` of the main query, otherwise you can get an empty result." Beyond that the docs give no sizing guidance. The current `retrieve` already fetches 2000 points with payload for the wide path and ranks in Node; a prefetch of 2000 moves the same amount of work server-side and returns only `RESULT_LIMIT` points with payload, so the wire cost drops. The formula cost is 2000 × (number of conditions) index lookups per query.

**Sharding.** Docs: fusion inside a prefetch is computed per shard; "A main query is a single operation, so it cannot be both a fusion and a formula." Our formula is the main query over a nearest-neighbour prefetch, so this caveat doesn't apply, and the collection is a single node anyway.

**Approximate cardinality for `min_should`.** PR #9402 ("approximate min_should cardinality for large combination counts") and #8217 show the planner estimates `min_should` cardinality rather than enumerating combinations. With 10 to 20 conditions this matters for the choice between index-driven and HNSW-filtered execution; it is not documented, so measure it.

## 4. Alternatives that avoid the formula

**Sparse vector ("want/avoid" one-hot).** Publish a named sparse vector per point with index `2*d` set to `1` when `score_d >= 6` and `2*d+1` set to `1` when `score_d <= 4`. A query sparse vector with `1` at the wanted "high" indices and the avoided "low" indices yields a dot product equal to the in-range count, and query-side values can carry weights. Docs: "A sparse vector index in Qdrant is exact, meaning it does not use any approximation algorithms." and "A sparse vector index only supports dot-product similarity searches." ([indexing page](https://qdrant.tech/documentation/concepts/indexing/#sparse-vector-index), available as of 1.7.0). Sparse vectors can be added as a named vector next to `fingerprint_v1`. Costs: every point must be re-published with the new vector; each of the 148 possible indices is set on a large fraction of points, so posting lists are long and the exact search scans a big share of the collection per query (unmeasured); a tiebreaker still needs a second dense prefetch plus a formula (`$score[0]` count plus `0.01 * $score[1]` cosine), so the formula isn't avoided, only the count part of it.

**Dense one-hot with `Dot`.** The same 148-dim encoding as a `uint8` dense vector with `Dot` distance (the OpenAPI `Distance` enum is `Cosine | Euclid | Dot | Manhattan`; `uint8` "is an integer number in the range from 0 to 255"). HNSW makes it approximate, and integer-valued dot products produce many ties, which HNSW handles poorly. It's not simpler than the formula and it's less exact than the sparse index.

**Multivectors.** `max_sim` (available as of 1.10.0) sums maximum similarities between vector pairs. It has no "count in range" reading; not applicable.

**Assessment.** The formula needs no re-publication, uses existing indexes, and returns exactly what the Node code computes today. The sparse encoding is the only path to an exact count over the whole collection without a cosine prefetch, at the price of a data migration and an undocumented scan cost. Try the formula first.

## Recommended query body

Wanted dimensions get `range.gte: 6` (6..10), avoided ones `range.lte: 4` (0..4). Cosine similarity lies in [-1, 1], so `0.01 * $score` stays below one count unit and only breaks ties. For a weighted-sum tiebreaker, replace the last term with `{ "mult": [0.0005, { "sum": [ { "mult": [2, "fingerprint_scores_v1.absurdist_humor"] }, { "mult": [-1.5, "fingerprint_scores_v1.gore"] } ] }] }` (74 dims × |weight| ≤ 2 × 10 keeps the magnitude under 1).

```json
POST /collections/media_fingerprint_v1/points/query
{
  "prefetch": {
    "query": [0.0, 0.31, ..., -0.22],
    "using": "fingerprint_v1",
    "filter": { "must": [ { "key": "is_adult", "match": { "value": false } } ] },
    "limit": 2000
  },
  "query": {
    "formula": {
      "sum": [
        { "key": "fingerprint_scores_v1.absurdist_humor", "range": { "gte": 6 } },
        { "key": "fingerprint_scores_v1.dark_comedy",     "range": { "gte": 6 } },
        { "key": "fingerprint_scores_v1.gore",            "range": { "lte": 4 } },
        { "mult": [ 0.01, "$score" ] }
      ]
    }
  },
  "limit": 100,
  "with_payload": [
    "fingerprint_scores_v1.absurdist_humor",
    "fingerprint_scores_v1.dark_comedy",
    "fingerprint_scores_v1.gore",
    "genres"
  ]
}
```

To weight wanted and avoided dimensions differently, wrap each condition: `{ "mult": [ 1.0, condition ] }` for wants and `{ "mult": [ 0.7, condition ] }` for avoids. Constants go first so the lazy `mult` skips the index lookup when the weight is zero.

To widen the pool beyond the top-2000 by cosine, add a second prefetch that filters with `min_should` (`min_count` at, say, half the query dimensions) and orders by the same vector; then reference the cosine as `"$score[0]"` and add `"defaults": { "$score[0]": 0, "$score[1]": 0 }` so points present in only one prefetch don't error. Whether `defaults` accepts `$score[i]` keys is untested; see open questions.

With the 1.19.0 client this is `client.query(MEDIA_COLLECTION, { prefetch: {...}, query: { formula: {...} }, limit, with_payload })` and needs no `as never` cast.

## Sparse vector versus formula

| | Formula over cosine prefetch | Sparse "want/avoid" vector |
| --- | --- | --- |
| Data change | None | Re-publish every point with a new named sparse vector; schema and sync flow change |
| Exactness of the count | Exact for candidates; candidates limited to the prefetch | Exact over the whole collection (sparse index is exact) |
| Cost per query | prefetch HNSW + 2000 × conditions index lookups | Scan of posting lists for the queried indices; each list covers a large share of the collection (unmeasured) |
| Tiebreaker | `$score` or payload keys in the same formula | Needs a dense prefetch plus a formula anyway |
| Filters | Same `filter` as today, on the prefetch | Same, on the sparse prefetch |
| Client support | 1.19.0 types it | 1.19.0 types it |

## Open questions

- Does `defaults` accept `"$score[1]"` keys so that a point missing from one of two prefetches doesn't error? The docs say defaults cover "either payload or prefetch score" but show only a payload example.
- Sparse-index latency with posting lists that cover 30 to 60 percent of points: undocumented; needs a measurement on a copy of the collection before committing to a re-publication.
- The `min_should` cardinality estimator behaviour with 10 to 20 range conditions (PRs #8217, #9402) decides whether the planner uses field indexes or a filtered HNSW walk. Measure `min_should` prefetch latency at realistic condition counts.
- The docs list both "default value of 0.0 is used" and "will return an error" for missing variables. Confirm on the running version by querying a point without one of the keys.
- The running server is 1.15.4 (verified 2026-09-22). Formula queries work; the empty-`min_should` fix needs 1.19.0, so an upgrade is due before relying on `min_should`.

## How to verify locally

1. Server version. The [root endpoint](https://api.qdrant.tech/api-reference/service/root) `GET /` returns `{ "title", "version", "commit" }`. With the webapp env: `curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/"`. Confirm `version` is at least `1.14.0` (formula) and preferably `1.19.0` (`min_should` fixes).
2. Index state. `GET /collections/media_fingerprint_v1` and check `payload_schema` contains `fingerprint_scores_v1.<name>` entries with `data_type: integer` and `params.range: true` (or no params, which means the defaults).
3. Formula smoke test. `POST /collections/media_fingerprint_v1/points/query` with the body above and a real `fingerprint_v1` query vector taken from one point (`GET /collections/media_fingerprint_v1/points/{id}?with_vector=true`). The top result's score should equal its in-range count plus `0.01 × cosine`; compare against the Node ranking in `retrieve` for the same reading.
4. Timing. Run the same query 20 times with `"params": {"exact": false}` on the prefetch and read `time` from the response envelope. Compare with the current 2000-point `query` call, which `retrieve` times as `poolMs`.
5. `min_should` semantics. Run `POST /collections/media_fingerprint_v1/points/count` with `exact: true` and a `min_should` filter of three range conditions at `min_count: 1, 2, 3`; the counts must decrease monotonically. Also try `conditions: []` with `min_count: 1` and expect zero on 1.19.0 or newer.
6. Client types. `cd goodwatch-webapp && npx tsc --noEmit` after writing the formula call without a cast; it compiles on 1.19.0. Bump `@qdrant/js-client-rest` to `^1.19.0` in `package.json` so a fresh install can't regress below 1.14.

## Live measurement (2026-09-22, server 1.15.4)

The recommended query was run against the production collection over REST for the "complete nonsense" reading: wanted `absurdist_humor`, `surrealism`, `eccentricity`, `camp_and_irony` (`gte: 6`), avoided `educational` (`lte: 4`), prefetch of 2000 by `fingerprint_v1` cosine with the usual voting-count and adult filters, formula `sum(conditions) + 0.01 * $score`, limit 10.

| Query | Server time (3 runs) |
| --- | --- |
| Plain cosine, limit 2000, no payload (today's pool query) | 273 to 288 ms |
| Formula over a 2000-point prefetch | 319 to 343 ms |
| Formula over a 500-point prefetch | 274 to 284 ms |

The rescoring step costs about 40 ms on top of the prefetch at 2000 candidates; the filtered HNSW prefetch dominates either way. All ten top results scored 5 of 5 conditions (House Shark, Super Shark, Movie 43, Troll 2, Attack of the Killer Tomatoes!, Strutter, The Last Sharknado, Pecan Pie, Check It Out! with Dr. Steve Brule, Aunty Donna's Big Ol House of Fun).

Observation for the tiebreaker: with a ±1 query vector, cosine ranked House Shark (9, 6, 8, 9, 0) above The Last Sharknado (10, 9, 10, 10, 0). The weighted-sum tiebreaker from the "Recommended query body" section is the better choice when several titles tie on the count.

### After the index fix (same day)

The measurements above ran against a collection with no HNSW graph: both `indexing_threshold` and `full_scan_threshold` are in kilobytes of vectors, and the 10,000 KB default exceeded every segment. After lowering both to 1000 KB, letting the optimizer merge to 2 segments per shard, and adding a bool payload index on `adult` (the unindexed `must_not` clause alone cost about 500 ms), the same queries measured:

| Query | Server time (5 runs) |
| --- | --- |
| Plain cosine, limit 100, both filters | 5 to 6 ms |
| Plain cosine, limit 2000, both filters (today's pool) | 12 to 17 ms |
| Formula over a 2000-point prefetch | 33 to 41 ms |

The formula rescoring is now the larger share of the query, but the whole thing is an order of magnitude below the previous pool query.

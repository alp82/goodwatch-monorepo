# Identifier-free wishlist matching: local evidence

Research date: 2026-10-18. Scope follows issue #374, “Matching titles without ids.” This experiment reads only the authorized local Letterboxd **wishlist**, not ratings, diary or history. Private title strings, source URLs and catalog candidates remain in local restricted files; this report contains only aggregate counts and explicitly invented examples. No Netflix account file or response was available, so this is not a Netflix recall or matching-rate measurement.

## Input and current parser

The original export contains **one wishlist row**, one unique title/year pair. Its columns are Date, Name, Year and Letterboxd URI. Title, year and source URI are populated; TMDB/IMDb identifier columns are absent. A Letterboxd URI is source identity, not an immediately usable TMDB/IMDb identifier.

A private wishlist-only ZIP was constructed by copying only `watchlist.csv` from the original ZIP. The current shipping `parseImportFile('letterboxd', bytes)` then produced:

| Observation | Count |
| --- | ---: |
| Want to See observations | 1 |
| Movie observations | 1 |
| Supplied year | 1 |
| Supplied TMDB IDs | 0 |
| Supplied IMDb IDs | 0 |
| Invalid/unmatched parser problems | 0 |
| Watches, ratings or reviews | 0 |

This verifies the actual shipping parser without handing it the original archive's other files. Its existing Letterboxd adapter assumes movie scope; the separate query experiment deliberately searches both movie and show namespaces to simulate unknown capture scope.

## Query safety and bounds

Repository schema inspection confirms movie/show `title` columns are declared `TEXT INDEX USING FULLTEXT`. The shipping importer uses `lower(title) = lower(?) AND release_year = ?` for title/year fallback. `EXPLAIN` of that and a title-only variant, using an invented title rather than private input, did not by itself establish indexed title narrowing. Those predicates were **not executed alone** during this experiment.

The measured queries instead use explicit indexed phrase retrieval plus exact case-insensitive equality:

```sql
SELECT tmdb_id, title, release_year
FROM movie -- separately repeated for show
WHERE MATCH(title, ?) USING phrase
  AND lower(title) = lower(?)
  -- title/year mode additionally uses: AND release_year = ?
LIMIT 100
```

`EXPLAIN` accepts the combined predicate and retains both `MATCH ... USING phrase` and the exact residual. CrateDB documents that MATCH searches fulltext indices; phrase retrieval narrows to matching token sequences and the equality predicate removes longer/normalized near-matches. This is an explicit index-backed search predicate, not a claim that the logical EXPLAIN output is a physical shard profile. No scan/row-estimate values were reported as observed data. [CrateDB fulltext reference](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html), [fulltext index definitions](https://cratedb.com/docs/crate/reference/en/latest/general/ddl/fulltext-indices.html).

Four measured SELECTs were executed: two modes across two media types, each capped at 100 rows. No cap was reached. No full-table aggregate, substring query, schema change, catalog write or member-table access occurred. Configured connection values stayed inside the process and were not printed. Candidate identities were deduplicated by media type and canonical TMDB ID; the known retired-movie aliases are applied only to movie IDs.

This phrase-gated experiment is suitable for the actual nonempty analyzed title tested. It is not a universal exact-lookup algorithm for every arbitrary input: inputs that produce no indexed tokens need an explicitly bounded alternative or manual handling rather than silently dropping the index gate.

## Measured candidates

| Search mode, across movies and shows | No candidate | Exactly one | Several | Capped rows | Movie candidates | Show candidates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Exact title and source year | 0 | 1 | 0 | 0 | 1 | 0 |
| Exact title without year | 0 | 1 | 0 | 0 | 1 | 0 |

No row resolved solely to a show. Both modes identify the same sole catalog movie for this one wishlist title. The data therefore does **not** demonstrate increased ambiguity from omitting year, or establish how often a Letterboxd entry is a show in GoodWatch. A one-row sample is insufficient for either frequency claim.

| Query | Returned rows | Wall time | Database time |
| --- | ---: | ---: | ---: |
| Movie, title + year | 1 | 167 ms | 13.70 ms |
| Show, title + year | 0 | 171 ms | 12.39 ms |
| Movie, title only | 1 | 42 ms | 13.48 ms |
| Show, title only | 0 | 32 ms | 6.24 ms |

Timing includes ordinary transport variance and is not a benchmark. No title/identifier values are included here.

## Decision about review burden

For **this authorized wishlist**, catalog ambiguity leaves **zero unresolved rows** under both research modes: one row has one candidate, none has multiple or zero candidates. The native Letterboxd path already supplies movie scope and year, so its existing exact title/year fallback can resolve this case without a general matching editor.

This does not justify removing manual matching from the broader import plan. Unknown-type and title-only browser observations remain more weakly supported evidence; a unique title string in the present catalog does not prove there is no different work outside it. The current shared-file importer intentionally leaves unknown media scope unmatched, so it does not automatically apply the cross-type research result. Changing that rule requires an explicit resolution contract and validation, rather than treating candidate search as authoritative identity.

The aggregate workload model for a larger validation set should record separately:

- Rows with one compatible candidate: a proposed match, distinguishing exact title/year from weaker title-only evidence.
- Rows with several candidates: a person chooses among candidate identities.
- Rows with zero candidates: a person corrects/searches a title or leaves it unresolved.
- Episode-like labels: retained source text and explicit parent/scope handling, never silently promoted to whole-show identity.

Those are technical resolution outcomes, not a UI design. Opus owns the review workflow/prototype. There were no ambiguous or missing rows here to substantiate an empirical matching-review prototype or estimate minutes of review.

An **invented illustration**, not a measured catalog result: “The Orchard” could describe a movie from 2001, a remake from 2024 and a show from 2018. Title-only evidence would leave three candidates; a correct year could narrow it to one. This explains a possible failure mode but contributes no observations to the measured counts above.

## Local artifacts and reproducibility

All artifacts remain under the existing browser-validation scratch directory:

- `matching-plans.mjs` / `matching-plans.json`: EXPLAIN-only checks with an invented title; no private titles in output. It was run twice while adding the indexed exact predicate; these were planning statements, not catalog-result reads.
- `measure-wishlist-matching.mjs`: wishlist-only archive reader and bounded catalog experiment; stdout prints aggregates only. Unique inputs are deduplicated and execution is capped at twenty unique pairs; this run used one.
- `letterboxd-wishlist-matching-private.json`: private input and catalog candidates, mode 0600; do not publish.
- `watchlist-only-private.zip`: wishlist-only parser input, mode 0600; do not publish.
- `letterboxd-wishlist-parser-aggregate.json` and `letterboxd-wishlist-matching-aggregate.json`: sanitized counts and timings.

The read-only matching script runs with the existing configured environment loaded by Node's `--env-file`; do not print or copy that file. No production import, wishlist write or source-account operation was performed.

Next evidence needed: a larger authorized wishlist-only dataset and an actual redacted Netflix capture, including missing years, remakes, unknown type and episode-like labels. Until those exist, leave population-level review burden and Netflix correctness unquantified rather than borrowing ratings/history as substitute evidence.

## Manual candidate search integration check

The implementation keeps unknown-scope rows unmatched until the member selects a catalog identity. Its candidate search was separately exercised against the live catalog using the actual `searchQuery` and `withBackendTimeout` server transports, with the public query `Toy Story`. Two concurrent read-only SELECTs used the exact production predicate `MATCH((title,original_title), ?)`, excluded adult rows, sorted by `_score`, popularity and TMDB ID, and limited each media type to ten results.

The shared 1,500 ms timeout completed in 201 ms (movie request 196 ms; show request 199 ms). Each returned ten candidates. Public examples included movie 862, Toy Story (1995), and show 39905, Toy Story Treats (1996). Broader fulltext candidates also appeared: this validates query execution and result shapes, not automatic identity or relevance for every row. No member tables or writes were involved. Timings are one integration observation, not a performance benchmark. The safe local result is `candidate-sql-validation/result.json` in the browser-validation scratch directory.

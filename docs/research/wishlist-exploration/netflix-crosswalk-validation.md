# Netflix native-ID crosswalk: bounded catalog validation

Date: 2026-10-18. This follow-up to [capture validation](capture-validation.md) used authorized, read-only queries of the public catalog's `streaming_availability` table. It did not read member/account tables, alter data/schema, contact Netflix, log in to a provider, or test a real My List. Configured connection values were loaded directly into the query process and were never printed. This is evidence for catalog identity resolution, **not verified live Netflix list capture**.

## Observed result

The catalog contains usable Netflix native IDs. Across three bounded samples, strict extraction recovered **60 distinct Netflix detail IDs associated with 60 distinct `(media_type, media_tmdb_id)` catalog identities**, with **zero conflicting mappings observed within these samples**. This is not proof of global uniqueness or overall coverage.

All 123 non-null sampled links were `https://click.justwatch.com/a` wrappers with query keys `cx`, `r`, `uct_country`; none was a direct Netflix URL. `URLSearchParams.get('r')` exposed the Netflix destination without following the redirect or decoding the tracking context. Three destinations used `http://www.netflix.com/title/{id}`; the strict HTTPS extractor rejected these. All remaining 120 destinations used `https://www.netflix.com/title/{id}` and parsed successfully. Neither sample contained a `/watch/{id}` playback destination.

| Sample | Filter after `streaming_service_id = 8` | Rows | Null links | Strictly parsed links | Distinct parsed Netflix IDs | Wall / database time |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Baseline | `LIMIT 20` | 20 | 17 | 3 | 2 | 198 ms / 17.12 ms |
| Linked offers | `AND stream_url IS NOT NULL LIMIT 100` | 100 | 0 | 97 | 48 | 321 ms / 38.27 ms |
| Linked shows | `AND media_type = 'show' AND stream_url IS NOT NULL LIMIT 20` | 20 | 0 | 20 | 11 | 249 ms / 19.34 ms |

Each query selected only `media_type`, `media_tmdb_id`, `country_code`, `streaming_service_id`, `streaming_type`, `stream_url`. There was no `ORDER BY`, aggregation, substring filter, full-table enumeration, or `EXPLAIN`. The service predicate is indexable under the existing schema; no query-plan claim is made. Database time is the returned query duration; wall time includes transport/setup. The independently executed samples contained 140 distinct offer keys in total and were not statistically sampled. The 100-row linked-offer sample happened to contain only movies, hence the separate show query. Counts across countries repeat identities and must not be presented as distinct titles.

Public examples from the actual sampled records:

| Netflix detail ID | Catalog identity | Sample country |
| --- | --- | --- |
| `81409295` | movie TMDB `32867` | IS |
| `70120524` | movie TMDB `15952` | BG |
| `70153404` | show TMDB `1668` | CI |
| `80238565` | show TMDB `76148` | AE |

These are observed catalog associations, not independently verified Netflix metadata. Source IDs and TMDB IDs are distinct namespaces. The `/title/` path does not encode whether a work is a movie or show; the catalog association supplies that type. No sampled identity used the application's retired-movie aliases, so the canonical title count remains 60 under the existing [canonical ID function](../../../goodwatch-webapp/app/utils/title-identity.ts).

## Pure extraction experiment

Scratch directory: `/home/alp/dev/projects/goodwatch/wishlist-browser-validation`.

- `sample-catalog.mjs`: bounded read-only sampler; loads the existing configured environment inside Node. Modes are limited to the three queries above. Raw connection values never enter its output or sample files. Query failures report only a status/code/type, not raw exception messages.
- `sample-20.json`, `nonnull-100.json`, `shows-nonnull-20.json`: local public-catalog evidence and timings. These include original public offer URLs with tracking context; do not copy the wrapper context into a portable wishlist file.
- `extract-crosswalk.mjs`: no network/database calls; strict URL extraction, sample collision accounting and 22 synthetic assertions.
- `extraction-summary.json`: counts and canonical public examples, with wrapper tracking fields omitted.

Run the pure experiment with `node /home/alp/dev/projects/goodwatch/wishlist-browser-validation/extract-crosswalk.mjs`. **22 synthetic assertions pass.** It rejects lookalike hosts, userinfo, nondefault ports, HTTP, control characters, backslashes, `/watch/` playback IDs, nonnumeric/encoded ID paths, zero ID, episode suffixes, unknown wrapper paths, duplicate `r`, hostile redirect targets, nested wrappers and double-encoded destinations. Direct and wrapped HTTPS detail URLs work; emitted URLs contain origin/path only, with query/fragment removed.

The parser allows exactly one outer `https://click.justwatch.com/a` wrapper and exactly one `r` field. It then accepts only `https://www.netflix.com/title/{positive-decimal-id}` (optional trailing slash). It does not fetch either URL, decode `cx`, infer media type, or reinterpret playback/episode IDs as show IDs. A browser-native `/watch/` ID therefore cannot automatically use this detail-ID crosswalk until its scope is validated. More browser/provider URL variants require independent evidence before expanding the allowlist.

The three HTTP destinations are a concrete compatibility decision for later implementation. Since extraction never follows these links, a narrowly scoped HTTP-to-HTTPS normalization could be evaluated against authoritative evidence. This experiment deliberately preserves the stricter rejection and does not silently widen accepted protocols.

## Buildable next route without service-wide runtime scans

### Preferred: materialize exact native identity during existing ingestion

The active [streaming publisher](../../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py) already processes offers for a known TMDB title and type. In `merge_source_rows`, verified scraped offers acquire `stream_url`; `publication_writes` then computes changed/removed rows and the writer publishes them. This is an appropriate place to derive a normalized native identity once, rather than parse all Netflix links during each import.

The existing [availability model](../../../goodwatch-flows/windmill/f/sync/models/crate_models.py) and [schema](../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py) have no normalized native-ID column/table. A subsequent implementation could emit a separate indexed association or immutable generated index:

```text
(source='netflix', scope='detail', source_id='70153404')
    -> set of (media_type='show', tmdb_id=1668, provenance, last_observed)
```

Keep all candidate identities per native ID. A composite association key including both native and catalog identity preserves collisions; a unique key on native ID with last-write-wins would erase ambiguity. Collapse repeated country/offer observations of the same association, retain provenance and timestamps, and apply GoodWatch's canonical title aliases consistently. Import lookup should be exact and return zero/one/multiple candidates explicitly. A typed capture must agree with the candidate type. Unknown browser type may become known only after a sufficiently trusted unique catalog association, preserving the original unknown evidence separately.

Do not bind this registry's lifetime to current availability. The publisher clears stale source contributions and removes obsolete availability rows; an unavailable title can still be in a person's My List. Retaining historical identity associations requires a separate conflict/revalidation policy and must never imply current watchability. Startup/initial backfill would need a separately budgeted catalog job; the present LIMIT samples cannot supply a production-complete index. No materialization, backfill, production code or schema change was performed here.

The existing [provider-identity parser](../../../goodwatch-flows/windmill/f/tmdb_web/provider_identity.py) decodes `cx` to identify the service. Its provider IDs are JustWatch identities, not Netflix content IDs or TMDB IDs. Reuse its trust-boundary lessons, but extract title identity from the strictly validated `r` destination and the known catalog row. Do not mix those namespaces.

### Smaller experiment: verify a bounded catalog candidate set

An alternative without new schema is to first obtain a small typed title/year candidate set from catalog search, then read links only for those candidate IDs:

```sql
SELECT media_type, media_tmdb_id, country_code, stream_url
FROM streaming_availability
WHERE streaming_service_id = 8 AND media_type = ?
  AND media_tmdb_id = ANY(?) AND stream_url IS NOT NULL
LIMIT 100
```

Bound the candidate list (for example, at most 20), parse every returned link locally and compare exact native IDs. Do not issue `LIKE '%id%'`, substring, regex, or unbounded scans against the service's whole link collection. This candidate query is a design proposal and was not run during this experiment.

A matching candidate corroborates identity; a missing match is inconclusive when links are null, current availability is absent or LIMIT was reached. A title search cannot establish uniqueness outside its candidate set. Until its ambiguity policy is proven, treat this route as reviewed matching evidence rather than an authoritative global crosswalk. No automatic first-search-hit assignment is justified.

## Limits and next validation

The 17 null links in the initial 20 rows demonstrate a real missing-link path, not an estimated missing-link rate. The LIMIT results have unknown selection bias, cover only service ID 8 (no tier/alias coverage claim), and are capped. Zero observed collisions across 60 identities does not establish global uniqueness. Current scraped availability links may be stale or wrong; they are not provider-authoritative metadata.

The next useful implementation is the strict pure URL parser plus explicit zero/one/many association lookup tests, followed by a bounded ingestion materialization design. Before automatically importing native-ID-only browser captures, validate known Netflix detail IDs from an authorized current My List against this crosswalk, including movies, shows, remakes, unavailable titles, more than one profile and playback/episode aliases. Measure list extraction recall, catalog match correctness and applied wishes separately. The first wishlist-file release can ship independently of that work.

## Exact next implementation seam and ship boundary

The next independently testable seam is a pure `parseNetflixDetailIdentity(url)` in ingestion, returning either `{source:'netflix',scope:'detail',sourceId,canonicalSourceUrl}` or a rejection. It consumes a public catalog offer URL and never receives browser sessions. A second pure accumulator accepts `(parsedIdentity, mediaType, canonicalTmdbId, provenance)` and produces a set-valued index. Tests should use redacted real public forms from this sample plus the adversarial fixtures; verify duplicate-country collapse and two-catalog-title conflict retention. The ingest writer is the later persistence seam; exact lookup and capture resolution follow only after that index exists. No service-wide runtime link scans are needed.

A local experimental browser producer can be distributed before a live account test if it explicitly exports only the selected/observed loaded candidates and preserves unknown type/completeness. That is a capture artifact, not evidence of supported Netflix import: the current shared-file importer blocks unknown media types, and this research did not validate a current DOM selector or whole-list enumeration. Native-ID-only output therefore does not yet guarantee any applied wishes. A useful supported Netflix migration needs both a validated reader/list boundary and a trusted catalog-resolution path; label an unvalidated producer experimental and avoid completeness/support promises. Original Watcharr files remain the already useful shipped path while these separate seams are completed.

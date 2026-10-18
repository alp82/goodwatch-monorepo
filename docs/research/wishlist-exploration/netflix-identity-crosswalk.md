# Netflix native IDs to GoodWatch catalog identity

Research date: **2026-10-18**. Companion to [capture validation](capture-validation.md#can-existing-catalog-streaming-urls-resolve-native-ids) and [tracker routes](tracker-routes.md). Repository inspected at `a3954d76e7c847fa6928a8da91b8d61b022a1564`. This report distinguishes repository/code evidence, current public documentation, measured local aggregates and proposals. No private 77-title export was submitted to any third party; no provider account was connected; no production data was written. Public documentation and one public TMDB title page were fetched.

## Recommended minimum viable route

Build a **local normalized reverse map of existing streaming links**, keyed by Netflix ID, retaining every distinct `(mediaType, tmdbId)` candidate and link provenance. Resolve only globally unique, correctly scoped title identities; otherwise use the existing catalog title/year candidate review. Preserve the Netflix ID even after matching. Neither a title-only search's first result nor a Netflix `/watch/` episode ID is sufficient to establish a whole-show wish.

The practical evidence favors this over canonical URL equality: the root agent's read-only experiments found **75/77 native-ID-backed proposals within retrieved candidate sets**: 59 from the initial title-candidate retrieval and 16 additional hits after exact indexed translation/alternative-title candidate retrieval. Canonical URL equality matched **0/77**. These are useful proposals, **not 75 confirmed identities** or proven global uniqueness. A complete normalized crosswalk and collision audit are the next decisive measurement.

Do not add Simkl as a mandatory identity intermediary initially: its Netflix lookup is beta, automated loop usage has explicit restrictions, and using its catalog in a tracker has integration/license conditions. TMDB's `/find` cannot directly resolve Netflix IDs. A locally built Wikidata crosswalk is a plausible later supplement, with unmeasured coverage.

## What was measured, and what it establishes

The root agent supplied the following aggregate from its authorized read-only catalog experiment; this agent did not independently rerun that query. Scratch evidence is named `netflix-candidate-crosswalk-aggregate.json` and `netflix-alias-aggregate.json` in the root task's scratch area. Private row-level scratch files were not copied into this report.

| Observation | Result | Interpretation |
| --- | --- | --- |
| Private capture size | 77 rows | Denominator only; this report contains no list titles or IDs. |
| Candidate-scoped catalog retrieval | 35 bounded SELECTs, chunks of 40 candidate catalog IDs | Rows were obtained only for title-search candidates, not the whole catalog. |
| Query safety cap | 5,000 rows per query; none reached the cap | No measured cap truncation within those query bounds. |
| Retrieved offer rows | 9,346 | Countries/offer types create repeated identity evidence. |
| Parseable Netflix links | 9,265 direct/one-wrapper URLs | URL normalization recovers far more than exact URL equality. |
| Unique exact Netflix-ID target in the retrieved candidate set | 59/77 | Stronger candidate evidence than name matching; other catalog titles were outside the search. |
| No hit / ambiguous in that restricted set | 18 / 0 | Zero local collisions does not establish zero global collisions. |
| Additional exact indexed translation/alternative-title retrieval, then native-ID offer join | 16 of the initial 18 misses | Additional proposals; title aliases select candidates, native ID corroborates the edge. No query cap reached. |
| Combined candidate-scoped native-ID proposals | 75/77; 2 remaining; 0 candidate-set ambiguity | Still lacks the whole-catalog collision audit and manual identity validation. |
| Canonical URL equality | 0/77 | Do not implement `stream_url = canonicalNetflixUrl` as the resolver. |

The initial 18 misses, and the 2 remaining after the alias pass, are not proof that the catalog lacks the titles. A correct title absent from the title-candidate set could still carry the Netflix ID; a title may have no direct link, no current offer, an unsupported URL shape, or an obsolete identity. A full-catalog reverse map can improve recall and reveal collisions that the candidate restriction hides. No precision or false-match rate has yet been established against manually verified Netflix/TMDB pairs.

## Verified local data model and lifecycle

**Code verified.** `streaming_availability` stores `media_tmdb_id`, `media_type`, `country_code`, `streaming_service_id`, `streaming_type`, `stream_url` and a TMDB where-to-watch link. Its primary key is the title/type/country/service/offer tuple; provider-native identity is not indexed or unique. Both `movie` and `show` are separate namespaces. [Crate schema](../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py).

**Code verified.** The TMDB web crawler stores the original offer anchor `href`; it does not canonicalize provider URLs or extract Netflix IDs. It validates the selected country and JustWatch wrapper country. `provider_identity.py` decodes `cx` only to reconcile the **streaming service name**. Its `providerId` is a JustWatch service identifier; it is **not a Netflix title ID, TMDB title ID or guaranteed TMDB service ID**. [Crawler](../../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/fetch.py), [service identity decoder](../../../goodwatch-flows/windmill/f/tmdb_web/provider_identity.py).

**Code verified.** The publisher merges scraped URLs with TMDB provider evidence; it can replace `stream_url` with null when a scraped contribution disappears, and deletes availability rows no longer present in the reconciled set. It also preserves some prior contributions while source checks are unknown/deferred. Consequently, a retained row is not automatically current availability, and an absent row is not an identity tombstone. [Reconciliation/publication](../../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py), [evidence construction](../../../goodwatch-flows/windmill/f/sync/availability_evidence.py).

**Code verified.** `availability_history` stores stays and their dates/precision, **not historical `stream_url` values**. `streaming_evidence.payload` includes current source checks and per-offer URLs, with usable/unknown reasons and source times; its primary key is title/type/country, so it is not an immutable archive of every old URL. Mongo provider documents likewise carry current `streaming_links` and timestamps. These may add provenance or recover links missing from a published row, but no durable historical Netflix→TMDB registry was established. [History/evidence schema](../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py), [Mongo models](../../../goodwatch-flows/windmill/f/tmdb_web/models.py).

**Code verified.** When `stream_url` is missing, the UI links to TMDB's watch page. That fallback URL contains a TMDB ID, not a Netflix ID. Do not reverse-resolve the rendered fallback as though it were a provider link. UI provider-folding constants also exclude Netflix-with-ads service `1796` from some displays; an identity scan must not reuse a UI filter that hides useful link evidence. [Link renderer and service folding](../../../goodwatch-webapp/app/utils/streaming-links.ts).

## Direct URLs and JustWatch wrappers: current primary evidence

**Public response verified, 2026-10-18.** A read-only unauthenticated fetch of [TMDB's public Stranger Things watch page for DE](https://www.themoviedb.org/tv/66732-stranger-things/watch?locale=DE) returned HTTP 200. The offers contained `https://click.justwatch.com/a` URLs with query keys `cx`, `r`, `uct_country`. Decoding `r` once yielded `https://www.netflix.com/title/80057281`. Multiple quality/plan offer rows repeated that target. No redirect was followed. This confirms the wrapper's destination field on one current public page; it does not establish every wrapper variant or catalog-wide coverage.

The public fetch summary, including response hash, is in `/tmp/gw-crosswalk-public-tmdb-page-summary.json`. Its example was chosen independently of the private capture.

**Proposed bounded parser:**

1. Parse a URL structurally, imposing a length/field-count limit. Require an exact accepted hostname (`netflix.com` or `www.netflix.com`), no credentials, and no unexpected port. Never use substring matching such as `includes('netflix.com')`.
2. For direct title URLs, accept a fully numeric ID segment in `/title/{id}`. Explicitly support observed locale prefixes such as `/de/title/{id}` or `/jp-en/title/{id}` through a finite locale-path rule; do not let an arbitrary prefix consume arbitrary paths. Preserve ID as a string. Query tracking parameters do not change identity. Reject numeric-prefix garbage, extra path segments and unsupported paths.
3. For `https://click.justwatch.com/a`, require exactly one nonempty `r` field. Parse the query once, then parse the resulting target as a URL. Require the same direct Netflix title rules. Do not repeatedly percent-decode until a string happens to match, recurse through arbitrary wrappers, or resolve network redirects.
4. Validate `cx` service context when present and require consistency with Netflix. Preserve the raw source evidence locally for audit; do not treat JustWatch `titleId`/`jwEntityId` as TMDB IDs. Unsupported/malformed contexts are diagnostics, not permission to guess.
5. `/watch/{id}` is a separate scope, possibly an episode. Keep it as playback evidence; do not use it as an exact title-level crosswalk without a verified parent-title relation. The same caution applies to trailer/supplement IDs found in generic cards.

Locale shapes and playback ambiguity are supported by [Wikidata's Netflix ID property examples and URL patterns](https://www.wikidata.org/wiki/Property:P1874), which include title/watch forms and episode-like works. Wikidata is catalog evidence, not an official Netflix API contract. The capture-specific scope risks are detailed in [capture validation](capture-validation.md#concrete-netflix-capture-route-to-validate).

## Practical reverse-map design and collision rules

**Proposal; no schema or production code added.** Start with a local snapshot/export containing only catalog fields, not member data. An extraction query needs type/ID, URL, service, country and source update time. Retrieve all relevant Netflix service variants across countries, including ads plans where present; do not restrict by the person's country or to currently fresh availability. Identity is useful even when the person cannot currently stream the title there. A wider scan of all non-null catalog URLs with the strict host parser can detect misplaced-service rows; retain these as conflicts rather than trusting the foreign service attribution.

Use bounded deterministic pages of a read-only snapshot or a catalog export whose completeness is known. A single large `LIMIT` must never be called complete. If a query reaches a cap, split/repage it. The existing title/type/country/service/offer key supports deterministic composite-key traversal; do not rely on an unsorted changing table plus offsets for a reproducible global collision audit.

The central structure should be a **multimap**:

```text
netflixId -> set of {
  mediaType, tmdbId, scope,
  country/service/offer evidence,
  firstObservedAt, lastObservedAt, sourceSnapshot,
  sourceState, conflictReason?
}
```

Deduplicate repeated country/quality/offer rows by `(mediaType, tmdbId, scope)`. Different Netflix IDs mapping to the same catalog work are allowed aliases. One Netflix ID mapping to different catalog works is a conflict; keep every candidate. A movie and show with the same **numeric TMDB ID** are still two candidates. Do not silently resolve conflicting mappings by popularity, majority country count or newest row. The experiments' combined 75 candidate proposals need this global audit before being promoted to automatic exact matches.

An exact reverse-map hit is stronger than a title string, but its authority is still an indirect provider-link relationship. Require title-level scope, existing non-deleted catalog entity, no known identity quarantine, and agreement with any source-supplied type/year. A material contradiction produces review. For unknown source type, a globally unique well-scoped mapping can supply it; an episode/playback ID cannot.

### Maintenance and inactive availability

For an initial experiment, rebuilding the map from a complete snapshot is simplest. Measure parsed direct/wrapped URLs, rejected URL shapes, unique IDs, aliases, global collisions, stale/unknown/quarantined contributions, and misses on the controlled capture separately.

For a durable production registry later, ingest observed identity edges **before** current availability can delete them. Store source snapshot, parser version, scope and observation dates independently of stays. Removing an offer must not delete a known Wishlist identity or an existing member wish. Conversely, a historical edge must not imply “available now.” A previous good mapping can survive a region loss while being explicitly historical.

Persistence must preserve corrections: a catalog merge, deleted title, wrong-provider repair, conflicting new link or source quarantine should flag/retire the old edge for review. An append-only “trust everything ever seen forever” map would preserve mistakes as strongly as good aliases. TTL is appropriate for rechecking provenance and negative-cache entries; availability's 30-day freshness threshold is not by itself an identity-expiry rule. These are proposed rules, not a claim that current tables already implement them.

## Simkl Netflix lookup: technically useful, constrained fallback

**Documented.** Current `/search/id` accepts `netflix`, described in its OpenAPI parameter as a beta Netflix `movieid` that may not work. It needs a registered app identity; its operation security lists `clientId`, not a member library token. Empty matches can be HTTP 200 `[]`. The page discourages loops resolving more than approximately 20 IDs without discussing the use first. No request using a private captured ID was made. [Current ID-search reference](https://api.simkl.org/api-reference/simkl/search-by-id).

**Documented.** Simkl recommends this cheaper lookup sequence instead:

```text
GET /redirect?to=simkl&netflix=PUBLIC_OR_AUTHORIZED_ID&client_id=APP&app-name=NAME&app-version=VERSION
  -> inspect 301 Location; do not follow
GET /movies/{simklId} OR /tv/{simklId} OR /anime/{simklId}
  -> inspect ids.tmdb / ids.imdb / ids.tvdb and entity scope
```

`/redirect` requires no member token for `to=simkl`; **never use `to=watched`** for identity resolution because that mode changes account state. It still requires the app parameters and descriptive User-Agent. Cached detail calls should omit Authorization. No guarantee that a Netflix episode ID becomes a correct whole-show identity is documented. [Redirect reference](https://api.simkl.org/api-reference/simkl/redirect), [required headers](https://api.simkl.org/conventions/headers).

**Documented.** External IDs in responses are strings, except Simkl's numeric ID; Netflix IDs are accepted input but generally not echoed back. Preserve the request's Netflix ID when storing a result. A returned Simkl ID/slug alone is not a TMDB match; fetch details and use an actual cross-catalog ID. Anime can be a cour/part rather than a whole TMDB show, so a numeric external relation alone should not promote a partial work into a whole-show wish. [Media object conventions](https://api.simkl.org/conventions/standard-media-objects), [anime mapping guide](https://api.simkl.org/guides/anime).

**Documented.** Default uncached traffic should be sequential; stated per-second limits are 10 GET/1 POST, with V1 app-wide daily allowances versus V2 member-level quotas and exemptions for public cached catalog endpoints. Read errors/backoff rather than assuming unlimited lookup capacity. [Rate-limit reference](https://api.simkl.org/resources/rate-limits).

**Documented, material product constraint.** Simkl restricts using its catalog as a metadata host for a tracker without Simkl integration: a tracker already syncing another tracker must offer Simkl login/sync, and catalog-only use should be discussed first. Branding/link requirements apply; commercial revenue of at least USD 150/month requires a commercial license. An app registration and technically token-free endpoint do not remove those conditions. Therefore a lookup service for 77 private wishes should not simply be added as a hidden generic resolver. [API rules](https://api.simkl.org/api-rules).

## TMDB find: no direct Netflix input

**Documented.** `GET /3/find/{external_id}?external_source=...` supports IMDb, Facebook, Instagram, TVDB, TikTok, Twitter, Wikidata and YouTube, with per-entity support differences. **Netflix is absent**. Adding `external_source=netflix_id` is not a supported route. IMDb is useful for movies/shows/episodes; TVDB is useful for TV/seasons/episodes. Normal application authentication still applies. [Official find reference](https://developer.themoviedb.org/reference/find-by-id).

A practical chain is Netflix ID → a locally trusted crosswalk's IMDb/TVDB ID → TMDB find, when the crosswalk lacks a TMDB ID. The first edge is still necessary; `/find` does not make it disappear. Validate result arrays/entity kinds and uniqueness, and retain a no-match rather than choosing an unrelated first result.

## Other exact-ID leads worth retaining

**Documented properties; unmeasured route.** Wikidata has Netflix work ID `P1874`, TMDB movie ID `P4947`, TMDB TV series ID `P4983` and IMDb ID `P345`. A public-catalog download/query could build an entirely local supplemental crosswalk, preserving statement rank/provenance and all conflicting mappings. Wikidata structured data is CC0. This could cover titles that are no longer available; property existence proves neither coverage nor correctness. Do not send the person's 77-ID list as a remote VALUES query under the current research constraints. [Netflix property](https://www.wikidata.org/wiki/Property:P1874), [movie property](https://www.wikidata.org/wiki/Property:P4947), [series property](https://www.wikidata.org/wiki/Property:P4983), [licensing](https://www.wikidata.org/wiki/Wikidata:Licensing).

The user's browser may also expose parent-title metadata in Netflix's own structured My List/detail responses. That is a plausible capture improvement, but no inspected current response established TMDB/IMDb IDs or every native ID's scope. Avoid promising that adding more browser fields solves the cross-catalog identity edge. The current extension evidence establishes Netflix IDs/history requests, not a universal Netflix→TMDB relation. [Inspected extension evidence](tracker-routes.md#official-netflix-enhancer-inspected-distribution-history-only).

## Concrete acceptance gate

Before automatic native-ID matching is described as supported, run the full local crosswalk over a complete catalog snapshot and report:

1. Per-shape parseability and global unique/colliding Netflix IDs, deduplicated by actual catalog identity.
2. The 77-row capture's native-ID coverage with **all** catalog candidates, then manual verification of each proposed match's movie/show/whole-work scope.
3. The incremental benefit and conflicts from old/unknown evidence versus current links, without treating either as present availability.
4. Reproducible provenance for every accepted mapping, and visible unresolved reasons for missing/ambiguous/unsupported IDs.
5. Repeatability after a provider offer disappears, a catalog title is corrected, and a mapping becomes conflicted.

This keeps the initial route small: local links first, title-candidate review second, optional independently licensed public crosswalks later. It preserves the useful 75/77 combined candidate result without turning its restricted candidate sets into an unsupported exact-identity claim.

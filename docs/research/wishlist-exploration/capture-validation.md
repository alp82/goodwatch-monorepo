# Capture adapter validation

Research date: 2026-10-18. Technical companion to [browser routes](browser-routes.md) and [alternative routes](alternative-routes.md). This documents implementation evidence and a synthetic extraction experiment. **No signed-in Netflix/Prime account, live streaming list, production database, or real Watcharr export was tested.** It establishes no working live-provider support. No upstream implementation was copied into the repository.

## Recommended first path

Ship shared-file intake with an independently written **Watcharr native JSON adapter**, selecting `PLANNED` movie/show entries. This gives existing Watcharr users direct catalog identifiers without another account or a streaming session. Separately validate one Netflix My List capture producer; keep its native IDs and unknown media type until catalog resolution establishes the work. Netflix Watchlist Manager file compatibility is a useful cheap bridge for research, but its title/native-ID output alone does not demonstrate correct GoodWatch matches.

This sequencing distinguishes a useful file import from a still unvalidated streaming extraction route. Calling the entire slice a working Netflix importer would overstate the evidence.

## Strongest identity route: original Watcharr exports

Pinned local checkout: `sbondCo/Watcharr` at `ab7041fd6deb0b34e342b1f8967f821b76eab99b`. Its exporter serializes `/watched` as an array; the unpaginated handler explicitly exists for whole-list download. Inspection supports this projection:

| Source field | Capture field or handling |
| --- | --- |
| row `status === 'PLANNED'` | Include as Want to See intent |
| `content.type === 'movie'` / `'tv'` | `mediaType: 'movie'` / `'show'` |
| `content.tmdbId` | Validated positive integer `tmdbId`; preserve source-supplied identity |
| `content.imdb_id` | Optional validated `imdbId` |
| `content.title` | Original `title` |
| `content.release_date` | Optional year only after valid date parsing |
| other statuses; games; `tv_episode` | Excluded or reported unsupported; never coerce into a whole-show wish |
| row creation/update times | Do not assume the current PLANNED transition date; omit `addedAt` initially |

Sources: [exporter](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/routes/(app)/settings/ExportListModal.svelte), [handler](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/feature/watched/router.go), [content identity model](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/content.go), [status model](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/watched.go).

Deduplicate using `(mediaType, tmdbId)`, not numeric TMDB ID alone: movie/show namespaces overlap. The Watcharr database row/content ID is installation-local; avoid presenting it as a global provider identity. Original export inspection supports whole-file enumeration, but an arbitrary uploaded array cannot prove that it was not truncated before upload. Use `completeness: 'unknown'` conservatively until an actual controlled export validates counts; no profile/country/export time is supplied by this bare array. Keep excluded/invalid-row diagnostics outside the item projection. GPLv3 licensing applies to implementation copying; independent schema compatibility does not require copying its parser. [License](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/LICENSE).

## Concrete Netflix capture route to validate

Use a read-only, page-local collector restricted to `https://www.netflix.com/browse/my-list` (normalize pathname, tolerate trailing slash/query). Restrict scanning to the positively identified My List container; fail closed if its boundary is absent or ambiguous. Do not scan every link on a page that can also contain recommendations, headers, trailers or open detail overlays.

The inspected MIT Netflix Watchlist Manager source provides two concrete native-ID observations: `.ptrack-content` JSON in `data-ui-tracking-context` contains `video_id`, and `/watch/{id}` anchors contain an ID. Accessible anchor labels and `.fallback-text` supply title text. Its background exports `{title, videoId, trackId?}`. [Pinned content reader](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/content_script.js), [background](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/background.js), [MIT license](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/LICENSE).

These are patterns to validate on current cards, not a present-day selector contract. Prefer explicit card `video_id` and genuine `/title/{id}` detail links for initial GoodWatch capture. Treat `/watch/{id}` as additional evidence requiring scope validation: a playback ID can describe an episode. Do not rewrite a playback link to a show detail URL or claim it is a whole-show ID. Emit only safe canonical source URLs supported by observed link shape. A native ID is a string, never a TMDB ID. Missing year/type stay absent/unknown. Strip tracking parameters and omit `trackId`, profile GUIDs, account identifiers, cookies and authentication state.

Accumulate evidence as cards appear, using a Map keyed by service/native ID; scan initially and on relevant subtree mutations, plus a bounded periodic fallback. A snapshot at the end loses recycled cards. Detect conflicting IDs within a card and report them rather than choosing arbitrarily. Catch malformed tracking JSON per card. Full numeric path validation avoids accepting `123junk` through `parseInt`.

The orchestrator owns scrolling, cancellation and lifetime. Observe the actual scroll container; nested scrollers and constant-height virtualization invalidate body-height termination. A no-growth timeout means `unknown`, not `complete`. A known interruption/cap before observed remaining pages means `partial`. Only verified list exhaustion with independent count/membership checks can justify `complete`; count equality alone can hide duplicates or cross-list leakage. Even a complete rendered list may omit region-unavailable entries, requiring comparison with current archive or a validated structured list response.

Abort/reset the session on profile change, navigation or list-boundary loss. Profile display labels can be absent or duplicated; an optional user-provided `profileLabel` is descriptive metadata, not proof of account continuity. An in-memory profile marker can guard continuity but must not enter the exported file. Captures across two profiles must never share a collector Map.

## Extractor boundary

A small interface keeps provider observations separate from browser permissions, scrolling and catalog matching:

```ts
type CaptureItem = {
  title: string
  mediaType: 'movie' | 'show' | 'unknown'
  year?: number
  tmdbId?: number
  imdbId?: string
  sourceId?: string
  sourceUrl?: string
  addedAt?: string
}
type CaptureBatch = {
  items: CaptureItem[]
  issues: { code: string; row?: number }[]
  // Internal evidence only; not added to the agreed portable v1 schema.
  exhausted: boolean | 'unknown'
  reportedTotal?: number
}
interface WishlistExtractor<Context> {
  id: string
  detect(context: Context): boolean
  // Synchronous read of selected list evidence; never scrolls or fetches.
  read(context: Context): CaptureBatch
}
```

The browser runner supplies a validated list container and continuity state. A file adapter supplies parsed untrusted JSON. Both return observations and diagnostics; neither resolves titles, writes GoodWatch data, mutates provider lists, or supplies authentication. An aggregator emits the planned `{format:'goodwatch-wishlist',version:1,source,profileLabel?,country?,exportedAt?,completeness,items}` envelope. The portable schema has one source/profile per file, so do not union providers or profiles. Use stable source identifiers (`netflix`, `watcharr`) and omit unknown optional metadata. Preserve uncertainty before adapting to existing `ParsedImport`, which needs a resolved movie/show identity.

## Can existing catalog streaming URLs resolve native IDs?

**Feasible as a bounded candidate crosswalk; unmeasured coverage and ambiguity.** The active CrateDB [schema](../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py) stores `streaming_availability.stream_url` alongside `media_tmdb_id`, `media_type`, country, service and offer type. Its primary key is the title/country/service/offer tuple, not provider identity. The active [publisher](../../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py) merges scraped links with provider evidence and deletes no-longer-published availability rows. A reverse map therefore cannot be a durable provider-identity registry.

The [crawler](../../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/fetch.py) stores the offer href, including possible `click.justwatch.com` wrappers. An equality lookup on a normalized Netflix detail URL can miss wrappers, tracking variants, playback paths, missing links and removed/unavailable offers. The [link renderer](../../../goodwatch-webapp/app/utils/streaming-links.ts) falls back to TMDB's where-to-watch page when the direct URL is absent; that fallback must never be mistaken for a provider ID. Existing [MCP link loading](../../../goodwatch-webapp/app/server/mcp/watch-links.server.ts) performs the forward title-to-offer lookup; no reusable native-ID reverse resolver was established in this inspection.

A viable experiment is a local, redacted catalog fixture processed with a provider-specific URL parser. Require exact HTTPS host/path rules; decode only documented wrapper fields, never follow uploaded URLs on the server. Extract `(service, providerId, scope)` and retain *all* distinct `(mediaType, tmdbId)` candidates. Repeated country/offer rows for one title are one candidate; different titles are ambiguous. Restrict service identity and validate scope before accepting a unique candidate; a known movie/show type from capture must agree. Never resolve a show through an unvalidated episode alias. Matching title/year can corroborate or flag a candidate but cannot turn an alias into a trusted identity. A zero-hit or ambiguous result stays unresolved.

No production query was performed, and repository test URLs are synthetic. Before relying on this path, measure URL parseability, native-ID coverage, movie/show collisions, wrapper variants and conflicts against a controlled list. Exact TMDB/IMDb supplied by an original export should take precedence over this indirect route. A future durable identity table would need provenance, scope, conflict rules and freshness policy separate from availability.

## Synthetic extraction experiment

Scratch files: `/tmp/goodwatch-wishlist-orchestration/capture-fixtures.mjs` and `synthetic-netflix-capture.json`. Run with `node /tmp/goodwatch-wishlist-orchestration/capture-fixtures.mjs`.

Result: **10 assertions passed**. Two synthetic snapshots representing recycled cards accumulate three IDs; reading only the final snapshot captures two. Same-title distinct IDs survive. Unknown media type remains unknown; URL tracking is stripped; lookalike hosts, numeric-prefix garbage and playback-only links are rejected; malformed optional tracking data does not stop a valid card; conflicting native IDs and missing titles become issues.

This tests pure extraction/accumulation logic using synthetic card evidence, not a DOM implementation, scrolling, provider selectors, profile detection, matching or end-to-end import. The output IDs are invented and prove no real provider identity. It is intentionally outside production code and is not a shipping adapter.

Additional fixtures required for implementation: Watcharr mixed statuses and games; overlapping movie/show TMDB IDs; malformed/native-null fields; empty export versus exporter error object; Netflix detached/recycled cards, recommendation leakage, query/trailing slash routes, profile switch, interrupted slow load, nested scroller, missing label, episode playback ID, unavailable entries; reverse-map multi-country duplicates, two-title collision and wrapped URLs.

## Required live validation before provider support

1. Obtain one owner-generated current Watcharr export and reconcile PLANNED movie/show counts, original IDs and mixed excluded states. Include enough rows to expose pagination; verify no private notes/activities leak into the projected file.
2. On an authorized Netflix account, record selected profile/list and a known reference set. Include movie, show, remake, duplicate title, unavailable title, more than one loaded page, two profiles, removal/re-add and an interrupted run. Preserve only redacted evidence.
3. Compare accumulated DOM IDs and native scope with real detail URLs. Test the list boundary and selectors in the current language/layout. Establish whether region-unavailable membership is omitted. If testing structured responses, select only the list response and keep session data local; do not export a whole HAR.
4. Resolve those items against a nonproduction catalog fixture. Report extraction recall separately from correct catalog-match rate and applied wishes; do not use first search hits as exact identity. Verify unresolved provider-only/unknown-type rows remain visible in a receipt.
5. Verify repeated additive import, explicit rewatch behavior and undo at the existing import boundary. Incomplete capture never authorizes deletions or replacement.

A bookmarklet, extension content script or Safari webpage action can share this extractor later. Distribution and browser execution do not remove the identity/completeness gates. Prime is a separate next candidate: the inspected history/scrobbling APIs do not establish current Watchlist pagination or semantics, so no Prime adapter is validated here.

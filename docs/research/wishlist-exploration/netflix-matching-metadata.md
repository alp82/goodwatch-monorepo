# Netflix wishlist matching metadata

Research date: 2026-10-18. Evidence: one user-authorized saved Netflix page, the corresponding initial capture, and the later 77-item capture. Private HTML, exported titles/native IDs, profile values, opaque references, cursors, logging fields and archived scripts are not included or committed. The HTML was parsed as inert text; archived scripts were never executed and no provider request was made. Browser capability claims below use official Chrome documentation. This note changes no runtime or UX.

## Decision

Netflix exposes useful **provider type and year evidence** in the inspected page's embedded GraphQL cache. A metadata-aware capture can supplement already observed wishlist IDs with this evidence, using the current `activeTab` + `scripting` permissions. The inspected snapshot can enrich 24 of the final export's 77 items; it cannot supply metadata for the remaining 53. Enrichment is not a verified Netflix-to-TMDB mapping and does not establish how many items will match the catalog.

Prefer a bounded, inert parse of existing script text first. Treat access to metadata loaded by later carousel pages as a separate live validation requirement. Do not request GraphQL pages or broaden permissions merely to fill this gap.

## Observed shape and evidence

The inspected inline assignment is `netflix.reactContext.models.graphql = JSON.parse(<string literal>)`. The decoded object contains a normalized `data` map. The script's ordinal position in this archive is not a stable selector.

The selected row is one `PinotCarouselSection` with exact `displayString` **Meine Liste**. Its `entities` connection reports `totalCount: 77`, 13 initial `edges`, `hasNextPage: true`, and `hasPreviousPage: false`. The same saved DOM has five mounted standard-card anchors in eight virtual slots. Neither 13 edges nor five mounted cards represents the complete list. The later user capture contains 77 unique native IDs; its earlier 13 captured identities and titles are preserved within it.

The safe reference chain is:

```text
selected section.entities.edges[].node.__ref
  -> PinotStandardBoxshotEntityTreatment
       displayString                 # provider display title
       unifiedEntity.__ref
         -> Show | Movie
              videoId                # provider-native title ID
              releaseYear            # provider year
```

The literal `__ref` values are opaque lookup keys within this one cache. Resolve them only against the decoded own `data` map; they are not catalog IDs or URLs.

| Check | Result in the inspected private sources |
| --- | --- |
| Initial selected-row references resolve | 13/13 |
| Initial row type | 13 `Show` entities; no movie in this initial row page |
| Initial row native ID and year | 13 positive integer `videoId` values and 13 integer `releaseYear` values |
| Initial row joins to final export by native ID and exact title | 13/13 |
| Exported IDs with `Show`/`Movie` metadata anywhere in the saved cache | 24/77: 22 shows, 2 movies |
| Those 24 have bounded integer year and matching display-title joins | 24/24 |
| Conflicting type/year evidence for those native IDs | 0 observed |
| Exported IDs absent from this saved metadata cache | 53/77 |
| Existing final export fields | 77 unknown types; no year or TMDB/IMDb ID |

`Show` also contains `currentEpisode` and `seasons` references; an episode has its own `videoId` and `releaseYear`. Use the **parent Show** fields for a show wish. Do not substitute an episode ID, episode year, season count or runtime for title-level identity/type. A `Movie` entity has its own `videoId` and `releaseYear`. The observed enum mapping is `Show` → `show`, `Movie` → `movie`; other/missing types stay unknown.

`releaseYear` is the provider's observed field. This investigation does not establish that it always equals TMDB's chosen premiere year, especially for different regional releases or show seasons. Localized titles and differing years can still leave legitimate entries unmatched.

## Membership and profile binding

The exact selected row, its 13 initial reference chains, and their identity/title agreement with the later export support the association in this saved page. They are not a signed current-profile contract. The normalized cache also contains unrelated rails and media. **Never turn every cached entity into a wish.** Metadata supplements the native IDs already captured from the selected wishlist boundary; it does not establish membership itself.

The active profile marker is the unique `button[data-uia="navigation+profile-menu+trigger"]` containing a unique `img[data-uia="navigation+profile-menu+Avatar"]`. The adapter already retains its alt/src signature only in memory; hidden menu avatars are excluded. A future metadata read should check that marker and the list boundary before and after reading, join by exact native ID, and reject contradictory title/type/year evidence. Do not serialize profile values or use this marker to infer a durable account identity.

Inline bootstrap text can remain stale after a profile switch or SPA update. Matching native IDs from the currently observed row and unchanged profile guards is necessary; the mere presence of a `graphql` assignment is insufficient proof that all its list memberships are current.

## Browser access and later pages

An isolated content script shares the document DOM, so it can read an inline script's `textContent`. It cannot directly read the page's JavaScript variables, including a live `netflix` global. This makes inert script-text extraction compatible with the existing isolated collector. Chrome also explicitly recommends data parsing rather than evaluating page-supplied text. [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

The existing `activeTab` permission, granted by the user's extension action, plus `scripting` permits injection into that tab without persistent host access. The permission survives same-origin navigation; the collector's own wishlist/path/profile guards remain stricter. No `cookies`, `debugger`, `webRequest`, broad host permissions or additional runtime dependency is needed to read this DOM text. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Chrome scripting permissions](https://developer.chrome.com/docs/extensions/reference/api/scripting#permissions).

Later carousel interaction does not guarantee that the original inline script text changes. This archive supplies no evidence that subsequent responses update a DOM-readable metadata node, or that the initial `reactContext.models.graphql` object is a live cache. Reading a page global would require a narrowly scoped `world: "MAIN"` probe; this API uses the same injection permissions, but the probe shares the host page's JavaScript environment. Return only bounded allowlisted scalar metadata, and treat its output as untrusted. A MAIN probe alone would not prove cache freshness or later-page coverage. [Chrome execution worlds](https://developer.chrome.com/docs/extensions/reference/api/scripting#type-ExecutionWorld).

Authenticated same-origin requests from content scripts are technically subject to the page's origin rules; extension-origin cross-origin requests have separate host-permission requirements. Neither browser capability documents Netflix's private GraphQL contract, pagination operation, authorization inputs or semantics. No endpoint, request replay, credential extraction or response interception was tested here. Prefer observing metadata already loaded by the user's carousel actions before considering a separate network integration. [Chrome network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Minimal implementation seam and validation still needed

A future pure metadata adapter should accept bounded script text and an explicit set of native IDs already observed in the selected row; return only `{sourceId, mediaType, year, titleEvidence}` plus bounded diagnostic counts. It should recognize the exact assignment shape, decode the quoted literal as data, use `JSON.parse`, and resolve only whitelisted reference paths. Never use `eval`, `Function`, or execute any archived script. A production JavaScript-string decoder needs explicit escape/truncation/duplicate-assignment tests; the inert Python investigation is not a ready extension parser.

Require a positive native `videoId`, allowed parent `__typename`, bounded integer year and an exact source-title corroboration when available. Keep unavailable metadata unknown, quarantine contradictions, cap input/reference counts, and ignore every unrelated field. Enrich only existing membership observations. Keep `completeness` unknown independently of metadata coverage.

Before shipping, validate synthetic malformed input and actual MV3 isolated-world script-text access, then a user-driven live traversal beyond the initial 13 entities. Measure observed IDs versus IDs with corroborated metadata, verify parent show versus episode identity, and check stale/bootstrap/profile-change behavior. If later metadata is accessible only in a page runtime cache, assess that exact read-only MAIN seam with synthetic and live evidence before adopting it. None of these later-page claims is validated by the static archive.

## The already-exported 77 entries

The current shared parser deliberately leaves unknown types unmatched. Known movie/show entries with a year can use the existing unique exact title/year lookup within that type; missing/ambiguous results remain unmatched. Native Netflix IDs are preserved as evidence, not treated as TMDB/IMDb IDs. [Shared parser](../../../goodwatch-webapp/app/server/imports/wishlist.server.ts), [catalog matching](../../../goodwatch-webapp/app/server/imports/preview.server.ts).

A local, opt-in backfill could join this saved cache to the existing export by native ID and exact title, adding type/year for **24** entries while retaining the other **53** unchanged. No enriched private artifact was written during this investigation. The number of correct automatic catalog matches is unmeasured; do not advertise 24 automatic matches. The existing manual matching flow remains usable for every unresolved entry. Re-capture with a later metadata-aware adapter or an independently validated native-ID crosswalk could improve coverage without guessing title-only matches; both require additional work and evidence.

# Netflix page data and exact My List membership: offline findings

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Investigated 2026-10-19 on branch `prototype/netflix-pagestate`, after the gates in `PROTOCOL.md` were committed in `b3855a4a`. These are offline findings from the owner's saved My List page (private, de-DE, saved 2026-10-18 17:39) and the Netflix client script saved with it. Output and this document hold counts and structure names only. This is evidence, not a verdict.

## Answer so far

**The page doesn't hold the whole list when it loads.** The inline page state carries the My List row's count and its first 13 entries. Netflix's own client loads every later entry with a GraphQL query, `CarouselPage`, that returns exactly the data needed: each entry with its position cursor, plus `totalCount` and `hasNextPage`. Those responses go into an Apollo cache that Netflix doesn't expose on `window`.

So exact membership is reachable only by reading the page's own `CarouselPage` responses (S4), its hidden cache (S3), or by sending paging requests (S5). S4 and S3 need code in the page's own world, and S5 sends requests of its own. Per the ticket's bounds, I stopped here and didn't build any of them.

## Measurements

Run `node scripts/inspect-saved-page.mjs <saved-page.html> <reference.json>` for these counts. Reference R1 is the owner's 77-ID capture from 2026-10-18 18:00, 21 minutes after the page was saved.

| Measure | Result |
| --- | --- |
| R1 IDs found anywhere in the saved page | 26 of 77 |
| In the inline GraphQL state | 24 (the 13 My List entries plus titles that also appear in other rows) |
| In the rendered page (outside scripts) | 12 |
| In the Falcor cache or the React context | 0 |
| R1 IDs not in the saved page at all | 51 |
| My List sections in the inline state | 1 |
| Inline My List entries | 13 of a reported 77 |
| Positions contiguous from 0 | Yes (0 to 12) |
| `hasNextPage` | True |
| Inline entries that are in R1 | 13 of 13 |

## How later entries load (from Netflix's client code, names only)

- **Query:** `CarouselPage(rowId, carouselPageSize, carouselAfterCursor, carouselVersion, …)` asks for `node(_id: $rowId) { ...CarouselSection }`.
- **Fields returned:** `CarouselSection` requests `entities(first: $carouselPageSize, after: $carouselAfterCursor, sectionVersion: $carouselVersion)`. The `CarouselSectionEntitiesConnection` fragment returns `edges` (each with a cursor), `pageInfo { hasNextPage endCursor }` and `totalCount`. The cursor decodes to the position, as with the inline entries.
- **Transport:** Requests are Apollo persisted queries (`extensions.persistedQuery.sha256Hash`). The client's default GraphQL endpoint is the same-origin `/graphql`. A configuration value can point it at a cross-origin endpoint, so which one a live page uses needs live evidence.
- **Cache:** Netflix creates its Apollo client with `devtools: { enabled: false }`, so `window.__APOLLO_CLIENT__` isn't set. The cache is reachable only through framework internals.
- **Changes after load:** A separate `EDDEntityDelta` fragment exists for entity updates. How My List changes are pushed to a live page wasn't established.

## Sources against the gates

| Source | P1 Coverage | Safety | Status |
| --- | --- | --- | --- |
| S1 inline state | Fails: 13 of 77 | Within the capture's bar | Measured |
| S2 other inline data | Fails: 0 My List entries beyond S1 | Within the capture's bar | Measured |
| S3 the page's live cache | Possible: the cache gets every page's entries once the row has loaded them | Page-world code reaching into framework internals; reads the whole cache, then filters | Not built. Fragile and broad, not recommended. |
| S4 the page's own `CarouselPage` responses | Likely: each response carries entries, positions and a fresh `totalCount` | Page-world hook on the page's own fetch or XHR, read-only. No own requests. Needs justification and review. | Not built. Recommended next, after review. |
| S5 own paging requests | Full: positions 0 to count minus 1 without clicking | Sends requests of its own with the member's session | Out of bounds. Not built. |

## What S4 would and wouldn't prove

If the live `CarouselPage` responses for the My List row deliver contiguous positions 0 to `totalCount` minus 1:

- **A title Netflix counts but never shows:** It appears as an entry with an ID, or a position gap reveals it. Either way the count can't be met by accident.
- **A foreign card rendered as an ordinary card:** It isn't an entry, so it can't enter membership. A rendered card outside the entries becomes a contradiction.
- **A title added elsewhere during the capture:** It shows as a changed `totalCount` or shifted positions between responses. The rule fails safe on any change.
- **Unmount, remount or carousel resets:** Irrelevant, because wrap evidence comes from positions, not from the DOM.

It still needs the reviewed arrow to make the page fetch each page, and it depends on Netflix's operation name and response shape. Those are hypotheses until a live check.

## Recommendation (not a verdict)

1. **Make Netflix's position-cursored entries the only source of `complete`.** The carousel becomes a cross-check that can only downgrade a verdict, for example when a rendered card is outside the entries. The third review of 0.0.7 found carousel-observed wraps unreliable: a reset across an empty DOM was accepted as a wrap. The carousel path shouldn't carry `complete` on its own, and its two open defects stay unfixed unless this route fails.
2. **Next step: get a reviewed design for a counts-only S4 diagnostic** before building it. The design covers: a read-only page-world hook installed at Start and removed at Stop, keeping only `CarouselPage` responses whose node ID is the My List section's ID, and keeping only entry IDs, positions, `totalCount` and `hasNextPage`. It sends no requests and doesn't change any request or response. The diagnostic would report counts and codes only. The owner would run it once, with the reviewed arrow, to establish the live operation name, transport, endpoint origin, and whether every position arrives.
3. **Save must re-query and validate before writing,** in any design. It never serializes a cached result: it asks the collector again, rechecks provenance, the count and positions, and writes only what that check returns.
4. **Keep S5 out of bounds** unless S4 fails live. If it does, bring the evidence back for an explicit decision; S5 would replay persisted queries with the member's session.
5. **Ask for an independent reference in parallel:** the privacy archive's `MyList.csv` (#640) as R3, because R1 and the live captures share the capture's assumptions.

## Limits

- One saved page, one profile, de-DE, carousel layout. The client script is one build. Its query and field names can change without notice.
- The live endpoint, request method and response shape weren't observed. No request was made.
- R1 was captured 21 minutes after the page was saved, so the list may have changed in between. The 13 inline entries all match it.

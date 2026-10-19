# Netflix My List capture from the page's own responses: design for review

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Design only, written 2026-10-19 for independent review before anything is built. Based on the offline evidence in `FINDINGS.md` and the owner's decisions of 2026-10-19:

- **Q20:** Keep working toward a reliable `complete`.
- **Q23:** Design S4 as the automatic route, as one extension with per-service modules.
- **Q24:** The owner is requesting the Netflix privacy archive as an independent reference.

The single-extension scope belongs to [#731](https://github.com/alp82/goodwatch-monorepo/issues/731). This document only keeps Netflix's module boundary clean.

## Goal

One **Start** captures the open profile's whole My List automatically. Membership comes only from Netflix's own My List entries: the inline page state for positions 0 to 12, and the page's own `CarouselPage` responses for later positions. Assisted clicking makes the page fetch those pages. The carousel's rendered cards are a cross-check that can only downgrade the verdict. **Save** re-queries and revalidates before writing.

## Member flow

1. Open My List and click the GoodWatch extension button.
2. Choose **Capture My List**. The extension checks the page, installs the observer, and clicks the My List row's arrow until every position has arrived or a bound is reached.
3. Choose **Save file**. The extension revalidates and saves what the revalidation returns.

Three member actions, as in 0.0.7. There is no manual mode for a `complete` verdict. Manual clicking stays available only as a fallback when the arrow can't be found safely. It can still yield `complete`, because membership comes from responses, not from who clicked.

## Module boundary

The shared core knows nothing about Netflix. The Netflix module knows nothing about popups, files or reports.

| Shared core (reusable for other services, see #731) | Netflix module |
| --- | --- |
| Popup, command protocol, state machine, timers and bounds | `matchesPage(location)`: `https://www.netflix.com/browse/my-list` |
| Provenance framework: run guards on every scan, status and save | `profileIdentity()`: avatar alt and image; `stateProfile()`: current profile name and uniqueness from page state |
| Freshness and fingerprint checks of the module's reference | `readReference()`: count, row ID, label and entries 0 to 12 from the inline state, with the 0.0.7 provenance rules |
| Verdict assembly from module facts | `findRow()`, `nextButton()`: the reviewed row and arrow rules from 0.0.6 and 0.0.7 |
| Observer host: installs the module's page-world observer, pulls its buffer, removes it | `observerSpec`: request matcher and response parser for `CarouselPage` (see "Matching rule") |
| Envelope builder for shared wishlist v1.1 | `normalizeEntry()`: `{ position, sourceId, title, mediaType }` |
| Save rule and sanitized report | `readCards()`: rendered card IDs for the cross-check |

Interface sketch, in TypeScript notation for review only:

```ts
interface ServiceModule {
  id: 'netflix'
  matchesPage(location: Location): boolean
  profileIdentity(): { key: string } | null          // never leaves the extension
  readReference(): Reference | Refusal              // provenance-checked
  findRow(): Element | null
  nextButton(row: Element): HTMLButtonElement | null
  observerSpec: ObserverSpec                         // runs in the page's world
  readCards(row: Element): string[]                  // cross-check only
}
interface Reference { rowId: string; label: string; total: number; entries: Entry[]; fingerprint: string }
interface Entry { position: number; sourceId: string; title: string; mediaType: 'movie' | 'show' | 'unknown' }
```

## Observer: scope

- **World:** The page's own world (`chrome.scripting.executeScript` with `world: 'MAIN'`), injected only into the active tab after **Capture My List**, under the existing `activeTab` and `scripting` permissions. No new permission.
- **What it wraps:** `window.fetch` and `XMLHttpRequest` (`open`, `send` and the load event), because the client can use either.
- **What it never does:** It sends no request of its own. It never changes a request's URL, method, headers, body or credentials, and never changes, delays or replaces a response. It reads a clone of a fetch response, or the XHR's `responseText` after load. Every error inside the observer is caught and ignored, and the page's call proceeds as if no wrapper existed.
- **What it never reads:** Cookies, storage, tokens or headers. The request's operation name and variables are read only from the URL query string or body of requests to the GraphQL address.
- **Which requests it considers:** Same-origin `https://www.netflix.com/graphql`, plus the cross-origin GraphQL address found in the client configuration, matched exactly by origin and path. The live diagnostic (see "Before building") records which one the page uses. Any other URL is passed through untouched.

## Matching rule for My List row responses

A response is accepted only when every condition holds:

1. **Request:** `operationName` is exactly `CarouselPage`, and `variables.rowId` equals the My List row ID from the provenance-checked reference (the section's `_id`, compared as a string). The ID comes from the inline state, never from the response.
2. **Response:** status 200 and parseable JSON, with no `errors` array, under a 2 MB size cap. `data.node.__typename` is `PinotCarouselSection`, `data.node._id` equals the same row ID, and `data.node.displayString` equals the row heading.
3. **Entries:** Exactly one `entities` or `entities(...)` connection. Every edge has a cursor that decodes to a whole-number position below `totalCount`, plus a node that resolves to one entity with a numeric `videoId`.
4. **Count:** `totalCount` equals the reference total.

A request that matches condition 1 with a response that fails 2 to 4 is recorded as a **rejected My List response** with a code. Any rejected My List response blocks `complete`. Requests that don't match condition 1 are ignored and only counted.

## Observer lifecycle

| Moment | What happens |
| --- | --- |
| Install | After the reference passes provenance, before the first click. The observer keeps the original `fetch` and `XMLHttpRequest` methods, installs pass-through wrappers, and records an install time and a random install token. |
| During capture | The wrappers buffer accepted entries and rejection codes, in memory only, inside a closure. The isolated collector pulls the buffer through the token-keyed accessor every scan and validates everything again on its own side. |
| Integrity check | On every pull, the observer reports whether `window.fetch` and `XMLHttpRequest.prototype.open` and `send` are still its own wrappers. If anything replaced them, the result is `observer_displaced`, which blocks `complete`. |
| Remove | On stop, cancel, any termination, Save, or 10 minutes after install, whichever comes first. If a method is still the observer's wrapper, the original is restored. If something else wrapped it in the meantime, the wrapper turns itself into a pure pass-through, so the page is never broken. The buffer is cleared. |
| Page navigation or reload | The page's world is discarded with the document, and the capture ends as in 0.0.7 (`terminated_navigation`). |

## Data kept

| Kept, in memory, until Save or discard | Never kept |
| --- | --- |
| Per accepted response: `totalCount`, `hasNextPage`, and per edge the decoded position, `videoId`, entity type name and title | Cursors (only the decoded position), artwork, URLs, tracking data, any other row, request bodies, headers, cookies |
| Counts of ignored requests and of rejected My List responses by code | Anything about non-matching requests beyond a count |

Titles are needed for the wishlist file. They leave the extension only in the file the member saves, never in the report.

## Verdict rule

Membership is the union of the reference's entries (positions 0 to 12) and the accepted responses' entries. A capture is `complete` only when all of these hold:

1. **Provenance:** As in 0.0.7: profile matches and is unique, the page is My List, the document loaded on My List within 10 minutes, and the inline state is unchanged. The profile guard was present at Start and is unchanged now.
2. **Coverage:** Every position from 0 to `total − 1` has exactly one ID.
3. **Consistency:** No position maps to two IDs, no ID sits at two positions, and every response reported the same `totalCount` as the reference.
4. **Clean observation:** No rejected My List response, observer intact for the whole capture, and no termination.
5. **Cross-check (downgrade only):** Every card ID read from the My List row is in the membership, and no card shows a title that conflicts with its entry. A failure downgrades to `partial` (`card_outside_entries`, `card_title_conflict`). Cards can never raise a verdict, and never-rendered entries are expected and counted.

Wrap evidence, lap detection and position adjacency from 0.0.7 aren't used for the verdict. The traversal stops when coverage is reached or a bound hits, not when the carousel appears to wrap.

The file's items are the membership entries, not the cards. That includes titles Netflix counts but never renders, which closes that blind spot instead of only detecting it. Media type comes from Netflix's entity type: `Movie` gives `movie`, `Show` gives `show`, anything else gives `unknown`, counted in the report. Using Netflix's type is a review point, because 0.0.7 always wrote `unknown`.

## Traversal

- **Clicking:** Only the reviewed arrow rule from 0.0.6 and 0.0.7. If it isn't found safely, the capture falls back to manual clicking, with the same verdict rule.
- **Stopping:** Stop clicking when coverage is reached. Otherwise stop at `ceil(total / cards in view) + 3` advances plus 3 advances with no new accepted response, or at 3 minutes, as `partial` with the gap count.
- **Waiting:** After each click, wait for an accepted response or the 8-second maximum. No new entries for 3 clicks counts as a stall.

## Save rule

Save never writes a stored result. The popup asks the collector to `finalize`, which:

1. Runs every provenance check again: profile, page path, document age, inline-state fingerprint.
2. Pulls the observer buffer once more and checks observer integrity.
3. Recomputes coverage, consistency and the cross-check from the current state.
4. Builds the envelope from that result and returns it with its verdict, then removes the observer.

The popup writes exactly what `finalize` returns, and the result can be `partial` or no file. If `finalize` fails or can't be reached, nothing is written.

## Output

Shared wishlist v1.1 (`version: 1.1`), one profile and one list per file. `completeness` is the verdict. Rows are `{ title, mediaType, sourceId }` with `sourceId` the Netflix video ID. No v1.1-only fields (source Seen, season or episode coordinates) are produced, because My List entries are titles. No profile name, row ID or cursor goes into the file.

## Report (counts and codes only)

`version`, `module`, `mode` (assisted or manual fallback), `verdict`, `reason`, `reportedTotal`, `inlineEntries`, `acceptedResponses`, `rejectedResponses` (by code), `ignoredRequests`, `positionsCovered`, `gapCount`, `duplicatePositionCount`, `duplicateIdCount`, `totalCountChanges`, `cardsSeen`, `cardsOutsideEntries`, `entriesNeverRendered`, `typeCounts` (movie, show, unknown), `observerIntact`, `observerTransport` (fetch or XHR, same-origin or configured), `profileGuard`, `referenceAgeSeconds`, `advances`, `stalls`, `elapsedSeconds`.

## Failure codes

| Code | Meaning | Verdict |
| --- | --- | --- |
| `reference_*` | The 0.0.7 reference refusals (profile, page, stale, changed, ambiguous, missing) | `unknown`, no observer installed |
| `observer_install_failed` | The page's world couldn't be reached | `unknown` |
| `observer_displaced` | `fetch` or XHR replaced after install | `partial` |
| `response_rejected_status`, `_json`, `_errors`, `_node`, `_row_id`, `_label`, `_connection`, `_cursor`, `_entity`, `_too_large` | A My List request whose response failed the matching rule | `partial` |
| `total_changed` | A response's `totalCount` differs from the reference | `partial` |
| `position_conflict`, `id_conflict` | Two IDs at one position, or one ID at two positions | `partial` |
| `positions_missing` | Coverage not reached by a bound | `partial` |
| `card_outside_entries`, `card_title_conflict` | Cross-check downgrade | `partial` |
| `ended_*` | Profile, navigation, limit or boundary termination (0.0.7 codes) | `partial` or no file |
| `finalize_failed` | Save revalidation didn't complete | No file |

## Threat notes

| Threat | Effect | Mitigation | Residual |
| --- | --- | --- | --- |
| Page-forged responses: Netflix's own scripts or a third-party script on netflix.com (the saved page loads a consent manager) wrap `fetch` above the observer and hand fabricated responses to Netflix's client | Forged entries could reach membership | Request matching uses the inline row ID. Every response must agree with the reference's total, and positions 0 to 12 must agree with the inline entries where they overlap. Card cross-check downgrade. Wrapper integrity check. | A script running on netflix.com that deliberately forges a consistent My List page isn't detectable from inside the page. It can equally forge the DOM, so this route trusts the page no less and no more than 0.0.7 does. Stated as a limit. |
| Page scripts find and tamper with the observer's buffer | Forged or erased entries | Buffer in a closure, reachable only through a token-keyed accessor. The collector revalidates everything on its own side. | Code in the page's world is discoverable by enumeration. Same trust limit as above. |
| A response the page received before install (prefetch) | A gap in positions after 12 | Gaps block `complete` (`positions_missing`). | If Netflix prefetches page 2 at load, this route never reaches `complete` without either installing at document start or sending its own requests. Installing at document start needs a persistent `https://www.netflix.com/*` host permission (an optional permission, granted at runtime). This is a decision for the owner and reviewer, made only if the live diagnostic shows prefetching. |
| The observer breaks the page | Netflix stops working mid-capture | Pass-through wrappers, all errors swallowed, restore on remove, inert pass-through if displaced, 10-minute self-removal | A bug in the wrapper is the main operational risk. Covered by tests against a fixture page and the live diagnostic. |
| Privacy | Row data beyond My List leaks | Only matching responses are parsed. Only IDs, positions, types and titles are kept. The report holds counts and codes. | Titles leave only in the member's saved file. |
| Netflix changes the query or response shape | Route stops working | Every mismatch is a rejection or a gap, never a silent pass | Maintenance cost, tracked in #731. |

## Before building: live diagnostic

A counts-only diagnostic build (the observer plus the report, no file) that the owner runs once on My List with **Capture My List**. It establishes:

- Which GraphQL address and transport the page uses (fetch or XHR, GET or POST).
- Whether `CarouselPage` with the My List row ID arrives for every page after position 12.
- Whether any page arrived before install, seen as a gap with no matching request.
- Whether responses include entries the carousel never renders.
- Whether the type counts look plausible.

The diagnostic itself is reviewed before the owner runs it.

## Independent reference: the privacy archive

The owner is requesting Netflix's privacy archive (netflix.com/account/getmyinfo, up to 30 days), to be saved in `~/dev/projects/goodwatch/third-party-exports/`, outside Git. When it arrives:

1. Inspect `MyList.csv` structure only: columns, row count per profile, presence of IDs or dates.
2. Compare it with the 0.0.7 captures and the S4 captures for the same profile, by Netflix ID if the archive has one, otherwise by normalized title with ambiguous titles counted separately.
3. Report counts only: shared, archive-only, capture-only, ambiguous, and the export-to-capture time gap. An archive-only or capture-only title is evidence about the archive's timing as much as about the capture, so each difference is reported, not resolved automatically.

## Review questions

1. Is a page-world observer with pass-through `fetch` and XHR wrappers acceptable at this safety bar, given the alternatives (DOM only, or own requests)?
2. Is the matching rule tight enough, in particular the row ID from the inline state and total agreement on every response?
3. Should Netflix's entity type set `mediaType`, or should the file keep `unknown` as 0.0.7 did?
4. If prefetching is observed, which is preferable: an optional persistent host permission for install at document start, or accepting that such lists stay `partial`?
5. Is the module boundary right for reuse by the services in #731?

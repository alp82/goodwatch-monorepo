# Netflix My List capture from the page's own responses: design for review, revision 3

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Design only. Revision 3, written 2026-10-19 after the re-review of `994e7f8f`, which said "build the diagnostic after changes" and confirmed the snapshot evidence and the `snapshot_unproven` default. Revision 2 answered the review of `a84c685b`. Nothing gets built until the changes below are re-reviewed. Owner question Q26 (what `complete` may claim) is open.

Owner decisions so far:

- **Q20:** Keep working toward a reliable `complete`.
- **Q23:** S4 is the automatic route: one Start, assisted clicking, an observer of the page's own responses, a carousel that can only downgrade, and a save that revalidates. One extension with per-service modules.
- **Q24:** The owner is requesting the Netflix privacy archive as an independent reference.

The single-extension scope belongs to [#731](https://github.com/alp82/goodwatch-monorepo/issues/731).

## Changes from revision 2

| Re-review item | Where it's handled |
| --- | --- |
| 1. Traversal bounds and cleanup rule dropped (blocking before the diagnostic) | "Traversal bounds", "Cleanup" |
| 2. Pass-through edge cases (blocking before live use) | "Pass-through contract", "Bounds and accounting" |
| 3. Pending stages, one cutoff, sealing on timeout | "Session states", "Finalize" |
| 4. Option (a) can't validate the tail | "Owner decision needed" |
| 5. Reload facts | "If a reload step ever returns" |
| 6. Gates P4, P7 to P9; bypassed wrappers | `PROTOCOL.md`, "Threat notes", "Live diagnostic" |

Revision 2 changed the design for review items 1 to 7 of `a84c685b`: snapshot evidence, lifecycle, pass-through, binding, threat notes, diagnostic claims and consistency rules.

## Snapshot evidence (offline, saved page and saved client script)

The question was whether `carouselVersion` or `sectionVersion`, or anything similar, identifies a server-side membership snapshot, and whether requests send it.

| Evidence | Finding |
| --- | --- |
| Section `version` in the inline state | Present on all 7 carousel sections, including My List. It's a single-digit value, identical for all 7. |
| Cursors | Decode to plain positions (0 to 12 inline). They carry no snapshot or version. |
| What the client sends | The carousel hook (`useCarouselQuery`) keeps the section's `version` and sends it as `carouselVersion` with `rowId`, `carouselAfterCursor` and `carouselPageSize` (twice the visible count). The query passes it to `entities(…, sectionVersion: $carouselVersion)`. |
| What the client does with replies | After each reply, the hook stores the reply's `version` and next cursor, and replaces its card list when the version or connection changes. |
| Caching | The hook uses `fetchPolicy: "network-only"`: every later page is a network request, not a cache read. |

**Conclusion:** No membership snapshot identifier was found. The version is sent and echoed, so it can bind pages to one rendering version. But a single digit shared by every section is very unlikely to name a membership snapshot. Positions are plain offsets, so a list change between page reads shifts them silently. The reviewer's example holds: positions read at different times can form a contiguous, unique, same-total set that was never the list.

The design therefore doesn't claim a snapshot-consistent `complete`. It reports positional coverage, and it binds every page to the version anyway, so a version change is at least detected. What `complete` may mean is an owner decision; see "Owner decision needed".

## What `complete` claims

`complete` would be "as of snapshot S", never "as of Save". A snapshot needs a server identifier, and none exists in the evidence. The capture's metadata describes the read but doesn't identify a snapshot: document load time, inline-state fingerprint, reference total, section version, and the read window from install to the last accepted page.

| Claim | Requires | Status |
| --- | --- | --- |
| Snapshot-consistent complete | A server snapshot identifier that every accepted page is bound to | **Not available.** No identifier exists in the evidence. |
| Full positional coverage | Every position 0 to total − 1 read once within one capture, with the same version and total throughout, and no rejection or conflict | Measurable. Always reported. |

`snapshot_unproven` is set whenever snapshot proof is absent, which with the current evidence is always. Full positional coverage therefore gives `partial` with reason `snapshot_unproven`, and the report states the coverage. Repeated agreeing reads raise confidence but aren't proof. What, if anything, may be written as `complete` is owner question Q26.

## Member flow

1. Open My List and click the GoodWatch extension button.
2. Choose **Capture My List**. The extension checks the page, installs the observer, and clicks the reviewed My List arrow so the page fetches each page.
3. Choose **Save file**. The extension finalizes: it revalidates and writes only what finalize returns.

Three member actions. If the arrow isn't found safely, the member clicks it instead; the verdict rule is the same.

## Module boundary

The shared core holds mechanisms. Completeness rules stay per provider, in the module, as the review asked.

| Shared core (reusable, see #731) | Netflix module |
| --- | --- |
| Popup, command protocol, session states, timers and bounds | `matchesPage(location)` |
| Provenance framework: guards run on every scan, status and finalize | `profileIdentity()` and `stateProfile()` |
| Observer host: page-world install, pull, remove, generations, bounds, sticky codes | `observerSpec`: pinned endpoints, request classifier, response parser |
| Envelope builder (shared wishlist v1.1), finalize and save rule, sanitized report | `readReference()`: total, row ID, label, version and entries 0 to 12, with the 0.0.7 provenance rules |
| | `findRow()`, `nextButton()`: the reviewed 0.0.6 and 0.0.7 rules |
| | `readCards()`: validated card evidence for the cross-check |
| | `verdict(facts)`: Netflix's completeness rule, including the snapshot rule |

```ts
interface ServiceModule {
  id: 'netflix'
  matchesPage(location: Location): boolean
  profileIdentity(): ProfileKey | null                 // never leaves the extension
  readReference(): Reference | Refusal
  findRow(): Element | null
  nextButton(row: Element): HTMLButtonElement | null
  observerSpec: ObserverSpec                           // runs in the page's world
  readCards(row: Element): CardEvidence[]
  verdict(facts: CaptureFacts): Verdict                // provider-specific rule
}
interface Reference { rowId: string; label: string; total: number; version: string; entries: Entry[]; fingerprint: string; loadedAt: number }
interface Entry { position: number; sourceId: string; title: string; entityType: 'Movie' | 'Show' | string }
interface CardEvidence { sourceId: string; title: string; stable: boolean; owned: true; slotIndex: number }
```

## Session states

| State | Entered by | Observer | Data |
| --- | --- | --- | --- |
| `idle` | Load, or after `finalized` or `discarded` | Not installed | None |
| `collecting` | Start, once provenance passes and the observer installs | Installed. Binds new requests. | Buffer grows |
| `traversal_stopped` | The traversal reached coverage or a bound, or the member chose Stop. **This is the observation cutoff.** | Installed. Binds no new requests; requests initiated from now on are counted as `after_cutoff`. Pending bindings may still complete. | Kept |
| `finalizing` | Save | Draining pending work, then sealed | Frozen only after the drain |
| `finalized` | Finalize computed one result | Removed | One immutable result, held only in the collector |
| `discarded` | Cancel, termination, profile or navigation change, session timeout, finalize timeout | Removed | Cleared |

- **Pending:** A My List binding is pending from request initiation until its result has been accepted or rejected **and** transferred to the isolated collector. That covers the network wait, streaming, decoding, validation and the transfer.
- **Generations:** Every session has a generation number and a random session token. Entering `finalizing` and draining keep the generation unchanged, so requests pending when Save begins can still finish. Only **sealing** and **discarding** increment it.
- **Late callbacks:** Every callback checks its binding's generation before touching anything. A callback from an earlier generation is dropped and counted (`late_dropped`), and can never change a sealed, finalized or discarded session.
- **Stop keeps data:** Stop doesn't clear the buffer. Observation doesn't continue through Save: after the cutoff, only already pending bindings resolve.

## Finalize

1. **Enter `finalizing`.** If the session is still `collecting`, it first passes through `traversal_stopped`, which sets the cutoff. The cutoff is the moment of `traversal_stopped`, not Save. The generation stays the same.
2. **Bounded drain.** Wait up to 3 seconds for every pending binding to finish all of its stages, including transfer to the collector. A response bound before the cutoff that arrives during the drain is accepted and transferred normally. At the bound, the observer cancels its own readers and abandons its own decoding and validation for unfinished bindings. Each one sets the sticky code `pending_unresolved`.
3. **Seal.** The generation increments, so no later callback can change the session.
4. **Freeze** the evidence: buffer, counters and sticky codes.
5. **Clean up** (see "Cleanup") and collect `cleanupResult`. A failed cleanup adds `cleanup_failed` to the frozen evidence.
6. **Recheck guards.** Profile (avatar and state), page path, document age, inline-state fingerprint and row presence. For the empty case, also recheck that no row appeared.
7. **Compute one immutable result** from the frozen evidence, `cleanupResult` and the module's verdict rule, then clear the buffer and enter `finalized`.
8. **Return** the result. The popup writes exactly this result, or nothing if finalize failed.

Finalize as a whole is bounded at 5 seconds. Beyond that, the session is sealed and discarded with `finalize_timeout`, and no file is written. **Save again** reruns the guards of step 4 on the stored immutable result and refuses if they fail. The popup never keeps an envelope of its own.

## Pass-through contract (blocking before any live diagnostic)

The observer adds some latency of its own: synchronous classification, a cloned response stream, and a handler on the fetch promise. Revision 1's "never delays" and "as if no wrapper existed" are withdrawn. The contract is:

- **Same call.** The fetch wrapper calls the saved original with exactly the page's arguments (same references) and `this`. The XHR wrappers call the saved `open` and `send` with the page's arguments.
- **Same result.** The fetch wrapper returns the promise the original returned, without awaiting anything.
- **Native synchronous exceptions.** If the original fetch, `open` or `send` throws synchronously, the wrapper rethrows the same exception object unchanged and records no binding. A binding created just before is rolled back.
- **Rejected fetches.** The observer's handler on the original promise covers both outcomes, and every promise the observer derives ends in its own catch, so the observer never causes an unhandled rejection.
  - Known observable difference: attaching a handler marks Netflix's promise as handled. If Netflix leaves a rejected fetch unhandled, no `unhandledrejection` event fires for it while the observer is installed. A fixture test asserts this behavior.
- **No extra getter or accessor calls.** Classification never invokes a getter or accessor the native call wouldn't:
  - **Strings** are used as they are.
  - **A `Request` or `URL` input** is read only through the native `url` or `href` getter captured at install, and only when the object's prototype is exactly `Request.prototype` or `URL.prototype` and it has no own `url` or `href` property. Anything else is `unsupported_input`: never coerced and never read.
  - **`init.body`** is read only when `init` is a plain object and `body` is an own data property holding a string (checked with `Object.getOwnPropertyDescriptor`, never by reading `init.body`). `method` is handled the same way. An accessor property means `unsupported_body`.
  - **Proxies:** These descriptor and prototype checks are observable on a `Proxy` (trap calls), though they invoke no getters. Netflix's client passes plain objects. The limit is stated and tested.
- **Non-string bodies** are never read: `Request` with a body, `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams`, streams. They're classified `unsupported_body`. GET requests are classified from the URL's `operationName` and `variables` parameters only.
- **Request-string limits** apply before parsing: URL up to 16 KB, string body up to 64 KB, `variables` JSON up to 16 KB. Beyond that, the request isn't parsed and is classified `request_too_large`.
- **Responses from fetch.** The observer's handler is attached to the original promise before that promise is returned to the page.
  - The handler checks the native `bodyUsed` getter, then clones and reads the clone with its own stream reader, counting bytes.
  - **Ordering isn't guaranteed.** The design doesn't claim the clone happens before every page code path: a wrapper installed below the observer, or a service worker, can hand over an already consumed response. A consumed or unclonable response gives `response_unreadable`.
  - At the byte limit the observer cancels its own reader, which doesn't affect the page's branch, and records `response_too_large`.
- **Responses from XHR.** XHR state is bound per open generation:
  - The `open` wrapper increments a per-object counter, kept in a `WeakMap`.
  - `send` records the counter and adds the observer's own `loadend` listener (with `addEventListener`, never by assigning `onload`).
  - If the page reopens the object, for example inside its `onload`, before `loadend` reaches the observer, the counters differ and the observer reads nothing. That binding is `xhr_reused`, and if it was a My List binding, `pending_unresolved`.
  - `responseText` is read only when `responseType` is `''` or `'text'`. With `'json'`, the already parsed `response` is used. Any other type is `unsupported_response_type`.
- **Never** abort, retry, replace or reorder a request, and never throw into page code. Every observer exception is caught and becomes a sticky code on the session.
- **Pinned endpoints.** Only exact reviewed HTTPS origins and paths are classified. They're constants in the module, never read from the page: `https://www.netflix.com/graphql`, with others added only by review. Requests to other GraphQL addresses are counted as `endpoint_other` and never accepted.

### Bounds and accounting

| Bound | Value | On exceeding |
| --- | --- | --- |
| Request strings before parsing | URL 16 KB, body 64 KB, variables 16 KB | Not parsed, `request_too_large` (sticky if the endpoint is pinned) |
| Bytes read per response | 2 MB | Reader cancelled, `response_too_large` (sticky) |
| Concurrent observer readers | 4 | Not read, `observer_overloaded` (sticky) |
| Session memory budget | 8 MB, accounted as below | Further reads skipped, `observer_overloaded` (sticky) |
| Entries per session | 5,000 | `entries_limit` (sticky) |
| Title length | 1,000 characters, no control characters | Entry excluded, `entry_malformed` (sticky) |
| Traversal of an XHR `json` object | Depth 64, nodes 200,000 | `response_too_large` (sticky) |
| Session lifetime | 10 minutes from install | `discarded`, `session_timeout` |

**Accounting.** The session budget counts:

- Raw bytes held in the observer's reader chunks.
- Decoded strings at two bytes per character.
- Normalized entries, at a fixed 64 bytes plus two bytes per title character.

Chunk and string memory is released after parsing, and entries stay until finalize. For XHR responses with `responseType: 'json'`, the browser allocates the parsed object before the observer sees it. That allocation can't be bounded by the observer; only the observer's own traversal of it is bounded.

### Traversal bounds

These are restored from 0.0.7 and apply to the assisted traversal:

| Bound | Value | On reaching |
| --- | --- | --- |
| Click cap | `ceil(total / cards in view at Start) + 3` clicks, plus 3 clicks without a newly accepted position, fixed at Start | Stop at `traversal_stopped`, `advance_limit` |
| Wait after each click | Until a My List response is accepted, or 8 seconds | Counts toward the stall limit if nothing new was accepted |
| Stall limit | 3 consecutive clicks without a newly accepted position | `traversal_stopped`, `stalled` |
| Traversal deadline | 3 minutes from Start, enforced inside every wait: no timer fires past it | `traversal_stopped`, `assist_time_limit` |
| Coverage reached | All positions 0 to total − 1 accepted | `traversal_stopped`, `coverage_reached` |

The arrow rule is the reviewed 0.0.6 and 0.0.7 rule. If it isn't found safely, the traversal stops clicking and the member may click (`manual_fallback`). The member's clicks don't extend the deadline.

### Cleanup

Cleanup runs on finalize, discard and session timeout:

- **Per wrapped method** (`window.fetch`, `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`): if the method is still the observer's own wrapper, restore the saved original. If anything else replaced or wrapped it, never restore over it. Set the observer's wrapper **inert** instead, so it becomes a pure pass-through that classifies and records nothing, for the rest of the document's life.
- **Listeners:** Remove every `loadend` listener the observer added, using stored references.
- **Readers:** Cancel every observer-owned reader. This touches only the observer's clone branch, never Netflix's request, response or branch.
- **Result:** Recorded as `cleanupResult`: `restored`, `inert` or `failed`. Cleanup runs before the result is computed (finalize steps 5 and 7), so a failure is always part of the result as `cleanup_failed`.

## Binding and matching

**At request initiation**, the wrapper records a binding for every classified GraphQL request to a pinned endpoint:

`{ generation, documentId, operationName, rowIdMatches, afterPosition, pageSize, versionSent, profileKeyAtStart, initiatedAt }`

- `documentId` is set at install from `performance.timeOrigin` and a random value. The observer runs only in the top frame (`frameIds: [0]`).
- `afterPosition` is the decoded `carouselAfterCursor`, or −1 for none.
- `rowIdMatches` compares `variables.rowId` with the reference row ID, which comes from the inline state, never from a response.
- The profile is checked from the DOM when the binding is created. If it changed since Start, the session is discarded.

Only bindings with `operationName === 'CarouselPage'` and `rowIdMatches` are **My List bindings**. Others are counted and ignored.

**A My List response is accepted** only when every condition holds:

1. Its binding was initiated before the cutoff, its generation and `documentId` are current, and all of its stages finished within the drain.
2. Status 200, JSON within bounds, and no `errors` array.
3. `data.node.__typename` is `PinotCarouselSection`, `data.node._id` equals the row ID, and `data.node.displayString` equals the row heading.
4. `data.node.version` equals the binding's `versionSent`, and equals the reference version.
5. Exactly one `entities` or `entities(...)` connection. `totalCount` is an integer from 0 to 5,000 and equals the reference total.
6. Every cursor decodes to an integer from 0 to 4,999. The edges' positions are contiguous, start at `afterPosition + 1`, are strictly below the total, and number at most `pageSize`. `pageSize` and `afterPosition` come from the binding: `pageSize` from 1 to 200, and `afterPosition` from −1 to total − 2.
7. Every edge resolves to one entity with a `videoId` that is a positive safe integer and a valid title (see "Bounds and accounting").
8. `pageInfo.hasNextPage` agrees with the positions: true exactly when the last position is below `total − 1`.

Each failure has its own code (see "Failure codes"), recorded as sticky on the session. Its evidence is excluded: no entry from a rejected response enters membership. A rejected My List response blocks `complete`.

**Edge cases:**

- **Retries and duplicates:** A second accepted response for the same `afterPosition` with identical position-to-ID pairs is counted as `duplicate_identical` and is harmless. Any difference is `page_conflict` (sticky).
- **Out of order:** Responses are keyed by position, so arrival order doesn't matter. Overlaps with other pages or with the inline entries must agree, or the result is `position_conflict` or `id_conflict` (sticky).
- **In flight at install:** Requests initiated before install aren't bound and are never accepted. Their positions show up as unobserved.
- **Positions never observed:** Reported as `unobserved_positions` with a count, cause unknown (see "Live diagnostic").

## Entries

- **Membership** is the inline entries (positions 0 to 12) plus the accepted responses' entries.
- **IDs and positions** follow the ranges in condition 6 and 7 of the matching rule. A malformed edge makes its whole response rejected, and none of that response's entries are kept.
- **Media type** comes only from a verified entity type name: `Movie` gives `movie` and `Show` gives `show`. Any other type is `unknown` and **withholds `complete`** (`entity_type_unknown`, gate P4 strict). Types are never inferred from titles.
- **The file's items** are the membership entries, not the cards, so titles Netflix counts but never renders are included.
- **Zero entries:** Positional coverage is vacuous at zero, so it's never enough. A reported total of 0 also needs:
  - The 0.0.7 empty check: the row stays absent for 2 seconds, rechecked at finalize.
  - Provenance.
  - The observer seeing no My List binding at all.

  This avoids reviving the stale-empty bug.

## Verdict rule (Netflix module)

1. **Provenance:** As in 0.0.7, plus the profile guard present at Start and unchanged at every binding and at finalize.
2. **Coverage:** Every position 0 to total − 1 has exactly one ID, with no ID at two positions.
3. **Clean observation:** No sticky code, no pending binding at finalize, no unsupported request to a pinned endpoint during the session, and the observer intact on every pull.
4. **Consistency:** One version and one total throughout, matching the reference.
5. **Cross-check (downgrade only):** Every stable owned card's ID is in the membership with a matching title. Otherwise the result is `card_outside_entries` or `card_title_conflict`.
6. **Snapshot:** `snapshot_unproven` whenever snapshot proof is absent, which is always with the current evidence. What full coverage may be written as is owner question Q26.

The carousel's wrap and lap evidence aren't used.

## Data kept

- **Kept in memory** until finalize or discard: per accepted response, the decoded positions, IDs, entity type names and titles, plus the total, version and `hasNextPage`.
- **Bindings:** Only the fields listed under "Binding and matching". Request variables other than those fields are discarded at classification.
- **Never kept:** Cursors themselves, artwork, URLs, tracking data, other rows, request bodies, headers, cookies, storage.

## Report fields (capture and diagnostic, counts and fixed codes only)

| Group | Fields |
| --- | --- |
| Identity | `version`, `module`, `mode` (assisted or manual fallback) |
| Verdict | `verdict`, `reason`, `stickyCodes[]` |
| Reference | `reportedTotal`, `inlineEntries`, `versionPresent`, `versionsSeen` (count of distinct values), `totalChanges` |
| Endpoint and form | `endpointClass` (pinned or other), `transport` (fetch or XHR), `bodyForm` (GET params, string body or unsupported), `installedAtMsAfterLoad` |
| Requests | `myListBindings`, `ignoredBindings`, `afterCutoff`, `pendingAtFinalize`, `lateDropped`, `timeouts` |
| Responses | `accepted`, `rejected` (by code), `duplicateIdentical`, `sizeDrops` |
| Coverage | `positionsCovered`, `acceptedRanges` (as counts of contiguous runs), `unobservedPositions`, `overlapConflicts` |
| Entries | `typeCounts` (movie, show, unknown) |
| Cards | `cardsSeen`, `cardsOutsideEntries`, `entriesNeverRendered` |
| Session | `profileInvalidations`, `observerDisplaced`, `cleanupResult` (restored, inert or failed), `traversalOutcome` (coverage_reached, advance_limit, stalled, assist_time_limit, manual_fallback, member_stopped), `advances`, `clickCap`, `stalls`, `readWindowSeconds`, `elapsedSeconds` |
| Bounds | `requestTooLarge`, `responseUnreadable`, `xhrReused`, `budgetPeakBytes` |

## Failure codes

| Code | Meaning | Effect |
| --- | --- | --- |
| `reference_*` | 0.0.7 reference refusals | `unknown`, no observer |
| `observer_install_failed` | Page world unreachable | `unknown` |
| `observer_displaced` | A wrapper was replaced after install | Sticky, blocks `complete` |
| `unsupported_input`, `unsupported_body`, `unsupported_response_type`, `request_too_large` | A pinned-endpoint request the observer can't classify or read | Sticky |
| `response_unreadable`, `xhr_reused` | Response already consumed or unclonable; XHR reopened before the observer read it | Sticky |
| `response_too_large`, `observer_overloaded`, `entries_limit`, `observer_error` | Bounds or an internal error | Sticky |
| `cleanup_failed` | Cleanup failed (it runs before the result is computed) | Sticky |
| `response_rejected_*` (`status`, `json`, `errors`, `node`, `row_id`, `label`, `version`, `connection`, `total`, `positions`, `entity`, `has_next`) | A My List response failed matching | Sticky |
| `entry_malformed`, `entity_type_unknown` | Bad or unrecognized entry | Sticky |
| `page_conflict`, `position_conflict`, `id_conflict` | Disagreeing reads | Sticky |
| `pending_unresolved`, `finalize_timeout` | Lifecycle bounds | Sticky, or no file |
| `advance_limit`, `stalled`, `assist_time_limit` | Traversal bounds (outcomes, not sticky by themselves) | Usually `partial` through `unobserved_positions` |
| `unobserved_positions` | Coverage gap, cause unknown | `partial` |
| `snapshot_unproven` | No snapshot proof (always, with current evidence) | `partial`, pending owner question Q26 |
| `card_outside_entries`, `card_title_conflict` | Cross-check downgrade | `partial` |
| `ended_*`, `session_timeout` | 0.0.7 terminations and the session bound | `partial` or no file |

## Threat notes

- **What the results are:** Evidence from a trusted page environment, not authenticated server evidence.
- **The session token** separates sessions and generations. It isn't authentication. Page scripts can enumerate page-world state.
- **Wrappers below or above:** A script that wrapped `fetch` or XHR before install (below) or after it (above) can fabricate, alter or hide requests and responses. The integrity check detects replacement of the observer's own wrapper, not wrappers underneath it.
- **Cached references:** Code that cached the original `fetch` or `XMLHttpRequest` before install bypasses interception entirely. Before full coverage, that shows up as unobserved positions. After full coverage, it can **hide** contradictory updates, for example a later page with a changed version or total that the observer never sees. Bypass can therefore make a result look cleaner than the page saw it, not only leave gaps.
- **Third-party scripts** run on netflix.com; the saved page loads a consent manager. They can do any of the above.
- **Mitigations:** Each limits what forgery can achieve:
  - Request binding with the row ID from the inline state.
  - Version and total agreement with the reference.
  - Overlap agreement with the inline entries.
  - Position contiguity per page.
  - The card cross-check.

  A page script that deliberately forges a consistent My List can still produce a false `complete`, exactly as it could forge the DOM in 0.0.7. This is a stated limit.
- **Privacy:** Only pinned-endpoint My List responses are parsed, and only IDs, positions, types and titles are kept. Titles leave only in the member's saved file.
- **Breaking the page:** Handled by the pass-through contract and cleanup rules. The live diagnostic's tests cover it.

## Live diagnostic (reviewed before the owner runs it)

The diagnostic uses the same bounded observer as the capture, writes no file, and records only the report fields.

- **Claims:** A position with no accepted response is reported as **"unobserved, cause unknown"**. Candidate causes are a page fetched before install, a cache read, a bypassed or cached wrapper reference, an unsupported request form, another frame or worker, or a failed traversal. The diagnostic doesn't attribute gaps to prefetch.
- **Controlled comparison** (only if gaps appear): compare an ordinary Start against a fresh load with the observer installed at document start. The fresh-load setup needs an optional, Netflix-only host grant whose lifetime is separate from the observer's: requested for the comparison run, then removed, with no continuous observation. Gaps that disappear only with early install point to pre-install fetching; gaps that remain point elsewhere.
- **Tests before the owner run**, in a real browser with native `fetch` and `XMLHttpRequest` on a fixture page (not only mocks):
  - Request and response mutation detection: the page sees byte-identical bodies and the same promise.
  - Getters and accessors on `init.body`, `init.method`, `URL.href` and `Request.url`, and overridden properties: zero extra accessor calls. A `Proxy` init: the documented trap calls only.
  - Native synchronous exceptions from `fetch`, `open` and `send`: rethrown unchanged, no binding left behind.
  - Rejected fetches: no unhandled rejection from observer promises; the handled-marking difference asserted.
  - Already consumed responses: `response_unreadable`.
  - XHR reuse: an `onload` handler that reopens the object before `loadend`: `xhr_reused`, nothing read.
  - Request-string limits and the accounting budget.
  - Traversal bounds: the click cap, 8-second waits, the stall limit, and the 3-minute deadline enforced inside waits.
  - Pending stages: a response that finishes streaming, decoding, validation or transfer after the drain bound gives `pending_unresolved`, and nothing changes the sealed session.
  - Delayed and out-of-order responses.
  - Responses after Stop, after finalize and after discard.
  - Repeated Start and Stop.
  - Profile change mid-session.
  - Wrapper ordering: another wrapper installed before and after the observer, and a cached original reference.
  - `Request` objects with bodies, non-string bodies, and XHR with `json` and `blob` response types.
  - Byte, concurrency, memory, entry and title bounds.
  - Cleanup: restored when still owned, inert when displaced, listeners removed, observer readers cancelled while Netflix's response still completes, generation increment, and an immutable result after finalize.

## Independent reference: the privacy archive

The owner is requesting the archive (netflix.com/account/getmyinfo, up to 30 days), saved to `~/dev/projects/goodwatch/third-party-exports/`, outside Git. When it arrives:

1. Inspect `MyList.csv` structure only: columns, rows per profile, presence of IDs or dates.
2. Compare it with the 0.0.7 captures and any S4 diagnostic for the same profile, by Netflix ID if present, otherwise by normalized title with ambiguous titles counted separately.
3. Report counts only: shared, archive-only, capture-only, ambiguous, and the time gap between export and capture.

## Reviewer answers to the revision 1 questions

1. **Observer acceptable?** Conditionally: first a reviewed diagnostic, then a bounded prototype.
2. **Matching tight enough?** Tight against other rows after binding; not yet shown for other profiles; it can't stop page-world forgery.
3. **Netflix's type for `mediaType`?** Map verified `Movie` and `Show`, keep others `unknown` (which now withholds `complete`), never infer from titles.
4. **Early install?** Start with `activeTab`. If early install proves necessary, prefer an optional Netflix-only host grant whose lifetime is separate from the observer's, with no continuous observation.
5. **Module boundary?** Mostly right, but completeness rules stay per provider. They're now the module's `verdict()`.

## If a reload step ever returns

Revision 2 proposed reloading the tab to reconfirm the first entries and the total. It's out of the initial diagnostic. If it returns, these facts apply:

- **Not every reload is a fresh load.** A normal reload creates a new document. A back-forward cache restore brings back an old document with its old state. A restore (detected by `pageshow` with `persisted: true`) invalidates any session from that document.
- **A new document doesn't prove fresh server data.** The inline state can come from the HTTP cache or a service worker.
- **Access correction:** `activeTab` does survive a same-origin reload in Chrome, so revision 2's claim of a fourth member action was wrong.
- **The provisional capture can't stay in the page world,** which the reload discards. It would live in the extension (for example, session storage keyed by tab). The new document binds to it only if:
  - The profile key is the same.
  - The new reference passes provenance on its own.
  - The new document's identity differs from the old one.
  - The capture hasn't expired.

## Owner decision needed: what `complete` may claim for Netflix (Q26)

No membership snapshot identifier exists in the evidence, so a Netflix capture can't be proven to be one server snapshot.

**A reload can't validate the tail.** Take the reviewer's example, beyond the first 13 entries. A tail [A, B, C, D] is read as [A, B]. The list then changes to [X, B, C, Y], and the next page reads [C, Y]. After a reload, the total and the first 13 entries match, yet [A, B, C, Y] never existed.

| Option | What it gives | Risk left |
| --- | --- | --- |
| (a) Full positional coverage, prefix and total reconfirmed | Every position read once within one capture, one version and total throughout, then the first 13 entries and the total reconfirmed by a later read | Any list change in the tail between page reads can produce a set that never existed. Its frequency is unmeasured. This isn't snapshot proof. |
| (b) Never `complete` for Netflix | Full coverage is `partial` with `snapshot_unproven` and the coverage figures | No false complete; no reliable complete either, against Q20 |
| (c) Archive-confirmed | Full coverage that agrees with a recent privacy archive for the same profile | Needs the archive (up to 30 days); useful to validate, not for routine capture |

What (a) gives is now named "full positional coverage; prefix and total reconfirmed". It's no longer called window-bounded complete, and the earlier "rare event" wording is withdrawn, because the frequency of such changes hasn't been measured. The diagnostic proceeds with `snapshot_unproven` as the default whatever Q26's answer. The reload experiment isn't part of it.


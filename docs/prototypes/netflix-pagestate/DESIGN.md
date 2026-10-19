# Netflix My List capture from the page's own responses: design for review, revision 2

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Design only. Revision 2, written 2026-10-19 after the design review of `a84c685b`, which said "build after changes". Nothing gets built until a re-review passes.

Owner decisions so far:

- **Q20:** Keep working toward a reliable `complete`.
- **Q23:** S4 is the automatic route: one Start, assisted clicking, an observer of the page's own responses, a carousel that can only downgrade, and a save that revalidates. One extension with per-service modules.
- **Q24:** The owner is requesting the Netflix privacy archive as an independent reference.

The single-extension scope belongs to [#731](https://github.com/alp82/goodwatch-monorepo/issues/731).

## Changes from revision 1

| Review item | Where it's handled |
| --- | --- |
| 1. Snapshot consistency (blocking) | "Snapshot evidence", "What `complete` claims", "Verdict rule" |
| 2. Lifecycle (blocking) | "Session states", "Finalize" |
| 3. Pass-through contract (blocking before any diagnostic) | "Pass-through contract", "Bounds" |
| 4. Session binding | "Binding and matching" |
| 5. Threat notes | "Threat notes" |
| 6. Diagnostic claims | "Live diagnostic" |
| 7. Consistency details | "Verdict rule", "Entries", "Module boundary" |

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

`complete` is "as of snapshot S", never "as of Save". S is identified by:

- The document load time.
- The inline-state fingerprint.
- The reference total.
- The section version.
- The read window: the time from install to the last accepted page.

| Claim | Requires | Status |
| --- | --- | --- |
| Snapshot-consistent complete | A server snapshot identifier that every accepted page is bound to | **Not available.** No identifier exists in the evidence. |
| Positional coverage | Every position 0 to total − 1 read once, within one read window, with the same version and total throughout, and no change signal | Measurable. Reported always. |
| Window-bounded complete (owner decision) | Positional coverage, plus a short read window, plus the confirmation described in "Owner decision needed" | Only if the owner accepts this weaker claim, written out in the file's report and the popup |

Until the owner decides, the design's verdict for full positional coverage is `partial` with reason `snapshot_unproven`, and the report states the coverage. This follows the review: repeated agreeing reads raise confidence but aren't proof.

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
| `collecting` | Start, once provenance passes and the observer installs | Installed, binding new requests | Buffer grows |
| `traversal_stopped` | The traversal reached coverage or a bound, or the member chose Stop | Installed. It still resolves requests bound before this point, and binds no new ones. | Kept |
| `finalizing` | Save | Cutoff set; draining | Frozen after the drain |
| `finalized` | Finalize computed one result | Removed | One immutable result, held only in the collector |
| `discarded` | Cancel, termination, profile or navigation change, session timeout | Removed | Cleared |

- **Generations:** Every session has a generation number and a random session token. Leaving `collecting`, `traversal_stopped` or `finalizing` for `finalized` or `discarded` increments the generation.
- **Late callbacks:** Every callback checks its binding's generation first. Any callback from an earlier generation is dropped and counted, and can never repopulate a discarded or finalized session.
- **Stop keeps data:** Stop doesn't clear the buffer. Only finalize and discard do.

## Finalize

1. **Cutoff.** Enter `finalizing` and record a cutoff time. Requests initiated after the cutoff aren't bound; they're counted as `after_cutoff`.
2. **Drain.** Wait up to 3 seconds for bound My List requests still pending. Any still pending after that sets the sticky code `pending_unresolved`.
3. **Recheck guards.** Profile (avatar and state), page path, document age, inline-state fingerprint, and row presence. For the empty case, also recheck that no row appeared.
4. **Compute one result** from the frozen buffer, sticky codes and the module's verdict rule.
5. **Clean up.** Remove the observer, clear the buffer, increment the generation, enter `finalized`.
6. **Return** the result. The popup writes exactly this result, or nothing if finalize failed.

Finalize as a whole is bounded at 5 seconds; beyond that it ends as `finalize_timeout`, with no file. A **Save again** reruns the guards of step 3 on the stored result and refuses if they fail. The popup never keeps an envelope of its own.

## Pass-through contract (blocking before any live diagnostic)

The observer may add some latency (its own synchronous classification, and a cloned response stream), so revision 1's "never delays" and "as if no wrapper existed" are withdrawn. The contract is:

- **Same call, same result.** The fetch wrapper calls the saved original with exactly the page's arguments (same object references) and `this`. It returns the promise the original returned, unchanged and without awaiting anything. The XHR wrappers call the saved `open` and `send` with the page's arguments.
- **Request classification without side effects.**
  - The URL is taken once: a string as is, a `URL` by `href`, a `Request` by `url`. Any other input object is never coerced (no `String(x)`), and is classified `unsupported_input`.
  - A body is read only when it's a string passed in `init.body` or `xhr.send(string)`. A `Request` with a body, and `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams` or a stream are never read; they're classified `unsupported_body`.
  - GET requests are classified from the URL's `operationName` and `variables` parameters only.
- **Response reading.**
  - **fetch:** The wrapper attaches its own handler to the original promise before returning that promise. The handler clones the response before any page code can read it, and reads the clone with its own stream reader, counting bytes. At the byte limit it cancels its own reader, which doesn't affect the page's branch, and records `response_too_large`.
  - **XHR:** A `loadend` listener added with `addEventListener`, never by assigning `onload`. `responseText` is read only when `responseType` is `''` or `'text'`. With `'json'`, `response` is used, and size is bounded by entry and title limits, because bytes can't be counted. Any other `responseType` is classified `unsupported_response_type`.
- **Never** abort, retry, replace or reorder a request. Never throw into page code. Every observer exception is caught and becomes a sticky code on the session (see "Failure codes").
- **Pinned endpoints.** Only exact reviewed HTTPS origins and paths are classified, and they're constants in the module, never read from the page: `https://www.netflix.com/graphql`, with others added only by review. Requests to other GraphQL addresses are counted as `endpoint_other` and never accepted.

### Bounds

| Bound | Value | On exceeding |
| --- | --- | --- |
| Bytes read per response | 2 MB | Reader cancelled, `response_too_large` (sticky) |
| Concurrent observer readers | 4 | Not read, `observer_overloaded` (sticky) |
| Buffered bytes per session | 8 MB | Further reads skipped, `observer_overloaded` (sticky) |
| Entries per session | 5,000 | `entries_limit` (sticky) |
| Title length | 1,000 characters, no control characters | Entry malformed, `entry_malformed` (sticky) |
| Session lifetime | 10 minutes from install | `discarded`, `session_timeout` |

## Binding and matching

**At request initiation**, the wrapper records a binding for every classified GraphQL request to a pinned endpoint:

`{ generation, documentId, operationName, rowIdMatches, afterPosition, pageSize, versionSent, profileKeyAtStart, initiatedAt }`

- `documentId` is set at install from `performance.timeOrigin` and a random value. The observer runs only in the top frame (`frameIds: [0]`).
- `afterPosition` is the decoded `carouselAfterCursor`, or −1 for none.
- `rowIdMatches` compares `variables.rowId` with the reference row ID, which comes from the inline state, never from a response.
- The profile is checked from the DOM when the binding is created. If it changed since Start, the session is discarded.

Only bindings with `operationName === 'CarouselPage'` and `rowIdMatches` are **My List bindings**. Others are counted and ignored.

**A My List response is accepted** only when every condition holds:

1. Its binding's generation and `documentId` are current, and it arrived before the cutoff, or before the drain ended for a binding made before the cutoff.
2. Status 200, JSON within bounds, and no `errors` array.
3. `data.node.__typename` is `PinotCarouselSection`, `data.node._id` equals the row ID, and `data.node.displayString` equals the row heading.
4. `data.node.version` equals the binding's `versionSent`, and equals the reference version.
5. Exactly one `entities` or `entities(...)` connection. `totalCount` is a safe integer and equals the reference total.
6. The edges' positions are safe integers, contiguous, starting at `afterPosition + 1`, with at most `pageSize` edges.
7. Every edge resolves to one entity with a safe-integer `videoId` and a valid title.
8. `pageInfo.hasNextPage` agrees with the positions: true exactly when the last position is below `total − 1`.

Any failure is a sticky rejection code on the session. A rejected My List response blocks `complete`.

**Edge cases:**

- **Retries and duplicates:** A second accepted response for the same `afterPosition` with identical position-to-ID pairs is counted as `duplicate_identical` and is harmless. Any difference is `page_conflict` (sticky).
- **Out of order:** Responses are keyed by position, so arrival order doesn't matter. Overlaps with other pages or with the inline entries must agree, or the result is `position_conflict` or `id_conflict` (sticky).
- **In flight at install:** Requests initiated before install aren't bound and are never accepted. Their positions show up as unobserved.
- **Positions never observed:** Reported as `unobserved_positions` with a count, cause unknown (see "Live diagnostic").

## Entries

- **Membership** is the inline entries (positions 0 to 12) plus the accepted responses' entries.
- **IDs and positions** must be safe integers. A malformed edge makes its whole response rejected.
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
6. **Snapshot:** Withheld as `snapshot_unproven`, unless the owner accepts the window-bounded claim.

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
| Session | `profileInvalidations`, `observerDisplaced`, `cleanupResult` (restored, inert or failed), `advances`, `stalls`, `readWindowSeconds`, `elapsedSeconds` |

## Failure codes

| Code | Meaning | Effect |
| --- | --- | --- |
| `reference_*` | 0.0.7 reference refusals | `unknown`, no observer |
| `observer_install_failed` | Page world unreachable | `unknown` |
| `observer_displaced` | A wrapper was replaced after install | Sticky, blocks `complete` |
| `unsupported_input`, `unsupported_body`, `unsupported_response_type` | A pinned-endpoint request the observer can't classify or read | Sticky |
| `response_too_large`, `observer_overloaded`, `entries_limit`, `observer_error` | Bounds or an internal error | Sticky |
| `response_rejected_*` (`status`, `json`, `errors`, `node`, `row_id`, `label`, `version`, `connection`, `total`, `positions`, `entity`, `has_next`) | A My List response failed matching | Sticky |
| `entry_malformed`, `entity_type_unknown` | Bad or unrecognized entry | Sticky |
| `page_conflict`, `position_conflict`, `id_conflict` | Disagreeing reads | Sticky |
| `pending_unresolved`, `finalize_timeout` | Lifecycle bounds | Sticky, or no file |
| `unobserved_positions` | Coverage gap, cause unknown | `partial` |
| `snapshot_unproven` | Full coverage, no snapshot proof | `partial`, pending the owner decision |
| `card_outside_entries`, `card_title_conflict` | Cross-check downgrade | `partial` |
| `ended_*`, `session_timeout` | 0.0.7 terminations and the session bound | `partial` or no file |

## Threat notes

- **What the results are:** Evidence from a trusted page environment, not authenticated server evidence.
- **The session token** separates sessions and generations. It isn't authentication. Page scripts can enumerate page-world state.
- **Wrappers below or above:** A script that wrapped `fetch` or XHR before install (below) or after it (above) can fabricate, alter or hide requests and responses. The integrity check detects replacement of the observer's own wrapper, not wrappers underneath it.
- **Cached references:** Code that cached the original `fetch` or `XMLHttpRequest` before install bypasses interception entirely. The result is unobserved positions, never a false acceptance, because acceptance needs a bound request.
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
- **Tests before the owner run**, against a fixture page with its own fetch and XHR:
  - Request and response mutation detection: the page sees byte-identical bodies and the same promise.
  - Delayed and out-of-order responses.
  - Responses after Stop, after finalize and after discard.
  - Repeated Start and Stop.
  - Profile change mid-session.
  - Wrapper ordering: another wrapper installed before and after the observer, and a cached original reference.
  - `Request` objects with bodies, non-string bodies, and XHR with `json` and `blob` response types.
  - Byte, concurrency, memory, entry and title bounds.
  - Cleanup: restored, inert when displaced, generation increment.

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

## Owner decision needed: what `complete` may claim for Netflix

No membership snapshot identifier exists in the evidence, so a Netflix capture can't be proven to be one server snapshot.

| Option | What `complete` means | Risk left |
| --- | --- | --- |
| (a) Window-bounded complete | Every position read once within a short read window (for example 60 seconds), with one version and total throughout. Plus a confirmation: after the traversal, the extension reloads the tab once and the fresh inline state must show the same total and the same entries at positions 0 to 12. The popup and file report say "complete as of the capture window", not "server snapshot". | A list edit on another device during the window that exactly preserves the total and the first 13 positions (for example one removal plus one addition after position 12). Measurable as a rare event; not provable. |
| (b) Never `complete` for Netflix | Full coverage is `partial` with `snapshot_unproven` and the coverage figures. | No false complete, but no reliable complete, against Q20. |
| (c) Archive-confirmed complete | (a) plus agreement with a recent privacy archive for the same profile. | Requires the archive (up to 30 days); only useful for one-off checks, not routine capture. |

**Recommendation:** (a), with the claim worded as window-bounded in the popup, the report and the import receipt, and the reload confirmation counted as part of the read window. It's the only option that meets Q20 without inventing proof the evidence doesn't support. (c) is the way to validate (a) once the archive arrives. The reload is a navigation of the member's own tab, not a request the extension builds, so it stays within the no-own-requests bar. `activeTab` access ends at that navigation, so reading the fresh state needs either one more click on the extension button (a fourth member action) or the optional Netflix-only host grant. That choice is part of the decision.

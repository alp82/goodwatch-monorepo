# Wishlist suggestions

Unknown-type Netflix wishlist entries can receive local catalog suggestions. A suggestion does not change the preview or the original source evidence. The member accepts a suggestion through the existing resolution endpoint, which creates a new immutable preview. Confirm, receipt and Undo use the existing import pipeline.

## Server contract

`GET /api/imports/:id/suggestions?offset=0` requires an authenticated member and an owned wishlist preview. Responses are private/no-store. The only query parameter is one nonnegative integer offset at most 50,000. The server derives all query text and native IDs from the stored original observations.

The response contains `groups`, `total`, `offset`, `hasMore` and `nextOffset`. A page holds at most ten groups in the same order as the manual matching endpoint. Each group has its representative row index and one of these states:

- `suggested`: one valid candidate corroborated by the exact Netflix ID; includes canonical movie/show identity, title, year and poster path.
- `manual`: unsupported source/ID, conflicting source evidence, no corroborated target, ambiguous native ID, or conflicting supplied year.
- `unavailable`: a retrieval error, timeout, cancellation or a result cap prevented a complete bounded check. This is not evidence that a title is absent.
- `already_resolved`: an explicit member choice already exists and is preserved.

Suggestions are computed on demand and are not written to the import journal. Accepted suggestions use the existing `basis: member` resolution because the member made the choice; the original type stays unknown. No new database schema, provider authentication or external metadata API is required.

## Retrieval

Each eligible source group searches both typed catalog tables using indexed title/original-title retrieval, at most ten candidates per type. Indexed whole-name translation and alternative-title retrieval add localized candidates, with a 101-row overflow sentinel and maximum 100 accepted rows per alias lane. Candidate catalog rows are hydrated in typed batches of at most 40 IDs; missing and adult targets are excluded.

Retired movie IDs retain their original IDs for offer lookup alongside their canonical IDs. Native evidence is then deduplicated by canonical typed identity. This avoids losing a valid streaming link that still sits on a retired row while ensuring the proposal uses current display metadata.

Offers are restricted to Netflix service 8 and the candidate typed IDs, with a 5,001-row overflow sentinel and maximum 5,000 rows per batch. URLs are parsed locally and never requested. The parser accepts validated HTTPS Netflix detail paths directly or through one allowlisted JustWatch wrapper. It rejects credentials, hostile normalization, nested wrappers, duplicate parameters and contradictory recognized provider context. Two-letter wrapper country codes accept either case, matching observed catalog links. See the public service tests for hostile fixtures and scope rules.

The candidate set is bounded and does not prove catalog-wide native-ID uniqueness or provider-link correctness. A single corroborated candidate is therefore a suggestion, not an unattended resolution. A supplied source year that contradicts the catalog target prevents a suggestion. Multiple source-evidence variants that conflict also stay manual.

## Resource bounds

At most three source groups run concurrently within a request. Each group has a 2.5-second deadline and the page has a 12-second deadline. Request cancellation propagates to catalog reads. Each group also owns an abort controller that cancels sibling reads when a parallel lane fails; releasing a worker slot cannot leave that group's sibling reads running. At most two name lanes per group run concurrently, giving six concurrent reads per request.

All reads use the existing catalog transport that avoids logging private query strings. Errors are represented by bounded state/reason codes. No imported source URL is followed and no production member-table mutation is performed by this endpoint.

## Validation

The focused import suite passes 95 tests, including eleven new suggestion service tests and two HTTP tests; the complete import-server suite passes all 245 tests. Coverage includes localized aliases, hostile URLs, lowercase country wrappers, canonical/retired IDs, conflicting metadata, typed-ID collisions, missing/adult targets, result caps, failures, cancellation, pagination, concurrency, preservation of accepted choices, and the public acceptance → child preview → Confirm → receipt → Undo flow.

An independent integration harness used the real reader against the authorized 77-entry file with an in-memory owned import journal and read-only, allowlisted public catalog SQL. It returned **75 suggestions, two manual entries and zero unavailable entries**. All 610 bounded SELECTs succeeded; no result cap was reached, maximum simultaneous reads were six, and eight pages took roughly 1.15–2.23 seconds each (14 seconds total in one sequential run). The fake journal stayed unchanged; no production import/member queries or writes were forwarded. Private titles, IDs and the export remain outside the repository.

The first real-reader run found a lowercase-country URL compatibility error; a synthetic regression was added before correcting it and rerunning the same read-only check. These measurements establish compatibility for one supplied list, not population-wide accuracy or a performance guarantee.

For the user-facing workflow and browser validation, see [the Opus implementation notes](wishlist-automatic-matching-ux.md). Research and alternatives are recorded in [the measured investigation](../research/wishlist-exploration/netflix-automatic-matching-validation.md).

## Release checks

The production build succeeds. The full application suite has 3,528 passing tests, two failures, one skipped test and one TODO. The same two failures reproduce on clean baseline `556fcc9e`: the TV rating focus order and score-control count assertions. All 98 import UI tests and all 245 import-server tests pass. TypeScript reports the same 185 diagnostics as that baseline, with no added or removed diagnostics after normalizing line numbers. Biome passes on all 13 changed TypeScript files.

The UI regression checks include lazy loading, sequential requests, explicit retry of nonadjacent unavailable pages, preservation of cached successes, no automatic retry of cached errors on remount, and no incidental refetch on focus/reconnect. Suggestions remain in source order; a short list links directly to the few titles without suggestions. Bulk acceptance and Undo preserve later manual choices and keyboard focus.

Final Chromium checks at 390 px and 1,280 px pass against the actual import components with synthetic API boundaries. They cover exception shortcuts, keyboard bulk acceptance/Undo, manual corrections, pending Update/Confirm locks, failure/retry, child-preview reset and Confirm → receipt → Undo. Healthy and error caches make no additional suggestion requests on focus, reconnect or remount. No console errors or horizontal overflow were observed, and source hashes were checked before and after the run. This browser run did not import into a production member library; screen-reader validation remains open.

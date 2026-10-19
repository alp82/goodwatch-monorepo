# Prime Video Watchlist capture: gates and results

Ticket: [#707](https://github.com/alp82/goodwatch-monorepo/issues/707), on [map #702](https://github.com/alp82/goodwatch-monorepo/issues/702). Route: [#705 resolution](https://github.com/alp82/goodwatch-monorepo/issues/705) and [route research](https://github.com/alp82/goodwatch-monorepo/blob/7ca65bb1/docs/research/wishlist-exploration/prime-route.md). Collector version 0.1.0.

This file separates three kinds of evidence:

- **Fixture:** invented pages, in happy-dom and in real Chromium.
- **Parser:** the shipped GoodWatch wishlist parser reading the produced file.
- **Live:** the owner's signed-in Watchlist. Not yet run.

Capture and matching are measured separately. This ticket measures capture. A complete capture doesn't show that any GoodWatch match is right.

## Candidate gates for the live run

These gates were written on 2026-10-19, before any live measurement. The owner accepts or changes them at the verdict. They apply to one account, one profile, one regional origin, one locale and one layout. They aren't a population estimate.

The reference is the owner's private count and sample, made in Prime Video's own interface, independently of the extension. See [Reference procedure](#reference-procedure).

| Gate | Passes when | Measured from |
| --- | --- | --- |
| G0 Precondition | The Watchlist has more than one page of titles and at least one movie and one show. A smaller list can't test pagination; record it as untested. | Report: `pagination.pages` at least 2 |
| G1 Membership | Captured movie and show counts equal the reference counts. Every sample title is found. | `compare.mjs`: `typeDifference`, `sample` |
| G2 Contamination | None of the non-Watchlist probe titles is in the file. No library, recommendation, history or live collection was merged. | `compare.mjs`: `contaminationProbes`; report: `otherCollections`, `liveExcluded` |
| G3 Native identity | Every item has a `sourceId`. Every page-data item kept its GTI. No duplicate `sourceId`, no quarantined identity. Title and type disagreements between the channels are 0, or each is explained. | Report: `counts.withGti`, `quarantined`, `titleDisagreements`; `compare.mjs`: `duplicateSourceIds` |
| G4 Pagination | Every page of the chain was observed. The last one says it is the end. No cursor repeats. A reported total equals the page-data count. | Report: `pagination` |
| G5 Channel agreement | `visibleOnly` and `structuredOnly` are 0, or each remaining case is an unavailable title the owner confirms. | Report: `counts` |
| G6 Scope | The run started on the unfiltered Watchlist on the member's own regional origin. The profile guard is `state` or `dom`. | Report: `filter`, `host`, `lang`, `profileGuard` |
| G7 Honest reporting | Run A says `complete` only if G1 to G6 pass. Run B, which is deliberately stopped halfway, says `partial` and never `complete`. | Both reports |
| G8 Intake | The shipped parser accepts the file. Observations equal items, with no rejected rows. | `parser-check.mjs` |
| G9 Privacy | The report holds no title, ID, cursor or profile value from the private file. The extension has only `activeTab` and `scripting`. | Agent check against the private file; `chrome://extensions` |

Recorded alongside the gates: reference size, captured unique items, overlap, misses, extras, pages, observed first-party responses, added requests (expected: 0), elapsed time, owner steps and stop reason.

A live result that fails a gate isn't hidden by a fix. The failure gets a synthetic regression first, then a new collector version, then a new live run.

## Reference procedure

The owner makes the reference in Prime Video's own interface, without the extension. It stays in `~/goodwatch-private/707/reference.json` and never goes into Git or an issue.

1. Count the titles. On the Watchlist, choose the **Movies** filter, scroll to the end, and count: rows times titles per row, plus the last row. Then do the same for **TV**. If there are no filters, count **All** instead and enter it as `"all"`.
2. Write a sample of about 10 titles that are on the Watchlist: the first 3, the last 3, and 4 others. Include a season entry, a title marked unavailable, and two titles with the same name, if the list has them.
3. Write 3 titles that appear on the same page or nearby but are **not** on the Watchlist, for example from a recommendation row or your purchases.

```json
{
  "counts": { "movies": 0, "shows": 0 },
  "sample": ["...", "..."],
  "notOnWatchlist": ["...", "...", "..."]
}
```

`compare.mjs` prints counts only. Equal counts alone don't prove recall: a miss and an extra can cancel out. That's why the sample and the probes exist, and why G5 also requires both channels to agree.

## Fixture test matrix

Every case is an invented page with invented titles, IDs and cursors. Field names follow shapes in the [inspected Kodi source](https://github.com/Sandmann79/xbmc/blob/bfb3940ec796166f50b0c2beca9a8ee779689e5e/plugin.video.amazon-test/resources/lib/web_api.py#L1400), which is evidence of past layouts, not of today's page.

| Case | Expected | Result |
| --- | --- | --- |
| Mixed movie, show and season list; two pages plus a terminal page; virtualized grid drops old cards | `complete`, 5 items with GTIs, types, years and clean detail URLs | Pass |
| Library, recommendations, navigation link and a larger recommendation row on the same page | Not in the file; recorded as excluded collections or other card groups | Pass |
| Two titles with the same name and distinct IDs | Both kept; counted | Pass |
| Stop before the terminal page | `partial`, `continuation_pending` | Pass |
| Page data without pagination fields | `unknown`, `no_terminal_evidence` | Pass |
| Cursor repeats on a different page | `partial`, `cursor_repeated` | Pass |
| The same page embedded in two hydration scripts | Not a repeat; `complete` | Pass |
| Cards whose list response wasn't observed (requested before Start) | `partial`, `visible_not_in_structured`; cards still offered | Pass |
| Page-data title never shown as a card | `partial`, `structured_not_seen_visible` | Pass |
| Reported total not reached | `partial`, `total_mismatch` | Pass |
| Duplicate listing in one page | One item; total can't be reached, so `partial` | Pass |
| Unavailable title without a detail link | GTI kept, no URL, `partial` | Pass |
| Season with an explicit show parent | Counted in `seasonsWithParent` | Pass |
| Live entry in the Watchlist collection | Left out; counted | Pass |
| Conflicting card titles for one ID | Quarantined; `partial` | Pass |
| Unreadable list response | `unknown`, `unknown_response_schema`; shape kept in the report | Pass |
| Collection layout without a Watchlist key (`content.baseOutput.containers`) | Cards only, `unknown`, `no_structured_watchlist`; the recommendation row isn't taken | Pass, after a fix (see below) |
| `amazon.de` with `/gp/video` paths and `de-de` | Own origin and path kept in URLs and report | Pass |
| Profile marker changes (header fallback) | Capture and file discarded | Pass |
| No profile evidence | `unknown`, `profile_unconfirmed` | Pass |
| Filter changes, or the capture starts on a filter | `partial` or `unknown` | Pass |
| Tab leaves the Watchlist | `partial`; what was read is kept | Pass |
| Reload | Capture lost; the popup shows idle, never a stale file | Pass |
| Wrong page, forged message with another code, cancel | Refused, ignored, discarded | Pass |
| Detail-link parsing | No credentials, no query, provider hosts only, HTTPS only | Pass |
| The report holds no title, ID, cursor or profile value | Checked against every invented secret | Pass |

| A terminal flag on a second Watchlist collection (review) | The main chain still needs its own end: not `complete` | Pass, after a fix |
| `pagination: null` | No evidence of the end | Pass, after a fix |
| Report keys that are slugs, titles or short IDs; dotted `amzn1.` path IDs (review) | Redacted as `<key>` or `<id>` | Pass, after a fix |
| A card with a play link and a title link (review) | Read once with its card-level title, not quarantined | Pass, after a fix |
| A card linking to two different titles | Skipped and counted | Pass |
| A Watchlist nested under a profile key (review) | Still the Watchlist | Pass, after a fix |
| A retried response for the same page (review) | Not a repeated cursor | Pass, after a fix |
| A live entry counted in the reported total (review) | No total mismatch | Pass, after a fix |
| State profile marker plus a changed header label (review) | Capture discarded | Pass, after a fix |
| An avatar URL change alone | No evidence; capture continues | Pass, after a fix |
| The grid renders after a recommendation row was chosen (review) | Flagged; not `complete` | Pass, after a fix |

Failure found while building: with no Watchlist-named collection, the first collector draft took the largest card group, which was the recommendation row. It now prefers the group that overlaps the page data. With no overlap, it takes the first group in page order and reports `visible_group_guessed`, which keeps the file `unknown`.

### Independent review

A separate reviewer read version 0.1.0 before any live run and probed it with scratch pages. It confirmed one false `complete`: page data with a Watchlist collection that said "more" plus a sibling Watchlist-named collection with `pagination: null` was reported `complete` after an immediate stop. Pages are now grouped into chains named from the Watchlist key on. Every chain must end on an explicit last page, and several chains make the file `unknown`. `pagination: null` no longer counts as an end.

The same review found report keys and path segments that could carry titles or IDs, cards with several links being quarantined, an avatar-URL profile guard that could discard a whole run, a profile-key exclusion that could hide a nested Watchlist, retries counted as loops, live entries breaking totals, and a two-download prompt that could drop the report. Each now has a regression above, and the popup has separate **Save wishlist file** and **Save report** buttons.

Accepted risks, not fixed: a page that bound `fetch` before Start, `responseType: "json"` requests, and pages loaded before Start all leave the page-data channel blind. The file then says `partial` or `unknown`, as designed. The page can forge messages to the collector. The report's per-card rejection counts are per scan pass, not per card.

## Results so far

Validated 2026-10-19.

- **Fixture, happy-dom:** 35 of 35 tests pass (`npm test`).
- **Fixture, real Chromium:** the unpacked MV3 extension loads with no host permissions. The real popup injects the collector into the isolated world and the response reader into the page world. A `fetch` response and an `XMLHttpRequest` response from the invented page are both observed. The grid accumulates while cards are removed. **Stop** downloads both files: a complete five-item wishlist file and a report without titles or IDs. Leaving the Watchlist ends the capture as partial. The harness served 4 requests locally and blocked 0 others. No Amazon request was made.
- **Parser:** the shipped `parseWishlistFile` accepts the five-item synthetic file: 5 observations (3 movies, 2 shows), 5 GTI source IDs, completeness `complete`, 0 warnings.
- **Live:** not run. No signed-in Watchlist, current Prime Video page, real response shape or regional layout has been tested. Every selector and JSON path is a hypothesis until the owner's run.

## What the live run can and can't settle

It can settle, for one account and layout: whether today's Watchlist page carries a Watchlist-named collection, which pagination form it uses, whether list responses are visible to the page-world reader, whether GTIs are present, and whether both channels agree with the reference.

It can't settle: other regions, locales, profiles, browsers or layouts, the Prime Video apps, how stable this is over time, or match precision.

# Prime Video Watchlist capture: gates and results

Ticket: [#707](https://github.com/alp82/goodwatch-monorepo/issues/707), on [map #702](https://github.com/alp82/goodwatch-monorepo/issues/702). Route: [#705 resolution](https://github.com/alp82/goodwatch-monorepo/issues/705) and [route research](https://github.com/alp82/goodwatch-monorepo/blob/7ca65bb1/docs/research/wishlist-exploration/prime-route.md). Collector version 0.2.0.

This file separates three kinds of evidence:

- **Fixture:** invented pages, in happy-dom and in real Chromium.
- **Parser:** the shipped GoodWatch wishlist parser reading the produced file.
- **Live:** the owner's signed-in Watchlist. Not yet run.

Capture and matching are measured separately. This ticket measures capture. A complete capture doesn't show that any GoodWatch match is right.

## Candidate gates for the live run

These gates were first written on 2026-10-19, before any live measurement, and revised the same day after the second independent review. Still no live measurement exists. The owner accepts or changes them at the verdict. They apply to one account, one profile, one regional origin, one locale and one layout. They aren't a population estimate.

The reference is the owner's private record, made in Prime Video's own interface, without the extension. It comes in two modes; see [Reference procedure](#reference-procedure). Only the full mode can establish exact membership.

| Gate | Passes when | Measured from |
| --- | --- | --- |
| G0 Precondition | The Watchlist has more than one page and at least one movie and one show. A smaller list is a smoke test only: pagination gates are recorded as untested. Never add or remove Watchlist entries to make it larger. | Report: `pagination.pages` at least 2 |
| G1 Membership, full mode | Every reference entry matches exactly one captured entry by detail link, or by title and year. Missed, extra, ambiguous and duplicate counts are 0. | `compare.mjs`: `evidence: "full"`, `exactMembership: true` |
| G1 Membership, sampled mode | Reported as **sampled evidence only**, never as exact membership. Counts per type agree, every sample entry is found, no probe is found. | `compare.mjs`: `evidence: "sampled"` |
| G2 Contamination | No library, recommendation, history or live collection was merged, and no unresolved card is in the file. In full mode, `extra` is 0. | Report: `otherCollections`, `liveExcluded`, `visibleUnresolved`; `compare.mjs` |
| G3 Native identity | Every item has a `sourceId`. Every page-data item kept its GTI. No duplicate `sourceId`, no quarantined identity, no title or type disagreement between the channels. | Report: `counts`; `compare.mjs`: `duplicateSourceIds` |
| G4 Pagination | Every chain starts in the page data, each later page links to its predecessor by continuation or start index, positions match, and the last page ends without contradiction. No cursor repeats; a reported total equals the count. | Report: `pagination.pages[].link`, `terminal` |
| G5 Channel agreement | `visibleOnly` and `structuredOnly` are 0, or each remaining case is an unavailable title the owner confirms. | Report: `counts` |
| G6 Scope | The All view was positively shown (`filterEvidence.all` or `domAll`, with no filtered evidence). The profile guard is `state`, `dom` or `state+dom`, and nothing named another profile. The capture ran on the member's own regional origin. | Report: `filterEvidence`, `profileGuard`, `host`, `lang` |
| G7 Honest reporting | Run A says `complete` only if G1 to G6 pass. Run B, deliberately stopped halfway, says `partial` and never `complete`. | Both reports |
| G8 Intake | The shipped parser accepts the file. Observations equal items, with no rejected rows. | `parser-check.mjs` |
| G9 Privacy and scope | The report holds no title, ID, cursor, class, name or profile value from the private files. Only Watchlist responses were read, and observation ended after Stop. The extension has only `activeTab` and `scripting`. | Agent check against the private files; report `responses`; `chrome://extensions` |

Recorded alongside the gates: reference mode and size, captured unique items, matches, misses, extras, ambiguities, pages, observed first-party responses, added requests (expected: 0), elapsed time, owner steps and stop reason.

A live result that fails a gate isn't hidden by a fix. The failure gets a synthetic regression first, then a new collector version, then a new live run.

## Reference procedure

The owner makes the reference in Prime Video's own interface, without the extension. It stays in `~/goodwatch-private/707/` and never goes into Git or an issue. There are two modes. Times are estimates for a desktop browser.

### Full membership (exact; recommended up to about 100 titles)

List every Watchlist entry in `members.txt`, one per line. The fastest and most exact way is to copy each card's link (right-click the poster, choose **Copy link address**, paste into the file). A line can also be `Title (Year)`.

- Copying links takes about 8 to 10 seconds per title: about 5 minutes for 30 titles, about 15 minutes for 100.
- Typing `Title (Year)` takes about 15 to 25 seconds per title: about 10 minutes for 30 titles, about 35 minutes for 100.

With a full reference, `compare.mjs` reports exact matches, misses, extras and ambiguities. Same-name entries are told apart by link or year.

### Sampled evidence (quick; can't prove exact membership)

Fill in `reference-sampled.json`: counts per type, about 10 entries that are on the Watchlist (the first 3, the last 3, and 4 others, including a season, an unavailable title or two same-name titles if present), and 3 titles nearby that are **not** on the Watchlist. About 8 to 12 minutes for a list of 100.

To count a long list that loads while you scroll: note the last title on screen, scroll until it's the first title on screen, then count only the titles after it. Repeat to the end. With a Movies and a TV filter, count each separately.

The result is labeled sampled evidence only. Equal counts can hide a miss and an extra, and a title alone can't separate same-name entries.

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

| Unrelated or cross-origin responses during capture (second review) | Never copied or read | Pass, after a fix |
| An oversized list response | Read up to the cap, reported too large, not parsed | Pass, after a fix |
| Stop, Cancel or leaving the Watchlist | Observation ends; the page's own `fetch` is restored | Pass, after a fix |
| Names, script IDs, classes and test IDs in the page | Not in the report | Pass, after a fix |
| Forged messages with private strings, bad URLs and 20,000 items | Strings kept out of the report; invalid URLs dropped; bounded | Pass, after a fix |
| An enclosing object's `hasMoreItems: false` | Not end evidence for the page | Pass, after a fix |
| `hasMoreItems: false` next to a continuation token | `pagination_contradiction` | Pass, after a fix |
| A last page that doesn't link to its predecessor | `chain_gap` | Pass, after a fix |
| A correctly linked chain | `complete`, links `start`, `cursor`, `cursor` | Pass |
| A Movies filter held in page state, URL unchanged | `filtered_view` | Pass, after a fix |
| No positive All-view evidence | `unknown`, `all_view_unconfirmed` | Pass, after a fix |
| A profile change seen only in new page state, or only in a list response | Capture discarded | Pass, after a fix |
| Two card lists with identical attributes | Not merged; recommendations stay out | Pass, after a fix |
| No page-data Watchlist | Guessed cards stay out of the file | Pass, after a fix |
| Different titles, or a movie/show conflict, between page data and card | Not `complete` | Pass, after a fix |
| A missing page-data type | Filled from the card | Pass, after a fix |
| Full reference (JSON or pasted links) and sampled reference | Exact counts, or labeled sampled | Pass, after a fix |

Failure found while building: with no Watchlist-named collection, the first collector draft took the largest card group, which was the recommendation row. It now prefers the group that overlaps the page data. With no overlap, it takes the first group in page order and reports `visible_group_guessed`, which keeps the file `unknown`.

### Independent review

A separate reviewer read version 0.1.0 before any live run and probed it with scratch pages. It confirmed one false `complete`: page data with a Watchlist collection that said "more" plus a sibling Watchlist-named collection with `pagination: null` was reported `complete` after an immediate stop. Pages are now grouped into chains named from the Watchlist key on. Every chain must end on an explicit last page, and several chains make the file `unknown`. `pagination: null` no longer counts as an end.

The same review found report keys and path segments that could carry titles or IDs, cards with several links being quarantined, an avatar-URL profile guard that could discard a whole run, a profile-key exclusion that could hide a nested Watchlist, retries counted as loops, live entries breaking totals, and a two-download prompt that could drop the report. Each now has a regression above, and the popup has separate **Save wishlist file** and **Save report** buttons.

### Second independent review

A second reviewer found four blocking and four further issues in 0.1.0 plus the first fixes. Interception read every JSON or text response before checking origin and path, had no bounded read, and stayed active after Stop. The report could carry identifier-shaped names, script IDs, classes and forged values. Terminal evidence was borrowed from enclosing objects, contradictions were ignored, and the chain wasn't checked for gaps. The All view and the profile weren't positively confirmed. Cards were grouped by attributes, and guessed cards could enter the file. Channel disagreements didn't block `complete`, and a count plus a sample was presented as if it could prove membership.

Version 0.2.0 addresses each one, test-first. The reproductions are in `hardening.test.mjs`. The reference now has a full mode that can establish exact membership, and a sampled mode that is labeled as such.

Accepted risks, not fixed: a page that bound `fetch` before Start, `responseType: "json"` requests, and pages loaded before Start all leave the page-data channel blind. The file then says `partial` or `unknown`, as designed. The page can forge messages to the collector: they are validated, bounded and kept out of the report, but a hostile page could still add made-up titles to the file. A first page that the page loads by request before Start makes the chain start unobserved (`unknown`). A continuation sent in a request body rather than the URL can't be linked, so the chain shows a gap (`partial`). Filter evidence relies on option flags in page data or on selected controls with a known filter word; a localized label outside that word list gives `all_view_unconfirmed`. The report's per-card rejection counts are per scan pass, not per card.

## Results so far

Validated 2026-10-19.

- **Fixture, happy-dom:** 55 of 55 tests pass (`npm test`, both suites). The 20 tests in `hardening.test.mjs` were committed failing on e4939330 (fa36202e) before the fixes.
- **Fixture, real Chromium:** the unpacked MV3 extension loads with no host permissions. The real popup injects the collector into the isolated world and the response reader into the page world. A linked `fetch` page and a linked `XMLHttpRequest` page are observed; an unrelated same-origin JSON response isn't read. The grid accumulates while cards are removed. **Stop** downloads both files: a complete five-item wishlist file and a report without titles or IDs. After **Stop**, the page has its native `fetch` and `XMLHttpRequest` back. Leaving the Watchlist ends the capture as partial. The harness served 5 requests locally and blocked 0 others. No Amazon request was made.
- **Found by the harness:** served without a charset, the invented page decoded an en dash differently from the UTF-8 responses. The new title-disagreement gate reported it instead of saying `complete`. The fixture now declares UTF-8; a real page with that mismatch would be reported the same way.
- **Parser:** the shipped `parseWishlistFile` accepts the five-item synthetic file: 5 observations (3 movies, 2 shows), 5 GTI source IDs, completeness `complete`, 0 warnings.
- **Live:** not run. No signed-in Watchlist, current Prime Video page, real response shape or regional layout has been tested. Every selector and JSON path is a hypothesis until the owner's run.

## What the live run can and can't settle

It can settle, for one account and layout: whether today's Watchlist page carries a Watchlist-named collection, which pagination form it uses, whether list responses are visible to the page-world reader, whether GTIs are present, and whether both channels agree with the reference.

It can't settle: other regions, locales, profiles, browsers or layouts, the Prime Video apps, how stable this is over time, or match precision.

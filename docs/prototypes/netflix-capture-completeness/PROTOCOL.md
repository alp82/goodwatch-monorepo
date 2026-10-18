# Netflix My List capture: reference-set protocol and candidate gates

Ticket: [#706](https://github.com/alp82/goodwatch-monorepo/issues/706) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). Written 2026-10-19, before any measurement on this branch. The owner accepts or changes the gates at the final comparison; nothing here is a release decision.

## Question

Can the local extension capture one profile's whole Netflix My List repeatably, and can it truthfully say when it has not?

## Starting evidence

- Extension version 0.0.4 (outside Git) accumulates My List cards from the DOM while the member clicks the row's next arrow. It always writes `completeness: "unknown"`.
- The owner's two live 0.0.4 files from 2026-10-18 hold 13 and 77 distinct Netflix IDs. Both are private and stay outside Git.
- The owner's saved My List page (private, de-DE, carousel layout) embeds Netflix's own page state. Structural inspection, without reading titles or IDs into any output, shows one carousel section labeled with the My List heading, a `totalCount` of 77, 13 loaded edges with cursors that decode to positions 0 to 12, and `hasNextPage: true`. All 13 loaded IDs are in the 77-entry file.

## Routes compared

| Route | Who advances the row | Reference used for completeness |
| --- | --- | --- |
| M0: version 0.0.4 manual | Member | None. Always `unknown`. Baseline. |
| M1: manual with reference | Member | Netflix's reported total for the same row, read at Start. |
| A: bounded assisted traversal | Extension clicks only that row's next-arrow button | Same reference as M1. |

The page-state reader is narrowly scoped. It reads the text of the inline page-state script that is already in the DOM, selects exactly one carousel section whose label equals the selected row's heading, and keeps only that section's `totalCount`, the IDs of its loaded edges, and their positions. It doesn't read the page's JavaScript objects, make requests, or keep any other section, profile or account field.

## Reference sets

### Synthetic

A simulator reproduces the observed structure with invented IDs and titles: a page-state script, several carousel rows, virtual slots, recycled cards, next and previous buttons, wrap-around, and delayed loading of later pages. Each scenario knows its exact ground truth: the ordered My List membership and every ID that appears only in other rows.

### Real (authorized owner account only)

No independent full reference exists without the owner's effort. Each real run records the following, in a private file under `~/goodwatch-private/706/`, and only aggregates reach Git:

1. Run label (R1, R2, ...), date, browser, layout (carousel or grid), page language, and a profile alias (P1, P2). Never a profile name, avatar, account ID or cookie.
2. Netflix's reported total for the row at Start.
3. The known subset: the loaded page-state edges with their positions, plus the last three titles the owner sees at the end of the row before it wraps, noted by the owner as positions only.
4. The captured file's distinct ID count, verdict and diagnostics.
5. The owner's spot check: is any captured title not on My List (contamination), and is any of the noted end titles missing (recall).

A second, independent reference is the official Netflix data archive `MyList.csv` when ticket [#640](https://github.com/alp82/goodwatch-monorepo/issues/640) supplies one. It isn't required for this ticket.

## Completeness rule under test

A capture may be marked `complete` only when every condition holds:

1. A page-state reference for the same row was read at Start: exactly one labeled section, and a whole-number total from 0 to 5,000.
2. The capture ended by the member's Stop, or by the assisted traversal reaching the total, not by a termination or limit.
3. The profile marker was present at Start and unchanged at Stop, and the tab stayed on My List in the same document.
4. The number of distinct accepted IDs equals the reported total.
5. Every ID from the loaded page-state edges is among the accepted IDs.
6. No ID was quarantined and no card inside the row was rejected.

Otherwise the capture is `partial` when a reference exists or the capture ended early, and `unknown` when no reference exists. Silence, a stalled count, a fixed number of clicks, or the arrow wrapping around never contribute to `complete`. More accepted IDs than the reported total is never `complete`.

Known residual risk, measured rather than assumed away: one contaminating ID plus one missing ID that isn't among the loaded edges would keep the count equal. The row boundary is the defense; gate G5 measures it.

## Cases each route must cover

Other rows, including IDs that also appear in My List; virtualized and recycled cards, including staggered link and label updates; delayed (lazy) loading of later pages; wrap-around; interruption and restart; profile change; navigation away; whole-row replacement; a title that Netflix counts but never renders (unavailable); the list changing during capture; duplicate titles with distinct IDs; an empty list; a missing page-state script; and both My List and Meine Liste labels.

## Candidate gates

| Gate | Candidate threshold |
| --- | --- |
| G1 False complete | 0 captures marked `complete` that miss or add any title, across every synthetic scenario and every real run. Hard gate. |
| G2 Recall when complete | 100 percent of ground truth, 0 contamination, for every synthetic capture marked `complete`. |
| G3 Truthful partial | Every capture not marked `complete` reports captured and reported counts when a reference exists, plus one reason code. |
| G4 Duplicates | An ID seen again after wrap-around counts once. Two distinct IDs with the same title are both kept. |
| G5 Other rows | 0 IDs from other rows in any synthetic capture, including IDs that also exist in My List positions not yet rendered. |
| G6 Recycled cards | Recall matches ground truth when cards are replaced, reused atomically, or updated link-first or label-first in separate tasks. |
| G7 Lazy loading | Assisted traversal reaches `complete` when later pages load after a delay of up to 3 seconds, without extra member actions. |
| G8 Interruption | Navigation away or a reload never yields a file marked `complete`. A restarted capture starts fresh and can reach `complete`. Resume across reloads is not claimed. |
| G9 Profile change | 100 percent of synthetic profile changes discard the capture and produce no file. |
| G10 Unavailable titles | A title counted in the total but never rendered yields `partial` with captured and reported counts. |
| G11 Empty list | No My List row yields `unknown` with a clear reason, never `complete`. A labeled section with a reported total of 0 and no cards may be `complete` with 0 items. |
| G12 Bounded traversal | Assisted traversal clicks only the selected row's next-arrow button, never more than `ceil(total / visible cards) + 3` advances plus a stall budget of 3 advances without new IDs, and stops within 3 minutes. |
| G13 Effort | Assisted: at most 3 member actions (open popup, start, save) and at most 60 seconds of simulated time for 77 titles with realistic delays. Manual routes: report measured clicks and time. |
| G14 Real sample | At least one real run on the owner's account reaches `complete` with the captured count equal to the reported total, and the owner's spot check finds no contamination or missing end title. A second profile and an interrupted run behave as G8 and G9 predict. |

## What is reported

For every scenario and route: ground-truth size, captured count, recall, contamination, verdict, reason, simulated elapsed time, member actions and arrow clicks. Real runs report only the aggregate fields listed under Real. Denominators are the number of scenarios and runs actually executed. Untested layouts, languages, browsers and profiles are listed as untested.

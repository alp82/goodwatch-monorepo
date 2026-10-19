# Netflix page data and exact My List membership: protocol and candidate gates

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702), follow-up 1 of [#706](https://github.com/alp82/goodwatch-monorepo/issues/706). Written 2026-10-19, before any measurement on this branch. The owner accepts or changes the gates at the final comparison.

## Question

Can a narrowly scoped, read-only read of Netflix's own page data for the My List row prove exact My List membership, so `complete` no longer rests on which cards the carousel renders?

## Data sources to examine, in order

| Source | What it would be | Safety bar |
| --- | --- | --- |
| S1: inline page state | The server-rendered state script in the page (the source 0.0.7 already reads). | Already within the capture's bar. |
| S2: other inline data | Other inline scripts, such as the older Falcor cache or the React context. | Same as S1. |
| S3: the page's live data after it loads more | What the page itself holds after the row has loaded later entries (for example, after the reviewed arrow is clicked). | No own requests. Reading it may need code in the page's own world; that needs justification and review before it's built. |
| S4: the page's own responses | Observing the responses the page receives for its own requests. | Needs a hook in the page's world. Treated as invasive; examined on paper only. |
| S5: own paging requests by cursor | The extension asks for later entries itself. | Out of bounds for this ticket. If it looks necessary, stop and report the evidence and options. |

This first step is offline only: the owner's saved My List page (private, de-DE, saved 2026-10-18) and Netflix's own client scripts saved with it. Output holds counts, structure names and codes only. No titles, IDs, profile values, cursors or request bodies go into Git, issues or reports.

## Reference sets for exact membership

| Reference | Use | Limits |
| --- | --- | --- |
| R1: the owner's 77-ID capture of 2026-10-18 18:00 | Offline check of any IDs found in the saved page | Captured about 20 minutes after the page was saved. The list may have changed in between. Not independently verified. |
| R2: the owner's live 0.0.6 or 0.0.7 assisted capture marked `complete` | Live comparison | Shares the capture's blind spots. Agreement is corroboration, not proof. |
| R3: Netflix's privacy archive `MyList.csv` (ticket #640), if supplied | Independent membership reference | Export time differs from capture time. |

## Candidate gates

| Gate | Candidate threshold |
| --- | --- |
| P1 Coverage | The source gives exactly one entry for every position from 0 to count minus 1: no gap, no duplicate position, no duplicate ID. |
| P2 Exactness | The source's ID set equals the reference set: 0 missing, 0 foreign. Reported against each reference used, with its denominator. |
| P3 Provenance | The 0.0.7 rules hold: current profile matches the avatar and is unique, the section belongs to the page, the document loaded on My List within 10 minutes, and the data is unchanged or its count is unchanged between reads. |
| P4 Fails safe | On synthetic fault injection (missing position, duplicate position or ID, count change, wrong section, unknown entity type, missing cursor), the verdict is never `complete`: 100 percent detection. |
| P5 Safety | No requests of its own, no clicks beyond the reviewed arrow, no cookie, token or storage reads. Page-world code only with written justification and review. Output holds counts and codes only. |
| P6 Agreement with the cards | Every ID read from the My List cards is in the source's set. Source IDs never rendered are counted and reported, not hidden. |

## What is reported

For each source: whether it exists in the saved page, how many My List entries it holds against the count, whether positions are contiguous, how later entries load according to Netflix's own client code (structure names only), and which gates it can meet. Denominators and untested items are stated.

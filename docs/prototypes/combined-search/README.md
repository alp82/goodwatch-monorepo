# Combined search prototype — blended-list revision

Open http://localhost:3003/prototype/combined-search on the running development server. Code is preserved on `prototype/combined-search`; local serving copies remain in the original workspace.

## User direction

The user rejected separate result groups. Use one ranked list, boost exact title words, mix in strong fingerprint results, automatically search after one second without typing, retain old results until new results arrive, and highlight title phrases alongside fingerprint reasons. This replaces the earlier Enter-only interaction choice. Enter remains an immediate-search shortcut.

## Implemented for review

- One list, deduplicated by normalized media type and TMDB ID. A result found by both sources retains both explanations.
- Title and unchanged D4+ searches run together after the one-second debounce. No routing question is used.
- Atomic result replacement after both sources settle. Old results and their original highlights remain during loading. Outdated query responses cannot replace the visible snapshot. A failed source yields partial results; if both fail, the prior snapshot remains with an error.
- Reserved loading-status space, initial skeletons, fixed poster dimensions and minimum row heights reduce layout movement.
- Whole matching title words highlighted in amber; final word prefixes highlighted only on the actual matching portion. Original-title matches expose the original name. Fingerprint reasons are blue chips.

## Ranking ideas

The expandable comparison panel has balanced, stronger title phrases, and stronger fingerprint results. It changes only local fusion weights and does not make additional requests.

Exact full title equality always wins (including original names). Whole phrases receive 1.05, all query words 0.9, partial whole-word coverage up to 0.65, and prefix-only matches 0.15. D4+ ranks become a reciprocal score `10 / (9 + rank)`. Balanced fusion takes the stronger of lexical score and 0.9 times the reciprocal score, with a small overlap bonus. The other ideas change these source weights. These are provisional ranking rules, not calibrated probabilities or accepted final weights. Catalog popularity only breaks ties. No D4+ ranking weights changed.

## Verification

Live browser checks: zero requests before debounce; exact Heat title first with actual word highlighting; one result list; prior Heat results retained while Drive loads; Drive replaces them after completion; IDs unique; ranking switch causes no calls; no page errors or horizontal overflow at 390px. The TypeScript compiler still reports repository errors elsewhere, with none in these prototype modules.

Remaining review: choose or adjust the fusion behavior using ambiguous titles and descriptions. Typos, person filmography expansion, and reference-title semantics retain the original limitations. This ticket is still open; the blended ranking is not yet user-accepted.

## Historical first comparison

The earlier split-list prototype and initial eight-query evidence are preserved at commit 81a9674. Its original screenshots and evidence.json remain here as historical artifacts, not the current UI or current ranking assessment.

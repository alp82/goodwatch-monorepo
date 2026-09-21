# Search comparison after the 99-title TV Tropes publication — 2026-09-21

Scope: evidence for [#120](https://github.com/alp82/goodwatch-monorepo/issues/120) and the expansion decision [#119](https://github.com/alp82/goodwatch-monorepo/issues/119). Read-only. No production writes, no paid model calls, no requests to tvtropes.org. **The full D4+ rerun was NOT executed** (it needs paid Jev calls); only the free parts below were measured.

## What was held fixed

- **D4+ (corrected)**: variant ID `corrected`, locked in [#104](https://github.com/alp82/goodwatch-monorepo/issues/104#issuecomment-5749381837). Code: `runCombinedDescription` with routing disabled; snapshot at `docs/prototypes/search-evaluation/source/prototype-combined-d4.server.ts`, live copy `goodwatch-webapp/app/server/combined-search/d4.server.ts`. Nothing was changed.
- **Saved requests**: `docs/prototypes/search-evaluation/fixtures.json`, 30 requests (5 title, 25 description). Only the 25 description requests touch tropes.
- **Before baseline**: `docs/prototypes/search-evaluation/baseline.json`, captured 2026-09-20T20:42Z at revision `0603be2`, accepted by the user in [#116](https://github.com/alp82/goodwatch-monorepo/issues/116#issuecomment-5753098673). It stores the full returned list (20 results, with evidence labels, scores, HTTP ms, Jev USD) per request. This is the only valid "before"; the pre-import Crate state no longer exists. A second frozen set exists (`docs/prototypes/crate-evidence/interpretations.json`, 13 frozen Jev interpretations) but its results were measured on a dropped scratch sample table, so it is not a usable before-list for live Crate.

## Publication verified (read-only Crate SELECTs, same access as `goodwatch-flows/scripts/export_tvtropes_cohort.py`)

- All **99/99** manifest titles (93 movies + 6 shows by manifest key; the task brief's "94 movies, 7 shows" sync counts were not reconciled) have rows in `trope`. **16,608** rows versus 16,656 manifest tropes (-48, 0.3%).
- Spot checks, manifest = Crate: Dune 438631 245, Parasite 496243 163, The Lion King 8587 630, Band of Brothers show 4613 212, The Witcher show 71912 238.
- 10 titles have fewer rows than the manifest: Finding Neverland -1, The Fly -1, Hercules -1, Clash of the Titans -1, Oblivion -2, Hansel & Gretel -1, Marvel's The Punisher -1, Neighbors -8, Percy Jackson: The Lightning Thief -12, RED -20. Cause not investigated (plausibly duplicate-name collapse in the sync); no title is empty.

## Measured results

### Before (from the stored baseline)

- **0 of the 99 titles appear in any of the 25 description requests' stored top-20 lists** (500 result slots). Coverage before = 0/99.
- Baseline evidence labels are almost entirely `text:`/`tag:` (essence text). `trope:` labels occur in a single request ("sunglasses", 18 of 20 results, via the wider trope-name fallback); `keyword:` in three.
- Baseline median description HTTP time 1,402 ms; Jev estimate $0.008564 for 25 requests.

### After (free part: D4+'s own trope SQL, restricted to the 99 titles)

Before is zero by construction (these titles had no trope rows). Query: `match((name 5.0, content 1.0), terms)` with D4+'s deterministic `tropeTerms`, in its phrase / all-terms modes; "catalog" = distinct titles matching in the whole `trope` table.

| Request | Strict matches among the 99 | Catalog-wide | Top new evidence |
| --- | --- | --- | --- |
| unreliable narrator | 7 (phrase) | 1,652 | Unreliable Narrator: The Punisher, Rocketman, Oblivion, Oldboy, The Witcher |
| time loop | 2 phrase / 3 all | 839 | Stable Time Loop: Déjà Vu, Back to the Future |
| sunglasses | 10 (1 by trope name) | 1,836 | Sunglasses at Night: Scarface |
| car chases | 0 phrase / 1 all | 149 | weak (The Italian Job, passage only) |
| cozy | 2 | 396 | Cozy Catastrophe: Civil War |
| tense but not bleak | 12 | 2,378 | Tense Tremolo: The Batman (name-only coincidence) |
| funny / with my parents / bleak | 48 / 60 / 4 | 12,323 / 19,709 / 1,374 | generic word hits (Funny Afro, Abusive Parents) |
| remaining 16 (long, multi-word, non-English) | 0 strict | 0 | any-term matches only (noise) |

Wider-fallback trope-name match (the only path that produced `trope:` labels in the baseline): sunglasses 1/99 (Scarface; catalog 313), time+loop 2 (595), unreliable+narrator 5 (1,486), car+chase 2 (Déjà Vu, RoboCop; 275), getaway+driver 0 (60).

Latency: the restricted trope queries ran in 64–250 ms each from this machine (one cold outlier 1,452 ms). This is not a D4+ end-to-end latency measurement. Cost of this work: $0.

### Not measured

Result lists, rank changes and new entries after publication, and end-to-end latency/cost. Those require the rerun below.

## What a full rerun needs (not run)

`python docs/prototypes/search-evaluation/run.py --previous <preserved baseline review JSON>` then `enrich.py` and `--render-only`, against the dev server on localhost:3003 (it is up). Preserve `baseline.json`/`review.html` first; the runner overwrites them. Calls: 25 Jev (`jev-latest`) description interpretations plus 5 TMDB title searches; estimated **about $0.009** (baseline: $0.008564), a few minutes. Minimal relevant subset: unreliable narrator, time loop, sunglasses, car chases, the two car/getaway and narrator paraphrases (core-16, core-17), about 6 calls, roughly $0.002. Caveats: `jev-latest` is unpinned and the dev checkout is a dirty feature branch with a modified `d4.server.ts`, so differences cannot be attributed to tropes alone unless the source hash matches the snapshot.

## Agent assessment (not user judgment, not measurement)

- The import is published correctly; the small row deficit is immaterial to search.
- Expected effect on the accepted 30-request baseline is **small**. In D4+ (corrected) tropes enter only when the essence-text pool is too small (wider fallback) or as a bonus among titles already in the fingerprint pool. 22 of 25 baseline requests were filled by essence text with no trope evidence, so new trope rows cannot change them much. The plausible movers are "sunglasses" (Scarface becomes eligible), and possibly "unreliable narrator" and "time loop" (Back to the Future, Déjà Vu, Oldboy) if the trope bonus path is active for them.
- Single generic words ("funny", "parents", "tense") now match many of the 99 by coincidental trope names. This is existing D4+ literal-matching behavior, not a regression introduced by the import, but more trope coverage gives it more surface.
- The saved requests are a poor instrument for this import: none was chosen for these 99 titles, and before-coverage is 0/99. A flat result would not show the import is useless; it would show the fixtures do not probe it.

## Limits

One sample per query; live catalog; trope terms for the wider path come from Jev in the real pipeline and were approximated by the deterministic `tropeTerms` plus hand-picked concrete words; restricted-ID queries bypass D4+'s fingerprint pool, eligibility and vote floor, so a match here does not mean the title would rank.

## Remaining for #120 / #119

1. User approval for the roughly $0.009 rerun (or the 6-request subset), on a checkout whose `d4.server.ts` hash matches the snapshot; then record per-request rank changes, new entries for separate review, latency and Jev cost.
2. Optionally explain the 48-row manifest/Crate difference (RED, Percy Jackson, Neighbors).
3. #119 still lacks measured search improvement. Current evidence supports only: recovery and publication work (99/99 live), trope evidence for a handful of concrete-motif requests now exists where it was zero, and the measured effect on accepted results is unknown. Consider adding a few trope-driven fixtures aimed at recovered titles before deciding on the 20,000-vote cohort.

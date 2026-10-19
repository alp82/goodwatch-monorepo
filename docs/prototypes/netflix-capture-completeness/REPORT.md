# Netflix My List capture: completeness prototype report

Ticket [#706](https://github.com/alp82/goodwatch-monorepo/issues/706) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). Prototype date: 2026-10-19. Branch `prototype/netflix-completeness`. Current version: 0.0.6, after one independent review of 0.0.5. This is evidence for the owner's verdict, not a verdict.

## Answer so far

Yes, with two known blind spots, on synthetic pages and one real saved page. A live account run is still needed.

Netflix's My List page carries a count of the titles on the open profile's My List and the IDs of its first 13 titles with their positions. Version 0.0.6 uses that count only when the page state names the profile on screen, that profile's name is unique on the account, the My List section belongs to the page the state describes, and the tab was first loaded on My List. A file is `complete` only when:

- Exactly that many titles were captured, all known titles among them.
- Every known position was seen next to its neighbor in Netflix's order.
- The row came back to its first title, shown by ID.
- The profile and page didn't change.

Silence, a stalled count, a click count, a missing arrow, or a repeated window never count as evidence. Only cards proven to sit in the My List row enter the file.

- **Synthetic benchmark:** 27 scenarios × 3 routes (81 runs). Version 0.0.6 marked 30 of 54 runs complete, and 28 of those were exact. The 2 wrong ones are the adversarial scenario S23: a foreign card beyond the 13 known positions plus a title Netflix counts but never shows.
- **Randomized stress:** 900 scenarios × 2 routes (1,800 runs). There were 4 false completes, all in the 8 runs that combined a never-shown title with a title added elsewhere during the capture. The other 1,792 runs had none.
- **Reaching complete:** on lists of 8 or more titles where an exact capture was possible, assisted mode reached `complete` in 468 of 524 runs and manual in 419 of 524. Lists of 7 or fewer that fit on screen reached it in 12 of 224 runs, because they can't show a wrap. Version 0.0.5 had reached about 99 percent, partly by accepting evidence the review showed to be unsafe.
- **Real saved page (owner, de-DE, carousel):** 0.0.6 accepts the reference: the state's current profile matches the avatar on screen, the name is unique among 5 profiles, and the section belongs to the browse page. The count is 77, with 13 known positions, and the 5 cards shown raise no position mismatch. Applied to the owner's earlier files, the rule marks the 13-title file `partial` (13 of 77). The 77-title file meets the count rule. Positions and lap weren't recorded in version 0.0.4.
- **Real Chromium 156 with the unpacked 0.0.6 extension (synthetic page, no Netflix request):** assisted mode captured 77 of 77 in 26 seconds with 3 member actions and 12 arrow clicks, using real page-state provenance and a real navigation entry. With 2 titles never shown it saved a `partial` file, 75 of 77. Manual mode at 1.2 s per click reported 67 of 77 after the first lap and 77 after a second (31 actions, 34 seconds). A profile change discarded the capture.

## Review fixes in 0.0.6

An independent review of `961cd4a6` and `e62cedf4` found eight problems. Each now has a failing-first regression test in `harness/review.test.mjs`. All 17 tests failed against 0.0.5 and pass against 0.0.6.

| Finding | Fix |
| --- | --- |
| 1. Assisted clicking could press a matching arrow inside a dialog. | The only clickable control is the single `carousel-hawkins-right-button` whose wrapper sits directly in the row's own scroller, outside any dialog, preview, card or other group. If there's anything else, or two matches, assisted mode stops clicking and falls back to manual (`manual_fallback`), keeping the titles so far. |
| 2. A stale reference chosen by heading alone gave `complete` (7 of 30, no clicks). | The reference is accepted only with profile and page provenance (see "Answer so far"). The full-list shortcut is gone, and every list now needs position confirmation and a wrap by ID. |
| 3. Profile identity accepted missing alt or src; empty captures skipped later guards. | The avatar needs both alt text and image. A missing or shared profile name means no profile guard, and the file can't be `complete`. An empty result runs every navigation and profile guard on status and stop. |
| 4. An unrecognized section inside the grid put a foreign title in the file. | A card enters the file only if no section-like element, dialog, group, nested row or heading sits between it and the My List scroller or grid. |
| 5. The order check covered only cards shown at Start and was skipped when the row had moved. A missing arrow and a repeated window counted as a lap. | Every known position is checked as it comes into view: neighbors in adjacent slots, and across settled windows that replace each other with nothing in between. A lap needs a card directly before the first title, or the first title leaving and coming back, both by ID. |
| 6. The 3-minute deadline was checked only between steps (181.5 s seen). The benchmark compared clicks with the implementation's own cap and allowed 240 s. | Assisted timers can't fire after the deadline (longest run now exactly 180.0 s). The benchmark and stress run check G12 with the protocol's formula, `ceil(total / visible cards) + 3 + 3`, using the scenario's real card count, and the collector's own elapsed time. |
| 7. Script errors could print private input; compare printed file names; the replay took the first matching section. | Both scripts print fixed codes (`capture_unreadable`, `page_unreadable`, `replay_failed`) and anonymous labels (F1, capture 1). The replay compares files only after the collector accepted the reference, with the same uniqueness rule. |
| 8. The checklist lacked contamination and end-of-row questions; the profile-switch run was optional. | Both questions added (yes, no or unsure only). The profile-switch run is required when another profile exists, otherwise recorded as untested. |

Fixing finding 5 cost recall at first: assisted complete-when-possible fell to 214 of 748. Two harmless layouts caused false mismatches or no confirmation:

- With no partly visible neighbor card, page boundaries are never side by side. The fix is the cross-window check, which requires continuity: every card shown in between must belong to one of the two windows.
- A still-loading slot between two cards made them look adjacent. The fix is the adjacent-slots rule.

Both fixes can only turn `complete` into `partial`, never the reverse.

## What was built

| Path | What it is |
| --- | --- |
| `PROTOCOL.md` | Reference-set protocol and candidate gates, committed in `961cd4a6` before any measurement. Unchanged. |
| `extension/` | Unpacked MV3 extension, version 0.0.6. Permissions: `activeTab` and `scripting`. |
| `baseline/capture-v004.js` | The 0.0.4 collector, unchanged, for the M0 baseline. |
| `harness/sim.mjs` | Synthetic Netflix page with a virtual clock: page state with profiles and page, rows, virtual slots, recycled cards, lazy pages, wrap-around, load URL. |
| `harness/benchmark.mjs`, `harness/runner.mjs` | 27 scenarios across 3 routes with gate checks. |
| `harness/stress.mjs` | Seeded randomized layouts, delays, recycling, click speeds and list changes. |
| `harness/collector.test.mjs`, `harness/review.test.mjs` | 12 rule tests and 17 review regression tests. |
| `harness/live-fixture.mjs`, `scripts/browser-run.mjs` | Self-running synthetic page and a real Chromium run of the unpacked extension. |
| `scripts/private-replay.mjs`, `scripts/compare-captures.mjs` | Offline replay and comparison of private files. Counts and fixed codes only. |
| `benchmark/` | `results.md`, `results.json`, `stress-{706,9001,1234}.json`, `browser-run.json`. |
| `screenshots/` | Popup states from the real Chromium run, synthetic data. |

### Run it

```sh
cd docs/prototypes/netflix-capture-completeness
npm ci
npm test                                   # 29 tests
npm run benchmark                          # writes benchmark/results.{md,json}
node harness/stress.mjs 300 706 --json benchmark/stress-706.json
TMPDIR=$HOME/.cache/gw706 \
GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
GOODWATCH_CHROMIUM_PATH=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node scripts/browser-run.mjs --screens screenshots --json benchmark/browser-run.json
node scripts/private-replay.mjs <saved-page.html> <capture.json> ...   # private, counts only
```

Use a short `TMPDIR` for the review tests and the browser run. Chromium aborts when its socket path is too long.

## Candidate gates and measured results

Gates as committed in `PROTOCOL.md`. Denominators: 27 scenarios × 3 routes = 81 runs, of which 54 are version 0.0.6 (M1 and A). S25 to S27 were added after the first run of 0.0.5.

| Gate | Result | Measured on 0.0.6 |
| --- | --- | --- |
| G1 False complete | **Fail** | 2 of 54 benchmark runs (S23, both routes). Stress: 4 of 1,800, all in the 8 runs combining a never-shown title with a concurrent addition. |
| G2 Recall when complete | **Fail** | 28 of 30 complete benchmark runs exact. The same S23 runs. |
| G3 Truthful partial | Pass | 24 non-complete runs, each with counts and one reason. |
| G4 Duplicates | Pass | Wrap-around counted once. Same-name distinct IDs kept (S09). |
| G5 Other rows | Pass | 0 other-row IDs in 54 runs, including shared IDs (S08). Plus review tests for a grid recommendation section and a group inside the scroller. |
| G6 Recycled cards | Pass | S04 to S06: M0 100, 13 and 13 percent; M1 and A 100 percent each. |
| G7 Lazy loading | Pass | S07 (3 s loads) assisted complete in 37.5 s simulated. |
| G8 Interruption | Pass | Navigation discards (S14). A reload loses the capture; restarting reaches complete (S16). |
| G9 Profile change | Pass | S13 discarded in both routes, and in real Chromium. |
| G10 Unavailable titles | Pass | S10: 28 of 30, `partial` in both routes. |
| G11 Empty list | Pass | No row: `unknown`. Reported 0: `complete` with 0 items (S18). An empty result is discarded after a profile switch or navigation (review test). |
| G12 Bounded traversal | Pass | Protocol formula, checked independently: 23 of 23 benchmark runs and all stress runs within `ceil(total / visible) + 3 + 3`. Longest traversal 106.1 s in the benchmark, exactly 180.0 s in stress. |
| G13 Effort | Pass | S01 assisted: 3 actions, 27 s simulated. Manual M1: 17 actions, 20.5 s (patient member). |
| G14 Real sample | **Not run** | Needs the owner's live run. |

### Route comparison

| Benchmark, 27 scenarios each | Complete | Partial | Unknown | No file | False complete | Mean recall of files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M0, version 0.0.4 manual | 0 | 2 | 21 | 4 | 0 | 85.6% |
| M1, version 0.0.6 manual | 15 | 7 | 2 | 3 | 1 | 99.5% |
| A, version 0.0.6 assisted | 15 | 7 | 2 | 3 | 1 | 99.5% |

| Stress, 3 seeds × 300 scenarios | Manual M1 | Assisted A |
| --- | ---: | ---: |
| Runs | 900 | 900 |
| False complete | 2 | 2 |
| Complete when exact was possible, lists of 8 or more | 419 of 524 | 468 of 524 |
| Complete when exact was possible, lists of 7 or fewer | 12 of 224 | 12 of 224 |
| Mean recall | 96.1% | 99.6% |
| G12 violations (protocol formula) | not applicable | 0 |

Assisted runs that could have been exact but came out `partial` (56 of 524 lists of 8 or more) were `positions_unconfirmed` (47) or `below_total` (9). All 47 `positions_unconfirmed` runs are lists of 12 to 14 titles with 7 or 8 cards per view and no partly visible neighbor card. The second view wraps onto the first, so the boundary between them is never side by side.

### What was actually tested

| Kind | Layout | Language | Profiles | Data |
| --- | --- | --- | --- | --- |
| Synthetic benchmark, stress and 29 tests | Carousel; one grid scenario | "Meine Liste", "My List" | Synthetic names, changes, missing alt, duplicate names, other-profile state | Invented |
| Real Chromium, unpacked MV3 | Carousel | "Meine Liste" | One synthetic profile, one change | Invented, routed netflix.com origin, no Netflix request |
| Private replay | Owner's saved carousel page | de-DE | One real profile among 5 | Real, offline, counts only. The replay assumes the page was saved from `/browse/my-list`. |

Not tested: a live Netflix tab, any other language, a real grid layout, a second real profile, Firefox or Safari, phones, a real unavailable title, a real empty list, and whether Netflix responds to the extension's clicks.

## Limits and failure modes

1. **Two blind spots.** The count stays equal when a counted title never shows and either a title is added from another device during the capture, or a foreign card appears beyond the 13 known positions. Positions after the first 13 aren't known, and cards carry no absolute position. Follow-up 1 would close this.
2. **Untrusted clicks.** Assisted mode uses `element.click()`. If Netflix ignores untrusted clicks, assisted mode stalls and reports `partial`, and the manual route still works.
3. **Short lists.** Lists that fit on screen without wrapping can't be `complete`. Lists of 12 to 14 titles in wide views without a partly visible neighbor card usually stay `partial`.
4. **Provenance assumptions.** The profile check assumes the avatar's alt text is the profile name, as on the saved page. The page check needs the tab to have been loaded on My List; arriving from another Netflix page needs a refresh.
5. **Unavailable titles.** If Netflix counts titles it doesn't show, such a list can never be `complete`.
6. **Labels and layouts.** Only "My List" and "Meine Liste" and one saved layout.
7. **Manual effort.** Fast clicking skips loading cards; the popup asks for another, slower lap.
8. **Large slow lists.** The 3-minute assisted limit stops very large lists as `partial`.
9. **Reload loses everything.** Capture lives in the tab's memory.

## Recommendation (not a verdict)

**Accept assisted traversal with the provenance-checked completeness rule as the route to validate live, with narrowed scope:** desktop Chromium, the carousel My List row, "My List" and "Meine Liste" labels, one profile per file, lists that wrap. Keep manual clicking as the fallback inside the same popup. Describe `complete` as "matches Netflix's own count and order when you started", and document both blind spots. Don't accept until the owner's live run passes G14 and the row moves by itself.

## Owner's live check (about 15 minutes, 12 without another profile)

Everything stays on the owner's computer. The kit is in `~/goodwatch-private/706/`, outside Git: `wishlist-capture-extension-v006/`, `CHECKLIST.md` and `results.md`.

## Owner decisions

1. **Main route:** (a) assisted with manual fallback, (b) manual only, (c) defer. Recommended: (a).
2. **Blind spots:** (a) accept them as documented limits for now, (b) block acceptance until follow-up 1 is investigated, (c) never write `complete` and show only "N of M". Recommended: (a).
3. **Popup buttons:** two buttons ("Capture My List" and "I'll click through myself") or assisted only. Recommended: two buttons.
4. **Assisted time limit:** keep 3 minutes or raise it to 6 for lists over about 250 titles. Recommended: keep 3 minutes until a large real list exists.

## Follow-up tickets to consider

1. **Can a narrowly scoped live page-state read verify exact My List membership?** Later pages' entries carry position cursors. Reading them for the selected row only would close both blind spots, and also short lists.
2. **Does Netflix count titles it doesn't show in My List?** Measure how often the count exceeds what's shown.
3. **Which My List labels and layouts exist across Netflix languages and the grid view?**
4. **Should page-state types and years for the first 13 entries feed matching?** This belongs with [#374](https://github.com/alp82/goodwatch-monorepo/issues/374) or the suggestions work.

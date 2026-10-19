# Netflix My List capture: completeness prototype report

Ticket [#706](https://github.com/alp82/goodwatch-monorepo/issues/706) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). Prototype date: 2026-10-19. Branch `prototype/netflix-completeness`. This is evidence for the owner's verdict, not a verdict.

## Answer so far

Yes, with one known blind spot, on synthetic pages and one real saved page. A live account run is still needed.

Netflix's own My List page carries a count of the titles on My List and the IDs of the first 13 with their positions. Version 0.0.5 reads only that row's count and loaded entries. It marks a file `complete` only when it captured exactly that many titles, all 13 loaded titles are among them, the shown order matches Netflix's positions, the row came back to its start, and the profile and page didn't change. Silence, a stalled count, a click count, or a wrap never count as evidence.

- **Synthetic benchmark:** 27 scenarios, each run through all three routes (81 runs). Version 0.0.5 marked 30 of 54 runs complete, and 28 of those were exact. The 2 wrong ones are the adversarial scenario S23, which the protocol predicted before measuring.
- **Randomized stress:** 900 scenarios run through both routes (1,800 runs). There were 5 false completes, all in the 8 runs that combined a title Netflix counts but never shows with a title added elsewhere during the capture. The other 1,792 runs had none.
- **Real saved page (owner, de-DE, carousel):** the reader found Netflix's count, 77, and 13 loaded entries. The 5 cards shown at Start matched Netflix's positions 0 to 4 in order. Applied to the owner's earlier files, the rule marks the 13-title file `partial` (13 of 77). The 77-title file meets the count rule. Lap evidence wasn't recorded in version 0.0.4.
- **Assisted traversal** ("Capture My List") reached `complete` on 739 of 748 randomized runs where an exact capture was possible (98.8 percent). Manual clicking reached 681 of 748 (91.0 percent), because fast clicking scrolls past cards that are still loading. In real Chromium, assisted mode captured 77 of 77 in 26 seconds with 3 member actions. Manual mode needed 2 laps, 26 arrow clicks, 31 actions and 35 seconds. After the first lap it truthfully reported 67 of 77.

## What was built

| Path | What it is |
| --- | --- |
| `PROTOCOL.md` | Reference-set protocol and candidate gates, committed in `961cd4a6` before any measurement. |
| `extension/` | Unpacked MV3 extension, version 0.0.5. Same permissions as 0.0.4: `activeTab` and `scripting`. |
| `baseline/capture-v004.js` | The 0.0.4 collector, unchanged, for the M0 baseline. |
| `harness/sim.mjs` | Synthetic Netflix page with a virtual clock: page-state script, rows, virtual slots, recycled cards, lazy pages, wrap-around. |
| `harness/benchmark.mjs`, `harness/runner.mjs` | 27 scenarios across 3 routes with gate checks. |
| `harness/stress.mjs` | Seeded randomized layouts, delays, recycling, click speeds and list changes. |
| `harness/collector.test.mjs` | 12 rule tests. |
| `harness/live-fixture.mjs`, `scripts/browser-run.mjs` | Self-running synthetic page and a real Chromium run of the unpacked extension. |
| `scripts/private-replay.mjs` | Offline replay against a member's saved page and capture files. Prints aggregates only. |
| `scripts/compare-captures.mjs` | Compares private capture files. Prints aggregates only. |
| `benchmark/` | Results: `results.md`, `results.json`, `stress-{706,9001,1234}.json`, `browser-run.json`. |
| `screenshots/` | Popup states from the real Chromium run, synthetic data. |

### Run it

```sh
cd docs/prototypes/netflix-capture-completeness
npm ci
npm test                                   # 12 rule tests
npm run benchmark                          # writes benchmark/results.{md,json}
node harness/stress.mjs 300 706 --json benchmark/stress-706.json
# Real Chromium, needs playwright-core and a Chromium with Extensions.triggerAction:
TMPDIR=$HOME/.cache/gw706 \
GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
GOODWATCH_CHROMIUM_PATH=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node scripts/browser-run.mjs --screens screenshots --json benchmark/browser-run.json
# Private, offline, aggregates only:
node scripts/private-replay.mjs <saved-page.html> <capture.json> ...
```

Use a short `TMPDIR`: Chromium aborts when its socket path is too long.

## How version 0.0.5 decides

1. **Reference.** At Start, the collector finds the one inline script with Netflix's page state and decodes it without `eval`. It selects exactly one carousel section whose label equals the selected row's heading, and keeps that section's `totalCount` plus the IDs and cursor positions of its loaded edges. The cursors decode to positions 0, 1, 2, and so on. Nothing else is kept.
2. **Stable read.** A card is accepted only after its link and label have stayed the same for 400 ms. This fixes the 0.0.4 risk where a recycled card updated in two steps could lose or quarantine a title (S05 and S06: 0.0.4 recall 13 percent, 0.0.5 100 percent).
3. **Rebind.** If Netflix re-renders the row, the collector rebinds to exactly one row with the same heading, on the same page and profile, at most 20 times (S15: 0.0.4 recall 34 percent, 0.0.5 100 percent).
4. **Lap.** The row's first title leaves view and comes back, or the next arrow disappears. Assisted mode also counts a repeated settled window as a lap.
5. **Assisted traversal.** It clicks only the selected row's next-arrow button. After each click it waits until the row has moved, is quiet for 600 ms, and holds as many cards as it has ever shown at once, up to 8 seconds. It stops at the end of one lap rather than when the count first matches, because stopping early turned a mid-capture addition into a false complete in the first benchmark pass (S11). Its bounds: at most `ceil(remaining / first gain) + 3` advances plus 3 without new titles, and 3 minutes.
6. **Verdict.** `complete` needs every protocol condition. Otherwise the file is `partial` with one reason (`below_total`, `above_total`, `loaded_title_missing`, `order_mismatch`, `lap_not_finished`, `conflicting_cards`, `ended_terminated_boundary`, and so on), or `unknown` when there is no reference.

## Candidate gates and measured results

Gates as committed in `PROTOCOL.md`. Denominators: 27 synthetic scenarios × 3 routes = 81 runs, of which 54 are version 0.0.5 (M1 and A). Scenarios S25 to S27 were added after the first run, to probe weaknesses it exposed. They're included in every count.

| Gate | Result | Measured |
| --- | --- | --- |
| G1 False complete | **Fail** | 2 of 54 benchmark runs (adversarial S23, both routes). Stress: 5 of 1,800, all in the 8 runs that combined both faults. |
| G2 Recall when complete | **Fail** | 28 of 30 complete benchmark runs exact. The same S23 runs. |
| G3 Truthful partial | Pass | 24 non-complete runs, each with captured and reported counts where a reference exists, and one reason. |
| G4 Duplicates | Pass | Wrap-around counted once. Two titles with the same name and distinct IDs both kept (S09). |
| G5 Other rows | Pass | 0 other-row IDs in 54 runs, including 3 My List IDs that also sit in other rows (S08). |
| G6 Recycled cards | Pass | S04 to S06: M0 100, 13 and 13 percent; M1 and A 100 percent each. |
| G7 Lazy loading | Pass | S07 (3 s loads) assisted complete in 37.5 s of simulated time. |
| G8 Interruption | Pass | Navigation discards (S14). A reload loses the capture; restarting reaches complete (S16). Resume isn't claimed. |
| G9 Profile change | Pass | S13 discarded in both routes. Also in real Chromium. |
| G10 Unavailable titles | Pass | S10: 28 of 30, `partial` in both routes. Real Chromium: 75 of 77, `partial`. |
| G11 Empty list | Pass | No row: `unknown` (`boundary_missing`). Reported 0: `complete` with 0 items (S18). |
| G12 Bounded traversal | Pass | 23 of 23 assisted runs within their advance cap. Longest 106.5 s (300 titles). Stress: 0 runs over the cap; 11 of 900 large lists stopped at the 3-minute limit as `partial`. |
| G13 Effort | Pass | S01 assisted: 3 actions, 27 s simulated, 26 s in real Chromium. Manual M1: 17 actions, 20.5 s simulated (patient member); real Chromium 31 actions, 35 s. |
| G14 Real sample | **Not run** | Needs the owner's live run. The saved-page replay is listed separately. |

### Route comparison (benchmark, 27 scenarios each)

| Route | Complete | Partial | Unknown | No file | False complete | Mean recall of files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M0, version 0.0.4 manual | 0 | 2 | 21 | 4 | 0 | 85.6% |
| M1, version 0.0.5 manual | 15 | 7 | 2 | 3 | 1 | 99.5% |
| A, version 0.0.5 assisted | 15 | 7 | 2 | 3 | 1 | 99.5% |

The benchmark's manual member is patient: 1.5 s between clicks, and a second lap when the popup reports missing titles. The stress run varies click speed from 0.4 to 2.5 s, which is where manual and assisted differ:

| Stress (3 seeds × 300 scenarios) | Manual M1 | Assisted A |
| --- | ---: | ---: |
| Runs | 900 | 900 |
| False complete | 3 | 2 |
| Complete when an exact capture was possible | 681 of 748 | 739 of 748 |
| Mean recall | 96.2% | 99.6% |

Full per-run tables: `benchmark/results.md`, `benchmark/stress-*.json`.

### What was actually tested

| Kind | Layout | Language | Profiles | Data |
| --- | --- | --- | --- | --- |
| Synthetic benchmark and stress, happy-dom with virtual clock | Carousel row; one legacy grid scenario | Row labels "Meine Liste" and "My List" | Synthetic profile marker, changed in 2 scenarios | Invented |
| Real Chromium 156, unpacked MV3 extension | Carousel row | "Meine Liste" | One synthetic marker, one change | Invented, served at a routed netflix.com origin. No Netflix request was made. |
| Private replay | Owner's saved carousel page | de-DE | One profile | Real, offline, aggregates only |

Not tested: a live Netflix tab, any other language, the grid layout on a real account, a second real profile, Firefox or Safari, phones, a real unavailable title, a real empty list, and whether Netflix responds to the extension's clicks.

## Limits and failure modes

1. **The two-fault blind spot.** A title that Netflix counts but never shows, plus a title added from another device during the capture, keeps the count equal. If the hidden title isn't among the first 13 loaded entries and the added title doesn't show among the first cards, `complete` is wrong. Card markup carries no absolute position (checked on the saved page: only window-relative `data-virtual-slot`), so the DOM alone can't close it. Reading positions for later pages would, but that needs the page's live data, not the inline script. See follow-up 1.
2. **Untrusted clicks.** Assisted mode uses `element.click()`, which produces untrusted events. The fixture accepts them. Whether Netflix's row does is unknown until a live run. If it doesn't, assisted mode stalls and reports `partial`, and the manual route still works.
3. **Unavailable titles.** If Netflix counts titles that it doesn't show in the member's country, a list with such a title can never be `complete`. That's truthful, but it may affect many members. The live run will show whether the owner's count matches what's shown.
4. **Selector and label coverage.** Only "My List" and "Meine Liste" labels and one saved layout. Other languages give `boundary_missing`. The reference requires the page-state label to equal the row heading exactly.
5. **Manual clicking speed.** Members clicking faster than Netflix loads skip cards. The popup then says titles are missing and asks for another, slower lap. Truthful, but it costs effort (real Chromium: 31 actions versus 3).
6. **Large slow lists.** The 3-minute assisted limit stops very large lists as `partial` (11 of 900 stress scenarios, all with 249 to 399 titles). The limit is a candidate gate value the owner can change.
7. **Reload loses everything.** Capture lives in the tab's memory. A reload or tab close needs a fresh start, which is fast in assisted mode.
8. **Stop timing.** Cards shown less than 400 ms before Stop aren't accepted. The verdict then says `partial`.

## Recommendation (not a verdict)

**Accept assisted traversal with the page-state completeness check as the route to validate live, with narrowed scope:** desktop Chromium, the carousel My List row, "My List" and "Meine Liste" labels, one profile per file. Keep manual clicking as the fallback inside the same popup, not as the main route. Treat `complete` as "matches Netflix's own count at Start" and say so in import copy, and keep the two-fault blind spot as a documented limit unless follow-up 1 closes it. Don't accept until the owner's live run passes G14. In particular, the extension's clicks must move the real row.

## Owner's live check (about 10 minutes)

Everything stays on your computer. Put files in `~/goodwatch-private/706/`, which is outside Git. The kit is already there: the extension copy and `CHECKLIST.md`.

## Follow-up tickets to consider

1. **Can a narrowly scoped live page-state read verify exact My List membership?** Later pages' entries also carry position cursors. Reading them for the selected row only would close the two-fault blind spot and give movie/show type.
2. **Does Netflix count titles it doesn't show in My List?** Measure on real accounts how often the reported total exceeds the titles shown, because it decides how often `complete` is reachable.
3. **Which My List labels and layouts exist across Netflix languages and the grid view?** Needed before supporting members outside en/de.
4. **Should captured page-state types and years for the first 13 entries feed matching?** The reference already holds Movie or Show and release year for those entries. This is out of scope here and belongs with matching ([#374](https://github.com/alp82/goodwatch-monorepo/issues/374) or the suggestions work).

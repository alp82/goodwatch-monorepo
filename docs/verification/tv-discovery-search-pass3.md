# TV discovery and search, pass 3

Implemented on `feat/shared-scoring` after pass 2, with a new starting HEAD of `4c1cf4b6f27bf3146f6bcf997e36cee781c88afd`. Source remains uncommitted for independent review. The original working-file capture, including unrelated edits, is `/tmp/goodwatch-tv-pass3/starting-files.tar`; accompanying `starting.patch`, `starting-index.patch`, `starting-status.txt`, and `starting-untracked.txt` record this pass's boundary.

## Result and domain semantics

- Discover and Search have a dedicated Filters step with Movies/Shows/Both, On my services/Everywhere, Not seen yet/Include seen, sort, For you, and one mood, theme, and style each. Choices reuse the existing TV subset of Discover options and their semantic labels; the full Discover page still offers its richer selection. There is no parallel genre taxonomy or filtering of only the visible page.
- The existing Discover results endpoint applies filters, country, eligibility, hidden-title handling, For you, and sorting. Member saved-service defaults and actual server state are retained. Popular is the browse default; Relevance is the search default. Best match requires actual taste. Selecting another sort does not silently disable For you: the existing server blend and explanation still apply.
- Search submits explicitly. Query/type/service eligibility uses the existing combined-search ranking, then Discover filters and pages its full ranked list (up to 100 titles). Changing mood/theme/style, seen, sort, For you, or page reuses that ranking. This is a ranked search candidate set, not an exhaustive catalog search. No recommendation, Wishlist, watched, or tracking mutation was added.
- Results display the server page without the former four-card truncation. Previous/Next and the page/count summary use server `total`, `page`, and `pageSize`; the endpoint remains 40 per page. Query/filter/sort changes reset to page 1. Invalid/fractional/non-numeric page state resets safely, with a maximum of 250; authoritative result counts clamp a too-high page. Loading, empty, failed/Retry, and last-page states are distinct. Query/page identity prevents old reports and placeholder cards from replacing the current results.
- Filters apply on Done or Back and return focus to Filters. Details and their panels retain TV query, filters, sort, page, selected poster, and row position. Edit search retains the submitted draft. Existing TV Discover mood/theme/style and Search bookmarks remain compatible.
- Expand passes query/filter/sort/page parameters to the existing `/discover` page. Exact full-page poster/scroll restoration is not promised: standalone search starts its client pagination at page 1, and the full page retains its own grouping/layout preferences. TV Back restoration is separately verified. No standalone-page behavior was changed.
- Cinematic backgrounds and large titles remain. Shared `TitleList` reserves heading/metadata/active-summary regions; desktop browse controls use a compact two-column block. Phone controls scroll in a separate row clipped before Expand. The existing early poster scrolling, history, and reduced-motion handling remain in use. Explorer remains absent from TV navigation.

## Recovered keyboard

Inspected the implementation in `6a85a3de^`, `goodwatch-webapp/app/ui/living-room/TvScreens.tsx` lines 1064–1146 and `PhoneTvScreens.tsx` lines 853–921, also extracted under `/tmp/goodwatch-tv-pass1/keyboard-{desktop,phone}-history.tsx`.

Reused its QWERTY row layout and Space/Delete/Search behavior. Adapted those keys to the current machine/item/focus contracts, added digits and Clear, and retained the current 512-character search limit. Search requires two trimmed characters. The phone splits rows into five columns and scrolls keyboard rows while input/editing/Search actions stay reachable. Logical vertical navigation follows keyboard rows even with the fixed action row. Physical typing and touch use the same draft; no hidden auto-focused input consumes remote commands. Keyboard and filter rendering remain in the existing lazy screen chunks; the small URL/focus contract is needed in the initial TV machine.

## Initial full-pass verification (before the P2 correction)

Artifact paths below are under `/tmp/goodwatch-tv-pass3/` unless stated otherwise.

- Baseline TV suite: **611 passed / one existing rating-render failure**, `tests-baseline.log`.
- Final `node --test --test-reporter=tap app/ui/living-room/tv/*.test.ts app/server/title-filter/passes.test.ts app/domain/discover-search.test.ts`: **634 passed / the same one failure**, 635 total, `tests-final.log`. The failure is `tv-title-render.test.ts`, “the rating asks how the title was, on the strip's levels from low to high”. New coverage exercises malformed URL state, server page counts, filter reset/Back/Expand context, ranking eligibility and reuse, keyboard limits/actions/logical navigation, and render/item contracts. Existing expectations were updated for the approved keyboard and paging controls.
- `npm run typecheck`: **179 diagnostics, none new**, compared with 189 in the isolated baseline. The ten baseline-only diagnostics concern missing nested auth-conformance harness dependencies. See `typecheck-{baseline,final}.log` and `typecheck-comparison.json`; repository typecheck is not green.
- `SENTRY_DISABLE_AUTO_UPLOAD=true npm run build`: passed for baseline and final (`build-{baseline,final}.log`). No new third-party dependency or dependency on unrelated uncommitted analytics was added.
- Commit-ready hook variants compile through Vite and produce identical Search/Discover render fixtures to the working hooks (`commit-variant-check.json`, `commit-variant-vite.config.mjs`, `*-commit-render.log`). These read-only fixtures log the existing availability preload failure without DB configuration; they do not establish database acceptance.
- `node /tmp/goodwatch-tv-pass3/browser.mjs`: passed desktop 1920×1080, phone 390×844, 360×740 with reduced motion, and short phone 375×667. `browser-final.log` and `browser-results.json` capture explicit remote/physical search, digits, Space/Delete/Clear, 512-character limit, query draft, filters and request parameters, next/previous/clamping, empty/failure/Retry, details/Fingerprint return focus/offset, and a delayed old query losing to a newer query. No rendered-page exceptions were observed in this controlled guest matrix.
- The browser matrix uses real guest SSR and intercepted catalog/search reads with twelve captured cards, not injected authenticated loaders. Its deliberately small four-card response pages exercise boundaries; production page size remains 40. Non-GET API calls other than the search contract are blocked. It is client-contract evidence, not live catalog or real-auth acceptance. A direct local catalog request returned 503 (`discover-live.json`).
- `node /tmp/goodwatch-tv-pass3/scroll-browser.mjs`: passed the same four sizes using captured cards and a 40-card page contract. It navigates eight posters, opens details and Fingerprint, then asserts the same focused poster and exact nonzero offsets: **1119 / 628 / 592 / 441 CSS scroll pixels**. Poster top/height stay stable between the first and selected titles; phone posters and filter actions are at least 44×44 CSS pixels. Evidence: `scroll-browser.log`, `scroll-results.json`. This supplements the initial four-card matrix, whose rows did not overflow.
- A further `long-title-browser.mjs` matrix passed the same four sizes with deliberately synthetic short/long display labels on captured cards. It verifies stable poster top/height and return offsets when the desktop heading wraps to two lines and phone headings truncate. Logs/results: `long-title-browser.log`, `long-title-results.json`; screenshots: `long-title-return-{desktop,phone,small-phone,short-phone}.png`. Those labels are layout fixtures, not catalog metadata.
- `git diff --check`: passed. Contribution reconstruction, mixed-file preservation, and HEAD applicability are recorded in `integrity.json` and `mixed-file-integrity.json`.

Screenshots, visually inspected for layout: `keyboard-{desktop,phone,small-phone,short-phone}.png`, `results-page2-{desktop,phone,small-phone,short-phone}.png`, `filters-{desktop,phone,small-phone,short-phone}.png`. Additional restored-row captures: `scrolled-return-{desktop,phone,small-phone,short-phone}.png`. All are absolute beneath `/tmp/goodwatch-tv-pass3/`.

## Initial landing budget and Lighthouse

The default `./bench.sh budget` could not expand its URL set because `SHARE_LIST_PATH` is not configured (`budget-default.log`). The unchanged home limits were then exercised against isolated baseline and final production servers with one Lighthouse sample each, using `/tmp/goodwatch-tv-pass3/budget-home.json`. No budget was loosened.

| Home metric | Baseline | Final | Gate |
| --- | ---: | ---: | --- |
| Performance score | 85 | 85 | Pass, minimum 70 |
| LCP | 3678.491 ms | 3678.393 ms | Pass, maximum 5200 ms |
| TBT | 6 ms | 2 ms | Pass, maximum 150 ms |
| CLS | 0 | 0 | Pass, maximum 0.010 |
| Site/static requests | 25 | 25 | Fail, maximum 24 |
| Scripts | 12 | 12 | Fail, maximum 11 |
| Script bytes | 221.5 KB | 223.7 KB | Fail, maximum 198.0 KB |

The home gate remains **failed**, including an approximately 2.2 KB increase with this pass; there is no additional script request. New eager code is the TV query/focus/machine contract; interaction rendering remains lazy. A single throttled sample does not establish a runtime performance improvement. Full records: `budget-{baseline,final}.log`; `goodwatch-benchmark/results/20261020T113647Z-lighthouse-tv-pass3-baseline` and `20261020T113829Z-lighthouse-tv-pass3-final`.

## Interactive review and authenticated evidence

The independently owned persistent review servers are BEFORE <http://tv-review.localhost:18331/> and AFTER <http://tv-review.localhost:18332/>. BEFORE is the captured pre-pass-1 baseline. The initial AFTER pass-3 snapshot was verified in a separate isolated production-preview build; the subsequent P2 refresh is recorded below. It is a live local review app, not a public deployment or Vite HMR server. Do not repurpose either server or its synthetic-member data.

Historical pass-1/pass-2 local authentication evidence is in `/tmp/goodwatch-tv-auth-review/report.md`; reusable setup is in its `README.md`. It establishes real local session/SSR/account-country/personalized reads using a synthetic account and server-side catalog fixtures. Three recoverable React #421 hydration errors and intermittent immediate Escape at a transition were reproduced on baseline too. Those findings are not clean hydration, production authentication, streaming playback, or live search-role acceptance. No credentials belong in this document.

The independent verifier rebuilt AFTER from its preserved pass-2 copy plus exactly the 21 commit-ready source files. All hashes and the source-patch hash match; committed Title was retained, and unrelated working analytics were excluded. BEFORE retained its source and PID.

Completed real local-auth/full Remix verification on desktop 1920×1080 and short phone 375×667:

- A normal form login establishes the same synthetic-member session on both ports. The nine advertised home/title/Discover/Search/Fingerprint routes return HTTP 200 with member country DE. No injected client loader/search responses were used.
- Remote Q/Right/W, Clear, physical typing, and explicit search work. Typing sends no search; submission sends one request with country DE and saved provider 613. Native SQL search returns captured eXistenZ, whose details/Fingerprint/Back retain result focus without refetching.
- The actual Discover API defaults to On my services and Not seen yet. Everywhere changes server state; Shows returns zero results. The native page size is 40 and there is no false Next button. Query/filter/focus restoration passes. Popular-row details Back also restores movie 157336 at exact offsets 64 (desktop) and 418 (phone).
- Wishlist/watch/rating/settings digests remain unchanged. The three inherited React #421 warnings still occur on signed-in loads; the baseline immediate-Escape caveat is not claimed fixed.

Evidence and resource ownership: `/tmp/goodwatch-tv-auth-review/review-servers/README.md`, `pass3-results.json`, `verification.json`, `shared-session.json`, `running-resources.json`, `after-pass3-source-check.json`, and `after-build.log`. Synthetic login details are held privately by that verifier and handed to the orchestrator separately. Both review servers remain running; only this worker's temporary budget servers on 3440/3441 were stopped, and the temporary baseline `.env` copy was removed.

Limitations: the server fixture has thirteen captured cards, but only eXistenZ has the captured Fingerprint required for native Discover eligibility. Native basic SQL search is real; live TMDB lookup, paid interpretation, and the production ranking index are unavailable, with external server sockets blocked. Thus the fixture proves real session/SSR/account-country and native filter/search behavior, but not multi-page results beyond 40, live ranking quality, production auth, or streaming playback. The separate controlled client-contract matrix supplies pagination/race coverage without making those claims.

## Contribution and preservation

The contribution patch is relative to this pass's original captured working state, not a diff that sweeps up unrelated work. `contribution-files.txt`, `manifest.json`, `contribution.patch`, and `integrity.json` list and verify the exact contribution. `commit-ready.patch` supplies the HEAD-based equivalent for a scoped commit.

Mixed files are `goodwatch-webapp/app/ui/living-room/tv/use-tv-discover.ts` and `use-tv-search.ts`. Their original `useProductExposure` import and exposure block remain verbatim in the working tree. Commit-ready copies remove only those original uncommitted analytics edits; `use-tv-{discover,search}.commit-vs-working.patch` and `mixed-file-integrity.json` show that boundary. Never replace the working hooks with those variants. Working `screens/Title.tsx`, auth, telemetry, transitions, and all other baseline edits are outside this contribution. During packaging, another thread committed `d0937beec5a8634939f70742b6e4549c0c07e2fd`, changing only `docs/research/goodwatch-matcher-naming.md`. That independent change is excluded, as is the later independent `690758a7` addition of `docs/research/yepwatch-architecture-proposal.md`; neither touches a contribution path. There are no unexplained changes to captured tracked files outside this contribution. The original pass-3 baseline remains `4c1cf4b6` and the real index stays clean.

The initial source-only refresh package had 21 paths and SHA256 `9b095ac96cdf130bf35ac9011637012419aecbd6b50b15f33ac27676b28bee31`. That package and its manifest/hashes are archived in `/tmp/goodwatch-tv-pass3/p2-before/`. The current corrected package is described below; documentation edits do not alter its application snapshot.


## P2 review correction: Best match and For you

Independent review (`/tmp/goodwatch-tv-pass3-review/review.md`) found one blocker: entering Best match with For you Off, switching it Off while under Best match, and `sort=match&foryou=0` links could claim Off while retaining taste ordering. The correction follows the existing `useForYouUnderBestMatch` contract in `app/ui/filter-bar/ForYou.tsx` and the glossary:

- Effective Best match displays **For you: On**, regardless of the underlying blending preference. Selecting Best match does not rewrite that preference. Selecting a plain sort directly therefore restores the existing preference.
- Turning For you Off under effective Best match leaves taste ordering and sets `foryou=0`. The TV's cycling controls choose the screen's plain default immediately: **Popular** in Discover and **Relevance** in Search. This adapts the shared page's separate sort-picker flow to the TV's existing single-step controls. No account preference is written.
- The machine and panel share the effective-Best-match check; both screens provide actual `hasTaste` metadata. The existing server still owns effective sort and taste eligibility. No server ranking, standalone Expand, or baseline-failure changes were made.

Focused corrected verification:

- `node --test app/ui/living-room/tv/tv-browse.test.ts app/ui/living-room/tv/tv-browse-render.test.ts app/ui/living-room/tv/tv-machine.test.ts app/ui/living-room/tv/tv-discover-render.test.ts app/ui/living-room/tv/tv-search-render.test.ts`: **245 passed / zero failed** (`p2-focused.log`). Covers entering from Newest/Off, switching Off with either stored preference, deep links, retaining the underlying preference when choosing a plain sort, page reset, focus, and actual Discover/Search filter rendering in both editions.
- `node /tmp/goodwatch-tv-pass3/p2-browser.mjs`: **eight paths each on desktop 1920×1080 and short phone 375×667**, covering both Discover and Search. Labels agree with the outgoing sort/preference and the controlled response's `sortUsed`/`forYou.on`. Under Best match, `foryou=0` remains the underlying preference while the effective display is On; switching Off sends the plain sort and `foryou=0`. These are explicitly controlled taste-bearing responses in fresh guest contexts, not evidence of native personalized ranking. Other non-GET API calls are blocked. Logs/results: `p2-browser.log`, `p2-browser-results.json`; screenshots: `p2-best-match-{discover,search}-{desktop,short-phone}.png` and `p2-plain-off-{discover,search}-{desktop,short-phone}.png`.
- Fresh production build passed (`p2-build.log`). Typecheck remains **179 diagnostics**, with zero added or removed versus the initial final pass-3 check (`p2-typecheck.log`, `p2-typecheck-comparison.json`). The broad suite's known rating failure was not rerun or repaired for this scoped correction.
- Fresh home Lighthouse/budget, unchanged limits, one sample: score **84**, LCP **3681.606 ms**, TBT **5.5 ms**, CLS **0**; same **25 host requests / 12 scripts / 223.7 KB script bytes**, so the inherited gate remains failed. See `p2-budget.log` and `goodwatch-benchmark/results/20261020T120046Z-lighthouse-tv-pass3-p2`. No new dependency or additional request; single-run score differences are not a performance conclusion. Only the owned temporary server on 3441 was stopped afterward.

The corrected package still uses the **original pass-3 captured baseline** `4c1cf4b6`, not the reviewed snapshot as a new baseline. It contains **25 contribution files / 23 source-and-test files**, adding two focused render test files. Both mixed working hooks remain byte-identical to the pre-correction versions, including their original analytics edits; commit variants remain unchanged. Current patches, manifest, hashes and reconstruction checks are regenerated at the original artifact paths. Source-only patch SHA256: `631d23073ebd3d44f0e04d8c59f85f5ac083f0ce3c342533d367c0ca40f66eac`.

The independent review-server owner completed the AFTER-only refresh. AFTER serves `/tmp/goodwatch-tv-auth-review/pass3-p2-webapp`, built from the preserved pass-2 copy plus the 23 corrected paths. All source hashes and patch SHA256 match before and after browser verification; committed Title and the mixed-hook boundaries are preserved. BEFORE stayed running with the same PID and source. Existing synthetic login still works across both ports, and member-domain table digests are unchanged. Both review links remain alive:

- BEFORE: <http://tv-review.localhost:18331/>
- AFTER: <http://tv-review.localhost:18332/>
- AFTER Discover: <http://tv-review.localhost:18332/?tv=discover&all=1>
- AFTER Search: <http://tv-review.localhost:18332/?tv=search>

The owner independently rebuilt the isolated app and reran all eight controlled paths per viewport against refreshed AFTER. An additional independent browser check covers direct Match-to-Popular selection retaining both underlying Off **and On** preferences on both screens/viewports (eight additional paths total). Native full Remix/member checks also passed actual session/DE/provider613 defaults, basic eXistenZ SQL search, filters, details/Fingerprint/Back without refetch, native 40/page with no false Next, and popular-row return offsets. Nine post-refresh routes returned HTTP 200 with the same existing session. No correction-specific defect was found.

Served-snapshot evidence: `/tmp/goodwatch-tv-auth-review/review-servers/p2-refresh/report.md`, `source-check.json`, `p2-browser-results.json`, `direct-sort-results.json`, `pass3-results.json`, `session-post.json`, and `running-resources.json`. The owner preserves all review resources. The native fixture has **no positive taste** and only one eligible Discover title: the Best match checks use explicitly controlled taste-bearing responses and do not establish native production ranking or multi-page catalog behavior. Native member navigation still reports the inherited React #421 warnings; clean hydration is not claimed.

For focused re-review, `/tmp/goodwatch-tv-pass3/p2-correction.patch` contains only the ten files changed since the reviewed working snapshot (five implementation files, three test files, and two docs). The full contribution/commit-ready packages remain relative to the original pass-3 baseline, with current hashes and exact reconstruction in `integrity.json`.

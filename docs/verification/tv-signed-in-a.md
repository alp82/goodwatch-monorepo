# Signed-in TV (design A) and the shared score acknowledgement

The signed-in TV design that the owner approved on October 21, 2026, built on current main. The design source is the throwaway prototype branch `ghostex/25896491` at `5b57b44e` (`goodwatch-webapp/app/ui/prototype-tv-signed-in/VariantA.tsx`), variant A. Nothing from that branch was merged or cherry-picked. Each part was rebuilt on main's own TV code, real APIs and components, and main's intro film.

The owner also asked for the TV's score highlight and transition on the normal taste pages, as shared code. That is the score acknowledgement in the following sections.

## Base and integration

- Base: `acec64ee` (origin/main).
- The three earlier TV passes were never on main. They are on this branch as integration checkpoints, made with `git cherry-pick -x`:
  - `7cb74758` from `9ce3ca77` (pass 1: TV controls, title details, Watch next naming).
  - `ddfc1229` from `4c1cf4b6` (pass 2: signed-in home, Popular).
  - `a54a1417` from `009799b5` (pass 3: Discover filters, pagination, search keyboard).
  - Conflicts kept main's deletions (`connect.tsx`, `ConnectorHelp`), main's `MyLibraryPage`, and main's `useProductExposure` calls in `Title.tsx`, `use-tv-discover.ts`, and `use-tv-search.ts`.
- Design A itself is uncommitted on top of those checkpoints.

## What changed

### Shared score acknowledgement

- `ui/scoring/score-ack.ts`: a pure state machine (idle, saving, held, failed). The first press counts. The title leaves 700 ms after the press, or when the write succeeds if that takes longer. A refused write keeps the title and takes a new answer.
- `ui/scoring/use-score-ack.ts`: binds the machine to time and the save, and gives the line under the title ("Scored 8 · Great", "Not seen · next title", "Couldn't save that. Try again.").
- Used by `/taste/quiz` (`TasteQuizPage.tsx`, `use-taste-quiz.ts`), the taste start on `/taste` (`TasteStart.tsx`), and the TV's Taste screen (`RatingStrip.tsx`, `use-tv-taste.ts`). `ScoreChoices` and `ScoreControl` take an `acknowledged` value. The motion is in `main.css` (`.score-ack`, `.score-ack-leave`, `.score-ack-enter`) with reduced-motion variants.
- `useTasteScoring` now awaits the write. A refused write invalidates user data and throws, so the page shows the failure instead of moving on.

### TV

- **Start** (`screens/Start.tsx`) is a member's home: a Watch next tile with the picks' posters fanned, tiles for Popular, Discover, Search, and Taste, and keys for Your taste, My shows (with its New episodes signal), and What is GoodWatch?. The start page's H1 stays, visually hidden. `MemberHome.tsx` is deleted.
- **Navigation** (`NavBar` in `kit.tsx`): the white G, the screens as tabs, and Menu, on Start, Watch next, Popular, Discover, Search, and Taste. Phones show fewer tabs. Where the navigation takes the top bar's place, the screen's crumb (for example "Funny · Page 1 of 3 · 40 titles") stands over the content.
- **Watch next** (`screens/Tonight.tsx`): up to ten picks (`TONIGHT_PICKS`), one in the spotlight with the GoodWatch score ring, where it streams, and Watch, Trailer, Details, and Another keys. Watch is a real link to the service with analytics data, or the title page's where-to-watch block. The Expand key opens the pick's page, My movies or My shows, as on main. A failed read says "Your picks couldn't load." instead of the empty-Wishlist line.
- **Popular** (`screens/Popular.tsx`, new, member only): a poster wall with the focused title named beside it. Its Expand key opens Discover. The data is pass 2's member-only Popular read.
- **Taste** (`screens/Quiz.tsx`) and **Your taste** (`screens/Taste.tsx`): the quiz with skip and Your taste keys; Your taste offers guests a Sign up key that returns to the TV.
- **Title details** (`screens/Title.tsx`): poster, facts, score ring and source scores, synopsis, a fingerprint preview with its standout readings (`ui/details/fingerprint/standout.ts`), and where-to-watch rows (`whereRows` in `title-extras.ts`, served by `api.tv-title.ts`). On phones the Expand key stands at the end of the details, so it never covers them.
- **Search**: four ideas over the keys. The focus starts on the keys, so OK at once doesn't search for an idea nobody chose.
- **Menu** (`screens/Menu.tsx`): the TV's own screens only, marks the screen on show, and opens on it.
- **Focus and pointer**: pointer focus doesn't scroll the screen, the ring hides while the pointer moves, and the first arrow press only shows the ring (`use-tv.ts`, `kit.tsx`). The pointer boundary is strict (`AIM_PAD = 0`, `pointing-aim.ts`).
- **Trips to full pages**: every trip drops the URL fragment (`withoutFragment`), and `DiscoveryContinuity` doesn't restore scroll for a TV arrival (`openedByTv`), so a full page opens at its top with Back to TV in view.
- `ui/details/fingerprint/area-colors.ts` holds the six areas' order and colors without their words, so Start doesn't load the fingerprint text eagerly. `areas.ts` re-exports both.

### Review fixes

Two independent reviews (Spec and Standards) found four problems. Each fix has a regression test.

- **A held key scored the next title.** The browser repeats a held key's keydown; after the 0.7 s hold, a repeat answered the next title. A repeated keydown now never answers:
  - `isRepeatPress` in `ui/scoring/score-ack.ts` is the one rule.
  - `/taste/quiz` reads keys with `readQuizPress` (`ui/taste-quiz/quiz-flow.ts`): a held score, skip, or picks key is "held". Arrows still repeat on the picks.
  - The TV reads keys with `keyboardKey` (`ui/living-room/tv/room-tv.ts`): a held Enter is "held". Arrows still repeat.
  - `useScoreAck` cancels a repeated Enter or Space on a focused button, so the browser doesn't press a score button again. It leaves text fields alone.
  - Tests: `quiz-flow.test.ts`, `room-tv.test.ts`, `score-ack.test.ts`.
- **The menu opened under the intro film.** The film (`.film-screen`, z-index 25) lies over the TV's canvas, which is its own stacking context, so no z-index inside the canvas reached over it. This was inherited from main.
  - While the menu is open over the film, the canvas comes over the film, and only the menu and its shade show. The film plays on under them (`living-room.css`, "The menu over the intro film").
  - The desktop menu's keys are 54 px, so a member's nine keys and the wordmark fit the 648 px canvas.
- **Watch next took the Remote's two keys as the member's services.** The Remote has keys for two services, filled up with Netflix and Prime Video. Watch now chooses among all of the member's saved services in their account's country, and a guest's among none (`ownedServices` in `tv-home.ts`). Test: `title-extras.test-support.tsx`.
- **A Next episode showed the show's usual runtime.** `pickFacts` (now in `tv-title.ts`) takes the pick. A Next episode shows its own runtime and omits it when unknown, and the stack's cards add the episode code. A show to start keeps "N min episodes", and a movie under an hour reads "45 min". Test: `tv-title.test.ts`.

Found while checking the fixes: on phones, a fixed 158 px corner no longer held the labelled Expand key, so it covered a list's last key (Search's **Next** page key). Lists, search results, Discover, Explorer, and Taste's sides now end their last row with the Expand key (`PhoneFoot` in `kit.tsx`), as Title, Popular, and the rating strip already did.

### Not carried over from the prototype

- No variant switcher, prototype route, demo data, or prototype names.
- Watch next's Expand key keeps main's destination (My movies or My shows). The prototype's `/watch-next` redirects members to `/my-movies` on main (#385), and the redirect breaks Back to TV.
- Match % isn't shown on Watch next or title details, as in design A. The GoodWatch score ring is.

## Verification

These results are for the source in `manifest/fix-round` (HEAD `a54a1417`, index tree `dbfd1a0b`), checked against its hashes before each step. Logs are in `/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/logs/` and `bench2/`.

- **Tests** (`npm test`): 3950 tests, 3940 pass, 8 fail, 1 todo (`npm-test-fix-round.log`).
  - 7 failures also fail on the base, which had 11 failures in 3882 tests (`../tv-a-test-base.log`).
  - The eighth, in `combined-search/title-lookup.test.ts`, is a deadline test in a file this change doesn't touch. It passed 3 of 3 runs alone, and on the base too.
  - The focused TV, scoring, taste, and fingerprint set (774 tests) fails only the base's two rendering tests (`tv-tests-fix2.log`).
- **Type check** (`tsc --noEmit`): 188 errors against the base's 189, and no file has errors that the base doesn't (`tsc-fix-round.log`).
- **Lint** (Biome, per changed file against the base): no new findings in source files. A few test files use `noNonNullAssertion` and `noExplicitAny`, as the repo's tests already do.
- **Build** (`npm run build`, patch-package in the worktree's own `node_modules`): passes (`build-fix.log`). Built at 21:09:07, after the last source change (21:02:12); `build/server/index.js` SHA-256 starts `ff58a553`.
- **Render path budget** (`./bench.sh budget`'s Lighthouse settings and `budget.mjs check`, run locally, `bench2/`): see "Budget" below.
- **Browser, signed in**, on a local Better Auth harness with local data only (`/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/README.md`):
  - `tva-drive.mjs` as a member and as a guest at 1920×1080, 390×844, and 375×667: Start's tiles, the menu, hover without resize, two trips per Expand key to the full page and back (top of page, Back to TV in view, no fragment, focus back on Expand), search ideas, the guest Sign up key, and the intro film.
  - The four review findings, rechecked by the Spec reviewer with their own reproductions (`review/spec-fix-review.md`), and the menu over the film at 1440×900, 1920×1080, 390×844, and 375×667, guest and member (`fixcheck/menu-film.json`).
  - Scoring: rapid taps send one write; a refused write keeps the title; leaving right after a press still sends one write.
  - Search without mocks: the harness runs the basic search (`WEBAPP_ROLE=both`, no search index, no readings). A guest's "the" gives 55 matches, 40 and 15 over two pages.
- **Production build, Search smoke** (`bench2/up-smoke.sh`, `tva-prod-smoke.mjs`): the candidate's production build on local data, with every non-loopback connection refused by a preload. At 1920×1080 and 375×667: page 1 of 40, page 2 of 15 at `page=2`, a title's details and Back to page 2, and two trips to the full Search page (`/discover?q=the&page=2`), each at the top with Back to TV in view and back to page 2. No page errors.
- **Page errors** in the dev harness: React's Suspense hydration warning on member loads, which the base shows too. The Spec reviewer saw two `null useState` errors once, on desktop route trips during Vite's dependency re-optimization (dev only); a fresh run and the production-build smoke had none. One run of the production smoke logged a View Transition abort ("Prepaint layout check failed") that the second run didn't repeat.

## Budget

`./bench.sh budget` can't run against this candidate as is: it measures the generator against a deployed site. The same Lighthouse settings (13.5.0, mobile, CPU slowdown 2.7, five runs) ran locally on both builds, alternately, with `budget.mjs check` against `urls/budget.json`. All 40 runs were valid. Results: `bench2/budget-check.txt` and `bench2/budget-compare.md`.

- **The local numbers can't pass or fail the budget.** Both builds fail the same absolute lines (requests, scripts, script and image bytes), because the local setup isn't the production one:
  - It has no static hostname, no 103 Early Hints, and a local Lighthouse host. The CPU benchmark reads about 4,700 instead of the generator's 1,170.
  - The local data has 134 movies, 72 shows, and 12 episodes, and no people, images, translations, or videos.
  - The person and share-list surfaces can't run.
- **Candidate against base** (medians of five, same data, same host):
  - **Home:** 23 scripts instead of 22, and 255.0 KB of script instead of 245.4 KB (+9.6 KB): Start (+4.2 KB), the fingerprint icon as a chunk (4.2 KB), and the shell (+1.1 KB). LCP 2.1 s and score 99 on both.
  - **Movie and show:** 37 scripts instead of 34, +3.2 KB. Shared code the TV now uses (`RatingChips`, `band`, the icon) moved out of `detailsMeta` into chunks of its own: 3 more requests, about the same bytes. LCP and score the same.
  - **Discover:** 30 scripts instead of 29, +1.6 KB. LCP and score the same or better.
### Production baseline and first-view allowance, 2026-10-21

The earlier October 20 home-only numbers were local measurements, not deployed production evidence. Before shipping, `./bench.sh budget` measured the live public site on the generator: three valid runs for each of six surfaces, CPU slowdown 2.7. Read-only deployment checks before and after confirmed healthy `SOURCE_COMMIT=acec64ee4610a21a92541edf64f4c27e32663fa4`, the exact candidate base. The existing public share list was reused without creating data.

The following limits apply the first-view-script exception in `goodwatch-webapp/AGENTS.md`. Baseline medians are measured production values; candidate deltas come from the paired local builds. The sum is a projection, not a deployed candidate measurement. Counts have one request/script of headroom; bytes have about 5% rounded up to KiB, without lowering an existing cap.

| Surface | Base scripts / bytes / site-static requests | Candidate delta scripts / bytes / requests | New caps scripts / bytes / requests |
| --- | --- | --- | --- |
| Home | 22 / 260800 / 42 | +1 / +9799 / +1 | 24 / 284672 / 44 |
| Movie | 28 / 311605 / 43 | +3 / +3291 / +3 | 32 / 330752 / 47 |
| Show | 28 / 311660 / 44 | +3 / +3281 / +3 | 32 / 360448 / 48 |
| Discover | 28 / 286599 / 37 | +1 / +1667 / +1 | 30 / 303104 / 39 |

Start tiles, the fingerprint mark and navigation belong on the first view. Existing title-page rating chips, band and icon now share chunks with the TV, adding requests rather than a new eager interaction-only panel. Discover shares the first-view code. The fingerprint vocabulary remains excluded from Start through `area-colors`. These reasons justify the scoped script and associated request allowances in the same implementation commit. The much larger inherited increase from the old caps is not attributed to TV A. Show's byte cap stays unchanged; person and share-list limits stay unchanged because their candidate deltas were not locally measured.

**The production baseline fails the budget on five surfaces; only share list passes. This is not a full budget pass or waiver disguised as one.** Apart from the adjusted script/request lines, inherited failures are:

- Home: HTML 24740 > 20480 bytes, images 78 > 28 and 748611 > 378880 bytes, blocking requests 4 > 2, total 1074064 > 768000 bytes, TBT 517.5 > 150 ms.
- Movie: TBT 328 > 150 ms.
- Show: TBT 415.5 > 150 ms.
- Person: HTML 33537 > 32768 bytes, scripts 16 > 13 and 202755 > 197632 bytes.
- Discover: HTML 29810 > 29184 bytes, images 34 > 18 and 970317 > 460800 bytes, total 1302787 > 848896 bytes.

No HTML, image, font, blocking, total-byte, timing, CLS or score limits changed. All six baseline surfaces pass existing LCP, CLS and score lines. The release proceeds with the independently reproduced inherited failures documented; postdeploy smoke and the same six-surface generator budget must check the actual candidate and distinguish any new regression.

Evidence: `/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/release/budget-decision.md`, `live-baseline-exact.json`, `candidate-deltas.json`, and the 18 original Lighthouse reports under `release/goodwatch-benchmark/results/20261021T200812Z-lighthouse-tv-a-live-base`. The observer was started before the push. No local production-connected app server was used for these measurements.

## Shipping

Main deploys automatically: a push to main queues a Coolify build of the webapp. CI covers only the auth workflows, so the checks in "Verification" stand in for it.

1. Commit the changes on `feat/tv-signed-in-a` (the three integration checkpoints are already commits; the staged deletion of `MemberHome.tsx` is intended).
2. If origin/main moved past `acec64ee`, rebase and rerun `npm test`, `npx tsc --noEmit -p .`, and `npm run build` in `goodwatch-webapp`.
3. Before pushing, start the watch so it sees the push: `cd goodwatch-benchmark && ./bench.sh deploy-watch`. It waits for main to move on GitHub, then sends 2 requests per second to https://goodwatch.app and reads the containers' events and logs on the serving host, read only, until the old container is gone. With a deploy already running: `./bench.sh deploy-watch --now`.
4. Push to main. GitHub's webhook can arrive up to about 20 minutes late; don't push an empty commit to retrigger it.
5. When the queue is empty, check the deployed commit: `./bench.sh smoke --commit "$(git rev-parse origin/main)"`. It waits for the one healthy `gk4owk8-*` container whose `SOURCE_COMMIT` is that commit, then checks the smoke pages and the startup log.
6. Open https://goodwatch.app signed in and as a guest: Start, Watch next, Popular, Taste, Search, and the menu over the intro film (`?tv=about`).
7. Run `./bench.sh budget` against the exact deployed commit and compare all six surfaces with the measured base above; report inherited failures separately from candidate regressions.

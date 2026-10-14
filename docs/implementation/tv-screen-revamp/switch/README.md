# Slice 13: the switch and the cleanup

> Since October 14, 2026 the webapp reads no `REC_*` feature flag: what `on` did is what the site does
> (`docs/implementation/tv-screen-revamp/rec-flags/`). The flags here record how this was built and run then. A server
> of a later commit needs none of them.

`/` is the new TV and the old one is gone. Proof for [the plan](../README.md), slice 13. Taken on October 14, 2026,
on `feat/tv-slice-13-switch`, branched from the integration branch at `9615ca70`. `origin/main` (`8cf806a1`) was
already merged into it, so no change on `main` touched the files this slice replaces.

## What changed

**The start page** (`routes/_index.tsx`): the loader is `tvHomeLoader`, and the component is `TvLivingRoom`.
`shouldRevalidate` is the preview's. A change of the TV's params alone never reruns the loader, but asking again
for the same address does, so Tonight and My shows are new after a member's write on the TV. One stylesheet, and the
preconnect to `image.tmdb.org`. The meta block is unchanged, byte for byte.

**The pool** is no longer asked for after every first paint. The TV asks for it itself (`use-tv-pool.ts`): at a
guest's first interaction, or when a member's Discover or service tile first has the focus. Its answer is what the
TV reads: `{ member, suggestions, savedServices, choiceArt }`. The pairs, the Wishlist's cards and the services
catalog are gone, and so is a Wishlist read for every member request. `/api/living-room/picks` answers only
`?view=pool`; any other request gets a 404.

**Caching** (`server/living-room/tv-loader.server.ts`): a guest's page keeps the policy `livingRoomAuth` chose, the
shared one, and is `no-store` while the start titles are missing (the incomplete-page policy). A member's page stays
private. The preview's forced `private, no-store` went with the preview.

**One stylesheet**: `tv/tv.css` is folded into `living-room.css`, and its mask paths are one level shorter. Dropped
as dead: the old first-paint mirror of `layoutRoom` and `layoutPhone` with its `--lr-reserve`, the old TV's power-on
sweep, `.tv-glass`, and `.lr-boot-still`. Every class left in the file is used by the app; the classes built in
code (`tvr-f-*`, `tv-mark-<id>`) were checked by their parts.

**The Remote** presses the room's keys (`RoomKey`, `tv/room-tv.ts`) through one `press` prop. It loses the old
TV's fixed Netflix and Prime pair, `APP`, and the step fallback of its arrows. `TvRoom.tsx` no longer translates
the old actions.

**Deleted**:

- The old TV: `tv-flow.ts`, `tv-flow.test.ts`, `use-tv-flow.ts`, `TvScreens.tsx`, `PhoneTvScreens.tsx`,
  `TvQuiz.tsx`, `LivingRoom.tsx`, `PhoneLivingRoom.tsx`, `HomeDoors.tsx`, `home-doors-code.tsx`.
- `tv/tv.css` (folded in), `routes/home-preview.tsx`.
- The old loader, `server/living-room.server.ts`. Also `server/living-room/wishlist.server.ts`, which only it read,
  and `domain/living-room.ts` (`LivingRoomPicks`).
- `routes/api.living-room.services.ts`, and `routes/api.living-room.ts`: nothing in the app, the benchmark or the
  docs calls it ([decision 7c](#for-the-owner)).
- The picks form of the picks route (`getLivingRoomPicks`). `picks.server.ts` keeps `rankOf` and
  `LivingRoomUnavailable`.
- `homeDoorsOf` and `getHomeDoors` (`server/home-doors.server.ts`), and `livingRoomServices`
  (`server/living-room/data.server.ts`), which only the deleted parts used.
- From `living-room-data.ts`: everything but `StartTitle`.
- From `room.ts`: the old layouts and turn functions. It keeps the photos and the Remote's numbers. The old layouts
  lived on in `ui/prototype-watching/old-room.ts` (below), which was removed with the old prototypes.

**Changed with it**:

- `server/tonight.server.ts` takes `DOOR_HREF` from the new machine (`tv/tv-machine.ts`). Its test now asserts
  the three addresses.
- Two server tests that read the doors (`my-pages.test.ts`, `newly-available.test.ts`) read what the doors were
  built from (`TonightParts`) and the TV's `memberHome` instead. The same facts are asserted.
- **The member harness** (`/prototype/my-library-real`) loses its old `page=home`, the old room with the doors.
  Its Home link opens `/prototype/my-library-real/tv`, the new TV's member harness, which is unchanged except for
  its stylesheet.
- **Four old prototypes** (`/prototype/watching`, `watching-2`, `watching-3`, `new-episodes`) framed their variants
  in the old room. They got the old geometry from `ui/prototype-watching/old-room.ts` (a prototype file, out of
  every build) and passed the Remote its new props. They were removed after the TV revamp merge (`be36991b`);
  their history is in git.
- `CONTEXT.md`: TV screen names its new examples. The New episodes signal, Newly available and Recently landed now
  name the TV's My shows tile and Tonight, where they named home's doors. Decision 6's "New on <service>" on Tonight
  is not built, so the glossary does not claim it.
- `docs/cache-identity.md`: the services endpoint has left the rules and the inventory (a sentence says when);
  the pool's rule names `?view=pool`.
- The benchmark: see [The budget](#the-budget).
- The slices' drive scripts (`*/drive.mjs`) open `/`, and the route's data is `routes/_index`.

## Run it

```
cd goodwatch-webapp
npx patch-package          # npm ci does not apply patches/
npm run build              # or, to compare builds: SENTRY_RELEASE=compare npx remix vite:build && node scripts/precompress.mjs
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production PORT=3213 REC_TASTE_MATCH=on REC_FILTER_BAR=on \
  REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on \
  npx remix-serve ./build/server/index.js
```

That is a production build without services. With Redis in the environment it would publish its build to
production Valkey. Run it without a `.env`; a worktree has none. The member harness needs a dev server without
services (`npx remix vite:dev --port <port>` with the same flags and no `.env`). For real data, use a dev server
with the main checkout's `.env`, `APP_ORIGIN` unset and `REDIS_COMMAND_TIMEOUT_MS=60000`: a pure reader.

```
PLAYWRIGHT=<folder>/node_modules/playwright-core/index.mjs BASE=http://localhost:3213 node old-addresses.mjs
```

## Proof

### Tests, types, lint, build

- `node --test` on `app/ui/living-room` and `app/server/living-room`: 644 tests, 644 pass, after one test followed
  the stylesheet (the drawn marks' mask path). `app/ui/explorer`, `app/ui/taste` and the two changed server tests:
  70 pass.
- `npm test`: 2,298 tests, 2,297 pass, 0 fail, 1 skipped (the cross-process cache test, which needs a throwaway
  Valkey cluster).
- `npx tsc`: 212 errors, the baseline. None is in a file this slice touches.
- `npx biome lint` on the 39 changed TypeScript files: clean. The changed files are formatted by hand. The three
  test files were not formatted before either.
- `npm run build` (`remix vite:build` and `precompress`): passes. No prototype file is in the build.
- The benchmark's `scripts/budget.test.mjs`: 16 pass, one of them new for the LCP line's list.

### The first view's scripts

`SENTRY_RELEASE=compare npx remix vite:build` and `scripts/precompress.mjs` for three builds: `origin/main` at
`8cf806a1` (the old TV), the integration branch at `9615ca70`, and this branch. Counted by
`../tonight-title/first-view.mjs`, raw / gzip / Brotli bytes.

| Page | `origin/main` | This branch | Difference |
| --- | --- | --- | --- |
| `/` | 15 files, 859,790 / 279,634 / 242,872 | 10 files, 670,358 / 221,275 / 191,566 | -5 files, -189,432 / -58,359 / -51,306 |
| The Discover page | 31 files, 1,091,004 / 362,632 / 316,326 | 31 files, 1,094,236 / 363,381 / 317,047 | +721 Brotli |
| A movie's page | 20 files, 857,934 / 284,249 / 244,994 | 20 files, 859,154 / 284,651 / 245,301 | +307 Brotli |
| A show's page | 20 files, 858,486 / 284,538 / 245,262 | 20 files, 859,706 / 284,938 / 245,570 | +308 Brotli |
| Explorer | 17 files, 880,812 / 299,046 / 260,768 | 17 files, 883,623 / 299,587 / 261,283 | +515 Brotli |
| Taste | 23 files, 956,829 / 308,737 / 267,796 | 23 files, 956,588 / 308,636 / 267,797 | +1 Brotli |

- **`/` against the old TV:** `framer-motion` (35,848 Brotli), `WatchNextHero` (4,379), `labels` (5,183),
  `use-taste-quiz` (2,733), the mutation hooks' `user-data` (1,467) and `fingerprint` (848) left the first view.
  The route's own chunk went from 26,043 to 24,924 Brotli. It holds the new TV's first view, with the Remote. One
  small chunk is new (`_index`, 397), and so is `meta` (1,535), which the route's meta block uses.
- **The other pages** carry what earlier slices added on the branch: the title page's streaming highlight
  (`detailsMeta`, +415 Brotli) and Discover's Theme and Style filters (`SnapSheet`, +4,743, `moods`, +1,307).
  Against the integration branch, this slice took bytes off every page. The shell went from 55,660 to 55,247 Brotli
  (-413), and Discover lost 1,260, a movie's page 422, a show's 418, Explorer 1,162 and Taste 717.
- **`/` against `/home-preview` on the integration branch**: 12 files and 196,839 Brotli, now 10 files and 191,566.
  The Remote, `moods` and `fingerprint` joined the route's chunk, and the shell is smaller.

### Lighthouse against the budget

`lighthouse` 13.5.0 with `goodwatch-benchmark/lighthouse/run.sh`'s flags (mobile, CPU slowdown 2.7), three runs
each. Both sides were production builds without services on this machine, one after the other, and checked with
`scripts/budget.mjs check` against `urls/budget.json`'s home. The full tables are in
[lighthouse-budget.md](lighthouse-budget.md).

| Line | Budget | `origin/main`, the old TV | This branch |
| --- | --- | --- | --- |
| HTML, compressed | max 20.0 KB | 17.1 KB | 17.6 KB |
| Requests | max 37 | 41, fail | 24 |
| Scripts | max 16 | 24, fail | 11 |
| Script bytes | max 256 KB | 617.8 KB, fail | 195.3 KB |
| Image bytes | max 370 KB | 145.2 KB | 91.4 KB |
| Render-blocking requests | max 2 | 2 | 2 (3 on `/home-preview`) |
| Third-party origins | max 1 | 1 | 0 |
| Total bytes | max 750 KB | 854.0 KB, fail | 379.2 KB |
| LCP | max 6,050 ms | 3,982 ms | 3,308 ms |
| TBT | max 150 ms | 255 ms, fail | 18 ms |
| CLS | max 0.01 | 0 | 0 |
| Score | min 63 | 78 | 88 |
| LCP element | either photo | the room photo, 3 of 3 | the hand photo, 3 of 3 |
| Result | | **fail** (5 lines) | **pass** |

- The old TV fails here, but production has passed: production splits the files onto the static hostname and has a
  warm page cache, and this machine had other load (CPU benchmark 1,820 for main's runs, 1,362 for the branch's).
  Both columns had the same conditions as far as this machine allows.
- **The HTML without start titles.** Neither server had the title snapshot. With it, production's `/` measured
  17.8 KB on October 11, 2026, and the branch adds about 0.5 KB. That is about 18.3 KB, under the 20 KB line but
  not measured. The one third-party origin of the old TV's runs was Google's tag (`www.googletagmanager.com`, two
  requests). The new TV's runs had none.

### The budget

`goodwatch-benchmark/urls/budget.json` changes one line, by the owner's decision, and no limit:

- **`lcp_element`** names either of our own photos: the room (`/assets/room-phone-`) or the phone's hand
  (`/assets/hand-`). With the Remote in the hand on Lighthouse's phone, the hand photo is the largest picture. The
  point of the line is that a TMDB picture is never the LCP. `contains` takes a list now (`scripts/budget.mjs`,
  `lcpMatches`, with a test), and the report prints the alternatives.
- **The smoke check of the pool** (`smoke/urls.json`) reads `savedServices` and `choiceArt`. `catalog` and `pairs`
  are gone.
- **The captured page view of home** (`README.md`): the capture loads the page and touches nothing, so it no longer
  holds `POST /api/living-room/picks?view=pool`. The replay rule stays for a capture that has it. Page views of home
  from before the switch are not comparable with later ones.
- `docs/benchmarks/viral-spike-render-path-budget.md` records the line's reason.

### Caching, by response headers

| Request to `/` | Server | `Cache-Control` | `Vary` |
| --- | --- | --- | --- |
| A guest, `GW-Cache-Identity: anon;US;en` | dev server reading production, 16 start titles | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity` |
| A guest, no identity header | the same | `private, max-age=0` | `Accept-Language` |
| A guest's `?_data=routes/_index`, with the identity | the same | the shared policy above | `GW-Cache-Identity` |
| The auth cookie `sb-<ref>-auth-token` (an invalid session, cleared by `Set-Cookie`) | the same | `private, no-store` | |
| The same on production (`main`) | goodwatch.app | `private, no-store` | |
| A guest without start titles (the snapshot not loaded) | production build without services | `private, no-store` | |
| A guest's pool, `POST /api/living-room/picks?view=pool` | dev server reading production | `private, no-store` (21 suggestions, 18 pictures) | |
| The member harness, `/prototype/my-library-real/tv?member=six` | dev server without services | `private, max-age=0`, the route's default | `Accept-Language` |

A cookie named after another project's ref is not an auth cookie, and the app treats it as a guest. That is right,
and the same on `main`. No member signed in anywhere. The member's private policy is `livingRoomAuth`'s for a
`user`, which this slice did not change. The harness route has its own loader, so its header proves nothing about
`/`. `/api/living-room`, `/api/living-room/services` and `/home-preview` answer 404, and the picks form
(`?mood=funny`) does too.

### SEO (docs/verification/235-living-room-seo.md, run again on `/`)

On the production build without services, on the dev server reading production (with the 16 start titles), and on
goodwatch.app for the old TV:

| Check | `main` on goodwatch.app | This branch |
| --- | --- | --- |
| Status | 200 | 200 |
| Same HTML for a browser, Googlebot and an iPhone | yes | yes (both servers) |
| H1s in the HTML | 1 (the phone's copy was no H1) | 2, one per edition. CSS shows one in every window, before and after hydration (slice 12's `seo` mode, 18 of 18 checks at five window sizes) |
| Canonical | one, `https://goodwatch.app/` | the same |
| Robots | `index, follow` | the same |
| Title, description, alternates `en` and `x-default`, og:image | as before | identical |
| JSON-LD | Organization, WebSite, WebPage | the same |
| Start titles linked | 16 | 16 (0 without the snapshot) |
| Hubs linked | Discover, Explorer, Taste, Movies, TV shows, How it works | the same |
| A TV-state address (`/?tv=discover&mood=funny&utm_source=x`) | the root canonical | the root canonical |
| `/living-room?tv=moods` | 301 to `/?tv=moods` | 301 to `/?tv=moods` |
| Stylesheets | 2 | 2 |

### Old addresses land on the mapped screens

`old-addresses.mjs` against the production build: each address the old TV wrote must show what its new address
shows, item for item, at 1440 x 900 and at 390 x 844. **32 of 32**:

| Old address | Shows | |
| --- | --- | --- |
| `/?tv=picks&mood=funny`, also with `&from=new&service=Netflix` | `/?tv=discover&mood=funny` | Discover's Funny titles |
| `/?tv=picks&mood=heavy` (a mood the TV no longer offers) | `/?tv=discover` | Discover's Moods |
| `/?tv=moods`, `/?tv=moods&refine=1&mood=cozy` | `/?tv=discover` | |
| `/living-room?tv=moods` | 301 to `/?tv=moods`, then `/?tv=discover` | |
| `/?tv=picks`, `/?tv=picks&from=wishlist&service=Netflix`, `/?tv=services`, `/?tv=this-or-that` | `/?tv=tonight` | |
| `/?tv=quiz&step=picks&goal=10&page=1` | `/?tv=quiz` | |
| `/?tv=title&title=1000000000603`, `…2000000001399` | `/?tv=title&title=movie-603`, `show-1399` | the catalog's number becomes the key |
| `/?tv=title&title=603` (not a catalog number) | `/` | home |
| `/?tv=about` | `/?tv=about` | |
| `/living-room` | 301 to `/`, home | |

The address is not rewritten on arrival: the machine reads the old params (`readTvState`), and the next screen
change writes the new ones. `tv-machine.test.ts` ("old addresses") checks the same mapping without a browser.

### Slice 12's budgets drive, one round, on `/`

`ROUNDS=1 PROFILE=0,2 node ../budgets/drive.mjs budget` against the production build: **8 of 8 checks**. Long tasks
over 50 ms:

| Profile | Pointing | Focus moves | Screen changes | Slowest interaction |
| --- | --- | --- | --- | --- |
| Desktop, GPU | none | none | none | 104 ms |
| Phone, CPU slowed 4 times | none | 72, 66, 54, 53 ms | 65, 67 ms | 136 ms |

Slice 12 counted 9 and 4 such tasks on the phone after its memo. That was another round count on another day, so
these show no regression but are not a comparison. Its `seo` mode is above.

### Slice 3's home drive on `/`: stale since later slices

`node ../home/drive.mjs checks` (the script is retired and deleted; the screenshots left alone) on a dev server without services stopped at the same
step with 35 failures. The integration branch's own copy, run against its `/home-preview` on the same kind of
server, failed the same 35 checks and one more, and stopped at the same step. So the failures are not this slice's.
The script still expects slice 3's TV:

- a picture on home and posters on Discover's tile, which need the start titles and the pool;
- letter shortcuts (S, H, M) on the search screen, where letters type since slice 10. From there every later check
  is off, and the walk stops when the Taste tile is not on screen.

Bringing the drive up to date is left open (see below). What it covered is covered by the later slices' drives and
by this slice's checks: the old addresses, the H1s, the HTML and the menu (`tv-machine.test.ts`, the render tests).

### No import of a deleted file, no `home-preview`

A search of `goodwatch-webapp/app`, `vite.config.js`, `goodwatch-benchmark/scripts` and `docs` finds no import of a
deleted module, no `tv/tv.css`, and no `APP` from the Remote. `home-preview` is left only in docs history: the
earlier slices' notes and their recorded `checks.json` (`budgets`, `discover`, `expand`, `explorer`, `home`,
`my-shows`, `pointing`, `room`, `search`, `services`, `taste`, `tonight-title`), slice 12's verification documents
(`docs/verification/tv-screen-revamp-*.md`), and the plan. Comments in two old prototypes still name files they were
copied from (`TvScreens.tsx`, `HomeDoors.tsx`).

## Kept, although the plan said otherwise

- **`room.ts` stays**, slimmed. The new TV still reads its photos, the hand and the lip from it
  (`room-layout.ts` keeps copies of the numbers, checked by `room-render.test-support.tsx`). Only its old layouts
  went.
- **`server/home-doors.server.ts` keeps its name.** It holds `getTonightParts`, which Tonight, My shows and
  Tonight's pick read. Only the doors' shape went.
- **`living-room.css` keeps `.lr-boot-*`**: the new TV's boot (`tv/kit.tsx`) uses them.

## For the owner

1. **Decision 7c:** `/api/living-room` is deleted with `/api/living-room/services`, because nothing in the app or
   the benchmark calls it. Cloudflare's analytics cannot tell whether something outside does: no `/api/` request
   of the site shows there, not even the pool's. A revert of this file is all it takes to bring it back.
2. **Decision 6** is still open: the TV's My shows tile carries the New episodes signal, but Tonight does not say
   "New on <service>" for a title that landed. A landed title leads Tonight's movies and the shows to start.
3. **The home drive of slice 3** failed since slice 10. Retired and deleted, with its `checks.json`; the later
   drives cover home.
4. **Old prototypes:** `/prototype/watching`, `watching-2`, `watching-3` and `new-episodes` ran on a copy of the
   old room's geometry. Removed, with `ui/prototype-watching/old-room.ts` and their fixtures; history is in git.
5. **For slice 15 (the `REC_*` flags):** the old loader's `isEnabled("tracking")` went with it. The new loader reads
   a member's Tonight and My shows without asking `REC_TRACKING`. The TV itself reads one flag:
   `tv/screens/ShowEpisode.tsx` (`useFeature("tracking")`) marks a show's next episode on its title screen only with
   tracking on. The start page also depends on the shell's `REC_NAVIGATION` (the dock, and the room's height with
   it, `.lr-docked`), and on the pages the TV expands into: `/my-shows` is not found without `REC_TRACKING`
   (`routes/my-shows.tsx:39`), Discover, Explorer and Taste on theirs. So slice 15 must keep what `on` does in these
   places. Before it, check that production runs with `REC_TRACKING` on: otherwise My shows on the TV, which this
   slice puts on `/`, expands into a page that is not found.
6. **After the merge:** `./bench.sh budget` and `./bench.sh smoke` against production, at once (the plan's proof
   after the merge). The first production numbers of the new TV come from there, the HTML with start titles among
   them.

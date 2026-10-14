# Slice 9: My shows

A member's My shows on the new TV: the shows with a Next episode, then the shows to start; the New episodes signal
on home's My shows tile and on the screen; a show opens its title screen, where Seen it marks the Next episode of a
show the member is midway through. And slice 3's leftover: the menu and What is GoodWatch? on a phone. On
`/home-preview`. Proof for [the plan](../README.md), slice 9. Taken on October 13, 2026, and again on October 14
after the merge of the integration branch at `8d20ff74` (mini Explorer, Taste, the quiz, the rating strip): see
[After the merge](#after-the-merge).

## Run it

One dev server of `goodwatch-webapp` at a time, with every `REC_*` flag on.

**A member, on the tracking harness** (a server without any service; it refuses one with `CRATE_HOSTS`):

```
cd goodwatch-webapp
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on node_modules/.bin/remix vite:dev --port 3292
```

`http://localhost:3292/prototype/my-library-real/tv?member=six&session=member&tv=shows`. `member=new` has shows
with new episodes; `landed=show` puts a show on one of the member's services.

**The harness's member session.** Without a parameter the harness's browser is a guest's: a title's marks go to
the browser's storage, as slices 3 and 5 use it. With `session=member` the page sees a signed-in member (who does
not exist), and the requests for the member's own data go to the harness's API, which answers from the dev
server's in-memory Crate with the app's own server functions: `/api/user-data`, `/api/tonight`,
`/api/new-episodes`, `/api/update-scores`, and, new, `/api/tracking/show` (the read and the actions of a show's
tracking). Slice 8 built the same session as `session=on` for its ratings; since the merge the two are one, and
either word turns it on. Switching between sample members starts a member over: the harness holds one at a
time.

**A guest, on real data**, for the shots of the menu and What is GoodWatch? only. The server reads production
Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on node_modules/.bin/remix vite:dev --port 3293
```

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs MEMBER=http://localhost:3292 node drive.mjs checks
SHOTS=member MEMBER=http://localhost:3292 node drive.mjs shots
SHOTS=guest GUEST=http://localhost:3293 node drive.mjs shots
SHOTS=sheets node drive.mjs shots
```

`drive.mjs checks` needs the harness's server alone (a guest's pages come from it too, without pictures) and
writes `checks.json`; `PARTS=walk,signal,edges,sizes,guest` runs some of the checks. The shots are split so the two
servers never run together.

**The writes.** The walk marks episodes watched. Those requests go to the harness's API and nowhere else. The
script stops every other request that is not a GET in the browser and counts it (a guest's three reads by POST
pass), and stops every request to another host. It signs in nowhere. Nothing of this slice was ever sent to
production.

## How it is built

- **The screen** (`tv/screens/Shows.tsx`), a chunk asked for while My shows' tile has the focus. The prototype's
  list: the focused show's name and one line over a row of posters that pages sideways, the show's backdrop
  behind. Since the merge it is drawn by the list every app shares (`tv/TitleList.tsx`, slice 8), which gained
  three optional fields for it: words on a poster, a mark in its corner, and what a screen reader hears. Its
  rows and words are in `tv/tv-shows.ts`, pure and tested.
  - A show with a Next episode says "Next: S2 E4 · the episode's name · 50 min · 6 episodes left"; a Seen show
    with new episodes "2 new since you saw it". Its poster says "S2 E4 · 50 min".
  - A show to start says "To start · 2 seasons · 96% match · On Disney+". Its poster says "Start".
  - On the phone a poster is too small for words: the line of the focused show says them.
  - A member without a show: "No show for tonight. Want to See on a show puts it here to start. …", in the My
    shows page's words.
- **The list is the member's loader's**, as the plan says: `TvHomeData.shows`. The loader's shape gained three
  fields, all optional: what is left of a show (`left`), whether that counts new episodes of a Seen show
  (`caughtUp`), and a show to start's seasons.
- **The signal** (`tv/use-tv-shows.ts`). It is the site's own, read with `useWhatsNew`, which the navigation
  mounts on every page: no request more. Shows that are newly on one of the member's services join it, each
  show counted once (`showsWords`, as the hub's My shows tile does it).
  - Home's My shows tile carries the number in the signal's sky blue, and the home says what is new while the
    tile has the focus ("New in 4 shows."; one show is named).
  - On My shows the line under the screen's name says the same, and a show the signal counts has "New" on its
    poster.
  - The hook runs in `ShowsData`, a component of the screen's chunk that the scene mounts for a member
    ([How a screen loads its data](../tonight-title/README.md#how-a-screen-loads-its-data)). So a member's page
    asks for the screen's chunk right after it is up; a guest's never does.
- **Seen it on a show the member is midway through** (`tv/use-tv-episode.ts`).
  - **The mutation.** Nothing in the app marks one episode from outside the title page: the My shows page has
    no Watched button, on purpose, and "I watched it" on Watch next is the whole show's Seen press. The one
    mutation that marks an episode is the show page's tracking store (`ui/tracking/store.ts`): it applies
    `{ type: "watch", season, number }` to its copy at once and sends it to `POST /api/tracking/show` with an
    id made in the browser. The store belongs to the member and the show, not to a page, so the TV uses it as
    it is. The title's page behind the Expand key reads the same store and shows the tick the TV made.
  - **Which episode** comes from the same read the show's page makes (`GET /api/tracking/show`), by the date on
    the member's device. It is asked for only when the member's data says the show is Watching or Seen: a show
    not started, on hold or dropped costs no request.
  - **The rule** (`episodeToMark`): the Next episode of a Watching show, or of a Seen show with new episodes.
    On hold and Dropped keep slice 5's Seen it (the rating): a watch would end a status the member chose.
  - **The key** reads "Seen S2 E4". OK marks that episode, the TV says "S2 E4 seen", the screen stays and the
    key names the episode after it, so one press is one episode. After the last aired one the show is Seen:
    the TV says "S2 E8 seen, every episode watched", and the key asks how the show was, as on any title.
  - **In the machine:** one field of the context (`nextEpisode`), one effect (`seen-episode`), one branch.
  - **A chunk of its own** (`tv/screens/ShowEpisode.tsx`): only a member on a show's title screen asks for it,
    and it brings the tracking store.
  - **The loader runs again** once the server has stored the watch, so My shows and Tonight name the next
    episode and a finished show leaves the list. The router drops such a read when a step on the TV falls into
    it; the scene asks again, twice at most, until the loader's data is new.
- **The menu and What is GoodWatch? on a phone.** Their keys take their height from `keySize`, as every other
  key does: 55 to 67 canvas px, which is 44 px on the phone's screen.
  - *The menu on a short phone* (375 x 667): five keys fill the picture, so the word "Menu" over them is left
    out there (`menuLayout`). The menu's name is read out either way. The gaps would narrow next, down to 4 px;
    no phone of the table needs it.
  - *What is GoodWatch?*: its words start under the bar's keys (84 canvas px from the top, as the rating's do).
  - *The menu lies over the screen under it.* The menu's layer had no place in the stacking order, so a
    screen's focused tile and its bar's keys, which are raised, were drawn over the menu's keys. It is raised
    over both now. This was there since slice 3 and shows more with taller keys.

## What the checks say

521 checks pass, none fail.

- **The walk, twice:** a member at 1920 x 1080 and 390 x 844 on the harness. After every step the script reads
  the TV's state from the page.
  - **Nothing on arrival:** the code that marks an episode and the show page's tracking code are not asked
    for, no show's tracking is read, nothing is written.
  - **The tile:** the home names My shows, says "Your next episodes." and shows one of the member's shows.
  - **My shows:** OK on the tile is one history entry. Three shows with a Next episode, three to start, the
    bar; the focus on the first. The name, the line and the picture follow the focus (`w1280` on the desktop,
    `w780` on the phone); the row pages the last show into the picture; Right on the last show stays; Up
    reaches the bar and Down returns. No focus move adds a history entry.
  - **A show midway through:** its title screen is named at once from My shows. The show's tracking is read
    once, and looking writes nothing. The key reads "Seen S1 E4". OK sends one request, to the harness:
    `{ id: 101, event: { type: "watch", season: 1, number: 4 }, actionId }`, which the harness applied. The TV
    says "S1 E4 seen", the key reads "Seen S1 E5", the screen and the focus stay, and the page's loader runs
    again.
  - **One press an episode:** the Remote's OK key marks S1 E5, the pointer or a finger on the key S1 E6, the
    last aired one. The TV says "S1 E6 seen, every episode watched" and the key reads "Seen ✓". Three presses,
    three watches in order, each with its own id, each applied, no history entry. Asked directly, the harness
    holds the show as Seen with six episodes watched.
  - **With no episode left** the key asks how the show was, and sends neither an episode nor a watch.
  - **Back on My shows** the show has left the list, the next three shows to continue are there, and the focus
    starts on the first.
  - **A show to start:** its key says "Seen it" and its tracking is not read. Seen it asks how it was and sends
    the show's Seen press, the watch every title surface sends (slice 5). The script stopped that request in
    the browser.
  - **Nothing else:** no other write was tried, no My shows visit was recorded, no request left the machine
    but the site's own telemetry, which was stopped, and nothing is in the console.
- **The signal, twice** (the sample member `new`, four shows with new episodes):
  - Home's tile carries "4" before any press, a screen reader hears "4 shows have new episodes", and the home
    says "New in 4 shows." while the tile has the focus.
  - My shows says "New in 4 shows" under its name and marks the one show on the screen whose Next episode is
    new; its line starts "New: S6 E4".
  - Opening My shows on the TV records no My shows visit.
  - Marking that episode takes the show out: My shows says "New in 3 shows" and the tile "3", which is what
    the harness says. Back was pressed right after the mark, into the loader's read: the list is the new one
    all the same.
  - A show that landed on one of the member's services makes it five; it is marked, and its line leads with
    the service ("Now on Disney+ · To start").
- **The edges:**
  - A show on hold: the key says "Seen it", its tracking is not read, Seen it asks how it was and records
    nothing.
  - A link straight to a show midway through, and a reload: the key names the Next episode once the show's
    tracking is read; nothing is written.
  - A member without shows: "No show for tonight", the bar alone, the focus on Back. A member with shows to
    start only: "Shows to start".
  - A guest's link to My shows shows home, without the tile or a number, and a guest's page asks for none of
    My shows' code.
- **Every key on every phone of the room's table**, landscape and the desktop: 360 x 740, 375 x 667, 390 x 700,
  390 x 844, 430 x 932, 844 x 390 and 1920 x 1080. On My shows (the focus on its first and on its last show), a
  show's title screen with "Seen S1 E4", a member's menu, a guest's menu and What is GoodWatch?:
  - every key is 44 px or more on the phone's screen: the smallest is 44.2 to 44.5 px on the five phones (see
    the table);
  - every key is inside the picture, none lies over another, each says its words in full, nothing is cut off
    by its box, no type is under 20 canvas px, and the focused show's name is under no key;
  - the six posters are one size, and the focused one is inside the picture;
  - the Expand key's corner is there, empty and free, on My shows and on a title;
  - the menu's keys are one height and do what they say; the menu lies over everything of the screen under
    it; What is GoodWatch?'s words start under the bar's keys.

`checks.json` has the measured numbers.

| Window | A poster | The Seen it key | A menu key | The word "Menu" | An answer of What is GoodWatch? | The smallest key |
| --- | --- | --- | --- | --- | --- | --- |
| 360 x 740 | 69 x 104 | 150 x 44 | 232 x 44 | yes | 149 x 44 | 44.5 |
| 375 x 667 | 55 x 83 | 157 x 44 | 243 x 44 | no | 156 x 44 | 44.4 |
| 390 x 700 | 73 x 110 | 164 x 44 | 253 x 44 | yes | 163 x 44 | 44.2 |
| 390 x 844 | 75 x 113 | 164 x 44 | 253 x 44 | yes | 163 x 44 | 44.2 |
| 430 x 932 | 84 x 125 | 182 x 44 | 281 x 44 | yes | 181 x 44 | 44.2 |
| 844 x 390 | 85 x 127 | 220 x 51 | 341 x 47 | yes | 219 x 51 | 46.8 |
| 1920 x 1080 | 182 x 273 | 217 x 78 | 381 x 81 | yes | 566 x 123 | 67.8 |

Sizes in px of the window. Before this slice the menu's keys were 31.9 to 38.6 px tall on the five phones.

**In tests, without a browser:**

- The write path against the in-memory Crate of the tracking tests (`server/show-tracking.test.ts`): the key's
  rule picks the Next episode, the show's session sends the watch to the server's own function, the server
  stores it, and so on to the last aired episode, where the show is Seen and nothing is left to mark. A show on
  hold is left alone.
- The rows, the words, the signal and the rule (`tv/tv-shows.test.ts`); the machine's branch
  (`tv/tv-machine.test.ts`); the screens as they are drawn, with the menu's layout on every phone
  (`tv/tv-shows-render.test.ts`); the loader's fields (`server/living-room/tv-home.test.ts`).
- `npm test` after the merge: 2,264 tests, 2,261 pass, 1 skipped as before. Two failed in the whole run, both
  timing tests on a machine at a load of 10: `server/combined-search/title-lookup.test.ts` ("primary lookup
  winning the catalog race…") and `server/tmdb-timeout.test.ts`. Each passes by itself, and nothing of this
  slice is near them. `npm run build` passes. `tsc`: 212 errors, the baseline's. `biome lint` on the changed
  files: nothing new.

## Where it differs from the prototype and the plan

- **No mutation marks an episode from outside the title page.** The plan asked this slice to find one. The
  show page's tracking store is the only client of a single episode's watch, and it is not bound to the page,
  so the TV uses it.
- **One file of the title page changed: `ui/tracking/store.ts`, three lines.** The store imported one name from
  the show page's gate (`OPEN_EPISODES_EVENT`). Once the TV loads the store, that import made the gate a file
  of its own: one more script in the first view of every title page, 20 files to 21, measured in a build. The
  store now has the name written out, and a test holds it to the gate's. The plan's rule is that no slice
  touches the pages the TV expands into; this is the exception, and it is said here.
- **A TV screen change never reruns the loader, so a mark would leave My shows as old as the page.** The
  preview route's `shouldRevalidate` now lets a request for the address the page is already on pass
  (`routes/home-preview.tsx`). **Slice 13 must carry the same line into `routes/_index.tsx`**, or a marked
  episode stays in the list until the next arrival.
- **Opening My shows on the TV is not a My shows visit.** The screen lists six of the member's shows, not all
  of them, and a visit is a write. The signal clears on the page behind the Expand key, and a show leaves it
  when its new episode is marked. See the open questions.
- **The signal is on home's My shows tile** (the plan's decision 6, first half, as recommended). The second
  half, "New on Netflix" on the Tonight tile, is Tonight's and is not built.
- **No Undo on the TV.** The prototype had none either; the show page's toast offers one. The episode list of
  the show's page, one Expand away, unticks an episode.
- **On a show midway through, the key marks episodes and no longer opens the rating**, also when the show has
  a score. The rating is on the show's page; the key asks how the show was again once every aired episode is
  watched.
- **The posters' words.** The prototype's line is year, seasons, score, match and service. A Continue row of
  the loader has none of those (the plan says so), so the line is the Next episode and what is left.
- **The phone's keys are touch targets**, as in every slice since 5.
- **A member's show page asks for one file more after it is up**: the store is now a chunk of its own
  (40,295 bytes) beside the page's actions (11,033), where both were one file (50,590). Not in a first view.

## Numbers

**The first view's scripts**, `npm run build` with `SENTRY_RELEASE=compare`, counted by
`../tonight-title/first-view.mjs`: raw / gzip / Brotli. Measured after the merge. "Before" is the integration
branch at `8d20ff74`, built from a copy the same way.

| Page | Before | Slice 9 | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 669,192 / 222,983 / 193,389 | 12 files, 671,513 / 223,682 / 194,094 (+2,321 / +699 / +705) | Its own chunk, 54,292 to 56,613: the machine's branch, the screen's entry, the tile's number, the scene's wiring |
| `/` (the old TV) | 17 files, 865,878 raw | 17 files, 865,878 raw | No file changed |
| A show's page | 20 files, 860,295 raw | 20 files, 860,285 raw | The gate lost its export, 10 bytes |
| A movie's page | 20 files, 859,743 raw | 20 files, 859,733 raw | The same |
| The My shows page | 11 files, 613,164 raw | 11 files, 613,164 raw | No file changed |
| The Discover page | 32 files, 1,096,393 raw | 32 files, 1,096,393 raw | No file changed |

- **`shell`, on every page:** 170,770 bytes, unchanged.
- **Loaded on first use:** My shows' chunk, 1,645 bytes (875 gzip, 777 Brotli), with the signal's hook; its
  words and rules, 2,383 (1,165, 1,051); the shared list, 3,548 to 3,926 (the three fields); the episode's
  chunk, 2,059 (1,092, 1,000), which brings the tracking store, 40,295 (13,049, 11,913), code the show's page
  already has.
- **The menu's chunk** 1,532 to 1,829 bytes; **What is GoodWatch?'s** 2,021 to 2,053.
- **`tv.css`** is not changed.
- **A member's page** asks for My shows' chunk and the signal's words (`newly-available`, 5,878 bytes, which
  the hub loads too) right after it is up, for the tile's number. A guest's page asks for neither.
- **The server's HTML** of `/home-preview` is not changed: home's markup gains the tile's number only once the
  signal has reported, in the browser.

Before the merge, against the integration branch at `00578474`: `/home-preview` 12 files, 667,222 raw to 668,769
(+1,547), and the same picture for every other page.

## After the merge

The integration branch at `8d20ff74` was merged into the slice on October 14, 2026, and everything was run again.

- **What the merge needed.** Five files had both slices' changes: the machine (the strip's `exactScores` beside
  `nextEpisode` in the context), `screen-code.tsx`, `TvScreen.tsx`, the scene, and the harness's TV route, where
  slice 8's member session and this slice's became one.
- **Seen it and the rating strip hold together.** On a show the member is midway through the key marks the Next
  episode; on every other title it opens the strip (slice 8's `Rate.tsx`). The machine's tests cover both, and
  both drive scripts walk them.
- **My shows is drawn by the shared `TitleList`.**
- **This slice's drive script:** 521 checks pass, none fail. It is also the first browser run after the
  tracking store's event name was written out.
- **Slice 8's drive script (Taste, the quiz, the strip):** the guest's half 449 checks, the member's half 50,
  none fail.
- **Slice 5's drive script (Tonight and the title screen):** the member's half 110 checks, none fail. The
  guest's half 521 pass and 1 fails: a typed address with `#streaming` at 390 x 844 had the block at 192 px
  when the script looked, not at 223. It is a matter of time on a loaded machine, not of the merge: the title
  page first lands at the fallback offset (112 + 80 px) and corrects itself once its header is measured, which
  took one to three seconds here (the page took 19 seconds to load), and the script looks for three. Sampled
  for sixteen seconds, twice, the block settles at 223 px, the recorded value. The same check passed at
  1920 x 1080 in the second run.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, beside the prototype's shot of the
  same screen: My shows, the menu. Then the signal on home's tile and on My shows, a show to start, a show's
  title screen before and after OK on "Seen S1 E4", a member without shows, a member's menu.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844, with What is GoodWatch?, and
  the menu, What is GoodWatch? and My shows on every phone of the room's table.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, and sample titles. The
harness's titles are made up and painted with real pictures from a fixed table, so a name and its poster do not
always belong together.

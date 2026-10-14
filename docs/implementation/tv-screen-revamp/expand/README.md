# Slice 11: the Expand key

The Expand key on the new TV: amber corner brackets around a small picture and the word "Expand", at the
picture's bottom right on every screen that has a page, and the way through it into the real page and back. It
uses the motion the owner chose and that already runs on `main` (#232, commit `8cf806a1`, "lean in"): the room
zooms into the TV until the picture is the window, and Back, Escape or the TV button run it backwards into the same
TV screen with the focus on the key. For a guest and a member, on `/home-preview`. Proof for
[the plan](../README.md), slice 11. Taken on October 14, 2026.

## Run it

One dev server of `goodwatch-webapp` at a time, with every `REC_*` flag on, as for
[slice 10](../search/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`,
and not on port 3003.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on node_modules/.bin/remix vite:dev --port 3411
```

**A member, on the tracking harness**, a server without services:

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on node_modules/.bin/remix vite:dev --port 3412
```

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=guest GUEST=http://localhost:3411 node drive.mjs
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=member MEMBER=http://localhost:3412 node drive.mjs checks
```

`drive.mjs checks` and `drive.mjs shots` do one of the two; `PARTS=key,trips,motion,cancel,calm,deep,reload,
pointer,layouts,rest,explorer,timing` runs some of the checks, `SCREEN=<part of a screen's name>` some of the
screens. The guest's half keeps its count in a file (`STOCK=`); the member's half writes `checks.json` for both.
A search is stood in for in the browser, as in slice 10's script: the reading server refuses one, and a real one
would be written to the search history. Every request to another host and to `/api/update-*` is stopped.


## What was built

- **The key** (`tv/kit.tsx`, `Expand` and `ExpandCorner`), drawn by the `Frame` every screen of the TV is drawn
  with, wherever the machine lists `expand` (`tvItems`, which asks `destinationHref`): Tonight, Discover's choice
  and its titles, the Explorer's map and an island, Taste, its sides and a side, My shows, a title, the search's
  results and, since the merge of slice 6b, "On <service>". Not on home, the quiz, the rating, What is
  GoodWatch? or the search's question. It is the prototype's Cinema key (`prototype-tv-design/cinema.tsx`, `c-x`):
  a dark glass pill with an amber outline, a small picture in four brackets, the word "Expand"; amber once it has
  the focus. 64 canvas px tall on the desktop, `keySize(canvas, 54)` on the phone, so never under 44 px of the
  phone's screen. A screen reader hears where it leads ("Expand: Discover", "Expand: The Matrix";
  `destinationName` in the machine). Its place is the one the earlier slices kept free: 56 and 40 canvas px from
  the picture's right and bottom edge on the desktop, 20 and 20 on the phone.
- **The frame while it has the focus** (`tv/TvRoom.tsx`, `tv/tv.css`): the picture steps back to 94% and four
  amber brackets, 3 px, stand 14 px inside the TV's edge, with the arm length of the motion's own brackets
  (`bracketArm`). They stand exactly where the motion puts its brackets at the press, and hide while a transition
  is marked, so the two sets never show together and the hand-over has no seam either way.
- **The key keeps its place while the picture steps back.** The prototype scaled the key with the picture: a
  cursor on the key's right third or lower quarter fell off it at the moment it took the focus, and a click there
  then hit nothing; a finger lifted there missed it. The key's place is moved against the step by as much
  (`--tvx-x`, `--tvx-y`), so it stays under the pointer. It is 20 canvas px inside the stepped-back picture.
- **The motif plays and rests.** The prototype moved the key's brackets in and out for as long as it had the
  focus, by animating `inset`; the rendering budget allows neither. Here they move out by `transform`, three
  half-cycles of 0.9 s, and rest open. With reduced motion they rest open at once, and nothing transitions.
- **The way out** is `useLeaveThroughTv` as it runs on `main`, from `TvLivingRoom.tsx`, which already had the hook
  and `useReturnIntoTv`. What the old room gave the motion, the new room gives in every layout (the desktop under
  and beside, the phone's two forms and landscape): the TV's picture marked `data-tv-screen`, the room's block with
  the class `living-room` (the motion's CSS asks `html:has(.living-room)`), and a picture in the TV for the TV
  button (`[data-tv-screen] img`, the screen's backdrop). The site's header has `data-site-header` since
  `8cf806a1`.
- **Three fixes in the motion's own file** (`ui/living-room/tv-transition.ts`), each found by this slice's checks
  and each true of the old TV on `main` too:
  - a second press while the page is on its way asks for nothing more;
  - Escape kept the room but wrote the TV's entry anew without its state: the TV's depth was gone, and its Back
    then went home instead of one screen back. The entry now keeps its state;
  - another key of the TV while a page is on its way (Back, Home, a screen) took the page's place but left the
    mark, the breathing brackets and a trip that said the person was out, for up to ten seconds. The way out is
    now called off as soon as the room's address changes.
- **The focus after Escape** (`tv/use-tv.ts`): calling a page off replaces the TV's history entry, and a new entry
  had no remembered focus, so the focus fell back to the screen's first item and the frame went. An entry that
  something other than the TV puts in place of the one on show, with the same address, keeps the focus on show.
- **The server's HTML of a screen whose code is still on its way** (`TvScreen.tsx`, `Bare`) has the key beside
  the bar, so a focus that comes back to the key before the code is there is on something. The guest home's HTML
  is unchanged: home has no key.
- **The Explorer page opens on an island** (`ui/explorer/opening.ts`, new, with `opening.test.ts`; four lines in
  `ui/explorer/ExplorerMap.tsx`). See [The Explorer page](#the-explorer-page).

## What travels

Every address is the flag-on page's. Checked on the real pages of the reading server, as a guest, desktop and
phone; the member's two on the harness.

| Screen | The key opens | What the page shows |
| --- | --- | --- |
| Tonight, a guest | `/discover` | Discover, nothing chosen |
| Tonight, a member | the pick's page: `/my-shows`, `/my-shows#start` or `/my-movies` | (the harness, below) |
| Discover, the choice | `/discover` | nothing chosen |
| Discover, a mood's, theme's or style's titles | `/discover?moods=funny`, `?themes=crime`, `?styles=animated` | that one filter chosen, and the TV's four titles first, in their order |
| On <service> (slice 6b) | `/discover?services=<id>` | slice 6b's script checks the page |
| The Explorer's map | `/explorer?grouping=mood` | the map on the Mood region |
| An island | `/explorer?grouping=mood&island=<id>` | the map inside that island |
| Taste, its sides | `/taste` | the Taste page |
| A side | `/taste?side=<id>` | the Taste page open on that side |
| My shows | `/my-shows` | (the harness, below) |
| A title | its page, `/movie/603-the-matrix` | the title, at its top, nothing highlighted |
| Search results | `/discover?q=heist` | the TV's titles first, with no second search |

## The Explorer page

The page read `grouping=` (it flies to that grouping's region, once) and `mix=` (picked islands); nothing for an
island. Now `grouping=mood&island=<id>` opens it inside that island, once, when its world first shows:

- `openingOf(params)` in `ui/explorer/opening.ts` reads the two: `{ grouping, island }`, or null without a
  grouping the map has. An island without its grouping is nothing; an empty `island=` is the region.
- `ExplorerMap.tsx`, in the effect that already read `grouping=`: with an island the map has, `flyToIsland`
  (what a double tap on an island does); without one, the region as before. Picked islands in the address (`mix=`)
  come first, as they did for `grouping=`.
- The parameter stays in the address, as `grouping=` does. Nothing writes it.

Checked on the page at both sizes: inside the island and none picked; `grouping=mood` alone is the region; an
island the map lacks is the region; an island without its grouping is the whole world; with `mix=` the pick wins.

## The Taste page's side

Asked for by the owner after the first report. The page showed the side with the highest average first and had no
address for one. Now `/taste?side=<id>` opens it on that side, and the TV's Expand key on a side's screen goes
there. The ids are the portrait's (`Side.id`), which the TV and the page both read from `/api/taste/portrait`.

- `ui/taste/side-address.ts` (new, with `side-address.test.ts`): `requestedSide`, `openingSide` (the side asked for
  when the person has it, else the page's own first), `withSide`, and `onlySideChanged`.
- `ui/taste/tabs/SidesOfYou.tsx` opens on `openingSide(…)` and reports the side on show to the route.
- `routes/taste._index.tsx` puts a side the person picks in the address in place of the one there (`replace`,
  no history entry), so a reload keeps it and Back still leaves the page in one step. A side that the person does
  not have is the page as without one, and leaves the address. `shouldRevalidate`: a change of the side alone
  does not run the loader again.
- `destinationHref` in the machine: `/taste?side=<id>` from a side's screen; Taste itself and its sides stay
  `/taste`.

Checked at 1920 x 1080 and 390 x 844 (`PARTS=sides`), as a guest with eighteen scores and two sides: from each
side's screen the key opens `/taste?side=<id>` with that side's tab selected, and Back returns to the side's screen
with the focus on the key; picking the other side on the page puts it in the address with no history entry and
nothing asked for again, Back then leaves the page in one step to the TV, and a reload keeps it; `?side=nowhere`
opens the side the page opens on without one and drops the parameter.

## Two timings of slice 5

Both were measured here in the page itself, three and two times at each size (`PARTS=timing`).

**The Watch key's pulse, seen for 3,282 ms where the check wants 3,500 to 4,500: the check was wrong.**

- The pulse never starts before the transition ends: by its own start time on the document's timeline it started
  7 to 145 ms after the motion's mark was cleared, in every run (twelve, over two runs of the part).
- By its own clock it runs 3 x 1,300 ms, 3,900 ms, every time, and ends by itself after three pulses.
- What the check timed was the first sample that saw the pulse, taken from outside every 100 ms, to the first
  that saw it gone. Right as the motion ends the page has work to do (the title page lays out its sections), and
  a sample waits for the page's main thread: gaps of up to 1,554 ms between two samples were measured. Even the
  animation's own start and end events, which wait for the same thread, gave 3,533 and 5,131 ms once each. The
  lean-in did not delay the pulse; it ends at the moment the page is busiest, so the first sample came late.
- `../tonight-title/drive.mjs` now times the pulse by its animation (`getComputedTiming`, three iterations of
  1,300 ms, ended), and keeps the sampled time as a number only. Its Watch key part, run again: 93 checks pass,
  none fail; 3,900 ms at both sizes.

**A typed `#streaming` address at 390 x 844 with the block at 192 px: the check was wrong; the page does what it
was built to do, with one small cost.**

- Until the page runs, the browser has scrolled by the server's guess of the title page's header height, 112 px
  (`ui/details/header-height.ts`): the block stands at 112 + 80 = 192 px at both sizes. Once the page has measured
  the header (93 px on the desktop, 142.8 px on the phone; 1.0 to 3.2 s after the address was typed on this
  machine) it lands on the block again: 173 and 223 px, settled within 0.3 s, in all four runs.
- The check sampled for three seconds from the load, which on a busy dev server ends before the page runs. It now
  waits for the measured header first.
- The cost, for the owner to know: on a phone, until the page runs, the block's top 15 px lie under the sticky
  header (it ends at 207 px). Only a typed or shared address with `#streaming` shows it; the TV's Watch key opens
  the page inside the app, where the header is measured before the scroll. A guess per breakpoint in the title
  page's CSS would remove it; the title page is not this slice's to change.

## Numbers

**The first view's scripts and stylesheets**, `npm run build` with `SENTRY_RELEASE=compare`, counted by
`../tonight-title/first-view.mjs`: raw / gzip / Brotli. "Before" is the integration branch at `493fe1e3` (with
slice 6b), built in a throwaway worktree; "after" is this branch with it merged.

| Page | Before | After | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 677,040 / 225,363 / 195,538 | 12 files, 678,955 / 226,021 / 196,102 (+1,915 / +658 / +564) | Its own chunk 60,848 to 62,617 (+510 Brotli): the key, the frame, the key's name. `Remote`, which both TVs share and which holds the motion's code, +137 (+62 Brotli): the motion's three fixes |
| `/` (the old TV) | 17 files, 867,170 / 283,085 / 246,309 | 17 files, 867,316 / 283,127 / 246,351 (+146 / +42 / +42) | `Remote`, the same +137 |
| The Discover page | 32 files, 1,096,402 / 364,687 / 318,162 | 32 files, 1,096,411 / 364,671 / 318,124 | `shell` +9 raw, -12 Brotli |
| A movie's page | 20 files, 859,742 / 285,061 / 245,517 | 20 files, 859,751 / 285,053 / 245,523 | `shell` |
| A show's page | 20 files, 860,294 | 20 files, 860,303 | `shell` |
| The Explorer page | 18 files, 885,581 / 300,843 / 262,279 | 18 files, 885,757 / 300,890 / 262,324 (+176 / +47 / +45) | Its chunk: the island parameter |
| Taste, My shows | 23 and 11 files | the same, +9 raw | `shell` |

- **`shell`, on every page:** 170,779 to 170,788 raw, 55,500 to 55,488 Brotli: the build's names, nothing of this
  slice's code.
- **No first view has a file more.** The TV button's chunk (`TvWayBack`, 5,172) is unchanged.
- **Stylesheets:** `tv.css` (the new TV's own, blocking on `/home-preview`) 6,964 to 8,893 raw, 1,852 to 2,209
  Brotli (+357): the key, its motif, the frame. `tailwind.css` +54 raw, +28 Brotli (four utility classes).
  `main.css`'s rules for the motion are unchanged.
- **The server's HTML:** the guest home's is unchanged (home has no key). A link straight to a screen with a page
  gains the key beside the bar, in both editions.

## What the checks say

The guest's half: **2,705 checks pass, none fail**. The member's half on the harness: **202 pass, none fail**.
Both on this branch after the merge of the integration branch at `493fe1e3` (slice 6b). `checks.json` has the
numbers. A wait that ends in time counts as a check that passed.

- **The key on every screen with a page, at seven sizes** (1920 x 1080, 1366 x 650, 360 x 740, 375 x 667,
  390 x 844, 430 x 932, 844 x 390), twelve guest screens and My shows: it says "Expand" and nothing longer, a
  screen reader hears where it leads, it is inside the picture at its bottom right and over no other key, focused
  and at rest. Focused it is amber with four brackets around a small picture; the picture stands at 0.94 in its
  frame, four brackets 14 px inside the TV's edge. At rest it is the dark pill with amber type, and its centre is
  where it was while focused (within 0.6 px). Left or Up leaves it, Right or Down comes back. Its smallest side at
  rest: 44.5, 44.4, 44.2 and 44.2 px on the four phones, 52.7 in landscape.
- **No key** on home, What is GoodWatch?, the search's question, the rating and the quiz, and `focus=expand`
  there leaves the focus where it starts.
- **Out and back from every screen, on the desktop and the phone,** reaching the key with the direction keys
  (one to three presses: Down, then Right along the last row), the pointer at the key's right end, a finger, or
  the Remote's OK, and returning by the browser's Back, Escape or the TV button in turn; on Discover's titles all
  three ways at both sizes. Each time: the page at the machine's address with what travelled (above), one history
  step on, the trip remembered, the TV button there (207 x 58 under the header; 131 x 50 in the phone's dock),
  then the same TV screen on the TV's own entry, the same items, the focus on the key, the frame and its brackets,
  and still the key's focus a moment later. Nothing in the console but the Discover page's own warning (below).
- **The motion.** The press marks the way out once and puts up four brackets exactly where the frame's stood (the
  frame's hide); while the page is held back they breathe; the zoom runs 0.9 s to its end, the page is swapped in
  before it, the mark goes when it ends, the brackets fold into the TV button. Back: marked once (by the TV
  button's code, then by the room), 0.6 s, and the frame's brackets stand where the motion's landed. Forward and
  Back again give the key its focus.
- **Calling a page off.** With the page held back five seconds: its data is asked for at the press; a second
  press asks for nothing more; Escape takes the mark and the brackets away, the TV keeps its screen, the focus
  on the key and the frame, no trip is remembered; the late answer changes nothing and the history has no entry
  more. The Home key while a page is on its way shows home and calls the page off. Afterwards the key opens the
  page, and the TV's Back still steps back to the choice the titles came from.
- **Reduced motion:** the key focused frames the picture at once; nothing runs; the key's brackets rest open; out
  and back three ways are plain navigation, with no mark and no brackets, and the trip is still remembered (without
  a box), so the TV button leads back.
- **Two and three pages deep:** a title opened from the Discover page is two pages from the TV and has the TV
  button; the button and Escape return to the TV screen in one history move, as one transition; the browser's Back
  goes one page at a time. Three pages on the button is gone and Escape goes nowhere; one step back it is there.
- **A reload of the page** keeps the TV button and the trip; Back then returns to the TV screen with the focus on
  the key. A reload of the TV's screen keeps it too.
- **The pointer on return:** the cursor left resting on the page over where a tile of the TV lies does not take
  the focus when the TV is back; once it moves, the tile under it does, and the frame goes.
- **Every layout of the room:** the desktop with the Remote under the TV (1920 x 1080) and beside it
  (1366 x 650), the phone with the Remote in the hand (390 x 844) and on the table (375 x 667), and landscape
  (844 x 390). The motion starts from the picture's own box in each, runs both ways, and returns to the same room.
- **Nothing animates at rest:** on the screen with the key, unfocused and focused (four seconds after the focus,
  when the key's brackets have played 3 x 0.9 s and stopped), and back on the TV after a trip, no animation or
  transition runs and no frame is asked for in three seconds. On the page after arrival nothing of the motion or
  of the TV button runs.
- **The Explorer page's parameter** (above), at both sizes.

## Where the plan was wrong

- **"Waiting for the owner's pick between Frame and Camera."** Decided since: neither; the owner chose "lean in"
  (camera and frame together) and it shipped on `main` (`8cf806a1`) before this slice. The plan's motion section
  (the frame's clip, `--tv-inset`, 0.85 s out) describes code that is gone. The way out is 0.9 s, the way in 0.6 s.
- **"The corner key on the real pages … 44 px high, bottom right."** Shipped instead as the TV button: a tab under
  the header on the desktop, the dock's left part on a phone, for the page the TV opened and one step further.
- **`ui/explorer/history.ts`** does not exist, and the Explorer page read no island (slice 7 said so). The page now
  reads `island=` (above).
- **The prototype's key scaled with the picture**, so the key moved out from under the pointer as it took the
  focus. Kept still here (above). The plan did not mention it.
- **The plan's list of files** (`tv-transition.ts`, `main.css`, `tv/kit.tsx`, `tv/use-tv.ts`): `main.css` needed
  nothing; `TvRoom.tsx`, `TvScreen.tsx`, `room-tv.ts`, `tv-machine.ts` and `tv.css` did, and the Explorer page.
- **"Must not touch the pages it opens."** The Explorer page was touched, as the brief asked.

## Left open

- **Safari and Firefox** were not run for this slice; Chromium only. The motion itself was run in Firefox for
  `8cf806a1`.
- **The member's pages behind the key** (`/my-shows`, `/my-movies`) were opened from the harness, whose server has
  no services and no session for the real pages: they show what a guest sees there. The addresses are the
  machine's, with tests.
- **The 15 px under the title page's header** on a phone, until the page runs, for a typed `#streaming` address
  (above).
- **A development-only warning on the Discover page on a phone**, "Detected a large number of updates inside
  startTransition", comes from the page's poster cards (`ui/title-actions/pointer.ts`), not from the TV; it shows
  on arrival from the TV because the page is opened there on a touch device.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, beside the prototype's Cinema shots:
  the key focused on Discover's titles (the prototype's `05-expand-focused`), at rest, on the Explorer's map, on a
  title, and on "On Netflix".
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844, with Taste's sides.
- The motion, six frames each: out of Discover's titles into the Discover page
  ([desktop](strip-discover-desktop-out.jpg), [phone](strip-discover-phone-out.jpg)) and back
  ([desktop](strip-discover-desktop-back.jpg), [phone](strip-discover-phone-back.jpg)); out of a title into its
  page and back ([desktop out](strip-title-desktop-out.jpg), [back](strip-title-desktop-back.jpg),
  [phone out](strip-title-phone-out.jpg), [back](strip-title-phone-back.jpg)).
- `clips/`: the four runs as clips, out with Enter and back with Escape. Recorded on a busy machine with a dev
  build: from the press to the page standing 1.55 to 2.21 s, from Escape to the TV standing 0.84 to 1.0 s.
- `shots/`: each screen with its key at rest, three of them focused, the key focused at 1366 x 650, 375 x 667 and
  844 x 390, and the Explorer page opened inside an island.

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

<!-- RESULTS -->

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
| Taste, its sides, a side | `/taste` | the Taste page; a side does not travel (the page has no address for one) |
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

## Two timings of slice 5

Both were measured here in the page itself, three and two times at each size (`PARTS=timing`).

**The Watch key's pulse, seen for 3,282 ms where the check wants 3,500 to 4,500: the check was wrong.**

- The pulse never starts before the transition ends: by its own start time on the document's timeline it started
  22 to 145 ms after the motion's mark was cleared, in all six runs (once 1,090 ms, on a busy moment).
- By its own clock it runs 3 x 1,300 ms, 3,900 ms, every time, and ends by itself after three pulses.
- What the check timed was the first sample that saw the pulse, taken from outside every 100 ms, to the first
  that saw it gone. Right as the motion ends the page has work to do (the title page lays out its sections), and
  a sample waits for the page's main thread: gaps of up to 1,554 ms between two samples were measured. Even the
  animation's own start and end events, which wait for the same thread, gave 3,533 and 5,131 ms once each. The
  lean-in did not delay the pulse; it ends at the moment the page is busiest, so the first sample came late.
- `../tonight-title/drive.mjs` now times the pulse by its animation (`getComputedTiming`, three iterations of
  1,300 ms, ended), and keeps the sampled time as a number only.

**A typed `#streaming` address at 390 x 844 with the block at 192 px: the check was wrong; the page does what it
was built to do, with one small cost.**

- Until the page runs, the browser has scrolled by the server's guess of the title page's header height, 112 px
  (`ui/details/header-height.ts`): the block stands at 112 + 80 = 192 px at both sizes. Once the page has measured
  the header (93 px on the desktop, 142.8 px on the phone; 1.8 to 3.0 s after the address was typed on this
  machine) it lands on the block again: 173 and 223 px, settled within 0.3 s, in all four runs.
- The check sampled for three seconds from the load, which on a busy dev server ends before the page runs. It now
  waits for the measured header first.
- The cost, for the owner to know: on a phone, until the page runs, the block's top 15 px lie under the sticky
  header (it ends at 207 px). Only a typed or shared address with `#streaming` shows it; the TV's Watch key opens
  the page inside the app, where the header is measured before the scroll. A guess per breakpoint in the title
  page's CSS would remove it; the title page is not this slice's to change.

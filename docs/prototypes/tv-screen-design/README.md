# TV screen design prototype

Throwaway. Branch `prototype/tv-screen-flow`. Round two of the TV revamp on the start page: **what the TV looks
like.** The flow is fixed: the owner chose **apps** in round one (`docs/prototypes/tv-screen-flow/`). Here the same
flow, with the same screens and the same items, is dressed three ways. The owner chose **Cinema**; it is what the
address shows without `?design=`, and the other two stay one key away.

## Open it

```
cd goodwatch-webapp
npm ci
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3147
```

**Every `REC_*` flag must be on**, as in the command: without them the site around the room is the old design.
With them the room sits under the new header (the wordmark, Browse, the search field, the Wishlist key, Sign up)
and, on a phone, above the new dock. Nothing fails without Crate or Valkey: no request of either prototype route
answers with an error.

`http://localhost:3147/prototype/tv-screen-design`

No Crate, no Valkey, no session. Titles, scores and islands are the flow prototype's sample data; posters and
backdrops are real, from `image.tmdb.org` (paths hard-coded in `app/ui/prototype-tv-design/art.ts`, so the browser
needs the internet but nothing needs a key).

| Control | What it does |
| --- | --- |
| `1 Cinema` / `2 Marquee` / `3 Glow` at the top left, or the keys `1` `2` `3` | Choose the direction (`?design=cinema\|marquee\|glow`). The screen you are on stays, only its dress changes, so any screen can be compared in place |
| `Guest` / `Member`, or `P` | The person (`&as=member`) |
| `In the room` / `TV only`, or `V` | The room with the Remote, or the TV alone (`&view=tv`) |
| `“Expand”`, or `L` | Cycle the expand key's label |
| `Pointer: Ring`, or `C` | Cycle the shape of the TV's own pointer: ring, crosshair, dot (`&pointer=cross`) |
| `Expand last`, or `B` | The expand key last in the top bar, or first (`&bar=first`) |
| `Remote beside`, or `R` | The Remote beside the TV (the default), or under it as before (`&remote=below`) |
| Arrow keys, Enter, Escape or Backspace | Directions, OK, Back |
| `H`, `M`, `S` | Home, Menu, Search (typing on the search screen goes to the TV) |
| The Remote, mouse and touch on the TV | As in the flow prototype |

Every key is a plain key on a German keyboard: none needs Shift or AltGr. `&chrome=off` hides these controls.

## Fixed, as decided

- The apps flow: home with large app tiles and a preview of the focused one; Tonight, Discover, Explorer, Taste and
  (member) My shows as apps on the TV; a title screen; search; the menu; the four-answer quiz.
- One way out: the expand key at the top right of every app. Focusing it frames the whole picture, OK grows the
  picture into the page. Label "Expand" by default.

## The top bar

Every screen has the same bar: its name on the left (with one short line under it, such as the mood), and at the
top right the same actions in the same place, as large as everything else (64 px tall, 72 in Marquee; an icon and
one word). They do what the Remote's keys do, and are reached with Up from the top row of a screen, with the
pointer, and by touch.

| Screen | Back | Search | Menu | Expand |
| --- | --- | --- | --- | --- |
| Home | no: nothing to go back to | yes | yes | no: home has no page of its own |
| Tonight, the moods, the titles, the map, an island, Taste, a side, My shows, a title | yes | yes | yes | yes |
| The quiz, rating a title, What is GoodWatch? | yes | yes | yes | no: no page to grow into |
| Search (typing) | yes | no: you are there | yes | no |
| Search results | yes | no | yes | yes |
| While the menu is open | the menu itself has no bar; the screen under it shows no Menu action | | | |

**The arrangement:** Back, Search, Menu, a wider gap, then Expand, last, in the corner. The three are quiet (dark
pills or blocks); Expand alone is amber and carries the motif, so it is not one of them. The corner is where
round one put it, and Right along the bar always ends on it. **The alternative** (`B`): Expand first, then the
gap, then the three; it reads first, but it moves away from the corner and sits beside the screen's name.
[compare/top-bar.jpg](compare/top-bar.jpg) shows both in each direction. On a phone the three are icons without
their words and the bar takes two lines (the actions, then the name).

## Pointing the Remote at the screen

- **The Remote follows the cursor.** Wherever the mouse is in the window (over the site's header and dock too),
  the Remote in the hand aims at it: it turns about the wrist, leans further back for a far point and less for a
  near one, rolls toward the cursor's side, and moves a little toward it. It eases with a short lag (about a tenth
  of a second) and returns to rest when the cursor leaves the window.
  - Beside the TV (the default) it **nods**: it turns 13 degrees at most and rolls more instead (26 degrees), so
    it never swings over the picture it points at, and its keys stay where a click finds them.
  - Under the TV (`R`) it has room to **swing**: up to 42 degrees to either side, which reaches the top corners;
    the hand lifts it as it turns, so its keys stay in the window.
- **Its keys stay hittable.** Over the Remote's own place it settles at rest, so the keys are where they were.
- **The TV's own pointer.** Over the TV picture the system cursor is hidden and the TV draws a pointer that
  follows with a slightly shorter lag. Over an item the item takes the focus and the pointer changes shape and
  leans a little toward the item's middle; over the expand key it turns amber; a click is OK. It fades after
  3.2 seconds without movement and at once when a key of the keyboard or of the Remote is used, and comes back
  on movement.
- **Three shapes** (`C`), one look for all three directions (white with a dark edge, so it reads on any art):

  | Shape | Free | Over an item | |
  | --- | --- | --- | --- |
  | **Ring** (recommended) | a circle with a centre dot | the circle closes around the dot | Reads at once as "where the Remote points", shows the exact spot, covers the least |
  | Crosshair | four ticks around a gap | the ticks close in and turn into an X | The most "aiming", but the thinnest on busy posters, and an X over an item can read as "close" |
  | Dot | a lit puck | opens into a ring | The friendliest and the easiest to find, but it hides what is under it |

  A clip and a strip per shape, the Remote following the cursor into the four corners and across the TV:
  [ring](pointing/ring.mp4) ![ring](pointing/ring-strip.jpg) [crosshair](pointing/cross.mp4)
  ![crosshair](pointing/cross-strip.jpg) [dot](pointing/dot.mp4) ![dot](pointing/dot-strip.jpg)
- **Touch and the phone:** there is no cursor, so no pointer is drawn. A tap chooses directly; the Remote turns a
  little toward the tap (40% of the way on a touch screen, 15% on the phone layout) and comes back after 0.65 s.
- **Reduced motion:** the Remote stays still; the pointer is drawn without lag.
- **How it is built** (`pointing.tsx`): one `pointermove` listener on the window writes the cursor into a ref; one
  `requestAnimationFrame` loop eases two transforms (the Remote's `translate3d perspective rotateZ rotateX
  rotateY` about the wrist, the pointer's `translate3d`) and stops when both have arrived. No React state is set
  on a mouse move; the pointer's states are attributes written when they change, and its shape changes are CSS
  transitions of `transform` and `opacity`. The real Remote component is untouched.

## The three directions

| | **1 Cinema** | **2 Marquee** | **3 Glow** |
| --- | --- | --- | --- |
| The bet | The art does the work | Words and colour do the work | Light does the work |
| A title in a list | A bare poster, no frame, no caption; its name and facts stand large above the row for the focused one | A poster over a caption block with the title in capitals | A still in landscape with the title on it, two in a row |
| An app on home | A still of what is inside it (tonight's pick, four posters, a map, a fingerprint, the next episode) in a dock at the bottom | A tall block of flat colour with one large sign and the name in capitals | A round disc with the same pictures, the name under it |
| The focus | The item comes forward: 9% larger, lit, a white edge and a deep shadow; the others sit at 62% brightness | Nothing grows. One white ring glides from item to item; the focused one is in full colour, the others muted | A lamp: the item lights up, lifts 8 px and throws amber light; a pool of that light glides behind it; the others at half brightness |
| Type | Gabarito bold, large and quiet, sentence case | Gabarito at its heaviest (900), capitals, tight | Gabarito semibold, warm white, sentence case, centred where it can be |
| The background | The backdrop of whatever has the focus, across the whole picture, cross-fading as the focus moves, under a shade on the left and bottom | A flat field of the focused item's colour falling off to black | A warm, dark gradient that does not change; a backdrop only as a faint tint on a title |
| Corners | 14 px | 6 px, square in spirit | 28 px and round |
| Between screens | A short zoom out of the picture (0.3 s) | A push from the side the screen comes from: right going in, left coming back (0.24 s) | A gentle rise (0.36 s) |
| The expand key | A dark glass pill, amber outline and thin brackets; amber when focused | A solid amber block, black capitals, thick brackets; white when focused | An amber outline pill; filled and glowing when focused |
| The frame while it is focused | Thin amber brackets (3 px), picture steps back to 94% | Thick brackets (10 px), picture steps back to 90% | Rounded, glowing brackets (5 px), picture steps back to 95% with round corners |

All three keep one rule from round one: **amber means the way out.** In Cinema and Marquee nothing else on the TV
is amber. Glow breaks this on purpose (its focus light is amber too), which is its one cost: the expand key
stands out less there.

All motion stops with `prefers-reduced-motion`: screens cut, the ring and the light jump, the brackets stand still.

### Side by side, the TV alone

One image per screen, the three directions under each other at the TV's real size on a 1920 x 1080 window (1351 x 729):

- Home: [compare/home.jpg](compare/home.jpg)
- Mini Discover, the moods: [compare/discover-moods.jpg](compare/discover-moods.jpg)
- Mini Discover, the titles: [compare/discover-results.jpg](compare/discover-results.jpg)
- Mini Explorer: [compare/explorer.jpg](compare/explorer.jpg)
- A title: [compare/title.jpg](compare/title.jpg)

### Motion

| | The focus moving | The expand run |
| --- | --- | --- |
| Cinema | [clip](focus/cinema.mp4) ![strip](focus/cinema-strip.jpg) | [clip](expand/cinema.mp4) ![strip](expand/cinema-strip.jpg) |
| Marquee | [clip](focus/marquee.mp4) ![strip](focus/marquee-strip.jpg) | [clip](expand/marquee.mp4) ![strip](expand/marquee-strip.jpg) |
| Glow | [clip](focus/glow.mp4) ![strip](focus/glow-strip.jpg) | [clip](expand/glow.mp4) ![strip](expand/glow-strip.jpg) |

The focus clips are the browser's own frames (a screencast, real time) of one walk: along the apps and back, into
Discover, around the moods, into the titles, up to the expand key. The focus strips are six of those frames from
the first move. The expand clips are composed from frames frozen at fixed points of the run, played at its real
speed (0.85 s).

### Every screen

`screens/<direction>/<nn-name>-desktop.jpg` (1920x1080, in the room) and `-phone.jpg` (390x844): 19 screens per
direction, taken with every `REC_*` flag on and with the top bar. 01 home, 02 Tonight, 03 the moods, 04 the titles, 05 the expand key focused, 06 the map, 07 an island,
08 Taste before a taste, 09 the quiz, 10 a title, 11 rating, 12 search, 13 search results, 14 the menu, 15 What is
GoodWatch?, and for a member 16 home, 17 the three sides, 18 a side, 19 My shows.

## The room: the TV and the Remote

The owner's finding on the round before: the Remote's Netflix and Prime Video keys were cut off under the TV. A
browser window is wide and short (tabs and the address bar take height), so the Remote does not fit under a large
TV, and the smaller the window, the less.

**Chosen: the Remote sits beside the TV**, whole, in the hand, on the right; its end rests on the window's bottom
edge. The TV takes the left and the height, as large as the window allows (up to 92% of the height).

- The Remote is as large as the height shows all of it, 0.9 of its size on a 1080p screen. When the window is too
  narrow for both, the Remote gives way first (down to half its size) so that the TV stays at the width that keeps
  its type at 18 px; only below that does the TV shrink.
- At rest nothing of the Remote is cut: its keys, its end with the logo, the fingers on its left and the palm on
  its right are in the window. The arm leaves through the bottom edge, as an arm does.
- The room comes closer: the photo is scaled so its TV sits where ours is (2.2 times its base size on 1080p), and
  the lights are lower. The photo's largest file is stretched by about 1.45 there and is soft: the real build
  needs a larger or tighter render, or a photo made for this view.

| Window | TV | Canvas shown at | Smallest type on the TV (Cinema) | Remote's width | Its streaming row ends at | The Remote ends at |
| --- | --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | 1351 x 729 | 1.13 | 23.6 px | 294 px | 758 of 1080 | 1074 of 1080 |
| 1920 x 940 | 1351 x 729 | 1.13 | 23.6 px | 294 px | 618 of 940 | 934 of 940 |
| 1536 x 730 | 1080 x 583 | 0.90 | 18.9 px | 231 px | 474 of 730 | 723 of 730 |
| 1440 x 800 | 1080 x 583 | 0.90 | 18.9 px | 174 px | 606 of 800 | 793 of 800 |
| 1366 x 650 | 998 x 539 | 0.83 | 17.5 px | 160 px | 471 of 650 | 643 of 650 |
| 1280 x 720 | 949 x 513 | 0.79 | 16.6 px | 160 px | 541 of 720 | 713 of 720 |
| 2560 x 1300 | 1874 x 1012 | 1.56 | 32.8 px | 361 px | 909 of 1300 | 1297 of 1300 |

[viewports/contact-sheet.jpg](viewports/contact-sheet.jpg) shows Cinema's home at each size, all at the same scale.

- **18 px holds at 1440 x 800, 1536 x 730 and everything larger.** At 1366 x 650 the TV is limited by the height (the site's header takes
  64 px of 650) and its smallest type is 17.5 px; at 1280 x 720 it is limited by the width and is 16.6 px. Nothing
  is cut at either; the type is smaller. Marquee's smallest type is 20 canvas pixels (Cinema's and Glow's 21), so it
  is 5% smaller than the column says.
- **The alternative, `R`: the Remote under the TV**, the picture of the round before. It only has room for the
  Remote down to its streaming keys and the fingers under them (the end runs off the window), and it costs the TV
  its size: 1137 x 614 on 1920 x 1080 (smallest type 19.9 px), and less in every shorter window (about 17 px at
  1920 x 940). It is kept for comparison.
- **The phone** (390 x 844): the TV is on top (375 x 462, smallest type 14.4 px) and the Remote
  under it at a size a thumb can hit (225 px wide, its round keys 45 px). That is taller than the window, so
  **the scene scrolls**: the wheel shows under the TV, and Back, Search, Home and the streaming keys are a short
  scroll down. Fitting it all instead would leave keys of 25 px.

## Size numbers

Measured by `shots.mjs` in the room on a 1920x1080 window, over all 19 screens, at rest (without the growth of a
focused item); `sizes.json` has the output.

| | Smallest text | Where | Smallest focus target | Where |
| --- | --- | --- | --- | --- |
| Cinema | 23.6 px | the "Start" strip on a poster in My shows | 72 px tall (169 x 72) | Search in the top bar |
| Marquee | 22.5 px | "92 score" under a poster | 81 px tall (179 x 81) | Search in the top bar |
| Glow | 23.6 px | the facts line on a still | 72 px tall (169 x 72) | Search in the top bar |

The script reports the target with the smallest shorter side; all actions of the top bar share that height, and
Back, with the shortest word, is the narrowest of them.

The TV shows its canvas at 1.13 there, so the sizes in the code print 13% larger. In canvas pixels the primary
labels are: app names 26 to 108 px, screen titles 36 to 62 px, a title's name 46 to 104 px, buttons 25 to 32 px
in keys 64 to 124 px tall. At most five targets in a row (My shows has six in Cinema and Marquee; the sixth pages
in), at most two rows of tiles on screen at once (Glow's My shows has a third that pages in).

## Recommendation

**Cinema**, with the map of Marquee.

- It is the one that reads as a TV at once: the picture of the thing you point at fills the screen, as on the
  boxes the owner named. The art the app already has (backdrops, posters) does the polish; nothing has to be drawn
  per title.
- It keeps the fewest things on screen: a list is four bare posters and one large name.
- Its weak spot is the art itself. A dull or busy backdrop makes a dull or busy screen (see a member's Tonight
  with Arrival's fog, or the map's island of Space), and type on a picture needs the shade to stay readable.
- Marquee is the easiest to read from far away and has the clearest focus (the ring), but it looks least like a
  TV and most like a poster wall; its app signs would need real illustration work. Its **Explorer is the best of
  the three**: flat islands with their names inside read as a map; round stills (Cinema) and plain orbs (Glow) do
  not say what an island is.
- Glow fits the room best and is the calmest, but it dims everything that is not focused, its light costs the most
  to draw, and amber stops meaning "the way out".

## The phone

Usable at 390 px in all three (tap chooses; the Remote is under the TV and the scene scrolls to its lower keys,
see above). What changes: the TV fills the width on a taller canvas (520 x 640, shown at 0.72, so 20 px type is
14 px); rows show two and a half tiles and page sideways; grids go to two columns; the maps become a grid of six
islands; buttons stack; the top bar's actions are icons; Cinema drops the line under the focused title, Marquee
the posters on home and the poster on a title, Glow the stills on home and on a title. Not built: swiping,
landscape, the room photo.

## Not in this round, and what I did not check

- **Rendering cost.** Cinema cross-fades a full-picture image on every focus move, Glow draws large soft shadows,
  and the TV is 2.4 times the area of today's. The start page has a rendering budget (#190). Nothing here was
  measured against it.
- **The art is not curated.** Backdrops are TMDB's first choice per title; some carry the title as text, some are
  dull. The real build would need a rule for which image to take, and a fallback for a title without one.
- **Moving focus by a ring over a paging row** (Marquee) follows the row for 0.7 s after a move; a longer scroll
  would leave it behind.
- Boot screen, sign-in, browser history and the real pages behind the expand run are as in round one: not built.

## Questions for the owner

1. Which direction, or which mix (for example Cinema with Marquee's map, or Cinema's art with Marquee's ring)?
2. The Remote beside the TV: is this the room, or should the Remote stay under the TV (`R`) at the price of a
   smaller TV and a Remote that shows only down to its streaming keys?
3. Beside the TV the Remote nods toward the cursor (13 degrees) instead of swinging to it (42). Enough of a
   pointing hand, or should the TV give up width so the Remote can swing?
4. On the smallest windows (1366 x 650, 1280 x 720) the TV's smallest type is 16.6 to 17.5 px. Acceptable, or
   should the TV's content itself change there (fewer, larger things) rather than scale?
5. On the phone the Remote's lower keys are reached by scrolling. Right, or should the phone's Remote be a
   different, shorter one?
6. The room behind the larger TV is closer and darker, and the photo is soft at this size: should a new photo be
   made for this view?
7. Cinema shows no name on a poster in a list (the name stands above for the focused one). Enough, or should
   every poster carry its name?
8. Should amber stay reserved for the way out (Cinema, Marquee), or may the focus use it too (Glow)?
9. My shows puts six shows in one row in Cinema and Marquee. Keep the row and let it page, or cut to the three
   next episodes?
10. The app pictures (the map, the fingerprint, Marquee's signs) are drawn in code as stand-ins. Should they be
   illustrated, or made from real art as Tonight and My shows are?

## Files

Added:

- `goodwatch-webapp/app/routes/prototype.tv-screen-design.tsx`: the route
- `goodwatch-webapp/app/ui/prototype-tv-design/scene.tsx`: the larger room, the TV, the Remote, the expand run per direction, the controls
- `.../base.tsx`: the apps flow (which screen shows what; item ids as in round one), the app pictures, the follower that glides to the focus
- `.../cinema.tsx`, `.../marquee.tsx`, `.../glow.tsx`: the three directions
- `.../art.ts`: TMDB poster and backdrop paths of the 25 sample titles
- `.../pointing.tsx`: the Remote aiming at the cursor and the TV's own pointer
- `docs/prototypes/tv-screen-design/`: this file, `shots.mjs`, `walk.mjs`, `sizes.json`, `screens/`, `compare/`, `focus/`, `expand/`, `pointing/`, `viewports/`

Changed: `goodwatch-webapp/vite.config.js` (`PROTOTYPES` lists the route and the folder), and in
`prototype-tv-flow` only `data.ts`: the addresses of the pages the TV expands into are those of the flag-on pages
(`moods=` for Discover, a title's TMDB id in its address). The engine, the focusable item and the title actions
are imported as they are, and the flow prototype works as before.

## Proof

- `npx remix vite:build` passes; `npx biome lint` on the added files is clean; `tsc` reports nothing in them.
- `walk.mjs`: 211 checks pass. 52 per direction: the apps, a mood, titles, Want to See, rating, the way along the
  top bar to the expand key and back, the menu, the map in four directions, the Remote's keys, search, the quiz,
  a member's My shows; the top bar (which actions each kind of screen has, reaching them with Up, what Back,
  Search and Menu do, the alternative order); and pointing (the pointer appears over the TV and the system cursor
  is hidden, the item under it takes the focus, a click is OK, it hides on a key and after 3.2 s, the Remote nods
  toward each of the four corners and never further than its nod, settles over its own keys and is at rest after
  the cursor left). Then 39 for the window sizes: at 1920 x 1080, 1920 x 940, 1536 x 730, 1440 x 800, 1366 x 650,
  1280 x 720 and 2560 x 1300 the streaming row ends inside the window, the whole Remote is inside it, and the
  Netflix and Prime Video keys each take a click (also in Marquee and Glow at 1536 x 730, and with the Remote
  under the TV). And 16 more: the full swing with the Remote under the TV, the direction buttons and the keys
  1, 2, 3, the pointer shapes, and the phone (no pointer; a scroll brings the streaming row into the window; both
  keys take a tap).
- `shots.mjs` made every picture, clip and number here.

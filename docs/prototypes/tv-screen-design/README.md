# TV screen design prototype

Throwaway. Branch `prototype/tv-screen-flow`. Round two of the TV revamp on the start page: **what the TV looks
like.** The flow is fixed: the owner chose **apps** in round one (`docs/prototypes/tv-screen-flow/`). Here the same
flow, with the same screens and the same items, is dressed three ways.

## Open it

```
cd goodwatch-webapp
npm ci
npx remix vite:dev --port 3147
```

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
| Arrow keys, Enter, Escape or Backspace | Directions, OK, Back |
| `H`, `M`, `S` | Home, Menu, Search (typing on the search screen goes to the TV) |
| The Remote, mouse and touch on the TV | As in the flow prototype |

Every key is a plain key on a German keyboard: none needs Shift or AltGr. `&chrome=off` hides these controls.

## Fixed, as decided

- The apps flow: home with large app tiles and a preview of the focused one; Tonight, Discover, Explorer, Taste and
  (member) My shows as apps on the TV; a title screen; search; the menu; the four-answer quiz.
- One way out: the expand key at the top right of every app. Focusing it frames the whole picture, OK grows the
  picture into the page. Label "Expand" by default.

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

One image per screen, the three directions under each other at the TV's real size (1204 x 650):

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
direction. 01 home, 02 Tonight, 03 the moods, 04 the titles, 05 the expand key focused, 06 the map, 07 an island,
08 Taste before a taste, 09 the quiz, 10 a title, 11 rating, 12 search, 13 search results, 14 the menu, 15 What is
GoodWatch?, and for a member 16 home, 17 the three sides, 18 a side, 19 My shows.

## The TV's size

**Chosen: the TV takes 64% of the window's height** (today 41%). On a 1920x1080 window that is **1204 x 650 px**
(today about 771 x 416), so the TV's canvas (1200 x 648) is shown at 1:1 and every size in the code is the size on
screen.

- **The room** comes closer: the photo is scaled so its TV sits exactly there (1.97 times its base size). The wall,
  the shelves and the sideboard still frame the TV; the sofa and the table are out of the picture. The lights are
  lower (the dark veil goes from 12% to 34%), so the TV is the brightest thing in the room. The largest photo file
  (2560 px) is stretched by about 1.3 here and is slightly soft: the real build needs a tighter or larger render.
- **The Remote** stays centred under the TV, in the hand, at 0.70 of its size (today 0.77): 218 px wide instead of
  241. Less of it shows: the wheel, Back, Search, Home and Menu are on screen, **the two streaming keys run off the
  bottom** at 1080p. That is the price of this size, and a question below.
- Why not larger: every further percent of height shrinks the Remote; at 64% its wheel is 164 px across, which I
  take as about the smallest that still reads as the main control. Why not smaller: at today's size this canvas
  would be shown at 0.64, and 20 px type would be 13 px.

## Size numbers

Measured by `shots.mjs` in the room on a 1920x1080 window, over all 19 screens, at rest (without the growth of a
focused item); `sizes.json` has the output.

| | Smallest text | Where | Smallest focus target | Where |
| --- | --- | --- | --- | --- |
| Cinema | 21 px | the "Start" strip on a poster in My shows | 201 x 64 px | the expand key |
| Marquee | 20 px | "92 score" under a poster | 239 x 72 px | the expand key |
| Glow | 21 px | the facts line on a still | 201 x 64 px | the expand key |

Primary labels: app names 26 to 108 px, screen titles 36 to 62 px, a title's name 46 to 104 px, buttons 25 to 32 px
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

Usable at 390 px in all three (tap chooses, the Remote sits under the TV). What changes: the TV fills the width on
a taller canvas (520 x 640, shown at 0.75, so 20 px type is 15 px); rows show two and a half tiles and page
sideways; grids go to two columns; the maps become a grid of six islands; buttons stack; Cinema drops the line
under the focused title, Marquee the posters on home and the poster on a title, Glow the stills on home and on a
title. Not built: swiping, landscape, the room photo.

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
2. The TV at 64% of the height: right, or should it give some back so the Remote's two streaming keys show?
3. The room behind the larger TV: is the closer, darker room right, and should a new photo be made for it?
4. Cinema shows no name on a poster in a list (the name stands above for the focused one). Enough, or should
   every poster carry its name?
5. Should amber stay reserved for the way out (Cinema, Marquee), or may the focus use it too (Glow)?
6. My shows puts six shows in one row in Cinema and Marquee. Keep the row and let it page, or cut to the three
   next episodes?
7. The app pictures (the map, the fingerprint, Marquee's signs) are drawn in code as stand-ins. Should they be
   illustrated, or made from real art as Tonight and My shows are?

## Files

Added:

- `goodwatch-webapp/app/routes/prototype.tv-screen-design.tsx`: the route
- `goodwatch-webapp/app/ui/prototype-tv-design/scene.tsx`: the larger room, the TV, the Remote, the expand run per direction, the controls
- `.../base.tsx`: the apps flow (which screen shows what; item ids as in round one), the app pictures, the follower that glides to the focus
- `.../cinema.tsx`, `.../marquee.tsx`, `.../glow.tsx`: the three directions
- `.../art.ts`: TMDB poster and backdrop paths of the 25 sample titles
- `docs/prototypes/tv-screen-design/`: this file, `shots.mjs`, `walk.mjs`, `sizes.json`, `screens/`, `compare/`, `focus/`, `expand/`

Changed: `goodwatch-webapp/vite.config.js` (`PROTOTYPES` lists the route and the folder). Nothing in
`prototype-tv-flow` changed: the engine, the data, the focusable item and the title actions are imported as they
are, and the flow prototype works as before.

## Proof

- `npx remix vite:build` passes; `npx biome lint` on the added files is clean; `tsc` reports nothing in them.
- `walk.mjs`: 84 checks pass. 26 per direction (the apps, a mood, titles, Want to See, rating, the expand key and
  the way back, the menu, the map in four directions, the Remote's keys, search, the quiz, a member's My shows),
  and 6 for the direction buttons and the keys 1, 2, 3, including that the screen stays when the direction changes.
- `shots.mjs` made every picture, clip and number here.

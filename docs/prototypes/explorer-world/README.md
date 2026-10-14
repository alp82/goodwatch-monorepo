# Explorer, one world (round 10)

> Since October 14, 2026 the webapp reads no `REC_*` feature flag: what `on` did is what the site does
> (`docs/implementation/tv-screen-revamp/rec-flags/`). The flags here record how this was built and run then. A server
> of a later commit needs none of them.

The prototype behind the Explorer's one map. Its last round became the real Explorer on 2026-10-13 (`/explorer`,
`app/ui/explorer/`, `app/server/explorer/world.server.ts`), and the prototype's route and files were removed in the
same change; the rounds are in the history of branch `prototype/explorer-world`. What follows is the record of the
rounds, as written while they ran: paths under `prototype-rec-explorer-10` and `/prototype/rec-explorer-10` no longer
exist.

## The question

Today's Explorer shows one grouping at a time, and a bridge joins two islands of that grouping. The owner's idea (2026-10-12):
islands of different groupings should combine. So every grouping sits on the same map. Zoomed out, each grouping shows as a
whole; zoomed in, its islands are today's islands. The grouping control at the top flies to a grouping's area. The middle
of the map is kept free for the combination, which joins up to three islands.

What should that look like, and how do picked islands get to the middle?

## Verdict so far (owner, 2026-10-12)

`harbor` is the one to build on: islands sail to the middle from the first pick. It is now the default variant, and
the second round changed it:

- **After a pick the camera goes back out to the whole world**, so the next island can come from any group. With every
  place taken it goes to the combination instead.
- **Up to five islands combine** (was three). Four or five sit evenly around the combination, below its name, in the
  order of where they came from. The combination is then named by its first two islands "+ 3 more"; the bar lists all.
- **Islands that would leave the combination empty go grey and dark**, in the sea and from far out, and lose their name.
  The others keep their count ("9 in all 5").
- **One switch in the bar, "Combined" and "Show all"**, goes between the combination and the whole world. It is there
  from the first pick. The C key does the same on the map.

Screenshots of this round: `harbor2-*.png`.

Third round (owner, 2026-10-12):

- **A group's control or a tap on a group frames the group alone.** Side by side with the middle, the group came out
  too small: no names, and a tap on an island counted as a tap on the group. The switch in the bar reaches the middle.
- **The real Explorer's tutorial, with the world's steps:** tap a group, tap an island, tap another group, tap an
  island there, tap Combined, zoom into the combination, Separate. Each step loops until the viewer does it, as in
  the real one; guests see it on every visit, members on their first three. `harbor3-tutorial-*.png` show the seven
  steps.
 `causeways` and `gather` are unchanged apart from the limit of five.

Fourth round (owner, 2026-10-12): how a combination of three or more explains itself.

- **Separate, or letting the last island go, flies back out to the whole world.**
- **The bar says a sentence:** "15 titles that are Funny, Talky, about crime, from the 1990s, from the United States".
  Two decades or two countries read "from the 1980s or the 1990s", as the combination holds either. Two islands of
  one group are still today's bridge and keep "in both" and "between them".
- **Every other island says what it would leave:** "9 left" (was "9 in all 5").
- **The tutorial** says "Tap Combined to see what they share, or add another island" after the second island, and
  closes after Separate with "Combine up to 5 islands to narrow it down".

Screenshots: `harbor4-*.png`.

Fifth round (owner, 2026-10-12): Harbor is locked in, and the variants are now of the top bar.

- **The tutorial** drops "or add another island" and gets three steps before Separate: tap Show all, tap a third
  island (a group, then an island there), tap Combined. The full order: a group, an island, another group, an island,
  Combined, zoom in, Show all, another group, a third island, Combined, Separate, and the closing line.
- **`causeways` and `gather` are gone** from the route (they are in the branch's history, up to `8a0d40aa`).
- **The question now:** "All" said nothing about being the control that moves the map, and the filters should sit
  behind one Filters button and look like Discover's. Three variants, `?variant=tabs|menu|legend`:

| | `tabs` | `menu` | `legend` |
| --- | --- | --- | --- |
| Moving the map | a row captioned "Go to": Whole map, then each group with its color | one button, "Viewing: Whole map", that opens the list of places with their island counts | the list of places at the side of the map; nothing in the bar |
| Filters, from 768 px | a popover under the Filters button | a strip of controls in a row under the bar | a popover, and what's on shows as chips in the bar |
| Filters on phones | Discover's bottom sheet | Discover's bottom sheet | Discover's bottom sheet |

  In all three "All" is "Whole map" with a map icon, "Combined" joins the places once an island is picked, and the
  filters are Discover's own controls (`ui/filter-bar`: the Filters button with its count, the services control, the
  Not seen yet switch, the bottom sheet) with the type filter's segments. Screenshots: `bars-desktop.png`,
  `bars-phone.png`.
- **Known:** on phones `legend` shows the same row as `tabs` (there is no side to put a list on), and on desktop
  the legend covers the left edge of the map, which doesn't make room for it yet.

Sixth round (owner, 2026-10-13): the top bar is the `menu` one ("Viewing: Whole map", filters in a strip). The
variants are now of the selection bar, which was big and messy: on a phone three rows (chips and empty rings, the
sentence, the two-part switch) beside a tall Separate. `?variant=strip|chips|inline`:

| | `strip` | `chips` | `inline` |
| --- | --- | --- | --- |
| Where | one short line under the top bar | one line under the top bar | in the top bar, no line of its own |
| Closed | the islands' colors, "281 titles", Combined, Separate | each island's name with its cross, Combined, the count, a cross | the islands' colors and the count |
| The names and the sentence | open under the line, on a tap on the count | names always; no sentence | in a panel the button opens, with Combined and Separate |

In all three the two-part switch is one button that names where it goes ("Combined", or "Show all" once there), the
empty rings are gone ("1 of 5", and "3 more can join" in the details), and the tutorial's pointer lands on the same
buttons (in `inline` on the button that opens the panel, then on the one inside). Rows of the screenshots
(`selection-phone.png`, `selection-desktop.png`): strip, chips, inline; columns: one island, two, opened, five.

Known: in `chips` the names scroll sideways on a phone from the second island on.

Seventh round (owner, 2026-10-13): the selection is `inline`, reworked. No variants are left on the route.

- **In the top bar** (on phones in a row of its own under it): a button with the islands' colors and the count, the
  two views as a switch that is always there ("Combined", "Show all"), and Separate.
- **Opened, one row per island:** its first three posters framed in its color, its name and group, how many titles it
  holds, and what it does to the combination: "narrows 31 to 15" (the others hold 31 titles, with it 15 are left),
  with a bar for how much it keeps. A cross lets the island go. The sentence is gone from here; the map's own label
  and the count say what the combination holds.
- The counts without each island are one more read (`op=parts`).

On phones the row spans the screen: the count left, the two views in the middle, Separate right.

Screenshot: `selection-rows.png` (desktop with two and five islands, then the same on a phone).

## Run it

```sh
cd goodwatch-webapp
REDIS_COMMAND_TIMEOUT_MS=60000 REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
  REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3110
```

Then open `http://localhost:3110/prototype/rec-explorer-10`.
`?mix=mood:dark,decade:1980s,country:jp` holds the picked islands, so a link opens a combination.

- All eight `REC_*` flags are on, so the page around the map is the current design.
- `REDIS_COMMAND_TIMEOUT_MS` exists on this branch only. See "Found on the way".
- After a start the map says the islands aren't ready until the title snapshot has loaded (under a minute).
- Data: the real Explorer's pool, layouts, taste, and filters, read-only. Nothing is written.

## The same in every variant

- One world: each grouping's islands are laid out as today, in a region of its own. The regions sit on an ellipse around
  the middle. The world's shape follows the window's.
- Two levels. Out at the world a click on a region flies to it. In among a region's islands a click picks an island.
- The grouping control flies to a region and marks the region in the middle of the view. "All" shows the world.
- Up to five islands are picked, from any regions. The bar under the controls lists them as chips (each lets its island
  go), shows how many more can join, says what the combination holds, and switches between the combination and the
  whole world.
- With one to four islands picked, every other island says what the combination would hold with it added, and the islands
  that would leave it empty go grey.
- Two to five picked islands raise the combination in the middle. It behaves like today's bridge: zoom in for its tree.
- Nothing else moves: the middle is free, so no island has to make room.

## The variants

| | `causeways` | `gather` | `harbor` |
| --- | --- | --- | --- |
| A grouping from far out | its islands, small | one land that breaks into its islands as you come closer | its islands, small |
| Picked islands | stay home and light up; a band of light runs from each to the middle | sail to the middle and sit against the combination; an outline stays at home | sail to the middle from the first pick |
| The grouping control frames | the region | the region | the region |
| Camera after a pick | flies to the middle, from two islands | flies to the middle, from two islands | goes back out to the whole world |

Screenshots: `causeways-*.png`, `gather-*.png`, `harbor-*.png` (1440 by 900, and one phone view).

## What a combination holds

- Two islands of one grouping: today's bridge, unchanged (titles on both, or the titles between the two).
- Islands of different groupings: the titles on all of them.
- Two islands of a grouping where a title sits on one island only (Decade, Country, Your taste), with a third from
  elsewhere: either of the two. The same holds with four or five islands. 1980s + 1990s + Dark is Dark from both decades (269 titles).
- Titles are ordered by where they stand on each island together, as today's bridge orders them.

Examples from production data on 2026-10-12, with no filters: Dark + 1980s + Japan holds 3 titles (Ran, Akira, Tetsuo);
Funny + Crime + 1990s holds 39 (Pulp Fiction, Reservoir Dogs first); Scary + Animated holds 51. Funny + Crime + 1990s +
United States holds 30, and with Talky as the fifth 15.

## Found on the way

- **The sea draws 24 islands at most; the world has 64 (68 with Your taste).** The prototype gives the sea the picked
  islands, the combination, and the islands nearest the middle of the view, and paints the rest flat on the poster layer.
  With "lands" the sea also holds one land per region while zoomed out. A real build needs a decision here: raise the
  shader's limit, or keep a level of detail like this one.
- **Counts for every island cost little.** What all 63 other islands would hold with the picked ones takes about 70 ms on
  the server, a combination's tree about 20 to 50 ms.
- **A local dev server cannot load Explorer's data from this machine.** The cache client cuts every command at 1 second.
  This machine is 65 ms from the cluster, and the title snapshot's 4 MB chunks take about 3 seconds to read, so the
  snapshot never loads and every Explorer endpoint answers 503. Two other dev servers running on this machine on
  2026-10-12 answered 503 for the same request. This branch lets `REDIS_COMMAND_TIMEOUT_MS` raise the limit.

## Open questions

1. Which look from far out: islands small, or one land per grouping?
2. Do picked islands stay home or sail to the middle? Sailing shows the three islands next to what they make, as today's
   bridge does. Staying keeps every region whole.
3. Should the middle always be in view while picking (`harbor`), or is a flight there and back fine?
4. Islands of one grouping in a combination of three: is "either" right for Decade and Country? Mood + Mood + Decade
   means all three.
5. Does a combination of one island mean anything? `harbor` moves the first island to the middle and waits.
6. Your taste as a region: Near you + Dark + 1980s works by the same rule. Not looked at with a member's taste yet.
7. Five islands often leave few titles (15 in the example above). Is a small combination fine, or should the map say
   earlier that little is left?
8. Out at the world the islands are too small for their counts, so only the grey shows which ones are dead ends. Enough?

## Not built

The steps of the browser's history, the list for browsers without JavaScript, and the preview of a
combination while pointing at an island. The zoom rail's first stop is a region, not the world.

## Files

- `goodwatch-webapp/app/routes/prototype.rec-explorer-10.tsx` and `prototype.rec-explorer-10_.api.ts`
- `goodwatch-webapp/app/ui/prototype-rec-explorer-10/`: `engine10.ts` (the real engine, forked), `Explorer10.tsx` (the
  real page, forked), `world10.ts` (the world's layout), `variants10.ts`, `MixBar10.tsx`, `TopBar10.tsx`, `names10.ts`
- `goodwatch-webapp/app/server/prototype-rec-explorer-10.server.ts`: the world, combinations, and counts
- Two lines outside the prototype: `server/explorer/index.server.ts` exports its seat and layout functions, and
  `utils/cache.ts` reads `REDIS_COMMAND_TIMEOUT_MS`
- `shot.mjs` drove the page for the screenshots. It needs `playwright-core` installed in its folder, `/usr/bin/chromium`,
  and a dev server on port 3110; `--use-angle=gl` gives headless Chromium the real GPU, so the sea draws with WebGL

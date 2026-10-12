# Explorer, one world (round 10)

Throwaway prototype, on branch `prototype/explorer-world`. Not for `main`.

## The question

Today's Explorer shows one grouping at a time, and a bridge joins two islands of that grouping. The owner's idea (2026-10-12):
islands of different groupings should combine. So every grouping sits on the same map. Zoomed out, each grouping shows as a
whole; zoomed in, its islands are today's islands. The grouping control at the top flies to a grouping's area. The middle
of the map is kept free for the combination, which joins up to three islands.

What should that look like, and how do picked islands get to the middle?

## Run it

```sh
cd goodwatch-webapp
REDIS_COMMAND_TIMEOUT_MS=60000 REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
  REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3110
```

Then open `http://localhost:3110/prototype/rec-explorer-10`. The bar at the bottom switches variants (`?variant=`).
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
- Up to three islands are picked, from any regions. The bar under the controls lists them as chips (each lets its island
  go), shows how many more can join, says what the combination holds, and "Show" brings the middle into view.
- With one or two islands picked, every other island says what the combination would hold with it added, and the islands
  that would leave it empty go grey.
- Two or three picked islands raise the combination in the middle. It behaves like today's bridge: zoom in for its tree.
- Nothing else moves: the middle is free, so no island has to make room.

## The variants

| | `causeways` | `gather` | `harbor` |
| --- | --- | --- | --- |
| A grouping from far out | its islands, small | one land that breaks into its islands as you come closer | its islands, small |
| Picked islands | stay home and light up; a band of light runs from each to the middle | sail to the middle and sit against the combination; an outline stays at home | sail to the middle from the first pick |
| The grouping control frames | the region | the region | the region and the middle side by side |
| Camera on a new combination | flies to the middle | flies to the middle | stays, when the middle is in view |

Screenshots: `causeways-*.png`, `gather-*.png`, `harbor-*.png` (1440 by 900, and one phone view).

## What a combination holds

- Two islands of one grouping: today's bridge, unchanged (titles on both, or the titles between the two).
- Islands of different groupings: the titles on all of them.
- Two islands of a grouping where a title sits on one island only (Decade, Country, Your taste), with a third from
  elsewhere: either of the two. 1980s + 1990s + Dark is Dark from both decades (269 titles).
- Titles are ordered by where they stand on each island together, as today's bridge orders them.

Examples from production data on 2026-10-12, with no filters: Dark + 1980s + Japan holds 3 titles (Ran, Akira, Tetsuo);
Funny + Crime + 1990s holds 39 (Pulp Fiction, Reservoir Dogs first); Scary + Animated holds 51.

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

## Not built

The steps of the browser's history, the tutorial, the list for browsers without JavaScript, and the preview of a
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

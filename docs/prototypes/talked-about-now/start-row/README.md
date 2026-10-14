# Talked about now: the start page row (prototype, #541)

Throwaway. The question: how should the "Talked about now" row on the start page look and behave? Four variants
of the row, mounted at the top of the real section below the living room (`BelowRoom.tsx`), on the real room as a
guest sees it. `review.html` beside this file has the screenshots and the notes for the owner's review.

## Run it

From `goodwatch-webapp/`, in a worktree **without** `.env` (the main checkout's `.env` points at production Valkey),
after `npm ci` and `npx patch-package`:

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on \
REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3141
```

Open <http://localhost:3141/prototype/start-row?variant=A#browse>. The `#browse` opens the page below the room, as
the lip's "More below" does. Switch with the floating bar or ← and → (below the room only; up there the keys are
the TV's). The route has no loader dependency on any service and reads or writes nothing.

| Key | Name   | What it is |
|-----|--------|------------|
| A   | Ranked | Ten title cards with big outlined rank numbers, a "why it's hot" chip and one line of fact. Titles only. |
| B   | Mixed  | Each hot title followed by what is said about it: the trailer behind a click-to-load facade, a post, a headline. |
| C   | Ticker | One crawling line at the top of the section; Expand opens the ten as a compact list. The room's lip names the top three. |
| D   | Pulse  | A board with each title's 14-day buzz curve and "×2.4 its usual"; the lead title large with its curve and its best content. |

## Files

- `goodwatch-webapp/app/routes/prototype.start-row.tsx`: the route, the living room with guest data.
- `goodwatch-webapp/app/ui/prototype-start-row/`: the sample data (`data.ts`), the shared pieces (`kit.tsx`), one
  file per variant, and the switcher (keeps `#browse` in the address).
- `goodwatch-webapp/app/ui/living-room/BelowRoom.tsx`: a prototype slot (`BelowRoomPrototypeSlot`), empty on the
  real page. Drop it when the prototype goes.
- `vite.config.js`: `prototype.start-row*` and `prototype-start-row` in `PROTOTYPES`, so a production build leaves
  them out.
- `shots.mjs`: the screenshots for `review.html`
  (`PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3141 node shots.mjs <out dir>`).

## The sample data

Real titles that are in the news in the week of 14 October 2026 (Netflix's Top 10, the October premieres, the
December blockbusters), with their TMDB ids, posters and backdrops. The reasons follow the week's news; the
numbers, the buzz curves, the posts' authors and the exact headlines are made up. No third-party request is made:
the video facade's picture is the title's TMDB backdrop, and pressing it shows a stand-in for the player.

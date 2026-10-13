# Explorer, the way to the title page

Throwaway prototype, on branch `prototype/explorer-world`. Not for `main`.

## The question

On the Explorer, a title's card ends with a small underlined link, "Open the title page", next to "Not interested".
It is easy to miss (owner, 2026-10-13). What should the way to the title page look like, as a more natural control
with more to see?

## Run it

A dev server with `REC_EXPLORER` on (see `docs/prototypes/explorer-world/README.md` for the command), then
`/prototype/rec-explorer-open`. Zoom into an island and tap a poster to open its card. The bar at the bottom
switches variants (`?variant=`).

It is the real Explorer with its card forked. One seam in production code lets the page take another card:
`Card` on `ExplorerMap` (`app/ui/explorer/ExplorerMap.tsx`). Remove it with the prototype.

## The variants

Each uses the expand motif and the one word "Details".

| | `tile` | `hero` | `bar` | `current` |
| --- | --- | --- | --- | --- |
| What | a door in the middle of the card: the poster, "Details", and what's behind it ("Cast, trailer, where to watch"), in the island's color | the card's picture is the door: all of it is the link, with a "Details" pill on it | one wide, bright button at the foot of the card | today's link |
| Where | above the score control | the top of the card | under Want to See and Seen it | under the actions, left |
| Height it adds | about 87 px | none | about 56 px | none |

Screenshots: `desktop.png`, `phone.png` (in the order of the table).

## Seen while building

- **On a phone the card is a sheet of half the screen.** `tile` pushes Want to See and Seen it under its edge, and
  `bar` sits at the edge itself (in the screenshot it is under the prototype's switcher). `hero` costs no height.
- **`hero` makes the whole picture a link**, so a tap on the picture leaves the map. The pin and close buttons stay
  above it.
- "Not interested" moves to the right, alone, in the three new variants.

## Files

- `goodwatch-webapp/app/routes/prototype.rec-explorer-open.tsx`
- `goodwatch-webapp/app/ui/prototype-rec-explorer-open/OpenCard.tsx`
- The seam: `Card` on `ExplorerMap`

# Prototype: crawlable links on the start page (#352)

The question: where on the start page do plain, visible links to title pages and hubs go, when the living room
fills the window and the page can't scroll?

The prototype is on the branch `prototype/start-page-links` (never merged), with its screenshots and numbers in
this folder there.

## What was tried

| Variant | Placement | Outcome |
| --- | --- | --- |
| `strip` | Small text links along the bottom edge, inside the fixed room | Dropped. On a phone two lines hold 2 titles and 7 hubs; the rest is a sideways swipe away |
| `tv` | The TV home screen's posters as links, plus two slim link rows on the TV | Dropped. Links under 9 px on screen at every size, and every link is sent three times |
| `scroll` | The room is the first screen; a text section follows it | Chosen, in round 2's form |
| `scroll2` | The same section as a programme page: large titles, the hubs as a plain index | Its title list was chosen |

## What was decided

- The room is the first screen of a guest's start page and keeps the wheel, the swipe, and the keys. The page moves
  to the section only by a control at the room's bottom edge (the lip), and back by a back control, Escape, browser
  Back, or scrolling up to the very top.
- The section is `scroll`'s: the title list, six hub cards, and the mood, genre, and streaming hubs as chips. The
  title list is `scroll2`'s large numbered programme, with a poster for each title.
- The titles are the first 16 of the living room pool for a visitor nobody knows anything about.

The build is in `goodwatch-webapp/app/ui/living-room/` (`BelowRoom.tsx`, `use-below-room.ts`, and the last part of
`living-room.css`).

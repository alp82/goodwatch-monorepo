# The intro on the start page

The start page's TV opens with a boot screen, then plays a guest a short film about GoodWatch, about 77 seconds in
ten chapters, ending in a quiz that gives a real pick. Below the room, "How GoodWatch works" carries the same chapters
as page content: it is what a crawler reads. The film was chosen in a prototype (branch `prototype/landing-experience`)
over fourteen rounds of review.

## What a visitor gets

| Visitor | What the TV does |
|---|---|
| A guest, new tab | Boot screen, then the film from "Let's watch" |
| A member, new tab | Boot screen, then the TV's home |
| Back in the same tab, film playing | The film from the scene they were at, no boot screen |
| Back in the same tab, after Just look around (or a member) | The TV's home, no boot screen |
| Back from sign-up after tapping titles in the quiz | The quiz as they left it, with their pick |
| Anyone, "What is GoodWatch?" in the TV's menu | The film from its first scene |
| A link to a TV screen (`?tv=…`), or the Remote opening one | The TV, the film steps aside |

The rules are `introStart` in `app/ui/living-room/intro/progress.ts` (tested in `progress.test.ts`). Progress is kept
in `sessionStorage` (`gw-intro`, and the quiz's `gw-intro-taps`), so a new tab starts fresh and nothing leaves the
browser. An inline script on the start page (`BOOT_SEEN_SCRIPT`) hides the boot screen before it paints when the tab
has progress, so a reload doesn't flash it.

## Files

- `app/routes/_index.tsx`: renders the room with `useHomeIntro`, links `boot.css` and `how-goodwatch-works.css`.
- `app/ui/living-room/intro/`
  - `HomeIntro.tsx`: decides what the TV shows, listens for Just look around, "Watch in the intro" and the TV's About screen.
  - `boot.tsx`, `boot.css`: the boot screen, plain markup and CSS in the server's HTML.
  - `FilmScreen.tsx`: loaded on demand (`lazy`): reads `/api/intro`, then plays the film. Its code and `intro.css` are not on the page's first load.
  - `player.tsx`: plays scenes with their hand-overs, the chapter bar, Next and Replay.
  - `scene.ts`: the chapters (`CHAPTERS`, in film order) and the scene contract.
  - `film.ts`: one scene per chapter, in `CHAPTERS` order.
  - `scenes/`: one file per chapter. `parts/`: what scenes share. `quiz/taste-quiz.tsx`: the quiz.
  - `progress.ts`, `events.ts`, `data.ts`: progress rules, page events, data shapes.
- `app/ui/living-room/HowGoodWatchWorks.tsx`, `how-goodwatch-works.css`: the section below the room (the page's H1).
- `app/routes/api.intro.ts`, `app/server/living-room/intro/`: the film's data.

## Data

- `content.json` is a snapshot of the catalog taken on 2026-10-17: the intro's titles and their feeling words, the
  five numbers behind "One score", the search phrase with the site search's own reading and results, the streaming
  wall and its counts, the Explorer's islands and combination, the filter steps and counts, the pick (Avatar, from the
  guest recommendations for Interstellar and Inception) and its feelings, the franchise of each shown movie. Nothing
  here runs the site's search or other costly work per request; the combined search writes `search_history` and costs
  money, so never call it from the intro.
- Per request (`intro.server.ts`), kept ten minutes per country and services: the titles as cards with their services
  where the visitor is (`getTitleCards`), and the streaming chapter's title on Netflix there (`netflix.server.ts`, one
  Crate read per country, kept six hours). Without such a title, the chapter shows the snapshot's rows without "You".
- `/api/intro?cards=movie:603,…` reads up to ten titles as cards for the quiz's pick.

To refresh the snapshot, read the same things again and replace `content.json`: the queries are in the prototype
branch (`app/server/prototype-intro/`). The counts drift slowly; the titles and pictures don't.

## Changing the film

- Reorder: reorder `CHAPTERS` in `scene.ts` (the chapter bar and "How GoodWatch works" follow; keep the quiz last).
- Change a chapter: change its scene in `scenes/` and its entry in `film.ts` (`ms` must cover its animations).
- A scene sizes everything in container units, scales every time by `--k`, animates only transform and opacity, and
  shows its last frame with reduced motion (`scene.ts`).

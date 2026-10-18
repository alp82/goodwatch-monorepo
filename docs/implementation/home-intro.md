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
| A reload before the film is done (not left, quiz not reached) | Boot screen, then the film from "Let's watch" |
| A reload after Just look around, or at the quiz | As if back in the same tab |
| The TV's power key: off | The film stops; nothing of the intro shows |
| The TV's power key: on | Boot screen, then a guest's film from "Let's watch" (a member's TV home) |
| Anyone, "What is GoodWatch?" in the TV's menu | The film from its first scene |
| A link to a TV screen (`?tv=…`), or the Remote opening one | The TV, the film steps aside |

The rules are `introStart` in `app/ui/living-room/intro/progress.ts` (tested in `progress.test.ts`). Progress is kept
in `sessionStorage` (`gw-intro`, and the quiz's `gw-intro-taps`), so a new tab starts fresh and nothing leaves the
browser. An inline script on the start page (`introStartScript`) runs before the room paints: on a reload of an
unfinished film it forgets the tab's progress, so the film starts over; any other kept progress hides the boot screen,
so coming back doesn't flash it. The power key reaches the intro through `TvLivingRoom`'s `onPower`.

## Loading

The start page paints from the server's HTML alone: the room, the boot screen and "How GoodWatch works" need no
script, and hydration moves nothing. So the page's scripts start after it has painted:

- `_index.tsx` has the handle `START_AFTER_PAINT`, and the root gives Remix's `Scripts` the `startAfterPaint` writer
  (`app/utils/start-after-paint.ts`, a patch in `patches/@remix-run+react+2.17.2.patch`). The HTML then has no module
  preloads and no module script, only a small classic script. It adds both once the browser reports the first
  contentful paint and the paint of every room picture this window shows (`HERO_TIMING`, the `elementtiming`
  attribute; Element Timing). Without Element Timing it waits for the first contentful paint only, without paint
  timing it starts at once, and after 5 seconds it starts anyway.
- The film's wait counts from the first paint (`sinceFirstPaint` in `HomeIntro.tsx`), as the boot screen does, so
  the film still deals in as the boot screen fades when hydration comes later.
- The room's pictures load first: `fetchpriority="high"` on the photos and the hand (the LCP on phones).
- What the first paint needs loads while the server renders: the 103 Early Hints response preloads `tailwind.css`,
  the three sheets of `app/ui/living-room/home-sheets.ts`, the brand font, and the room's pictures for a phone or a
  desktop, which the page asks for with `crossorigin` ([static-assets.md](../static-assets.md#early-hints)).
- "How GoodWatch works" items have `content-visibility: auto`: an item below the first screen is laid out, and its
  lazy pictures load, when it comes near the window. Its logos and fingerprint are copies at three times their shown
  size (`-78`, `-156`).
- `intro.css` loads with the film's code, never with the page: `vite.config.js` keeps style sheets out of the shell
  chunk.

On October 18, 2026 this took the mobile Lighthouse score from 82 to 96 (local production build behind TLS and
HTTP/2, five runs each). What is left on a phone's first view is the network: the document, then a second connection
to the static hostname for the style sheets, the font and the room's pictures. Served from the site's own host, the
same build scored 99 (FCP 1.4 s, LCP 2.1 s instead of 1.8 s and 2.6 s).

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

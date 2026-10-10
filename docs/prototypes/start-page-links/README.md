# Prototype: crawlable links on the start page (#352)

Throwaway. This branch (`prototype/start-page-links`) is never merged. It answers one question for the owner:
where on the start page do plain, visible links to title pages and hubs go?

Three placements, on the real `/`, rendered on the server for a visitor without cookies:

| Open | Placement |
| --- | --- |
| `/` | Today's page, unchanged |
| `/?links=strip` | Small text links along the bottom edge, inside the fixed room |
| `/?links=scroll` | The room is the first screen; the page scrolls to a text section and the site footer |
| `/?links=tv` | The TV home screen's posters are links, plus two slim link rows on the TV |

A switcher pill at the top of the window steps through them (development builds only; `&bar=0` hides it).

## Run it

```sh
cd goodwatch-webapp
REDIS_COMMAND_TIMEOUT_MS=300000 npx remix vite:dev --port 5391
```

The links come from the title snapshot, which the dev server reads from production Valkey. From a developer machine
that read takes about 20 seconds and fails under the one-second command limit, so this branch lets
`REDIS_COMMAND_TIMEOUT_MS` raise it. Until the snapshot is loaded (first request plus about 30 seconds) the variants
render without title links.

## The links

All variants share one list: the first 16 titles of the living room pool for a visitor nobody knows anything about
(`poolCandidates` and `selectPoolKeys` by popularity, titles from `getDisplayFields`). No country and no viewer go
into it, so the HTML is the same for every guest. The list is only loaded with `?links=`, so `/` without it is
today's HTML.

On October 10, 2026 the list was 13 shows and 3 movies, with "Raw", "The Tonight Show Starring Johnny Carson", and
"Doraemon" in it. The pool is built to seed picks, not to be the titles Google should find first: a real build
needs its own choice of titles.

The hubs: `/discover`, `/movies`, `/shows`, `/explorer`, `/taste`, `/how-it-works`, `/movies/moods`, `/shows/moods`,
`/movies/genres`, `/shows/genres`, `/movies/streaming`, `/shows/streaming`.

## Screenshots

Desktop is 1440 x 900. Phone is 390 x 844 at two device pixels per pixel, taken 10 seconds after load (after
hydration and after the "Turn your phone" hint is gone). The TanStack Query devtools button is hidden in them.

| Variant | Desktop | Phone |
| --- | --- | --- |
| today | [today-desktop.png](today-desktop.png) | [today-phone.png](today-phone.png) |
| strip | [strip-desktop.png](strip-desktop.png) | [strip-phone.png](strip-phone.png) |
| scroll | [scroll-desktop.png](scroll-desktop.png), [scrolled](scroll-desktop-scrolled.png) | [scroll-phone.png](scroll-phone.png), [scrolled](scroll-phone-scrolled.png) |
| tv | [tv-desktop.png](tv-desktop.png) | [tv-phone.png](tv-phone.png) |

## Numbers

Server HTML from `curl` without cookies against the dev server (`measure.py`). The baseline is `/` on this branch,
which runs the same code as `origin/main` without the parameter. Bytes are gzip level 6 of a development build: the
absolute sizes are not production's, the differences are close to it.

| | today | strip | scroll | tv |
| --- | --- | --- | --- | --- |
| Title pages linked in the HTML | 0 | 16 | 16 | 16 |
| Title link tags | 0 | 16 | 16 | 32 (each twice: desktop and phone edition of the TV) |
| Hubs linked in the HTML, of 12 | 6 | 12 | 12 | 12 |
| Added HTML, gzip | | +1,042 bytes | +1,125 bytes | +2,314 bytes |
| Added HTML, raw | | +5,113 bytes | +7,664 bytes | +16,191 bytes |
| Poster `<img>` tags in the HTML | 0 | 0 | 0 | 12 (6 files) |

What a visitor sees on the first screen, measured in the browser (`shoot.mjs`: a link counts when its middle is
inside the window and nothing covers it):

| | strip | scroll | tv |
| --- | --- | --- | --- |
| Desktop: title links on the first screen | 13 of 16 | 0 (all 16 after scrolling) | 16 |
| Desktop: text size of the links | 12.5 px | 15 px | 8.6 px (13 px on the TV canvas) |
| Phone: title links on the first screen | 2 (the line scrolls sideways) | 0 (all 16 after scrolling) | 12: 6 posters 19 to 32 px wide, 6 as text |
| Phone: hubs linked on the first screen, of 12 (today: 4, in the site's navigation) | 7 (the line scrolls sideways) | 4 (all 12 after scrolling) | 8, the rest cut off |
| Phone: text size of the links | 12 px | 15 px | 8.3 px |
| Layout shift in the browser (dev build, desktop / phone) | 0.0002 / 0 | 0 / 0 | 0.0002 / 0 |
| Image requests on a phone (today: 20 in the dev build) | 20 | 18 | 20 |

## Against the home budget (`goodwatch-benchmark/urls/budget.json`)

Estimates. `./bench.sh budget` was not run: it needs a deployed build.

| Line | Limit | strip | scroll | tv |
| --- | --- | --- | --- | --- |
| `html_bytes` | 18,944; the budget document's table has 16.4 KB measured | about 17.8 KB: passes with half the margin left | about 17.9 KB: passes with half the margin left | about 19.1 KB: fails by about 0.2 KB, unless the links stop being sent three times (two TV editions and the loader data) or the limit is raised |
| `image_count` | 20, 18 today | no change | no change for a visitor who doesn't scroll; the footer's images are lazy but now reachable | no new file for a first-time visitor: the same six posters load today after the pool request. They now start with the first paint and compete with the room photo (the LCP element) |
| `script_count` | 16, no margin | no new script expected; not verified with a build | same | same |
| `cls` | 0.01 | 0 measured: the first-paint CSS and the measured layout reserve the same strip | 0 measured: the room has a fixed height | 0 measured: posters have fixed boxes |

## What each variant leaves for a real build

**strip**

- The first-paint CSS and `layoutPhone` both have to keep the Remote's keys out of the strip. The prototype shrinks
  the Remote on a phone by 72 px of height for it.
- The bottom navigation's round key sticks 24 px up into the room, so on a phone the strip needs an empty band
  under its lines.
- Phone landscape has no bottom edge to spare: the strip lies over the Remote there. Not solved.
- On a phone two lines hold 2 titles and 7 hubs. The rest is in the HTML and one sideways swipe away, which is
  close to the hidden block the issue wants to leave behind.

**scroll**

- Arrow keys, Backspace, H, and M belong to the Remote (`useRemoteKeys`). The prototype gives them back to the
  page after 80 px of scroll. Page Down and Space scroll already.
- A wheel or a swipe that starts on the Remote's D-pad doesn't scroll the page. On a phone the D-pad is in the
  middle of the screen, where a thumb starts a swipe.
- `useLeaveThroughTv` and `useReturnIntoTv` measure the TV in the window. Scrolled down, the TV is outside the
  window and the transition grows from the top edge. Back also has to restore the scroll position before it runs.
- Phone landscape puts the room over the whole window (`inset-y-0 z-[1001]`). The prototype keeps that, so the
  section is in the HTML but not reachable in landscape.
- The room's height is `100dvh` minus the site header (and minus the bottom navigation below 1024 px): the mobile
  address bar changes `dvh` while scrolling, and every change measures and lays out the room again.
- Nothing says there is more below. The prototype adds a "Popular right now" pill at the bottom right, which
  covers a Remote key on a phone.
- The footer starts 12 rem under the section (`mt-48`) and now shows on the start page, with its Discord banner.

**tv**

- A link can't sit inside a button, and the home's cards are buttons. The prototype stretches the button under the
  card and lays the posters on top. Pointing at a poster then doesn't focus its card, and the Remote can't reach a
  poster or a link row.
- The posters are fixed to the shared list. Today the fans show the pool's picks, which differ for a guest with
  progress and for a member. A real build decides whether the home's posters stay the same for everyone.
- Everything on the TV is drawn on a 960 px canvas scaled to about 0.65, so a 13 px link is under 9 px on screen at
  both sizes, and a phone's posters are 19 to 32 px wide: below any tap target, and too small for captions.
- The TV has two editions in the first HTML, so every link is sent twice, and a third time in the loader data.
- The link rows take 34 px of canvas height from the cards in both editions.

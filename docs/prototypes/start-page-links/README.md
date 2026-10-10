# Prototype: crawlable links on the start page (#352)

Throwaway. This branch (`prototype/start-page-links`) is never merged. It answers one question for the owner:
where on the start page do plain, visible links to title pages and hubs go?

Round 1 built three placements. The owner picked `scroll`; round 2 rebuilt it with a designed section and one
behaviour change: the page does not react to scrolling, only to a control in the room.

| Open | Placement |
| --- | --- |
| `/` | Today's page, unchanged |
| `/?links=scroll` | Round 2. The room is the first screen and keeps the wheel, the swipe, and the keys. A lip at its bottom edge leads to a text section below it |
| `/?links=scroll2` | Round 2, second look of the same section |
| `/?links=strip` | Round 1. Small text links along the bottom edge, inside the fixed room |
| `/?links=tv` | Round 1. The TV home screen's posters are links, plus two slim link rows on the TV |

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
today's HTML. The owner chose to keep the pool's top 16.

The hubs: `/discover`, `/movies`, `/shows`, `/explorer`, `/taste`, `/how-it-works`, `/movies/moods`, `/shows/moods`,
`/movies/genres`, `/shows/genres`, `/movies/streaming`, `/shows/streaming`.

## Round 2: `scroll` and `scroll2`

### What it is

The room is a block exactly one first screen tall. Right after it in the document comes a `<section id="browse">`
with the 16 titles and the 12 hubs as text. The section's top edge, the lip, lies over the bottom of the room: a
full-width bar on a phone, a tab at the bottom right from 768 px up, a tab at the bottom left in phone landscape.
The lip is the control. On a phone the Remote is 60 px shorter so its keys end above the lip.

`scroll` and `scroll2` are the same markup with two looks:

- `scroll`: a numbered list in four columns (two on a tablet, one on a phone), then the six main hubs as cards and
  the six category hubs as chips.
- `scroll2`: a programme page. Large titles in two columns at the right, the ways to browse as a plain index at the
  left, a warm light from the room in the corner. On a phone it is one column with larger titles.

No poster, no icon font, no new script file, no new font: the section uses Gabarito, which the room already loads.

### Interaction rules

| Where the visitor is | Wheel, swipe, arrow keys, Page Down | How to leave |
| --- | --- | --- |
| In the room | The room's and the Remote's, as on today's page. The page does not move | Press the lip: the page moves to the section (smooth scroll; instant with reduced motion) |
| In the section | Scroll the page like any page: the section, then the site footer | "Back to the living room" at the top and at the end of the section, Escape, or scrolling up to the very top |

- Scrolling up from the section shows the room coming back. At the very top the page is the room's again.
- Tab from the lip goes into the section's links. The browser brings the focused link into view, and from then on
  the visitor counts as being in the section.
- Phone landscape keeps today's full-window room over the site header. Pressing the lip slides the room up out of
  the window (transform only) and the section is under it; the same ways lead back.
- Without JavaScript the lip is a link to `#browse` and the way back a link to `#room`. CSS alone lets the page
  scroll while the URL ends in `#browse`.
- With JavaScript the URL does not change. A fragment change goes through the router, which then restores an old
  scroll position. So browser Back does not lead from the section to the room.

Checked in a browser by `shoot-v2.mjs` at 1440 x 900, 390 x 844, and 844 x 390, for both looks: wheel, Arrow Down,
and Page Down in the room leave the page at 0; the lip leads to the section; the wheel scrolls there; Escape, the
back control, and scrolling up to the top each return to 0 with the page locked again; three Tabs from the lip put
"Resident Evil" in view; without JavaScript the lip and the back link work.

### How the links are present for a crawler

- The section is server HTML for a visitor without cookies, in normal document flow as the next sibling of the
  room inside `<main>`. Every title and hub is an `<a href>` with its name as text, 14 to 22 px.
- Nothing hides it: no `display: none`, `visibility: hidden`, `opacity`, `aria-hidden`, `hidden`, `inert`, clip,
  off-screen position, or transform on the links or any ancestor. `seo-check.mjs` walks every ancestor of all 28
  links, with and without JavaScript, and finds none.
- It is below the first screen, like any content below a hero. The page's `overflow: hidden` stops a person's
  wheel; it does not remove the section from layout. In a 412 x 732 window the links are at 863 to 2,594 px of a
  3,966 px document. A renderer that lays out the whole page without clicking or scrolling has them.
- The room is `100dvh` tall, so a renderer with a very tall window would get a very tall room. The room is capped
  at 1,600 px for that.
- Phone landscape is the one case where the room covers the section until the lip is pressed (the room is fixed
  over the window there). The section is still in flow under it. A phone crawler renders portrait.

### Screenshots, round 2

Desktop is 1440 x 900. Phone is 390 x 844 and phone landscape 844 x 390, both at two device pixels per pixel.
`take2` is `scroll2`. The TanStack Query devtools button is hidden in them.

| | Room with the lip | Moving | Section | End of the section |
| --- | --- | --- | --- | --- |
| scroll, desktop | [room](scroll-v2-desktop-room.png) | [moving](scroll-v2-desktop-moving.png) | [section](scroll-v2-desktop-section.png) | [end](scroll-v2-desktop-section-end.png) |
| scroll, phone | [room](scroll-v2-phone-room.png) | [moving](scroll-v2-phone-moving.png) | [section](scroll-v2-phone-section.png) | [end](scroll-v2-phone-section-end.png) |
| scroll, phone landscape | [room](scroll-v2-landscape-room.png) | | [section](scroll-v2-landscape-section.png) | [end](scroll-v2-landscape-section-end.png) |
| scroll2, desktop | [room](scroll-v2-take2-desktop-room.png) | [moving](scroll-v2-take2-desktop-moving.png) | [section](scroll-v2-take2-desktop-section.png) | [end](scroll-v2-take2-desktop-section-end.png) |
| scroll2, phone | [room](scroll-v2-take2-phone-room.png) | [moving](scroll-v2-take2-phone-moving.png) | [section](scroll-v2-take2-phone-section.png) | [end](scroll-v2-take2-phone-section-end.png) |
| scroll2, phone landscape | [room](scroll-v2-take2-landscape-room.png) | | [section](scroll-v2-take2-landscape-section.png) | [end](scroll-v2-take2-landscape-section-end.png) |

### Numbers, round 2

Server HTML from `curl` without cookies against the dev server (`measure.py`), gzip level 6. The baseline is `/` on
this branch. The absolute sizes are a development build's; the differences are close to production's.

| | today | scroll | scroll2 |
| --- | --- | --- | --- |
| Title pages linked in the HTML | 0 | 16 | 16 |
| Hubs linked in the HTML, of 12 | 6 | 12 | 12 |
| Added HTML, gzip | | +1,189 bytes | +1,193 bytes |
| Added HTML, raw | | +4,756 bytes | +4,762 bytes |
| `<img>` tags in the HTML | 14 | 14 | 14 |
| Layout shift in the browser (desktop / phone / phone landscape) | | 0.0002 / 0 / 0 | 0.0002 / 0 / 0 |

Against the home budget (`goodwatch-benchmark/urls/budget.json`), estimated; `./bench.sh budget` was not run:

- `html_bytes` (18,944; the budget document's table has 16.4 KB measured): about 18.0 KB, about 0.95 KB left.
- `image_count`: no new image. `script_count`: no new script file expected; the hook is about 60 lines in the
  living room's own module. Not verified with a build.
- `cls`: the lip and the shorter phone Remote are in the first-paint CSS, so nothing moves at hydration.

### What a real build still has to solve

- Where the visitor is should be one state with one owner. The prototype has two: `#browse:target` without
  JavaScript and `data-lr-below` on `<html>` with it. A visitor who arrives on a URL ending in `#browse` goes back
  to the room through a fragment change, which the router answers with its scroll restoration.
- Browser Back from the section to the room, and Back from a title page to the section at the place it was left.
- `useLeaveThroughTv` and `useReturnIntoTv` measure the TV in the window. Scrolled halfway up from the section, the
  TV is partly outside it.
- Touch on real phones: the lock relies on `overflow: hidden` on `<html>`, as today's page does, but today's page
  has nothing to scroll to. iOS Safari's rubber band and address bar need a look on a device. The room's height
  follows `dvh`, so the address bar showing and hiding lays the room out again.
- Between the room and the section the page can rest halfway (after a Tab, or after scrolling up a little). The
  keys are the page's there and the Remote is in view but idle. A real build may want to snap.
- Phone landscape: the room slides away but still takes keyboard focus while it is off screen.
- The bottom navigation's round key lies over the middle of the phone lip. The lip keeps its text left of it; a
  real build should make the two one design.
- The Remote is 60 px shorter on a phone, in `layoutPhone` and in the first-paint CSS. Both have to stay in step.
- The site header slides away while the page moves down and comes back when it stops (its own behaviour), which
  shows during the move.
- The title list: on October 10, 2026 the pool's top 16 was 13 shows and 3 movies. The owner chose to keep it.

## Round 1: `strip` and `tv`

Screenshots: [today-desktop.png](today-desktop.png), [today-phone.png](today-phone.png),
[strip-desktop.png](strip-desktop.png), [strip-phone.png](strip-phone.png), [tv-desktop.png](tv-desktop.png),
[tv-phone.png](tv-phone.png). Taken 10 seconds after load (`shoot.mjs`).

| | today | strip | tv |
| --- | --- | --- | --- |
| Title pages linked in the HTML | 0 | 16 | 16 (32 tags: desktop and phone edition of the TV) |
| Hubs linked in the HTML, of 12 | 6 | 12 | 12 |
| Added HTML, gzip | | +1,042 bytes | +2,314 bytes |
| Desktop: title links on the first screen | 0 | 13 | 16 |
| Desktop: text size of the links | | 12.5 px | 8.6 px |
| Phone: title links on the first screen | 0 | 2 (the line scrolls sideways) | 12: 6 posters 19 to 32 px wide, 6 as text |
| Phone: text size of the links | | 12 px | 8.3 px |
| `html_bytes` estimate against 18,944 | 16.4 KB | about 17.8 KB | about 19.1 KB: fails |

**strip** leaves for a real build: the first-paint CSS and `layoutPhone` both have to keep the Remote's keys out
of the strip (72 px on a phone); the bottom navigation's round key needs an empty band under the lines; phone
landscape is not solved; on a phone two lines hold 2 titles and 7 hubs, the rest is one sideways swipe away.

**tv** leaves for a real build: a link can't sit inside a button, and the home's cards are buttons, so the
prototype stretches the button under the card and the Remote can't reach a poster or a link row; the posters are
fixed to the shared list where today they are the viewer's picks; a 13 px link on the TV canvas is under 9 px on
screen; every link is sent three times (two TV editions and the loader data).

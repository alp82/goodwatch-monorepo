# The new TV: first paint, hydration and layout shift (slice 12)

Verified on 2026-10-14 on `feat/tv-slice-12-budgets` (the integration branch `feat/tv-screen-revamp` at `60c235a8`
merged in), on `/home-preview`. Plan: [docs/implementation/tv-screen-revamp](../implementation/tv-screen-revamp/README.md),
slice 12 and section 5 ("SSR and hydration"). Not deployed: there is no deploy target for the branch.

## What was wrong

Before this slice the server's HTML held the TV's screen in both editions, not painted (`opacity: 0`), and nothing
else: no room photo, no TV, no Remote. Until the script had measured the window the start page was a dark block,
and Lighthouse's largest paint came after hydration.

## What the first paint is now

- **Every layout's parts are in the server's HTML**: the desktop's room photo, TV and Remote in its hand; the phone's
  room (wall, sideboard, stand, framed TV) with the phone's Remote in both forms (in the hand, on the table) and the
  hand; landscape's framed TV in front of the desktop photo. `ui/living-room/tv/TvRoom.tsx`, `PhoneRoom.tsx`,
  `PhoneRemote.tsx`.
- **`tv.css` places them** where `layoutRoom`, `layoutPhoneRoom` and `layoutPhoneLandscape` will, number for
  number, and shows the parts of the window's layout. The room is a size container; its children read its size as
  registered lengths (`--f-w`, `--f-h`), so every derived value is in pixels.
  - Desktop, Remote under the TV: a room of at least 1107.075 x 853.124 px (a container query; `room-render.test.ts`
    checks the two numbers against `layoutRoom` on either side). Beside it otherwise.
  - The phone's form joins width and height (in the hand where `H - 319 >= (W - 28) / 1.2`), which no query can. The
    rig's width says it: 2 px in the hand, 1 px on the table, and the two forms ask the rig (`@container tvr-form`).
  - Landscape: in the hand from 282 px of room (from 768 px wide, the tab) or 296 px (the bar under 768).
- **The same nodes survive hydration.** Each part that stays keeps its element, so no picture is drawn anew, and
  each photo asks for nothing where the other room is drawn (a `<source>` with a blank picture for the other
  layout's media query, in the first paint only).
- **Three things were changed so hydration changes nothing:**
  - The phone/desktop split reads the window's width, as the lip and the dock do. With a scrollbar's gutter (15 px
    here) the room's own width and the window's queries disagreed between 768 and 783 px: the first paint drew the
    desktop photo, the script the phone's.
  - The room is measured to the fraction of a pixel (`getBoundingClientRect`), as the CSS reads it. A phone's
    window often has a fractional height.
  - The desktop's whole TV picture is always `w1280` (a tile keeps the 900 px rule): the first paint cannot know
    the picture's width, and the old rule switched files on hydration for desktop windows under about 1210 px.
  - The phone's top bar keys get their measured height from `tv.css` (`--tv-key`, `keyLength` in `kit.tsx`).
  - The lip's second line hides by the window's size, before and after hydration alike.

## The proof

`docs/implementation/tv-screen-revamp/budgets/drive.mjs paint`, at 31 sizes: every desktop size of the prototype's
table, a tablet each way, every phone of slice 2 and Lighthouse's 412 x 823, and the sizes on either side of each
threshold (1123 x 918 / 1122 x 918 / 1123 x 917; 390 x 757 / 390 x 756; landscape 800 x 282 / 800 x 281). For each:

1. The page with its scripts stopped (the server's HTML and the stylesheets only): every part's box, every TV
   item's box, every Remote key's box, every image's box, the H1s.
2. The page loaded, hydrated and measured: the same.
3. Both compared to half a pixel; the room's pictures compared; the layout shift of the real load
   (`PerformanceObserver`, `layout-shift`); the console.

| Run | Sizes | Boxes per size | Worst difference | Layout shift | Pixels that differ |
| --- | --- | --- | --- | --- | --- |
| Production build, without services | 31 | 29 to 31 | 0.00 px | 0.0000 at every size | 0.00 to 0.02% |
| Dev server on real data (start titles, the TV's picture and posters) | 31 | 35 to 37 | 0.00 px | 0.0000 at every size | 0.17 to 1.01% (the dev tools' button and the header's "Ctrl K" hint, which hydration adds) |

248 checks pass in each run, none fail (`budgets/checks.json`). [first-paint.jpg](../implementation/tv-screen-revamp/budgets/first-paint.jpg):
six layouts before any script and hydrated, on real data.

- **One H1 shows** in every window before any script (the paint run) and after hydration (`drive.mjs seo`, five
  windows).
- **No console error or warning** after hydration at any of the 31 sizes on the dev server, which runs React's
  development build and names a hydration mismatch. The only line is the router's v7 future-flag notice, on every
  page.
- **The pictures:** before any script the room asks for exactly the room and hand files the measured room shows,
  and nothing for the other layout.
- **The TV's pictures** come from another host about a second into the load (1.06 s here). The first paint draws
  them when they arrive, in the place they keep.

## Not covered

- Safari and Firefox: the drive runs Chromium. The first paint uses container queries, `@property`, `tan()` and
  `atan2()`, `round()` (Chrome 125, Safari 15.4, Firefox 128 for `@property`). Without `@property` the values
  still resolve outside the phone's rig; without `round()` the phone's top bar keys take their drawn height until
  hydration.
- A member's first paint: the CSS is the same for every visitor; the member's HTML was checked through the harness
  in the access walk, not in the paint comparison.

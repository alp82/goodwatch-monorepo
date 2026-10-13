# Slice 2: the room

The new TV's room on `/home-preview`, with an empty TV: the softened photos, the TV and the Remote at every
window size the prototype measured, the phone's room with its Remote, and phone landscape. Proof for
[the plan](../README.md), slice 2. Taken on October 13, 2026.

## Run it

```
cd goodwatch-webapp
npm ci
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3162
```

`http://localhost:3162/home-preview`. No flag: the address is a build aid on the integration branch and the
switch deletes it. Without a `.env` the server reads nothing; the section below the room then shows its hubs
without the 16 titles.

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3162 node drive.mjs
```

`drive.mjs` checks the page and writes `shots/`, the sheets here and `sizes.json`. `drive.mjs checks` and
`drive.mjs shots` do one of the two.

## What the checks say

781 checks pass.

- **Every desktop row of the prototype's table:** the Remote under the TV at 1920 x 1080 (TV 1271 x 686),
  1920 x 940 (1080 x 583) and 2560 x 1300 (1556 x 841); beside it at 1536 x 730 (1080 x 583), 1440 x 800
  (1080 x 583), 1366 x 650 (998 x 539) and 1280 x 720 (949 x 513). At each: the 12 keys are inside the window,
  under nothing and clear of the lip; the streaming row ends inside the window; the lip takes a press and does
  not cover the TV; the section starts where the room ends.
- **Every phone, with the real lip and dock:** the Remote in the hand at 390 x 844 (picture 362 x 302),
  360 x 740 (332 x 277) and 430 x 932 (402 x 335); on the table at 375 x 667 (347 x 258) and 390 x 700
  (362 x 291). At each: 11 keys, each 44 px or more, inside the window, under the TV, under nothing and clear
  of the lip; every key reaches the TV's seam as what it says.
- **Phone landscape:** the TV on the left and the Remote in the hand on the right at 844 x 390 (picture
  488 x 364, canvas shown at 0.98) and 932 x 430 (541 x 404, at 1.08), with the same checks of the keys.
- **Both Remotes' keys** reach the seam (`room-tv.ts`) as a direction, OK, Back, Search, Home, Menu and a
  streaming key; scrolling over the desktop wheel steps; the power key darkens the TV and the room, and a key on a
  dark TV only turns it on.
- **Away:** after the lip the page is below and the room is `inert`; back in the room it takes input again. At
  1440 x 900 and 390 x 844, and nothing in the console after hydration at either.

`sizes.json` has the measured numbers per size.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg), [phone-beside-prototype.jpg](phone-beside-prototype.jpg):
  1920 x 1080 and 390 x 844 beside the prototype's shot of its home.
- [desktop-sizes.jpg](desktop-sizes.jpg): the seven desktop sizes under the prototype's contact sheet.
- [phone-sizes.jpg](phone-sizes.jpg): the five phones under the prototype's.
- [phone-landscape.jpg](phone-landscape.jpg): 844 x 390 and 932 x 430. The prototype has none.
- [tv-off.jpg](tv-off.jpg): the TV on and off.
- [other-sizes.jpg](other-sizes.jpg): 820 x 1180, 1024 x 768 and 667 x 375, which no table covers. See the
  open questions in the slice's report.
- `shots/`: each size by itself.

## The photos

The softening the prototype did with a live blur is in the files now (`soften-photos.py`: a Gaussian blur at
the source's size, then scaled down). The sources are today's largest files, which are lossy; there is no
lossless master.

| | Today | New | |
| --- | --- | --- | --- |
| Desktop, AVIF | `room-2560.avif` 143,239 bytes (2560 x 1441), which the prototype's room took on every desktop; `room-1920.avif` 96,115 | `room-soft-1920.avif` 57,619 bytes (1920 x 1081) | 40% of the 2560 file |
| Desktop, WebP | `room-2560.webp` 209,766; `room-1920.webp` 140,318 | `room-soft-1920.webp` 68,380 | 33% |
| Phone, AVIF | `room-phone.avif` 91,678 bytes (1300 x 1950) | `room-phone-soft.avif` 36,599 bytes (1068 x 1602) | 40% |
| Phone, WebP | `room-phone.webp` 118,550 | `room-phone-soft.webp` 52,390 | 44% |

Decoded, the desktop photo is 8.3 MB (1920 x 1081 at four bytes a pixel) where the 2560 file was 14.8 MB, and
the phone's 6.8 MB where it was 10.1 MB.

[photo-desktop-before-after.jpg](photo-desktop-before-after.jpg) and
[photo-phone-before-after.jpg](photo-phone-before-after.jpg): three crops each, drawn as large as the room
draws them (the desktop at 1920 x 1080, the phone at 390 wide and three device pixels a pixel). The first
column is today's file under the prototype's live blur, the others the new file at three AVIF qualities. The
files here are quality 55.

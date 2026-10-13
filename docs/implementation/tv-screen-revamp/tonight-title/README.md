# Slice 5: Tonight and the title screen

The first complete path on the new TV: home, Tonight, a title, Want to See, Seen it with the rating, and the
Watch key, which opens the title's page on GoodWatch at its streaming block. For a guest and a member, on
`/home-preview`. Proof for [the plan](../README.md), slice 5. Taken on October 13, 2026.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on, as for [slice 3](../home/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3191
```

`http://localhost:3191/home-preview`. Wait until the server has a country's streaming availability before a
run: until then a card's services are unknown and the Watch key says "Where to watch". A read that timed out is
tried again after five minutes.

**A member, on the tracking harness** (`/prototype/my-library-real/tv?member=six`, a server without services):

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3192
```

What the harness cannot show: it has no session. Its member's Tonight is the TV's own member read, but the
title's card is asked for as a guest's, and Want to See and the rating go to the browser's storage as a guest's
do. The drive script paints the harness's pictures into the card, as the harness's page paints them into its
loader's answer. A member's stored watch and score were not exercised in a browser; the rule that decides them
has tests (`recordsWatch`, `tv-title.test.ts`).

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3191 \
MEMBER=http://localhost:3192 node drive.mjs
```

`drive.mjs` checks the pages and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks` and
`drive.mjs shots` do one of the two. It signs in nowhere and writes to no server: a guest's marks go to the
browser's own storage, which is what it reads back.

## What the checks say

261 checks pass, none fail.

- **`/api/title-cards`, asked directly.** A GET by key answers the title's card with what the title screen shows;
  several come in the order asked; a title the catalog lacks is left out. `private, no-store` on every answer,
  refusals included. No keys, a key in the TV's form, 61 keys and a body that is no guest progress are refused
  with 400, another method with 405. A guest's POST: their Want to See is on the card, their score counts as
  Seen, and a saved service comes back as theirs and leads the title's services. The card is, field for field,
  the one the pool holds for the same viewer.
- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness. After every step the script reads the TV's state from the page.
  - **Nothing in the first view:** Tonight's, the title screen's and the rating's code are not asked for on
    arrival, and no card is. The first interaction asks for Tonight's code, which brings the title screen's;
    the rating's is asked for on the title screen.
  - **Tonight:** OK on the tile is one history entry. A guest's first pick is the pool's best, under "Best rated
    right now"; a member's is their next episode, named in the bar ("Next episode: S1 E4"), then their Wishlist.
    The picture is a `w1280` backdrop on the desktop and `w780` on the phone. Another one steps through the
    three in place, keeps the focus, wraps, and never adds a history entry.
  - **A title:** Details opens the title screen of the pick on show and names it at once from what Tonight
    knew. The card is asked for once, by key: a guest with POST and their browser's progress, a member with GET.
    The three keys are a row on the desktop and a column on the phone, inside the picture, clear of the Expand
    key's corner; the bar is above them.
  - **Want to See** is a toggle: the title is in the browser's progress, the TV says "On your Wishlist", the
    key reads "On Wishlist ✓"; one more press takes all three back.
  - **Seen it** opens the rating, one more history entry. An answer stores the score, returns to the title with
    the focus on the key, which then reads "7 · Good"; the TV says "Rated 7 · Good". The score took the Want to
    See's place in the browser's progress, as everywhere on the site. Rating again changes the one score; Back
    from the rating changes nothing. Nothing was sent to a server.
  - **Back, Forward and a reload** give every screen its focus back: the rating, the title, Tonight on the same
    pick, home. After a reload the title screen is drawn from its card alone.
  - **After a guest's rating** the title is no longer among Tonight's picks once they are asked for again: a
    rated title counts as Seen.
  - **Both Remotes' keys** (arrows, OK, Back, Home) and **the pointer or a finger** (Another one, Details, Seen
    it, an answer, the bar's Back) do the same.
  - **Nothing in the console**, at either size, for either person.
- **The Watch key, at both sizes.** On one of the person's services it reads "Watch on YouTube TV", on another's
  "On YouTube TV". OK opens `/movie/603-the-matrix#streaming` on GoodWatch; no request leaves for a service.
  - The block is highlighted on arrival with the tutorial's tint (`rgba(251, 191, 36, 0.28)`), has the focus,
    and stands clear of the site's bar and the title's header (its top at 173 px on the desktop, 223 px on the
    phone).
  - Nothing pulses while the TV's picture grows into the page; the pulse starts once that has ended.
  - It pulses exactly three times (one start, two iterations, one end; 4,006 and 3,934 ms measured against
    3,900) and stops by itself. Its rules leave the page, and nothing animates afterwards.
  - The wish to highlight has left the history entry by the first look. A reload, Forward to the page, and Back
    to it from another page do not highlight again; a reload still scrolls to the block.
  - Back returns to the title's TV screen with the Watch key focused.
- **The edges of the Watch key.**
  - A press inside the block ends the highlight at once and still does its job (it chose the Rent tab); so
    does a key (Tab moved on to the block's first control).
  - With reduced motion the navigation is plain, nothing pulses, and the block has a still amber outline for
    4,024 ms, then none.
  - A typed address with `#streaming` scrolls to the block (173 and 223 px) and does not glow; the block is not
    focused and takes no focus.
  - A title that streams nowhere ("Spider-Man: Brand New Day" on the day) reads "Not streaming", and its key
    does nothing.
  - A title the catalog lacks says so; its keys do nothing and mark nothing; Back shows home.
  - The Expand key's effect opens the title's page with no fragment and no highlight. The key itself is slice
    11's and is not drawn; the script reaches it with `focus=expand`.
- **The server's HTML.** A link straight to Tonight, a title or the rating: the server draws the bar alone, once
  per edition, and nothing of the title, so a guest's HTML stays the same for every guest. The title page's
  streaming block has its scroll margin and nothing of the highlight; the page's HTML has none of its rules.

`checks.json` has the measured numbers.

## Numbers

**The first view's scripts**, `npm run build` on this branch and on `feat/tv-screen-revamp` at `f9df021a`, both
with `SENTRY_RELEASE=compare` (the build writes its release id into every file). Counted by `first-view.mjs`
here: the entry, the root and the route with their static imports, sizes as `scripts/precompress.mjs` writes
them, raw / gzip / Brotli.

| Page | Files | Before | After | Of which |
| --- | --- | --- | --- | --- |
| A movie's page | 20, as before | 857,114 / 284,175 / 244,757 | 859,093 / 284,963 / 245,396 (+1,979 / +788 / +639) | The chunk with the hero +1,404 / +597 / +456: the highlight. `shell` +570 / +189 / +144 |
| A show's page | 20, as before | 857,666 / 284,462 / 245,020 | 859,645 / 285,250 / 245,664 (the same) | The same |
| `/` (the old TV) | 17, as before | 857,275 / 279,853 / 243,362 | 857,850 / 280,048 / 243,504 (+575 / +195 / +142) | `shell` |
| `/home-preview` | 12 to 13 | 653,853 / 217,838 / 188,642 | 665,287 / 221,534 / 191,993 (+11,434 / +3,696 / +3,351) | Its chunk +5,025 / +1,862 / +1,720 and its route module +32; the mutation hooks' chunk `user-data`, 5,802 / 1,636 / 1,472, which `/` loads today; `shell` |

- **`shell` grows on every page** by 570 bytes (144 Brotli): the names of the three new chunks in the build's
  table of dynamic imports. No code of the slice is in it.
- **Loaded on first use:** Tonight 1,543 bytes (842 gzip, 733 Brotli), the title screen 3,103 (1,498, 1,346), the
  rating 2,160 (1,132, 997).
- **The title page's HTML** gains the block's scroll margin, 75 bytes of a `style` attribute, on every visit,
  and nothing else.

**Sizes on the page.** The title screen's keys are 74 canvas px tall on the desktop (78.7 px at 1920 x 1080
with the focused one's growth) and 52 on the phone, the prototype's numbers: 37.8 px at 390 x 844.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot
  of the same screen: Tonight, a title, the rating; then a member's Tonight and title, and the keys once a title
  is on the Wishlist and rated.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- [watch-key.jpg](watch-key.jpg): the Watch key on the TV, the title's page at its streaming block mid pulse and
  at rest, with reduced motion, and on the phone.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, and for the rating the strip
that is still being designed; the rating here is the plain version behind the seam.

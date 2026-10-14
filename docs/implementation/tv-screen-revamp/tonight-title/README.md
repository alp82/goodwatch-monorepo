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
`drive.mjs shots` do one of the two; a whole run of the checks takes a quarter of an hour, and
`PARTS=walk,watch,sizes,order,html` runs some of them. It signs in nowhere and writes to no server: a guest's
marks go to the browser's own storage, which is what it reads back.

## How a screen loads its data

Every slice that adds a screen follows this. It keeps a screen's data hook, with everything the hook imports
(queries, mutations, words), out of the start page's first view.

1. **The hook lives in a component of the screen's chunk.** Beside the screen, its file exports a component that
   runs the hook and draws nothing: `TitleData` in `tv/screens/Title.tsx` runs `useTvTitle` (`tv/use-tv-title.ts`).
   It is declared in `tv/screen-code.tsx` from the same `import()` as the screen, so the data costs no request of
   its own.
2. **The scene mounts it once**, in `TvLivingRoom.tsx`, while the address names the screen (`screen.name`), outside
   `renderScreen`: before the window is measured the TV is drawn in two editions, and the data must not be
   asked for twice. It gets what the page already knows as props (`screen`, `member`, `known`, `say`).
3. **It reports up with `useReport(report, value)`** (`tv/kit.tsx`), where `report` is a `useState` setter of the
   scene. One report holds what the screens draw, what the machine's context needs (the title's name for the
   Expand key's address; for a list its titles' keys) and `onEffect`, which carries out the machine's effects
   that are this screen's. `value` must keep its identity while nothing changed: end the hook with `useMemo`.
   The report happens before the paint, so the screen is drawn in the frame its data component mounts in.
4. **The scene keeps the report in state** and passes the parts on: into `TvContext`, to `TvScreen`, and it tries
   `onEffect` first when the machine names an effect. Until a report is there, `TvScreen` draws the screen's
   `first`, the bar alone.
5. **The scene, `TvScreen.tsx` and `kit.tsx` import a data hook's types only** (`import type`). A value import
   puts the hook and all it imports back into the first view.
6. **`screen-code.tsx` has one importer, `TvScreen.tsx`**, which re-exports what the scene needs of it. With a
   second importer the build counts the small module as shared and moves it into the shell of every page, with
   the name of every lazy chunk (`vite.config.js`, rule 3 of the client chunks). A helper that several lazy
   chunks share goes into `kit.tsx`, or imports something of the TV that is not on every page, for the same
   reason.
7. **Check it in a build:** `first-view.mjs` here, before and after, with the same `SENTRY_RELEASE`.

What stays in the scene: what the home's first view needs (the loader's data, the pool, Tonight's picks) and the
effects every screen shares (`expand`, `sign-in`).

## What the checks say

632 checks pass, none fail.

- **`/api/title-cards`, asked directly.** A GET by key answers the title's card with what the title screen shows;
  several come in the order asked; a title the catalog lacks is left out. `private, no-store` on every answer,
  refusals included. No keys, a key in the TV's form, 61 keys and a body that is no guest progress are refused
  with 400, another method with 405. A guest's POST: their Want to See is on the card, their score counts as
  Seen, and a saved service comes back as theirs and leads the title's services. The card is, field for field,
  the one the pool holds for the same viewer.
- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness. After every step the script reads the TV's state from the page.
  - **Nothing in the first view:** Tonight's, the title screen's and the rating's code are not asked for on
    arrival, nor is the title's data hook, and no card is. The first interaction asks for Tonight's code, which
    brings the title screen's with its data hook; the rating's is asked for on the title screen.
  - **Tonight:** OK on the tile is one history entry. A guest's first pick is the pool's best that streams in
    their country, under "Best rated right now", and all three picks stream; a member's is their next episode,
    named in the bar ("Next episode: S1 E4"), then their Wishlist.
    The picture is a `w1280` backdrop on the desktop and `w780` on the phone. Another one steps through the
    three in place, keeps the focus, wraps, and never adds a history entry.
  - **A title:** Details opens the title screen of the pick on show and names it at once from what Tonight
    knew. The card is asked for once, by key: a guest with POST and their browser's progress, a member with GET.
    The three keys are a row on the desktop and stand two to a row on the phone, inside the picture, clear of
    the Expand key's corner; the bar is above them.
  - **Want to See** is a toggle: the title is in the browser's progress, the TV says "On your Wishlist", the
    key reads "On Wishlist ✓"; one more press takes all three back. The toast covers no key.
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
  - It pulses exactly three times (one start, two iterations, one end; 3,940 and 4,101 ms measured against
    3,900) and stops by itself. Its rules leave the page, and nothing animates afterwards.
  - The wish to highlight has left the history entry by the first look. A reload, Forward to the page, and Back
    to it from another page do not highlight again; a reload still scrolls to the block.
  - Back returns to the title's TV screen with the Watch key focused.
- **The edges of the Watch key.**
  - A press inside the block ends the highlight at once and still does its job (it chose the Rent tab); so
    does a key (Tab moved on to the block's first control).
  - With reduced motion the navigation is plain, nothing pulses, and the block has a still amber outline for
    3,878 ms, then none.
  - A typed address with `#streaming` scrolls to the block (173 and 223 px) and does not glow; the block is not
    focused and takes no focus.
  - A title that streams nowhere ("Spider-Man: Brand New Day" on the day) reads "Not streaming", and its key
    does nothing.
  - A title the catalog lacks says so; its keys do nothing and mark nothing; Back shows home.
  - The Expand key's effect opens the title's page with no fragment and no highlight. The key itself is slice
    11's and is not drawn; the script reaches it with `focus=expand`.
- **Every key on every phone of the room's table**, and landscape, and the desktop: 360 x 740, 375 x 667,
  390 x 700, 390 x 844, 430 x 932, 844 x 390 and 1920 x 1080. On home, Tonight, a title with a name of two lines
  ("The Lord of the Rings: The Fellowship of the Ring") and the rating:
  - every key, the bar's included, is 44 px or more on the phone's screen: the smallest is 44.2 to 44.5 px on
    the five phones;
  - every key is inside the picture, none lies over another, each says its words in full, nothing is cut off
    by its box, and the title's name is inside the picture and under no key;
  - the Expand key's corner is free;
  - the toast ("On your Wishlist", "Rated 5 · Mediocre") is inside the picture and covers no key, and there is
    none while the menu is open.
- **Tonight's order**, on the day's pool for a guest in the United States: 20 titles, 15 of them streaming, and
  its own first two do not stream ("Spider-Man: Brand New Day", "Resident Evil").
  - Without saved services the three picks are the pool's first three that stream, and none says "Not
    streaming".
  - With Amazon Prime Video saved (4 of the pool's titles), the titles on it lead.
- **The server's HTML.** A link straight to Tonight, a title or the rating: the server draws the bar alone, once
  per edition, and nothing of the title, so a guest's HTML stays the same for every guest. The title page's
  streaming block has its scroll margin and nothing of the highlight; the page's HTML has none of its rules.

`checks.json` has the measured numbers.

## Tonight's order

Tonight is for watching tonight. A guest's picks, and those of a member with nothing of their own to pick from,
are the pool's titles in this order (`tonightOrder`, `tv/tv-home.ts`):

1. titles that stream on one of the person's own services;
2. titles that stream on another service in their country;
3. the rest: titles that stream nowhere there, and every title while the country's availability is still
   loading.

Inside each group the pool's own order stays, best first for the person. Nothing is left out: when fewer than
three titles stream, the picks are filled up from the next group, and such a pick says "Not streaming". A
guest's own Tonight's pick, the last title on their Wishlist, still leads, as in the site's navigation; a
member's Tonight from the loader is not reordered.

Whose services are whose: the pool names a member's saved services; a guest's are the ids their browser sent
with the pool's request (`use-tv-pool.ts`). Nothing changed on the server. The pool holds the best six and three
per mood, 20 titles on the day; choosing its titles by where they stream on the server
(`server/living-room/pool-keys.server.ts`, which the old TV shares until the switch) would give Tonight a deeper
list than a reordering of 20 can.

One consequence: a guest's home is drawn from the first start title until the pool is there, and that title
is the pool's own first. When it does not stream, the Tonight tile's picture changes at the first interaction.

## Keys and the toast on a phone

- **A key is a touch target:** `keySize(canvas, drawn)` in `tv/kit.tsx` gives a key's height in canvas pixels, on
  a phone never under 44 px of the phone's screen. A phone's canvas is shown at 0.66 to 0.8, so a key is 67
  canvas px tall on a phone 360 wide and 55 on one 430 wide. The bar's keys, Tonight's, the title screen's and
  the rating's take their size from it; every later screen does the same.
- **The layout that makes room for them:** on the phone the title screen's keys stand two to a row (Watch and
  Want to See, then Seen it), not in the prototype's column of three, which does not fit a short phone at that
  height. The last row's right half is the Expand key's corner. Tonight's two keys stand in the left column.
- **The menu and What is GoodWatch?** are slice 3's screens and are not changed: the menu's keys are 31.9 to
  38.6 px tall on the five phones.
- **The toast** stands in the top bar's row at the left, where a screen's name is, and the name steps back while
  it shows. No screen has a focus target there. It ends before the bar's keys, and there is none while the menu
  is open.

## Numbers

**The first view's scripts**, `npm run build` with `SENTRY_RELEASE=compare` (the build writes its release id into
every file), counted by `first-view.mjs` here: the entry, the root and the route with their static imports,
sizes as `scripts/precompress.mjs` writes them, raw / gzip / Brotli. "Slice 5" is the integration branch at
`e35febce`; "now" is slice 5 with its follow-ups.

| Page | Slice 5 | Now | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 13 files, 665,287 / 221,544 / 192,001 | 12 files, 657,294 / 219,029 / 189,742 (-7,993 / -2,515 / -2,259) | The mutation hooks' chunk `user-data` left the first view, 5,802 / 1,636 / 1,471. Its chunk 48,897 to 47,844 (-1,053 / -457 / -420): the title's data hook left, `screen-code.tsx` came in from the shell, with the key size rule, Tonight's order and the toast. `shell` |
| A movie's page | 20 files, 859,093 / 284,978 / 245,413 | 20 files, 857,987 / 284,547 / 244,989 (-1,106 / -431 / -424) | `shell` |
| `/` (the old TV) | 17 files, 861,537 / 281,218 / 244,530 | 17 files, 860,431 / 280,816 / 244,154 (the same) | `shell` |

- **`shell`, on every page, 171,060 to 169,954 bytes** (-1,106 raw, -388 Brotli). `screen-code.tsx`, with the
  name of every lazy screen's chunk, was in it since slice 3: it is small and had two importers. It now has one
  and is in the start page's own chunk. The shell is 536 bytes smaller than before slice 5.
- **Against the integration branch before slice 5** (`f9df021a`: 12 files, 653,853 / 217,838 / 188,642), the new
  start page's first view is 3,441 bytes larger (1,100 Brotli) with Tonight, the title screen, the rating and
  these follow-ups, and has no file more.
- **A title page** is 873 bytes (232 Brotli) larger than before slice 5: the highlight in the hero's chunk,
  +1,404 / +597 / +456, less what the shell lost.
- **Loaded on first use:** Tonight 1,579 bytes (857 gzip, 747 Brotli); the title screen with its data hook 5,463
  (2,594, 2,366); the words and rules the three share 2,116 (1,116, 1,002); the rating 2,201 (1,156, 1,031); and
  with the title screen the mutation hooks' chunk.
- **The guest's HTML of `/home-preview`** is 59,766 bytes on the dev server, 134 more than before: two classes
  on the home's wordmark, in both editions, for the toast.
- **The title page's HTML** gains the block's scroll margin, 75 bytes of a `style` attribute, on every visit,
  and nothing else.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot
  of the same screen: Tonight, a title, the rating; then a member's Tonight and title, and the keys once a title
  is on the Wishlist and rated.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- [watch-key.jpg](watch-key.jpg): the Watch key on the TV, the title's page at its streaming block mid pulse and
  at rest, with reduced motion, and on the phone.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, and for the rating the strip
that is still being designed; the rating here is the plain version behind the seam. Since [slice 8](../taste/README.md)
the rating is that strip: `drive.mjs` here follows it (the levels from low to high, the focus on Good, the exact
scores on the desktop), and the sheets and `checks.json` of this folder are as they were taken, with the plain
answers. On the phone the prototype's
keys are 52 canvas px tall in a column; here they are touch targets, two to a row.

# Episode list prototype, round 3

Third round for [#369](https://github.com/alp82/goodwatch-monorepo/issues/369), under map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Round 1 is in `docs/prototypes/episode-list/`, round 2
in `docs/prototypes/episode-list-2/`; both stay at their routes.

The owner's feedback on round 2: "design wise, B is the best direction. still it uses lots of space. not sure how to
solve it, but we need better ways to drill down quickly. also i think it should be possible to combine the ratings and
watches in a meaningful way, but also it could be too hard and overwhelming to use".

So this round keeps round 2's hero unchanged and stays with B, the season rail. Three variants each make it dense
and quick to drill into, and each mixes the ratings into the list one step further than the one before, so the point
where it becomes too much can be felt.

The code is throwaway and not meant to be built on.

## Open it

The dev server (`npm run dev` in `goodwatch-webapp`) serves `/prototype/episode-list-3`; the route answers 404 in
production. Switch variants with the floating bar or the left and right arrow keys.

- `?variant=A|B|C`
- `?show=supernatural|chernobyl|slow-horses|sherlock`
- optional: `&scenario=fresh|watching|on_hold|dropped|all|seen_new`, `&today=2026-10-14`
- optional: `&imdb=differs` simulates IMDb numbering season 1 differently; `&ratings=watched` holds back the ratings
  of episodes not watched yet

The white panel at the top is round 1's. The white strip under it has this round's two switches: "Ratings of
unwatched episodes: shown / held back" and "IMDb numbers a season differently".

What is real and what is not, beyond the earlier rounds' notes:

- The model, the store and the fixtures are round 1's, the hero and its score control are round 2's, both imported
  unchanged. Round 3's own code is in `app/ui/prototype-episode-list-3/`.
- Marks live in localStorage under the same key as rounds 1 and 2.
- Ratings are TMDB votes standing in for IMDb ratings, so the colours are more uniform than the real grid's.
- Not built: swiping between seasons on a phone, focus handling for screen readers, a season with more than about 30
  episodes in C's grid.

## The same in every variant

- **Round 2's hero**, unchanged, with its one score control that carries the rate prompt.
- **One-line rows.** Tick, number, name, air date. A press on the line opens it in place: the still, the
  description, when it was watched (now, a date, don't know), "Watched up to here" and "Remove watch". One row is
  open at a time. The spoiler rule holds: an unwatched episode shows its name and nothing else until pressed.
- **A finder** in the section's heading line. It takes `9x14`, `s9e14`, `9.14`, `s9`, a bare `14` (that episode of
  the open season) or part of a name, and Enter or a press opens the season with the row in view, lit for a moment
  and focused.
- **"Next · S2 E5"** beside the finder opens the season of the first episode not watched yet, with its row in view.
  The hero's "Next episode" line does the same.
- **Keys on desktop:** `F` finder, `N` next episode; with a row focused `↑` `↓` walk the rows, `←` `→` change the
  season, `W` marks or unmarks. (`/` belongs to the site search, so the finder does not take it.)
- **No season navigation for a limited series.** Chernobyl gets five rows, no rail, no chips, no grid and no finder.
- **Marking as before:** a tick is "now"; "Mark season" and "Watched up to here" apply at once with no date and the
  toast offers "Set a date"; a tick past a gap offers the earlier episodes; specials can be ticked and are not
  counted; unaired episodes are disabled.
- **A rating beside a TMDB episode is never guessed.** See "When the numberings differ" below.

## The variants

**A. Light: the rail carries the ratings.** The rows have no rating. Each season in the rail is 28 pixels high and
holds a strip with one sliver per episode, solid where watched and hollow where not, in the rating's colour, then the
count and the season score; on a phone the seasons are squares, all visible at once, each with a band in the season
score's colour that is solid as far as watched, and the open season's strip sits in its header. The list is a box of
fixed height that scrolls inside the page, opened at the next episode, and the ratings grid stays as its own section
below.
Strongest: the calmest of the three, and the rail alone answers "which seasons are good" and "where am I". Weakest:
it keeps the grid, so the page is still 1,400 pixels under the hero on a long show, and the list is a scrolling box
inside a scrolling page.

**B. Medium: a rating in every row.** Every row carries its rating as a small tile in the grid's colours next to the
date, and the ratings grid folds to one link. The seasons are a single line of chips (number, season score, a bar
filled as far as watched) that sticks under the site bar on a phone; a wide screen shows the season in two columns,
and a phone shows eight rows around the next episode with the rest folded into one line above ("3 earlier episodes ·
E1–E3 · all watched") and one below ("11 more · E12–E22").
Strongest: the shortest page that still reads as a list (593 pixels on desktop for Supernatural, against 2,538),
with nothing scrolling inside anything. Weakest: a column of rating tiles next to the ticks is the first thing the
eye lands on, and with ratings shown it tells you the finale is a 9.3 before you have seen it.

**C. Full: the grid is the navigation.** A grid with one cell per episode (solid watched, hollow not, the rating's
colour, the number in the cell on desktop) replaces the rail; a press on a cell opens that season with the episode's
row picked, beside the grid on desktop and below it on a phone, and the arrow keys walk the cells. Rows carry rating
tiles as in B, and the separate grid folds to a link.
Strongest: the whole show, its ratings and the member's progress in 486 pixels on desktop, and S9 E14 is one press
away with no typing. Weakest: on a phone the cells are 12 by 16 pixels, too small to hit one on purpose (the five
rows around the pressed cell make up for it), and it is the tallest of the three there; it is also the one that
asks most of a new member.

### Ratings of episodes not watched yet

A rating beside an unwatched episode can be a spoiler (a 9.8 finale, a 5.6 in the middle of a season). The switch
"Ratings of unwatched episodes" lets both be felt. Held back, A's hollow slivers and C's hollow cells go grey, the
row tiles of unwatched episodes become empty dashed tiles, and pressing a row shows its rating with the description.
Season scores stay, as averages. See `detail-*-ratings-held-back-*.jpg`.

### When the numberings differ

The rows, strips and cells are TMDB's episodes; the ratings are IMDb's. Round 2's variant D looked a rating up by
season and number and so showed a neighbour's rating wherever the sites number differently. Here a rating is taken
only when IMDb's episode at that season and number has the same title; if not, the season is searched for the
title; if that fails the episode gets no rating. With `&imdb=differs` (IMDb counts season 1's two-part opener as
one episode) season 1 says "IMDb numbers this season differently. 20 ratings matched by title; 1 episode left
without a rating rather than given a neighbour's.", "Wendigo" shows a dash in B and C and a grey cell or sliver in
C and A, and every other episode keeps its own rating. See `detail-*-numbering-differs-*.jpg`. What title matching
cannot repair (episodes named differently on the two sites) ends as a missing rating, never a wrong one. The folded
grid behind the link in B and C stays in IMDb's numbering.

## Height of the content area

Pixels from the top of the "Episodes" heading to the end of the last thing under it, measured in headless Chromium
with the "Watching, partway" start (season 1 watched, season 2 at 4 of 22). "List" is the episodes section alone;
"all" adds what follows it (the ratings grid in round 2's B and in A, the one-line link in B and C).

| | Supernatural, 1280 | Supernatural, 390 | Chernobyl, 1280 | Chernobyl, 390 |
| --- | --- | --- | --- | --- |
| Round 2, B: list / all | 1632 / 2538 | 1432 / 2330 | 441 / 640 | 407 / 598 |
| A: list / all | 518 / 1408 | 612 / 1494 | 289 / 472 | 329 / 504 |
| B: list / all | 545 / 593 | 630 / 678 | 271 / 319 | 311 / 359 |
| C: list / all | 486 / 534 | 810 / 858 | 271 / 319 | 311 / 359 |

The numbers hold for any season: A's box and C's desktop list scroll inside a fixed height, and B's and C's phone
lists show a fixed number of rows until a fold is pressed. Opening a row adds its still and description (about 210
pixels on desktop and 470 on a phone, measured on one row). Slow Horses and Sherlock come out between Chernobyl and Supernatural (list:
198 to 360 on desktop, 333 to 572 on a phone).

## Presses to get somewhere

From the episodes section, on Supernatural:

| | A | B | C |
| --- | --- | --- | --- |
| First episode not watched | 1 ("Next", `N`, or the hero line) | 1 | 1 |
| S9 E14 by typing | `9x14` and Enter | `9x14` and Enter | `9x14` and Enter |
| S9 E14 by pointing | 2: season 9, then scroll the box | 1 on desktop (season 9, row is in view); 2 on a phone (season 9, "more") | 1: the cell |
| Any season | 1 | 1 (a phone may need to slide the chips first) | 1 |

## Recommendation

**B's page with A's restraint: build B, with the ratings of unwatched episodes held back by default.**

- B answers the space complaint most plainly: under a quarter of round 2's height on desktop and under a third on a phone, with no box that
  scrolls inside the page and no second section to scroll past. The finder and "Next" do the drilling; the chips
  show where the first unfinished season is.
- The rating tile per row is the meaningful combination the owner suspected, and it stops short of overwhelming as
  long as the tiles of unwatched episodes stay empty: the member sees how the episodes they watched were rated, and
  the season score on the chip still says which seasons are good. With every tile lit the list reads as a ratings
  table with ticks attached, and it spoils.
- A is the fallback if ratings in the rows feel like noise after a day of use. Its rail strip could also replace
  B's chips on desktop if the chips feel too plain.
- C is the most impressive on a desktop and I would not build it as the default. It works well for back-filling and
  for looking around a long show, it is weak on a phone, and it is one more object to learn. If it is wanted, it
  fits as the desktop layout of B (grid in place of the chips) rather than as its own design.
- The honest rule for ratings (match by title or show none) costs a few missing tiles on shows the sites number
  differently, and that is the right price in all three.

## Questions to answer by looking

1. **How much rating in the list: none (A), a tile per row (B), or the grid as navigation (C)?** Suggested: B.
2. **Ratings of episodes you have not watched: shown or held back?** Flip the switch on B and C with Chernobyl and
   Supernatural. Suggested: held back by default, shown on pressing the row.
3. **How is the height bounded: a box that scrolls inside the page (A, C on desktop), or a fixed window of rows
   with the rest folded (B and C on a phone)?** Suggested: the folded window, and two columns on a wide screen.
4. **Season navigation on a phone: all seasons as squares at once (A), one sliding line of chips that sticks (B),
   or the grid (C)?** Suggested: B's chips; A's squares if sliding to season 12 is one move too many.
5. **Does the ratings grid keep its own section for members who track (A), or fold to a link (B, C)?** Suggested:
   fold to a link for a member with at least one watched episode; everyone else keeps today's grid.

## Screenshots in this folder

All JPEG; `-desktop` is 1280 wide, `-phone` is 390 wide at double density. The site bar and the prototype's switcher
are hidden in them.

- `A-`, `B-`, `C-` with `supernatural`, `chernobyl`, `slow-horses`, `sherlock`: the content area of each variant,
  started from "Watching, partway".
- `round2-B-supernatural-*`: round 2's B at the same state, for the height comparison.
- `page-B-supernatural-*`: the whole page with the hero.
- `detail-finder-9x14-*`, `detail-finder-landed-S9E14-*`, `detail-finder-by-name-*`: the finder.
- `detail-row-open-*`: a row opened in place. `detail-bulk-toast-*`: "Mark season" and its toast.
- `detail-C-cell-picked-*`: C after a press on S9 E14's cell.
- `detail-A-specials-sherlock-*`: the specials in A.
- `detail-*-numbering-differs-*`, `detail-*-ratings-held-back-*`: the two switches in each variant.
- `detail-score-prompt-*`: the one score control carrying the rate prompt after watching Chernobyl through.

## Verification

Run on 2026-10-07 against the dev server on main (`http://localhost:3003`), in headless system Chromium driven by
Playwright, at 1280 and 390 pixels wide. 319 scripted checks passed. In every variant at both widths they cover:

- all four shows: no sideways page scroll, exactly one score control, no tab bar;
- Chernobyl: five rows and no season navigation or finder; no still before a press, still and description after;
  watching through puts the prompt on the one score control and "Rate it" in the toast;
- Supernatural: the finder with `9x14`, `s9e14` and `captiv` (Enter) and with a press on a result ends with S9 E14's
  row inside the visible list; "Next" brings the next episode's row back; one press opens season 12;
- marking: a tick is "now"; "Mark season" applies at once and "Set a date" opens the dialog; the opened row offers
  "Watched up to here"; a tick past a gap offers the earlier episodes and marks them with no date; a special can be
  ticked and changes neither progress nor status; Slow Horses' two unaired episodes are disabled;
- ratings: no tile in A's rows; tiles in B and C and the grid folded to a link; held back, only watched rows and
  solid cells carry a rating; with `imdb=differs`, season 1 says what was matched and left out, "Wendigo" has no
  rating and every other row has the rating it has without the switch;
- A's rail strips and C's cells are solid exactly where episodes are watched; a press on a cell picks that
  episode's row and a tick turns the cell solid;
- desktop keys: `F`, `N`, `↑` `↓`, `W`, and `←` `→` changing the season (or walking C's cells) without switching
  the variant;
- no request other than GET, the app shell's error-report tunnel aside.

`biome lint` is clean for the three new files and `tsc` reports no error in them (its 220 errors are all in other
files, as before).

Not checked: a production build, a real phone or touch (presses were mouse clicks at phone width), Safari and
Firefox, a screen reader, the page with a signed-in member, the finder's `9.14`, `s9` and bare-number forms (built, not run), "Don't know when" and the date field inside an opened row, and round 1 and 2's
routes beyond round 2's B loading for the height measurement.

# Episode list prototype, round 4

Fourth round for [#369](https://github.com/alp82/goodwatch-monorepo/issues/369), under map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Rounds 1 to 3 are in `docs/prototypes/episode-list/`,
`episode-list-2/` and `episode-list-3/` and stay at their routes.

The owner's verdict on round 3: "i kinda like the direction of A's navigation and the integrated scores of B. I think
it would be great to have a combination. And a way to start from small to detailed. We could experiment with a matrix
minimal for example. C is difficult to navigate and loses the score overview of everything that's not watched yet.
Just the borders is not enough signal".

So this round is one design that combines the two, and three experiments around the points it leaves open. The code
is throwaway and not meant to be built on.

## Open it

The dev server is at `http://100.71.215.115:3003`. That is the machine's Tailscale address, so the phone has to be on
the tailnet; `localhost` does not answer. The route is 404 in production.

- A, the design: http://100.71.215.115:3003/prototype/episode-list-4?variant=A&show=supernatural&scenario=watching
- B: http://100.71.215.115:3003/prototype/episode-list-4?variant=B&show=supernatural&scenario=watching
- C: http://100.71.215.115:3003/prototype/episode-list-4?variant=C&show=supernatural&scenario=watching
- D: http://100.71.215.115:3003/prototype/episode-list-4?variant=D&show=supernatural&scenario=watching

Switch variants with the floating bar (or the left and right arrow keys on a keyboard).

- `?show=supernatural|chernobyl|slow-horses|sherlock`
- optional: `&scenario=fresh|watching|on_hold|dropped|all|seen_new`, `&today=2026-10-14`, `&imdb=differs`
- optional: `&mark=line|tick|fade` and `&fit=cols|wrap|zoom` put any watched mark on any layout;
  `&ratings=watched` holds back the ratings of episodes not watched yet

The white panel at the top is round 1's (show, starting point, today). The white strip under it has this round's
switches: the watched mark, the layout, "Ratings of unwatched episodes" and "IMDb numbers a season differently". A
switch that differs from the variant's own turns black, and "Back to A's own" resets it.

What is real: nothing beyond the earlier rounds. Model, store and fixtures are round 1's, the hero and its score
control round 2's, the rows and the finder round 3's, all imported unchanged; round 4's own code is in
`app/ui/prototype-episode-list-4/`. Marks live in localStorage under the same key as the earlier rounds. Ratings are
TMDB votes standing in for IMDb ratings, so the colours are more uniform than the real grid's.

## The design (variant A)

Three levels, and the member goes down them by choice.

- **Level 0, the matrix.** A row per season, a cell per episode in its rating's colour, watched or not. A white line
  runs under the cells that are watched and stops where the member is; the next episode has a white ring. Each row
  ends with the watched count (a green tick when the season is done) and the season score. Specials are one last row
  without cells. On a phone a show with more than eight seasons puts them in two columns, so every row is a 40 pixel
  press target and Supernatural's fifteen seasons take 341 pixels; a wide screen also uses two columns, 238 pixels.
  This is where a tracked show starts.
- **Level 1, a season.** A press on a season row opens that season right under the row as round 3 B's one-line rows:
  tick, number, name, rating tile, air date. The other seasons stay as their matrix rows, so the matrix is the season
  navigation; a press on another row switches, a press on the open row (or the arrow in its heading) closes it. The
  pressed row does not move on the screen, also when the season that closes was above it. Where a cell is wide enough
  to hit (wide screens, short seasons, B and D on a phone) it is a shortcut to the same place with that episode's
  row lit.
- **Level 2, an episode.** A press on a row opens the still, the description, the date choice and "Watched up to
  here", as in round 3.

"Next · S2 E5" and the finder stay; on a phone the finder sits behind the magnifier beside the heading, which saves a
line. A limited series (Chernobyl) has no matrix and no finder, only its five rows. Keys on a wide screen: `F`
finder, `N` next episode, `↑` `↓` rows, `←` `→` seasons, `W` watched.

**A member who has never tracked the show** sees the same matrix with no line and no ring. It is a ratings overview
in the list's own numbering, and it replaces the separate ratings grid for everyone; the grid in IMDb's numbering is
one link below ("All ratings as one grid").

The other behaviours are unchanged: a tick is "now"; "Mark season" and "Watched up to here" apply at once and the
toast offers "Set a date"; specials can be ticked and are not counted; unaired episodes are disabled and their cells
are dashed outlines; an unwatched episode shows its name, and its still and description only after a press; a rating
is shown beside a TMDB episode only when IMDb's title matches, otherwise the cell is grey and the row has a dash.

## The experiments

### 1. The watched mark: line (A, C), tick (B), fade (D)

Asked: how to tell watched from not watched when every aired cell keeps its rating colour. `&mark=` puts each of
them on any layout; `detail-mark-line|tick|fade-*.jpg` show the three on A's layout.

- **Line.** A white line under the watched cells. It marks the boundary rather than each cell, it reads at any cell
  size, and it leaves both the watched and the unwatched colours untouched.
- **Tick.** A tick in every watched cell. Clear on cells of about 14 pixels and up; on the phone's slivers it has to
  become a dot, and a row of dots reads as noise (`detail-mark-tick-phone.jpg`).
- **Fade.** Watched cells fade, what is left stays in full colour. The eye goes straight to what is left, but the
  ratings of what was watched become hard to compare.

Answer: the line. It is the only one that works at the size the phone needs, and it keeps the ratings readable on
both sides of the boundary.

### 2. How small is small: the matrix (A) or one strip that opens to it (C)

Asked: should level 0 be smaller still. C starts as one strip for the whole show, 77 pixels high: a block per season,
as wide as the season is long, in the season score's colour, a line under it as far as the season is watched, a ring
on the season the member is in, and "In season 2 · 301 episodes left". A press opens A's matrix; "Fold to one strip"
goes back. For a show the member does not track, C starts at the matrix.

Answer: the matrix. The strip saves about 285 pixels on a phone and costs every visit one more press before a season
can be picked, and it hides the episode ratings, which is the overview the owner asked to keep. The strip would fit
somewhere the show is not the subject, such as a card in the Watching list.

### 3. Fitting a phone: two columns (A), big cells that wrap (B), thin rows that zoom (D)

Asked: how fifteen seasons of up to 23 episodes fit 390 pixels with nothing to scroll sideways.

- **Two columns (A, `fit=cols`).** Seasons 1 to 8 on the left, 9 to 15 and the specials on the right; cells shrink
  to slivers about 6 pixels wide. 341 pixels, rows of 40. The cells are too narrow to press, so the whole row is the
  target.
- **Big cells, twelve a line (B, `fit=wrap`).** One season per row, each on two lines of cells about 21 pixels wide,
  each cell a shortcut. 749 pixels: nearly a full screen before any season is open.
- **Thin rows (D, `fit=zoom`).** One true matrix with a 20 pixel row per season, 365 pixels. The open season's row
  is enlarged to B's big cells and its heading has arrows to the neighbouring seasons. The rows are half the 40
  pixels a finger needs; the arrows are there to correct a miss.

On a wide screen A and B are the same layout. D puts the matrix in one column of 22 pixel rows with the open
season's rows beside it in a box that scrolls, which keeps the section at 442 pixels whatever is open.

Answer: two columns on a phone. It is the only one of the three that is both under 400 pixels and has rows a finger
can hit. Shows with eight seasons or fewer get one column with big cells in every variant (Slow Horses, Sherlock).
On a wide screen I would also keep A: D's side-by-side is steadier (nothing moves when a season opens) but it starts
144 pixels taller and brings back the box that scrolls inside the page.

## Height of the content area

Pixels, measured in headless Chromium with the "Watching, partway" start (season 1 watched, season 2 at 4 of 22).
The first number is the episodes section from its heading to its end; the second adds the one-line link to the
ratings grid under it. "Level 0" is nothing open; "season open" is season 2 open (a phone shows eight of its rows,
the rest folded). The matrix alone, without the heading line, is 238 pixels on a wide screen and 341 on a phone in A.

| | Supernatural, 1280 | Supernatural, 390 | Chernobyl, 1280 | Chernobyl, 390 |
| --- | --- | --- | --- | --- |
| Round 3, B (always one season open) | 545 / 593 | 630 / 678 | 271 / 319 | 311 / 359 |
| A, level 0 | 298 / 346 | 409 / 457 | 271 / 319 | 311 / 359 |
| A, season open | 763 / 811 | 899 / 947 | | |
| B, level 0 | 298 / 346 | 817 / 865 | 271 / 319 | 311 / 359 |
| B, season open | 763 / 811 | 1307 / 1355 | | |
| C, level 0 (strip) | 117 / 165 | 125 / 173 | 271 / 319 | 311 / 359 |
| C, matrix | 314 / 362 | 445 / 493 | | |
| C, season open | 779 / 827 | 935 / 983 | | |
| D, level 0 | 442 / 490 | 433 / 481 | 271 / 319 | 311 / 359 |
| D, season open | 442 / 490 | 947 / 995 | | |

Chernobyl has no levels: it is the same five rows as in round 3. A never-tracked Supernatural measures the same as
level 0. Slow Horses and Sherlock at level 0 in A: 238 and 208 on a wide screen, 323 and 280 on a phone.

What the table says plainly: level 0 is about half of round 3's B on a wide screen and two thirds on a phone, and
with a season open the section is taller than round 3's B (by 218 pixels on a wide screen, 269 on a phone), because
the other seasons stay on the page instead of shrinking to a line of chips.

## Recommendation

Build A: the matrix with the line, two columns on a phone, seasons opening in place. Take from D only the arrows to
the neighbouring seasons if moving season by season turns out to be common.

## Questions to answer by looking

1. **Is the white line under watched cells enough signal, or do you want a mark in every cell?** Flip "Watched
   mark" on A on your phone. Suggested: the line.
2. **Two columns of seasons on a phone, or one column with thin rows (D)?** Suggested: two columns; D's rows are too
   thin to hit.
3. **With a season open the section is taller than round 3's B. Is that fine, or should the open season show fewer
   rows on a phone (five instead of eight)?** Suggested: fine as it is; the member chose to open it.
4. **Does the matrix replace the ratings grid for everyone, with the IMDb-numbered grid behind a link?** Suggested:
   yes.

## Screenshots in this folder

All JPEG; `-phone` is 390 wide at double density, `-desktop` is 1280 wide. The site bar and the prototype's switcher
are hidden in them.

- `A-`, `B-`, `C-`, `D-` with `supernatural-level0`, `-level1` (season 2 open), `-level2` (a row open); C also has
  `-level0-matrix`.
- `A-` to `D-` with `slow-horses`, `sherlock`, `chernobyl`, and `supernatural-never-tracked`.
- `detail-mark-line|tick|fade-*`: the three watched marks on A's layout.
- `page-A-supernatural-*`: the whole page with the hero.
- `detail-finder-9x14-*`, `detail-finder-landed-S9E14-*`: the finder. `detail-bulk-toast-*`: "Mark season".
- `detail-numbering-differs-*`, `detail-ratings-held-back-*`, `detail-specials-sherlock-*`.

## Verification

Run on 2026-10-07 against the dev server on main at `http://100.71.215.115:3003`, in headless system Chromium driven
by Playwright, at 390 and 1280 pixels wide. 576 scripted checks passed. In every variant at both widths they cover:

- all four shows: no sideways page scroll at level 0, 1 and 2, exactly one score control, the right starting level;
- season rows on a phone at least 40 pixels high (A, B, C: 40 to 44; D on Supernatural is 20 by design and is
  excluded from that check);
- a press on a season row opens its rows with rating tiles while the other seasons stay; a press on a row opens it;
  a second press on the season row closes it; the pressed row stays where it is when another season was open;
- a press on a cell, where cells can be pressed, opens its season with that row lit;
- Chernobyl: five rows, no matrix, no finder, no still before a press; watching through puts the prompt on the one
  score control and "Rate it" in the toast;
- never tracked: starts at the matrix, no watched mark, no next mark, every rated episode coloured;
- tracking: 26 watched cells, one next cell, every other rated cell still coloured; "Next" from level 0 opens the
  season with the next row in view; the finder with `9x14`, `s9e14` and `captiv` lands on S9 E14, lit;
- marking: a tick marks the cell, moves the ring and is dated now; "Mark season" applies at once and "Set a date"
  opens the dialog; an opened row offers "Watched up to here"; a special can be ticked and changes no progress; Slow
  Horses' unaired episodes are disabled;
- `imdb=differs`: exactly one grey cell in season 1 and the note in the open season; `ratings=watched`: only the 26
  watched cells are coloured; `mark=` and `fit=` override the variant;
- C: the strip opens the matrix and folds back. Wide screen: `N` and `F`.

The one check that failed is "no request other than GET": the app shell sends Google Analytics page views by POST to
google-analytics.com when the page is opened by its Tailscale address. Nothing was sent to the dev server other than
GET, and the prototype's own code sends nothing.

`biome lint` is clean for the three new files and `tsc` reports no error in them (its 220 errors are all in other
files, as before).

Not checked: a real phone or touch (presses were mouse clicks at phone width), a production build, Safari and
Firefox, a screen reader, the page with a signed-in member, the date field and "Don't know when" inside an opened
row, the hero's "Next episode" line as a way into the list, the keys `↑` `↓` `←` `→` `W` (round 3's code, not run again), a show with one long season, and widths between
390 and 1280.

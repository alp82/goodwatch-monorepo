# Episode list prototype, round 2

Second round for [#369](https://github.com/alp82/goodwatch-monorepo/issues/369), under map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Round 1 is in `docs/prototypes/episode-list/` and
stays at `/prototype/episode-list`.

The owner's feedback on round 1: "B is best. i am not sure yet about the content area, because we have 2 tabs + a
subtab nav for the seasons here. show me more great UX alternatives. the box in the header is great though. just
avoid the double scoring when seen is enabled."

So this round keeps B's hero, shows one score control, and asks one question: how do the episode list and the
read-only episode ratings share the content area without a tab bar on top of a season sub-navigation?

Code is on the branch `prototype/episode-list-2`. It is throwaway and not meant to be merged.

## Open it

```
cd goodwatch-webapp
npm run dev
```

Then open `/prototype/episode-list-2` on the dev server (the route answers 404 in production). Switch variants
with the floating bar or the left and right arrow keys.

- `?variant=A|B|C|D|E`
- `?show=supernatural|chernobyl|slow-horses|sherlock`
- optional: `&scenario=fresh|watching|on_hold|dropped|all|seen_new`, `&today=2026-10-14`
- optional: `&imdb=differs` simulates IMDb numbering a season differently (see variant D), `&sheet=1` opens the
  sheet in variant E

The white panel at the top is round 1's: it picks the show and a starting point, moves "today", and prints the
stored state after every action. Below it, one switch turns the simulated IMDb numbering on and off.

What is real and what is not, beyond round 1's notes:

- The model, the store, the episode rows and the TMDB fixtures are round 1's, imported from
  `app/ui/prototype-episode-list/`. Round 2's own code is in `app/ui/prototype-episode-list-2/`. The store got one
  addition (a "Rate it" action in the toast, only when round 2's score control is on the page).
- Marks live in localStorage under the same key as round 1, so both rounds show the same marks for a show.
- Season scores and tile numbers are TMDB votes standing in for IMDb ratings, as in round 1.
- Not built: season posters on the cards (the fixtures have none), focus handling in the sheets, swipe to close.

## The same in every variant

- **The hero is round 1's B**: the box with the status pill and its menu, the progress, the next episode and its
  one-press Watched; Dropped in Not interested's place once an episode is watched.
- **One score control.** When the show is watched through and has no score, the score control's heading becomes
  "You've watched all of Supernatural. How was it?", the control gets a soft amber frame that pulses twice, and
  "Not now" puts the normal heading back. The box below says "You've watched every episode." and holds no second
  control. With a score nothing prompts. A person who finishes a show from far down the list gets "Rate it" in the
  toast, which scrolls to the control. See `detail-score-prompt-*.png` and `detail-score-given-*.png`.
- **Round 1's marking**: a press marks now; bulk marks apply at once with no date and the toast offers "Set a
  date"; a mark past a gap offers the earlier episodes; stills and descriptions of unwatched episodes stay hidden
  until tapped; specials can be marked and are not counted; unaired episodes are disabled.

## The variants

**A. One scroll, season scrubber.** Every season sits in one scroll under sticky season headers, after the
ratings; a strip that sticks under the site bar has one segment per season, as wide as the season is long and
filled as far as it is watched, to press or drag along. Seasons already watched through, and the specials, start
folded to one line.
Strongest: finding your place and back-filling feel continuous, and the strip shows the whole show's progress at
any scroll position. Weakest: length. A fresh Supernatural is about 25,000 pixels, so the list has to be the last
thing on the page, and on a phone the strip's segments are 19 pixels wide.

**B. Season rail.** On desktop a rail lists the seasons, each with its count and season score, and the picked
season's episodes sit beside it; on a phone the rail is one sticky bar that names the season, has an arrow either
side, and opens the same list of seasons as a sheet. The ratings are their own section below.
Strongest: one level of navigation and a bounded height (never more than one season), so the ratings stay a short
scroll away and the season scores in the rail already answer "which seasons are good". Weakest: one season at a
time. On a phone the other seasons are behind the bar, and back-filling fifteen seasons is fifteen times "Mark
season, next".

**C. Season cards.** Each season is a card with a progress ring, the season score and a strip with one sliver per
episode in its rating's colour; a card opens its episodes in the row under it, and the season with the next
episode starts open. The ratings stay as their own section below; a show with one season has no cards.
Strongest: the best overview of a long show, with progress and quality of every season on one screen before any
episode is listed. Weakest: the open list splits the cards (on Supernatural seasons 9 to 15 land under 22 rows),
and the ratings now appear three times: chip, strip and grid.

**D. One grid: the ratings are the marks.** The list and the ratings become one object: a press picks a rating
tile and a row above the grid shows that episode (the list's own row, with its date strip), a press on the picked
tile marks it, and a season label picks the season to mark it whole. Specials fold out under the grid.
Strongest: the whole show, its ratings and your progress on one screen, and the quickest back-fill of single
episodes. Weakest: the two numberings. The rows are TMDB's episodes and the numbers are IMDb's ratings found by
season and number, so where they differ a tile shows another episode's rating. Also: tiles are 34 by 32 pixels on
a phone, a 15-season show scrolls sideways there, and episode names show one at a time.

**E. Ratings on the page, list in a sheet.** The page keeps the ratings alone; the list opens from the hero box
("All episodes", or a press on the next episode) in a sheet on phones and a side panel on desktop, with A's one
scroll and scrubber inside, opened at the next episode. This is round 1's variant C under B's hero.
Strongest: the show page stays as it is for everyone who doesn't track (it is a cached landing surface with a
render path budget), and the list gets the full height. Weakest: the list is behind a press and covers the page,
so list and ratings are never seen together, and the hero box grows by a row.

### What D does when the numberings differ

Switch on "IMDb numbers a season differently" and open D on Supernatural
(`?variant=D&show=supernatural&imdb=differs`, `detail-D-numbering-differs-*.png`). The simulation is the common
case: IMDb counts the first season's two-part opener as one episode, so every later episode of that season sits
one number lower on IMDb. In D, twenty of the season's tiles then show the rating of the episode after them, and
the last tile has none. The prototype can tell, because IMDb's title at that number is not the episode's title:
those tiles get a yellow corner, the season a star, and the picked episode's row says whose rating it is. A real
build could match by title and repair this case. It could not repair a season IMDb splits in two, a show IMDb
numbers straight through, or episodes whose titles differ between the sites, and there the grid would show a
wrong number with at best a warning. The other variants keep the grid in IMDb's numbering and the list in
TMDB's, so each is right on its own terms.

## Recommendation

**B, the season rail**, with the ratings as their own section below it.

- It removes exactly what the owner objected to. There is one navigation (the seasons) and no tabs; the ratings
  are a section, as on today's show page, where the score bar's link to them keeps working.
- Its height is bounded by the longest season, so it can sit anywhere on the page. A needs to be last, C pushes
  half its cards under the open list, and both make the ratings a long way down on a long show.
- The daily case is already in the hero box. What is left for the content area is looking around and
  back-filling, and the rail does both with the season scores in view. The sticky bar on phones keeps "next
  season" under the thumb.
- D is the most striking, and I would not build it. The numbering problem is in the data, not the layout: a tile
  that sometimes shows another episode's rating is worse than two objects that are each correct. It also makes
  the cached, public ratings grid depend on the member's marks.
- E is the fallback if the list must not cost the show page anything. The sheet loads on first use; B's rail
  would have to load its episodes on demand to match that.

Worth taking from the others: C's rating strip could sit in B's rail rows if the season score alone feels thin,
and A's strip could replace B's phone bar (question 4).

## Questions to answer by looking

1. **Which content area: A, B, C, D or E?** Suggested: B.
2. **Where do the ratings go relative to the list?** A has them above, B and C below. Suggested: below in B, where
   the list is never longer than one season; above only if the list is one long scroll.
3. **Should season scores sit in the season navigation** (B's rail, C's cards, the season headers in A and E)?
   They repeat the grid's season labels. Suggested: yes, they are the quickest answer to "which seasons are good".
4. **On a phone in B: the bar with arrows and a season sheet, or A's scrubber strip?** Suggested: the bar; the
   strip's segments get too narrow past about ten seasons.
5. **Is D worth a real attempt, given the numbering?** Suggested: no. Keep the grid read-only in IMDb's numbering.
6. **The rate prompt:** the score control carries it, "Not now" puts it away for good for that show, and the toast
   offers "Rate it" when the last episode was marked from the list. Suggested: keep all three.

## Screenshots in this folder

- `A-` to `E-`: each variant on Supernatural (partway), Chernobyl (partway) and Slow Horses (three episodes still
  to air), on desktop (1280) and phone (390). `E-*-page` is E's page with the sheet closed.
- `hero-supernatural-*`: the fixed hero.
- `detail-score-*`: the score control as the rate prompt, and after a score.
- `detail-*-specials-sherlock-*`: a marked special in each variant.
- `detail-A-scrubbed-*`, `detail-A-ratings-above-list-*`, `detail-B-season-picker-phone`, `detail-C-fresh-*`,
  `detail-D-season-marked-*`, `detail-D-numbering-differs-*`, `detail-E-watched-through-in-sheet-phone`,
  `detail-bulk-toast-phone`, `detail-set-a-date-desktop`.

## Verification

Run on 2026-10-07 against the dev server from this branch (no `.env`), in headless Chromium at 1280 and 390
pixels wide. 318 scripted checks passed. They cover, in every variant at both widths: a single mark is "now"; a
mark past a gap offers the earlier episodes and marks them with no date; "Mark season" applies at once and "Set a
date" opens the dialog; an unwatched episode's still stays hidden and a tap shows the description; a special can
be marked and changes neither progress nor status; unaired episodes can't be marked; exactly one score control
before and after watching through, with the prompt on it, "Not now", and no prompt once scored; no sideways page
scroll; no tab bar in the content area; no request other than GET, the app shell's error-report tunnel (`/api/e`) aside. They also cover each variant's own navigation
(the strip's press and drag, the rail and the phone picker, a card opening under its row, D's pick-then-mark and
its flags when numbering differs, the sheet opening at the next episode and "Rate it" closing it). Round 1's
variant B was opened once to confirm it is unchanged. `biome lint` is clean for the changed files and `tsc`
reports no error in them (its 220 errors are all in other files, as before).

Not checked: a production build, a real phone (the strip's drag was driven with mouse events), Safari and Firefox,
keyboard and screen reader use, and the page with a signed-in member.

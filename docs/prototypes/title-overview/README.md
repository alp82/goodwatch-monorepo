# Title overview prototype

Throwaway. The code is not meant to be built on.

## The question

What should the title page's overview (the panel beside the poster) look like for a signed-in member?

The owner's complaints about today's panel:

- major: the ratings are not grouped properly
- major: the member's own score should be shown in a nice way
- major: the full score picker should be hidden behind a control
- minor: there is sometimes empty space below the poster

## Round 3

The owner's verdict on round 2, reviewed on a phone: round 1's D and A are still better than E, F, G and H. G and H
"have potential"; E ("a wall of chips") and F ("loses seeing the external ratings easily, streaming badly placed") are
out. What round 2 got wrong everywhere: the external ratings were hard to read or hidden, where to watch had no
structure, and a "more" menu replaced a single button.

So I, J and K take G's structure and H's compactness, and are made for a phone first. In all three:

- The sites are always visible: one chip per site with critics and audience in the same chip and a divider between
  them, as on the real title page (IMDb 7.8, Metacritic – | 7.8, Rotten Tomatoes 78% | 79%).
- Where to watch is a section: a title row that carries the settings on its right (Stream / Rent / Buy and the
  country), then big logos with the services' names. Yours come first, with a green ring.
- Not interested and Drop are buttons. On a phone the third button of a row is its icon alone, with its name for
  screen readers.
- At most three blocks: ratings, your show or movie, where to watch. Tracking is one line (status pill with its
  menu, "16/22" with a small bar, the Next episode as a chip).

| | Structure | Score display | Episode ratings | Many services |
|---|---|---|---|---|
| **I · Rings on the banner** | The ratings are one group on the banner. Under it two blocks, your show and where to watch (side by side on a wide screen) | A's two rings | A link after the site chips | One row of logos with their names under them, swiped sideways inside the section |
| **J · Three cards** | G's structure: a strip for the poster and the title, then three cards of different weight (stacked on a phone, side by side from 1024) | D's ring and pill | In the ratings card's heading | Logo and name side by side, two to a row; four show, "All 11 services" opens the rest in place |
| **K · One sheet** | The whole overview is the picture; one dark sheet on it has three parts divided by hairlines (rows on a phone, columns from 1024) | D's ring and pill | A link after the site chips | Logos with their names under them, four to a row; three show and "+8 More" opens the rest in place |

Kept for comparison, unchanged but for the trailer button and the poster: G and H from round 2, A and D from round 1.

### Heights

The overview alone, in the owner's screenshot case (Watching, 16 of 22, scored 7, one service), measured in the page:

| | 390 px wide | 1280 px wide | ends at, in a 1280×720 window |
|---|---|---|---|
| D (round 1) | 721 | 725 | 885 (scrolls) |
| A (round 1) | 790 | 498 | 658 |
| G (round 2) | 632 | 410 | 490 |
| H (round 2) | 414 | 334 | 414 |
| I · Rings on the banner | 591 | 437 | 517 |
| J · Three cards | 588 | 375 | 455 |
| K · One sheet | 545 | 407 | 487 |

A and D have the title above them (80 px); the others carry it on the banner, so their "ends at" includes it.

### Everywhere: the trailer button and the poster

- The trailer button always has its word: "Play trailer", or "Trailer" where there is less room (every phone layout).
- A press on the poster opens it over the whole screen. It grows out of the small poster's place and goes back into
  it (the big image is laid out where it ends and moved with a transform, 320 ms in, 260 ms out). With "reduce
  motion" it fades instead. A press anywhere, Escape or the close button closes it.

## Round 2

Round 1's D (Banner) was picked but "uses up lots of vertical space". Round 2 tried four shorter descendants: E (Slim
banner), F (Dock), G (Strip and three cards), H (One control). E and F were rejected and removed.

Fixes from round 2 that stay: a popover or menu is pushed back onto the screen; a Seen show has no second Seen button,
so "Caught up" stands once; the "Links go to licensed services" sentence is gone.

### Want to See on a Seen title

Want to See stays available once a title is Seen, and there it reads **Want to rewatch**. Pressed, it is the same
amber button, and its tooltip says "On your Wishlist to watch again". It only bookmarks: a movie stays Seen, a show
stays Seen or Caught up with its episodes ticked.

For a show it sits beside **Watch again** in the status menu, and the notes under the two say how they differ:

- Watch again: "Starts pass 2 now: the ticks start empty and it is Watching again."
- Want to rewatch: "Only bookmarks it on your Wishlist. Your episodes stay ticked." Once on, the entry reads "On your
  Wishlist to rewatch".

Watch again clears the bookmark (the rewatch has begun), and so does Take back Seen.

Wordings considered: "Want to See again" (keeps the domain term, but is one word from "Watch again"); "Rewatch later"
(clear about when, but drops "Want"); "On your rewatch list" as the pressed label (there is no such list, it is the
Wishlist, and it is too long for a phone button).

## Round 1

Four variants; A and D are kept, B (Yours under the poster) and C (One card, poster inset) were rejected and removed.

- **A · Scoreboard**: two rings (GoodWatch, yours) beside a table of the three sites with Critics and Audience as
  columns. Your ring opens the picker as a popover (a sheet on a phone). The poster column follows the panel's height.
- **D · Banner**: the backdrop is a banner and a small poster overlaps its edge. One bar holds every rating: GoodWatch
  ring, your score as a pill, Critics and Audience as two runs of site chips. The pill opens the picker as a dialog.

## Open it

    cd goodwatch-webapp
    npm run dev

Then `/prototype/title-overview` on the dev server. It needs no database and no `.env`: the sample data is in
`app/ui/prototype-title-overview/model.ts`, every press stays in React state, and a reload starts over. The route is
404 in production, and `PROTOTYPES` in `vite.config.js` keeps it out of the production build.

- `?v=I|J|K|G|H|A|D` the variant. The floating bar's arrows, or the left and right arrow keys, switch it.
- `&s=show-watching|show-new|show-caught-up|movie-new|movie-seen` the sample member and title (the bar's first list)
- `&p=one|many|none` how many streaming services have the title (the bar's second list)

What works: the score control opens the picker; a level or a number sets the score; Clear score; Want to See, Want to
rewatch, Seen, Not interested, Drop; the status menu (Put on hold, Resume, Mark as Seen, Watch again, Want to rewatch,
Take back Seen, Drop); Stream, Rent, Buy; all services; the poster full screen. What does not: the trailer, the links
to the episode list and to the services, the country.

## Screenshots

`<variant>-<what>-<phone|desktop>.jpg`. Phone is 390 px wide, desktop a 1280×720 window.

- `watching`: the owner's screenshot case (Watching, 16 of 22, scored 7, one service)
- `watching-many`, `watching-none` (I, J, K): the same with eleven services, and with none
- `unrated`: a show not started and without a score
- `movie-seen`: a Seen movie, with Want to rewatch
- `picker`: the score picker open
- `I-poster-phone.jpg`: the poster full screen

## What was checked

Every variant × scenario × number of services at 390, 768, 1024 and 1280 pixels (420 pages): no sideways scroll, no
element past the screen's edge (but inside I's row of services, which scrolls), no text cut off in the ratings or a
button, no label twice and no status word twice, the trailer button has its word, no broken image, no page error; in
I, J and K the site chips are visible exactly once and there is no "more" menu. On each page the poster was opened
(inside the screen, bigger than before) and closed with Escape, and every control that opens something (your score,
the status pill, and in G and H the sites' chip, the services control and "more") was pressed with the control near
the bottom edge of the screen: what opened was inside the screen on all four sides and closed on Escape. The controls
were pressed in every variant at 390 and 1280 (473 checks): scoring, the rewatch rule, the services section, and the
poster closing by a press, by Escape and by its button.

Known: at 768 to 1023 pixels round 1's A crops its poster hard. The page logs one hydration error from the site's
shell ("This Suspense boundary received an update before it finished hydrating"); the existing prototypes' check
scripts filter the same error, and it is not from this route.

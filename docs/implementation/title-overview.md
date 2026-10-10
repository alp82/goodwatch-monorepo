# The title overview

The card at the top of a movie's or a show's page (`ui/details/hero/DetailsHero.tsx`), as built on October 9, 2026.
It is variant L of [the title overview prototype](../prototypes/title-overview/README.md), which lives on the branch
`proto/title-overview` and is not merged.

The owner's complaints about the card it replaces: the ratings were not grouped, the person's own score was not
shown in a nice way, the full score picker was always open, and there was sometimes empty space under the poster.

## What it is

One card under the page's header. The header keeps the title, the year and the facts; the card does not repeat
them (see "Where it differs from L").

**The banner** is the backdrop, with the trailer button in its top right corner. The button always has its word:
"Trailer" on a phone, "Play trailer" from 768 px. On the banner:

- **The poster.** A press opens it over the whole screen. It grows out of the small poster's place and goes back
  into it; with "reduce motion" it fades. A press anywhere, Escape or the close button closes it.
- **The ratings, as one group.**
  - The GoodWatch score as a ring, with its word.
  - The person's own score as a rectangle: the number on its colour, "Your score", the word, a pencil. Without a
    score it is the same rectangle with a dashed amber border and a hollow background: a star, "Your score", and
    "Rate it" (on a phone) or "Rate this movie" / "Rate this show".
  - One chip per site with critics and audience in it (`RatingChips.tsx`, unchanged).
  - For a show with an episode grid, a miniature of the grid at the right end of the chips' row. It leads to the
    Episodes section, as the "Episode ratings" link did.

**Two blocks** under the banner, side by side from 1024 px:

- **Your movie / your show** (`ListActions.tsx`): Want to See, Seen and Not interested in one row. For a member
  with episode tracking, a status line above it (see "Who sees what").
- **Where to watch** (`WhereToWatch.tsx`): a title row with the offer type (Stream, Rent, Buy) and the country on
  its right, then the services as cards, logo beside name, two to a row and the person's own first with a green
  ring. Four show; "All N services" opens the rest in place. A card that would stand alone in its row takes the
  whole row and says "On your services", or the kind of offer.

**Every row runs from its left edge to its right edge.** The ring starts the scores and the own score ends them;
the chips start their row and the miniature ends it (a movie's chips share the row's width instead); the status is
at the left and the Next episode at the right; the buttons fill their row. On a phone the two scores stand over
each other beside the poster, each as wide as that column.

## The score picker

The rectangle is the page's one control for scoring. A press opens the full picker (`ScoreDialog.tsx`): Dislike /
Okay / Good / Excellent over the 1-10 strip, with "Clear score" inside, which is the existing `ScoreControl`. It
is a sheet from the bottom edge on a phone and a dialog in the middle of the screen from 768 px. It is fixed to
the screen and rendered into the body, so it is inside the screen wherever the page is scrolled. Escape, the
close button and a press beside it close it, and the focus returns to the rectangle. A score closes it; clearing
leaves it open.

A guest scores as before: `useScoreAction` records guest progress and, at the rating limit, sends the event that
opens the sign-up prompt.

## The miniature of the episode ratings

Twelve cells, four by three, in the grid's colours, the same picture as the Grid toggle of the Episodes section
(`ui/tracking/EpisodeList.tsx`). It is drawn from the show's real ratings: the page's loader already has the
episode grid, and `miniatureScores` in `ui/details/episode-grid/scale.ts` cuts the rated episodes, in order, into
twelve stretches and takes the mean of each. No request is added. A show with fewer than twelve rated episodes
repeats them. A movie, and a show without a rated episode, has none.

## Who sees what

The layout is the same for everyone. What differs is the "your movie / your show" block.

| Viewer | The block |
| --- | --- |
| A guest | Want to See, Seen, Not interested. Seen asks to sign in, as before. Want to See, Not interested and the score are guest progress, as before |
| A member, `REC_TRACKING` off | The same three buttons. Seen is the toggle, for movies and shows |
| A member, `REC_TRACKING` on, a movie | The same row; Seen records a watch and opens the watch log once the movie is Seen (unchanged) |
| A member, `REC_TRACKING` on, a show | First paint: the status pill from the member data when the show has a state, then the three buttons. Then `HeroTracking` takes over in place: the status line, the prompts, and the actions of the state |

The status line of a tracked show is one row: the status pill with its menu, "16/34" with a small bar, and the
Next episode as a chip that leads to its row in the episode list. A show that is Not started has "Already
watching?" and the way to the episodes instead. The line has the height the first paint reserved (36 px).

The actions of a tracked show, by state:

| State | The row |
| --- | --- |
| Not started | Want to See, Mark as Seen, Not interested |
| Watching, On hold | Mark as Seen, Drop |
| Dropped | Mark as Seen, Dropped (pressed; one press resumes) |
| Seen | Want to rewatch. With episodes that are new, also "Mark N new" |

A Seen show says so in its pill ("Seen", or "Caught up" while it runs), so it has no Seen button. Taking the press
back is in the pill's menu, which asks first, and beside the press's line in the episode list.

The prompt to rate ("Three episodes in. How is it so far?", "You've watched all of it. How was it?") is one amber
line with a Rate button that opens the picker, and "Not now". The question after a first score ("Have you seen all
of it?") is unchanged.

**Want to rewatch** is Want to See on a Seen title: see
[ADR 0009](../adr/0009-tracking-is-a-state-machine.md) and the data model. It works for every member, with or
without the flag, and for movies and shows.

## What loads when

The card is in the first view, server-rendered, and the same HTML for every guest: the own score is the empty
rectangle until the member data or the guest progress arrives, and it keeps its size.

| Code | Loads |
| --- | --- |
| `ScoreDialog` with `ScoreControl`'s markup (3.2 KB, 1.4 KB Brotli) | When the pointer, a finger or the focus reaches the score rectangle |
| `PosterFullScreen` (3.1 KB, 1.3 KB Brotli) | When they reach the poster |
| `TrailerDialog`, the country list | As before, on reach |
| `HeroTracking` | As before, for a member with the flag on a show |

The first view of a movie page is 2,976 bytes of script larger than before (640 bytes Brotli, 233,535 against
232,895), and the stylesheet 16 bytes Brotli. The poster is new in a phone's first view: one more image, 13.6 KB
for the budget's movie at the size a phone asks for. The render path budget's image and total lines for the movie
and the show are raised by that much in the same commit (`goodwatch-benchmark/urls/budget.json`, and
[the budget's document](../benchmarks/viral-spike-render-path-budget.md)).

## Where it differs from L

- **The title is not on the banner.** The real page has a header above the card that sticks to the top and holds
  the title, the year and the facts. L had the title on the banner because the prototype had no header; here it
  would stand twice, a few pixels apart. So on a phone the two scores take the title's place beside the poster,
  over each other, and the card is shorter than L.
- **The sentence "Links go to licensed services. Data from JustWatch and TMDB." is gone,** as in L and by the
  owner's decision. The credit to JustWatch and TMDB is still in the page's footer, on the About page, in the
  page's own Streaming section and on a share list.
- **"Set your services"** is kept from the old card: a small link under the services, from 768 px up, while none
  of them is the person's.
- **A tracked show's Seen button is gone once the show is Seen,** as in L. Before, a second press of that button
  took the press back without asking; now it is always the menu or the press's line, and both ask.
- **Buttons are 36 px high,** as in L, where the old card's were 44 px.

## How it is checked

The real card can't be rendered without a database, so it is mounted in the two development harnesses, over their
stand-in servers:

- `/prototype/episode-tracking-real` mounts `DetailsHero` for a show, with `&providers=one|many|none`.
- `/prototype/watch-log-real?hero=693134|680|157336` mounts it for a movie.

The scripted checks of both pass on it: `docs/implementation/tracking/episode-tracking/drive.mjs` (255 checks at
390 px and 251 at 1280, with the rewatch rule) and `docs/implementation/tracking/movie-watch-log/drive.mjs`.

The screenshots in [`title-overview/`](title-overview/) are of the real components in those harnesses, at 390,
768, 1024 and 1280 px: `guest-movie`, `guest-show`, `member-movie-unrated`, `member-movie-seen-scored`,
`member-show-not-started`, `member-show-watching-scored`, `member-show-caught-up-rewatch`, `many-providers`,
`no-providers`, and `picker` and `poster`. At every width and in every one of them: no sideways scroll, nothing
past the screen, every row from edge to edge, no action's name cut off, no status word twice, the picker and the
full-screen poster inside the screen and closed by Escape.

Not checked: the page in production, with the header above the card and real data; `./bench.sh budget`, which
measures the deployed site; a real phone; Safari and Firefox.

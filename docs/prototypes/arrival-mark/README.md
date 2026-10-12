# Mark and order: a lasting "New on <service>" mark, and what landed at the top

Prototype A of [#489](https://github.com/alp82/goodwatch-monorepo/issues/489). Throwaway: nothing here is meant to
ship as it is.

**The question.** [#456](https://github.com/alp82/goodwatch-monorepo/issues/456) knows when a title a member waits
for landed on one of their services, and uses it for a signal that clears when the member opens My shows or My
movies. After that nothing shows which titles just arrived. What should stay on the title, and how do the titles
that landed get to the top of My movies and My shows?

## Run it

```
cd goodwatch-webapp && npm run dev
```

Then open `http://localhost:3003/prototype/arrival-mark`. The route reads no service and writes nothing: every
landing is made up and lives in the browser. It answers 404 in a production build. The pictures were taken with
`REC_NAVIGATION=on REC_TASTE_MATCH=on` and no `.env`, as a guest.

| Parameter | Values | What it does |
| --- | --- | --- |
| `variant` | `A`, `B`, `C`, `D` | The variation. The pill at the bottom and the left and right arrow keys switch it |
| `page` | `movies`, `shows`, `want`, `title` | My movies, My shows, the Want to See list of My library, a title page |
| `member` | `several`, `one`, `both`, `none` | Several titles on different services, 1 to 12 days old; one movie; a show with a new episode that also landed; nothing |
| `day` | `0` and up | Days after the start day. "Next day" in the controls adds one, to watch a mark age |
| `title` | a title's key | The title of the title page |
| `only=1` | | B: the chip is on |
| `sort` | `arrived`, `match` | C: the sort of My movies and the Want to See list |
| `visit=first` | | Also shows the line the real pages say on the first visit after a landing |
| `chrome=off` | | Hides the prototype's controls |

"State" in the controls lists every landing, its age, and whether the variation on screen still marks it.

## The four variations

| | Bets on | The mark | One or several services | How long | Beside a new episode | To the top |
| --- | --- | --- | --- | --- | --- | --- |
| **A · Shelf** | A landing is an event that earns a place of its own | A tag under the poster or beside the row's tags: "New on Max" | Names them: "New on Netflix and Disney+" | 14 days, then gone | Two tags side by side | A "Recently arrived" row of posters above the list |
| **B · Chip** | The logo is enough, and the member asks for the list when they want it | The service's logo, ringed in sky, with a "New" tab on the poster | One logo each | 7 days, then gone | The logo sits on the picture, the episode tag in the row | A chip "New on your services 3" that narrows the page |
| **C · Order** | A landing is one more fact that places a title, in the list's own grammar | A line of words where the row's fact is: "New on Max · yesterday" | Names them | Sky for 7 days, then grey "On Netflix since 30 Sept" until day 14 | The tag says the episode, the fact says the landing | A sort "Recently arrived" on My movies; a "Just arrived" group on My shows |
| **D · Log** | What landed is a short dated list, and a mark is for what you have not looked at | A dot on the title | The dot does not say; the log names them | Until the title is opened, 30 days at most | A dot before the name; the log adds "also a new episode" | One row that names the latest, counts the rest, and opens to all with their days |

On the title page the mark sits in the where-to-watch block: A under the service's name ("New · 5 days ago"), B as
a sky ring and a "New" tab on the service, C as a sentence above the services ("On Netflix and Disney+ since 7
Oct, 5 days ago. You added it 2 months ago."), D as a band on top of the block and a dot on the service.

## Recommendation

**The row of D, with the words of A and C, for 14 days.** Not one variation as built.

- **Design for one title.** About seven Want to See titles a week land for their owner across all members
  (#456), so a member has none or one in two weeks, rarely several. A shelf with one poster, a chip that filters
  to one movie and a sort that moves one movie are all too much for that. The row says it in one line ("Dune: Part
  Two is new on Max"), costs 48 pixels above the hero, and still holds seven.
- **The row is the line on arrival, made to last.** The pages already say "Dune: Part Two is now on Netflix" once.
  The row says the same for 14 days and opens to the days. It should replace that line, not join it
  (`visit=first` shows both together).
- **Words, not a logo or a dot.** The real poster already carries a score, a taste match, a service logo and the
  name. The ringed logo of B is lost on a large poster and unreadable on the 40 pixel poster of the Want to See
  list. The dot of D says nothing by itself and is the signal's dot, which means "since your last visit". A tag
  under the poster (A) and a line where the row's fact is (C) read at every size and name the service.
- **The same row on My shows**, above Continue, as a sibling of the waiting row. The "Just arrived" group of C is
  the alternative there; it moves a show out of Start, which the row does not.
- **14 days, flat.** With B's 7 days a member who opens the app once a week misses a landing. The quiet second
  week of C is a rule nobody will notice in a list. "Until opened" (D) needs a stored fact for every member and
  title and a write on every title page, and opening a title is not watching it.

## For the owner to decide

1. **How long.** 7 or 14 days flat, loud then quiet, or until the title is opened (a stored fact per member and
   title)?
2. **The line on arrival.** Does the lasting piece replace it, or do both show on the first visit?
3. **What counts for the mark.** #456 counts a landing only after the member added the title. Does a title added
   yesterday that landed three days ago carry "New on Netflix"? The prototype's data never has that case.
4. **Several services.** Name both ("New on Netflix and Disney+"), or the first and count? A second service that
   comes later for a title that was watchable already carries no mark by the rule of #456: keep that?
5. **A show in progress that lands.** It keeps its place in Continue here. Should it move up?
6. **The sort or the chip on a phone.** My movies has its choices in a slab at the bottom there, with four keys.
   The prototype puts the chip and the sort under the page's head instead; a fifth key was not drawn.
7. **The title page beyond 14 days.** "On Netflix since 30 Sept" is a fact the page could keep for as long as the
   time is known (90 days).

## What is real and what is not

- The site header and dock, the page heads, the poster card of the grid and the line on arrival are the app's own
  components. The lists of My movies, My shows and the Want to See list, and the where-to-watch block, are copied
  from the real pages with their classes, so the real pages are untouched.
- Drawn and without function: the moods, "How long?", the services toggle, the status switch, the kind filter, the
  search. My shows has no waiting row and no shows set aside. The title page's hero is a sketch around the
  where-to-watch block.
- The poster card is shown without its title actions, which sit at the bottom of the poster under the pointer.
- Opening a title opens nothing: it counts as opened, which only D uses.
- Titles and pictures are TMDB's. Every landing, score, match and date is made up.

## Screenshots

In [`shots/`](shots/), each at 390 x 844 (`-phone`) and 1440 x 900 (`-desktop`), taken by [`shots.mjs`](shots.mjs).

| | My movies | My shows | Want to See | Title page | More |
| --- | --- | --- | --- | --- | --- |
| A | `A-movies` | `A-shows` | `A-want` | `A-title` | `A-movies-grid`, `A-movies-one`, `A-movies-none`, `A-shows-both`, `A-movies-day-3` |
| B | `B-movies` | `B-shows` | `B-want` | `B-title` | `B-movies-grid`, `B-movies-chip-on`, `B-shows-chip-on`, `B-shows-both` |
| C | `C-movies` | `C-shows` | `C-want` | `C-title` | `C-movies-grid`, `C-movies-best-match`, `C-shows-both`, `C-want-day-3` |
| D | `D-movies` | `D-shows` | `D-want` | `D-title` | `D-movies-grid`, `D-movies-log-open`, `D-shows-log-open`, `D-shows-both`, `D-movies-one` |

`-grid` is the stepped grid under the hero, where the posters carry the marks. `-day-3` is three days on: the
landing of 12 days is 15 days old and gone in A, the one of 5 days is 8 days old and quiet in C.

```
PLAYWRIGHT=<a folder with playwright-core> BASE=http://127.0.0.1:<port> node shots.mjs shots
```

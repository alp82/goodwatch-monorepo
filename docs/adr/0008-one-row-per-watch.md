---
status: accepted
---

# Store every watch as its own row

GoodWatch records each watch of a movie or an episode as one row. Decided on October 6, 2026, while planning episode
tracking and the imports that follow it. Sources compared:
[import-sources-inventory.md](../research/import-sources-inventory.md).

Until now a title had one row in `user_watch_history` with a list of timestamps. The only writer stored "now" and
replaced the list on every write, and every reader used the row as a yes or no. Episodes had no place at all.
Trakt, Letterboxd, Simkl, Netflix and Plex all export one dated record per viewing, so an import needs somewhere to
put a past date, a second viewing, and a viewing with no date.

**Changed on October 7, 2026.** The tracking rules became a state machine
([ADR 0009](0009-tracking-is-a-state-machine.md), [the prototype's notes](../prototypes/tracking-machine/README.md)).
This record was written before it and said that everything, including whether a show is Seen, is derived from the
watch rows, and that a show has one of three stored statuses. Both are replaced below. The decision itself, one row
per watch, stands.

**Changed again on October 7, 2026,** when the owner decided the data model
([#378](https://github.com/alp82/goodwatch-monorepo/issues/378)). The tables are `user_watch_log`, one row per watch,
and `user_watch_state`, one row per member and title; their definitions and every read and write are in
[the data model](../implementation/tracking/data-model.md). The row per title was first drafted as the state plus a
summary of the watches that the writer keeps in step. That is replaced below: the state table holds no summary.

## Choices

- **One row per watch, for movies and episodes alike.** Adding a watch, removing one, deduplicating an import and
  undoing an import each touch single rows. A rewatch is another row, not a counter.
- **A watch says how exact its date is:** a moment, a day, or unknown. Letterboxd gives days, Trakt gives minutes,
  and a show marked Seen in one press has no dates. An unknown date is stored as unknown, never as the release date,
  the rating date, or the time of the import.
- **A watch says how it was made.** Its origin is `single` (one watch marked on its own, of an episode or a movie),
  `upto`, `season` or `seen` (a group action), `score`, or `import` with the import's id. A group action is one press
  that makes many watches: "Watched up to here", marking a season, Seen on a show. Its watches share a group id.
  Pressing Seen again removes exactly the watches of that press, and undoing an import removes only its own.
- **Rating a movie that has no watch records one,** without a date and with origin `score`. The score owns it:
  clearing the score deletes it, and a watch the member logs replaces it, so a rated movie is Seen by the same rows
  as a watched one and its count never shows two for one viewing. Rating a show records no watch and never changes
  its state. Until now the rating control recorded a watch dated "now" for movies and shows alike.
- **A watch carries its pass number,** 1 unless the person or a source says otherwise. Watch again on a Seen show
  starts the next pass. The number is stored on the watch because the pass of an undated watch can't be worked out
  later, and Simkl and Trakt deliver it.
- **An episode watch keeps TMDB's episode id beside the season and episode number.** TMDB renumbers and re-creates
  seasons. A watch whose episode id is no longer listed counts for the listed episode with the same season and
  number, when exactly one has them; otherwise it is kept and doesn't count.
- **A watch's identity is decided before it is written:** by the browser for a single watch, from the group and the
  episode for a group action, from the movie for the score's watch, from the source's own data for an import. Sending the same request or the same
  file again writes nothing twice, and two watches of one episode on one day are still two rows.
- **A show's state is stored, not derived:** Not started, Watching, On hold, Dropped, Seen, with the time it last
  changed and the current pass. Whether a show is Watching or Seen depends on what the member last did, which the
  watch rows alone can't say. Progress and the Next episode are still derived from the watches.
- **One row per member and title holds the state, and nothing the watches can say.** `user_watch_state` stores the
  state, when it changed, the pass, the Seen press that can be taken back, and the two prompts. It stores no count
  and no date of a watch. Surfaces that only ask "is this title Seen" read that row and never the watches. A show
  the person has only started has such a row too, so readers ask for the state Seen, or a score, and not for the
  row's existence. A movie has a row, with the state Seen, while it has a watch.
- **Counts and dates are computed from the watch rows when they are read:** how often, how many episodes of the
  current pass, the furthest of them, the latest watch. One grouped query per member computes them, and its result
  is cached with the member data. Crate has no transactions, so a count stored beside the rows it counts is a second
  write that a crash or a concurrent action can leave wrong, and then needs a check and a repair. With one source of
  truth, the only thing a stopped write can leave behind is a state one step behind its watches. If the grouped
  query measures too slow for the largest members, summary columns can be added to the state table later as a
  cache, without touching the watch rows.
- **The writer changes the watch rows first and the state row second.** The state row is also what two actions on
  one show are checked against.
- **Episode watches load per show.** They stay out of the member data that every page loads; only the state and the
  computed counts are available everywhere.
- **Dates and "aired" are UTC in the database and the API;** the member's time zone exists only in the interface.

Rejected:

- **One row per episode with a list of dates,** mirroring the title table. An undated watch has no place in a list
  of timestamps, and neither have a watch's origin and pass. Undoing an import would mean editing lists.
- **Keeping episodes only inside the import tables** and showing shows at title level. Nothing would be lost, but
  nobody could see or correct what they imported, and Watching couldn't exist.
- **No pass number until a "Watch again" action exists.** It would have thrown away the grouping that imports
  deliver; Watch again is now built with episode tracking.
- **Adding the state to `user_watch_history`.** Every reader takes a row there to mean Seen, and the old build
  would too during a deploy. The row per title is a new table, and the old one stays untouched as the backup until
  it is dropped by hand 30 days after the switch.
- **A summary of the watches in the state row,** recomputed by the writer on every write. It was the first draft of
  the data model. It makes every list a read of one row, and it stores every count twice.
- **A scored title with no watch and no row,** Seen only where the score is read. A rated movie would then be Seen
  on some surfaces by a different rule than a watched one, with nothing in its watch log.

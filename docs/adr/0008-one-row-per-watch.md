---
status: accepted
---

# Store every watch as its own row

GoodWatch records each watch of a film or an episode as one row, and derives everything else from those rows:
whether a title is Seen, a show's progress, its next episode. Decided on October 6, 2026, while planning episode
tracking and the imports that follow it. Sources compared:
[import-sources-inventory.md](../research/import-sources-inventory.md).

Until now a title had one row in `user_watch_history` with a list of timestamps. The only writer stored "now" and
replaced the list on every write, and every reader used the row as a yes or no. Episodes had no place at all.
Trakt, Letterboxd, Simkl, Netflix and Plex all export one dated record per viewing, so an import needs somewhere to
put a past date, a second viewing, and a viewing with no date.

## Choices

- **One row per watch, for films and episodes alike.** Adding a watch, removing one, deduplicating an import and
  undoing an import each touch single rows. A rewatch is another row, not a counter.
- **A watch says how exact its date is:** a moment, a day, or unknown. Letterboxd gives days, Trakt gives minutes,
  and a show marked Seen in one press has no dates. An unknown date is stored as unknown, never as the release date,
  the rating date, or the time of the import.
- **A watch says how it was made:** marked by hand, created in bulk by marking a whole show or season, or imported,
  and by which import. Removing Seen from a show removes only the bulk-made watches, and undoing an import removes
  only its own.
- **A watch carries its pass number,** 1 unless the person or a source says otherwise. Nothing starts a second pass
  in the interface yet. The number is stored now because the pass of an undated watch can't be worked out later, and
  Simkl and Trakt deliver it.
- **An episode watch keeps TMDB's episode id beside the season and episode number.** TMDB renumbers and re-creates
  seasons. A watch whose episode is gone is kept and doesn't count.
- **The row per title stays, as a summary the writer keeps in step.** Surfaces that only ask "is this title Seen"
  keep reading one small row per title. A show the person has only started doesn't get that row, because every
  reader takes it to mean Seen.
- **Show status is stored, not derived:** Watching, On hold, Dropped, with the time it last changed. Watching could
  be computed from watches; On hold and Dropped are decisions and can't.
- **Episode watches load per show.** They stay out of the member data that every page loads; only the show status
  and a small progress summary are available everywhere.

Rejected:

- **One row per episode with a list of dates,** mirroring the title table. An undated watch has no place in a list
  of timestamps, and neither have a watch's origin and pass. Undoing an import would mean editing lists.
- **Keeping episodes only inside the import tables** and showing shows at title level. Nothing would be lost, but
  nobody could see or correct what they imported, and Watching couldn't exist.
- **No pass number until a "Watch again" action exists.** Cheaper now, and it would throw away the grouping that
  imports deliver.

# Episode catalog

Issue [#376](https://github.com/alp82/goodwatch-monorepo/issues/376). Every show's episodes from TMDB, in the Crate
table `episode`, kept fresh, and one number per show, `show.aired_episode_count`. It feeds the Episode list and
member tracking on the show page. Design and the TMDB facts
behind it: [tmdb-episode-catalog.md](research/season-episode-scores/tmdb-episode-catalog.md). Paths under
`goodwatch-flows/windmill/` are shortened to `f/...`.

## Parts

| Part | Path | What it does |
|---|---|---|
| Rules | `f/tmdb_api/episode_catalog.py` | Request batching, rows, diff, when a show is due, aired, the aired count, still airing. No I/O. |
| Change feed | `f/tmdb_api/tmdb_fetch_episodes_from_api/changes` | Reads TMDB's `/tv/changes` and makes the listed shows due. |
| Fetch flow | `f/tmdb_api/tmdb_fetch_episodes_from_api` | Step `next` reserves the shows that are due, step `fetch` requests their seasons and stores them in Mongo. |
| Copy | `f/sync/copy/tmdb_episodes` | Compares the fetched seasons with the `episode` table, writes the difference and the show's aired count. |
| Schema | `f/sync/models/crate_schemas.py` | Table `episode` and the columns `show.episodes_updated_at` and `show.aired_episode_count`. Created by `f/sync/init/cratedb`. |

## Storage

**Mongo `tmdb_tv_season_details`**: one document per show and season (`tmdb_id`, `season_number`, unique together),
with `season_id` and the season's `episodes` as TMDB lists them, without `crew` and `guest_stars`. Every other
field of an episode is kept, so each stored episode has TMDB's `overview`.

**Mongo `tmdb_tv_details`**: the crawl state of each show, next to its details.

| Field | Meaning |
|---|---|
| `episodes_due_at` | When the show is fetched next. Missing: never fetched. |
| `episodes_selected_at` | Last time the queue reserved it. |
| `episodes_updated_at` | Last fetch that left usable season documents, including "TMDB lists no season". The copy reads by this time. |
| `episodes_complete` | Every listed season was fetched. Only then may the copy mark episodes removed. |
| `episodes_failed_at`, `episodes_error` | The last failure. Cleared by the next success. |
| `episodes_changed_at` | Last time the change feed named the show. |

**Mongo `tmdb_episode_catalog_state`**: `tv_changes` holds the time of the last successful change feed run,
`episodes_copy` the copy's checkpoint (`copied_until`), and `episodes_recopy` the cursor of a
[recopy](#copying-every-show-again) (`after_tmdb_id`, `started_at`, `finished_at`), which exists only once one ran.

**Crate `episode`**: key `(show_id, tmdb_id)`, clustered by `show_id`, so one show's list is one routed read. Specials
are `season_number = 0`. `removed_at` is set when TMDB no longer lists the episode. `imdb_id` and `tvdb_id` exist for
later imports; the copy never writes them. `show.episodes_updated_at` is the fetch time of the copied state; `NULL`
means the show was not crawled yet, a value with no rows means TMDB lists no episodes.

`overview` is the episode's description: TMDB's `overview`, trimmed, `NULL` when TMDB has none ([#387](https://github.com/alp82/goodwatch-monorepo/issues/387)).
It is declared `TEXT INDEX OFF STORAGE WITH (columnstore = false)`, like the other texts that are only read back
(`streaming_evidence.payload`, `search_index_builds.manifest`): an index and the column store each refuse a value
above 32,766 bytes, and one such value would fail the upsert of its whole batch. The price is that the column is
for selecting only. Don't filter, sort or count by it; a `WHERE overview IS NULL` over the table is at best a full
scan.

**Crate `show.aired_episode_count`**: how many regular episodes of the show have aired, see
[The aired episode count](#the-aired-episode-count). `NULL` until the show's first copy.

## How a show becomes due

Each fetch writes the show's next due time, and the queue takes the shows whose time has come, never-fetched shows
first, then the ones due longest.

| Case | Due again |
|---|---|
| An episode aired in the last 14 days or airs within 7 days | In 1 day |
| The next episode is further ahead | 7 days before it, at the latest in 30 days |
| Nothing recent or upcoming, or TMDB lists no season | In 30 days |
| The fetch failed, or some seasons are missing | In 1 day |
| The show is flagged `tmdb_deleted`, or TMDB answers 404 | In 30 days, with nothing written. The details flow owns the flag. |
| TMDB's change feed names the show | At once |
| A run reserved the show and died | 1 hour after the reservation |

A show whose stored details list no season gets no request and is still marked as checked. The exception is a show
the change feed named since its last episode fetch: it gets one request, because the stored details may be older than
the season TMDB just added.

## What a fetch does

One request is `/tv/{id}?append_to_response=season/…` with at most 20 seasons. The first request asks for the seasons
the stored details name; its answer lists the seasons of today, and the rest is asked from that list. Eight shows are
fetched in parallel. A 429 is waited out (`Retry-After`, at most 10 s, four attempts).

- Every listed season fetched: the season documents are written, documents of seasons TMDB no longer lists are
  deleted, `episodes_complete` is true.
- A later request failed, or TMDB lists a season it did not return: the fetched seasons are written, nothing is
  deleted, `episodes_complete` is false and the show is tried again the next day.
- The first request failed: nothing is written.
- The job fails after saving what it could when a request is answered 401, when every requested show failed, or
  when more than half of the batch failed.

## What the copy does

It reads the shows with `episodes_updated_at` after its checkpoint, 200 at a time, until none is left or 240 s have
passed, and stores the checkpoint after each batch. Each run starts 15 minutes before the checkpoint, so a show
written during the last run is not missed. `tmdb_ids` copies named shows and leaves the checkpoint alone.

For each show it compares the episodes of all its season documents with the stored rows, by episode id:

- New or changed: upserted. A renumbered or moved episode keeps its row. An episode that comes back loses its
  `removed_at`.
- No longer listed: `removed_at` is set, only when `episodes_complete` is true. A watch that points at the row can
  still show its name.
- Removed more than 180 days ago: deleted, because TMDB's terms forbid keeping its data longer than 6 months.

Unchanged episodes are not written. Then `show.episodes_updated_at` and `show.aired_episode_count` are set, for
every copied show, whether or not an episode changed.

The compared columns are `EPISODE_COLUMNS` in `f/tmdb_api/episode_catalog.py`, the description among them: a
description TMDB rewrote is updated, one it dropped is cleared.

## Copying every show again

The copy visits a show only after a fetch. A column added to `episode` later is therefore empty in every row
already copied until the show's next fetch, up to 30 days away. `recopy_all: true` fills it from the stored season
documents, without a TMDB request.

- A run first does the normal copy. Only when that caught up, it spends the rest of its 240 s on the recopy.
- The recopy reads the shows that have `episodes_updated_at`, 200 at a time in the order of `tmdb_id`, and copies
  each batch like any other. It stores the last id of each batch in `episodes_recopy`, so the next run with
  `recopy_all` continues after it. A show's id never changes, so no show is skipped or read twice.
- It never reads or writes the checkpoint `episodes_copy`.
- A show fetched for the first time while the recopy runs may lie behind the cursor. The normal copy picks it
  up, with every column.
- When no show is left it sets `finished_at`. From then on `recopy_all` does nothing but the normal copy.
- Rows that already match are not written, so running it again costs reads only. To start over (for the next new
  column), delete the document: `db.tmdb_episode_catalog_state.deleteOne({_id: "episodes_recopy"})`.

**Run it from the schedule, not beside it.** Add `recopy_all: true` to the arguments of the copy's schedule and
take it out again when it has finished. A manual run next to the scheduled one can read a show's documents, be
overtaken by a fetch and the scheduled copy of that show, and then write the older episodes over the newer ones;
that would stay wrong until the show's next fetch.

**How long.** 233,582 shows are 1,168 batches of 200. A batch is about 5,700 episode rows (6.7 million rows over
233,582 shows): one read of the season documents, one read of the stored rows and, the first time, an upsert of
nearly all of them. The seconds per batch are not measured. The first crawl's copy, which wrote the same rows, was
planned at "some hours" for the whole table; at 10 to 20 s per batch a 240 s run does 12 to 24 batches, which is 50
to 100 runs, 4 to 8 hours on the 5-minute schedule. Every batch prints a line (`Copied 200 shows: …`), so the first
run's log gives the real figure: 1,168 divided by the batches per run, times 5 minutes. While the first crawl
still runs, the normal copy uses most of each run and the recopy advances slowly or not at all; nothing is lost,
because every show that copy writes gets all columns.

**When it is finished.** The run's result has `recopy: {shows_copied, after_tmdb_id, finished}`; `finished: true`
is the end. The same from Mongo:

```js
db.tmdb_episode_catalog_state.findOne({_id: "episodes_recopy"})   // finished_at is set; after_tmdb_id shows progress
```

Then remove `recopy_all` from the schedule, and spot-check a show (by its key, not by the description):

```sql
SELECT season_number, episode_number, overview FROM episode WHERE show_id = 1396 ORDER BY 1, 2 LIMIT 5;
```

## Aired and still airing

Both change with the calendar, so a reader of the table works them out when it reads. `has_aired` and
`airing_season_number` in `f/tmdb_api/episode_catalog.py` are the tested definition. The one stored value is the
aired count below.

- **Aired**: not removed, and the air date is today (UTC) or earlier. An episode without a date has not aired.
- **Season still airing**: only the highest-numbered regular season with a dated episode, and only when the show's
  status is not Ended or Canceled. It is airing when it has an episode dated after today, or when its last aired
  episode is not a `finale` and aired within the last 45 days. An episode without a date does not keep a season open.

## The aired episode count

`show.aired_episode_count` is the number of the show's episodes with `season_number > 0`, `removed_at IS NULL` and an
`air_date` of today (UTC) or earlier: `aired_episode_count` in `f/tmdb_api/episode_catalog.py`, which uses `has_aired`.
Specials and episodes without a date never count.

**Who reads it.** Member tracking: it compares the count with the number of episodes a member has watched and so
finds the Seen shows with new episodes in one read, without counting `episode` rows per show.

**Who writes it.** Only the copy, each time it copies a show. It counts the rows the show has in `episode` once that
copy is written (upserts applied, removals marked, rows an incomplete fetch did not list kept), with the UTC date of
the run as today.

| Value | Meaning |
|---|---|
| `NULL` | The show's episodes were never copied. Unknown, not zero. |
| `0` | Copied, and no regular episode has aired, including a show without episodes. |

**How it stays right.** The count changes when an episode's air date arrives, even if TMDB changed nothing. No job
of its own recounts it. A show with an episode in the last 14 or the next 7 days is fetched once a day
([How a show becomes due](#how-a-show-becomes-due)), every successful fetch sets `episodes_updated_at`, and the copy
takes every show by that time and writes the count whether or not an episode changed. A show outside that window has
no episode whose date is about to arrive, so its count does not move between fetches.

**Worst-case lag.** A show is due 24 hours after its last fetch, so an episode that airs on a day is counted at the
latest 24 hours after the show's last fetch before that day, plus the time the queue and the copy are behind (both
run every 5 minutes). In practice that is during the air date (UTC), and at worst a few minutes after it ends, when
the last fetch ran just before midnight and the next one starts late. `AiredEpisodeCountFreshnessTests` in
`tests/test_episode_copy.py` runs the queue, the fetch and the copy over these days.

It is later than that in three cases:

- The show's fetch fails outright. Nothing is copied and the show is tried again a day later, so every failed day
  adds a day. A partial fetch is copied and counted.
- The flow or the copy is not running, or the queue is more than a day behind. The count is as old as the last copy.
- TMDB lists the episode or its date only after it aired. The count follows when the change feed (once a day) makes
  the show due, or with the 30-day cycle.

To recount named shows without a fetch, run the copy with `tmdb_ids`.

## Adding the description to a running catalog

The steps that put `episode.overview` live ([#387](https://github.com/alp82/goodwatch-monorepo/issues/387)), on a
table that already has rows.

1. **Merge and wait for the "Push Windmill workspace" action.** Until step 2 is done the copy fails, because it
   selects a column that is not there. It loses nothing: its checkpoint stays and the next run catches up. To avoid
   the failed runs, pause the copy's schedule first. The webapp reads the episode list without descriptions while
   the column is missing.
2. **Add the column.** Run `f/sync/init/cratedb` with `dry_run: true`. It must report exactly one change:
   `ALTER TABLE episode ADD COLUMN overview TEXT INDEX OFF STORAGE WITH (columnstore = false)`. Then run it
   without `dry_run`, and resume the copy's schedule if it was paused.
3. **Check one show.** Run `f/sync/copy/tmdb_episodes` with `tmdb_ids: [1396]`, then the spot-check query of
   [Copying every show again](#copying-every-show-again).
4. **Backfill.** Add `recopy_all: true` to the copy's schedule arguments, wait for `finished: true`, and remove it
   again, as described there.

## Tests

```sh
cd goodwatch-flows
python -m unittest tests.test_episode_catalog tests.test_episode_fetch tests.test_episode_copy
```

They need the flow dependencies plus `mongomock`, and use no network, Mongo or Crate.

## Putting it live

Merging to `main` deploys the scripts, so steps 1 and 2 come first.

1. **Build the Mongo indexes by hand on the primary.** The queue and the copy name them in `hint`, and without them
   mongoengine would start the build from inside a job.
   ```js
   db.tmdb_tv_details.createIndex({episodes_due_at: 1})
   db.tmdb_tv_details.createIndex({episodes_updated_at: 1, tmdb_id: 1, episodes_complete: 1})
   ```
   `tmdb_tv_season_details` gets its unique index from the first fetch, while it is empty.
2. **Merge and wait for the "Push Windmill workspace" action.**
3. **Create the table.** Run `f/sync/init/cratedb` with `dry_run: true`. It must report exactly three changes:
   `CREATE TABLE episode …`, `ALTER TABLE show ADD COLUMN episodes_updated_at TIMESTAMP` and
   `ALTER TABLE show ADD COLUMN aired_episode_count INTEGER`. Then run it without `dry_run`.
4. **Try a small batch.** Run the flow `f/tmdb_api/tmdb_fetch_episodes_from_api` with `count: 20`, then
   `f/sync/copy/tmdb_episodes`. Check a known show:
   ```sql
   SELECT season_number, count(*) FROM episode WHERE show_id = 1396 GROUP BY 1 ORDER BY 1;
   SELECT aired_episode_count FROM show WHERE tmdb_id = 1396;            -- the rows above without season 0
   ```
5. **First crawl.** Schedule the flow every minute with `count: 1000` and no overlapping runs, and the copy every
   5 minutes. That is about 216,000 requests at 17 per second on average, roughly 4 hours for 233,582 shows; lower
   `count` if TMDB answers 429 or the details flow slows down. The copy follows behind and may need some hours more.
6. **Check the crawl.**
   ```js
   db.tmdb_tv_details.countDocuments({episodes_due_at: null})          // never fetched: goes to 0
   db.tmdb_tv_details.countDocuments({episodes_failed_at: {$ne: null}}) // failures waiting for a retry
   ```
   ```sql
   SELECT count(*), count(DISTINCT show_id) FROM episode;               -- about 6.7 million rows, over 200,000 shows
   SELECT count(*) FROM show WHERE episodes_updated_at IS NULL;         -- goes to about 0
   SELECT count(*) FROM show WHERE aired_episode_count IS NULL;         -- the same number
   ```
7. **Steady state.** Set the flow's schedule to every 5 minutes with the default `count: 500`, keep the copy at every
   5 minutes, and schedule `f/tmdb_api/tmdb_fetch_episodes_from_api/changes` once a day. A day is about 13,000
   requests.

## Not built yet

- Episode rows of a show deleted on TMDB stay, like its `imdb_episode` rows: `episode` is not in the title deletion
  (`f/sync/copy/deleted_titles.py`).
- A priority title (`f/priority`) does not fetch its episodes with its details.
- Counting a watch for a re-added episode with the same season and number is an owner decision the research note
  left open.

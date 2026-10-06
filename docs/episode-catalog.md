# Episode catalog

Issue [#376](https://github.com/alp82/goodwatch-monorepo/issues/376). Every show's episodes from TMDB, in the Crate
table `episode`, kept fresh. It feeds the Episode list; nothing member-facing reads it yet. Design and the TMDB facts
behind it: [tmdb-episode-catalog.md](research/season-episode-scores/tmdb-episode-catalog.md). Paths under
`goodwatch-flows/windmill/` are shortened to `f/...`.

## Parts

| Part | Path | What it does |
|---|---|---|
| Rules | `f/tmdb_api/episode_catalog.py` | Request batching, rows, diff, when a show is due, aired, still airing. No I/O. |
| Change feed | `f/tmdb_api/tmdb_fetch_episodes_from_api/changes` | Reads TMDB's `/tv/changes` and makes the listed shows due. |
| Fetch flow | `f/tmdb_api/tmdb_fetch_episodes_from_api` | Step `next` reserves the shows that are due, step `fetch` requests their seasons and stores them in Mongo. |
| Copy | `f/sync/copy/tmdb_episodes` | Compares the fetched seasons with the `episode` table and writes the difference. |
| Schema | `f/sync/models/crate_schemas.py` | Table `episode` and column `show.episodes_updated_at`. Created by `f/sync/init/cratedb`. |

## Storage

**Mongo `tmdb_tv_season_details`**: one document per show and season (`tmdb_id`, `season_number`, unique together),
with `season_id` and the season's `episodes` as TMDB lists them, without `crew` and `guest_stars`.

**Mongo `tmdb_tv_details`**: the crawl state of each show, next to its details.

| Field | Meaning |
|---|---|
| `episodes_due_at` | When the show is fetched next. Missing: never fetched. |
| `episodes_selected_at` | Last time the queue reserved it. |
| `episodes_updated_at` | Last fetch that left usable season documents, including "TMDB lists no season". The copy reads by this time. |
| `episodes_complete` | Every listed season was fetched. Only then may the copy mark episodes removed. |
| `episodes_failed_at`, `episodes_error` | The last failure. Cleared by the next success. |
| `episodes_changed_at` | Last time the change feed named the show. |

**Mongo `tmdb_episode_catalog_state`**: two documents. `tv_changes` holds the time of the last successful change feed
run, `episodes_copy` the copy's checkpoint (`copied_until`).

**Crate `episode`**: key `(show_id, tmdb_id)`, clustered by `show_id`, so one show's list is one routed read. Specials
are `season_number = 0`. `removed_at` is set when TMDB no longer lists the episode. `imdb_id` and `tvdb_id` exist for
later imports; the copy never writes them. `show.episodes_updated_at` is the fetch time of the copied state; `NULL`
means the show was not crawled yet, a value with no rows means TMDB lists no episodes.

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

Unchanged episodes are not written. Then `show.episodes_updated_at` is set.

## Aired and still airing

Neither is stored, because both change with the calendar. `has_aired` and `airing_season_number` in
`f/tmdb_api/episode_catalog.py` are the tested definition; a reader of the table applies the same rules.

- **Aired**: not removed, and the air date is today (UTC) or earlier. An episode without a date has not aired.
- **Season still airing**: only the highest-numbered regular season with a dated episode, and only when the show's
  status is not Ended or Canceled. It is airing when it has an episode dated after today, or when its last aired
  episode is not a `finale` and aired within the last 45 days. An episode without a date does not keep a season open.

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
3. **Create the table.** Run `f/sync/init/cratedb` with `dry_run: true`. It must report exactly two changes:
   `CREATE TABLE episode …` and `ALTER TABLE show ADD COLUMN episodes_updated_at TIMESTAMP`. Then run it without
   `dry_run`.
4. **Try a small batch.** Run the flow `f/tmdb_api/tmdb_fetch_episodes_from_api` with `count: 20`, then
   `f/sync/copy/tmdb_episodes`. Check a known show:
   ```sql
   SELECT season_number, count(*) FROM episode WHERE show_id = 1396 GROUP BY 1 ORDER BY 1;
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

# Data model for watches, show state and what each page reads

Proposal for [#378](https://github.com/alp82/goodwatch-monorepo/issues/378), under the map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Written October 7, 2026, for the owner to mark up.
Nothing here is built. It is the last step before the build tickets for the watch model, episode tracking and the
Watching pages.

What it rests on:

- The state machine, which is the specification of tracking:
  [`machine.ts`](../../../goodwatch-webapp/app/domain/prototype-tracking-machine/machine.ts) and
  [its notes](../../prototypes/tracking-machine/README.md), with the owner's decisions M1 a, M2 a, M3 a, M4 b, M5 a,
  M6 a ([#368](https://github.com/alp82/goodwatch-monorepo/issues/368)).
- The chosen screens: the [watch log](../../prototypes/watch-log/README.md) (variant C), the
  [episode list](../../prototypes/episode-list-4/README.md) (variant D), and
  [home, My shows, My movies and the library page](../../prototypes/watching-3/README.md).
- [ADR 0008](../../adr/0008-one-row-per-watch.md) (one row per watch) and
  [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md) (the state is stored and only a member's action changes it).
- The episode catalog on the branch `feat/episode-catalog` (`docs/episode-catalog.md` there). It is not in production
  yet: the table `episode` does not exist there.
- Production as measured on October 7, 2026: CrateDB 5.10.9 on three nodes, refresh interval 1 second.

Paths without a prefix are under `goodwatch-webapp/app/`.

## 1. Summary

### The tables

| Table | One row is | Key | Routed by | Who writes it |
| --- | --- | --- | --- | --- |
| `user_watch` (new) | One watch of a movie or of an episode | `user_id, watch_id` | `user_id` | The tracking writer in the webapp; an import; the migration |
| `user_tracking` (new) | Where one member stands with one title: the state, the pass, the Seen press that can be taken back, the prompts, and a summary of the watches | `user_id, tmdb_id, media_type` | `user_id` | The same writer, always after the watch rows |
| `user_watch_history` (today) | Retired. Kept untouched as the backup until the switch has held for 30 days, then dropped by hand | | | Nobody, after the switch |
| `user_import`, `user_import_item` (extended) | One import, and one row of its file. New nullable columns for watches and statuses | unchanged | unchanged | The import |
| `show.aired_episode_count` (new column) | How many regular episodes of the show have aired | | | The episode copy in `goodwatch-flows` |

Want to See, Not interested and the score stay where they are (`user_wishlist`, `user_not_interested`, `user_score`).
The machine reads them and clears them, and they are not states.

### The choices

Everything else in this document is a statement. These six are the places where another answer stores different data
or shows the member something different.

| # | Choice | Options | Recommended |
| --- | --- | --- | --- |
| C1 | What becomes of the row per title, `user_watch_history` | a) Replace it with `user_tracking`, one row that holds both the state and the summary. b) Add columns to `user_watch_history` and keep its name. c) Two new tables, one for the state and one for the summary | **a.** Today a row in `user_watch_history` means Seen to every reader (listed in section 4); a Watching row in that table would be read as Seen by any reader that was missed and by the old build during a deploy. The old table is also routed by its whole key, so a member's rows are spread over all six shards, and routing can't be changed on an existing table. One row and not two, because Crate has no transactions and every further table is one more place a crash can leave behind |
| C2 | A title that has a score and no watch | a) It gets no row and no watch. It counts as Seen wherever the score is read, as the machine's row 22 says. Rating stops recording a watch. b) Rating a movie records a watch without a date | **a.** Today the rating control also records a watch for "now" and removes it when the score is cleared (`ui/user/actions/ScoreAction.tsx:37-39`). Under (a) that ends: the watch log of a rated movie says "Scored, no watch logged" until the member presses Seen. Under (b) a watch exists that nobody recorded, and clearing a score would have to decide whether to delete it. 2,276 movies and 1,240 shows are in this case today |
| C3 | What "watched in the last 30 days" means for the Continue group and Tonight's pick | a) The latest of: the dates of the show's dated watches, and the time an undated watch was recorded here by the member. An import counts only through its dates. b) Dated watches only. c) The time anything was recorded | **a.** Under (b) a member who presses "Watched up to here" tonight (which records no date) does not get the show in Continue. Under (c) an import of a 2019 history fills Continue with every show in the file |
| C4 | When an episode has aired | a) Its air date is today or earlier in UTC, the same for every member. b) By the member's own date | **a.** The list of Seen shows with new episodes needs one stored count per show (section 3). A count per member's time zone can't be stored. The catalog already defines aired in UTC. The owner left this for a later ticket; the storage decides it |
| C5 | A show marked Seen while it had no episode list, once it gets one | a) As the machine has it: it stays Seen and every episode reads as new. b) The press's group is filled: watches without a date for the regular episodes that had aired by the day of the press | **b.** It is the rule the map already has for today's rows ("bulk watches, date unknown, for the regular episodes that had aired by then"), and the migration needs the same step for shows the catalog has not crawled yet. A small job does it; no page writes on a read |
| C6 | What an import does to a show's state | a) Imported watches move a show from Not started or Watching to Watching or Seen (rows 2 and 3) and never change On hold, Dropped or Seen. A status from the source is applied only to a show that had no row here before the import. b) An import replays as if the member acted now, so an old watch resumes an On hold or Dropped show | **a.** An import is history. What the member decided here is newer than what the file says |

Three smaller proposals change the machine or add to it. They are in
[section 5](#what-the-machine-and-the-screens-did-not-settle).

## 2. Table definitions

In the form of `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`, ready to paste.
`f/sync/init/cratedb` creates the two tables and adds the new columns; it changes and drops nothing.

### `user_watch`

```python
    # One row per watch of a movie or of an episode (docs/implementation/tracking/data-model.md, ADR 0008).
    # watched_at and date_precision: 'moment' is the instant; 'day' is 00:00:00 UTC of the calendar day and only its
    # date is read; 'unknown' is NULL. origin: 'hand' is one watch marked by the member; 'seen', 'season' and 'upto'
    # are group actions (the Seen button, Mark season, Watched up to here) and carry group_id; 'import' carries
    # import_id. A movie watch has no episode columns and pass 1.
    "user_watch": {
        "columns": {
            "user_id": "TEXT",
            "watch_id": "TEXT",
            "media_type": "TEXT NOT NULL CHECK (media_type IN ('movie','show'))",
            "tmdb_id": "INTEGER NOT NULL",  # the movie or the show
            "episode_tmdb_id": "INTEGER",  # episode.tmdb_id at the time of the watch
            "season_number": "INTEGER",  # 0 = special
            "episode_number": "INTEGER",
            "watched_at": "TIMESTAMP WITH TIME ZONE",
            "date_precision": "TEXT NOT NULL CHECK (date_precision IN ('moment','day','unknown'))",
            "origin": "TEXT NOT NULL CHECK (origin IN ('hand','seen','season','upto','import'))",
            "group_id": "TEXT",
            "import_id": "TEXT",  # user_import.id
            "pass": "INTEGER NOT NULL",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
        },
        "primary_key": ["user_id", "watch_id"],
        "clustered_by": "user_id",
        "shards": 6,
        "timestamps": False,
    },
```

| watch_id | media_type | tmdb_id | episode_tmdb_id | season, episode | watched_at | date_precision | origin | group_id | import_id | pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0193f6a2-7c1e-7b3a-9d44-5e0c1a2b3c4d` | movie | 157336 | | | 2026-10-06 19:40:12 UTC | moment | hand | | | 1 |
| `0193f6a2-9e02-7f10-8a71-0b9d6c7e8f90` | show | 1622 | 64121 | 2, 5 | 2026-10-05 00:00:00 UTC | day | hand | | | 1 |
| `g-0193f6a3-11aa-7c55-b0e1-2f3a4b5c6d7e-64122` | show | 1622 | 64122 | 2, 6 | NULL | unknown | seen | `0193f6a3-11aa-7c55-b0e1-2f3a4b5c6d7e` | | 1 |
| `i-5b1e0c9a7d2f4e6a8c0b1d3f5a7c9e1b` | movie | 603 | | | 2019-03-12 00:00:00 UTC | day | import | | `imp_8f2c…` | 1 |

**The key.** `watch_id` is the identity of the watch, unique per member. It is made in one of three ways, and all
inserts are `ON CONFLICT (user_id, watch_id) DO NOTHING`:

- **By hand:** an id the browser makes (`crypto.randomUUID()`) and sends with the request. A request that is sent
  twice, or that timed out and landed anyway, inserts once. Two watches of the same episode on the same day are two
  requests and two ids.
- **A group action:** `g-<group id>-<episode id>`, where the group id comes from the browser the same way. Sending
  the same press again inserts nothing new.
- **An import:** `i-` and the first 32 hex characters of the SHA-1 of the source, the title, the season and episode
  number, the date and its precision, the pass, and a counter for rows of one file that agree in all of these. It
  does not contain the import's id, so the same file uploaded again writes nothing, and a date the member corrected
  by hand stays corrected. Two plays on one day in a source that only knows days are two rows through the counter.

The key has no title in it because Crate's primary key gives no benefit to a key prefix: a read is either by the
whole key (real-time, no refresh needed) or by indexed columns. Editing or deleting one watch is by the whole key.

**Routing.** `clustered_by user_id` puts every watch of a member in one shard, so both reads the pages need are one
shard and one index lookup:

- All watches of this member for this show: `WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?`.
- All watches of this member, newest first, page by page: `WHERE user_id = ? ORDER BY watched_at DESC NULLS LAST,
  watch_id DESC LIMIT 61`, continued with the last row's `watched_at` and `watch_id`. One table serves both. The
  Seen list of the library is per title, not per watch, and reads `user_tracking`.

Today's user tables are routed by their whole key, so `WHERE user_id = ?` asks all shards.

**The date.** One column and one sort:

| | `watched_at` | `date_precision` | Shown as |
| --- | --- | --- | --- |
| Marked at the moment, or a source with a time (Trakt) | The instant | `moment` | "6 Oct 2026, 21:40" in the viewer's time zone |
| A chosen day, or a source with days (Letterboxd) | 00:00:00 UTC of that calendar day | `day` | "5 Oct 2026", formatted in UTC so it never shifts |
| "Don't know when", a group action, a source without dates | `NULL` | `unknown` | "Date unknown" |

`ORDER BY watched_at DESC NULLS LAST, created_at DESC` gives the watch log's order: dated watches newest first, then
the undated ones. Checked on production with literal values: Crate puts `NULL` first under `DESC` unless `NULLS LAST`
is written. A day-precise watch sorts at the start of its UTC day, so among the watches of one day it comes after
those with a time. A watch with a time made shortly after midnight east of Greenwich falls on the previous UTC day;
only the order within two neighbouring days can differ from the member's calendar, and no date is shown wrong.
Editing a date in the log sets a day or unknown, never a time.

**Shards.** Six. The migration writes up to about 260,000 rows (section 6), and the largest member gets about 33,000.
Six shards keep each far below a gigabyte with room for a hundred times that, and a member's reads touch one shard
whatever the count is.

### `user_tracking`

```python
    # Where a member stands with a title (docs/implementation/tracking/data-model.md, ADR 0009). A show's state is
    # the state machine's; a movie has a row while it has a watch, with state 'seen'. A row with state 'not_started'
    # exists only to remember a prompt or the watch of a special, and every reader filters on state.
    # seen_press_group and seen_press_from: the Seen press that one more press takes back, and the state it was
    # pressed from. Both NULL when no press stands. seen_question: NULL (not asked), 'open', 'answered'.
    # From watch_count on, the columns are a summary of the member's user_watch rows for the title, recomputed in
    # full by every write. episodes_watched counts the aired regular episodes watched in the current pass,
    # episodes_watched_ever the regular episodes watched in any pass, furthest_* the last of them in the current
    # pass. last_watched_at is the latest dated watch; last_activity_at also counts the time an undated watch was
    # recorded by the member.
    "user_tracking": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "state": "TEXT NOT NULL CHECK (state IN ('not_started','watching','on_hold','dropped','seen'))",
            "state_changed_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "pass": "INTEGER NOT NULL",
            "seen_press_group": "TEXT",
            "seen_press_from": "TEXT",
            "rate_prompt_dismissed_at": "TIMESTAMP WITH TIME ZONE",
            "seen_question": "TEXT",
            "watch_count": "INTEGER NOT NULL",
            "episodes_watched": "INTEGER NOT NULL",
            "episodes_watched_ever": "INTEGER NOT NULL",
            "furthest_season": "INTEGER",
            "furthest_episode": "INTEGER",
            "first_watched_at": "TIMESTAMP WITH TIME ZONE",
            "last_watched_at": "TIMESTAMP WITH TIME ZONE",
            "last_watched_precision": "TEXT",
            "last_activity_at": "TIMESTAMP WITH TIME ZONE",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "clustered_by": "user_id",
        "shards": 3,
        "timestamps": False,
    },
```

| tmdb_id | media_type | state | pass | seen_press_group / from | prompts | watch_count | episodes_watched / ever | furthest | last_watched_at | last_activity_at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 157336 | movie | seen | 1 | | | 1 | 0 / 0 | | 2026-10-06 19:40 (moment) | 2026-10-06 19:40 |
| 1622 | show | watching | 1 | | rate prompt dismissed 2026-09-30 | 26 | 26 / 26 | 2, 4 | 2026-10-05 (day) | 2026-10-05 |
| 1399 | show | seen | 1 | `0193f6a3-…` / `on_hold` | | 73 | 73 / 73 | 8, 6 | 2024-05-01 (day) | 2026-10-06 21:02 |
| 66732 | show | not_started | 1 | | seen_question `open` | 0 | 0 / 0 | | | |

**What a row means.** For a show, the row is the machine's stored record: `state`, `pass`, the standing Seen press,
the two prompts. For a movie, a row exists while the movie has at least one watch, and its state is `seen`; the
column lets every reader ask one question, `state = 'seen'`, for both kinds. A movie has no other state, and the
glossary's rule that only shows have a status is unchanged. A title with a score and no watch has no row (C2).

A row is deleted when nothing is left to remember: the state is `not_started`, no watch of the title exists, and
neither prompt column is set. So a row can exist with `not_started`: after a show was rated by hand and the question
is open, after "Not now" on the prompt to rate, or when only a special was watched. Readers never test for the row;
they test the state.

**What undo of the Seen press needs.** `seen_press_group` is the group id of the press, which is also on its watch
rows; `seen_press_from` is the state before it. One more press deletes the rows of that group and returns the state
by rows 13 to 17 of the table. Both are set to NULL by any step that leaves Seen, which is the machine's rule that a
press can be taken back only while the show is still Seen. The machine's counter of presses is not stored: it only
named groups, and the browser's id does that.

**What the guards read.** Every guard is answered by this row and the catalog, or by the watch rows the writer has
loaded anyway:

| Guard | Read from |
| --- | --- |
| the episode is a special | The event: `season_number = 0` |
| every aired episode is now watched, or not | The watch rows of the show and the episode list, both loaded by the writer |
| a watch remains, or not | The same watch rows. For readers: `episodes_watched_ever > 0` |
| episodes aired since | `episodes_watched` against the count of aired regular episodes |
| the press was made on a Seen, On hold or Dropped show | `seen_press_from` |

**The key and the routing.** The key is today's key for a member and a title, so one title's row is a real-time read
by the whole key, which the writer and the show page use. Routing by `user_id` makes the member data read and every
list one shard.

**Shards.** Three, one per node. The table has one row per member and tracked title: 5,885 after the migration.

### The episode catalog: one more column

```python
            # In "show": how many regular episodes have aired (season_number > 0, not removed, air_date today in UTC
            # or earlier). Written by f/sync/copy/tmdb_episodes whenever it copies the show.
            "aired_episode_count": "INTEGER",
```

The catalog as built does not provide this: it stores no count and defines aired as a rule for readers
(`has_aired` in `f/tmdb_api/episode_catalog.py`), because aired changes with the calendar. The copy already visits
every show with an episode in the last 14 or the next 7 days once a day, so a count it writes on each visit is at
most a day behind without a new job. `show.number_of_episodes` from TMDB can't stand in: it counts announced episodes
too. This column is the episode catalog's to build, and its ticket should say so. Section 3 says what reads it and
what happens without it.

### `user_import_item` and `user_import`: new columns

All nullable, so today's rows and the ratings import are untouched. Section 7 says how they are used.

```python
            # In "user_import_item". kind: NULL or 'rating' (today's rows), 'watch', 'status', 'want',
            # 'episode_rating' (kept, never applied), 'state' (written by the apply, one per show it touched).
            "kind": "TEXT",
            "season_number": "INTEGER",
            "episode_number": "INTEGER",
            "episode_tmdb_id": "INTEGER",
            "watched_at": "TIMESTAMP WITH TIME ZONE",
            "date_precision": "TEXT",
            "pass": "INTEGER",
            "source_status": "TEXT",  # the source's word: watching, hold, dropped, completed, plantowatch, ...
            "watch_id": "TEXT",  # the user_watch row this item stands for
            "prior_state": "TEXT",  # for kind 'state': user_tracking.state before the import, NULL for no row
            "applied_state": "TEXT",  # for kind 'state': what the import set, and what undo must still find
```

`user_import` needs no new column: `source` names the platform, and `counts` is already JSON text that can hold
counts per kind.

## 3. Stored versus derived

The rule: **what only a member's action changes is stored; what the catalog or the calendar can change is derived at
read time.** The summary columns of `user_tracking` are stored copies of values that only a member's action changes
(the watches), which is why they can be stored at all.

"The writer" is the one server function that applies a tracking event (section 4). "The catalog" is the cached
episode list of a show and `show.aired_episode_count`.

| What the screen shows | Stored or derived | Where, from what | Recomputed |
| --- | --- | --- | --- |
| State | Stored: `user_tracking.state` | | By the writer on a member's event, by the table's row |
| Label: Watching, On hold, Dropped, Seen, Caught up, "· N new" | Derived | Server and browser, one shared function: `state`, plus for Seen `show.status` (not Ended or Canceled gives Caught up) and the count of new episodes | Every read |
| Progress, "26 of 327" | Watched: stored, `episodes_watched`. Aired: derived | Lists: `episodes_watched` and `show.aired_episode_count`. Show page: counted from the watch rows and the episode list | Watched by the writer; aired with the catalog |
| "N new episodes" on a Seen show | Derived | `show.aired_episode_count - episodes_watched` while the state is Seen. Show page: counted exactly | Every read |
| Next episode | Derived | The first aired regular episode after `furthest_season, furthest_episode` in the show's cached episode list. If there is none and `episodes_watched` is below the aired count, the member has a gap: the show's watch rows are read and the machine's rule is applied. Shown for Watching, On hold, and Seen with new episodes. Per pass, because `furthest_*` and `episodes_watched` count the current pass only | Every read; `furthest_*` by the writer |
| Counts as Seen, for filters and the cards' seen flag | Derived | `state = 'seen'` or a row in `user_score`. Both are in the member data map | Every read |
| Hidden by Not seen yet | Derived | Any state but `not_started`, or a score, or skipped in the taste quiz | Every read |
| Hidden from recommendations | Derived | `state = 'dropped'`, or a row in `user_not_interested` | Every read |
| Not interested or Drop offered | Derived | Browser, from `state`: Not interested in Not started; Drop in Watching and On hold | Every read |
| Prompt to rate is due | Derived from stored parts | No score, `rate_prompt_dismissed_at` is NULL, and `episodes_watched_ever >= 3` or `seen_press_group` is set | Every read |
| "Have you seen all of it?" is due | Stored: `seen_question = 'open'` | Set when a member rates a show by hand that has no row or is Not started; closed by an answer, a watch or a Seen press | By the writer |
| Seen button: mark, "mark N new", take back, or off | Derived | State, the count of new episodes, and whether `seen_press_group` is set | Every read |
| Watch count on a movie, "3×" | Stored: `watch_count` | In the member data map | By the writer |
| Order of My shows | Derived | Continue: Watching rows with a Next episode and `last_activity_at` within 30 days, newest first; then Seen rows with new episodes. Start: Want to See shows without a state, best taste match first | Every read |
| Tonight's pick | Derived | The first row of Continue; without one the first movie of My movies; without one the first show of Start | Every read; its cache is reset with the member data |
| Season matrix cell: rating | Not member data | The catalog and the IMDb ratings, as today's episode grid | With the catalog |
| Season matrix cell: watched | Derived | Show page only: the watch rows of the show in the current pass, matched to listed episodes by id, or by season and number when exactly one listed episode has them | Every read of the show page |
| "Watched yesterday", "Date unknown" on a row | Stored: `last_watched_at`, `last_watched_precision` | | By the writer |

### Values that depend on the catalog

The machine never stores aired episodes, new episodes, or whether the show has ended, and neither does this model.
What it stores is the member's side of each comparison, so that the catalog's side can be read in the same query:

- **Seen shows with new episodes, for My shows.** `episodes_watched` is what the member had watched when they last
  acted. The catalog's current count is `show.aired_episode_count`. One query compares them for all of a member's
  Seen shows (section 4, My shows), and no Seen show is opened one by one. Without the column, the same list needs a
  count over `episode` for every Seen show of the member on every request (300 shows are some 15,000 episode rows).
- **Caught up or Seen.** `show.status`, read in the same query.
- **Next episode.** The show's episode list is public data, the same for everyone, and is cached per show. The
  member's side is two integers.

What can go out of step: TMDB removes an episode the member had watched, or adds an episode with an air date in the
past inside a season the member has finished. `episodes_watched` is then one too high or the gap is not seen by a
list until the member next acts on the show. The show page counts from the watch rows and is always exact; when it
finds the stored summary different from its own count, it reports it (and the next action rewrites the row). The
consistency check in section 5 finds every such row.

## 4. What each screen reads and writes

### Reads

The member data map is what `getUserData` loads for every page (`server/userData.server.ts`): cached per member for
5 minutes, reset by every write after `REFRESH TABLE` ([member-data-cache.md](../../member-data-cache.md)).
Its `watched` entry is replaced by `tracking`:

```sql
SELECT tmdb_id, media_type, state, last_watched_at, watch_count
FROM user_tracking
WHERE user_id = ? AND state <> 'not_started'
```

```ts
tracking: Record<MediaKey, { state: "watching" | "on_hold" | "dropped" | "seen"; watchedAt: Date | null; count: number }>
```

One row per tracked title, and no watch rows: per-episode data loads per show. Sizes: the largest account today has
975 such rows and a map of 160 KB, 29 KB gzipped
([measurements](../../research/user-data-loading-measurements.md)). An entry grows from about 52 to about 80 bytes
of JSON, so that account's map becomes about 187 KB, an estimated 33 KB gzipped. An importer with 1,500 Seen titles,
1,500 scores and 350 Want to See comes to about 290 KB, an estimated 50 KB gzipped. Its tens of thousands of episode
watches are not in it. These are estimates from the measured ratio, not measurements.

| Screen | Query | Rows | In the map | Cache and reset |
| --- | --- | --- | --- | --- |
| **Show page**: hero box, matrix, open season, watch log per episode | Q1 to Q3 below | 1 row; one watch row per watched episode and pass (Supernatural: up to 327 per pass); the episode list | The state is (for the first paint of the hero); the rest is not | Q1 and Q2 are not cached on the server. The browser keeps them under a key per show and every action on the show replaces them. Q3 is public and cached per show |
| **Movie page**: watch log | Q4, when the log opens | 1 to a handful | Seen and the count are | Not cached; the browser's copy is replaced by every action on the movie |
| **Home doors** and **Tonight's pick** | Q5, then the Next episode from the cached episode list. The other two doors are today's Watch next reads | 1 | No | With the member data: the pick's key includes the map's tracking entries |
| **My shows** | Q6, then the cached episode lists of the Continue rows for the Next episode's name. Start is the Wishlist's shows from the map, ordered by taste match as Watch next does today | The member's Watching and On hold shows and their running Seen shows: 6 to 60 | No | Not cached on the server; refetched after an action |
| **My movies** | No new query. It is the Wishlist's movies. A movie leaves when it is Seen because the watch deletes its Want to See row | | The Wishlist is | As today |
| **Library**: counts on the chips and in the drop-down | None. Counted from the map: Want to see from `wishlist`; Watching, On hold and Dropped from `tracking`; Seen is `tracking` entries with state Seen plus scored titles without one; Not rated is Seen entries without a score | | Yes | With the map |
| **Library**: a status's list, in steps of 60 | The order is made from the map on the server (2,500 keys sort in well under a millisecond), then Q7 loads the cards of one step. Last watched: `watchedAt` newest first, undated and score-only titles last. My score: from `scores`. Title: the titles of the member's keys are read once by key and kept with the map | 60 per step, also at 1,500 titles | The keys are | The card data is public and cached as today |
| **Title cards**: the seen flag | None. `tracking[key].state === 'seen'` or a score. On the server: `viewer.seen` | | Yes | With the map |
| **Not seen yet** in Discover, Explorer and recommendations | None for the surfaces that use the viewer context (`server/viewer.server.ts`): its `seen` set becomes scored titles and tracking entries in any state, and Dropped joins the always hidden set beside Not interested. The three readers with their own SQL change one table name and gain `AND state <> 'not_started'` (list below) | One row per tracked title | Yes | With the map |
| **Taste** | Nothing new. Taste is built from scores and Want to See. A watch that deletes a Want to See row calls `markTasteChanged`, as `updateWishList` does. Dropped is not read | | | |
| **Diary** (a later view of Seen) | Q8 | 60 per step | No | Not cached |

```sql
-- Q1. The member's row for one title. Whole key: real-time, no refresh needed.
SELECT state, state_changed_at, pass, seen_press_group, seen_press_from, rate_prompt_dismissed_at, seen_question,
       watch_count, episodes_watched, episodes_watched_ever, furthest_season, furthest_episode,
       last_watched_at, last_watched_precision, last_activity_at, _seq_no, _primary_term
FROM user_tracking
WHERE user_id = ? AND tmdb_id = ? AND media_type = 'show';

-- Q2. Every watch of the member for one show: the ticks, the matrix and each episode's log.
SELECT watch_id, episode_tmdb_id, season_number, episode_number, watched_at, date_precision, origin, group_id,
       import_id, pass, created_at
FROM user_watch
WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?
ORDER BY season_number, episode_number, watched_at DESC NULLS LAST
LIMIT 20000;

-- Q3. The episode list. Public, cached per show.
SELECT tmdb_id, season_number, episode_number, name, air_date, runtime, still_path, episode_type
FROM episode
WHERE show_id = ? AND removed_at IS NULL
ORDER BY season_number, episode_number;

-- Q4. A movie's watch log.
SELECT watch_id, watched_at, date_precision, origin, import_id, created_at
FROM user_watch
WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
ORDER BY watched_at DESC NULLS LAST, created_at DESC
LIMIT 200;

-- Q5. The Continue door and Tonight's pick: the Watching show the member was last active on, in the last 30 days.
SELECT tmdb_id, furthest_season, furthest_episode, episodes_watched, last_activity_at
FROM user_tracking
WHERE user_id = ? AND media_type = 'show' AND state = 'watching' AND last_activity_at >= ?
ORDER BY last_activity_at DESC
LIMIT 1;

-- Q6. My shows: everything in progress, and the Seen shows that are running or have new episodes.
SELECT t.tmdb_id, t.state, t.pass, t.episodes_watched, t.furthest_season, t.furthest_episode,
       t.last_watched_at, t.last_watched_precision, t.last_activity_at, t.state_changed_at,
       s.aired_episode_count, s.status, s.title, s.poster_path
FROM user_tracking t
JOIN show s ON s.tmdb_id = t.tmdb_id
WHERE t.user_id = ? AND t.media_type = 'show'
  AND (t.state IN ('watching', 'on_hold')
       OR (t.state = 'seen' AND (s.aired_episode_count > t.episodes_watched OR s.status NOT IN ('Ended', 'Canceled'))))
LIMIT 500;

-- Q7. The cards of one step of a library list (and the same for movie).
SELECT tmdb_id, title, poster_path, release_year FROM show WHERE tmdb_id IN (?, ?, ...);

-- Q8. The diary: every watch, newest first. The next step continues below the last row.
SELECT watch_id, media_type, tmdb_id, season_number, episode_number, watched_at, date_precision, origin, import_id, pass
FROM user_watch
WHERE user_id = ? AND watched_at IS NOT NULL
  AND (watched_at < ? OR (watched_at = ? AND watch_id < ?))
ORDER BY watched_at DESC, watch_id DESC
LIMIT 61;
-- Its "Date unknown" group is the same read with watched_at IS NULL, ordered by created_at DESC.
```

Q6 splits in the server function, not in SQL: Continue (Watching with a Next episode and `last_activity_at` in the
last 30 days, newest first, then Seen with `aired_episode_count > episodes_watched`), "Not watched for 30 days"
(Watching, older), "Waiting for episodes" (Seen, running, nothing new), On hold. Rows whose Next episode is a gap
(nothing after `furthest_*`, and `episodes_watched` below the aired count) get one more read for all of them
together: Q2's columns with `tmdb_id IN (...)`. If the join in Q6 turns out slow, the member side is already in the
map and the show side is a read by key (`SELECT ... FROM show WHERE tmdb_id IN (...)`).

### Who reads `user_watch_history` today

Each treats the existence of a row as Seen. After the change each asks for a state.

| Reader | Where | Becomes |
| --- | --- | --- |
| The member data map, `watched` | `server/userData.server.ts:79-82`, refresh at `:169` | The `tracking` read above; `user_tracking` joins the refresh |
| The viewer context, `seen` | `server/viewer.server.ts:76-81` | Scored titles and tracking entries; Dropped added to the always hidden set |
| Similar-title seeds | `server/utils/recommend.ts:165-173` | `user_tracking`, `state <> 'not_started'` |
| Quiz titles | `server/smart-titles.server.ts:200-204` and `:241-245` | The same |
| The legacy Discover filter | `server/discover.server.ts:560-574` | The same; "watched" means `state = 'seen'` |
| "I watched it" and its undo | `server/finish-title.server.ts:33-37`, `:47-51`, `:83-86` | A movie watch through the tracking writer; undo deletes that `watch_id` |
| The only writer | `server/watchHistory.server.ts:43-69` | Replaced by the tracking writer |
| Browser accessors | `hooks/useUserDataAccessors.ts:32` and `:79`, `types/user-data.ts:62-64` and `:86` | `isSeen` reads `tracking` and `scores` |
| The optimistic update | `hooks/useUserDataMutations.ts:108-114` | Section "The browser" below |
| Tonight's pick's signature | `ui/navigation/useTonightsPick.ts:39` | Includes the tracking entries |
| Guest transfer review | `ui/onboarding/AccountTransfer.tsx:116` | Reads `tracking` |
| Interest discovery keys | `server/interest-discovery.server.ts:32`, `ui/discovery/useInterestDiscovery.ts:31`, `ui/taste/components/RecommendationSwiper.tsx:200` | `"watched"` becomes `"tracking"` |
| The rating control | `ui/user/actions/ScoreAction.tsx:37-39` | Stops recording a watch (C2) |
| Duplicate-title repair | `goodwatch-flows/scripts/provider_alias_resolution.py:23` | The list of user tables gains the two new ones |

Nine `server/prototype-rec-*.server.ts` files read the table too. They are throwaway and are deleted or pointed at
`user_tracking` when the old table is dropped.

### Writes: one writer

Every tracking event of a show goes through one server function. Its interface is small and what it hides is the
whole of this document: `applyTrackingEvent(userId, title, event, actionId)` returns the new row and what an undo
needs. The machine itself (`step`, the table, `derive`) moves from the prototype into `domain/` as a pure function of
`(episode list, watch rows, row, event)`, and both the server and the browser call it.

The steps, in order:

1. `REFRESH TABLE user_watch`, so that step 2 sees the rows of the member's previous action.
2. Read together: the row (Q1, real-time), the show's watch rows (Q2), the cached episode list (Q3).
3. Run the machine in memory. It gives the watch rows to insert or the rows to delete, the new row, and which of
   Want to See and Not interested to clear.
4. Write the watch rows: one `INSERT ... VALUES (...), (...), ... ON CONFLICT (user_id, watch_id) DO NOTHING`, or one
   `DELETE`.
5. Write the row. A new row: `INSERT ... ON CONFLICT DO NOTHING`. An existing row: `UPDATE ... WHERE user_id = ? AND
   tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?` with the two values Q1 returned. If no row
   was written, another action on the same show came in between: start again at step 1, at most three times.
6. Delete the Want to See and Not interested rows the event clears (by their whole key), and call
   `markTasteChanged` when a Want to See row went.
7. `resetUserDataCache`, which refreshes the user tables, `user_tracking` among them, and resets the member data.

That is one refresh, two member reads, one watch write, one row write, up to two deletes and the reset: seven to
nine statements whatever the number of episodes. **A season or a Seen press is one insert.** The webapp already
writes this way: the IMDb import inserts 500 rows of 15 values in one statement
(`server/imdb-import/preview.server.ts:93-122`). `upsert` in `utils/crate.ts` can't be used for it: it loops over its
rows with one statement and one read-back each. The helper the writer needs, next to `upsert`:

- `insertRows(table, columns, rows, { conflict: [...], chunk: 500 })`: one multi-row `INSERT ... ON CONFLICT DO
  NOTHING` per 500 rows. A 327-episode show is one statement; the longest show members have marked Seen today lists
  9,413 episodes and is 19.
- After a timeout it does not know whether the rows landed. It does not need to: every `watch_id` is fixed before the
  write, so the writer sends the same statement again.

**Order, and what a crash leaves.** Watch rows first, the row second, the clears third. The watch rows are the truth
and the row follows them.

| Stopped after | Left behind | Repaired by |
| --- | --- | --- |
| Step 4 | Watch rows without their effect on the row: the show page shows the ticks (it reads the watch rows) while the hero and the lists show the old state and counts | The browser got an error and sends the same action with the same `actionId`: step 4 inserts nothing, step 5 writes the row the first attempt would have. If it never does, the next action on the show recomputes the whole summary, and the consistency check lists the row |
| Step 5 | The row is right; Want to See or Not interested is still set on a started show | The same retry. The check lists it (invariant 5) |
| Step 6 | The member data cache holds the old map for at most 5 minutes | Its lifetime |

Not repaired by a retry that never comes: a Seen press whose row was not written leaves its group without a standing
press. The summary repair makes such a show Seen when everything aired is watched, and the group can then only be
unticked, not taken back with one press.

**Per action.** Statement counts leave out steps 1, 2 and 7, which every action has.

| Action | Watch rows | Row | Other tables | The browser shows at once |
| --- | --- | --- | --- | --- |
| Watch an episode (rows 1 to 5) | Insert 1: `hand`, now, `moment`, current pass | State by the row taken; summary | A regular episode clears Want to See and Not interested | The tick, the next state and label, the new Next episode. Toast with Undo and "Change date" |
| Unwatch an episode (rows 6 to 10) | Delete the episode's rows of the current pass: `DELETE ... WHERE user_id = ? AND tmdb_id = ? AND media_type = 'show' AND season_number = ? AND episode_number = ? AND pass = ?` | State by the row taken; summary | | The tick gone, state and label |
| Mark a season; Watched up to here | Insert one row per aired episode in range not yet watched in the pass: origin `season` or `upto`, one group id, no date | As if each were watched in turn (section 5) | As a watch | Every tick of the range, state. Toast with Undo and "Set a date" |
| "Set a date" on a group | `UPDATE user_watch SET watched_at = ?, date_precision = 'day', updated_at = ? WHERE user_id = ? AND group_id = ?` | Summary dates | | The dates |
| Unmark a season | One delete for the season's rows of the current pass | As if each were unwatched in turn | | The ticks gone, state |
| Press Seen (rows 11, 12) | Insert one row per aired regular episode not yet watched in the pass: origin `seen`, the press's group id, no date | `state = 'seen'`, `seen_press_group`, `seen_press_from` = the state before | Clears Want to See and Not interested | Every tick, "Seen" or "Caught up", the prompt to rate |
| Press Seen again (rows 13 to 17) | `DELETE FROM user_watch WHERE user_id = ? AND group_id = ?` | State by the row taken; press columns NULL | | The group's ticks gone, the state before |
| Put on hold, drop, resume (rows 18 to 21) | None | `state`, `state_changed_at` | Drop clears Want to See and Not interested | The status pill |
| Rate (row 22) | None | Unchanged. A first score by hand on a show that is Not started sets `seen_question = 'open'` | `user_score`, as today; a score clears Not interested | The score; the question |
| Want to See (rows 23, 24) | None | Row 24 only: Dropped to Not started | `user_wishlist`; clears Not interested | The button |
| Not interested (row 25) | None | None | `user_not_interested`; clears Want to See | The button |
| Watch again (row 26) | None | `pass + 1`, `state = 'watching'`, press columns NULL, `episodes_watched = 0`, `furthest_*` NULL | | Empty ticks, "Watching", pass 2, Next episode S1 E1 |
| "Not now" on the prompt to rate | None | `rate_prompt_dismissed_at` | | The prompt gone |
| Answer "Have you seen all of it?" | "Yes, all of it" is a Seen press | `seen_question = 'answered'` | | The question gone |
| Edit a watch's date in the log | `UPDATE user_watch SET watched_at = ?, date_precision = ?, updated_at = ? WHERE user_id = ? AND watch_id = ?` | Summary dates | | The row of the log |
| Delete a watch in the log | `DELETE FROM user_watch WHERE user_id = ? AND watch_id = ?` | Summary. If it was the episode's only watch in the current pass, this is an unwatch and takes its row of the table | | The row gone. Undo inserts the same row with the same `watch_id` |
| Movie: Seen (one tap) | Insert 1: `hand`, now, `moment`, pass 1 | Insert or update: `state = 'seen'`, summary | Clears Want to See and Not interested | The eye, the count from two on. Toast with "Change date" and Undo |
| Movie: delete its last watch | Delete 1 | The row is deleted | | Not Seen, unless it has a score |

A movie needs no episode list and no machine: its row is `seen` while `watch_count > 0`.

### The browser

- **On the show page** the browser holds the row, the watch rows and the episode list. It runs the same machine
  function on them, shows the result, and sends the event with the ids it made. The response's row replaces the
  guess. On an error it puts back the snapshot of that one show and says so. Actions on one show are sent one after
  the other, never in parallel.
- **Everywhere else** (home's Continue door, a movie's eye on a card) the browser has the map only. It updates
  `tracking[key]` (the state it expects, `watchedAt`, `count`) and takes the pick from the response.
- **Undo after a first tick** has to bring Want to See back with its place in the list. The response carries what the
  event cleared (the Want to See row's added-at time, and whether Not interested was set), as `finishTitle` does
  today, and Undo sends it back.

## 5. Walking the machine

### Every row of the table

W is the member's `user_watch` rows for the show, T their `user_tracking` row. "Summary" means `watch_count`,
`episodes_watched`, `episodes_watched_ever`, `furthest_*` and the three dates, recomputed from W. Rows 10b and 27b
exist only under options the owner did not choose.

| Row | Event, from | W | T before → after | Other tables |
| --- | --- | --- | --- | --- |
| 1 | Watch a special, any state | +1 (`season_number = 0`) | State unchanged. No row → a row with `not_started`. `watch_count + 1` | None |
| 2 | Watch, that was the last aired episode; from Not started, Watching, On hold, Dropped | +1 | `state` → `seen`. Summary. `seen_press_*` stay NULL. `seen_question` open → answered | Want to See and Not interested deleted |
| 3 | Watch, more are left; same states | +1 | `state` → `watching` (a new row from Not started). Summary | The same |
| 4 | Watch, all new ones are now watched; from Seen | +1 | `state` stays `seen`; a standing press stays. Summary | The same |
| 5 | Watch, some new ones are left; from Seen | +1 | `seen` → `watching`; `seen_press_*` → NULL. Summary | The same |
| 6 | Unwatch a special | −1 or more | State unchanged. Summary. Deleted if nothing is left to remember | None |
| 7 | Unwatch, a watch remains; from Watching, Seen | − the episode's rows of the pass | → `watching`; from Seen `seen_press_*` → NULL. Summary | None |
| 8 | Unwatch, no watch remains; from Watching, Seen | The same | → `not_started`, `seen_press_*` → NULL; then deleted unless a prompt column is set or a special is watched | None |
| 9 | Unwatch, a watch remains; from On hold, Dropped | The same | State unchanged. Summary | None |
| 10 | Unwatch, no watch remains; from On hold, Dropped | The same | State unchanged, `episodes_watched_ever = 0` | None |
| 11 | Press Seen; from Not started, Watching, On hold, Dropped | +N, origin `seen`, group G, no date (N is 0 for a show without an episode list) | → `seen`, `seen_press_group = G`, `seen_press_from` = the state before. Summary. `seen_question` open → answered | Want to See and Not interested deleted |
| 12 | Press Seen on a Seen show with new episodes | +N, group G2 | Stays `seen`. `seen_press_group = G2`, `seen_press_from = 'seen'`. The earlier group's rows stay and can no longer be taken back together | The same |
| 13 | Press Seen again, the press was made on a Seen show | − group | Stays `seen`, `seen_press_*` → NULL. `episodes_watched` falls, so the episodes read as new again | None |
| 15 | Press Seen again, the press was made on an On hold show | − group | → `on_hold`, `seen_press_*` → NULL. Summary | None |
| 16 | Press Seen again, the press was made on a Dropped show | − group | → `dropped`, `seen_press_*` → NULL. Summary | None |
| 14 | Press Seen again, a watch remains | − group | → `watching`, `seen_press_*` → NULL. Summary | None |
| 17 | Press Seen again, no watch remains | − group | → `not_started`, then deleted unless a prompt column is set or a special is watched | None |
| 18 | Put on hold; from Watching | None | `watching` → `on_hold` | None |
| 19 | Drop; from Not started (an import), Watching, On hold | None | → `dropped` (a new row from Not started) | Want to See and Not interested deleted |
| 20 | Resume, a watch remains | None | → `watching` | None |
| 21 | Resume, no watch remains | None | → `not_started`, then deleted unless something is left to remember | None |
| 22 | Rate, any state | None | Unchanged. By hand, on a show without a row or Not started, never asked: `seen_question = 'open'` | `user_score`; a score deletes Not interested |
| 23 | Want to See; from Not started | None | None | `user_wishlist` row added or deleted; Not interested deleted |
| 24 | Want to See on a Dropped show with nothing watched | None | `dropped` → `not_started`, then deleted unless something is left to remember | `user_wishlist` row added |
| 25 | Not interested; from Not started | None | None | `user_not_interested` row added or deleted; Want to See deleted |
| 26 | Watch again; from Seen | None | `pass + 1`, → `watching`, `seen_press_*` → NULL, `episodes_watched = 0`, `furthest_*` NULL | None |
| 27 | The catalog changes | None | None. No job, no write | None |

The two answers to a prompt are not rows of the table: "Not now" sets `rate_prompt_dismissed_at`; "I'm partway" and
"Just rating" set `seen_question = 'answered'`.

### Every preset

Final rows after all steps of each preset in
[`presets.ts`](../../../goodwatch-webapp/app/domain/prototype-tracking-machine/presets.ts), run with the owner's
decisions (so with Watch again built).

| Preset | T: state, pass | Seen press | Prompts | `watch_count`, `episodes_watched`, ever | furthest | W | Reads as |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `through-ended` | seen, 1 | | | 6, 6, 6 | 2, 3 | 6 by hand | Seen, 6 of 6 |
| `caught-up-airs` | watching, 1 | | | 7, 7, 7 | 2, 4 | 7 by hand | Watching, 7 of 10, next S3 E1 |
| `seen-twice` | watching, 1 | NULL again | | 2, 2, 2 | 1, 2 | 2 by hand; the press's 4 are deleted | Watching, 2 of 6, next S1 E3 |
| `on-hold` | watching, 1 | | | 3, 3, 3 | 1, 3 | 3 by hand | Watching, 3 of 5, next S2 E1 |
| `dropped-want` | watching, 1 | | | 1, 1, 1 | 1, 1 | 1 by hand | Watching, 1 of 6. The Want to See row is gone |
| `rate-never-started` | not_started, 1 | | `seen_question = 'open'` | 0, 0, 0 | | None. `user_score` holds 8 | Not started, counts as Seen for filters, the question is shown |
| `rewatch` | watching, 2 | NULL (left Seen) | | 8, 2, 6 | 1, 2 | 6 from the press in pass 1, 2 by hand in pass 2 | Watching, pass 2, 2 of 6, next S1 E3 |
| `readded` | watching, 1 | | | 3, 3, 3 | 1, 3 | 3 by hand; one carries an episode id TMDB no longer lists and counts by season and number | Watching, 3 of 5 |
| `no-list` | seen, 1 | group of the second press, from `not_started` | | 0, 0, 0 | | None | Seen, 0 of 0. No Want to See row |
| `rate-prompt` | watching, 1 | | Not dismissed | 3, 3, 3 | 1, 3 | 3 by hand | Watching, 3 of 5, the prompt to rate is due |
| `special` | watching, 1 | | | 1, 1, 1 | 1, 1 | 1 by hand; the special's row is deleted again | Watching, 1 of 5 |
| `unwatch-on-hold` | No row | | | | | None | Not started |
| `seen-new-episodes` | seen, 1 | group of the press, from `not_started` | | 5, 5, 5 | 2, 2 | 5 from the press | Caught up · 4 new, 5 of 9 |

### How this was checked

A one-off script (not committed; the ticket is documentation only) mapped the machine's whole record to these rows
and back, and read every derived value from the row, the score and the catalog **without the watch rows**:

- All 13 presets, after every step.
- 3,000 seeded walks of 50 random events over the four sample shows: 148,334 steps, 23,442 of them catalog events,
  every row of the table used (1 to 27). After each step: the member rebuilt from the rows takes the next step
  exactly as the machine's own record does; state, progress, new episodes, Next episode, "up to date", "a watch
  remains", counts as Seen, both hidden rules, the prompt to rate and the question equal `derive()`; and invariants
  1 to 5 below hold.
- 2,754 group marks: marking a set of episodes at once gives the same record as ticking them one by one, in either
  order.

The Next episode was read 80,899 times, and 23,256 times it needed the show's watch rows because the member had a
gap. Random walks tick in random order; a member who watches in order has no gap.

### What the machine and the screens did not settle

Found while mapping. Each is built into the tables above as stated; the first three change or add to the machine and
are for the owner to accept or strike.

1. **Watch again on a show that is Seen with nothing watched.** A show without an episode list can be made Seen by a
   press, and Watch again then gives Watching in pass 2 with no watch in any pass, which the machine's own test rules
   out for Watching ("Watching always has a regular watch"). The walk found it at once. **Proposed:** Watch again is
   offered only when a watch of a regular episode exists.
2. **Marking a season and "Watched up to here"** are on the chosen screen and not in the machine. **Proposed:** a
   group mark is that many watch events, written as one insert with one lookup in the table at the end. The result is
   the same as ticking one by one, with one detail the check found: on a Seen show with a standing press, two or more
   regular episodes end the press (the first tick leaves Seen by row 5, the last returns by row 2), so the writer
   sets `seen_press_*` to NULL then.
3. **A show marked Seen without an episode list** (C5). The machine keeps the state and lets the episodes read as
   new. The tables can do either; the fill job is described in section 6.
4. **The counter of presses** existed to name groups. The browser's id replaces it.
5. **The Next episode can't always be read from the row.** A pointer to the furthest watched episode is exact unless
   the member has a gap behind them; then the show's watch rows are read. A stored pointer to the next episode was
   tried and dropped: it goes wrong when TMDB dates an earlier episode later.
6. **The question after a score** is opened by a rating made by hand. An import's ratings do not open it: 1,000
   imported show ratings would be 1,000 open questions.
7. **Undo after the first tick** needs the Want to See row's added-at time, which the machine does not hold. The
   writer returns it.
8. **A movie has a state column.** It holds `seen` or the row does not exist. It is a storage convenience and no
   change to the rule that movies have no status.

### Invariants and the check

1. `user_tracking.watch_count` is the number of `user_watch` rows for the title, and every watch row has a row.
2. Not started ⇒ no watch of a regular episode exists. Watching ⇒ at least one does.
3. A Seen press stands only on a Seen show: `seen_press_group` and `seen_press_from` are both set or both NULL, and
   set only with `state = 'seen'`.
4. A movie's row has `state = 'seen'`, `pass = 1` and at least one watch.
5. Any state but Not started ⇒ no Want to See row and no Not interested row for the title.
6. A watch row is well formed: `date_precision = 'unknown'` exactly when `watched_at` is NULL; a group origin has a
   `group_id` and an import has an `import_id`; a movie watch has no episode columns; no watch is in a pass beyond
   the row's.
7. Seen does **not** imply that everything aired is watched: new episodes, a press taken back from a Seen show, and
   a show without an episode list are all Seen with less. It implies only `episodes_watched <=
   show.aired_episode_count`, give or take an episode TMDB removed.

The check, per member (each statement names the member, so it is one shard). Every statement must return no row.

```sql
-- Invariants 1, 2 and 4, and the summary dates.
SELECT t.tmdb_id, t.media_type, t.state, t.watch_count, w.n, w.regular, t.last_watched_at, w.last_dated
FROM user_tracking t
LEFT JOIN (
    SELECT tmdb_id, media_type, count(*) AS n,
           count(*) FILTER (WHERE season_number > 0) AS regular,
           max(watched_at) AS last_dated, max(pass) AS top_pass
    FROM user_watch WHERE user_id = ? GROUP BY tmdb_id, media_type
) w ON w.tmdb_id = t.tmdb_id AND w.media_type = t.media_type
WHERE t.user_id = ?
  AND (t.watch_count <> coalesce(w.n, 0)
       OR (t.media_type = 'show' AND t.state = 'not_started' AND coalesce(w.regular, 0) > 0)
       OR (t.media_type = 'show' AND t.state = 'watching' AND coalesce(w.regular, 0) = 0)
       OR (t.media_type = 'movie' AND (t.state <> 'seen' OR t.pass <> 1 OR coalesce(w.n, 0) = 0))
       OR coalesce(w.top_pass, 1) > t.pass
       OR coalesce(t.last_watched_at, 0) <> coalesce(w.last_dated, 0))
LIMIT 100;

-- Invariant 1, the other way: watches without a row.
SELECT w.tmdb_id, w.media_type, count(*) AS n
FROM user_watch w
LEFT JOIN user_tracking t ON t.user_id = w.user_id AND t.tmdb_id = w.tmdb_id AND t.media_type = w.media_type
WHERE w.user_id = ? AND t.user_id IS NULL
GROUP BY w.tmdb_id, w.media_type
LIMIT 100;

-- Invariant 3.
SELECT tmdb_id, state, seen_press_group, seen_press_from
FROM user_tracking
WHERE user_id = ?
  AND ((seen_press_group IS NULL) <> (seen_press_from IS NULL)
       OR (seen_press_group IS NOT NULL AND state <> 'seen'))
LIMIT 100;

-- Invariant 5.
SELECT t.tmdb_id, t.media_type, t.state
FROM user_tracking t
JOIN user_wishlist x ON x.user_id = t.user_id AND x.tmdb_id = t.tmdb_id AND x.media_type = t.media_type
WHERE t.user_id = ? AND t.state <> 'not_started'
LIMIT 100;
-- and the same with user_not_interested.

-- Invariant 6.
SELECT watch_id
FROM user_watch
WHERE user_id = ?
  AND ((date_precision = 'unknown') <> (watched_at IS NULL)
       OR (origin IN ('seen', 'season', 'upto')) <> (group_id IS NOT NULL)
       OR (origin = 'import') <> (import_id IS NOT NULL)
       OR (media_type = 'movie' AND (season_number IS NOT NULL OR pass <> 1))
       OR (media_type = 'show' AND season_number IS NULL))
LIMIT 100;

-- Invariant 7 and stale counts, against the catalog.
SELECT t.tmdb_id, t.state, t.episodes_watched, s.aired_episode_count
FROM user_tracking t JOIN show s ON s.tmdb_id = t.tmdb_id
WHERE t.user_id = ? AND t.media_type = 'show' AND t.episodes_watched > s.aired_episode_count
LIMIT 100;
```

A repair is the writer's steps 1, 2 and 5 with no event: recompute the summary from the watch rows, and set the state
only where invariant 2 is broken (Not started with regular watches becomes Watching, or Seen when everything aired is
watched; Watching with none becomes Not started).

## 6. Migration

### What is there

Counted on production on October 7, 2026, with read-only statements.

| | |
| --- | --- |
| Rows in `user_watch_history` | 5,885, in 1.5 MB |
| Movies | 4,043 rows, 175 members, 1,544 different movies |
| Shows | 1,842 rows, 148 members, 656 different shows |
| Members with a row | 212 |
| Largest members, rows | 979, 343, 332, 250, 231 |
| Largest members, show rows | 133, 129, 127, 122, 78 |
| `watch_count` | 1 on every row |
| `watched_at_list` | One entry on every row |
| `first_watched_at`, `last_watched_at` | Set on every row and equal on every row |
| `season_number`, `episode_number`, `progress_percent`, `progress_seconds` | NULL on every row |
| `ingest_source` | NULL on 4,976 rows, `webapp` on 909 |
| Episodes TMDB lists for the members' show rows | 259,259 in all (unaired ones included); the largest members 32,683, 18,610, 15,782. One show lists 9,413 |
| Show rows whose show is not in the catalog | 6 |
| Titles with a score and no row (C2) | 2,276 movies and 1,240 shows, of 231 members; at most 469 for one member |
| `user_import`, `user_import_item` | 2 and 494 rows |
| The table `episode` | Does not exist in production yet |

So no row holds more than one watch, an episode or a progress, and every column but the key and one time is empty or
repeats that time.

### What each row becomes

| Today | `user_watch` | `user_tracking` |
| --- | --- | --- |
| A movie row | One row: `watch_id = 'mig-movie-<tmdb_id>'`, `watched_at = first_watched_at`, `moment`, origin `hand`, pass 1, `created_at` from the old row | `seen`, `state_changed_at` and all three dates = `first_watched_at`, `watch_count = 1` |
| A show row, the show has an episode list | One row per regular episode that is not removed and whose air date is on or before the day of `first_watched_at`: `watch_id = 'g-mig-seen-<show id>-<episode id>'`, no date, origin `seen`, `group_id = 'mig-seen-<show id>'`, pass 1 | `seen`, `state_changed_at = first_watched_at`, `seen_press_group = 'mig-seen-<show id>'`, `seen_press_from = 'not_started'`, the summary from those rows, `last_watched_at` NULL, `last_activity_at = first_watched_at` |
| A show row, no episode list (or not crawled yet) | None | The same row with a summary of zeros. The fill step below completes it when a list exists (C5) |
| A title with a score and no row | None | None (C2) |

The Seen press of a migrated show stands, so one press takes the whole mark back, which is what the button does to
such a row today. A show that went on after the member marked it reads "Caught up · N new" or "Seen · N new
episodes" from the first day; the owner accepted that with M6.

`watched_at_list` holds nothing the first time doesn't. `ingest_source` is dropped: every row was made here by hand
(the NULL ones were copied from the Postgres tables of the time before Crate). `season_number`, `episode_number` and
`progress_*` were never written and go with the table. Many of today's rows were made by the rating control and not
by the Seen button (C2); they can't be told apart, and they become watches at the time of the rating.

Expected size: 4,043 movie watches and at most about 259,000 episode watches, fewer by the unaired and later-aired
episodes.

### How it runs

`goodwatch-flows/scripts/migrate_watch_history.py`, in the style of `migrate_priority_queue.py` there: run with
`uv run --no-project --with crate --with python-dotenv`, credentials from an env file, `--dry-run` printing what it
would write, `--user` for one member, batches of 500 rows per insert, one member at a time.

1. The episode catalog is live and has crawled the shows (its own ticket). Without it only the movie step can run.
2. `f/sync/init/cratedb` with `dry_run: true` must report exactly: two `CREATE TABLE`, the new `user_import_item`
   columns, and `show.aired_episode_count`. Then without it.
3. Run the script. It reads `user_watch_history` and writes the two new tables. It never writes or deletes in
   `user_watch_history`.
4. Deploy the webapp that reads and writes the new tables.
5. Run the script again. It picks up what the old build wrote to the old table between steps 3 and 4.
6. After 30 days without a rollback: drop `user_watch_history` by hand, remove it from `crate_schemas.py` and from
   the refresh in `resetUserDataCache`, and delete the prototype readers.

**Idempotent.** Every `watch_id` is fixed by the member, the title and the episode, and every insert is `ON CONFLICT
DO NOTHING`, into `user_tracking` too, so a row the new webapp has written since is never overwritten. A run that
stopped is started again. What step 5 can't see is a mark removed in the old table between steps 3 and 4; those
minutes are accepted.

**The fill step** is the show step run again, alone (`--fill`): for every `user_tracking` row with `state = 'seen'`,
a standing press that was not made on a Seen show, and `episodes_watched_ever = 0`, whose show now has aired regular
episodes on or before `state_changed_at`, it inserts the group's rows under the row's own `seen_press_group` and
writes the summary. It serves the shows the catalog had not reached at migration time and, under C5 (b), any show
marked Seen before it had a list. Run by hand after the first crawl, then as a small scheduled job.

**Verify.**

```sql
SELECT media_type, count(*) FROM user_tracking GROUP BY media_type;        -- movie 4,043 and show 1,842, plus new ones
SELECT count(*) FROM user_watch WHERE media_type = 'movie';                -- 4,043, plus new ones
SELECT count(DISTINCT user_id) FROM user_tracking;                         -- 212, plus new ones
SELECT count(*) FROM user_tracking WHERE media_type = 'show' AND episodes_watched_ever = 0;  -- shows still to fill
```

Then the consistency check of section 5 for the five largest members, and by eye: the largest member's Seen list
before and after, one long show, one show without a list.

## 7. Imports

Today's import writes scores only ([import sources](../../research/import-sources-inventory.md)). With these tables
a source's watches, statuses and Want to See have a place.

**What an import writes.**

- **Watches:** `user_watch` rows with origin `import`, the import's id, the source's date at the source's precision
  (Trakt a moment, Letterboxd a day, IMDb's and Letterboxd's undated "watched" unknown), and the source's pass
  number when it has one (Simkl, Trakt), else 1. Never the time of the import as a date.
- **The state**, by replaying machine events, one show at a time, **in this order** (the rule the machine's notes
  left open, C6):
  1. All of the show's watches from the file are added at once, as one group mark (section 5, point 2). The state
     moves only from Not started or Watching, by rows 2 and 3. A show that is On hold, Dropped or Seen here keeps its
     state; its summary is recomputed. The current pass is raised only on a show without a row.
  2. Then the source's status, only if the show had no row here before this import: dropped is row 19 (allowed with
     nothing watched), completed is row 11 with the import as the origin of its watches and no standing press (it is
     taken back by undoing the import, not by the button), on hold is row 18 and so needs a watch, plan to watch is
     Want to See if nothing was watched. A status that can't be applied is reported in the preview with its reason.
  3. Scores last. They never change a state and do not open "Have you seen all of it?".
- **Movies:** a watch row and the `seen` row; Want to See is cleared as for a watch made by hand.
- An import never sets `last_activity_at` from the time of the import (C3): a watch with a date counts with its
  date, an undated imported watch not at all.

**Duplicates,** decided in the preview and shown there before anything is written:

- The same file again: the same `watch_id`, nothing written.
- A watch the member already has for the title or episode, from any origin: the same minute when both have a time;
  the same calendar day when either is day-precise; any existing watch in the same pass when the imported one has no
  date. The item is recorded as already there and writes nothing.
- Several watches of one title on one day inside one file are kept: the file's count for that day against the
  member's count, and only the difference is added.

**The import tables,** without a rewrite: `user_import` is unchanged. Each row of a file is still one
`user_import_item`; `kind` says what it is, the new columns hold a watch's episode, date, precision and pass or a
status, and `watch_id` names the row it wrote. `outcome` and `apply_state` keep their values (`added`, `kept`,
`failed`, `undone`). The apply adds one item of kind `state` per show it touched, with `prior_state` and
`applied_state`: the pattern `prior_score` and `applied_score` already use for ratings.

**Undo** removes only the import's own rows and leaves later edits alone:

1. `DELETE FROM user_watch WHERE user_id = ? AND import_id = ?`. One statement, one shard.
2. For every title in the import's items: recompute the summary from the watches that remain. If the row's state is
   still the `applied_state` of the import's `state` item, restore `prior_state`. Then invariant 2: Watching or Seen
   with no regular watch left becomes Not started. A state the member chose since the import stays.
3. Scores as today. Items become `undone`.

A watch the member edited by hand after the import still carries the import's id and goes with the undo; the undo
dialog says how many watches it removes.

**Episode ratings** from Trakt, TMDB and IMDb are kept and not applied: they stay in `user_import_item` as rows of
kind `episode_rating` with the episode's numbers, the source's value in `raw_rating` and the 1 to 10 value in
`imdb_score`, outcome `unsupported`, never written anywhere else. They survive an undo (the item is marked, not
deleted) and wait for the day episodes can be rated.

## 8. Account deletion and export

**Deletion.** The webapp has no account deletion flow yet. `deleteAccountData` in
`server/share-lists/store.server.ts:291` soft-deletes lists, profile and handle and says "call it from the
account-deletion flow"; nothing calls it. When that flow is built, tracking adds a `deleteTrackingData(userId)` next
to the tracking writer, called from the same place:

```sql
DELETE FROM user_watch WHERE user_id = ?;
DELETE FROM user_tracking WHERE user_id = ?;
DELETE FROM user_watch_history WHERE user_id = ?;   -- until the table is dropped
DELETE FROM user_import_item WHERE user_id = ?;
DELETE FROM user_import WHERE user_id = ?;
```

then `resetUserDataCache`. The first two are routed to one shard. These are hard deletes: the rows are private,
nothing public points at them, and unlike a handle nothing has to stay reserved. The same flow has to cover
`user_score`, `user_wishlist`, `user_favorite`, `user_skipped`, `user_not_interested` and `user_setting`, which have
no deletion today either.

Two other places list the user tables by name and must learn the new ones:

- `goodwatch-flows/scripts/provider_alias_resolution.py:23` (`USER_TABLES`), which moves members' rows when a
  duplicate title is retired. A watch row's title is not in its key, so moving it is an update.
- `canonicalTitleId` (`utils/title-identity.ts`), which the tracking writer calls on the title id as every other
  writer does.

**Export.** There is none today. When it is built, the tracking part is two files: every `user_watch` row (title,
season and episode, date, precision, origin, pass) and every `user_tracking` row with a state. Both are one routed
read per member. The columns of the first match Letterboxd's and Trakt's exports closely enough to be imported
elsewhere.

## 9. What this does not cover, and open risks

**Not covered.**

- The importer for each source, the preview's screens, and sources that number episodes differently from TMDB.
- How "N new episodes" and the prompt to rate look.
- Guests: tracking is for members. Guest progress keeps its own store in the browser.
- Loading the member data map in parts ([the design](../../research/user-data-loading-design.md)). This model keeps
  the map whole and adds about 30 bytes per title; the per-title key and the routed reads are what a scoped read
  would use.
- Ratings for episodes and seasons, a release calendar, showing anything to other people.
- The build tickets. One slice each: the helper and the two tables with the movie watch log; the machine in
  `domain/` with the writer and the show page; My shows, home and the library; the migration; imports.

**Not verified.** Production was read, never written, so nothing that needs a table was tried.

| Risk | Why it matters | How to settle it |
| --- | --- | --- |
| `_seq_no` and `_primary_term` in an `UPDATE` by the whole key | It is what keeps two actions on one show from overwriting each other's row | First build ticket, against a local Crate 5.10. The fallback is a `revision` column compared after a refresh |
| `NOT NULL` and `CHECK` together on one column, as written above | The definitions may need the `CHECK` moved | `init/cratedb` with `dry_run`, then on a local Crate |
| `count(*) FILTER (WHERE ...)` and the joins of the consistency check | The check as written | Run it once on a local Crate |
| One insert of 500 rows of 15 values | Proven by the import with 500 rows of 15 values; not with this table | The migration's dry run on one member |
| How long `REFRESH TABLE user_watch` takes once the table has 260,000 rows | Every action runs it once before reading. The import does the same on a small table today | Measure after the migration. If it costs more than a few milliseconds, the writer reads by the watch ids it expects instead |
| The join of Q6 between a member's rows and `show` | Whether Crate turns it into reads by key | Measure with the largest member; the two-step read is the fallback |
| Ordering by a nullable timestamp with a continuation (Q8) | The diary's steps | Null ordering was checked with literal values only |
| `show.aired_episode_count` being a day late | A new episode reads as new up to a day after it airs | Accept, or have the copy visit airing shows twice a day |
| Array and object columns | None are used, on purpose: an undated watch has no place in a list of times, and a row per watch needs no list | |

**Read from production for this document** (all `SELECT`, each aggregated or limited, each answered in under 0.3
seconds, none abandoned): the counts in section 6; table settings from `information_schema` and `sys`; null ordering
and `unnest` with literal values. Two of them joined `user_watch_history` to another table: scores without a watch
row and listed episodes per member were counted member by member, each statement filtered by `user_id`; and the
status and episode totals of the 650 marked shows were read once with a subquery over `user_watch_history` without
a member filter (0.1 seconds).

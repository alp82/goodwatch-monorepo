# Data model for watches, show state and what each page reads

The decided data model for [#378](https://github.com/alp82/goodwatch-monorepo/issues/378), under the map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Proposed on October 7, 2026, reviewed by the owner the
same day, and rewritten here with every open point decided. Nothing is built yet. This is what the build tickets for
the watch model, episode tracking and the Watching pages build.

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
| `user_watch_log` (new) | One time a member watched one movie or one episode | `user_id, watch_id` | `user_id` | The tracking writer in the webapp; an import; the migration; the fill job (C5) |
| `user_watch_state` (new) | Where a member stands with one title: the state, when it changed, the pass, the Seen press that can be taken back, the two prompts. Nothing that can be computed from the log | `user_id, tmdb_id, media_type` | `user_id` | The same writer, always after the log rows |
| `user_watch_history` (today) | Retired. Left untouched as the backup and dropped by hand 30 days after the switch | | | Nobody, after the switch |
| `user_import`, `user_import_item` (extended) | One import, and one row of its file. New nullable columns for watches and statuses | unchanged | unchanged | The import |
| `show.aired_episode_count` (new column) | How many regular episodes of the show have aired, by the UTC date | | | The episode copy in `goodwatch-flows` |

The two new tables are siblings and share a prefix: the log is what happened, the state is where that leaves the
member. Want to See, Not interested and the score stay where they are (`user_wishlist`, `user_not_interested`,
`user_score`). The machine reads them and clears them, and they are not states.

### Decisions

Decided by the owner on October 7, 2026. The label in the first column is the one the proposal and the ticket used.

| | Decided | Instead of |
| --- | --- | --- |
| Names | `user_watch_log` and `user_watch_state`; the column `watched_at_precision`; the member data entry `watchState` | `user_watch`, `user_tracking`, `date_precision`, `tracking`: the two tables did not read as a pair, and "date" did not say which date |
| O1 | No overlap. `user_watch_state` stores only what can't be computed from the log. Counts and dates are computed from `user_watch_log` when read, by one grouped query per member, cached with the member data | Summary columns in the state row (`watch_count`, `episodes_watched`, the furthest episode, the dates) that the writer recomputes on every write: Crate has no transactions, so every copy is something a crash can leave wrong |
| C1 | The new state table replaces `user_watch_history`, which stays untouched as the backup for 30 days | Adding columns to the old table, where every reader takes a row to mean Seen; or keeping it for good |
| C2 | Rating a movie that has no watch records one: no date, origin `score`. Clearing the score deletes it; a watch the member logs replaces it. Rating a show records nothing and never changes its state | A scored title with no row at all, Seen only where the score is read (the proposal's recommendation); or today's rule, a watch dated "now" for movies and shows alike |
| C3 | "Watched in the last 30 days" is the latest of the dated watches' dates and, for undated watches not from an import, the time they were recorded | Dated watches only (a "Watched up to here" tonight would not count); or the time anything was recorded (an import of a 2019 history would fill Continue) |
| C4 | UTC in the database and the API, the member's time zone only in the interface. The browser decides "aired for you" by the date on the device; the server accepts a watch for an episode that airs up to one day after the UTC date | Aired by UTC everywhere (a device ahead of UTC could not tick tonight's episode); or aired by the member's date on the server (a count per time zone can't be stored) |
| C5 | A show marked Seen while it had no episode list gets the press's group filled once the list exists: undated watches for the regular episodes that had aired by the day of the press | Leaving it Seen with every episode reading as new, as the machine alone would |
| C6 | An import inserts log rows. It sets the state only for a show that had no row before the import, or whose state is Not started or Watching. On hold, Dropped and Seen set here are never changed by an import | Replaying the file as if the member acted now, so that an old watch resumes an On hold or Dropped show |
| F1 | A watch marked on its own has origin `single` | `hand` |
| Watch again | Needs at least one watched regular episode (a guard on row 26 of the table) | Offering it on a show that is Seen with nothing watched, which would give Watching with no watch |
| Group marks | Mark season and "Watched up to here" are group actions like the Seen press: one insert, origin `season` or `upto`, one group id | Leaving them out of the model because the machine has no event for them |
| Next episode | Computed, never stored | A stored pointer, which goes wrong when TMDB dates an earlier episode later |

### To measure first

One thing in this model is unmeasured and everything the lists show depends on it: the speed of the grouped query
([section 3](#the-grouped-query)) for the largest member, who has about 32,700 log rows after the migration.
**The first step of the build, once the two tables exist and hold the migrated data, is to time it, before any list
is built on it.** [Section 3](#measure-it-first) says how, what counts as slow, and what is done then.

## 2. Table definitions

In the form of `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`, ready to paste.
`f/sync/init/cratedb` creates the two tables and adds the new columns; it changes and drops nothing.

### `user_watch_log`

```python
    # One row per time a member watched a movie or an episode (docs/implementation/tracking/data-model.md, ADR 0008).
    # watched_at and watched_at_precision: 'moment' is the instant; 'day' is 00:00:00 UTC of the calendar day and
    # only its date is read; 'unknown' is NULL. origin: 'single' is one watch marked on its own, of an episode or a
    # movie; 'upto', 'season' and 'seen' are group actions (Watched up to here, Mark season, the Seen button) and
    # carry group_id; 'score' is the undated watch that rating a movie records while the movie has no other watch;
    # 'import' carries import_id. A movie watch has no episode columns and pass 1.
    "user_watch_log": {
        "columns": {
            "user_id": "TEXT",
            "watch_id": "TEXT",
            "media_type": "TEXT NOT NULL CHECK (media_type IN ('movie','show'))",
            "tmdb_id": "INTEGER NOT NULL",  # the movie or the show
            "episode_tmdb_id": "INTEGER",  # episode.tmdb_id at the time of the watch
            "season_number": "INTEGER",  # 0 = special
            "episode_number": "INTEGER",
            "watched_at": "TIMESTAMP WITH TIME ZONE",
            "watched_at_precision": "TEXT NOT NULL CHECK (watched_at_precision IN ('moment','day','unknown'))",
            "origin": "TEXT NOT NULL CHECK (origin IN ('single','upto','season','seen','score','import'))",
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

| watch_id | media_type | tmdb_id | episode_tmdb_id | season, episode | watched_at | watched_at_precision | origin | group_id | import_id | pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0193f6a2-7c1e-7b3a-9d44-5e0c1a2b3c4d` | movie | 157336 | | | 2026-10-06 19:40:12 UTC | moment | single | | | 1 |
| `0193f6a2-9e02-7f10-8a71-0b9d6c7e8f90` | show | 1622 | 64121 | 2, 5 | 2026-10-05 00:00:00 UTC | day | single | | | 1 |
| `g-0193f6a3-11aa-7c55-b0e1-2f3a4b5c6d7e-64122` | show | 1622 | 64122 | 2, 6 | NULL | unknown | seen | `0193f6a3-11aa-7c55-b0e1-2f3a4b5c6d7e` | | 1 |
| `score-680` | movie | 680 | | | NULL | unknown | score | | | 1 |
| `i-5b1e0c9a7d2f4e6a8c0b1d3f5a7c9e1b` | movie | 603 | | | 2019-03-12 00:00:00 UTC | day | import | | `imp_8f2c…` | 1 |

**The key.** `watch_id` is the identity of the watch, unique per member. It is made in one of four ways, and all
inserts are `ON CONFLICT (user_id, watch_id) DO NOTHING`:

- **A single watch:** an id the browser makes (`crypto.randomUUID()`) and sends with the request. A request that is
  sent twice, or that timed out and landed anyway, inserts once. Two watches of the same episode on the same day are
  two requests and two ids.
- **A group action:** `g-<group id>-<episode id>`, where the group id comes from the browser the same way. Sending
  the same press again inserts nothing new.
- **The score's watch:** `score-<movie id>`. A member has at most one per movie, so rating twice inserts once.
- **An import:** `i-` and the first 32 hex characters of the SHA-1 of the source, the title, the season and episode
  number, the date and its precision, the pass, and a counter for rows of one file that agree in all of these. It
  does not contain the import's id, so the same file uploaded again writes nothing, and a date the member corrected
  in the log stays corrected. Two plays on one day in a source that only knows days are two rows through the counter.

The key has no title in it because Crate's primary key gives no benefit to a key prefix: a read is either by the
whole key (real-time, no refresh needed) or by indexed columns. Editing or deleting one watch is by the whole key.

**Routing.** `clustered_by user_id` puts every watch of a member in one shard, so the three reads the pages need are
one shard each:

- All watches of this member for this show: `WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?`.
- All watches of this member, newest first, page by page: `WHERE user_id = ? ORDER BY watched_at DESC NULLS LAST,
  watch_id DESC LIMIT 61`, continued with the last row's `watched_at` and `watch_id`.
- All watches of this member, grouped per title and pass: the grouped query of section 3.

Today's user tables are routed by their whole key, so `WHERE user_id = ?` asks all shards.

**The date.** One column and one sort:

| | `watched_at` | `watched_at_precision` | Shown as |
| --- | --- | --- | --- |
| Marked at the moment, or a source with a time (Trakt) | The instant | `moment` | "6 Oct 2026, 21:40" in the viewer's time zone |
| A chosen day, or a source with days (Letterboxd) | 00:00:00 UTC of that calendar day | `day` | "5 Oct 2026", formatted in UTC so it never shifts |
| "Don't know when", a group action, the score's watch, a source without dates | `NULL` | `unknown` | "Date unknown" |

`ORDER BY watched_at DESC NULLS LAST, created_at DESC` gives the watch log's order: dated watches newest first, then
the undated ones. Checked on production with literal values: Crate puts `NULL` first under `DESC` unless `NULLS LAST`
is written. A day-precise watch sorts at the start of its UTC day, so among the watches of one day it comes after
those with a time. A watch with a time made shortly after midnight east of Greenwich falls on the previous UTC day;
only the order within two neighbouring days can differ from the member's calendar, and no date is shown wrong.
Editing a date in the log sets a day or unknown, never a time.

**Shards.** Six. The migration writes up to about 266,000 rows (section 6), and the largest member gets about 32,700.
Six shards keep each far below a gigabyte with room for a hundred times that, and a member's reads touch one shard
whatever the count is.

### `user_watch_state`

```python
    # Where a member stands with a title (docs/implementation/tracking/data-model.md, ADR 0009). Only what can't be
    # computed from user_watch_log: no counts and no dates of watches. A show's state is the state machine's. A
    # movie has a row while it has a log row, with state 'seen' and pass 1. A row with state 'not_started' exists
    # only to remember a prompt, and every reader filters on state.
    # seen_press_group and seen_press_from: the Seen press that one more press takes back, and the state it was
    # pressed from. Both NULL when no press stands. seen_question: NULL (not asked), 'open', 'answered'.
    "user_watch_state": {
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
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "clustered_by": "user_id",
        "shards": 3,
        "timestamps": False,
    },
```

| tmdb_id | media_type | state | state_changed_at | pass | seen_press_group | seen_press_from | rate_prompt_dismissed_at | seen_question |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 157336 | movie | seen | 2026-10-06 19:40 | 1 | | | | |
| 680 | movie | seen | 2026-09-12 08:15 | 1 | | | | |
| 1622 | show | watching | 2026-08-14 20:05 | 1 | | | 2026-09-30 21:10 | |
| 1399 | show | seen | 2026-10-06 21:02 | 1 | `0193f6a3-…` | `on_hold` | | |
| 66732 | show | not_started | 2026-10-01 18:30 | 1 | | | | `open` |

"26 of 327", "last watched 5 Oct" and "3×" are in none of these rows. They are computed from the log (section 3).

**What a row means.** For a show, the row is the machine's stored record: `state`, `pass`, the standing Seen press,
the two prompts. For a movie, a row exists while the movie has at least one log row, and its state is `seen`; the
column lets every reader ask one question, `state = 'seen'`, for both kinds. A movie has no other state, and the
glossary's rule that only shows have a status is unchanged. A rated movie always has a log row (C2), so it always
has a row here. A rated show that was never started has none, or one that only remembers the question.

A show's row is deleted when nothing is left to remember: the state is `not_started`, the pass is 1, and neither
prompt column is set. So a row can exist with `not_started`: after a show was rated by hand and the question is open
or answered, or after "Not now" on the prompt to rate. A show of which only a special was watched has log rows and
no row here: the special changes nothing the row holds. Readers never test for the row; they test the state.

The movie row is the one place where this table repeats something the log knows: that a log row exists. It is kept
because the readers with their own SQL (section 4) ask one table one question for both kinds.

**What undo of the Seen press needs.** `seen_press_group` is the group id of the press, which is also on its log
rows; `seen_press_from` is the state before it. One more press deletes the rows of that group and returns the state
by rows 13 to 17 of the table. Both are set to NULL by any step that leaves Seen, which is the machine's rule that a
press can be taken back only while the show is still Seen. The machine's counter of presses is not stored: it only
named groups, and the browser's id does that.

**What the guards read.** Every guard is answered by this row, the catalog, and the log rows of the show, which the
writer has loaded anyway:

| Guard | Read from |
| --- | --- |
| the episode is a special | The event: `season_number = 0` |
| every aired episode is now watched, or not | The log rows of the show and the episode list |
| a watch remains, or not | The same log rows: one of a regular episode, in any pass |
| episodes aired since | The same log rows against the aired regular episodes |
| the press was made on a Seen, On hold or Dropped show | `seen_press_from` |
| Watch again: a regular episode is watched | The same log rows |

**The key and the routing.** The key is today's key for a member and a title, so one title's row is a real-time read
by the whole key, which the writer and the show page use. Routing by `user_id` makes the member data read one shard.

**Shards.** Three, one per node. The table has one row per member and tracked title: 8,161 after the migration.

### The episode catalog: one more column

```python
            # In "show": how many regular episodes have aired (season_number > 0, not removed, air_date on or before
            # the UTC date). Written by f/sync/copy/tmdb_episodes whenever it copies the show.
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
            "watched_at_precision": "TEXT",
            "pass": "INTEGER",
            "source_status": "TEXT",  # the source's word: watching, hold, dropped, completed, plantowatch, ...
            "watch_id": "TEXT",  # the user_watch_log row this item stands for
            "prior_state": "TEXT",  # for kind 'state': user_watch_state.state before the import, NULL for no row
            "applied_state": "TEXT",  # for kind 'state': what the import set, and what undo must still find
```

`user_import` needs no new column: `source` names the platform, and `counts` is already JSON text that can hold
counts per kind.

## 3. Stored versus derived

Two rules decide where a value lives:

- **What only a member's action changes, and the log can't say, is stored** in `user_watch_state`: the state, the
  pass, the standing press, the prompts.
- **What the log can say is computed from the log** when it is read, and cached with the member data. What the
  catalog or the calendar can change is derived at read time and never cached with the member.

There is one source of truth for every value. Crate has no transactions, so a count stored beside the rows it counts
is a second write that a crash, a timeout or a concurrent action can leave behind; a count computed from the rows
can't be wrong.

"The writer" is the one server function that applies a tracking event (section 4). "The catalog" is the cached
episode list of a show and `show.aired_episode_count`. "The entry" is the title's entry in the member data map
(section 4), which holds the state and what the grouped query computed.

| What the screen shows | Stored or derived | Where, from what | Recomputed |
| --- | --- | --- | --- |
| State | Stored: `user_watch_state.state` | | By the writer on a member's event, by the table's row |
| Label: Watching, On hold, Dropped, Seen, Caught up, "· N new" | Derived | Server and browser, one shared function: `state`, plus for Seen `show.status` (not Ended or Canceled gives Caught up) and the count of new episodes | Every read |
| Progress, "26 of 327" | Derived | Lists: the entry's `episodesWatched` and `show.aired_episode_count`. Show page: counted from the log rows and the episode list | Watched with the member data; aired with the catalog |
| "N new episodes" on a Seen show | Derived | `show.aired_episode_count - episodesWatched` while the state is Seen, never below 0. Show page: counted exactly | Every read |
| Next episode | Derived | The first aired regular episode after the entry's `furthest` in the show's cached episode list. If there is none and `episodesWatched` is below the aired count, the member has a gap: the show's log rows are read and the machine's rule is applied. Shown for Watching, On hold, and Seen with new episodes. Per pass, because `furthest` and `episodesWatched` count the current pass only | Every read |
| Counts as Seen, for filters and the cards' seen flag | Derived | `state = 'seen'` or a row in `user_score`. Both are in the member data map. A rated movie has the state too; a rated show counts through its score alone | Every read |
| Hidden by Not seen yet | Derived | Any state but `not_started`, or a score, or skipped in the taste quiz | Every read |
| Hidden from recommendations | Derived | `state = 'dropped'`, or a row in `user_not_interested` | Every read |
| Not interested or Drop offered | Derived | Browser, from `state`: Not interested in Not started; Drop in Watching and On hold | Every read |
| Prompt to rate is due | Derived | Show page only: no score, `rate_prompt_dismissed_at` is NULL, and three or more different regular episodes in the show's log rows (any pass) or `seen_press_group` is set | Every read of the show page |
| "Have you seen all of it?" is due | Stored: `seen_question = 'open'` | Set when a member rates a show by hand that has no row or is Not started; closed by an answer, a watch or a Seen press | By the writer |
| Seen button: mark, "mark N new", take back, or off | Derived | State, the count of new episodes, and whether `seen_press_group` is set | Every read |
| Watch count on a movie, "3×" | Derived | The entry's `count`: the movie's log rows | With the member data |
| "Watched yesterday", "Date unknown" on a row | Derived | The entry's `watchedAt` and `precision` | With the member data |
| Order of My shows | Derived | Continue: Watching entries with a Next episode and `lastActivityAt` within 30 days, newest first; then Seen entries with new episodes. Start: Want to See shows without a state, best taste match first | Every read |
| Tonight's pick | Derived | The first row of Continue; without one the first movie of My movies; without one the first show of Start | Every read; its cache is reset with the member data |
| Season matrix cell: rating | Not member data | The catalog and the IMDb ratings, as today's episode grid | With the catalog |
| Season matrix cell: watched | Derived | Show page only: the log rows of the show in the current pass, matched to listed episodes by id, or by season and number when exactly one listed episode has them | Every read of the show page |
| Aired for you: what can be ticked, what is greyed | Derived | Browser: the episode's air date against the date on the device (C4) | Every render |

### The grouped query

One statement per member computes everything the lists and the map need from the log. It runs when the member data
is read on a cache miss, beside the other member data reads, and its result is cached with them: 5 minutes, reset by
every action.

```sql
-- QG. Everything the log says about each of a member's titles, one row per title and pass.
SELECT tmdb_id, media_type, pass,
       count(*) AS watch_count,
       count(DISTINCT season_number * 100000 + episode_number)
           FILTER (WHERE season_number > 0) AS episodes_watched,
       max(season_number * 100000 + episode_number)
           FILTER (WHERE season_number > 0) AS furthest,
       min(watched_at) AS first_watched_at,
       max(watched_at) AS last_watched_at,
       max(CASE WHEN watched_at_precision = 'moment' THEN watched_at END) AS last_moment_at,
       max(CASE WHEN watched_at IS NOT NULL THEN watched_at
                WHEN origin <> 'import' THEN created_at END) AS last_activity_at
FROM user_watch_log
WHERE user_id = ?
GROUP BY tmdb_id, media_type, pass
```

One shard, no join, at most a row per title and pass: about 980 rows for the largest member.

**Why it groups by pass.** Progress and the Next episode count the current pass only, and the current pass is in
`user_watch_state`. Grouping by pass and letting the server function pick the group of the row's pass (pass 1 for a
title without a row) needs no join. A join would also rule out `count(DISTINCT ...)`: Crate's documentation says
"`DISTINCT` is not supported with aggregations on Joins".

**What the server function makes of the groups,** per title:

| Value | From the groups | Meaning |
| --- | --- | --- |
| `count` | The sum of `watch_count` over all passes | A movie's watch count: its log rows. The score's watch is one row, and it is gone as soon as the member logs a watch, so the count never shows two for one viewing |
| `episodesWatched` | `episodes_watched` of the current pass | The different regular episodes with a watch in the current pass. A second watch of an episode, and a special, do not add |
| `furthest` | `furthest` of the current pass, split into season (`/ 100000`) and episode (`% 100000`) | The furthest regular episode watched in the current pass |
| Started at all | `episodes_watched > 0` in any pass | The guard "a watch remains", for readers |
| `watchedAt` | The largest `last_watched_at` over all passes | The latest dated watch. NULL when every watch is undated |
| `precision` | `moment` when the largest `last_moment_at` equals `watchedAt`; else `day` when `watchedAt` is set; else `unknown` | How exact `watchedAt` is, without a second query: the latest moment-precise watch is the latest watch exactly when the two maxima are equal. When a day-precise and a moment-precise watch share the instant 00:00:00 UTC, it says moment |
| `lastActivityAt` | The largest `last_activity_at` over all passes | C3: the latest of the dated watches' dates and, for undated watches not from an import, the time they were recorded. An undated imported watch gives NULL and so counts for nothing |
| First watched | The smallest `first_watched_at` over all passes | Returned, and not put in the map until a screen needs it |

The composite `season_number * 100000 + episode_number` orders episodes by season and then number in one integer and
makes one episode one value. It stays inside `INTEGER` for season numbers up to 21,473; TMDB's largest are years.
It counts by season and number and not by `episode_tmdb_id`, so an episode TMDB re-added under a new id that has a
watch under each id still counts once.

**Where the lists differ from the show page.** The grouped query knows the log and not the catalog. The show page
counts the listed, aired regular episodes the member watched, with the machine's own function. The two agree unless:

- TMDB removed or renumbered an episode the member had watched. The list's count is then too high by that episode
  until the member next opens the show, where the count is exact. Nothing is stored wrong, so nothing has to be
  repaired.
- The member ticked an episode that airs tomorrow by the UTC date (C4). For those hours the log holds one episode
  more than `show.aired_episode_count`. Lists show the watched count capped at the aired count and never a negative
  number of new episodes.
- The prompt to rate needs the different episodes watched in any pass, and groups per pass can't give that: the same
  episode in two passes would count twice. It is therefore computed on the show page only, from the show's log rows.

**What is verified and what is not.** Crate 5.10's documentation gives the syntax
`aggregate_function ( [ DISTINCT ] expression [ , ... ] ) [ FILTER ( WHERE condition ) ]`, says `count(DISTINCT ...)`
counts the distinct values that are not NULL, and allows `min` and `max` on primitive types. Not verified, because
it needs the table and production was not read for this rewrite:

- That `count(DISTINCT <expression>)` takes an expression and not only a column, and that it combines with `FILTER`.
  If it does not, the expression becomes a column the writer fills (`episode_key INTEGER`), which `init/cratedb`
  adds without touching existing rows; the migration and one `UPDATE` fill it.
- That `max` over a `CASE` of timestamps is planned as an aggregate and not rejected.
- That `min` and `max` of `TIMESTAMP WITH TIME ZONE` return NULL for a group whose values are all NULL (documented
  for columns in general).
- The speed, below.

### Measure it first

The first build ticket creates the two tables and the helper (section 4), and the migration fills them. Then, before
My shows, home or the library is built on the grouped query:

1. Run QG for the largest member (about 32,700 log rows), for one with about 5,000, and for a typical one, from the
   webapp's own Crate client, 30 times each after one warm-up run, and again in the second after an insert into the
   member's log.
2. Record the median and the slowest run as the client sees them, and Crate's own duration from `sys.jobs_log`.

**What slow means.** The query is slow when, for the largest member, the client-side median is above 100 ms or the
slowest of the 30 runs is above 250 ms. The reasoning: the member data is read by parallel queries, so a cache miss
takes as long as its slowest query. Today the whole read takes 99 ms at the median (55 to 155 ms) for the largest
account, and its single queries 28 to 83 ms
([measurements](../../research/user-data-loading-measurements.md)). A grouped query within 100 ms leaves a miss about
where it is today. A miss happens on the first page after every action, which is the moment a member is watching the
screen for the result, and after five minutes without one. For a typical member the query reads a few hundred rows
and the threshold is not in question; it is set by the largest member because an import can make any member that
large.

**If it is slow,** in this order:

1. Keep the member's cached entries across an action and recompute only the title that was acted on: the same
   statement with `AND tmdb_id = ? AND media_type = ?`. The full query then runs only when the cache has expired.
   No schema change.
2. If the full query is still too slow at expiry, add the summary columns to `user_watch_state` that this model
   left out (`watch_count`, `episodes_watched`, `furthest_season`, `furthest_episode`, `last_watched_at`,
   `last_watched_at_precision`, `last_activity_at`), written by the writer after the log rows and filled once from
   QG. `f/sync/init/cratedb` adds columns to an existing table and touches neither its rows nor the log. The readers
   change from the computed entry to the columns; the entry's shape stays. That is the design of the first proposal,
   with its cost: a second write that can be left behind, and a check that has to find it.

### Values that depend on the catalog

The machine never stores aired episodes, new episodes, or whether the show has ended, and neither does this model.
The member's side of each comparison is in the entry, so the catalog's side is one read by key for all of a member's
shows:

- **Seen shows with new episodes, for My shows.** The entry's `episodesWatched` against `show.aired_episode_count`,
  read for all of the member's Seen shows in one statement by key (section 4, My shows). No Seen show is opened one
  by one. Without the column, the same list needs a count over `episode` for every Seen show of the member on every
  request (300 shows are some 15,000 episode rows).
- **Caught up or Seen.** `show.status`, read in the same statement.
- **Next episode.** The show's episode list is public data, the same for everyone, and is cached per show. The
  member's side is `furthest`.

### Aired: UTC on the server, the device's date in the browser

C4. The database and the API know one calendar, UTC. The member's time zone exists only in the interface.

- **The server.** An episode has aired when its air date is on or before the UTC date. `show.aired_episode_count`,
  the machine's set of aired episodes, "up to date", and the new episodes and the Next episode in lists all use this.
- **The browser.** The episode list carries each episode's air date. The browser decides "aired for you" by the date
  on the device: what can be ticked and what is greyed, and the optimistic result of an action on the show page.
- **The tolerance.** The server accepts a watch for an episode whose air date is at most one day after the UTC date.
  No time zone is more than 14 hours ahead of UTC, so a device's date is never more than one day ahead, and a tick
  the browser offers is never refused. In the step that records it, the ticked episode counts as aired, so the first
  watch of a premiere gives the same state on both sides. A group action (the Seen press, Mark season, "Watched up
  to here") sends the device's date; the server marks the episodes aired by the later of the UTC date and that date,
  at most the UTC date plus one. A request without a date, such as a Seen press on a card, uses the UTC date.

What a member can observe while the two dates differ:

| The device is | When | What differs |
| --- | --- | --- |
| Ahead of UTC (Europe, Asia, the Pacific) | From local midnight until midnight UTC: one or two hours in central Europe, nine in Japan | An episode dated today on the device can be ticked on the show page. Home and My shows do not count it as aired yet: no "1 new", and it is not the Next episode there. Once ticked, a list shows the progress capped ("26 of 26") until midnight UTC. Ticking the episode before it reads Watching for an instant in the browser (one is left, for you) and the response sets Seen, shown as Caught up; the new episode stays tickable |
| Behind UTC (the Americas) | From midnight UTC until local midnight: the last four to ten hours of the evening | The server counts tomorrow's episode as aired: home can show it as the Next episode or as "1 new" while the show page greys it until local midnight. Ticking the episode before it reads Seen for an instant in the browser and the response sets Watching |

In both cases the response's row replaces the optimistic state, and the difference ends at the next midnight. TMDB's
air dates are calendar dates of the first broadcast without a time zone, so neither side is the true one.

## 4. What each screen reads and writes

### Reads

The member data map is what `getUserData` loads for every page (`server/userData.server.ts`): cached per member for
5 minutes, reset by every write after `REFRESH TABLE` ([member-data-cache.md](../../member-data-cache.md)).
Its `watched` entry is replaced by `watchState`, built from two reads that run beside the others:

```sql
-- QS. The member's states.
SELECT tmdb_id, media_type, state, pass
FROM user_watch_state
WHERE user_id = ? AND state <> 'not_started'

-- QG. The grouped query of section 3.
```

```ts
watchState: Record<MediaKey, {
	state: "watching" | "on_hold" | "dropped" | "seen"
	/** The latest dated watch, and how exact it is. */
	watchedAt: Date | null
	precision: "moment" | "day" | "unknown"
	/** Log rows of the title. */
	count: number
	// Shows only:
	pass: number
	/** Different regular episodes watched in the current pass. */
	episodesWatched: number
	/** The furthest of them, as [season, episode]. */
	furthest: [number, number] | null
	lastActivityAt: Date | null
}>
```

An entry exists for every title with a state other than Not started. Groups of a title without such a state (a show
of which only a special was watched) are dropped. The browser still gets one entry per title and never a row per
episode: per-episode data loads per show. `REFRESH TABLE` in `resetUserDataCache` gains the two new tables.

**Sizes, estimated.** The largest account today has 975 watched entries and a map of 160 KB, 29 KB gzipped
([measurements](../../research/user-data-loading-measurements.md)). An entry is 56 bytes of JSON today. Written out
as above, a movie entry is about 100 bytes and a show entry about 190. With some 845 movies and 130 shows that
account's map becomes about 215 KB. Its scored movies without a watch (at most 469 of its titles) gain an entry of
about 80 bytes each, which gives at most about 250 KB, an estimated 45 KB gzipped at the measured ratio. An importer
with 1,200 Seen movies, 300 shows, 1,500 scores and 350 Want to See comes to about 350 KB, an estimated 63 KB
gzipped. Its tens of thousands of episode watches are not in it. These are estimates from one measured map and the
length of sample entries, not measurements; repeated keys compress better than the ratio assumes, and shorter keys
would cut the raw size by a third if it matters.

| Screen | Query | Rows | In the map | Cache and reset |
| --- | --- | --- | --- | --- |
| **Show page**: hero box, matrix, open season, watch log per episode | Q1 to Q3 below | 1 row; one log row per watched episode and pass (Supernatural: up to 327 per pass); the episode list | The state and the counts are (for the first paint of the hero); the rows are not | Q1 and Q2 are not cached on the server. The browser keeps them under a key per show and every action on the show replaces them. Q3 is public and cached per show |
| **Movie page**: watch log | Q4, when the log opens | 1 to a handful | Seen and the count are | Not cached; the browser's copy is replaced by every action on the movie |
| **Home doors** and **Tonight's pick** | None for the member: the Watching entry with the latest `lastActivityAt` in the last 30 days, then its Next episode from the cached episode list. The other two doors are today's Watch next reads | | Yes | With the member data: the pick's key includes the map's `watchState` entries |
| **My shows** | None for the member: the entries of the map. Q5 reads their shows from the catalog by key; the cached episode lists of the Continue rows give the Next episode's name. Start is the Wishlist's shows from the map, ordered by taste match as Watch next does today | The member's Watching, On hold and Seen shows: up to a few hundred keys | Yes | Q5 is public data; the list is rebuilt when the member data is |
| **My movies** | No new query. It is the Wishlist's movies. A movie leaves when it is Seen because a watch, the score's included, deletes its Want to See row | | The Wishlist is | As today |
| **Library**: counts on the chips and in the drop-down | None. Counted from the map: Want to see from `wishlist`; Watching, On hold and Dropped from `watchState`; Seen is `watchState` entries with state Seen plus scored shows without one; Not rated is Seen entries without a score | | Yes | With the map |
| **Library**: a status's list, in steps of 60 | The order is made from the map on the server (2,500 keys sort in well under a millisecond), then Q6 loads the cards of one step. Last watched: `watchedAt` newest first, then the titles without a dated watch. My score: from `scores`. Title: the titles of the member's keys are read once by key and kept with the map | 60 per step, also at 1,500 titles | The keys are | The card data is public and cached as today |
| **Title cards**: the seen flag | None. `watchState[key].state === 'seen'` or a score. On the server: `viewer.seen` | | Yes | With the map |
| **Not seen yet** in Discover, Explorer and recommendations | None for the surfaces that use the viewer context (`server/viewer.server.ts`): its `seen` set becomes scored titles and `watchState` entries in any state, and Dropped joins the always hidden set beside Not interested. The three readers with their own SQL change one table name and gain `AND state <> 'not_started'` (list below) | One row per tracked title | Yes | With the map |
| **Taste** | Nothing new. Taste is built from scores and Want to See. A watch that deletes a Want to See row calls `markTasteChanged`, as `updateWishList` does. Dropped is not read | | | |
| **Diary** (a later view of Seen) | Q7 | 60 per step | No | Not cached |

```sql
-- Q1. The member's row for one title. Whole key: real-time, no refresh needed.
SELECT state, state_changed_at, pass, seen_press_group, seen_press_from, rate_prompt_dismissed_at, seen_question,
       _seq_no, _primary_term
FROM user_watch_state
WHERE user_id = ? AND tmdb_id = ? AND media_type = 'show';

-- Q2. Every watch of the member for one show: the ticks, the matrix, each episode's log, and every count.
SELECT watch_id, episode_tmdb_id, season_number, episode_number, watched_at, watched_at_precision, origin, group_id,
       import_id, pass, created_at
FROM user_watch_log
WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?
ORDER BY season_number, episode_number, watched_at DESC NULLS LAST
LIMIT 20000;

-- Q3. The episode list. Public, cached per show.
SELECT tmdb_id, season_number, episode_number, name, air_date, runtime, still_path, episode_type
FROM episode
WHERE show_id = ? AND removed_at IS NULL
ORDER BY season_number, episode_number;

-- Q4. A movie's watch log.
SELECT watch_id, watched_at, watched_at_precision, origin, import_id, created_at
FROM user_watch_log
WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
ORDER BY watched_at DESC NULLS LAST, created_at DESC
LIMIT 200;

-- Q5. My shows: the catalog's side of the member's Watching, On hold and Seen shows, by key.
SELECT tmdb_id, aired_episode_count, status, title, poster_path
FROM show
WHERE tmdb_id IN (?, ?, ...);

-- Q6. The cards of one step of a library list (and the same for movie).
SELECT tmdb_id, title, poster_path, release_year FROM show WHERE tmdb_id IN (?, ?, ...);

-- Q7. The diary: every watch, newest first. The next step continues below the last row.
SELECT watch_id, media_type, tmdb_id, season_number, episode_number, watched_at, watched_at_precision, origin,
       import_id, pass
FROM user_watch_log
WHERE user_id = ? AND watched_at IS NOT NULL
  AND (watched_at < ? OR (watched_at = ? AND watch_id < ?))
ORDER BY watched_at DESC, watch_id DESC
LIMIT 61;
-- Its "Date unknown" group is the same read with watched_at IS NULL, ordered by created_at DESC.
```

My shows is split in the server function from the entries and Q5's rows:

- **Continue:** Watching with a Next episode and `lastActivityAt` in the last 30 days, newest first; then Seen with
  `aired_episode_count > episodesWatched`.
- **Not watched for 30 days:** Watching, older.
- **Waiting for episodes:** Seen, `status` not Ended or Canceled, nothing new.
- **On hold.**

A Seen show that has ended and has nothing new is not on the page, and Q5 is asked for it only because that can't be
known before its row is read. Rows whose Next episode is a gap (nothing aired after `furthest`, and `episodesWatched`
below the aired count) get one more read for all of them together: Q2's columns with `tmdb_id IN (...)`.

### Who reads `user_watch_history` today

Each treats the existence of a row as Seen. After the change each asks for a state.

| Reader | Where | Becomes |
| --- | --- | --- |
| The member data map, `watched` | `server/userData.server.ts:79-82`, refresh at `:169` | The `watchState` reads above; the two new tables join the refresh |
| The viewer context, `seen` | `server/viewer.server.ts:76-81` | Scored titles and `watchState` entries; Dropped added to the always hidden set |
| Similar-title seeds | `server/utils/recommend.ts:165-173` | `user_watch_state`, `state <> 'not_started'` |
| Quiz titles | `server/smart-titles.server.ts:200-204` and `:241-245` | The same |
| The legacy Discover filter | `server/discover.server.ts:560-574` | The same; "watched" means `state = 'seen'` |
| "I watched it" and its undo | `server/finish-title.server.ts:33-37`, `:47-51`, `:83-86` | A movie watch through the tracking writer; undo deletes that `watch_id` |
| The only writer | `server/watchHistory.server.ts:43-69` | Replaced by the tracking writer |
| Browser accessors | `hooks/useUserDataAccessors.ts:32` and `:79`, `types/user-data.ts:62-64` and `:86` | `isSeen` reads `watchState` and `scores` |
| The optimistic update | `hooks/useUserDataMutations.ts:108-114` | Section "The browser" below |
| Tonight's pick's signature | `ui/navigation/useTonightsPick.ts:39` | Includes the `watchState` entries |
| Guest transfer review | `ui/onboarding/AccountTransfer.tsx:116` | Reads `watchState` |
| Interest discovery keys | `server/interest-discovery.server.ts:32`, `ui/discovery/useInterestDiscovery.ts:31`, `ui/taste/components/RecommendationSwiper.tsx:200` | `"watched"` becomes `"watchState"` |
| The rating control | `ui/user/actions/ScoreAction.tsx:37-39` | Stops calling the watched mutation. The score's watch is written on the server with the score (below) |
| Duplicate-title repair | `goodwatch-flows/scripts/provider_alias_resolution.py:23` | The list of user tables gains the two new ones |

Nine `server/prototype-rec-*.server.ts` files read the table too. They are throwaway and are deleted or pointed at
`user_watch_state` when the old table is dropped.

**The rating control.** Today `useScoreAction` records a watch dated now for every scored title, movie or show, and
removes the title's watch when the score is cleared:

```ts
updateScore({ mediaType, tmdbId, score })
if (user && recordWatch)
	updateWatched({ mediaType, tmdbId, action: score === null ? "remove" : "add" })   // goes
```

The second call goes, with the `recordWatch` option. `updateScores` on the server does what C2 says, in the same
request as the score: for a movie it writes or removes the score's watch (the per-action table below); for a show it
writes no watch, and a first score by hand on a show that is Not started sets `seen_question = 'open'`. Clearing a
score no longer removes a watch the member logged.

### Writes: one writer

Every tracking event of a show goes through one server function. Its interface is small and what it hides is the
whole of this document: `applyTrackingEvent(userId, title, event, actionId)` returns the new row and what an undo
needs. The machine itself (`step`, the table, `derive`) moves from the prototype into `domain/` as a pure function of
`(episode list, log rows, state row, event)`, and both the server and the browser call it. The Watch-again guard is
added to row 26 there; the prototype's `machine.ts` does not have it.

The steps, in order:

1. `REFRESH TABLE user_watch_log`, so that step 2 sees the rows of the member's previous action.
2. Read together: the state row (Q1, real-time), the show's log rows (Q2), the cached episode list (Q3).
3. Run the machine in memory. It gives the log rows to insert or the rows to delete, the new state row, and which of
   Want to See and Not interested to clear.
4. Write the log rows: one `INSERT ... VALUES (...), (...), ... ON CONFLICT (user_id, watch_id) DO NOTHING`, or one
   `DELETE ... WHERE user_id = ? AND watch_id IN (...)` naming the rows the machine removed.
5. Write the state row. A new row: `INSERT ... ON CONFLICT DO NOTHING`. An existing row: `UPDATE ... WHERE user_id =
   ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?` with the two values Q1 returned, or a
   `DELETE` with the same condition when nothing is left to remember. If no row was written, another action on the
   same show came in between: start again at step 1, at most three times.
6. Delete the Want to See and Not interested rows the event clears (by their whole key), and call
   `markTasteChanged` when a Want to See row went.
7. `resetUserDataCache`, which refreshes the user tables, the two new ones among them, and resets the member data.

That is one refresh, two member reads, one log write, one state write, up to two deletes and the reset: seven to
nine statements whatever the number of episodes. **A season or a Seen press is one insert.** Nothing is recomputed
and no summary is written: the state row holds only what the machine's step returned.

Step 5 runs for every event of a show that has a row, also when the row's content does not change (a tick on a
Watching show that stays Watching: 9,578 of the 14,795 ticks in the walks of section 5). The update then only sets
`updated_at`. It is what makes two actions on one show from two devices notice each other: the state row is also the
lock. A watch of a special on a show without a row writes the log row and nothing else.

The webapp already writes many rows in one statement: the IMDb import inserts 500 rows of 15 values
(`server/imdb-import/preview.server.ts:93-122`). `upsert` in `utils/crate.ts` can't be used for it: it loops over
its rows with one statement and one read-back each. The helper the writer needs, next to `upsert`:

- `insertRows(table, columns, rows, { conflict: [...], chunk: 500 })`: one multi-row `INSERT ... ON CONFLICT DO
  NOTHING` per 500 rows. A 327-episode show is one statement; the longest show members have marked Seen today lists
  9,413 episodes and is 19.
- After a timeout it does not know whether the rows landed. It does not need to: every `watch_id` is fixed before the
  write, so the writer sends the same statement again.

**Order, and what a crash leaves.** Log rows first, the state row second, the clears third. Nothing is stored twice,
so no count, date or progress can disagree with the log: they are the log. What a stopped action can leave behind is
only a state that is one step behind its log rows, and only for the events that change the state row at all.

| Stopped after | Left behind | Repaired by |
| --- | --- | --- |
| Step 4, the event was a tick or an untick that does not change the state | Nothing. Every count and date is already right | |
| Step 4, the first tick of a show | Log rows of a regular episode and no state row: the show page shows the tick, lists do not show the show | The browser got an error and sends the same action with the same ids: step 4 inserts nothing, step 5 writes the row. If it never does, the check lists the show (invariant 1) and the repair sets Watching, or Seen when every aired episode is watched |
| Step 4, the tick of the last aired episode | Watching with everything watched, where Seen was due | The same retry. Without it, nothing: the machine allows this pair (it also arises when TMDB removes the episodes a member had left), so no check lists it and no job changes it. The member's Seen press makes it Seen and inserts no row |
| Step 4, the untick of the only watched episode | Watching with no watch of a regular episode | The retry, or the check (invariant 1): Not started |
| Step 4, a Seen press | The group's log rows, the state before the press, no standing press: every tick is there and the progress is full, the state is not Seen | The retry. Without it the press can't be taken back with one press; the member presses Seen again, which inserts nothing and stands on an empty group. The earlier group's rows are unticked one by one or stay |
| Step 4, Seen pressed again | The group's rows are gone and the row still says Seen with the press standing | The retry. Without it the row has the signature the fill job looks for (C5, section 6): the job puts back the group's rows for the episodes that had aired by the day of the press, so the press stands again as the row says |
| Step 4, a movie's first watch or the delete of its last | A log row without a state row, or a state row without a log row: the movie's log and the lists disagree on whether it is Seen | The retry, or the check (invariant 3): the row follows the log |
| Step 5 | The state is right; Want to See or Not interested is still set on a started show | The retry. The check lists it (invariant 5) |
| Step 6 | The member data cache holds the old map for at most 5 minutes | Its lifetime |

**Per action.** Statement counts leave out steps 1, 2 and 7, which every action has. "The state row" names the
columns that change; `updated_at` always does.

| Action | Log rows | The state row | Other tables | The browser shows at once |
| --- | --- | --- | --- | --- |
| Watch an episode (rows 1 to 5) | Insert 1: `single`, now, `moment`, current pass | `state` by the row taken; a special changes nothing | A regular episode clears Want to See and Not interested | The tick, the next state and label, the new Next episode. Toast with Undo and "Change date" |
| Unwatch an episode (rows 6 to 10) | Delete the episode's rows of the current pass, by their `watch_id` | `state` by the row taken; leaving Seen sets the press columns NULL | | The tick gone, state and label |
| Mark a season; Watched up to here | Insert one row per aired regular episode in range not yet watched in the pass: origin `season` or `upto`, one group id, no date | As if each were watched in turn (section 5) | As a watch | Every tick of the range, state. Toast with Undo and "Set a date" |
| "Set a date" on a group | `UPDATE user_watch_log SET watched_at = ?, watched_at_precision = 'day', updated_at = ? WHERE user_id = ? AND group_id = ?` | None | | The dates |
| Unmark a season; Undo of a group mark | One delete for the rows of the season in the current pass, or `WHERE user_id = ? AND group_id = ?` | As if each were unwatched in turn | | The ticks gone, state |
| Press Seen (rows 11, 12) | Insert one row per aired regular episode not yet watched in the pass: origin `seen`, the press's group id, no date | `state = 'seen'`, `seen_press_group`, `seen_press_from` = the state before | Clears Want to See and Not interested | Every tick, "Seen" or "Caught up", the prompt to rate |
| Press Seen again (rows 13 to 17) | `DELETE FROM user_watch_log WHERE user_id = ? AND group_id = ?` | `state` by the row taken; press columns NULL | | The group's ticks gone, the state before |
| Put on hold, drop, resume (rows 18 to 21) | None | `state`, `state_changed_at` | Drop clears Want to See and Not interested | The status pill |
| Rate a show (row 22) | None | Unchanged. A first score by hand on a show that is Not started sets `seen_question = 'open'` (a new row if there was none) | `user_score`, as today; a score clears Not interested | The score; the question |
| Want to See (rows 23, 24) | None | Row 24 only: Dropped to Not started | `user_wishlist`; clears Not interested | The button |
| Not interested (row 25) | None | None | `user_not_interested`; clears Want to See | The button |
| Watch again (row 26) | None | `pass + 1`, `state = 'watching'`, press columns NULL | | Empty ticks, "Watching", pass 2, Next episode S1 E1 |
| "Not now" on the prompt to rate | None | `rate_prompt_dismissed_at` | | The prompt gone |
| Answer "Have you seen all of it?" | "Yes, all of it" is a Seen press | `seen_question = 'answered'` | | The question gone |
| Edit a watch's date in the log | `UPDATE user_watch_log SET watched_at = ?, watched_at_precision = ?, updated_at = ? WHERE user_id = ? AND watch_id = ?` | None | | The row of the log |
| Delete a watch in the log | `DELETE FROM user_watch_log WHERE user_id = ? AND watch_id = ?` | If it was the episode's only watch in the current pass, this is an unwatch and takes its row of the table. In any case: when no watch of a regular episode is left in any pass, Watching or Seen becomes Not started, as row 8 | | The row gone. Undo inserts the same row with the same `watch_id` |
| Movie: Seen (one tap) | Insert 1: `single`, now, `moment`, pass 1. `DELETE ... WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ? AND origin = 'score'` | Insert if there is none: `seen`, pass 1 | Clears Want to See and Not interested | The eye, the count from two on. Toast with "Change date" and Undo |
| Movie: add a watch in the log | The same with the chosen day or no date | The same | The same | The row of the log |
| Movie: rate, the movie has no log row | Insert 1: `score-<movie id>`, origin `score`, no date, pass 1 | Insert: `seen`, pass 1 | `user_score`; clears Not interested and Want to See | The score, the eye |
| Movie: rate, the movie has a log row | None | None | `user_score`; clears Not interested | The score |
| Movie: clear the score | `DELETE ... AND origin = 'score'` | Deleted if no log row is left | `user_score` | The score gone; not Seen unless a watch the member logged remains |
| Movie: edit the date of the score's watch | The update above, and `origin = 'single'` when a date is set | None | | The row of the log, now the member's own |
| Movie: delete a watch in the log | Delete 1. If none is left and the movie has a score: insert the score's watch | Deleted if no log row is left | | The row gone. Not Seen, unless the movie has a score |

A movie needs no episode list and no machine. One rule covers its rows, and every movie action above is that rule
applied after the action's own write: **the score's watch exists exactly while the movie has a score and no log row
of another origin, and the state row exists exactly while a log row does.** One function next to the writer applies
it (`settleMovie(userId, movieId)`), and every path that writes a movie's score or log calls it: the rating control,
the taste quiz, the guest transfer, an import and its undo.

What follows from the rule, beyond what the owner decided in so many words:

- Editing the date of the score's watch makes it the member's own record: its origin becomes `single`, and clearing
  the score later leaves it.
- The score's watch can't be deleted in the log, because the rule would put it back. The log shows it as "Rated,
  date unknown" with "Set a date"; it goes when the score is cleared.
- Deleting the last watch the member logged for a rated movie puts the score's watch back. The movie stays Seen, as
  a rated movie is.
- An imported watch replaces the score's watch as a watch logged here does, and undoing that import puts it back.
- A score that an import or the taste quiz writes records the score's watch too. Otherwise new scored movies without
  a watch would appear the day after the migration removed the last of them.
- Rating a movie that has no watch clears Want to See, because the score's watch is a watch and a Seen movie is not
  on the Wishlist. Today rating leaves the Wishlist alone.

### The browser

- **On the show page** the browser holds the state row, the log rows and the episode list. It runs the same machine
  function on them, with "aired" by the device's date (section 3), shows the result, and sends the event with the
  ids it made. The response's row replaces the guess. On an error it puts back the snapshot of that one show and
  says so. Actions on one show are sent one after the other, never in parallel.
- **Everywhere else** (home's Continue door, a movie's eye on a card) the browser has the map only. It updates
  `watchState[key]` with what it expects (the state, `watchedAt`, `count`, and for a tick `episodesWatched` and
  `furthest`), and the refetched member data replaces it.
- **Undo after a first tick** has to bring Want to See back with its place in the list. The response carries what the
  event cleared (the Want to See row's added-at time, and whether Not interested was set), as `finishTitle` does
  today, and Undo sends it back.

## 5. Walking the machine

### Every row of the table

L is the member's `user_watch_log` rows for the show, S their `user_watch_state` row. S holds no count, so a row
below names only the columns that change. Rows 10b and 27b exist only under options the owner did not choose.

| Row | Event, from | L | S before → after | Other tables |
| --- | --- | --- | --- | --- |
| 1 | Watch a special, any state | +1 (`season_number = 0`) | Unchanged. No row stays no row | None |
| 2 | Watch, that was the last aired episode; from Not started, Watching, On hold, Dropped | +1 | `state` → `seen` (a new row from Not started). `seen_press_*` stay NULL. `seen_question` open → answered | Want to See and Not interested deleted |
| 3 | Watch, more are left; same states | +1 | `state` → `watching` (a new row from Not started). `seen_question` open → answered | The same |
| 4 | Watch, all new ones are now watched; from Seen | +1 | Stays `seen`; a standing press stays | The same |
| 5 | Watch, some new ones are left; from Seen | +1 | `seen` → `watching`; `seen_press_*` → NULL | The same |
| 6 | Unwatch a special | − the special's rows of the pass | Unchanged | None |
| 7 | Unwatch, a watch remains; from Watching, Seen | − the episode's rows of the pass | → `watching`; from Seen `seen_press_*` → NULL | None |
| 8 | Unwatch, no watch remains; from Watching, Seen | The same | → `not_started`, `seen_press_*` → NULL; then deleted unless a prompt column is set | None |
| 9 | Unwatch, a watch remains; from On hold, Dropped | The same | Unchanged | None |
| 10 | Unwatch, no watch remains; from On hold, Dropped | The same | Unchanged: On hold or Dropped with no log row | None |
| 11 | Press Seen; from Not started, Watching, On hold, Dropped | +N, origin `seen`, group G, no date (N is 0 for a show without an episode list) | → `seen`, `seen_press_group = G`, `seen_press_from` = the state before. `seen_question` open → answered | Want to See and Not interested deleted |
| 12 | Press Seen on a Seen show with new episodes | +N, group G2 | Stays `seen`. `seen_press_group = G2`, `seen_press_from = 'seen'`. The earlier group's rows stay and can no longer be taken back together | The same |
| 13 | Press Seen again, the press was made on a Seen show | − group | Stays `seen`, `seen_press_*` → NULL. The episodes read as new again, because they are no longer in L | None |
| 15 | Press Seen again, the press was made on an On hold show | − group | → `on_hold`, `seen_press_*` → NULL | None |
| 16 | Press Seen again, the press was made on a Dropped show | − group | → `dropped`, `seen_press_*` → NULL | None |
| 14 | Press Seen again, a watch remains | − group | → `watching`, `seen_press_*` → NULL | None |
| 17 | Press Seen again, no watch remains | − group | → `not_started`, then deleted unless a prompt column is set | None |
| 18 | Put on hold; from Watching | None | `watching` → `on_hold` | None |
| 19 | Drop; from Not started (an import), Watching, On hold | None | → `dropped` (a new row from Not started) | Want to See and Not interested deleted |
| 20 | Resume, a watch remains | None | → `watching` | None |
| 21 | Resume, no watch remains | None | → `not_started`, then deleted unless a prompt column is set | None |
| 22 | Rate, any state | None | Unchanged. By hand, on a show without a row or Not started, never asked: `seen_question = 'open'` | `user_score`; a score deletes Not interested |
| 23 | Want to See; from Not started | None | None | `user_wishlist` row added or deleted; Not interested deleted |
| 24 | Want to See on a Dropped show with nothing watched | None | `dropped` → `not_started`, then deleted unless a prompt column is set | `user_wishlist` row added |
| 25 | Not interested; from Not started | None | None | `user_not_interested` row added or deleted; Want to See deleted |
| 26 | Watch again; from Seen, a regular episode is watched | None | `pass + 1`, → `watching`, `seen_press_*` → NULL. Progress reads 0 because no row of L is in the new pass | None |
| 27 | The catalog changes | None | None. No job, no write | None |

The two answers to a prompt are not rows of the table: "Not now" sets `rate_prompt_dismissed_at`; "I'm partway" and
"Just rating" set `seen_question = 'answered'`. Row 22 is the machine's row for a show; a movie's score is in the
per-action table of section 4.

### Every preset

Final rows after all steps of each preset in
[`presets.ts`](../../../goodwatch-webapp/app/domain/prototype-tracking-machine/presets.ts), run with the owner's
decisions (so with Watch again built). "Computed" is what the grouped query returns for the current pass.

| Preset | S: state, pass | Seen press | Prompts | L | Computed: rows, episodes, furthest | Reads as |
| --- | --- | --- | --- | --- | --- | --- |
| `through-ended` | seen, 1 | | | 6 `single` | 6, 6, S2 E3 | Seen, 6 of 6 |
| `caught-up-airs` | watching, 1 | | | 7 `single` | 7, 7, S2 E4 | Watching, 7 of 10, next S3 E1 |
| `seen-twice` | watching, 1 | NULL again | | 2 `single`; the press's 4 are deleted | 2, 2, S1 E2 | Watching, 2 of 6, next S1 E3 |
| `on-hold` | watching, 1 | | | 3 `single` | 3, 3, S1 E3 | Watching, 3 of 5, next S2 E1 |
| `dropped-want` | watching, 1 | | | 1 `single` | 1, 1, S1 E1 | Watching, 1 of 6, next S1 E2. The Want to See row is gone |
| `rate-never-started` | not_started, 1 | | `seen_question = 'open'` | None. `user_score` holds 8 | No group | Not started, counts as Seen for filters, the question is shown |
| `rewatch` | watching, 2 | NULL (left Seen) | | 6 `seen` in pass 1, 2 `single` in pass 2 | 8 in both passes; pass 2: 2, S1 E2 | Watching, pass 2, 2 of 6, next S1 E3 |
| `readded` | watching, 1 | | | 3 `single`; one carries an episode id TMDB no longer lists and counts by season and number | 3, 3, S1 E3 | Watching, 3 of 5, next S2 E1 |
| `no-list` | seen, 1 | group of the second press, from `not_started` | | None | No group | Seen, 0 of 0. No Want to See row |
| `rate-prompt` | watching, 1 | | Not dismissed | 3 `single` | 3, 3, S1 E3 | Watching, 3 of 5, next S1 E4, the prompt to rate is due |
| `special` | watching, 1 | | | 1 `single`; the special's row is deleted again | 1, 1, S1 E1 | Watching, 1 of 5, next S1 E2 |
| `unwatch-on-hold` | No row | | | None | No group | Not started |
| `seen-new-episodes` | seen, 1 | group of the press, from `not_started` | | 5 `seen` | 5, 5, S2 E2 | Caught up · 4 new, 5 of 9, next S2 E3 |

### How this was checked

By a test that is committed beside the machine:
[`storage.test.ts`](../../../goodwatch-webapp/app/domain/prototype-tracking-machine/storage.test.ts), run with
`node --test 'app/domain/prototype-tracking-machine/*.test.ts'` from `goodwatch-webapp` (about three seconds). It is
throwaway like the machine's prototype and goes when the machine moves to `domain/` with tests of its own. The
script that checked the first proposal was never committed; this one replaces it and checks the model without
overlap.

It keeps two sides. One is the machine's own record. The other is only what this model stores: one state row, the
log rows, and the three flags of the other tables. The stored side never sees the machine's record: for each action
it rebuilds a member from its rows, runs the machine's step, and writes rows back. After every action:

- The record rebuilt from the rows equals the machine's record, field by field, so the next step is the same on both
  sides.
- Every value a list shows is computed from the grouped query (emulated over the rows as written in section 3), the
  state row, the score and the catalog, by code that does not call the machine: state, label, pass, progress, new
  episodes, the Next episode, "a watch remains", counts as Seen, both hidden rules, what is offered, the question,
  and what the Seen button does. Each equals `derive()`.
- The prompt to rate, computed from the show's log rows, equals `derive()`.
- What the action wrote to the log has the shape the per-action table gives: one `single` row for a tick; the
  episode's rows of the pass for an untick; rows of one group and origin for a press or a group mark; exactly the
  rows with the press's `group_id` for Seen pressed again; nothing for every other action.
- Invariants 1, 2 and 5 to 7 below hold.

What ran:

- All 13 presets, after each of their 55 steps.
- 3,000 seeded walks of 50 random actions over the four sample shows: 150,000 actions, 15,083 of them catalog
  events, 4,417 group marks (Mark season and "Watched up to here", each also replayed in reverse order with the same
  result), 3,535 deletions of a single watch in the log. Every row of the table was used (1 to 27).
- 3,000 seeded walks of 40 actions on a movie (120,000 steps): rate, clear the score, Seen, add a watch, delete a
  watch, edit a date, import a watch, undo an import. After each: the score's watch exists exactly while the movie
  has a score and no other watch, the count is the member's own watches or 1 for a score alone, and the state row
  exists exactly while a log row does. The score's watch stood alone after 7,759 steps and was taken over by a date
  595 times.
- 5,000 random sets of dated, day-precise and undated rows: the precision from the two maxima, and `lastActivityAt`,
  equal the definition.

What it found:

- Nothing in the decided model failed. Each check was confirmed to bite by breaking the model on purpose: without
  the Watch-again guard the walks reach Watching with no watch at once; grouping without the pass, counting specials,
  leaving out the gap read, not storing where the press was made, deleting a row that remembers a prompt, and not
  putting the score's watch back each fail within the first walks.
- The Next episode was read 78,487 times, and 29,869 times it needed the show's log rows because the member had a
  gap. Random walks tick in random order; a member who watches in order has no gap.
- The prompt to rate can't be read from groups per pass. The sum of the passes' episode counts was on the wrong side
  of the threshold in 14 of 149,081 comparisons (the same episode in two passes). That is why section 3 computes it
  on the show page only.
- Not started with a pass above 1 is reachable only by deleting every watch of the earlier passes in the log, one by
  one, after Watch again. No walk got there; a directed test does. The row is kept, because the pass is something
  the log can no longer say.

What it does not cover: dates and time zones (the machine's catalog says "aired" as a fact, so C4 and the fill of C5
are not walked), imports of shows, and anything that needs Crate.

### What the machine and the screens did not settle

Decided with the review, or found while mapping. The first three change or add to the machine.

1. **Watch again needs a watched regular episode.** A show without an episode list can be made Seen by a press, and
   Watch again would then give Watching in pass 2 with no watch in any pass, which the machine's own test rules out
   for Watching. The guard is on row 26.
2. **Marking a season and "Watched up to here"** are on the chosen screen and not in the machine. A group mark is
   that many watch events: the writer steps the machine once per episode in memory and writes the rows as one insert
   with one group id. The result does not depend on the order. One consequence: on a Seen show with a standing
   press, a group of two or more regular episodes ends the press (the first tick leaves Seen by row 5, the last
   returns by row 2).
3. **A show marked Seen without an episode list** (C5) gets its press's group filled when the list exists. The job
   is in section 6.
4. **The counter of presses** existed to name groups. The browser's id replaces it.
5. **The Next episode is computed.** The furthest watched episode of the pass comes from the grouped query and is
   exact unless the member has a gap behind them; then the show's log rows are read.
6. **The question after a score** is opened by a rating made by hand. An import's ratings do not open it: 1,000
   imported show ratings would be 1,000 open questions.
7. **Undo after the first tick** needs the Want to See row's added-at time, which the machine does not hold. The
   writer returns it.
8. **A movie has a state column.** It holds `seen` or the row does not exist. It is a storage convenience and no
   change to the rule that movies have no status.
9. **Deleting a watch in the log** is not a machine event either. It is an unwatch when it removes the episode's
   last watch of the current pass, and in every case a Watching or Seen show with no watch of a regular episode left
   becomes Not started.

### Invariants and the check

With nothing stored twice, no invariant compares a stored count or date with the log. What is left relates the state
to the log rows.

1. For a show: Not started ⇒ no log row of a regular episode. Watching ⇒ at least one, in any pass. So a show with a
   log row of a regular episode has a row whose state is not Not started.
2. A Seen press stands only on a Seen show: `seen_press_group` and `seen_press_from` are both set or both NULL, and
   set only with `state = 'seen'`.
3. A movie has a row exactly while it has a log row, and the row has `state = 'seen'` and `pass = 1`.
4. The score's watch: only on a movie, at most one per movie, and exactly while the movie has a score and no log row
   of another origin. So every scored movie has a log row.
5. Any state but Not started ⇒ no Want to See row and no Not interested row for the title.
6. A log row is well formed: `watched_at_precision = 'unknown'` exactly when `watched_at` is NULL; a group origin has
   a `group_id` and an import has an `import_id`; a movie watch has no episode columns and pass 1; the score's watch
   has no date; no watch is in a pass beyond the row's (beyond 1 for a show without a row).
7. A show's row with state Not started remembers something: a prompt column is set, or the pass is above 1.
8. Seen does **not** imply that everything aired is watched: new episodes, a press taken back from a Seen show, and
   a show without an episode list are all Seen with less.

The check, per member (each statement names the member, so it is one shard). Every statement must return no row.

```sql
-- Invariants 1, 3, 4 and the pass of 6: every state row against its log rows.
SELECT s.tmdb_id, s.media_type, s.state, s.pass, w.n, w.regular, w.by_score, w.top_pass
FROM user_watch_state s
LEFT JOIN (
    SELECT tmdb_id, media_type, count(*) AS n,
           count(*) FILTER (WHERE season_number > 0) AS regular,
           count(*) FILTER (WHERE origin = 'score') AS by_score,
           max(pass) AS top_pass
    FROM user_watch_log WHERE user_id = ? GROUP BY tmdb_id, media_type
) w ON w.tmdb_id = s.tmdb_id AND w.media_type = s.media_type
WHERE s.user_id = ?
  AND ((s.media_type = 'show' AND s.state = 'not_started' AND coalesce(w.regular, 0) > 0)
       OR (s.media_type = 'show' AND s.state = 'watching' AND coalesce(w.regular, 0) = 0)
       OR (s.media_type = 'movie' AND (s.state <> 'seen' OR s.pass <> 1 OR coalesce(w.n, 0) = 0))
       OR coalesce(w.top_pass, 1) > s.pass
       OR (coalesce(w.by_score, 0) > 0 AND (s.media_type = 'show' OR w.n > 1)))
LIMIT 100;

-- Invariants 1 and 3, the other way: log rows that need a state row and have none.
SELECT w.tmdb_id, w.media_type, count(*) AS n
FROM user_watch_log w
LEFT JOIN user_watch_state s ON s.user_id = w.user_id AND s.tmdb_id = w.tmdb_id AND s.media_type = w.media_type
WHERE w.user_id = ? AND s.user_id IS NULL
  AND (w.media_type = 'movie' OR w.season_number > 0 OR w.pass > 1)
GROUP BY w.tmdb_id, w.media_type
LIMIT 100;

-- Invariant 2, and invariant 7.
SELECT tmdb_id, media_type, state, pass, seen_press_group, seen_press_from
FROM user_watch_state
WHERE user_id = ?
  AND ((seen_press_group IS NULL) <> (seen_press_from IS NULL)
       OR (seen_press_group IS NOT NULL AND state <> 'seen')
       OR (state = 'not_started' AND pass = 1 AND rate_prompt_dismissed_at IS NULL AND seen_question IS NULL))
LIMIT 100;

-- Invariant 4: a score's watch without a score, and a scored movie without a log row.
SELECT w.tmdb_id
FROM user_watch_log w
LEFT JOIN user_score c ON c.user_id = w.user_id AND c.tmdb_id = w.tmdb_id AND c.media_type = w.media_type
WHERE w.user_id = ? AND w.origin = 'score' AND c.user_id IS NULL
LIMIT 100;

SELECT c.tmdb_id
FROM user_score c
LEFT JOIN user_watch_state s ON s.user_id = c.user_id AND s.tmdb_id = c.tmdb_id AND s.media_type = c.media_type
WHERE c.user_id = ? AND c.media_type = 'movie' AND s.user_id IS NULL
LIMIT 100;

-- Invariant 5.
SELECT s.tmdb_id, s.media_type, s.state
FROM user_watch_state s
JOIN user_wishlist x ON x.user_id = s.user_id AND x.tmdb_id = s.tmdb_id AND x.media_type = s.media_type
WHERE s.user_id = ? AND s.state <> 'not_started'
LIMIT 100;
-- and the same with user_not_interested.

-- Invariant 6.
SELECT watch_id
FROM user_watch_log
WHERE user_id = ?
  AND ((watched_at_precision = 'unknown') <> (watched_at IS NULL)
       OR (origin IN ('seen', 'season', 'upto')) <> (group_id IS NOT NULL)
       OR (origin = 'import') <> (import_id IS NOT NULL)
       OR (origin = 'score' AND (watched_at IS NOT NULL OR media_type <> 'movie'))
       OR (media_type = 'movie' AND (season_number IS NOT NULL OR pass <> 1))
       OR (media_type = 'show' AND season_number IS NULL))
LIMIT 100;
```

There is no statement for a stale count, because there is no count. A list whose progress exceeds
`show.aired_episode_count` is the catalog case of section 3 and is capped when shown.

A repair changes only the state side and only where an invariant is broken; it never moves a state that the machine
allows:

- A show with regular log rows and no state, or Not started: Watching, or Seen when every aired regular episode is
  watched in the current pass.
- Watching with no regular log row: Not started.
- Half a press: both columns NULL.
- A movie: the rule of section 4 (`settleMovie`), which adds or removes the score's watch and the row.
- An empty Not started row: deleted.

## 6. Migration

### What is there

Counted on production on October 7, 2026, with read-only statements, for the proposal. Nothing was read again for
this rewrite.

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

Not counted: how many of the members with a scored title and no row are among the 212, and how many Want to See rows
exist for titles that become Seen. The dry run prints both.

### What each row becomes

| Today | `user_watch_log` | `user_watch_state` |
| --- | --- | --- |
| A movie row | One row: `watch_id = 'mig-movie-<tmdb_id>'`, `watched_at = first_watched_at`, `moment`, origin `single`, pass 1, `created_at` from the old row | `seen`, pass 1, `state_changed_at = first_watched_at` |
| A show row, the show has an episode list | One row per regular episode that is not removed and whose air date is on or before the UTC day of `first_watched_at`: `watch_id = 'g-mig-seen-<show id>-<episode id>'`, no date, origin `seen`, `group_id = 'mig-seen-<show id>'`, pass 1, `created_at = first_watched_at` | `seen`, pass 1, `state_changed_at = first_watched_at`, `seen_press_group = 'mig-seen-<show id>'`, `seen_press_from = 'not_started'` |
| A show row, no episode list (or not crawled yet) | None | The same row. The fill step below adds the group's rows when a list exists (C5) |
| A movie with a score and no row | One row: `watch_id = 'score-<tmdb_id>'`, no date, origin `score`, pass 1, `created_at` = the score's `updated_at` | `seen`, pass 1, `state_changed_at` = the score's `updated_at` |
| A show with a score and no row | None | None. The score alone keeps counting as Seen for filters |

The Seen press of a migrated show stands, so one press takes the whole mark back, which is what the button does to
such a row today. A show that went on after the member marked it reads "Caught up · N new" or "Seen · N new
episodes" from the first day; the owner accepted that with M6. `created_at` of the group's rows is the time of the
old mark and not the time of the migration, so the migration is no activity in the sense of C3.

`watched_at_list` holds nothing the first time doesn't. `ingest_source` is dropped: every row was made here
(the NULL ones were copied from the Postgres tables of the time before Crate). `season_number`, `episode_number` and
`progress_*` were never written and go with the table. Many of today's rows were made by the rating control and not
by the Seen button; they can't be told apart, and they become watches at the time of the rating.

Expected size: 4,043 movie watches, 2,276 score's watches, and at most about 259,000 episode watches, fewer by the
unaired and later-aired episodes. 8,161 state rows: 6,319 movies and 1,842 shows.

### How it runs

Built as the Windmill script `f/sync/tracking/migrate_watch_history` in `goodwatch-flows`, and not as the local
script this section first named, because the operator runs Windmill scripts against production and not local
Python. It is a dry run unless `dry_run` is `false`, takes `user_id` for one member, and inserts 500 rows per
request. The commands, the expected counts, the undo and what "crawl complete" means are in
[migration.md](migration.md); the list below is the order.

1. The episode catalog is live and has crawled the shows (its own ticket). Without it only the movie steps can run.
2. `f/sync/init/cratedb` with `dry_run: true` must report exactly: two `CREATE TABLE`, the new `user_import_item`
   columns, and `show.aired_episode_count`. Then without it.
3. Run the script. It reads `user_watch_history` and `user_score` and writes the two new tables. It never writes or
   deletes in `user_watch_history`, `user_score` or `user_wishlist`.
4. **Time the grouped query** for the largest member, as section 3 says, and decide before any list is built.
5. Deploy the webapp that reads and writes the new tables.
6. Run the script again, with `since` set to the start of the run of step 3. It picks up what the old build wrote
   to the old table between steps 3 and 5. Without `since` it would plan every old row again and bring back a title
   a member has taken back in the new build, because the old row is still there.
7. 30 days after the switch, without a rollback: drop `user_watch_history` by hand, remove it from
   `crate_schemas.py`. Until then the table is the backup and nothing reads or writes it.

Steps 5 to 7 in detail, what the second run has to do for movies, and what happens to a watch made while both builds
answer: [switch-to-the-watch-state.md](switch-to-the-watch-state.md). As built, the webapp of step 5 no longer
refreshes the old table, and the prototype readers read `user_watch_state`.

**Idempotent.** Every `watch_id` is fixed by the member, the title and the episode, and every insert is `ON CONFLICT
DO NOTHING`, into `user_watch_state` too, so a row the new webapp has written since is never overwritten. A run that
stopped is started again. The score step inserts only for a movie that has no log row at that moment. A movie
that got its score's watch in step 3 and a watch row in the old table afterwards gets the dated watch in step 6, and
the score's watch is deleted then, as the rule of section 4 says. A show's episode watches are written only while
its state row is Seen with the press standing, so a show whose state the new build has changed gets none. What
step 6 can't see is a mark removed in the old table between steps 3 and 5; those minutes are accepted.

**Want to See on Seen titles.** Invariant 5 says a Seen title has no Want to See row. Today nothing clears the
Wishlist when a title is rated or marked watched outside "I watched it", so such rows exist; they were not counted.
The script leaves `user_wishlist` alone and the dry run prints the count. Whether they are deleted then, or My movies
hides Seen movies until the member's next action clears each, is the owner's call with the number in hand.

**The fill job** (C5) is the show step run again, alone (the Windmill script `f/sync/tracking/fill_seen_groups`;
the migration fills its shows through the same code), first by hand after the first crawl and then as a small
scheduled job. A show has an episode list once the copy has marked it (`show.episodes_updated_at` is set). It looks for a `user_watch_state` row with `state = 'seen'`, `seen_press_group` set,
`seen_press_from` not `'seen'`, and no log row with that `group_id`. For each, when the show's episode list now has
regular episodes that aired on or before the UTC day of `state_changed_at` (the day of the press) and are not
watched in the current pass, it inserts them: no date, origin `seen`, the row's own `seen_press_group`, the row's
pass, `watch_id = 'g-<group>-<episode id>'`, `created_at = state_changed_at`. It writes nothing to the state row.
It serves the shows the catalog had not reached at migration time, any show marked Seen before it had a list, and a
Seen-again that stopped half way (section 4). A press made when every aired episode was already watched has the
same signature and nothing to fill. This is the one job that writes a member's log without the member acting, and it
never changes a state.

**Verify.**

```sql
SELECT media_type, count(*) FROM user_watch_state GROUP BY media_type;     -- movie 6,319 and show 1,842, plus new ones
SELECT origin, count(*) FROM user_watch_log WHERE media_type = 'movie' GROUP BY origin;  -- single 4,043, score 2,276
SELECT count(DISTINCT user_id) FROM user_watch_state;                      -- at least 212, plus new ones
SELECT count(*) FROM user_watch_state s                                    -- shows still to fill
WHERE s.media_type = 'show' AND s.seen_press_group LIKE 'mig-seen-%'
  AND NOT EXISTS (SELECT 1 FROM user_watch_log w WHERE w.user_id = s.user_id AND w.group_id = s.seen_press_group);
```

The script's `verify` mode checks the same and more without these statements, for every member
([migration.md](migration.md)). Then the consistency check of section 5 for the five largest members, and by eye: the largest member's Seen list
before and after, one long show, one show without a list, one rated movie that had no watch.

## 7. Imports

Today's import writes scores only ([import sources](../../research/import-sources-inventory.md)). With these tables
a source's watches, statuses and Want to See have a place.

**What an import writes.**

- **Watches:** `user_watch_log` rows with origin `import`, the import's id, the source's date at the source's
  precision (Trakt a moment, Letterboxd a day, IMDb's and Letterboxd's undated "watched" unknown), and the source's
  pass number when it has one (Simkl, Trakt), else 1. Never the time of the import as a date.
- **The state**, one show at a time, **in this order** (C6):
  1. All of the show's watches from the file are inserted at once. If the show had no row before the import, or its
     state is Not started or Watching, they are replayed as one group mark (section 5, point 2) and the state moves
     by rows 2 and 3: to Watching, or to Seen when every aired episode is then watched. If the show is On hold,
     Dropped or Seen here, the rows are inserted and the state row is not touched: what the member decided here is
     newer than what the file says. The counts follow by themselves, because they are computed.
  2. Then the source's status, only if the show had no row here before this import: dropped is row 19 (allowed with
     nothing watched), completed is row 11 with the import as the origin of its watches and no standing press (it is
     taken back by undoing the import, not by the button), on hold is row 18 and so needs a watch, plan to watch is
     Want to See if nothing was watched. A status that can't be applied is reported in the preview with its reason.
  3. Scores last. They never change a show's state and do not open "Have you seen all of it?". A movie's score
     settles the movie by the rule of section 4: the score's watch is written only if the file brought no watch.
- **The pass.** A show without a row gets the source's highest pass as its current pass. On a show that has a row,
  an imported watch with a pass above the row's is stored in the row's pass: the row's pass is the member's, and no
  log row may lie beyond it (invariant 6). This is a consequence of C6 that the review did not spell out.
- **Movies:** a log row and the `seen` row; Want to See is cleared as for a watch made here. An imported watch
  replaces the score's watch.
- **The 30 days** (C3): an import counts only through its dates. A watch with a date counts with its date, an
  undated imported watch not at all, and the time of the import never. The grouped query's `last_activity_at` does
  this by itself.

**Duplicates,** decided in the preview and shown there before anything is written:

- The same file again: the same `watch_id`, nothing written.
- A watch the member already has for the title or episode, from any origin but `score`: the same minute when both
  have a time; the same calendar day when either is day-precise; any existing watch in the same pass when the
  imported one has no date. The item is recorded as already there and writes nothing.
- Several watches of one title on one day inside one file are kept: the file's count for that day against the
  member's count, and only the difference is added.

**The import tables,** without a rewrite: `user_import` is unchanged. Each row of a file is still one
`user_import_item`; `kind` says what it is, the new columns hold a watch's episode, date, precision and pass or a
status, and `watch_id` names the row it wrote. `outcome` and `apply_state` keep their values (`added`, `kept`,
`failed`, `undone`). The apply adds one item of kind `state` per show whose state it set, with `prior_state` and
`applied_state`: the pattern `prior_score` and `applied_score` already use for ratings.

**Undo** removes only the import's own rows and leaves later edits alone:

1. `DELETE FROM user_watch_log WHERE user_id = ? AND import_id = ?`. One statement, one shard.
2. For every show with a `state` item: if the row's state is still the `applied_state`, restore `prior_state`. Then
   invariant 1 for every show in the import's items: Watching or Seen with no regular watch left becomes Not
   started. A state the member chose since the import stays. No count is recomputed, because none is stored.
3. Scores as today, then every movie in the import's items is settled by the rule of section 4. Items become
   `undone`.

A watch the member edited in the log after the import still carries the import's id and goes with the undo; the undo
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
DELETE FROM user_watch_log WHERE user_id = ?;
DELETE FROM user_watch_state WHERE user_id = ?;
DELETE FROM user_watch_history WHERE user_id = ?;   -- until the table is dropped
DELETE FROM user_import_item WHERE user_id = ?;
DELETE FROM user_import WHERE user_id = ?;
```

then `resetUserDataCache`. The first two are routed to one shard. These are hard deletes: the rows are private,
nothing public points at them, and unlike a handle nothing has to stay reserved. The same flow has to cover
`user_score`, `user_wishlist`, `user_favorite`, `user_skipped`, `user_not_interested` and `user_setting`, which have
no deletion today either. While `user_watch_history` exists as the backup, a deleted member's rows are deleted there
too.

Two other places list the user tables by name and must learn the new ones:

- `goodwatch-flows/scripts/provider_alias_resolution.py:23` (`USER_TABLES`), which moves members' rows when a
  duplicate title is retired. A log row's title is not in its key, so moving it is an update.
- `canonicalTitleId` (`utils/title-identity.ts`), which the tracking writer calls on the title id as every other
  writer does.

**Export.** There is none today. When it is built, the tracking part is two files: every `user_watch_log` row
(title, season and episode, date, precision, origin, pass) and every `user_watch_state` row with a state. Both are
one routed read per member. The columns of the first match Letterboxd's and Trakt's exports closely enough to be
imported elsewhere.

## 9. What this does not cover, and open risks

**Not covered.**

- The importer for each source, the preview's screens, and sources that number episodes differently from TMDB.
- How "N new episodes", the prompt to rate and the score's watch in the log look.
- Guests: tracking is for members. Guest progress keeps its own store in the browser.
- Loading the member data map in parts ([the design](../../research/user-data-loading-design.md)). This model keeps
  the map whole and makes its watched entries two to three times as long; the per-title key and the routed reads are
  what a scoped read would use.
- Ratings for episodes and seasons, a release calendar, showing anything to other people.
- The build tickets. One slice each: the helper and the two tables with the movie watch log and the score's watch;
  the migration and the timing of the grouped query; the machine in `domain/` with the writer and the show page; My
  shows, home and the library; the fill job; imports.

**Not verified.** Production was read for the proposal and never written, and not read again for this rewrite, so
nothing that needs a table was tried.

| Risk | Why it matters | How to settle it |
| --- | --- | --- |
| The speed of the grouped query for a member with 32,700 log rows | Every list reads its result, on every cache miss | Section 3: time it once the migrated data is in, before the lists are built. Slow is a median above 100 ms or a run above 250 ms. Then recompute per title, then summary columns |
| `count(DISTINCT <expression>)` with `FILTER`, and `max` over a `CASE` | The grouped query as written | Run it once on a local Crate 5.10. The fallback is an `episode_key` column the writer fills |
| `_seq_no` and `_primary_term` in an `UPDATE` and a `DELETE` by the whole key | It is what keeps two actions on one show from overwriting each other's state | First build ticket, against a local Crate 5.10. The fallback is a `revision` column compared after a refresh |
| `NOT NULL` and `CHECK` together on one column, as written above | The definitions may need the `CHECK` moved | `init/cratedb` with `dry_run`, then on a local Crate |
| `count(*) FILTER (WHERE ...)`, the joins of the consistency check, and `NOT EXISTS` in the verify statement | The check as written | Run it once on a local Crate |
| One insert of 500 rows of 15 values | Proven by the import with 500 rows of 15 values; not with this table | The migration's dry run on one member |
| How long `REFRESH TABLE user_watch_log` takes once the table has 266,000 rows | Every action runs it once before reading. The import does the same on a small table today | Measure after the migration. If it costs more than a few milliseconds, the writer reads by the watch ids it expects instead |
| The size of the member data map | Estimated from one measured map and sample entries | Measure with the migrated data for the largest member; shorten the keys if it matters |
| A list's count after TMDB removes or renumbers a watched episode | The list's progress is one too high until the show is opened | Accepted: nothing is stored wrong. The lists cap at the aired count |
| The hours in which the device's date and the UTC date differ | A list and the show page can disagree about one episode | Accepted with C4; section 3 says what is seen |
| Ordering by a nullable timestamp with a continuation (Q7) | The diary's steps | Null ordering was checked with literal values only |
| `show.aired_episode_count` being a day late | A new episode reads as new up to a day after it airs | Accept, or have the copy visit airing shows twice a day |
| Want to See rows on titles that become Seen | Invariant 5 lists them from the first day | The dry run counts them; the owner decides |
| Array and object columns | None are used, on purpose: an undated watch has no place in a list of times, and a row per watch needs no list | |

**Read from production for the proposal** (all `SELECT`, each aggregated or limited, each answered in under 0.3
seconds, none abandoned): the counts in section 6; table settings from `information_schema` and `sys`; null ordering
and `unnest` with literal values. Two of them joined `user_watch_history` to another table: scores without a watch
row and listed episodes per member were counted member by member, each statement filtered by `user_id`; and the
status and episode totals of the 650 marked shows were read once with a subquery over `user_watch_history` without
a member filter (0.1 seconds).

## 10. Built

[#380](https://github.com/alp82/goodwatch-monorepo/issues/380) built the storage and the writer.
[#382](https://github.com/alp82/goodwatch-monorepo/issues/382) switched every reader and writer of Seen to them; its
part is [further down](#the-readers-of-seen-382).

### The storage and the writer (#380)

| What | Where |
| --- | --- |
| The two tables | `goodwatch-flows/windmill/f/sync/models/crate_schemas.py` |
| The state machine: the table, `step`, `derive`, the aired rule (`serverShow`, `showAiredBy`) | `domain/tracking/machine.ts` |
| Rows to the machine's record and back, the movie rule, the grouped query's rows to `watchState` | `domain/tracking/storage.ts` |
| The writer `applyTrackingEvent`, `settleMovie`, and the reads | `server/tracking.server.ts`, statements in `server/tracking-sql.ts` |
| `insertRows` | `utils/crate.ts` |
| Timing the grouped query | `goodwatch-webapp/scripts/measure-watch-groups.mjs` |
| The migration, its verification and the fill job ([#381](https://github.com/alp82/goodwatch-monorepo/issues/381)) | `goodwatch-flows/windmill/f/sync/tracking/`; how to run them: [migration.md](migration.md) |

Tests: `node --test 'app/domain/tracking/*.test.ts' app/server/tracking.test.ts app/utils/crate-insert-rows.test.ts`
from `goodwatch-webapp`. The server tests run against an in-memory Crate (`server/tracking-fake-crate.ts`); nothing
here has run against a real one, so the "Not verified" table of section 9 still stands.

Where the build differs from the text above, or settles what it left open:

- `wantToSee` and `notInterested` say which way (`on`), because a request that is sent again must not toggle back.
- The writer deletes from `user_wishlist` and `user_not_interested` and never adds to them or writes `user_score`.
  Those writes stay with `updateWishList`, the Not interested writer and `updateScores` until they are switched over.
- The server runs the machine in a mode for requests that are sent again (`resend`): watches that carry the action's
  id are left out before the event is applied, and a deletion whose rows are already gone still takes its row of the
  table. One case stays behind: a single watch or a group deleted in the log from a Seen show, stopped before the
  state row, leaves Seen, which the machine allows.
- When the state row was changed in between, the next round first deletes the log rows the round before inserted.
- `resetUserDataCache` did not list the two tables, and the writer refreshed them itself. #382 moved the refresh
  into `resetUserDataCache`.
- Rating a movie takes it off the Wishlist whenever the score's watch is its only watch, also on a later rating.
- The episode list is cached for 10 minutes per show (`tracking-episode-list-v1`).
- The prototype under `domain/prototype-tracking-machine/` keeps its own copy of the machine.

Where the migration differs from section 6, or settles what it left open:

- A migrated row's `updated_at` is its `created_at`, not the time of the run. A movie row without a `created_at`
  takes `first_watched_at`. An old row or a score without any time is left out and reported.
- The fill job fills a group only while it has no watch at all, as section 6 says. A group that was written from an
  incomplete episode list is therefore not completed by it; the verification lists it.
- Want to See rows on titles that become Seen are counted by the dry run and left alone.

### The readers of Seen (#382)

Nothing in the webapp reads or writes `user_watch_history` any more. How this goes live, and what a member can lose
between the migration and the deploy: [switch-to-the-watch-state.md](switch-to-the-watch-state.md).

| What | Where |
| --- | --- |
| The member data entry `watchState`, read with QS and QG; the refresh of the two tables | `server/userData.server.ts` |
| `isSeen`, `seenKeys`, the key of a query that depends on the watch state | `types/user-data.ts` |
| The viewer context: `seen`, and `hidden` for Not interested and Dropped | `server/viewer.server.ts` (`seenAndHidden`) |
| The readers with their own SQL | `server/utils/recommend.ts`, `server/smart-titles.server.ts`, `server/discover.server.ts` (`watchedTypeJoin`) |
| Today's Seen button and "I watched it" | `server/watchHistory.server.ts` (`markSeen`, `unmarkSeen`), `server/finish-title.server.ts` |
| A score tells tracking | `server/scores.server.ts`, `routes/api.import-guest-interactions.ts`, `server/imdb-import/apply.server.ts` |
| The movie rule for many movies | `settleMovies` in `server/tracking.server.ts` |
| What the browser shows before the server answers | `domain/member-data-updates.ts`, used by `hooks/useUserDataMutations.ts` |
| The Seen button in the browser | `hooks/useSeenToggle.ts`, `hooks/useUserDataAccessors.ts` (`useWatchState`, `useIsSeen`) |
| Deleting a member's tracking data | `deleteTrackingData` in `server/tracking.server.ts`, called by `server/account-deletion.server.ts` |

Tests: `node --test app/server/watch-state.test.ts app/domain/member-data-updates.test.ts app/server/userData.test.ts`.

Where the build differs from the text above, or settles what it left open:

- **The Seen button is still one button that toggles.** The watch log and the episode list replace it later. Until
  then: a movie's press records one watch dated now, and one more press deletes every watch the member logged for
  it. A show's press is the Seen press, and one more press takes that press back; a show that is Seen with no
  standing press has nothing to take back, which no action in the interface produces yet. A second "mark" on a
  title that is Seen writes nothing.
- **The button shows the state Seen, not "counts as Seen".** A rated show that was never marked counts as Seen for
  the filters and through `isSeen`, and its button is off, because a press there has to mark it. Until now rating a
  show lit the button, since the rating recorded a watch.
- **A rated movie can't be taken back with the button.** Its score's watch keeps it Seen. The browser says so and
  sends nothing; the server leaves the score's watch alone.
- **The viewer context has two sets.** `notInterested` is the mark a card shows. `hidden` is what recommendations
  always leave out: Not interested, and Dropped. The surfaces that hid `notInterested` now hide `hidden`.
- **The always-hidden set and Not seen yet for a guest** are unchanged: a guest has no watch state.
- **`updateScores` sends the machine's `rate` event** after it stored the score, for movies and shows. A show's
  first score by hand opens `seen_question`, though nothing asks the question yet. The taste quiz and the guest
  transfer send `byHand: false`. The request to `/api/update-scores` takes `by_hand: false` for that.
- **The IMDb import does not go through `rate`.** It settles its movies in bulk after each batch and after an undo,
  and it leaves the Wishlist alone, as it always has. So a movie that an import rated can be Seen and on the
  Wishlist, which invariant 5 lists. Whether an import clears Want to See is open, with the same question for the
  migration (section 6).
- **Want to See can still be added to a Seen title,** as before ("Want to See Again"). `updateWishList` and the Not
  interested writer do not send the machine's events yet. The only row they would take is Want to See on a Dropped
  show (row 24), and nothing drops a show yet.
- **Not interested is offered only for a title without a state and without a score,** where it was "not Seen and
  not scored". The two differ only for Watching, On hold and Dropped.
- **Undo of "I watched it" carries the id of what was recorded** (`watchId`: the movie's watch, or the show's Seen
  press) where it carried the time of the watch. It removes only that.
- **The request to `/api/update-watch-history` takes `action_id`,** the id the browser made for the press. Without
  one the server makes it.
- **The member data cache is `user-data-v2`.** The build before can't read an entry with `watchState`, and this one
  can't read one with `watched`.
- **Tonight's pick's key** holds the number of titles per state and the number of watches, not the entries: the
  entries of a large member would make a key of several kilobytes.
- **Account deletion** has one function a future flow calls, `deleteMemberData`. It soft-deletes the share lists
  and hard-deletes the tracking tables and the imports. The other user tables still have no deletion.
- **`USER_TABLES` in `provider_alias_resolution.py`** lists the two tables. Nothing in that script reads the list.
- **The prototypes** (`server/prototype-rec-*.server.ts`) read `user_watch_state` with `state <> 'not_started'`.
  Two of them, `prototype-rec-watch-next-2` and `-3`, read the member data map and now read `watchState`; the list
  in section 4 did not name them.
- **`scripts/benchmark-user-data.mjs` is not updated.** It cuts `_getUserData` out of the source and runs it with
  two names in scope. By its code that stopped working when Not interested was added, before this change; it was
  not run to confirm.

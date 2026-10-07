# Running the watch history migration

Issue [#381](https://github.com/alp82/goodwatch-monorepo/issues/381). The steps to move `user_watch_history` into
`user_watch_log` and `user_watch_state`. What each old row becomes and why is in
[the data model, section 6](data-model.md#6-migration). Paths under `goodwatch-flows/windmill/` are shortened to
`f/...`.

## Parts

| Part | Path | What it does |
|---|---|---|
| Rules | `f/sync/tracking/rules.py` | What an old row becomes, the ids, which episodes had aired by a press, the checks. No I/O. |
| Migration | `f/sync/tracking/migrate_watch_history` | Plans and writes the two new tables, or verifies them. |
| Fill job | `f/sync/tracking/fill_seen_groups` | Adds the watches of a Seen press whose show had no episodes when it was pressed (C5). |

Both scripts are Windmill scripts and both are a dry run unless `dry_run` is `false`. A missing `dry_run` is a dry
run. Neither writes any table but `user_watch_log` and `user_watch_state`.

| Script | Argument | Meaning |
|---|---|---|
| `migrate_watch_history` | `dry_run` (default true) | Report the plan and write nothing |
| | `verify` (default false) | Check the new tables against the old ones instead of migrating. Reads only. The job fails when a check fails |
| | `user_id` | Only this member |
| | `since` | Only old rows and scores changed at or after this UTC time, for example `2026-10-08T12:00:00Z` |
| `fill_seen_groups` | `dry_run` (default true) | Report and write nothing |
| | `user_id` | Only this member |

Run one from `goodwatch-flows/windmill` with the CLI, or from the script's page in Windmill with the same arguments:

```sh
wmill script run f/sync/tracking/migrate_watch_history -d '{"dry_run": true}'
```

## Before the first run

1. The branch is merged and the "Push Windmill workspace" action has finished, so the three scripts exist.
2. `user_watch_log` and `user_watch_state` exist (`f/sync/init/cratedb`) and are empty.
3. **The crawl is complete.** The migration reads a show's episodes only when the copy has marked the show
   (`show.episodes_updated_at` is set, which the copy does after writing the show's rows). Complete means that no
   show a member has marked is still unmarked:
   ```sql
   -- Shows of the catalog that the copy has not reached. Goes to about 0.
   SELECT count(*) FROM show WHERE episodes_updated_at IS NULL;

   -- The same for the shows members have marked. Must be 0.
   SELECT count(DISTINCT h.tmdb_id)
   FROM user_watch_history h
   JOIN show s ON s.tmdb_id = h.tmdb_id
   WHERE h.media_type = 'show' AND s.episodes_updated_at IS NULL;
   ```
   The dry run prints the second number itself, counted per member and show, as `show presses on shows whose
   episodes are not copied yet`. The crawl's own checks are in
   [episode-catalog.md](../../episode-catalog.md#putting-it-live), step 6.

   A run before the crawl is complete is safe: such a show becomes Seen with its press and no watches, and a later
   run or the fill job adds them. One case is not repaired by itself: a show whose fetch was incomplete when it was
   copied gets the watches of the seasons that were there, and the fill job only fills a group that is empty. The
   verification lists such a show under `shows with an incomplete group`; see [Undo](#undo) for the repair.

## The steps

1. **Dry run.**
   ```sh
   wmill script run f/sync/tracking/migrate_watch_history -d '{"dry_run": true}'
   ```
   Compare `planned` with the counts of October 7, 2026. Members have used the site since, so the numbers are a
   little higher.

   | Line | Expected |
   |---|---|
   | `movie watches` | 4,043 |
   | `show presses` | 1,842 |
   | `score-owned watches` | 2,276 |
   | `state rows` | 8,161: `state rows: movie` 6,319 and `state rows: show` 1,842 |
   | `episode watches` | Below 259,259, which is every episode TMDB lists for the marked shows, unaired ones included |
   | `show presses on shows that are not in the catalog` | 6 |
   | `show presses on shows whose episodes are not copied yet` | 0 once the crawl is complete |
   | `show presses with nothing aired by their day` | Not counted before. A show marked before its first episode aired |
   | `members` | At least 212, the members with a watch row. Members with only a rated movie come on top |
   | `largest members`, first line | At most about 32,700 log rows |
   | `skipped` | Empty. A row without any time is left out and named here |
   | `score-owned watches to remove` | 0 on the first run |
   | `want to see rows on titles that become seen` | Not counted before. The owner decides what happens to them ([data model](data-model.md#how-it-runs)) |

   `samples` holds five planned rows of each kind. Look at one movie watch (a date, origin `single`), one
   score-owned watch (no date, `created_at` is the score's time), one show press (`seen_press_group` is
   `mig-seen-<show id>`) and one episode watch (no date, `created_at` is the time of the old mark).

2. **Run.** Note `started_at` from the output; step 6 needs it.
   ```sh
   wmill script run f/sync/tracking/migrate_watch_history -d '{"dry_run": false}'
   ```
   `written` must equal the plan: `movie watches`, `score-owned watches`, `state rows`, `episode watches`. If the job
   stops, run it again; rows that are there are skipped. A second run reports 0 everywhere.

3. **Verify.**
   ```sh
   wmill script run f/sync/tracking/migrate_watch_history -d '{"verify": true}'
   ```
   The job succeeds when every check passes, and fails with the names of the failed checks otherwise. It checks:

   - every old row has a state row with state Seen, and every old movie row a watch;
   - every rated movie has a watch, a score's watch stands alone and has a score, and a movie has a state row
     exactly while it has a watch (invariants 3 and 4);
   - every log row and every state row is well formed (invariants 2 and 6);
   - no migrated show has fewer watches than its episode list gives for the day of the mark;
   - no member lost a Seen title: the titles in the watch history or with a score, against the titles with the state
     Seen or with a score.

   `counts` reconciles: `log rows: movie, single` equals `old rows: movie`; `episode watches of migrated shows`
   equals `episode watches expected from the episode lists` once nothing is left to fill; `state rows: show` equals
   `old rows: show`; `titles that count as Seen`
   is the same before and after. `migrated shows: still to fill` and `no episode list yet` are not failures; the
   fill job takes them.

   Then by eye, as the data model says: the largest member's Seen list, one long show, one show without a list, one
   rated movie that had no watch.

4. **Time the grouped query** for the largest members. Take the first three ids of `largest members`, put each in a
   file of its own, and from `goodwatch-webapp`:
   ```sh
   node --env-file=.env scripts/measure-watch-groups.mjs <user-id-file>
   ```
   Slow is a median above 100 ms or a run above 250 ms for the largest member
   ([data model, section 3](data-model.md#measure-it-first)). Decide before any list is built on the query.

5. **Fill job, after late shows.** Whenever the crawl has reached shows that were not copied at step 2:
   ```sh
   wmill script run f/sync/tracking/fill_seen_groups -d '{"dry_run": true}'
   wmill script run f/sync/tracking/fill_seen_groups -d '{"dry_run": false}'
   ```
   `groups to fill` and `episode watches` say what it adds. After the switch it is scheduled, once a day is enough:
   it then also serves a show a member marks Seen before the catalog lists its episodes.

6. **After the switch** to the build that writes the new tables, run the migration once more for what the old build
   wrote in between, with the `started_at` of step 2:
   ```sh
   wmill script run f/sync/tracking/migrate_watch_history -d '{"dry_run": false, "since": "<started_at>"}'
   ```
   Run it with `since`. Without it the run plans every old row again, and a title a member has taken back in the new
   build since the switch would become Seen again, because its old row is still there.

`user_watch_history` is never written. It stays as the backup and is dropped by hand 30 days after the switch.

## Undo

Nothing reads the two new tables before the switch, and nothing but these two scripts writes them. Until then the
undo is to empty them:

```sql
DELETE FROM user_watch_log;
DELETE FROM user_watch_state;
```

To remove only what the migration wrote, by its ids:

```sql
DELETE FROM user_watch_log WHERE watch_id LIKE 'mig-movie-%' OR group_id LIKE 'mig-seen-%' OR origin = 'score';
DELETE FROM user_watch_state WHERE media_type = 'movie' OR seen_press_group LIKE 'mig-seen-%';
```

To write one show again, for example one listed under `shows with an incomplete group`, delete its group for the
member and run the fill job for that member:

```sql
DELETE FROM user_watch_log WHERE user_id = ? AND group_id = 'mig-seen-<show id>';
```

After the switch there is no undo by id: a movie's state row and a score's watch look the same whether the
migration or the webapp wrote them, and members have acted on the rows.

## Tests

```sh
cd goodwatch-flows
python -m unittest tests.test_watch_migration_rules tests.test_fill_seen_groups tests.test_watch_migration
```

They use an in-memory stand-in for Crate (`tests/watch_tables.py`) and no network.

## Not tried against production

Nothing here has run against a real Crate. The first dry run settles the first two, the first real run the others:

- That the client returns timestamps as milliseconds, which the rules expect.
- The reads: `= ANY(?)` with a list of ids, and the grouped count of watches per member and group.
- The inserts through the bulk interface, 500 rows of 15 values each, into a table with `NOT NULL` and `CHECK`
  columns, and that a row that is there comes back with a row count of 0 and not as an error.
- How long the run takes. It is about 540 requests for 266,000 rows.

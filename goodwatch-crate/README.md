# GoodWatch Crate

The CrateDB cluster's compose file and its backup scripts.

## What the backup does

A root cron job on the first Crate node runs `backup.py` at minute 5 of every
hour and appends the output to `/var/log/backup_crate.log`. The job is
installed by `goodwatch-hq/ansible/cron.yml`.

Each run does the following, in this order:

1. Takes a lock on `/var/lock/backup_crate.lock`. If another run holds the
   lock, the run logs one line and exits with code 75.
2. Creates the snapshot `hourly_<timestamp>` in the file system repository
   `goodwatch-db-backup`. At hour 0 it also creates `daily_<timestamp>`, and on
   Sundays at hour 0 also `weekly_<timestamp>`.
3. Drops expired snapshots, oldest first: hourly snapshots after 3 hours,
   daily snapshots after 3 days, weekly snapshots after 21 days. A run drops at
   most 2 snapshots and starts no drop later than 25 minutes into the run. The
   rest waits for the next run. Snapshots with other names, such as the legacy
   `snap_*` ones, are never dropped.
4. Reads `sys.snapshots` and checks that every snapshot of this run is listed
   with the state `SUCCESS`.

If any step fails, the run stops, logs a line that starts with
`BACKUP FAILED:`, and exits with code 1. A failed creation drops nothing.

The repository is on a network mount and is slow. On October 5, 2026, with
2,144 snapshots in the repository, a snapshot took about 6 minutes, one
`DROP SNAPSHOT` about 14 minutes, and a read of `sys.snapshots` 15 to 90
seconds. The request timeouts and the cleanup bound in `backup.py` follow
from these numbers. Review them when the repository gets smaller or faster.

`cleanup_legacy.py` is an interactive, one-time script that drops every
snapshot whose name doesn't start with a retention prefix. With one drop taking
14 minutes, don't run it without a plan.

## How to tell that the backup is healthy

- The last lines of `/var/log/backup_crate.log` carry a recent UTC timestamp
  and end with `Verified: hourly_...` and `Backup run finished.`
- This query returns a snapshot that finished less than 3 hours ago. The
  query takes 15 to 90 seconds.

  ```sql
  SELECT name, state, finished FROM sys.snapshots
  WHERE repository = 'goodwatch-db-backup' AND state = 'SUCCESS'
  ORDER BY finished DESC LIMIT 1;
  ```

- The Windmill script `f/monitoring/backup_check` runs this query every hour
  and opens a Discord incident for `f/monitoring/crate_backup` when the newest
  successful snapshot is older than 3 hours, when the query returns 0 rows, or
  when the query fails. See
  [Workflow health and Discord alerts](../docs/workflow-monitoring.md).

## What a disabled repository looks like

After an I/O error on the mount, Crate can mark the repository as corrupted
and disable it. This happened three times, the last time from September 30 to
October 5, 2026. The signs:

- `CREATE SNAPSHOT` fails with `RepositoryException ... Could not read
  repository data because the contents of the repository do not match its
  expected state`.
- `SELECT ... FROM sys.snapshots` for the repository returns 0 rows and no
  error, although `sys.repositories` still lists the repository.
- The log shows `BACKUP FAILED:` on every run, and the monitoring check reports
  `crate_backup_missing` or, after 3 hours, `crate_backup_stale`.

The snapshot files are usually intact. Check that the mount is present and
readable on every node before you register the repository again.

## How to register the repository again

`DROP REPOSITORY` removes only the registration. It doesn't delete snapshot
files.

```sql
DROP REPOSITORY "goodwatch-db-backup";
CREATE REPOSITORY "goodwatch-db-backup" TYPE fs
  WITH (location = '/snapshots', compress = true);
```

`/snapshots` is the path inside the container. The compose file mounts it on
every node. Afterward:

1. Run the `sys.snapshots` query from above. It must list the earlier
   snapshots again.
2. Wait for the next hourly run, or run the cron command by hand, and check the
   log for `Backup run finished.`

## Tests

The tests stub `run_sql`, so no request leaves the process.

```sh
cd goodwatch-crate
uv run --no-project --with requests python -m unittest test_backup
```

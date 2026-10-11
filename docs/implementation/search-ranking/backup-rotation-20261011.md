# Qdrant snapshot retention without archive copies

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100).

The observed hourly backup interval displaced vector/graph file data and preceded a 2.12-second native-title Qdrant batch. The rotation remedy removes redundant archive copies: rename the raw snapshot and optional checksum to hourly names in the same directory, then hardlink daily and Sunday weekly names. Retention remains three hours, three days and twenty-one days by the original file modification time. No query or ranking behavior changes.

A host-local nonblocking advisory lock serializes the whole CLI job, including snapshot creation and retention. The public rotation entry acquires the same lock independently; the CLI calls its already-locked internal implementation. Competing jobs fail before snapshot creation. Existing destination names cause failure rather than replacement. The lock protects cooperating executions of this script, not unrelated external writers.

Raw archive/checksum data is fsynced before publication. Directory entries are fsynced before fsync plus POSIX_FADV_DONTNEED on each retained archive/checksum. This requests release of local cached snapshot pages without changing bytes. Advice acceptance does not itself prove eviction of a large real backup or improved search latency.

Snapshot and checksum renames are individually atomic, not an atomic pair. Publication, link, fsync or advice failure skips retention and attempts to restore the raw pair, removing only aliases created by this attempt. If rollback also fails, surviving raw or hourly components and aliases remain for manual recovery; prior recovery points are preserved. After successful publication, retention failures can leave partial old-file cleanup, while the newly published pair remains available. A process crash can leave publication between these steps; retain components and match the checksum before a manual recovery or retry. The lock file stays on the host and does not need removal when a job exits.

Fixed JSON phase events identify snapshot, publication, cache advice and retention start/completion/failure with UTC timestamps, elapsed milliseconds and fixed collection classes. They contain no raw paths, request bodies or exception text. Existing legacy script output is otherwise retained and is not a sanitized evidence stream; observers must parse only the phase-event allowlist.

## Validation before deployment

Thirteen temporary-file tests exercise rename/inode preservation, daily/weekly alias survival after hourly unlink, archive/checksum bytes, fsync ordering, genuine second-process lock contention, destination collisions, partial checksum/link/fsync/advice failure, rollback failure, missing optional checksum and age boundaries. Rename, alias, cache-advice, directory ordering, rollback and contention expectations failed before their respective fixes. Run `python3 -m unittest discover -s goodwatch-qdrant -p test_backup.py`.

Production fixture preflight is bounded and touches no real archives:

- [Filesystem rename/checksum probe](backup-filesystem-preflight-20261011.json) and [hardlink alias probe](backup-hardlink-alias-preflight-20261011.json): the backup mount is SSHFS and synthesizes per-path inode/link counts. Write-through alias visibility and survival after source unlink establish alias behavior; inode equality is only a local-test assertion.
- [Cache advice probe](backup-cache-advice-read-preflight-20261011.json): a 16 MiB read fixture went from 4,096 resident pages to zero after fsync and accepted DONTNEED.
- [Path/device audit](backup-path-device-audit-20261011.json): raw snapshots and retention names share a filesystem. Qdrant's default temporary stage is on a different filesystem, so snapshot construction still performs a cross-filesystem transfer; rotation removal may reduce rather than eliminate eviction.
- [Renamed archive restore proof](renamed-snapshot-restore-proof-20261011.json): a dedicated clone restored the 4.43 GB renamed archive in 82.1 seconds, with checksum agreement, green collection/optimizer, 244,262 points, twelve segments and six shards. This establishes restore usability, not deployed-script or production latency success.

## Rollout and rollback gates

Deploy only after independent code review and production source/hash, scheduler, filesystem and private backup checks. Preserve the previous script and its permissions; atomically replace only the backup script after validation, without changing Qdrant containers, workers, queries or retention settings. Record the deployed script hash so the measurement controller can reject unexpected sources. Do not terminate a running backup or replace its script mid-cycle.

Observe at least three complete modified cycles: filesystem-reported data-extent residency before/after, actual Qdrant process faults/read bytes, host reclaim/pressure, fixed phase events, actual backup process exit and controlled same-body Qdrant batches. Distinguish archive cache advice acceptance from measured vector/graph residency and from latency. If deficits survive, evaluate the separate measure-only residency-maintainer proposal before enabling repair. The map remains open until a fresh seven-day organic window has no search errors and first usable results p95 below 1.5 seconds; full completion latency remains separate.

Rollback restores the saved script after the current job has exited, verifies its recorded hash/permissions, and leaves all existing archive/checksum aliases intact. Daily/weekly hardlinks remain independently usable after hourly names expire; returning to copy-based future rotation does not require converting existing aliases. Preserve any incomplete publication components for checksum-guided recovery rather than deleting them.

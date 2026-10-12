This prepared collector measures an unpinned backup window using numeric Linux resource data. It does not scan Qdrant files, read file contents, issue queries, change cache state, or install a service. A completed window cannot establish a future memory ceiling or search acceptance.

The default command prints `prepared-only` and performs no source inspection:

```sh
python3 -I -B goodwatch-qdrant/diagnostics/resource_window.py
```

After source review, `--inspect-preflight` is a separate read-only action. It reads fixed Docker metadata, root cron schedule metadata, the current kernel release, six dirty-writeback sysctls and the snapshots mount's visible mount options. Its output contains no commands, credentials, mount paths or process arguments. `sourceIdentityHash` pins the private Docker frame, including mounts and the actual Qdrant PID/start ticks. The cron job's `backupPathHash` identifies an absolute backup script argument during the later process census. These hashes must come from a fresh preflight on the intended source.

The preflight deliberately reports `nextBackupUtcEstablished: false`: a `TZ` declaration does not establish cron's scheduler timezone, and `CRON_TZ` support varies by implementation. A reviewer must establish the deployed cron implementation, scheduler timezone and next normal execution before choosing the observation window. Visible SSHFS options likewise do not prove its negotiated FUSE I/O mode. Dirty-writeback sysctls are tuning thresholds, not hard limits.

The explicit execution action requires source and backup hashes plus UTC timestamps. Schedule the next verified normal backup, with a baseline and recovery period; do not reuse a missed window. Start must be between now and five minutes ahead; the window must last 2–2700 seconds.

```sh
python3 -I -B goodwatch-qdrant/diagnostics/resource_window.py --execute \
  --expected-source-sha256 SOURCE_HASH --backup-path-sha256 BACKUP_HASH \
  --start-utc UTC_START --end-utc UTC_END
```

The numeric reader records host memory (including Dirty, Writeback and WritebackTmp), host/source memory and I/O PSI, reclaim/refault counters, source anonymous/file/kernel/shmem accounting, process faults/read bytes, source events and CPU counters. Both sides of each sample fence the actual Qdrant executable, PID/start ticks, cgroup membership, limits and ancestor limits. Source process VmLck must remain zero. The reader emits its own before/after proof of unchanged placement outside the source cgroup and VmLck zero. Source PID membership is required and fenced before/after each sample and at the terminal resource fence. Docker source configuration is checked asynchronously every ten seconds, with bounded subprocess timeouts; a failed or stale check aborts the window. This avoids routing the two-second numeric reader through Docker or FUSE path scans, but configuration changes between inspections remain possible.

A bounded process census records SSHFS, its observed SSH descendants and other SSH processes as fixed classes. It reads command lines only for the fixed launcher names python, python3 and uv, in memory, to match the backup script hash. Backup launches with different comm names are outside this census. Command lines outside these eligible comms are not read; an oversized other eligible Python/uv process still makes the census incomplete. Process races or census bounds make that class incomplete. RSS sums are estimates: shared pages may be counted more than once, and not every SSH process can be attributed to SSHFS through this limited eligible-process ancestry. The other-cgroup total covers direct siblings under the source's parent, whose hierarchical counters already include descendants; it does not measure every host branch. Source and host reads are sequential, not atomic.

Each row is capped at 8192 bytes, the run at 1500 samples and the output at 16 MiB. The worst permitted sample-row total plus two terminal/start rows is 12,304,384 bytes. Fixed fields, numeric bounds and a rich-row fixture check this budget. Two-second sampling allows an explicit maximum start-to-start gap of three seconds (one second of scheduling tolerance) and does not catch up after stalls. Each sample records monotonic start/end bounds; the terminal records elapsed time, scheduled-window completion and wall-clock drift. A shortened window or wall/monotonic drift exceeding one second invalidates coverage. Slow samples, missed cadence or incomplete optional classes make continuous coverage false; required field or identity failures stop collection. The delayed start does not consume the observation deadline.

An external launcher must retain actual reader PID/start identity, exit status and proven disappearance separately from clean coverage. This module's terminal record alone does not prove the SSH supervisor or reader exited. Reject a run with a later failure, missing terminal, signal termination, sequence/gap problems, incomplete classes, source turnover or source configuration drift. Do not label an observed peak as a lifetime maximum. No launcher or runtime operation is included in this prepared step.

Local verification:

```sh
python3 -m unittest discover -s goodwatch-qdrant/diagnostics -p test_resource_window.py
```

The fixtures exercise delayed-start duration, stalled samples, final source failure, strict counter units, PID reuse, process races, SSH classification/privacy, hierarchical sibling accounting, UTC inputs, ambiguous cron timezone, visible FUSE options and output bounds. They do not substitute for a reviewed production preflight or a complete normal backup observation.
# Owned reader census exclusion

The reviewed stdin transport embeds the observer's Python source in its child `-c` argv. The historical 11:10 resource window's reader consequently exceeded the census's 8,192-byte argv bound. The failure evidence and exact launch-shape reproduction are in `docs/implementation/search-ranking/resource-window-failure-20261012-1110/`. That window remains failed/UNKNOWN; its separate `source_changed` trigger is not attributed by this correction.

The source now captures its own reader birth time. `reader_proof` rechecks current PID and birth alongside placement and zero VmLck. The backup/SSH census can exclude only `os.getpid()` when supplied that frozen birth: it fences birth at the beginning/end and when excluding the mandatory matching node. It emits numeric `ownedReaderExcludedCount=1`; the direct default census excludes zero. No foreign PID can be supplied. The full process count still includes the reader for the 4,096-process bound, and the one-second, 64-SSH-process and 8,192-byte argv bounds are unchanged. Other oversized Python processes remain incomplete with `argv_limit`. Source membership changes, source identity/cap changes and locks still reject.

The local regression launches an actual Python child with embedded reviewed source and parent-death/parent-identity checks, and exposes only its own actual `/proc/PID` through a temporary fixture. The unexcluded census fails; the own-PID/birth census completes with exclusion count one and zero VmLck. It runs no source inspection, Docker command, provider, model or Qdrant query. Temporary fixture and shaped-argv cases also cover PID birth changes, missing mandatory presence, default no exclusion and a second oversized Python process. This prepared correction has not run on a production host and establishes no backup capacity or latency acceptance.

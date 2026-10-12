# Complete backup file metadata diagnostics

These are the exact prepared/executed metadata readers and the local offline auditor for Task 406. The launchers default to inert mode; they contain historical window/path/hash guards and are not general deployment commands. No service is installed. Never publish private source contracts, baseline datasets or full-cycle journals.

The scanner reads directory/file metadata only, with anchored O_NOFOLLOW directory FDs, positive cohorts and files in each collection, with limits of 100,000 entries, 30 seconds, 24 levels and 16 MiB and source fences around each complete observation. It retains private dev/inode/size/stat-block metadata; scans are not atomic snapshots. The live reader uses the existing v4 source/pressure/archive helpers exactly, now with complete per-file scans about every 30 seconds. It does not receive the historical private baseline. A slow scan delays cadence; there is no catch-up burst.

The original baseline and live samples remain in owner-only local files. An offline public audit requires explicit private input paths:

```sh
python3 -B audit_full_cycle.py --baseline /absolute/private-baseline.jsonl --journal /absolute/private-window.jsonl
python3 -B -m unittest discover -s . -p 'test_*.py'
```

The baseline hash is pinned to the actual 07:50 UTC capture. Compare source PID, start ticks and hash and actual before/after pressure identities, preserve counters without reset compensation, require sequential samples, monotonic UTC timestamps inside the declared window, a consistent terminal summary and a final clean reader-exit frame. A live prefix never establishes completed-cycle coverage. Any incomplete/turnover/time/terminal failure makes growth coverage unknown; incomplete archive scans retain a qualified lower-bound diagnostic peak.

Growth sums positive per-file size/stat-block changes and full new/replaced identities. Shrink/deletion never cancels growth elsewhere. This conservative historical-baseline comparison does not prove that retired and new bytes coexist or require equivalent resident memory. Stat-block allocation is not resident memory; overwrite/filling already allocated or preallocated areas may increase active data/cache without changing these metrics. Inode reuse/content changes and transient peaks between 30 second samples remain possible. Background traffic, normal compaction/segment turnover and observer footprint contribute to counters and growth; snapshot attribution is not proven.

The actual baseline receipt is [retained as public totals/hash](../../../docs/implementation/search-ranking/production-complete-file-baseline-20261012.json). Source hashes are in [source-audit.json](source-audit.json). The two-copy archive allowance remains unchanged. This evidence establishes neither a future staging ceiling, a search-latency result nor seven-day production acceptance.

The historical full-cycle supervisor stopped early: its 1,900-second ceiling included the wait before the scheduled start. Executed bytes are preserved for review and must not be reused as a corrected scheduler. The final audit has 59 samples, two incomplete scans, no summary and a TERM exit. `readerExitProven` means clean terminal success; actual reader disappearance is separately proven in the run receipt. See [actual outcome](../../../docs/implementation/search-ranking/production-complete-backup-metadata-20261012.md).

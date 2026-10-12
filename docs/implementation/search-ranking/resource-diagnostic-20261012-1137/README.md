# Clean short resource diagnostic: 12 October 2026

Root executed the reviewed observer for 30 seconds, 11:37:06–11:37:36 UTC, with 15 samples. The strict combined-journal audit reports complete coverage with no problems for this short interval. The owned reader exited 0, is proven gone and has a clean receipt without TERM/KILL. This is no normal-backup observation, future memory ceiling or search latency result. [Map #100](https://github.com/alp82/goodwatch-monorepo/issues/100) retains the remaining work; #407 remains open and #406 is closed.

Every userspace and sibling-cgroup census was complete. Each userspace census excluded exactly the current reviewed reader with its frozen birth; no other process was exempted. The source PID/start ticks, source identity, source membership and inspector placement remained stable, with source/reader VmLck zero. No backup process was observed. The historical 11:10 window's `source_changed` failure did not recur and remains unattributed; this success does not reconstruct that failed window or guarantee future completeness.

| Sampled resource | Observation |
| --- | ---: |
| Minimum host MemAvailable | 12,211,699,712 bytes |
| Maximum host Dirty | 4,321,280 bytes |
| Maximum host Writeback | 8,192 bytes |
| Retained first-to-last source major faults | +6,910 |
| Retained first-to-last source read bytes | +28,295,168 |

These are discrete observations and aggregate counters, including background and diagnostic activity. They do not attribute faults/I/O to a request or backup and are not future bounds. The eligible SSHFS process count was zero; that does not prove all FUSE or remote memory was zero. SSH RSS sums are estimates and the sibling-cgroup scope does not cover all host branches. Source event and CPU throttling deltas were zero over the retained samples.

The byte-identical journal and fresh preflight are retained here with [the numeric summary](guard-diagnostic-summary-20261012-1136-v2.json), [strict audit](strict-audit.json) and [provenance](provenance.json). The fresh preflight passed at 11:34:23.969589 UTC and its reader exited 0/gone/clean without signals. Its source hash matches the diagnostic. Root alone performed host execution; the author inspected local evidence. The observer created no remote files, issued no queries or cache controls, and made no application/storage changes. Local evidence files were created. A separate outer-recorder exit artifact is not included; the actual reader receipt is retained.

# Prepared source and independent review

The merged reader is commit `5fe7d597528eecba132619ce5aba1692094ca3cf`, source SHA `572ad7ca417ea4e5336b1415a4d015b7095d78f21cb0b5552f360f73914394d2`. The exact launcher, recorder and versioned offline auditors are retained under `goodwatch-qdrant/diagnostics/resource-window-diagnostic-transport-v2/`. Historical absolute source paths are preserved to reproduce execution provenance, rather than represented as portable deployment instructions. No new service or installation is included.

The launcher/recorder differ from the earlier reviewed transport only in source path/hash and launcher name/hash. The offline auditors retain prior sequence, clock, source/membership, placement, terminal and clean-exit gates, bind the new source SHA, and require an exact integer own-reader exclusion count of one. They reject missing/boolean/multiple exclusion counts, wrong source/birth, membership drift, incomplete classes and unknown frames. The combined audit requires owned birth/exit records around the numeric journal; a terminal record alone cannot pass.

Actual Claude Code `claude-opus-5-5`, invoked with `--effort medium`, tools disabled and no MCP servers, gave PASS/no actionable blockers for the public frozen reader/test/transport packet. Its [preserved report](opus-focused-review.txt) is a source read-through, not executed verification. The reviewer did not run tests or verify claimed hashes. The report preserves material limits, including subprocess fork/exit races that may invalidate future censuses and the local child fixture's different wrapper shape. Its recorder-test remark concerns the pasted packet; the earlier recorder tests are retained in the prior evidence step. No reviewer comment establishes production capacity or a resolved historical source-change trigger.

# Reproduce offline

From this directory, compare the retained files with `provenance.json` using SHA-256 and byte counts. Root can additionally compare both journals byte-for-byte with its existing local originals; no host rerun is needed.

From the repository root:

```sh
python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics -p test_resource_window.py
python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics/resource-window-diagnostic-transport-v2 -p 'test_guard_*.py'
python3 -I -B goodwatch-qdrant/diagnostics/resource-window-diagnostic-transport-v2/audit_transport_window_v2.py docs/implementation/search-ranking/resource-diagnostic-20261012-1137/guard-diagnostic-actual-20261012-1136-v2.jsonl
```

The audit must reproduce `samples=15`, `coverage=complete`, `problems=[]`, reader gone/clean true, and both future-ceiling and production-acceptance false. The prepared next 12:10–12:40 window remains a separate root-reviewed plan requiring fresh source and cron executable/birth/timezone fences. It is not scheduled or executed by this evidence step. Full temporal coverage and an actual observed backup are separate requirements; future failures remain UNKNOWN without relaxed guards or automatic retries.

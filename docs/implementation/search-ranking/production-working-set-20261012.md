# Actual metadata-only production working-set measurement

A single reviewed measurement on October 12, 2026 found **1,711,960,064 selected data bytes**, of which **1,374,248,960 bytes were resident**. The selected vector/graph/sparse/other mapped-file cohort therefore had **337,711,104 nonresident bytes** at this snapshot. Payload was measured for visibility and excluded from selection. The selected snapshot is below 2 GiB by 435,523,584 bytes. This proves neither a future pin budget nor sufficient archive/staging/emergency headroom, and supplies no latency result. No production residency helper was installed, no memory was locked and no search was issued.

The inspector completed in 9,423 ms with remote exit 0. Its actual kernel was `6.8.0-87-generic`. Source identity, uncapped allocation, OOM-group fence and mapped storage cohort were unchanged; source OOM/max/throttling deltas were 0. The inspector stayed outside the source cgroup with its own `VmLck=0`. Open FD identities/counts and the original NOFILE soft/hard pair were restored; only its own soft limit temporarily rose from 1,024 to 20,260 under the existing hard limit 1,048,576. These are execution facts for the metadata pass, not evidence for a future holder or pressure-triggered release.

| Class | Files | Data bytes | Resident data bytes | Selected |
|---|---:|---:|---:|---|
| Vector | 200 | 734,814,208 | 562,741,248 | Yes |
| Graph | 24 | 420,782,080 | 420,782,080 | Yes |
| Sparse | 77 | 225,255,424 | 60,461,056 | Yes |
| Other | 35 | 331,108,352 | 330,264,576 | Yes |
| Payload | 13,717 | 2,363,801,600 | 540,962,816 | No |

The class labels retain the existing filename convention for nonpayload components; they are not an authoritative vector-field schema. Payload exclusion is structural. Counts and residency cover only the frozen mapped-file cohort, not every collection file or all future mappings. SEEK_DATA/SEEK_HOLE semantics depend on the filesystem; page-granular allocated-extents metadata is not immutable-content proof. Per-file reads were not globally atomic, although the before/after storage mapping cohort hash matched.

## Retained evidence and safe reproduction

The [two exact public frames](production-working-set-20261012/actual-frames.jsonl) have SHA-256 `c6ee4169bf75b082c58a72531f257f4707d2887e1264676aeba19a193fb00a9e`. The [receipt](production-working-set-20261012/receipt.json), [artifact provenance](production-working-set-20261012/provenance.json) and [historical preparation manifest](production-working-set-20261012/manifest.json) distinguish preparation from the one actual execution. The completed frame did not include a wall-clock timestamp; the date and single-execution fact came from root execution, and the frame directly records elapsed time. No precise measurement-start timestamp is inferred from a file mtime.

The [inspector](production-working-set-20261012/inspect_measure.py), [launcher](production-working-set-20261012/launch.py), [tests](production-working-set-20261012/test_measure.py), and three core files are exact copies of the reviewed packet. Core digest `2b956e9ad4b2297552d66524277acbc4d6d867f36cc1fdfa656a7c75a7568256` is from main `a9e75e18a0d80fa7f4a52110169a165a47214d47`, including the linear FD cleanup and classifier correction. The private source contract was authenticated by digest `12db49b938d8d8d6b24738c860559c098732ff351cf1b90c4637f28d0d2f1b6d` and remains outside Git. No raw mapped paths, proc lines, private contract contents, accounts, credentials, queries, vectors, interpretations or model bytes are retained in the result. Historical launcher code contains its reviewed operator input location; that path reference does not include the contract.

Defaults perform no inspection or SSH connection. Actual activation sent the hashed source packet and private contract directly over SSH stdin, executed the three core modules entirely in memory, and made no host stage or temporary file. The inspector never called placement, PinSet, reconcile, locking, cache advice, warming or content reads. It used regular single-link NOFOLLOW target descriptors, checked canonical storage/device/inode/size, enumerated extents, mapped PROT_READ|MAP_SHARED and called mincore without touching mapped bytes. Code and private contract bytes and ordinary metadata were intentionally read; zero content-read fields refer only to this measure, not global host activity.

Full source PID/startticks, image/mount/cap/oom-group and parent-placement fences applied before/after. The source memory-accounting and host MemAvailable/Dirty/Writeback fields were sampled freshly and retained in bytes. Inspector timeout was 90 seconds; transport timeout was 120 seconds marks remote exit unproven if interrupted. No host/source limit was changed; the explicit own-only NOFILE soft raise was bounded by existing hard and restored even on failure. Current source pins and operator paths are historical: this packet is not a standing authorization to execute again.

Nine meaningful local fixtures and root's independent run passed before execution. All nine can reproduce publicly on Linux with Python >= 3.9, SEEK_DATA/mincore support, and an existing NOFILE hard limit sufficient for the core inventory bound (the recorded run had 1,048,576):

```bash
python3 -B docs/implementation/search-ranking/production-working-set-20261012/verify.py
```

The verifier checks exact artifact/code hashes, a strict fixed receipt whitelist, numeric-only nested fields, selection/residency arithmetic and exit evidence before running the unchanged tests. Fixtures exercise real temporary sparse files/extents/read-only mmap/mincore, actual own NOFILE raise/restore, hardlink rejection and FD cleanup, source/event/cohort turnover, no implicit limit raise, input hashes and default refusal. Source/Docker identity is mocked at the local fixture boundary; no production operation is invoked.

Map [100](https://github.com/alp82/goodwatch-monorepo/issues/100) remains open for remaining latency work and [407](https://github.com/alp82/goodwatch-monorepo/issues/407) for acceptance. Task [406](https://github.com/alp82/goodwatch-monorepo/issues/406) stays closed as the owner instructed. This snapshot is an input to the next safety/feasibility decision; it starts no seven-day window and establishes no performance acceptance.

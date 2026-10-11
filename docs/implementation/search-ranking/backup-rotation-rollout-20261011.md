# Backup rotation deployment and observation controls

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). This records the concrete rollout of [the rotation remedy](backup-rotation-20261011.md), separately from its running, incomplete production efficacy measurements.

## Deployed backup script

[PR #439](https://github.com/alp82/goodwatch-monorepo/pull/439) merged as `ba5e111201cd20cfb6ac4547f91993ff40ba6dee`. The [production publication record](backup-rotation-deployment-20261011.json) records atomic replacement at **2026-10-11 20:52:15.917 UTC**, while no scheduled backup was active. Candidate and installed script SHA-256 both equal `eeedbb37190845856ec63528e8dc86f8fbac376b8bfa2037b5d8b9ced572d705`, verified against the merged repository script. The old script was preserved privately with mode 0600; installed mode is 0755. Cron, environment and other checkout files were unchanged. No Qdrant service restart or serving-code change was part of this deployment.

The [publisher fixture](deploy-backup-fixture-result-20261011.json) exercised actual publication functions on owned temporary paths: wrong candidate and rollback digests reject replacement, active backup rejects publication, successful atomic deploy preserves the original and unrelated files, and pinned rollback restores the original. These five checks establish guard behavior in a fixture, not that production rollback has been executed.

## Diagnostic preparation and actual launch

The [preparation manifest](backup-operation-preparation-20261011.json) is an earlier preparation snapshot: its deployment/observation booleans are false **at preparation**, not a report of the later deployment above. [Staging evidence](observer-staged-20261011.json) establishes a root-private syntax-valid controller staged for launch; its recorded state is not launched. The later [launch record](observer-launched-20261011.json) and [ready record](observer-ready-20261011.json) establish the actual observer started at **2026-10-11 20:54:05.899 UTC**, PID 2619537, with the deployed backup digest and frozen controller digest below. The ready check retained two start/passive records, backup absent, zero stderr bytes, zero warming reads and zero observer query requests. This is running, incomplete observation: no modified cycle result is claimed. The intended three baselines are 21:10, 22:10 and 23:10 UTC around the unchanged hourly :15 schedule. Preparation and launch do not establish removed eviction, warm post-backup results or seven-day acceptance.

The frozen script hashes below match the local preparation files and manifest:

| Control | SHA-256 |
| --- | --- |
| Atomic publisher | `1b2d58e87f0f9ed50554fd474dd47b246f390f4856fc956f1385b35d087d5942` |
| Observer controller | `edc0c300cde27cb3e78036a8221f352e3569a3e0212548bd497736e32b52e0b0` |
| Observer launcher | `5f8ca5027030ffc06d8129398e17462d958bb8b5fb2f685901de83590c924422` |

The [observer fixture](observe-backup-fixture-result-20261011.json) exercised twelve actual guard cases without signals or query requests: wrong cycle/nonwaiting state, unsupported extent semantics, failed samples, changed actual Qdrant PID, active backup, missing collection phases, failed backup phases and rejected cache advice all block post control; a same-PID complete set passes. The phase parser excludes legacy private log lines and extra fields. The controller requires successful snapshot, publication, cache advice and retention phases for both actual collections before signaling the memory-only consumer after fresh process absence and post-backup residency snapshots. It retains fixed numeric/boolean fields and digests, rather than request bodies, credentials, paths or raw process arguments.

[Operational preflight](backup-operational-preflight-20261011.json) consolidates tiny SSHFS alias/cache probes and the filesystem audit. SSHFS reports synthetic per-path inode/link counts; write-through alias visibility and survival after source unlink establish the tested alias behavior. The 16 MiB read fixture dropped from 4,096 resident pages to zero after fsync and accepted DONTNEED. Qdrant's configured default temporary stage maps to its storage filesystem, while final snapshots and retained archives share a different filesystem. Pinned Qdrant 1.19.1 source links in the artifact document the cross-filesystem move fallback to copying; actual stage byte counts were not measured. Eliminating rotation copies therefore may reduce rather than eliminate eviction.

The [renamed archive restore proof](renamed-snapshot-restore-proof-20261011.json) is already retained with the fix. The [dedicated clone stop record](clone-stopped-after-restore-20261011.json) confirms only that owned clone was stopped afterwards, preserving its archive/store and prior evidence. It is distinct from production deployment and does not assert production restore or latency success.

## Remaining evidence

The actual controller launch identity/hash is retained above; later cycle records must match this frozen diagnostic run. Each complete cycle must correlate before/after filesystem-reported data-extent residency, actual Qdrant process fault/read counters, host reclaim/pressure, successful phase events, backup process exit and the controlled same-body batch comparison. Whole-file resident pages include sparse holes, and SEEK_DATA/HOLE reflects filesystem semantics; neither percentage alone proves active query data is warm. Aggregate counter windows can include organic traffic and background work.

If the three cycles pass, the fresh seven-day organic search window still needs zero errors and first usable results p95 below 1.5 seconds. Full completion latency remains separate. Deployment, small-fixture cache eviction and clone restore usability alone do not satisfy either production efficacy or map completion.

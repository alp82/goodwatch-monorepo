# Clone source staging and zero-pin turnover passed

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), verification [#407](https://github.com/alp82/goodwatch-monorepo/issues/407), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). The reviewed clone source was staged, and an actual zero-pin child joined the clone cgroup before and after one owned container restart. Both children were observed gone, the parent cgroup remained unchanged, and the retained store returned green with its expected 244,262 points, 12 segments and six shards. This proves that placement/turnover prerequisite only. No full pin, archive-pressure experiment, held-out capture, latency improvement or seven-day application acceptance is established by this step.

## Frozen source and staging

The staged files come from [PR450](https://github.com/alp82/goodwatch-monorepo/pull/450), source head `ea56a64de4fb04999bad3177a6849e16f31c954e`, merged as `50883952936f3cf38ce1cd559f4304a3b77225d3`; the helper safety fixes were merged in [PR448](https://github.com/alp82/goodwatch-monorepo/pull/448). The [actual staging response](clone-pin-source-staging-20261011.json) retains all 18 individual file hashes and complete helper/controller/gate/policy/manifest hashes. Staging did not emit a timestamp, so none is invented here; it completed before the gate launch at 22:49:24 UTC on 2026-10-11. The root executor persisted the tool response and manually matched its 18 hashes to the frozen source; the artifact is a retained response, not a second staging run.

The guarded stager, SHA-256 `c9d2b4e2ce0d93f4c5b1494ea6c56cd0187e991f87768f1be53a106dcd8265a2`, created only an absent task-owned private directory on the nonproduction clone host. It checked the exact existing image, task labels, three mounts, loopback publication, six-GiB memory/swap and two CPUs, source PID/start ticks, canonical owned paths, resource counters and disk/headroom bounds. New directory/files use modes 0700/0600. Staged config loaders and source guards then verified the same process, with no lifecycle operation, cgroup join or query during staging. Nine owned-tempfile fixtures had passed before execution, covering existing-directory/symlink preservation, private permissions, rollback limited to new inodes and retention of unknown or aliased entries.

Before staging, Qdrant PID was 3,488,583 with start ticks 3,058,620,253. Cgroup current memory was 4,993,626,112 bytes; host available memory was 4,362,444,800 bytes. Owned deduplicated allocated bytes were 9,009,586,176, with 9,596,907,520 bytes free. OOM, OOM-kill, cap-max and throttle counters were zero. These describe the staging instant and do not establish full pin capacity: selected missing pages and transient allocation still need their runtime guards.

The 18-file whitelist consists of the three helper modules, controller, turnover gate, two canonical configurations, ten source-manifest JS files and the manifest itself. No Node executable, generated bundle, credentials/env file, models or private captured inputs were staged. This clone operation did not change production services, production caches or production search history.

## Actual gate and post-health

The [complete gate output](clone-zero-pin-turnover-20261011.jsonl) retains launch, exit and post-health records, including four gate frames. The executed launcher digest was `9e7c4bbe35484021af0e75dd2e8b85dc30ee28f73cf6cb8ffb332ae29850f484`. A later local revision, `acf9004cb7984416c5a24a44ba8879b26821cc02d5571828c64c56199665f612`, added strict record sanitization while the earlier already-launched remote script was running. That revision was prepared only and is not the executed proof. The digest check and remote script capture had already completed; the local revision did not alter the active remote script or frozen gate source. Keep launcher files frozen across future review and execution to avoid this ambiguity.

All times below are UTC on 2026-10-11.

| Actual observation | Time | Result |
| --- | --- | --- |
| Launcher source/cgroup check | 22:49:24 | Parent outside clone cgroup; original source PID/start ticks verified |
| First child joined | 22:49:26.967485 | VmLck zero; parent unchanged; no cap/OOM/throttle deltas |
| Old child observed gone after owned Docker stop | 22:49:27.831553 | Exit code −15 (SIGTERM); no grace-period survival; VmLck zero |
| Fresh store ready and second child joined | 22:50:24.366802 | Qdrant PID/start ticks changed; VmLck zero; parent unchanged; clean join deltas |
| Second child complete and gone | 22:50:24.397534 | Exit zero; no grace-period survival; parent unchanged |
| Launcher exit and post-health | 22:50:24 | Gate exit zero; no launcher signal; green/optimizer ok and expected counts; no recovery required |

The fresh Qdrant process was PID 3,509,840 with start ticks 3,059,108,659. The [read-only census](clone-zero-pin-census-20261011.json) at 22:50:57 confirms that identity, VmLck zero, no remaining gate or gate-descendant processes, and green metadata with 244,262 points, 12 segments and six shards. The census compared process arguments privately in memory to the fixed task identity; it retains only numeric IDs/start ticks/locked bytes and booleans, without environment values or raw arguments.

The child entered the clone cgroup and exited; it did not create mapped pin sets or request mlock. Gate records declare zero archive bytes read, cache controls, search queries and storage-content writes by the diagnostic controls. The owned Qdrant stop/start itself can perform normal startup/WAL/optimizer work in its existing store. Collection readiness checks are metadata GETs, not ranking queries. No failure/recovery branch was exercised by this successful gate.

## Startup and bundle provenance

The [startup audit](clone-startup-semantics-20261011.json) establishes that Config.Entrypoint is empty and Config.Cmd is only the default entrypoint, with no snapshot-restore arguments. The installed script forwards its arguments to Qdrant, without snapshot/restore code or source/eval directives. Docker start uses the existing mounted store; the retained snapshot bind alone does not trigger restore. The earlier diagnostic restore was a separate explicit snapshot-recovery API call. WAL replay, optimization and a conditional recovery-mode contingency remain distinct startup possibilities. No environment values were inspected in this audit.

The [official tagged entrypoint](https://raw.githubusercontent.com/qdrant/qdrant/v1.19.1/tools/entrypoint.sh) corroborates argument forwarding and conditional recovery behavior. The installed script hash is retained, but its line count differs from that tagged file, so exact script-byte equivalence is not claimed.

The [bundle-source comparison](clone-bundle-source-provenance-20261011.json) compares tracked mode/blob/tree identities for 60 relevant source files across ranking, combined search, runtime limits, role/lifecycle/separate-entry/backend-timeout helpers and package/lock files. Diagnostic build source `2eb889b4d7ab998f012cda8aadbc2afc8d9dd8ff` equals production runtime `927d38b2cca815f02a0b1636ec06f63c24603396` within those scopes. The pinned external image's source `5f15698995eb4368baf5ea094b704a3752191e40` differs in six listed ranking/combined-search paths; its dependency/model layer provenance remains separate. This is scoped source equivalence, not compiled-artifact parity. The intentionally guarded generated bundle is independently hash-pinned and was not required or staged for this gate.

## Limits and next diagnostic gate

Retained artifacts contain fixed flags/tags, source hashes, numeric counters and booleans. They contain no user query text, vectors, result IDs, ciphertexts, account identifiers, credentials, environment values, full process arguments or private production paths. Owned task filenames and public repository/source links are retained for review.

This gate validates actual zero-lock process placement, Docker handling of the foreign child, source turnover and cleanup under the audited configuration. It does not validate mlock behavior under pressure, the proposed coverage of four file classes, host/cgroup capacity during pinning, pin-holder continuity through ranking, unseen case coverage, result/score parity, product first-usable-result latency or acceptance. Full pin/capture still requires fresh runtime fit, source/policy/manifest verification and the separately reviewed experiment controls. Any future cold+archive-pressure comparison must retain its cold-start association and pressure/resource caveats; this successful turnover gate supplies none of those measurements.

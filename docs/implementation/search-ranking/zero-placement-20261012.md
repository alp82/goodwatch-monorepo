# Actual zero-pin source-cgroup placement gate, October 12, 2026

The reviewed zero-pin gate passed on the production Qdrant host at **08:32:17–08:32:20 UTC**. Three owned spawned children joined the actual source cgroup with `VmLck=0`, while the parent stayed outside it. Graceful close, TERM and KILL produced exit codes **0, −15 and −9**, respectively; every holder exited and released. The CLI exited0 and the final source identity and allocation fence matched the initial one. This proves the tested placement permissions and owned lifecycle only. It establishes no production pin budget, memory-locking behavior, latency improvement, or seven-day acceptance window. No production residency helper was installed.

The preceding v1 attempt failed at08:28:43 UTC because the outer stdout schema omitted the boolean `holderExited` returned by the reviewed `Holder.close()`. Its first holder had joined with `VmLck=0` and exited0 with a graceful acknowledgment in the durable journal. The outer rejected that frame, stopped the CLI with TERM, and proved the one registered holder gone. TERM/KILL modes and final source-after were absent. V1's overall result remains **failed**; its stage is retained and cannot be reused.

V2 changed only the dedicated absent stage suffix and the stdout schema: `holderExited` is allowed with exact boolean typing. A regression composed the real frozen `zero.run`/spawned-child/`Holder.close()` frames with that schema, reproduced the v1 failure, then passed all three lifecycle modes after the fix. Foreign cgroup placement is mocked in this local fixture; the retained actual host evidence independently demonstrates that boundary.

## Retained public evidence

- [V1 sanitized receipt](zero-placement-20261012/v1-actual-receipt.json): parent-provided actual execution and durable-journal observations, with journalSHA `aa212b4c…`; no private journal contents.
- [V2 exact public frames](zero-placement-20261012/v2-actual-frames.jsonl): **12** JSONL frames, SHA256 `2fa2a393e8c214c5f22b33cad37781e3a40e0417949c537c660ee4bfcd280603`. The initially reported13-frame count was corrected from the retained file, without adding a synthetic event.
- [V2 receipt](zero-placement-20261012/v2-actual-receipt.json): CLI385151 exited0; private journalSHA `c60609b5591a601db7d3e7bf1382e2e8eded4c84e42bdd165489f09d952c3f3b`; three registered holders were gone.
- [Frozen artifact provenance](zero-placement-20261012/provenance.json), [v1 launcher manifest](zero-placement-20261012/launcher-v1/manifest.json), [v2 launcher manifest](zero-placement-20261012/launcher-v2/manifest.json) and [red regression description](zero-placement-20261012/schema-red-regression.json).

Both attempts explicitly retain `unknownEarlyChildrenPossible=true`. Registration is fsynced before a child receives any join command; an unregistered early child cannot receive placement. The evidence proves registered-holder exit, not literal absence of every early/unregistered process. Kernel parent-death release and idle lease have separate real-process local fixtures. No assertion hides a blocked or unproven exit.

## Reproduction and scope

The [v1](zero-placement-20261012/launcher-v1/stage_and_run.py) and [v2](zero-placement-20261012/launcher-v2/stage_and_run.py) stagers, their launchers and tests are byte-for-byte copies of the reviewed versions. Defaults emit preparation only and do not inspect or connect. Reviewed execution used a private stdin packet containing exactly five400 source files and the source contract, fixed by separate hashes. The fixed five-file code digest is `b9a9f13d851ac0a46ce30163126e698b297015b13999a4c9546fd0b0513a87e7`; the private contract digest is `12db49b938d8d8d6b24738c860559c098732ff351cf1b90c4637f28d0d2f1b6d`.

Before stage writes, the stager checked the pinned actual source PID/startticks, image, full mounts, uncapped Docker and actual cgroup limits, `memory.oom.group=0`, parent placement, canonical owned0700 parent and absent stage. It wrote only the new0700 stage, five400 code files,600 private contract and600 journal, with fsync. The CLI used Python-I-B, a PIDfd and kernel parent-death protection. A110-second CLI deadline sat inside a150-second outer deadline; cleanup signalled only owned tick-fenced processes, never Qdrant. Fixed allowlisted output included the actual CLI exit and journal hash. The literal host/source pins and operator paths are historical; these consumed stages and launchers must not be rerun as a current operation.

The private source contract and both private birth journals remain **outside Git**. No query, account, credential, model, vector, payload or interpretation is retained here. Neither execution read the mapped-data inventory, models or archives, issued queries, locked memory, changed source caps, or restarted Qdrant. It changed only dedicated task files and the owned children’s membership/OOM preference.

Nine full v2 fixture tests passed locally and independently in root review before execution. One exact retained fixture requires the excluded private packet. Eight other real-process/schema/staging tests can run from the public checkout on Linux with Python>=3.9 and PIDfd/prctl support:

```bash
python3 -B docs/implementation/search-ranking/zero-placement-20261012/verify.py
```

This verifies public artifact hashes, the exact current five-file source digest and actual lifecycle receipts before running those eight tests. The shared zero-placement module separately has six tests, including actual kernel parent-death behavior. This evidence belongs to [task406](https://github.com/alp82/goodwatch-monorepo/issues/406), preparation [PR465](https://github.com/alp82/goodwatch-monorepo/pull/465), and map100’s unfinished performance/acceptance work.

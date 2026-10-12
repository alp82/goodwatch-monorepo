# Running adoption admitted; turnover refused before comparison

The one root-owned invocation returned exit 1 after 97.748 seconds. Adoption, preflight and full staging returned successful preparation receipts. Turnover then completed a recorded clean stop and restarted NEW, before refusing `running_unheld_scope_unproven`. The final status remains `failed-or-cleanup-unknown`; there is no completed comparison or latency result.

[The exact public output](root-public.ndjson) contains four frames in 57,852 bytes: three operation receipts and the final external completion receipt. [The separate local return](root-return.json) records the invocation SHA, merged source commit, UTC bounds and observed exit 1. [The original stderr](root-stderr.txt) is empty. The folder date follows the local observation date; the attempt ran from `2026-10-12T22:32:02.367755+00:00` to `2026-10-12T22:33:40.115517+00:00`.

Adoption created 17 admission files and recorded one intent, one success receipt and the first v2 handoff. Full staging created 27 public files and verified 25 code/manifest files plus the copied Node binary and its provenance. These are preparation receipts with `pinAdmission: false`, not pinning or query-readiness proof. The initial running-unheld sample reports host `MemAvailable` 4,445,573,120 bytes, above its frozen 4,294,967,296-byte strict floor. It establishes that sample only; it does not predict later admission or comparison success. The adopted source and old consumed recovery evidence remain distinct.

Turnover retains a specific `clone-child-term.clean.v1` receipt: SIGTERM, no KILL fallback, old wrapper/Qdrant births gone, and stopped Docker exit zero. Its child status is explicitly inferred from wrapper/Docker rather than directly observed. NEW was subsequently observed running with `StartedAt` `2026-10-12T22:32:34.193366987Z`; OLD remained observed stopped. This completed intermediate stop does not prove clean release of the whole attempt or a successful turnover handoff.

Benchmark-site cleanup refused `lifecycle_handoff_changed` and remains unknown. Independent cleanup observed the stager handoff SHA and the current endpoints without promoting them to continuation authority. `continuationAllowed: false`, `allRegisteredLifecycleExitsProven: false` and `unknownUnregisteredChildrenAbsentProven: false` remain explicit. Producer-name absence was observed with ownership unknown, null birth/container-gone proof and no cleanup action. Local SSH exits are retained separately and do not prove remote disappearance. No producer/consumer transport ran, no benchmark frames or pairs were retained, and no consumer audit exists. Ordinary searches and history writes are reported zero; no private payload was persisted.

The separate later [read-only context](root-readonly-scope-context.json), observed at `2026-10-12T22:35:46.417072+00:00`, describes the same restarted NEW wrapper/Qdrant births (PIDs 3878635/3878687, start ticks 3067647180/3067647204). Both observed members had `VmLckBytes: 0`; source `unevictable` was zero. It reports absolute `memory.events.max: 1139`, `oom: 0` and `oom_kill: 0`, with `memory.current: 6,284,115,968` and the unchanged `memory.max: 6,442,450,944` (6 GiB). Host `MemAvailable` was 4,520,439,808 bytes. This is not a failure-time sample or interval delta. It cannot identify which conjunct caused the earlier aggregate refusal, prove a capacity deficit, establish exclusive memory ownership, or repair unknown cleanup. The context explicitly grants no continuation authority and reports zero writes/searches and no VM resize.

[Evidence bindings](evidence-bindings.json) preserve all four original artifacts byte for byte and bind the execution to merged source `8af144909e4ed22da3ce406c037a2fb6f45b08ea`, source14 freeze `f13494c945e5a4fe719f848fbe9bc5fe724508f0f699491fea55b69dba8a3cad`, full manifest `d80f7469edf903c1149b88ecb12b3be443c6f49be5188c27d34d5427ac7dca4e`, intent and Node receipt. The reviewed preparation remains separate from this actual outcome. This publication changes no source, guard, cap, threshold or VM resource. The consumed scope is not retried and no handoff repair, automatic continuation, production acceptance or acceptance window is claimed. Tracking remains with #100 and #407; #406 stays closed.

To reproduce the artifact integrity check locally, run from this directory:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
bindings = json.loads(Path('evidence-bindings.json').read_text())
for name, expected in bindings['files'].items():
    raw = Path(name).read_bytes()
    assert len(raw) == expected['bytes']
    assert hashlib.sha256(raw).hexdigest() == expected['sha256']
rows = [json.loads(line) for line in Path('root-public.ndjson').read_text().splitlines()]
assert len(rows) == 4
assert [row.get('operation') for row in rows[:3]] == ['adopt-running-clone', 'preflight', 'stage']
final = rows[-1]['receipt']
assert final['status'] == 'failed-or-cleanup-unknown'
assert final['remoteFailureEvidence']['reason'] == 'running_unheld_scope_unproven'
assert final['frames'] == [] and final['consumerAudit'] is None
assert final['allRegisteredLifecycleExitsProven'] is False
assert json.loads(Path('root-return.json').read_text())['exitCode'] == 1
print('Exact artifact hashes and failed disposition verified; no acceptance inference.')
PY
```

# Failed resource window: 12 October 2026

The scheduled 11:10–11:40 UTC read-only resource window failed at 11:10:10.045729 UTC after five retained samples. The original reader emitted `source_changed`, exited 1, and is proven gone without TERM or KILL. Its clean-exit flag is false. There is no completed window, no observation of the scheduled 11:15 backup, and no resource ceiling or latency acceptance result. Coverage is UNKNOWN. Remaining latency work stays on [map #100](https://github.com/alp82/goodwatch-monorepo/issues/100); issue #406 is closed and #407 remains open.

The byte-identical combined journal, three fresh pre-window fences, post-failure preflight, original executed reader, numeric audit and local argv reproduction are retained here. [provenance.json](provenance.json) pins their hashes and distinguishes executed evidence from the new prepared diagnostic source. Root owned all host execution. This preparation ran no host commands, searches, cache controls or duplicate window.

The five successful rows span 11:10:00.006256–11:10:08.044391 UTC. They retain source PID 3411704/start ticks 2673362807, unchanged source identity and one-member source-cgroup hashes, zero source and reader VmLck, and complete sibling-cgroup censuses. Every SSH/userspace census is incomplete with reason `census_bound`. That independently prevents full coverage. These samples do not establish source identity or membership at the missing failing sample. The post-failure preflight's unchanged source hash is also a later observation, not evidence of the trigger at failure.

The original failure reason is ambiguous between the sample's before/after source comm, executable, birth or cgroup checks and its before/after membership comparison. Initialization succeeded; the final-window fence was not reached. The asynchronous Docker checker converts its failures to a different fixed reason. A transient helper/healthcheck process remains a hypothesis, not an attributed cause. No failed sample was retained to resolve it.

# Reproduced census defect and prepared instrumentation

The reviewed launcher embeds the original 25,549-byte Python reader in a Python `-c` child, with its parent-death guard and exact run arguments. Evaluating that launcher's child-code expression without launching it yields 27,644 bytes of code and a 27,678-byte proc-shaped argv with an illustrative six-digit parent PID. The existing census reads every eligible `python3` command line with an 8,192-byte bound before determining whether it is a backup. Its own launched reader therefore exceeds that bound if encountered. A temporary proc-shaped fixture reproduces `census_bound` with the original executed reader and `argv_limit` with the new diagnostic reader. This proves the self-induced bound failure mechanism, while not identifying which eligible process was encountered first in the actual census.

The revised `goodwatch-qdrant/diagnostics/resource_window.py` remains prepared only. It preserves rejection and coverage gates while adding fixed trigger/phase evidence: source comm/executable/birth/cgroup, sample/final membership, and process-census process count/deadline/argv/eligible identity/SSH count bounds. Only allowlisted numeric counts/start ticks and hashes accompany triggers. Raw process names, argv, paths, environments and OS errors are excluded. The 4,096-process, one-second, 64-SSH-process and 8,192-byte argv bounds remain unchanged. VmLck, source/cap/ancestor checks and reader placement still reject as before.

No process exemption is implemented. A possible follow-up would exempt only the reviewed inspector itself, identified by its own PID/start ticks with start/end fences and a numeric exclusion count. It would not ignore generic oversized Python processes or identify a backup from a truncated argv. That design requires separate root review; source-change guards remain unaffected.

# Offline verification

From this directory, verify retained bytes:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
proof = json.loads(Path('provenance.json').read_text())
for name, expected in proof['files'].items():
    data = Path(name).read_bytes()
    assert len(data) == expected['bytes']
    assert hashlib.sha256(data).hexdigest() == expected['sha256']
rows = [json.loads(line) for line in Path('resource-window-actual-20261012-1110-v1.jsonl').read_text().splitlines()]
samples = [row for row in rows if row['event'] == 'resource-window.sample.v1']
assert [row['sample'] for row in samples] == list(range(5))
assert rows[-2]['event'] == 'resource-window.failed.v1'
assert rows[-2]['reason'] == 'source_changed'
receipt = rows[-1]
assert type(receipt['exitCode']) is int and receipt['exitCode'] == 1
assert receipt['readerGoneProven'] and not receipt['clean']
assert not receipt['termSent'] and not receipt['killSent']
assert all(not row['sshUserspace']['complete'] for row in samples)
print('Retained failure bytes verified; coverage remains UNKNOWN.')
PY
```

From the repository root, run `python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics -p test_resource_window.py`. The regressions preserve source-birth and added-member rejection, retain numeric trigger evidence, reproduce the exact reviewed launcher argv defect against the original source, reject unsafe diagnostic fields, and suppress unsafe error text. Existing cadence, clock-drift, placement, lock, budget and no-inspection default checks remain. Do not rerun historical host diagnostics to reproduce this evidence.

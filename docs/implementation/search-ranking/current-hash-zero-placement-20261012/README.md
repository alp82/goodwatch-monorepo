# Current-code zero-placement evidence

For [map #100](https://github.com/alp82/goodwatch-monorepo/issues/100), the root agent executed the existing production zero-placement gate on 12 October 2026. Its timestamped inner frames cover 11:31:46–11:31:49 UTC. This checks permissions, process placement and bounded holder lifecycle using the current five-file code digest. It does not activate production pinning.

[The exact journal](actual-zero-placement.jsonl) contains 12 fixed-field frames, 4,237 bytes, SHA-256 `2a9b79045c6cb07d1ebad6c0dacb9f128a12f54afa18bc83895b1a2c17714989`. [Provenance](provenance.json) records the executed code and transport hashes. All five code files are byte-identical to this PR's repository base. The contract is represented only by its digest; its contents and private path inputs are excluded.

| Registered holder mode | Recorded exit | Graceful release acknowledgement | Holder exited | VmLck |
| --- | ---: | --- | --- | ---: |
| Close | 0 | true | true | 0 |
| SIGTERM | -15 | false | true | 0 |
| SIGKILL | -9 | false | true | 0 |

Each joined frame verifies placement in the source cgroup and the parent outside it. The source PID/start ticks remain `3411704` / `2673362807`; the source identity digest is unchanged before and after. Docker memory, swap and CPU settings remain zero, with unlimited live memory/max/high and CPU limits, and `memory.oom.group` zero. The final source frame records unchanged allocation. The pinned gate also checks unchanged resource-event counters internally; the journal does not retain their numeric baselines or deltas for independent reconstruction.

The CLI exited zero and the outer supervisor verified the exits of **three registered holders only**. Its `unknownEarlyChildrenPossible: true` remains explicit. This is not a complete census of every possible unregistered early child. The outer receipt's registration-journal digest differs from the digest of the published combined journal.

All three holders had `VmLck=0`. Here `released: true` records holder exit; it does not demonstrate unlocking an actual pinned working set. The completion frame records zero queries, inventory reads, archive reads, model reads and locked bytes. This run establishes no mlock coverage, latency improvement, headroom, backup-pressure protection or production activation. It contributes no seven-day acceptance evidence; #407 remains open, and the historical closure of #406 does not establish completion of the latency goal.

To reproduce the local code digest from the repository root, without host access:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, json
folder = Path('goodwatch-qdrant/diagnostics/pinning-prototype')
evidence = Path('docs/implementation/search-ranking/current-hash-zero-placement-20261012')
proof = json.loads((evidence / 'provenance.json').read_text())
digest = hashlib.sha256()
for name in proof['code']['orderedFiles']:
    data = (folder / name).read_bytes()
    assert hashlib.sha256(data).hexdigest() == proof['code']['individualSha256'][name]
    digest.update(name.encode() + b'\0' + data + b'\0')
assert digest.hexdigest() == proof['code']['combinedSha256']
data = (evidence / 'actual-zero-placement.jsonl').read_bytes()
assert len(data) == proof['journal']['bytes']
assert hashlib.sha256(data).hexdigest() == proof['journal']['sha256']
assert len(data.splitlines()) == proof['journal']['frames']
print('Code and exact journal hashes verified')
PY
```

Local validation checked every journal key and scalar value against the public output schema, exact hashes, source identity continuity, the three recorded exit modes, placement and zero-read/zero-lock fields. Existing `test_zero_placement.py` fixtures exercise registration failure, source/counter failure, real close/TERM/KILL exits and parent-death cleanup. These local fixtures remain separate from the actual production permission/lifecycle evidence.

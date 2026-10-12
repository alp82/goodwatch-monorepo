# Search acceptance checkpoint: 08:44–11:00 UTC on 12 October 2026

This closed partial interval contained no recorded search lifecycle events, ingress search responses or history rows. First usable results N=0 and p95=null; completed computation N=0 and p95=null. It provides no latency result or seven-day acceptance. [Map #100](https://github.com/alp82/goodwatch-monorepo/issues/100) tracks the remaining work; [#407](https://github.com/alp82/goodwatch-monorepo/issues/407) remains open. Issue #406 is closed by owner decision.

Root executed the three previously prepared read-only commands once after 11:00 UTC and reported exit 0 for each. The exact outputs and executed source bytes are retained alongside [provenance.json](provenance.json). This checkpoint generated no ordinary searches, provider calls or history writes and changed no application, proxy, collector or service. The reported command exits have no separate retained supervisor receipts.

| Coverage stream | In-window heartbeats | Maximum fenced gap | Gaps over 45 seconds | Restarts/problems/unavailable |
| --- | ---: | ---: | ---: | --- |
| vector1 core | 816 | 10.467 s | 0 | 0/0/0 |
| vector1 ingress | 816 | 10.199 s | 0 | 0/0/0 |
| abio ingress | 816 | 10.049 s | 0 | 0/0/0 |

All three streams have heartbeats on both sides of the interval. Both ingress collectors report logging ready and the images match the [11 October activation](../ingress-activation-20261011.json). No 5xx responses or collector problems were observed. Heartbeats cannot rule out failures before the selected router, silent Docker log loss, DNS/TLS/connectivity failures or browser delivery problems. The output's fractional timestamp digit counts describe the entire retained ingress journal; they are not response samples from this zero-response interval.

Both search roles report commit `927d38b2cca815f02a0b1636ec06f63c24603396`, matching the [source alignment](../production-source-alignment-20261011.json), and image `sha256:603a4f364b813913edd3ce88e9c3a216b0740da2a03b01f73ed56fd319619d34`. Each role has one commit cohort across the window, and its current hashed container identity matches the collector's container. Collector service entry hashes, service PID/start ticks and search container metadata match the retained 08:44 inspection. These checks do not revalidate all collector dependency bytes or establish search latency.

The process check returned `nodeProcesses=[]` for both roles. The recorded `containerPid` and `containerStartTicks` refer to Docker's container State.Pid, not a proven Node executable. They establish the sampled container process metadata only. The checkpoint makes no Node executable, command or birth claim. Page source `922d2a5b…` was sampled after the window and does not prove page-source continuity throughout it.

The history audit fetched zero rows. Authentication occurs in memory without parsing or emitting plaintext. History insertion time and lifecycle acceptance time differ; neither anonymous telemetry nor a same-key row alone proves organic attribution. The old insertion-time probe exclusion lies outside this interval. This checkpoint must not be combined with the earlier one-result cohort as seven-day evidence.

# Reproduce the local evidence checks

Do not rerun host commands to verify this packet. From this directory, validate the five retained files against the manifest:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
p = json.loads(Path('provenance.json').read_text())
for name, proof in p['files'].items():
    data = Path(name).read_bytes()
    assert len(data) == proof['bytes']
    assert hashlib.sha256(data).hexdigest() == proof['sha256']
v = json.loads(Path('coverage-vector1-20261012-1100.json').read_text())
a = json.loads(Path('coverage-abio-20261012-1100.json').read_text())
h = json.loads(Path('history-checkpoint-20261012-1100.json').read_text())
assert not v['applicationAcceptance'] and not a['applicationAcceptance']
for coverage in [v['coreCoverage'], v['ingressCoverage'], a['ingressCoverage']]:
    assert coverage['heartbeatCount'] == 816 and coverage['fencesComplete']
    assert coverage['gapsOver45Seconds'] == 0
    assert coverage['collectorRestarts'] == coverage['unavailableHeartbeatCount'] == 0
    assert coverage['collectorProblems'] == {}
assert v['lifecycle']['eventCounts'] == {}
assert v['lifecycle']['firstUsableN'] == 0
assert v['lifecycle']['firstUsableP95Ms'] is None
assert v['lifecycle']['fullComputationN'] == 0
assert v['lifecycle']['fullComputationP95Ms'] is None
assert v['ingressResponses']['count'] == a['ingressResponses']['count'] == 0
assert h['sourceCount'] == h['rowsFetched'] == 0
assert all(s['nodeProcesses'] == [] for s in v['currentSearchSources'])
print('Checkpoint hashes and zero-traffic projections verified; acceptance remains false.')
PY
```

Root can also compare each retained output and source byte-for-byte with its existing mode-0600 local original. For the source-diff check, replace only the previous passive interval `06:00–08:44` and previous history interval `11 October 20:55–12 October 06:00` with this `08:44–11:00` interval, then compare bytes. The original source and output hashes are pinned in the manifest. No other source changes occurred. The original prepared execution recipe hash is retained; its prepared-only language describes its pre-execution state.

The passive inspector's zero-valued detailed lifecycle projection is usable here because every telemetry event count is zero. If future use reports `requiresDetailedNumericVerification`, use the canonical lifecycle verifier rather than these prefilled zeros. The history helper uses only SELECT; it is historical execution evidence, not an instruction to repeat the query.

The agreed finish condition remains a fresh seven-day production window after the final fix rollout with no errors and nearest-rank p95 first usable results strictly below 1,500 ms, corroborated by history, lifecycle/history-write and ingress evidence with disclosed gaps. Empty provisional results do not count as usable; a final empty answer does. Aborted delivered searches remain in first-results latency, while failed/aborted completion is excluded from full computation timing. Server enqueue timing does not measure browser receive/paint. Open-result feedback remains deferred.

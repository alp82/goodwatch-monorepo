# Exact created-clone recovery, prepared source

The original setup stopped the owned CPU2 clone cleanly, created the CPU0 clone,
then refused its HostConfig parity before start. Docker 28.5.1 had normalized
the present `OomKillDisable` value from JSON null to false. The original failed
run and its durable clean-stop receipt remain authoritative evidence. This
successor starts that exact existing object once; it does not rerun creation or
reuse failed benchmark results.

The accepted design v2 has SHA256
`36231574f3b8fe54ed46a3aecf5e430c116244eadce0c42bc0a0e3fae2f229a0`.
Its original actual Opus 5.5 medium design review was **BLOCK**. The v2 text
incorporates those five findings and root accepted it separately; v2 is not a
model PASS. The immutable design packet is retained locally at
`/home/alper/projects/search-100-evidence/cpu0-never-started-recovery-design-v1-20261012`.
Final exact source still receives focused model and root review before any
root-owned execution. This document reports preparation, not runtime success.

Only the exact original public failure and created-config proof bytes are
accepted (SHA256 `ad0b490d3d39d2259d86290d4883038a33461e85fe00f1842761fb214d39a84c`
and `27b99d3853e0048c38ce84cda33fabd7ca4e270c23e21b84f1cc8279c4df1edd`).
They bind both actual container ID hashes, original stopped state/configuration
hashes and the durable OLD clean receipt. Each proof is bounded to 64 KiB.
Raw container IDs, Config, HostConfig and Env remain private in memory.

The closed SSH and local import orders add `recovery` after `setup`. All fourteen
backend source bytes, consumer modules, original reclaim helper, producer and
model guards remain unchanged. The fixed operation
`setup-recover-never-started` targets the existing diagnostic host only. Both
the authenticated packet and CLI must explicitly choose
`recover-created-never-started.v1`; setup remains the default and no fallback
or automatic retry exists. The receipt binds bootstrap's actual authenticated
external closure marker, not a caller-provided hash alone.

Recovery authenticates the exact 17 existing admission files and prior writer
and control census under the original inode-fenced control lock. It requires
OLD's original stopped state and clean receipt, NEW's original created state,
PID 0, year-one start/finish times, restart count 0 and OOM false. No live source
PID or historical cgroup placement is claimed before start. Own birth/VmLck 0
and target-subtree exclusion are measured; existing exact-ID cgroup subtrees
must be empty. Missing groups do not prove historical placement.

Full Config and normalized non-CPU HostConfig use canonical JSON bytes, so
false and integer 0 cannot compare equal. Only **present OLD null to present
NEW literal false** is accepted before start. All other keys remain exact,
including the existing CPU, mounts, restart and cpuset checks. After start only
that same present field may be false or null; every other key remains exact.
Receipts distinguish raw hashes from semantic parity and never claim a new
creation or writable-layer parity.

These are narrow rules supported by tagged Moby sources:
[nil defaults to false and resource verification can discard the field](https://github.com/moby/moby/blob/v28.5.1/daemon/daemon_unix.go#L351-L354),
[start verifies resource settings](https://github.com/moby/moby/blob/v28.5.1/daemon/start.go#L57-L60),
and [the start endpoint accepts an empty body and returns 204](https://github.com/moby/moby/blob/v28.5.1/api/server/router/container/container_routes.go#L188-L211).
Fresh GET `/version` must still report daemon 28.5.1/API 1.51; this is version
metadata, not a binary attestation.

Full host admission stays strictly above 5 GiB before start. CPU/load/PSI,
swap, allocated/free disk and immutable source fences remain intact. A bounded
loopback refusal is only a point-in-time port-conflict check. After admission,
an O_EXCL root-0600/fsynced attempt receipt spends the one attempt. Source and
configuration are inspected again after publication. The only mutation is an
empty-body POST to the fresh authenticated raw NEW ID. Every socket operation
uses the remaining shared 15-second deadline; no per-I/O 15-second renewal.
HTTP 204 acknowledges the request, and is neither CLI exit 0 nor running proof.
Disconnects retain POST-issued uncertainty; earlier version GETs never count
as a start. Unsupported or malformed HTTP framing refuses rather than guesses.

Standard bounded metadata readiness and actual fresh source/birth admission
follow. Prior/control census and admission file identities renew with the live
wrapper, Qdrant and parent identities protected. The first fresh handoff retains
owner `setup` and previous hash null for the unchanged consumer contract.
Runtime resource admission retains its existing `>= 5 GiB` boundary; setup's
prestart host function remains strict `> 5 GiB`. Neither is a capacity prediction.

Nonzero/unknown start or any later refusal retains the attempt and observed
endpoints with continuation false. Success-path lock-close failure retains the
completed receipt separately and remains a failure. No automatic stop, remove,
restart or resume follows. A later admission refusal can leave NEW running;
this successor does not authorize another recovery from that state.

Local preparation example (placeholder paths, no host action):

```bash
/usr/bin/python3 -I -B build_packet.py --prepare-reviewed-public-packet \
  --source-dir /ABS/FROZEN/BACKEND --consumer-dir /ABS/FROZEN/CONSUMER \
  --reclaim-helper /ABS/FROZEN/prepare_clone_reclaim.py \
  --external-dir /ABS/FROZEN/EXTERNAL --prior-policy /ABS/RETAINED/prior-policy.json \
  --recovery-output /ABS/RETAINED/original-public-failure.ndjson \
  --recovery-config-proof /ABS/RETAINED/created-config-proof.json \
  --output /ABS/NEW/execution-packet.json \
  --local-execution-closure /ABS/NEW/local-execution-closure.json
```

Root alone uses the reviewed local entry with the exact closure, packet, outer,
contract and validator hashes and `--initial-mode recover-created-never-started.v1`.
The unchanged 7,200-second outer budget and explicit bounded cleanup remain;
recovery adds no model, query, ordinary search/history write, snapshot-cache
operation, or latency/7-day acceptance claim.

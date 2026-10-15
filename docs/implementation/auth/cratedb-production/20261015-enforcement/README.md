# Password enforcement execution — October 15–16, 2026 UTC

## In progress: crate-02 passed, crate-03 draining

The owner explicitly approved decommission with force=false, zero primaries then normal
`docker stop --timeout=-1` (SIGTERM, unlimited grace), in order **crate-02 → crate-03 → crate-01**.
No further KILLs. No SIGKILL/forced grace. First-node client failure requires HBA rollback and a stop.
Coolify stays owner-UI-only; existing page `admin` is permitted. Main merge follows successful enforcement/tests.

See the [runbook](../../cratedb-production-rollout.md). Every actual stop is host-managed by a transient systemd
unit, preserving unlimited grace even if the operator's SSH connection drops. Each attempt uses a unique unit.
The executor checks restart=no before changing allocation and rechecks zero primaries immediately before SIGTERM.

## Verified preparation

- Merged current main `c1d23766` as `06ae0838`; procedure commits `2e8590c3`, `bcd492d0`, `6925d194`.
- Crate tests **38/38**, renewed isolated mixed-node HBA rehearsal **431/431**, cleanup verified.
- Full webapp suite **2921 passed / 1 failed / 1 skipped / 1 TODO**. Failure is the previously reproduced/main owner-waived Qdrant connection-break timing test.
- Installed backup source SHA256 matches the reviewed source. Actual cron credentials identified as `goodwatch_backup`; read-only identity/snapshot queries succeeded with .11 excluded. [Receipt](backup-preflight.jsonl).
- Before-config/runtime copies protected on each host at `/root/cratedb-maintenance/562-enforce-20261015/`; reviewed render changes only HBA argv. Image/digest, mounts, volumes, private ports and other settings preserved. [Stage](stage.jsonl).
- Safety snapshot `pre_hba_562_20261015232836` independently SUCCESS. All **18 BLOB files / 126,888,186 bytes** copied to protected storage on .11 and SHA1 verified. [Snapshot](snapshot.jsonl), [BLOBs](blobs.jsonl).
- [#563](https://github.com/alp82/goodwatch-monorepo/issues/563) supplies the successful same-repository SQL and separate BLOB restore drill.
- Adversarial Opus reviews: [initial](opus-review.txt), [follow-up](opus-followup.txt). The follow-up conditionally approves once two executor blockers are fixed. Both were resolved before drain: restart=no assertion inside `drain.py`; explicit failed-gate rollback first restores allocation all and GREEN before its drain. Earlier node-order, SSH-stop-lifetime, PostgreSQL-tool and contradictory-document findings were also fixed. Source receipts record final executors.
- PostgreSQL probe prepared on .11; Docker .12 is 28.5.1, supports `--timeout`; systemd 249. StopSignal unset means SIGTERM.

## First node: crate-02

- Drain began **23:37:56 UTC**, acknowledged **23:44:56.807** (419.6s). Immediately rechecked zero primaries, zero missing shards, zero unsettled target copies and force=false.
- Normal stop unit `gw-crate-stop-562-12-234459`: Docker event **signal 15**, exit **143**, no OOM/SIGKILL. Container finished **23:45:05.844**. [Drain/stop receipt](drain-12.jsonl).
- Same original ID/image/volume/env/private binds, HBA=true; trusted loopback `crate` and users ready **23:45:48**. [Rejoin](rejoin-12.jsonl).
- Against **.12 only**: correct credentials passed for admin from both page hosts, search-a/b, actual Windmill worker, backup helper/snapshot read, all three stored Kuma monitor credentials, installed readonly profiles, and all six canonical roles. Missing/wrong HTTP cases returned401. [Gate](client-gates12.jsonl).
- PostgreSQL correct readonly password passed; missing crate/readonly and wrong readonly passwords refused with PGPASSWORD unset and passfile disabled. [PG gate](pg-gate12.jsonl).
- Actual page node-crate drivers preserved credential bytes and returned admin. Search BLOB GET through .12 followed the ordinary private redirect to .11 and passed. Actual ad-hoc script through the installed readonly launcher returned goodwatch_readonly. [Pages](page-driver12.jsonl), [BLOB](search-blob12.jsonl), [script](script-driver12.json).
- Allocation restored all **23:47:09.850**. All endpoints independently passed **96 GREEN / 962 STARTED/STARTED / 21 checks / allocation all** at **23:52 UTC**. [Recovery](recovery12.jsonl).
- Real Windmill canary pinned to .12 passed actual crate-python, deployed connector, monitoring/sitemap reads and authenticated BLOB HEAD. No production data writes. Job `01a141f9-36f0-9722-9ba3-f66d257cba95`. [Result](first-canary-v2-result.json).
- All Kuma monitors UP. Rechecked current page/search containers before the second drain after external replacements. [Kuma](kuma-after12.jsonl), [fresh app checks](apps-refresh12.jsonl).

### Operator probe corrections and observation limits

The first extra Windmill preview replaced `db.con` to restrict the endpoint but retained `db.cur` attached to its
closed old connection. It failed with ProgrammingError/Connection closed after its direct-driver check. Resetting
its cursor to the new connection fixed the probe; the corrected canary passed. [Sanitized error](first-canary-failure.json).
The first extra ad-hoc CLI probe lost the multiword SQL argument through SSH command parsing; the server returned SQL
parse400 for `SELECT`. The argument-preserving subprocess invocation passed. Neither was a production authentication
failure; no credential or deployed connector repair was made.

The first observer stopped when node check1 reported the expected two-node interval against configured three data
nodes. Read-only classification confirmed only this gateway count check; no missing primary. Planned rejoin restored
all21 checks. Later observers distinguish that expected transient condition; between-node gates remain strict.

External automatic page deployments replaced containers repeatedly. Tests discover the current containers, and
fresh gates recheck credentials. Captured logs have no terminal `crate.query` failure in retained samples, but these
are minima and do not prove complete-window zero errors; old removed-container logs are not retained by this run.

## Remaining

Complete crate-03 and crate-01 with identical gates; observe credential-bearing scheduled backup; verify final
clients and cluster; merge current main and rerun relevant tests before the authorized #599 merge. No Coolify writes.

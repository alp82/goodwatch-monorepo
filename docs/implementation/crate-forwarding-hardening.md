# Crate Docker forwarding hardening — owner runbook (#669)

Status: inventory and proposed procedure only. Collected 2026-10-26 UTC from
initial origin/main `bb1265d4a`; owner-decision follow-up starts from
origin/main `084697a87` (original runbook merged as `aa4cef22d`).
**No host firewall, Docker, Crate configuration or data was changed.** The owner applies changes after review. Do not push this branch
or execute the mutation blocks as part of agent inventory.

## Evidence and actual clients

Read [issue #669](https://github.com/alp82/goodwatch-monorepo/issues/669) including
its empty comment thread and the linked October 16 evidence at commit
`387636b42b95a4f292321be633f4ec579ed6f991`:
[inspection](auth/cratedb-production/20261016-auth-preparation/README.md),
[summary](auth/cratedb-production/20261016-auth-preparation/firewall-summary.json),
`firewall-11.txt`, `firewall-12.txt`, `firewall-13.txt`, `database.json` and
`completion.json` in that directory. The historic counts are 268/242/237;
**current** uncommented IPv4+IPv6 rule counts are **279/242/237**. These are
whole-host counts, including unrelated generated rules, not Crate exposure counts.

The new read-only collection used private root SSH, host and container-network
`ss`, Docker inspect, `iptables -S`, NAT rules, `nft list ruleset`, Crate loopback
SELECTs, root crontab and backup log reads, and read-only Uptime Kuma SQLite.
Initial inventory began 00:16 UTC; three further connection samples per host
were spaced 10 seconds apart. All 15 hosts were inspected: `.10–.21`, `.30–.32`.
Raw scratch evidence is mode 0600 under `~/.cache/gw-work/669/` on the agent's
machine; it must stay private. It includes unrelated addressing. Only the
sanitized [inventory](crate-forwarding-inventory-20261026.json) is committed.
No SQL statement text, credential values, public IPs or unrelated rules are
published. Querying sys tables creates ordinary query log entries.

| Client | Evidence | Server-visible source and ports | Policy implication |
| --- | --- | --- | --- |
| Webapp on `.21` | Node process in `gk4owk8-20261026T000721`, `172.23.0.6`; connections to every coordinator; server sees `.21` | `10.0.0.21`, HTTP 4200 | Allow HTTP; preserve auth traffic |
| Search on `.20` | `goodwatch-search-a`/`-b`, `172.25.0.4`/`.5`, and another app process `172.25.0.8`; all contact every node; server sees `.20` | `10.0.0.20`, HTTP 4200 | Allow HTTP |
| YepWatch API on `.21` | API container `172.18.0.3` connects to every coordinator; `yepwatch_catalog` and `yepwatch_runtime` occur in jobs log | `.21`, HTTP 4200 | Covered by `.21`; do not restrict to GoodWatch auth identity |
| Windmill default worker on `.15` | Python socket to `.11`, matching `.11`'s `.15` peer | `.15`, HTTP 4200 | Observed HTTP client |
| Windmill default worker on `.18` | Python sockets to all three, matching server peers | `.18`, HTTP 4200 | Observed HTTP client |
| Windmill default worker on `.11` | Repeated sample catches connections to `.11/.12/.13`; network is `br-windmill`, `172.28.0.0/24` | Local bridge source for local destination; host SNAT for remote destinations | Allow local bridge HTTP and private host HTTP |
| Other deployed Windmill workers | Containers inspected on `.10/.12/.13/.14/.16/.17/.19/.20/.21/.30/.31/.32`, including highperf on `.10/.20`; no Crate socket caught in these samples | Not established by snapshot | Retain their exact host IPs and local `.12/.13` bridge HTTP provisionally; verify a normal job before rollout |
| Monitoring on `.10` | Three active Uptime Kuma HTTP json-query monitors, one per node, interval 60 seconds; server sockets from `.10` to each | `.10`, HTTP 4200 | Allow HTTP; Alloy has no Crate target in inspected configs, no Crate socket caught |
| Backups on `.11` | Root cron at minute 5 each hour, `goodwatch_backup`, password file; log confirms 00:07:31 successful run; `backup.py` tries `.11`, then `.12/.13` | Scheduled host HTTP client; no backup socket during sample | Keep host-origin local HTTP and `.11` remote HTTP; snapshot files use mounted storage, not another Crate port |
| Crate peers | Every node has 13 inbound transport sockets from each of the other two, plus outgoing sockets | Other `.11/.12/.13`, transport 4300 | Allow only these three host IPs for transport |
| PostgreSQL clients | No established 5432 socket in any Crate namespace; `sys.nodes.connections.psql`: open 0, lifetime total 4 per node | Historical clients unknown | Owner decided: deny forwarded 5432, no admin exception |

Initial server-side incoming HTTP socket counts:

| Coordinator | `.10` | `.15` | `.18` | `.20` | `.21` |
| --- | ---: | ---: | ---: | ---: | ---: |
| `.11` | 1 | 1 | 1 | 7 | 6 |
| `.12` | 1 | 0 | 1 | 5 | 3 |
| `.13` | 1 | 0 | 1 | 5 | 3 |

All nodes report Crate 5.10.16; transport open=26 each. HTTP open varies
(roughly 10–17, including the inventory request). `sys.jobs` saw
`goodwatch_windmill` (4), `goodwatch_auth` (1), and the inventory's `crate` (1).
`sys.jobs_log` also saw `admin`, `yepwatch_catalog`, `yepwatch_runtime`.
These tables identify users, **not remote source IPs or protocol**; attribution
above comes from sockets/configuration, not usernames alone. They are bounded
samples, not a full backup/worker cycle. `sys.snapshots` reads timed out after
15 seconds on all three endpoints; no cancellation or settings change followed.
The backup log supplies success evidence; snapshot state was not independently
verified by that query.

## Proposed boundary and decisions before applying

Use IPv4 iptables through the installed nft compatibility backend, not a native
nft Docker ruleset: all three hosts run Docker 28.5.1, iptables 1.8.7 `(nf_tables)`,
with `FORWARD -> DOCKER-USER -> DOCKER-FORWARD` before UFW forwarding chains.
The initial inventory mapped each private host address to `172.19.0.2` on the
same port. Follow-up network inspection finds `.13` Crate now on
`172.20.0.0/16`; inspect live NAT/container addresses again before rollout.
Original-destination matching below deliberately does not hardcode container IPs.
Compose publishes only `${SELF_IP}:4200/4300/5432`.
[Docker documents DOCKER-USER and original-destination matching](https://docs.docker.com/engine/network/firewall-iptables/);
[UFW INPUT does not protect these published ports](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

Owner decisions: deny forwarded PostgreSQL with no admin exception; implement
the allowlist first. Docker/UFW generated-comment work is the separate later
project [#775](https://github.com/alp82/goodwatch-monorepo/issues/775), not an
allowlist rollout prerequisite. The owner applies this procedure.

Proposed HTTP/transport policy for final review:

- HTTP: exact private host IPs `.10–.21` and `.30–.32`, covering observed clients
  plus deployed workers whose transient jobs were not caught. This trusts every
  workload SNATed behind those hosts; it is not per-container authentication.
- Local HTTP: `-i br-windmill -s 172.28.0.0/24` on each Crate host. Inspect labels,
  subnet and pinned bridge before use. Never allow arbitrary `172.16.0.0/12`.
- Transport: only `.11/.12/.13`. The self entry supports host-origin paths;
  peer replication must stay healthy after each node's change.
- PostgreSQL: reject forwarded connections from all sources. The owner chose no
  administration exception; there are no 5432 allows in the generator.
- Restrict only ORIGINAL-direction connections whose original destination is
  this host's published address and port. Authorized sources RETURN to existing
  DOCKER-USER rules, preserving existing address blocks and Docker isolation.
  Reject unauthorized traffic with TCP RST, including pre-existing unauthorized
  flows. Do not install a blanket ESTABLISHED ACCEPT ahead of the restriction.

This protects **published forwarding**. Host-origin OUTPUT traffic (including
local backups), container loopback, and direct same-bridge access do not acquire
this boundary. Inventory/routing tests must establish whether direct container
address access needs a separate bridge/container-input policy. Do not claim
all Crate access is source-filtered. No IPv6 published bindings were observed;
stop and design IPv6 equivalents if that changes. No provider/public route test
was done. See [Crate system tables](https://cratedb.com/docs/crate/reference/en/latest/admin/system-information.html).

## Ordered owner procedure

Run on **one node at a time**, `.11`, then `.12`, then `.13`. Keep an existing
SSH session and verify a fresh private SSH login at every checkpoint. Commands
below are a proposed owner rollout; none were run by the agent. PostgreSQL and
project ordering are decided; complete the remaining traffic/lifecycle checks.
Stop on any failed checkpoint and use the rollback; do not proceed to the next host.

### 1. Capture state and validate topology (read-only apart from evidence files)

On the selected host, as root:

```bash
set -euo pipefail
umask 077
export TMPDIR=/root/.cache/gw-work/669
mkdir -p "$TMPDIR"
NODE=11                         # Change to 12 or 13 on the corresponding host.
SELF=10.0.0.$NODE
CRATE=crate-0$((NODE-10))
EVIDENCE="$TMPDIR/before-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "$EVIDENCE"
iptables-save > "$EVIDENCE/iptables.save"
ip6tables-save > "$EVIDENCE/ip6tables.save"
nft list ruleset > "$EVIDENCE/nft.txt"
ufw status verbose > "$EVIDENCE/ufw.txt"
ufw show added > "$EVIDENCE/ufw-added.txt"
docker inspect "$CRATE" > "$EVIDENCE/crate.json"
docker network inspect windmill_default > "$EVIDENCE/worker-network.json"
iptables --version
iptables -S FORWARD
iptables -S DOCKER-USER
docker inspect "$CRATE" --format '{{json .HostConfig.PortBindings}}'
docker network inspect windmill_default --format '{{json .Labels}} {{json .IPAM.Config}} {{json .Options}}'
PID=$(docker inspect "$CRATE" --format '{{.State.Pid}}')
nsenter -t "$PID" -n ss -Hnt state established '( sport = :4200 or sport = :4300 or sport = :5432 )'
```

Checkpoint: bindings match this private host, the worker network has Compose
project `windmill`/network `default`, subnet `172.28.0.0/24`, pinned
`br-windmill`; FORWARD reaches DOCKER-USER first. Record existing deny rules.
Stop on mismatch, native nft Docker backend, unexpected IPv6 exposure, unknown
source or a pre-existing `GW-CRATE-669` chain. Baseline the allowed/denied probe
matrix in step 4 **before applying**, including the planned denied source.
Capture root `crontab -l` privately and wait through a normal worker/monitoring/
backup cycle if the provisional worker allowances are to be narrowed.

### 2. Prepare a dedicated generator and rollback, without loading rules

Create the following owner-managed script. It does not edit Docker/UFW-owned
rules. The generated policy is atomic within the filter table; chain creation
and hook insertion are separate and must be checked. All rules it emits carry
owner/purpose comments. Preserve any existing same-path file instead of replacing
it; on initial rollout the paths/chain must be unused.

```bash
install -d -m 700 /etc/goodwatch-crate-forwarding
printf '%s\n' "$SELF" > /etc/goodwatch-crate-forwarding/self-ip
cat > /usr/local/sbin/gw-crate-forwarding <<'SCRIPT'
#!/bin/bash
set -euo pipefail
exec 9>/run/lock/gw-crate-forwarding.lock
flock -x 9
SELF=$(cat /etc/goodwatch-crate-forwarding/self-ip)
case "$SELF" in 10.0.0.11|10.0.0.12|10.0.0.13) ;; *) exit 1 ;; esac
# This script must also run before dockerd, so it uses the reviewed pinned bridge.
# Network identity must be verified separately after Docker starts/recreates it.
RULES=$(mktemp /etc/goodwatch-crate-forwarding/rules.XXXXXX)
trap 'rm -f "$RULES"' EXIT
{
  echo '*filter'
  echo '-F GW-CRATE-669'
  for p in 4200 4300 5432; do
    match="-p tcp -m conntrack --ctdir ORIGINAL --ctorigdst $SELF --ctorigdstport $p"
    if [ "$p" = 4200 ]; then
      for n in 10 11 12 13 14 15 16 17 18 19 20 21 30 31 32; do
        echo "-A GW-CRATE-669 $match -s 10.0.0.$n/32 -m comment --comment \"gw-crate: private HTTP clients\" -j RETURN"
      done
      echo "-A GW-CRATE-669 $match -i br-windmill -s 172.28.0.0/24 -m comment --comment \"gw-crate: local Windmill HTTP\" -j RETURN"
    elif [ "$p" = 4300 ]; then
      for n in 11 12 13; do
        echo "-A GW-CRATE-669 $match -s 10.0.0.$n/32 -m comment --comment \"gw-crate: cluster transport\" -j RETURN"
      done
    fi
    echo "-A GW-CRATE-669 $match -m comment --comment \"gw-crate: reject unapproved port $p\" -j REJECT --reject-with tcp-reset"
  done
  echo '-A GW-CRATE-669 -m comment --comment "gw-crate: preserve other forwarding" -j RETURN'
  echo COMMIT
} > "$RULES"
# First run only; empty unattached chains grant no new permission.
iptables -w -S GW-CRATE-669 >/dev/null 2>&1 || iptables -w -N GW-CRATE-669
iptables -w -S DOCKER-USER >/dev/null 2>&1 || iptables -w -N DOCKER-USER
iptables-restore --wait 10 --noflush --test < "$RULES"
iptables-restore --wait 10 --noflush < "$RULES"
iptables -w -C DOCKER-USER -m comment --comment 'gw-crate: published port policy' -j GW-CRATE-669 2>/dev/null ||
  iptables -w -I DOCKER-USER 1 -m comment --comment 'gw-crate: published port policy' -j GW-CRATE-669
# An owned early hook provides enforcement before dockerd starts at boot/restart.
iptables -w -C FORWARD -m comment --comment 'gw-crate: forwarding guard' -j DOCKER-USER 2>/dev/null ||
  iptables -w -I FORWARD 1 -m comment --comment 'gw-crate: forwarding guard' -j DOCKER-USER
SCRIPT
chmod 700 /usr/local/sbin/gw-crate-forwarding
bash -n /usr/local/sbin/gw-crate-forwarding
cat > /usr/local/sbin/gw-crate-forwarding-rollback <<'SCRIPT'
#!/bin/bash
set -euo pipefail
exec 9>/run/lock/gw-crate-forwarding.lock
flock -x 9
while iptables -w -C FORWARD -m comment --comment 'gw-crate: forwarding guard' -j DOCKER-USER 2>/dev/null; do
  iptables -w -D FORWARD -m comment --comment 'gw-crate: forwarding guard' -j DOCKER-USER
done
while iptables -w -C DOCKER-USER -m comment --comment 'gw-crate: published port policy' -j GW-CRATE-669 2>/dev/null; do
  iptables -w -D DOCKER-USER -m comment --comment 'gw-crate: published port policy' -j GW-CRATE-669
done
if iptables -w -S GW-CRATE-669 >/dev/null 2>&1; then
  iptables -w -F GW-CRATE-669
  iptables -w -X GW-CRATE-669
fi
SCRIPT
chmod 700 /usr/local/sbin/gw-crate-forwarding-rollback
bash -n /usr/local/sbin/gw-crate-forwarding-rollback
```

Checkpoint: review generated semantics against the matrix; no `ACCEPT`, no
blanket established exemption, exact private destination and no broad Docker
source range. Both syntax checks must exit 0. The script's restore `--test` is
an additional parser check at apply time, not proof of traffic behavior.
Stage this on an isolated Docker test host first, exercising the same bridge
and NAT topology. The script intentionally does not auto-discover/trust networks.

### 3. Load on one node with timed rollback

```bash
systemd-run --unit=gw-crate-669-rollback --on-active=10m /usr/local/sbin/gw-crate-forwarding-rollback
systemctl status gw-crate-669-rollback.timer --no-pager
/usr/local/sbin/gw-crate-forwarding
iptables -nvL GW-CRATE-669 --line-numbers
iptables -S DOCKER-USER
iptables -S FORWARD
```

Checkpoint: rollback timer is scheduled before apply, chain contains 23 rules
(16 HTTP allows, 3 transport allows, 3 rejects, final RETURN), its hook is before
any DOCKER-USER RETURN, FORWARD reaches it before Docker ACCEPT paths. Existing
address blocks remain. A successful load is not sufficient: immediately run
step 4, watching counters and a fresh SSH session. The unfiltered interval
before first attachment ends here; later updates flush/refill only this owned
chain in one restore transaction. Do not restore the whole saved table.

### 4. Verify every node/port with real sources

From each real allowed client **inside its actual container/network**, open a
fresh connection to each target. Reusing a pooled socket does not test NEW
connections. Use the client's existing protected credentials without printing
or putting them on a command line. For HTTP, use its normal HTTP client with
`POST /_sql`, body `{"stmt":"SELECT current_user"}`; require HTTP 200 and the
expected identity. For a credential-free transport-only check:

```bash
# Run in the selected source's existing network namespace; set PID accordingly.
# Repeat for TARGET=.11/.12/.13 and PORT=4200/4300/5432 per the matrix below.
TARGET=10.0.0.11
PORT=4200
nsenter -t "$PID" -n python3 - "$TARGET" "$PORT" <<'PY'
import socket, sys
try:
    with socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=3):
        print("CONNECTED")
except OSError as exc:
    print(type(exc).__name__, exc.errno)
    raise SystemExit(1)
PY
```

A TCP connect to 4300 establishes reachability only; do not send HTTP to the
transport port. For cluster behavior repeat the existing read-only SQL request:

```bash
docker exec "$CRATE" curl -fsS --max-time 15 -H 'Content-Type: application/json' \
  http://127.0.0.1:4200/_sql -d '{"stmt":"SELECT name, connections FROM sys.nodes"}'
docker exec "$CRATE" curl -fsS --max-time 15 -H 'Content-Type: application/json' \
  http://127.0.0.1:4200/_sql -d '{"stmt":"SELECT username, count(*) FROM sys.jobs GROUP BY username"}'
iptables -nvL GW-CRATE-669 --line-numbers
```

| Source | HTTP 4200 on all three | Transport 4300 on all three | PostgreSQL 5432 on all three |
| --- | --- | --- | --- |
| Webapp `.21`, search `.20`, worker private hosts, monitoring `.10` | Fresh authenticated SELECT / normal monitor must work | Reject (except Crate-host sources) | Reject; no exception |
| Each local worker on `.11/.12/.13` | Authenticated SELECT both local and peer must work | Reject local bridge source | Reject |
| Each peer Crate host | HTTP allowed; ordinary job/backup probe succeeds | Fresh peer TCP succeeds; 3 healthy nodes, transport connections retained | Reject |
| Local `node-exporter` on each Crate node, to that node’s private address | Reject | Reject | Reject |

Use the existing **`node-exporter`** container on **each target's own host** for
negative probes. Read-only inspection on October 26 confirmed all three running
on the separate `goodwatch-metrics_default` bridge, with no Crate sockets:

| Target host | Local test container source | Metrics bridge | Crate bridge |
| --- | --- | --- | --- |
| `.11` | `node-exporter`, `172.20.0.2` | `br-6ed5eb804827` | `br-bdbb13d29272` |
| `.12` | `node-exporter`, `172.20.0.2` | `br-a2e6a38b5920` | `br-9bd2d1630eb4` |
| `.13` | `node-exporter`, `172.19.0.2` | `br-aa3d19f72d76` | `br-3a511684cc44` |

These are observations, not pinned identities: inspect again and stop if the
container becomes host-networked, joins the Crate/worker bridge, or uses an
allowed source. `ip route get` confirmed the metrics gateway/eth0 source only;
no connection probes were run by the agent. The host's Python runs through
`nsenter -n`, so the container needs no Python install or modification.

```bash
# On each target host, use its LOCAL node-exporter and SELF from step 1.
TEST_PID=$(docker inspect node-exporter --format '{{.State.Pid}}')
docker inspect node-exporter --format '{{.State.Running}} {{.HostConfig.NetworkMode}} {{json .NetworkSettings.Networks}}'
nsenter -t "$TEST_PID" -n ip route get "$SELF"
iptables -nvL GW-CRATE-669 --line-numbers
nsenter -t "$TEST_PID" -n python3 - "$SELF" <<'PYNEG'
import errno, socket, sys
for port in (4200, 4300, 5432):
    try:
        with socket.create_connection((sys.argv[1], port), timeout=3):
            pass
    except OSError as exc:
        if exc.errno != errno.ECONNREFUSED:
            raise SystemExit(f'{port}: inconclusive rejection: {exc}')
        print(f'{port}: refused; confirm matching target reject counter increased')
    else:
        raise SystemExit(f'{port}: unexpectedly connected')
PYNEG
iptables -nvL GW-CRATE-669 --line-numbers
```

Checkpoint: each port's reject counter increases and each fresh connect is
refused. A timeout is inconclusive; a refused connection without a matching
counter can instead mean no listener. An HTTP 401 is not firewall rejection.
Run the same connect script before rollout to record the baseline (the policy
assertion is expected to fail if ports accept connections). The post-apply
assertion must pass on all three local containers. **Do not use one container on
`.11` to establish HTTP rejection on `.12/.13`: remote traffic can be SNATed to
allowed `.11`.** Repeat locally per target; this tests an unapproved bridge
source, not an unlisted remote private host. Do not spoof addresses or change
routes/networks. Existing peer sockets are not proof of a fresh allowed connection.

Wait for all three 60-second monitors to pass, a normal job on each provisional
worker class/host to finish, and the next hourly backup on `.11` to complete.
Read `/var/log/backup_crate.log`; do not manually run `backup.py` as a probe.
Record before/after counts and sources; do not kill jobs or flush conntrack.
With these checks green and before 10 minutes expires, cancel the safety timer:

```bash
systemctl stop gw-crate-669-rollback.timer
systemctl is-active gw-crate-669-rollback.service || true
```

Checkpoint: timer did not already roll back the chain. If the normal backup or
worker cycle exceeds the window, let it roll back, complete baseline collection,
and repeat with an explicitly longer timer. Never cancel merely to save time.
Repeat steps 1–4 on the next node only after acceptance on this one.

### 5. Persist through boot and Docker lifecycle

After step 4 on a node, install the following artifacts. They refer to the
script already reviewed above; no missing generator is assumed.

```bash
cat > /etc/systemd/system/goodwatch-crate-forwarding.service <<'UNIT'
[Unit]
Description=GoodWatch Crate forwarding guard
After=ufw.service
Before=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gw-crate-forwarding
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT
install -d /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/669-crate-forwarding.conf <<'UNIT'
[Unit]
Requires=goodwatch-crate-forwarding.service
After=goodwatch-crate-forwarding.service
[Service]
ExecStartPre=/usr/local/sbin/gw-crate-forwarding
ExecStartPost=/usr/local/sbin/gw-crate-forwarding
UNIT
systemd-analyze verify /etc/systemd/system/goodwatch-crate-forwarding.service
systemctl daemon-reload
systemctl enable --now goodwatch-crate-forwarding.service
systemctl is-enabled goodwatch-crate-forwarding.service
systemctl cat docker.service
/usr/local/sbin/gw-crate-forwarding
iptables -S GW-CRATE-669
```

Checkpoint: second apply leaves identical rules and single owned hooks; counters
reset on apply, so compare rule definitions, not counters. The pre-start guard
must load successfully before Docker can start; the post-start run rechecks
hooks. Do **not** restart Docker/reboot production for this task. Enabling the
unit and reviewing ordering verifies configuration only, not actual persistence.
On a staging clone, test boot, Docker restart, UFW reload and worker/Crate network
recreation, each followed by the complete positive/negative matrix. Verify no
window admits denied sources by repeated fresh probes during each transition.

UFW reload integration: all three inspected `/etc/ufw/after.init` files have the
stock empty `start)` handler. UFW is `0.36.1-4ubuntu0.1`; the active Engine binary
reports 28.5.1 (`docker-ce` package `5:28.5.1-1~ubuntu.22.04~jammy`). Package
records for `docker.io` also exist, so identify the active binary/package before
any generator patch. Preserve the current hook and make only this guarded edit:

```bash
cp -p /etc/ufw/after.init /etc/goodwatch-crate-forwarding/after.init.before
python3 - <<'PYHOOK'
from pathlib import Path
p = Path('/etc/ufw/after.init')
s = p.read_text()
old = 'start)\n    # typically required\n    ;;'
assert s.count(old) == 1, 'Handler changed; inspect instead of overwriting'
s = s.replace(old, 'start)\n    /usr/local/sbin/gw-crate-forwarding\n    ;;', 1)
p.write_text(s)
PYHOOK
chmod 700 /etc/ufw/after.init
sh -n /etc/ufw/after.init
```

Checkpoint: diff against the private saved hook contains only the guard call;
`set -e` propagates its failure. Confirm on the staging clone that `ufw reload`
invokes this `start` handler and preserves enforcement throughout, including
repeated denied probes during reload. **Reload persistence remains unverified**
until this succeeds; a periodic timer alone would leave a fail-open window.
Do not introduce a production reload as an agent verification step.

Pinned `br-windmill` plus its reviewed subnet survive routine recreation. If
network name/labels/subnet/bridge change, new local worker access should fail
closed; re-inventory and review the script, apply it synchronously before workers
resume. Crate's changing container IP does not invalidate the original-private-
destination match. Do not restore a stale complete `iptables-save` on startup.
Native Docker nft backend migration requires a separately designed forward-hook
policy; `iptables (nf_tables)` alone does not mean native Docker nft backend.

## Provenance of the incident address blocks (read-only follow-up)

The source is **`/usr/local/sbin/goodwatch-block-malicious.sh`** on all three
Crate hosts, not Docker or the worker INPUT reconciler. Its header identifies
containment for the **2026-07 Patroni/etcd compromise**: one address is the
`p.sh` payload/`reflect_client` C2, the other is the DDoS victim targeted by the
botnet. Do not classify the victim as the attacker. The script adds bidirectional
DOCKER-USER DROP rules plus INPUT-source and OUTPUT-destination blocks for both
addresses, with `iptables -C` checks and `-I ... 1` inserts. The owner attributes
this containment to an earlier agent; the artifacts do not identify that agent's
session/person independently.

| Host | Script and unit installation mtime (UTC, 2026-08-28) | Last successful service start shown by systemd |
| --- | --- | --- |
| `.11` | Script 20:33:44; unit 20:33:44 | 2026-09-03 20:53:17 UTC |
| `.12` | Script 20:36:57; unit 20:36:57 | 2026-08-28 20:36:59 UTC |
| `.13` | Script 20:37:00; unit 20:37:00 | 2026-08-28 20:37:01 UTC |

These are file timestamps and systemd execution state, not an audited installer
transcript. `/root/incident-2026-08-28/` retains `timestamps.txt`, captured
Postgres crontab, process/connection snapshots and hashes on all three nodes;
`.11/.12` also retain `p.sh` and captured reflect-client artifacts. Saved
Postgres crontabs launch `reflect_client` at reboot against the same C2. These
are historical evidence files, not current scheduled jobs. No payload was
executed or external address contacted. Do not publish those files or payload keys.

`/etc/systemd/system/goodwatch-block-malicious.service` is **enabled**,
`Type=oneshot`, `RemainAfterExit=yes`, `WantedBy=multi-user.target`, ordered
`After=docker.service network-online.target`, and calls the script above. All
three report active/exited with `ExecMainStatus=0`; retained journal queries
returned no entries. Thus a boot reapply mechanism exists and has run
successfully; no reboot was performed to retest it. It is **not** a timer or a
Docker `ExecStartPost` hook: a later Docker restart does not automatically
rerun an already active oneshot. If DOCKER-USER rules disappear, this service
alone does not prove immediate repair. It also skips DOCKER-USER when that chain
is absent and ends with unconditional `exit 0`, so service success alone does not
prove each insert succeeded. Read-only `iptables -C` confirms all eight expected
active drops per host: two INPUT-source, two OUTPUT-destination, two forwarding-
source and two forwarding-destination rules. Docker itself is enabled on all
three. No current cron reapply was found.

Search coverage: working-tree root/docs/incident-related filenames and git
pickaxe searches for both addresses and `DOCKER-USER`; `/root` notes, scripts and
available shell histories, `/etc/systemd/system`, cron, UFW, iptables persistence
and local admin scripts across `.10–.21/.30–.32`. Excluded dependency/cache/secret
stores and large/binary files. Repository pickaxe first finds the addresses in
inspection evidence at `b773eb59f` (October 14), not their installer; later
commits only repeat the observation. No independent origin/reapply references
were found on other inspected hosts. Absence of matches is not proof that no
other automation exists.

### Keep containment separate from the Crate generator

**Keep the existing script/service and all current rules in place during #669.**
They block INPUT, OUTPUT and all Docker forwarding, including egress to a DDoS
victim. Moving them into a Crate-only original-destination guard would lose that
host-wide protection; copying global drops into it would make a database policy
own unrelated incident containment and complicate its rollback. The existing
checks also depend on the exact uncommented rule shape. The Crate guard's RETURN
allows approved traffic to continue through those existing drops; its rollback
must never remove them or disable their service.

The private script is the existing authoritative address file on each host.
Keep addresses there; no public address should appear in repository commands,
issue bodies or committed evidence. For the later comment project, review a
separate root-only address file such as
`/etc/goodwatch-containment/blocked-ipv4` populated **on-host** from the existing
script, and have that same containment generator emit comments such as
`gw-containment: block incident C2` / `gw-containment: prevent DDoS participation`
in create/check/delete paths. Preserve all three chains and boot behavior,
address any restart/reload gap, and stage exact-match adoption/rollback tests.
This is scoped to [#775](https://github.com/alp82/goodwatch-monorepo/issues/775),
not an instruction to execute the preserved incident payload or rewrite live rules.

Read-only owner confirmation, with address-bearing script content kept private:

```bash
systemctl cat goodwatch-block-malicious.service
systemctl is-enabled goodwatch-block-malicious.service
systemctl show goodwatch-block-malicious.service -p ExecMainStartTimestamp -p ExecMainStatus
stat -c '%n %y' /usr/local/sbin/goodwatch-block-malicious.sh /etc/systemd/system/goodwatch-block-malicious.service
# Compare INPUT/OUTPUT/DOCKER-USER against the private script on-host only.
```

Checkpoint: enabled service still points to the reviewed private script; all
incident drops remain before/after the allowlist rollout and its rollback.
Do not restart the service as part of agent read-only confirmation.

## Durable generated comments: owners and remaining work

The new guard generator above owns every `gw-crate:` rule and its exact inverse.
It does not use the `gw-worker:` or `gw-webapp:` prefixes. Those belong to
[`goodwatch-remote/firewall/reconcile.py`](../../goodwatch-remote/firewall/reconcile.py),
whose comment matching and inverse UFW commands must remain consistent.
[`docs/worker-firewall.md`](../worker-firewall.md) describes those INPUT rules,
not this forwarding guard.

| Rule family | Responsible generator/configuration | Durable change required |
| --- | --- | --- |
| New guard/hook rules | Owner-installed `/usr/local/sbin/gw-crate-forwarding` from this runbook | Comments emitted on every load, matched identically by rollback; verify active `--comment` after lifecycle tests |
| Worker/webapp INPUT permissions | Repo `reconcile.py` `comment_for()` and UFW arguments, per-host JSON; systemd timer | Already emits UFW metadata comments. Keep prefix and exact-match adoption/cleanup tests. Kernel annotations require the UFW generator change below |
| UFW generated base/user/IPv6 rules | Installed UFW Python backend plus `/etc/ufw/before.rules`, `after.rules`, `before6.rules`, `after6.rules`, user rule generation | Record installed package/version and managed file hashes. Patch/build a pinned UFW package so all emitters and their deletes/checks share owner/purpose comments; explicit templates can carry `-m comment`. Preserve metadata too. Test add/delete/reload/reset/IPv6 and upgrades in staging |
| Docker DNAT/filter/isolation/masquerade, IPv6/container DNS | Installed Docker Engine/libnetwork firewall generator, triggered by container/network lifecycle | A pinned Engine patch must emit e.g. `docker: Crate HTTP publish` / `docker: bridge isolation` at creation AND exact-match delete/check sites. Deploying a fork/upgrade is a separate owner decision, with staged lifecycle/upgrade tests and package rollback |
| Existing incident containment INPUT/OUTPUT/DOCKER-USER blocks | Private `/usr/local/sbin/goodwatch-block-malicious.sh`, enabled `goodwatch-block-malicious.service` on `.11/.12/.13` | Keep separate from the Crate guard for the provenance/scope reasons above; durable owner/purpose comments belong in this generator’s insert AND check paths, not live rule edits. Address authority remains the private host script; no addresses in this repo |

**The universal kernel-comment project is deferred by owner decision to
[#775](https://github.com/alp82/goodwatch-monorepo/issues/775).** It is not a gate
for #669; every new rule in this allowlist generator still carries a comment.
UFW's metadata comments are not kernel comments, and Docker Compose has no
per-generated-rule comment option. Never append comments to live Docker rules:
Docker may fail to find/delete them and leave stale rules. Never disable Docker
iptables management to make comments easier. Record installed generator sources
with read-only `dpkg-query -W ufw docker-ce docker.io`, `systemctl cat docker`,
and hashes of the installed UFW backend before preparing patches. The
uncommented-rule inventory must reach zero through reviewed generators on both
IPv4 and IPv6, with unchanged unrelated forwarding behavior; this cannot be
achieved by only adding the guard script. The current script narrows Crate
published access without pretending to remediate every host rule.

## Rollback (one host at a time)

Before rollback, prevent automatic reapplication: stop the safety timer, remove
only the dedicated Docker drop-in, disable the guard unit, and undo only the
reviewed UFW hook addition (restore its saved original only if no one else has
edited it). Do not stop Docker or the existing worker INPUT timer.

```bash
systemctl stop gw-crate-669-rollback.timer 2>/dev/null || true
systemctl disable --now goodwatch-crate-forwarding.service 2>/dev/null || true
rm -f /etc/systemd/system/docker.service.d/669-crate-forwarding.conf
# If installed, review then restore only the saved after.init hook:
# cp -p /etc/goodwatch-crate-forwarding/after.init.before /etc/ufw/after.init
systemctl daemon-reload
/usr/local/sbin/gw-crate-forwarding-rollback
iptables -S DOCKER-USER
iptables -S FORWARD
```

Checkpoint: only owned hooks/chain are gone; previous address denies, Docker
rules, UFW INPUT rules and SSH still work. Run the real allowed-client matrix,
cluster SELECT and monitor/backup checks again. Denied-source enforcement is
expected to return to the recorded baseline. Keep scripts/evidence for review;
do not flush DOCKER-USER, restore a whole ruleset, remove unrelated rules or
restart containers. Package/generator comment changes need their own tested
package rollback and recreation procedure before any deployment.

## Owner decisions and acceptance still outstanding

- Decided: deny all forwarded PostgreSQL 5432, no admin exception.
- Decided: allowlist first; universal Docker/UFW generated comments move to
  [#775](https://github.com/alp82/goodwatch-monorepo/issues/775).
- Decided: use the existing local `node-exporter` network namespace on each
  Crate host for negative probes, with the source/counter checks above.
- HTTP worker allowances remain provisional until a normal cycle establishes
  needs; the short sample cannot justify dropping deployed idle workers.
- Actual allowed/refused traffic, normal jobs/monitoring/backup, UFW hook lifecycle
  behavior and direct-routing assessment remain owner rollout checks. No
  firewall mutation or lifecycle test was made during this follow-up.

## Local validation of the initial inventory change

- Nine shell command blocks and both embedded scripts pass `bash -n`.
- Relative documentation links resolve, inventory JSON parses, `git diff --check` passes.
- `python3 -m pytest -q goodwatch-remote/firewall/test_reconcile.py goodwatch-crate/test_compose.py`:
  16 passed, 8 subtests passed. These cover existing code, not the proposed live policy.
- A flow test attempt (`goodwatch-flows/tests/test_copy_since_last_success_crate.py`)
  stopped during collection: `ModuleNotFoundError: mongomock`; no flow code changed.
- Webapp `npm ci --include=dev` initially failed in sharp's source build; retry
  with `SHARP_IGNORE_GLOBAL_LIBVIPS=1` passed. `npx tsc --noEmit` exited 2 with
  existing-source diagnostics (including `usePageTracking.ts:110` and route index
  typing). Only Markdown/JSON changed; no application/type fixes were attempted.
- No production enforcement, denied-source probes, rule parser load, systemd
  installation, reboot/restart/reload or network recreation was performed.

## Local validation of the owner-decision follow-up

- Eleven shell blocks and both embedded generator/rollback scripts pass `bash -n`;
  embedded Python snippets compile without execution. No firewall tool ran locally.
- Relative links resolve, retained inventory JSON parses, incident addresses are
  absent from the runbook, and `git diff --check` passes.
- Existing firewall/Compose regression suite: 16 passed, 8 subtests passed.
- GitHub readback confirms #775 has `enhancement` and `ready-for-human`, the required
  AI-triage preamble/blank line, and #669 links the new project.
- Host inspections covered service configuration/state, incident artifacts,
  script timestamps, available history/cron/persistence references, container
  network identity, routing tables and existing sockets only. Reboot, restart,
  rule application and negative traffic probes remain unperformed.
- Follow-up `npx tsc --noEmit` exited 2 with 192 diagnostics in unchanged
  webapp sources; the complete log stays in private local scratch. No application
  code or flow dependencies were changed for this documentation task.

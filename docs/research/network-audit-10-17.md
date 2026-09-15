# Local worker network audit: 10.0.0.10–17

Read-only SSH audit, 2026-09-10 approximately 08:30–08:34 UTC. All eight hosts were accessible using existing trusted host keys. No service, firewall, container or database changes. Results below are bounded TCP connection tests, not authenticated database health tests.

| Host | Local service / worker network | Host → own private service | Local worker → same service | Finding |
| --- | --- | --- | --- | --- |
| .10 | Windmill bundled DB, published 15432; default/highperf workers `10.0.4.0/24`, native workers `10.0.7.0/24` | Connects | All four time out to `10.0.0.10:15432` | Latent private-address limitation; configured endpoints work (details below). Bundled DB remains outside retirement scope. |
| .11 | Crate `crate-01`, private 4200/5432; default worker `172.18.0.2` | Both connect | Both time out | Same-host connectivity defect; cross-host access to .12 succeeds. |
| .12 | Crate `crate-02`, private 4200/5432; default worker `172.18.0.2` | Both connect | Both time out | Same-host connectivity defect; cross-host access to .11 succeeds. |
| .13 | Crate `crate-03`, private 4200/5432; default worker `172.18.0.2` | Both connect | Both time out | Same-host connectivity defect; cross-host access to .11 succeeds. |
| .14 | Redis host-network container, 6379; default worker `172.18.0.2` | Connects | Connects | No reproduced local TCP problem; UFW inactive. |
| .15 | Redis host-network container, 6379; default worker `172.18.0.2` | Connects | Connects | No reproduced local TCP problem; UFW inactive. |
| .16 | Redis host-network container, 6379; default worker `172.18.0.2` | Connects | Connects | No reproduced local TCP problem; UFW inactive. |
| .17 | Mongo host-network container, actual port **28017**; default worker `172.18.0.2` | Connects | Connects | Existing scoped local-worker UFW allowances already cover this path. |

The initial assumed Mongo port 27017 is not its configured listener: host refused that port, while UFW dropped the worker probe. This is not reported as an application failure; verified actual port 28017 succeeds.

## Crate findings and proposed ticket extension

On .11–13, Docker's NAT `DOCKER` chain returns traffic arriving on Docker bridges before its private-IP Crate DNAT rules. The host has private 4200/5432 listeners; INPUT policy is DROP, and inspected UFW user rules provide no local-worker allowance for either Crate client port. The workers cannot connect locally but can connect to a peer's identical ports. This strongly supports the same host-INPUT filtering mechanism documented for [Qdrant](postgres-retirement-qdrant-connectivity.md); no packet capture or temporary rule was applied in this audit, so the exact dropping rule should be verified during implementation.

Extend the Qdrant connectivity ticket to Crate .11–13: persist a narrow worker-network/interface → host-private client-port allowance, with durable network identity handling. Crate HTTP 4200 is required by the existing Windmill connector. Only allow 5432 if an intended local client needs Crate's PostgreSQL wire protocol; its presence does not indicate the retired PostgreSQL server is running. Do not allow Crate cluster transport 4300 for workers. Preserve existing application-level endpoint failover, but stop depending on failover to hide local-node failures.

Acceptance should prove local and cross-host authenticated operations from every eligible worker, plus persistence after firewall reload/container recreation. TCP-only results here establish connectivity scope, not credential or query correctness.

## .10 is a limitation, not a demonstrated outage

Default/highperf workers are configured for `coinmatica.net:15432`; native workers use Docker DNS `db` (default PostgreSQL port 5432). All four configured endpoint TCP checks pass. Only replacing those endpoints with the host's private published address would currently fail.

UFW explicitly allows default/highperf worker subnets to destination public IP `167.235.251.11:15432`, explaining why a private-address substitution is not equivalent. Leave this bundled Windmill database and its network setup untouched in the retirement work; record the private-route prerequisite for a separately authorized future change.

## Redis and Mongo

Redis .14–16 is reachable from each local worker because its host-network service is reachable and UFW is inactive. This does not validate cluster-advertised endpoints or authentication and does not mean a future UFW enablement will preserve local-worker access. Include local-worker CIDRs in the intended private-client policy when Redis hardening is undertaken.

Mongo .17 already demonstrates the desired scoped pattern: destination `10.0.0.17`, TCP28017, source current Windmill subnet `172.18.0.0/16`, with a second rule for planned fixed `172.28.0.0/24`. No change needed for this tested path.

## Primary evidence and reproduction

Live primary observations: `docker ps`, filtered `docker inspect` fields for names, network mode, network addresses and published ports; `ufw status numbered`; `iptables -t nat -S DOCKER`; `iptables -S INPUT`; `iptables -S ufw-user-input`; `ss -lnt`; Python `socket.create_connection((host, port), 2)` both on host and through `docker exec <actual-worker> python3 -c ...`. For .10 endpoint disambiguation, a remote helper parsed only DATABASE_URL hostname/port and emitted no username/password or full URL.

Raw credential-free command output and audit scripts are temporarily available at `/tmp/goodwatch-network-audit/{10..17}.json`, `*-followup.json`, `audit.py`, and `followup.py` in the local workspace environment. Those temporary paths are not durable evidence storage; this note records the observed outcomes. Hosts .18–32 are covered by the companion audit.

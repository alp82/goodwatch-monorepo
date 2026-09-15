# Private service connectivity audit: 10.0.0.25–32

Read-only observations on 2026-09-10 at approximately 08:32 UTC. No infrastructure changes or authentication secrets were read. Sources are live SSH command output described below.

| Host | SSH / relevant inventory | Result |
| --- | --- | --- |
| 10.0.0.25 | SSH connection timed out after 3 seconds | Uninspected; cannot distinguish absent host from network filtering |
| 10.0.0.26 | SSH connection timed out after 3 seconds | Uninspected |
| 10.0.0.27 | SSH connection timed out after 3 seconds | Uninspected |
| 10.0.0.28 | SSH connection timed out after 3 seconds | Uninspected |
| 10.0.0.29 | SSH connection timed out after 3 seconds | Uninspected |
| 10.0.0.30 (`gw-worker1`) | Windmill default worker, Curia, metrics; no target database service published locally | All eight configured private service TCP probes from the actual worker passed |
| 10.0.0.31 (`gw-worker2`) | Windmill default worker, separate `seen-rybbit` application and metrics | All eight configured private service TCP probes from the actual worker passed |
| 10.0.0.32 (`gw-worker3`) | Windmill default worker and metrics; no target database service published locally | All eight configured private service TCP probes from the actual worker passed |

Each accessible host's `windmill-default_worker-1` has container address `172.19.0.2/16` on its own `windmill_default` network. Each actual worker connected successfully, with a two-second socket timeout, to:

- Crate HTTP: `10.0.0.11:4200`, `10.0.0.12:4200`, `10.0.0.13:4200`.
- Qdrant REST/gRPC: `10.0.0.20:6333`, `10.0.0.20:6334`.
- Redis: `10.0.0.14:6379`, `10.0.0.15:6379`, `10.0.0.16:6379`.

These are **TCP reachability checks only**, not authenticated queries, writes, Redis topology verification, or application health checks. No same-host private database target exists in the running Docker inventories on these three worker hosts, so the specific `.20` same-host Qdrant failure could not be reproduced here. No firewall change is justified on `.30–32` by these observations.

On `.31`, `seen-rybbit-postgres-1`, `seen-rybbit-clickhouse-1`, and `seen-rybbit-redis-1` publish only on loopback (`127.0.0.1:5432`, `8123`, and `6379`). They share `seen-rybbit_default`, separate from Windmill. These are separate-application services, not the retired GoodWatch PostgreSQL cluster. Loopback publication does not promise access from unrelated worker containers; it is not evidence of the Qdrant defect. The Rybbit frontend/backend publish private ports 3002/3001, outside this database-client audit.

## Evidence and scope

Inventory command for each address: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=3 root@HOST 'hostname; docker ps --format "{{.Names}}|{{.Ports}}|{{.Networks}}"'`. No unknown SSH keys were accepted.

Worker address source: `docker inspect --format '{{.Name}}|{{json .NetworkSettings.Networks}}' windmill-default_worker-1`. Connectivity source: `docker exec windmill-default_worker-1 python3 -c ...` using stdlib `socket.create_connection((host, port), 2)` for exactly the eight endpoints above, closing each connection immediately.

Recommendations: retain existing network rules on inspected `.30–32`; include authenticated service operations from these workers in the Qdrant remediation acceptance check. Treat `.25–29` as coverage gaps until inventory confirms whether they are expected to exist or accessible SSH routing is provided. Do not infer that they are healthy or need firewall changes from SSH timeouts.

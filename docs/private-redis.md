# Private Redis topology and firewall

## Inventory and ownership

The Redis 7.2.4 cluster runs on `10.0.0.14`, `.15` and `.16`, with three masters, no replicas, and all 16,384 slots assigned. The historical `replica` directory/service names on `.15/.16` do not describe their actual roles. Each node uses host networking and the existing Bitnami 7.2 image, with AOF and `nodes.conf` in its named `/bitnami/redis/data` volume. Required ports are TCP 6379 for authenticated clients and TCP 16379 for the cluster bus; 16380/16381 are unused.

Before rollout, bootstrap variables were private but `CLUSTER NODES`/`CLUSTER SLOTS` advertised public addresses `78.46.209.172`, `168.119.242.21` and `91.107.208.205`. Actual frontend connections from `159.69.247.66` and inter-node bus sockets used public addresses. The application bootstrap addresses are already `10.0.0.14–16`; changing those alone cannot fix discovery.

Each host has public/private SSH, loopback DNS/DHCP infrastructure, Redis, a Windmill default worker and metrics containers. There are no public web, Coolify, Swarm or etcd services on these three nodes. Windmill uses the local `windmill_default` bridge and `172.18.0.0/16`; metrics uses a separate `172.19.0.0/16` network and has no identified Redis client need. Public SSH is retained, including the existing administrative session. Servers `.22–29` do not exist and are not audit gaps.

## Memory limit, eviction and partial coverage

Decision: [ADR 0003](adr/0003-redis-cluster-of-masters-with-volatile-lfu.md). All three nodes are masters. There are no replicas, so each node holds one third of the slots and nothing else holds a copy.

| Setting | Value | Why |
|---|---|---|
| `maxmemory` | `7gb` (7,516,192,768 bytes) | The hosts have 15.6 GB and no swap, and the Windmill worker on each host can use 4 GiB. |
| `maxmemory-policy` | `volatile-lfu` | At the limit, Redis evicts the least frequently used keys that have an expiry. Keys without an expiry stay. |
| `cluster-require-full-coverage` | `no` | A failed node no longer stops the other two. |
| `appendonly` | `yes` (the image's default, `appendfsync everysec`) | A restarted node loads its data again. |

The settings are `command` arguments in `goodwatch-cache/main/docker-compose.yml` (cache1) and `goodwatch-cache/replica/docker-compose.yml` (cache2 and cache3). Keep those lines identical in both files. `REDIS_EXTRA_FLAGS` doesn't work: the `run.sh` of this `bitnami/redis-cluster:7.2` image never reads the variable. The earlier `--maxmemory 6000mb --maxmemory-policy allkeys-lfu` in the `main` file therefore never took effect, and all three nodes ran without a limit.

A container gets the arguments only when it's recreated. `CONFIG SET` changes a running node at once, but Redis runs without a config file, so `CONFIG REWRITE` fails and a plain `docker restart` returns to the arguments the container was created with. To see what a container starts with, run `docker inspect <container> --format '{{json .Config.Cmd}}'`.

### When a node fails

The other two nodes keep answering for their slots. Commands for the failed node's slots fail. The webapp's data cache counts those lookups as `error`, runs the target, and answers from the databases. The title snapshot chunks on the failed node are unreachable until it returns. A running webapp keeps the snapshot it has loaded in memory, and a webapp that starts during the outage has no snapshot until the node is back. When the node restarts, it loads its append-only file and serves its slots again. The load time grows with the data: Redis answers `LOADING` until it's done. Nothing fails over, because there are no replicas.

### Keys without an expiry

`volatile-lfu` never evicts a key without an expiry. If such keys filled a node, every write to it would fail with an out-of-memory error. Measured on October 4, 2026, with a full `SCAN` of all three nodes (633,000 keys):

| Prefix | Keys per node | Size per node | Cluster total | Writer |
|---|---|---|---|---|
| `title-snapshot:*` | 23 to 26 | 28 to 30 MB | 87 MB | `f/sync/copy/title_snapshot.py`. It keeps the current and the previous version and deletes older chunks. |
| `quota:<date>:<model>` | 225 to 265 | 20 KB | 60 KB | Not in this repository. Daily counters from July 8, 2025, to September 14, 2026. |

Every other prefix had an expiry on every key. The largest are `related-movie` (1.9 to 2.1 GB per node), `related-show` (1.6 to 1.8 GB), and `person-profile-v2` (1.2 to 1.3 GB). The longest lifetimes belong to small sets: `taste:*` (180 days), `og-image:*` and `share-card:*` (30 days).

To repeat the measurement, compare `keys` and `expires` in `INFO keyspace`: the difference is the number of keys without an expiry. A new Redis write must set an expiry unless it's meant to survive eviction.

### Change the limit

1. On each node: `CONFIG SET maxmemory <value>`. This takes effect at once and needs no restart.
2. Change `--maxmemory` in both Compose files, merge to `main`, and check out the two files on each host.
3. Recreate one container at a time with the procedure in the next section, or leave it for the next planned recreation. Until then, a restart of that container returns to its old value.

Keep the limit plus 4 GiB for the Windmill worker plus about 4 GiB of headroom under the host's 15.6 GB. A background save or an append-only-file rewrite forks the process. The hosts run with `vm.overcommit_memory=1` and transparent huge pages in `madvise` mode, so the fork doesn't fail, and it copies only the pages that change during the save (8 to 13 MB in the measured saves).

## Persistent topology

The owning `goodwatch-cache/main` and `replica` Compose files set private `REDIS_NODES`, disable automatic IP rewriting with `REDIS_CLUSTER_DYNAMIC_IPS=no`, and require the host's `REDIS_PRIVATE_IP`. Both Bitnami's announce environment and the actual Redis command-line argument use that address, with explicit client/bus ports 6379/16379. Ignored host-network port mappings, including unused ports, are removed.

Runtime `CONFIG SET cluster-announce-ip <private-IP> cluster-announce-port 6379 cluster-announce-bus-port 16379` permits gossip to converge before firewall activation. It is not the persistence mechanism. This pinned image starts Redis through `--include` without a primary config file, so `CONFIG REWRITE` cannot persist the change. Existing container arguments also remain immutable: a normal restart of the old container would restore its public argument.

Recreate one Redis service at a time from its actual owning Compose directory/project, preserving the existing image digest and named data volume. Never pull a new image, remove volumes, initialize another cluster or reshard for this migration. Existing `nodes.conf` prevents the creator path from creating a fresh cluster. Save the old Compose/env files and filtered settings privately, set only the node's private address, gracefully stop that Redis container with `docker stop --timeout=-1 <container>`, and use `docker compose up -d --no-deps --pull never --no-build --force-recreate --timeout 60 redis-main` (or `redis-replica`). Require the original node IDs, healthy AOF, three connected private masters and complete healthy slots before proceeding to another node. With no replicas, cache slots can briefly be unavailable during restart; do not claim uninterrupted Redis availability. Check the application's cache fallback and subsequent verified cache writes.

## Complete policy presented before activation

All three hosts retain standard UFW loopback, established/related, ICMP, DHCP and IPv6 neighbor-discovery handling. Defaults are deny incoming, allow outgoing and deny routed. Public SSH remains TCP 22 on IPv4 and IPv6, comment `SSH admin`. No public Redis allowance remains. The complete additional INPUT rules are:

| Destination | Incoming interface | Source | TCP port | Comment |
|---|---|---|---|---|
| 10.0.0.14 | ens10 | 10.0.0.0/24 | 6379 | Redis private clients |
| 10.0.0.14 | ens10 | 10.0.0.15 | 16379 | Redis cluster peer |
| 10.0.0.14 | ens10 | 10.0.0.16 | 16379 | Redis cluster peer |
| 10.0.0.14 | br-ef7f6d40b1ca | 172.18.0.0/16 | 6379 | gw-worker:windmill_default:6379 |
| 10.0.0.15 | ens10 | 10.0.0.0/24 | 6379 | Redis private clients |
| 10.0.0.15 | ens10 | 10.0.0.14 | 16379 | Redis cluster peer |
| 10.0.0.15 | ens10 | 10.0.0.16 | 16379 | Redis cluster peer |
| 10.0.0.15 | br-19219f3ab9c2 | 172.18.0.0/16 | 6379 | gw-worker:windmill_default:6379 |
| 10.0.0.16 | ens10 | 10.0.0.0/24 | 6379 | Redis private clients |
| 10.0.0.16 | ens10 | 10.0.0.14 | 16379 | Redis cluster peer |
| 10.0.0.16 | ens10 | 10.0.0.15 | 16379 | Redis cluster peer |
| 10.0.0.16 | br-64bef6a0eb9f | 172.18.0.0/16 | 6379 | gw-worker:windmill_default:6379 |

Each row is `ufw allow in on INTERFACE from SOURCE to DESTINATION port PORT proto tcp comment COMMENT`. The worker interface is the inspected rollout identity; the existing worker-firewall reconciler subsequently owns changes after approved network recreation. It grants only the actual approved subnet/interface, not every Docker bridge. The three Redis host configurations extend that same deployment mechanism.

Remove only the enumerated historical public Redis grants (frontend, HQ and public peer addresses), unused bus-port grants and old blanket `deny 6379`. Preserve unrelated permissions and refuse unexpected Redis exposure rather than silently enabling it. Do not reset UFW or add global forwarding. The private client allowance also covers any future client-port replication connection between these nodes; no replica is asserted to exist today.

## Staging, gates and rollback

Before activation, save `/etc/ufw`, existing enabled/default state, active firewall rules and owning Redis configuration in a root-only directory. Establish private advertisements and verify authenticated slot-aware operations from the real frontend and local/remote Windmill worker environments. Existing clients must actually reconnect/discover private endpoints, not merely pass a new-client bootstrap test. Verify live Redis client and bus sockets no longer require public endpoints. The planner's fresh topology and connection gates complement these application checks.

Present the complete plan before any `ufw enable`. For each host, schedule an independent host-local timed `ufw disable` fallback before applying the policy, since its original state is inactive. Keep an administrative session open, activate only one host, then verify a new SSH connection, authenticated local/remote slot discovery and writes, all slots/cluster links healthy, frontend normal HTTP and verified warmup-cache writes. Cancel the fallback only after those checks pass. Continue to the next host, then reload UFW and recheck persistence. Start the worker bridge reconciler/timer only after UFW is active.

If activation fails, invoke `ufw disable` (or let the timed fallback do so) to restore initial filtering behavior, then restore only the saved UFW configuration and defaults. Stop the worker timer and wait for any active operation, holding its shared lock during rollback as described in `worker-firewall.md`. Do not overwrite Docker's live chains with an old full iptables dump. Restore previous Redis announce values/Compose/env only if topology itself must be rolled back; remove filtering first so restored public endpoints are reachable. Recreate one node at a time with the original image/volume and require health after each. Never delete the AOF or `nodes.conf`.

References: [Redis CONFIG SET](https://redis.io/docs/latest/commands/config-set/), [CONFIG REWRITE limitations](https://redis.io/docs/latest/commands/config-rewrite/), [Redis 7.2 cluster announcement configuration](https://raw.githubusercontent.com/redis/redis/7.2/redis.conf), [UFW manual](https://manpages.ubuntu.com/manpages/jammy/man8/ufw.8.html). Startup behavior was verified against the installed Bitnami scripts and image, rather than inferred from newer image documentation.

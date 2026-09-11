# Private Redis topology and firewall

## Inventory and ownership

The Redis 7.2.4 cluster runs on `10.0.0.14`, `.15` and `.16`, with three masters, no replicas, and all 16,384 slots assigned. The historical `replica` directory/service names on `.15/.16` do not describe their actual roles. Each node uses host networking and the existing Bitnami 7.2 image, with AOF and `nodes.conf` in its named `/bitnami/redis/data` volume. Required ports are TCP 6379 for authenticated clients and TCP 16379 for the cluster bus; 16380/16381 are unused.

Before rollout, bootstrap variables were private but `CLUSTER NODES`/`CLUSTER SLOTS` advertised public addresses `78.46.209.172`, `168.119.242.21` and `91.107.208.205`. Actual frontend connections from `159.69.247.66` and inter-node bus sockets used public addresses. The application bootstrap addresses are already `10.0.0.14–16`; changing those alone cannot fix discovery.

Each host has public/private SSH, loopback DNS/DHCP infrastructure, Redis, a Windmill default worker and metrics containers. There are no public web, Coolify, Swarm or etcd services on these three nodes. Windmill uses the local `windmill_default` bridge and `172.18.0.0/16`; metrics uses a separate `172.19.0.0/16` network and has no identified Redis client need. Public SSH is retained, including the existing administrative session. Servers `.22–29` do not exist and are not audit gaps.

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

# Private Redis topology and firewall

## Inventory and ownership

The cache cluster runs on `10.0.0.14`, `.15` and `.16` (cache1 to cache3), with three masters, no replicas, and all 16,384 slots assigned. Since October 4, 2026, the software is Valkey 8.1 from the official `valkey/valkey` image ([ADR 0004](adr/0004-valkey-8-from-the-official-image.md)). Before that it was Redis 7.2.4 from `bitnami/redis-cluster:7.2`, and the firewall sections below describe the rollout on that image. The historical `replica` directory/service names on `.15/.16` do not describe their actual roles. Each node uses host networking, with the append-only file, `dump.rdb` and `nodes.conf` in its named data volume. Required ports are TCP 6379 for authenticated clients and TCP 16379 for the cluster bus; 16380/16381 are unused. Clients don't change: the webapp (`ioredis`) and the Windmill scripts (`redis-py`) connect as before, and the variable and resource names still say Redis.

Before rollout, bootstrap variables were private but `CLUSTER NODES`/`CLUSTER SLOTS` advertised public addresses `78.46.209.172`, `168.119.242.21` and `91.107.208.205`. Actual frontend connections from `159.69.247.66` and inter-node bus sockets used public addresses. The application bootstrap addresses are already `10.0.0.14–16`; changing those alone cannot fix discovery.

Each host has public/private SSH, loopback DNS/DHCP infrastructure, Redis, a Windmill default worker and metrics containers. There are no public web, Coolify, Swarm or etcd services on these three nodes. Windmill uses the local `windmill_default` bridge and `172.18.0.0/16`; metrics uses a separate `172.19.0.0/16` network and has no identified Redis client need. Public SSH is retained, including the existing administrative session. Servers `.22–29` do not exist and are not audit gaps.

## Memory limit, eviction and partial coverage

Decision: [ADR 0003](adr/0003-redis-cluster-of-masters-with-volatile-lfu.md). All three nodes are masters. There are no replicas, so each node holds one third of the slots and nothing else holds a copy.

| Setting | Value | Why |
|---|---|---|
| `maxmemory` | `7gb` (7,516,192,768 bytes) | The hosts have 15.6 GB and no swap, and the Windmill worker on each host can use 4 GiB. |
| `maxmemory-policy` | `volatile-lfu` | At the limit, Redis evicts the least frequently used keys that have an expiry. Keys without an expiry stay. |
| `cluster-require-full-coverage` | `no` | A failed node no longer stops the other two. |
| `appendonly` | `yes`, with `appendfsync everysec` | A restarted node loads its data again. |
| `client-output-buffer-limit normal` | `64mb 32mb 10` | A client that doesn't read its replies is disconnected instead of filling the node. See [Client output buffer limit](#client-output-buffer-limit). |

The settings are in `goodwatch-cache/valkey.conf`, one file for all three nodes. [Software and configuration](#software-and-configuration) describes how a node reads it.

A container reads the file only when it starts. `CONFIG SET` changes a running node at once, but it doesn't change the file: the mount is read-only, so `CONFIG REWRITE` fails on purpose. To see what a node runs with, use `CONFIG GET <setting>`. `INFO server` shows `config_file:/etc/valkey/valkey.conf`.

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

### Client output buffer limit

Replies that a client hasn't read yet wait in the node's memory, and that memory counts toward `maxmemory`. Until October 4, 2026, normal clients had no limit (`0 0 0`, the default). On that day, thirteen local test servers on a development machine read the cluster through the VPN. Each one asked for the title snapshot again every two seconds, gave up after the one-second command timeout, and never finished reading. They held 1.25 GB of replies on cache2 and 1.04 GB on cache3, up to 229 MB per connection, and cache2 stood at 6.35 GB of its 7 GB.

| Limit | Value | Effect |
|---|---|---|
| Hard | 64 MB | The node closes the connection as soon as its pending replies pass 64 MB. |
| Soft | 32 MB for 10 seconds | The node closes a connection whose pending replies stay above 32 MB for 10 seconds. |

The setting is `client-output-buffer-limit normal 64mb 32mb 10`. The `replica` (256 MB, 64 MB for 60 seconds) and `pubsub` (32 MB, 8 MB for 60 seconds) classes keep their defaults.

Why these values:

- The largest legitimate burst is a starting webapp. It asks for all chunks of one title snapshot version at once (`Promise.all` over `getBuffer`), so each node queues its whole share for that one connection: 10.5 to 14.6 MB per node on October 4, 2026, in chunks of 1 MB (11 to 14 chunks per node, ratings included). The reader accepts chunks of up to 4 MB, and the size grows with the catalog. The hard limit leaves room for four times today's burst.
- On the private network, the webapp reads that burst in under half a second (463 ms for all three nodes in the first start after the change). A connection that is still above 32 MB after 10 seconds isn't reading.
- Every other reply is small next to the limits: an OG or share card image is up to 0.7 MB, a cached value up to about 1 MB, and the snapshot writer (`f/sync/copy/title_snapshot.py`) sends large `SET` commands, which fill the input buffer, and gets small replies to `SCAN`, `SET`, and `DEL`.
- The limit is per connection. Twenty stuck connections can still hold 1.3 GB for a moment. It bounds a slow client, and it doesn't replace stopping one.

A closed connection shows as `client_output_buffer_limit_disconnections` in `INFO stats`. The webapp's client reconnects by itself. To see who holds reply memory, sort `CLIENT LIST` by `omem`: `addr` names the source host, and a connection that comes through the VPN shows the gateway's address (`10.0.0.10`).

If the snapshot outgrows the limit, a starting webapp logs `Title snapshot not loaded:` again and again while the counter above rises on one node. Raise the hard limit to at least twice the node's share of one version, or make the loader read the chunks in smaller groups.

To change the limit on a running node, name only the class to change:

```sh
docker exec replica-redis-replica-1 sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" valkey-cli CONFIG SET client-output-buffer-limit "normal 67108864 33554432 10"'
```

Then change `goodwatch-cache/valkey.conf`, merge to `main`, and check out the file on each host, as for `maxmemory` below. No restart is needed: the running node has the value, and the file is read at the next start.

### Change the limit

1. On each node: `CONFIG SET maxmemory <value>`. This takes effect at once and needs no restart.
2. Change `maxmemory` in `goodwatch-cache/valkey.conf`, merge to `main`, and check out the file on each host.
3. Restart one container at a time with the procedure in [Recreate a node](#recreate-a-node), or leave it for the next planned restart. Until then, a restart of that container returns to the value in the file it started with.

Keep the limit plus 4 GiB for the Windmill worker plus about 4 GiB of headroom under the host's 15.6 GB. A background save or an append-only-file rewrite forks the process. The hosts run with `vm.overcommit_memory=1` and transparent huge pages in `madvise` mode, so the fork doesn't fail, and it copies only the pages that change during the save (8 to 13 MB in the measured saves).

## Software and configuration

Decision: [ADR 0004](adr/0004-valkey-8-from-the-official-image.md).

| Part | Value |
|---|---|
| Image | `valkey/valkey:8.1.10@sha256:640c5e62cea04b6d6f2084232651d0cc70362d31f4f805e7be94dbed6855e8f2`, pinned in both Compose files |
| Compose files | `goodwatch-cache/main/docker-compose.yml` (cache1) and `goodwatch-cache/replica/docker-compose.yml` (cache2 and cache3). They differ only in the service name. |
| Config file | `goodwatch-cache/valkey.conf`, shared by all nodes, mounted read-only at `/etc/valkey/valkey.conf` |
| Per-node values | `REDIS_PRIVATE_IP` and `REDIS_PASSWORD` in the root-only `.env` file next to each Compose file on the host. Never commit them. |
| Data volume | `main_redis-data` (cache1) or `replica_redis-data` (cache2 and cache3), mounted at `/data`: `appendonlydir/`, `dump.rdb`, `nodes.conf` |
| User | `1001:0`, the owner of the data files since the Bitnami image |
| Containers | `main-redis-main-1` (cache1), `replica-redis-replica-1` (cache2 and cache3) |

The Compose command starts a shell that runs `valkey-server /etc/valkey/valkey.conf` and adds `--cluster-announce-ip`, `--requirepass`, and `--masterauth` from the container's environment. The password is in the container's environment, as it was before, and not in its command, the config file, or the repository. `tini` is process 1 and forwards the stop signal, so `docker stop` shuts Valkey down cleanly.

Nothing in the image or the Compose files creates or resets a cluster. A node reads its identity and slots from `nodes.conf` in its volume. A container that starts on an empty volume is a blank node that owns no slots and knows no other node.

To run a command on a node without printing the password:

```sh
docker exec replica-redis-replica-1 sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" valkey-cli CLUSTER INFO'
```

`INFO server` reports `valkey_version:8.1.10` and, for compatibility with clients, `redis_version:7.2.4`.

## Recreate a node

Use this after a change to `valkey.conf`, a Compose file, or the image. One node at a time. With no replicas, the node's slots are unavailable while it's down, and the webapp answers those lookups from the databases. A node with 5.4 GB of data takes about one minute: the shutdown writes an RDB file, and the start loads the append-only file.

1. Check first:
   - No webapp deploy is running. A webapp that starts while a node is down has no title snapshot until the node is back.
   - `cluster_state:ok` on all three nodes, and no node is flagged `fail` in `CLUSTER NODES`.
   - On the node: `aof_last_write_status:ok`, `aof_rewrite_in_progress:0`, and `rdb_bgsave_in_progress:0` in `INFO persistence`.
   - Note the node ID, the slots, and the key count (`INFO keyspace`).
2. Get the files. The host checkouts have local changes, so check out single files and never pull:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo
   git fetch origin main
   git checkout FETCH_HEAD -- goodwatch-cache/valkey.conf goodwatch-cache/replica/docker-compose.yml   # main/ on cache1
   ```

3. For a new image, pull it before the node goes down: `docker compose pull` in the Compose directory.
4. Stop the node cleanly, then recreate it:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-cache/replica   # main on cache1
   docker stop --timeout=-1 replica-redis-replica-1                 # main-redis-main-1 on cache1
   docker compose up -d --no-deps --pull never --no-build --force-recreate redis-replica   # redis-main on cache1
   ```

5. Wait until `PING` answers `PONG` instead of `LOADING`. Then check the version, the node ID, the slots, the key count, the settings (`CONFIG GET maxmemory`, `maxmemory-policy`, `cluster-require-full-coverage`), and `cluster_state:ok` on all three nodes. The other nodes clear the `fail` flag of the returned node some seconds later.
6. On abio, check that the webapp's lookup errors stop rising:

   ```sh
   docker run --rm --network coolify busybox:1.37-musl wget -qO- http://goodwatch-webapp:9464/metrics | grep goodwatch_data_cache
   ```

A change to `valkey.conf` alone needs only `docker restart --timeout=-1 <container>` after the checkout, because the file is read at start. `git checkout` replaces the file, and a running container keeps seeing the old one until it restarts.

Never run `FLUSHALL`, `CLUSTER RESET`, or `CLUSTER FORGET`, and never remove a data volume or `nodes.conf`.

## Roll back to the Bitnami image

Redis 7.2.4 reads data that Valkey 8.1 has written. Valkey 8.1 writes the same RDB version (11), append-only format, and `nodes.conf` format. A rehearsal on October 4, 2026, proved it: a node went from Redis 7.2.4 to Valkey 8.1.10, rewrote its append-only file and its RDB file, and went back to Redis 7.2.4 on the same volume with its ID, slots, and all keys. A later Valkey major version can change the formats, so rehearse again before relying on this after an upgrade.

The Bitnami image can't be pulled any more. Each cache host keeps a local copy (`bitnami/redis-cluster:7.2`, image ID `35f5a97548f3`). Don't remove it while this way back matters. `docker save` and `docker load` copy it to another host.

To take one node back:

1. Restore the Compose file from before the move: `/root/.gw288/docker-compose.yml.before-288` on each host, or the file from commit `0f77e98e`. It mounts the same volume at `/bitnami/redis/data`.
2. `docker stop --timeout=-1 <container>`, then the `docker compose up` command from the section above.
3. Verify as in step 5 above.

A mixed cluster works: Redis 7.2.4 and Valkey 8.1.10 nodes gossip with each other, so one node can go back alone.

### Volume copies from the move

Each host has a copy of its data volume, taken on October 4, 2026, after the clean shutdown of Redis 7.2.4 and before the first start of Valkey:

```
/root/.gw288/volume-copy-before-valkey/
```

The copy holds `appendonlydir/`, `dump.rdb`, and `nodes.conf` with their owners (3.4 to 4.5 GB per host). It's a second way back if the volume itself is damaged: stop the container, replace the volume's content (`/var/lib/docker/volumes/<volume>/_data`) with the copy, and start the Bitnami container. The data in the copy is as old as the move, so most cache entries in it are expired after a few days.

Delete the copies once all three nodes have run Valkey for a day without problems, on or after October 6, 2026: `rm -rf /root/.gw288/volume-copy-before-valkey` on each host.

## Persistent topology

This section and the next two record the private-address and firewall rollout of September 2026, on the Bitnami image. The addresses, ports, and firewall rules are still current. The Bitnami environment variables and the recreation command are not: use [Recreate a node](#recreate-a-node).

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

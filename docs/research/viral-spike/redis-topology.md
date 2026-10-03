# Redis topology for the three cache hosts

Research for ticket #244, a child of the map #237 "Serve a viral traffic spike".
Investigated on 2026-10-03 from the repository and from primary documentation.
The private hosts were not reachable, so nothing in this document comes from a live node.

Claims carry one of three marks:

- **Verified (code):** read in this repository.
- **Verified (docs):** read in the linked primary source.
- **Not verified:** an inference or a runtime fact that needs a live check. Section [What to measure](#what-to-measure) lists them.

## Summary

- A Redis Cluster promotes a replica only when a majority of the masters vote for it. Replicas do not vote. A cluster needs at least three masters to survive the loss of one. That is why all three nodes are masters. Replicas are extra processes on top of the three masters. They can't replace them.
- "One primary and two replicas on three hosts" is a valid design, but it is not Redis Cluster. It is plain replication with Sentinel, where three Sentinel processes do the voting.
- Everything the code stores in Redis is rebuildable. Replication buys a warm cache after a host failure. It does not buy durability, and it does not help during a traffic spike.
- The spike risk is recomputation, not Redis capacity. The `cached()` helper has no single-flight and no stale serving. Fix that first. It is needed under every topology.
- With the Redis default `cluster-require-full-coverage yes`, the loss of one master stops the whole cluster, not a third of the keys. The live value is not verified.
- The image `docker.io/bitnami/redis-cluster:7.2` can no longer be pulled. The repository has zero tags. A host that loses its local image copy can't recreate its node from the current Compose file.
- Recommendation: keep three masters, add stampede protection and stale-while-revalidate in the app, set `cluster-require-full-coverage no`, fix the configuration drift, and move off the Bitnami image. Add replicas only if the host survey shows the memory and a failure drill shows the need.

## Current setup

### Servers

| Fact | Status | Source |
|---|---|---|
| Three nodes on `10.0.0.14`, `.15`, `.16` (`cache1` to `cache3`) | Verified (code) | `goodwatch-hq/ansible/hosts.ini`, `docs/private-redis.md` |
| Three masters, no replicas, all 16,384 slots assigned | Not verified live. Stated in `docs/private-redis.md`. `REDIS_CLUSTER_REPLICAS=0` in `goodwatch-cache/main/docker-compose.yml` agrees | |
| Image `docker.io/bitnami/redis-cluster:7.2`, host networking, named volume at `/bitnami/redis/data` | Verified (code) | both Compose files |
| Running version is 7.2.4 | Not verified live. The Compose tag is the floating `7.2`. `docs/private-redis.md` says 7.2.4 | |
| AOF and `nodes.conf` live in the data volume | Not verified live. Stated in `docs/private-redis.md` | |
| Client port 6379, cluster bus port 16379 | Verified (code) | Compose `command`, `goodwatch-cache/firewall/policy.py` |
| `--maxmemory 6000mb --maxmemory-policy allkeys-lfu` | Verified (code) for `main` only. See the drift note | `goodwatch-cache/main/docker-compose.yml` |
| Each cache host also runs a Windmill default worker and metrics containers | Stated in `docs/private-redis.md` | |

**Configuration drift.** `goodwatch-cache/replica/docker-compose.yml` has no `REDIS_EXTRA_FLAGS` line. Only `main` sets `maxmemory` and the eviction policy. If `.15` and `.16` run from the `replica` file, they might run with no memory limit and the default `noeviction` policy. Not verified. Check `CONFIG GET maxmemory` on each node.

### What the `replica` directory was meant for

The directory never configured replication. Both files date from 2024-01-31. The first versions differ in only two lines: `main` has `REDIS_CLUSTER_CREATOR=yes` and `REDIS_CLUSTER_REPLICAS=0`. So `main` is the node that runs the one-time cluster creation, and `replica` is the file for the other nodes that join. The root `README.md` records the creation command with `--cluster-replicas 0`. `docs/private-redis.md` says the same: "The historical `replica` directory/service names on `.15/.16` do not describe their actual roles."

The name is misleading. A better name is `member` or `node`. Renaming changes the Compose project name and so the container and volume names. Do it only as part of a planned recreation.

### Webapp client

Source: `goodwatch-webapp/app/utils/cache.ts`. All points are verified (code).

- One `ioredis` `Cluster` (`"ioredis": "^5.4.1"`) with three startup nodes from `REDIS_HOST`, `REDIS_HOST2`, `REDIS_HOST3`.
- Fail-fast settings: `clusterRetryStrategy` returns `null`, `connectTimeout: 300`, `slotsRefreshTimeout: 200`, `maxRetriesPerRequest: 0`, `maxLoadingRetryTime: 200`, `lazyConnect: true`.
- `getRedisCluster()` returns `null` until the cluster is ready. Callers then run without a cache.
- On a cluster `error` event whose message contains "connection", "timeout", or "closed", the module sets the client to `null` and creates a new `Cluster`. It does not disconnect the old one.
- `cached()` is a read-through helper. On a miss, or when the stored `timestamp` is older than the TTL, it runs the target and writes the result with `SETEX`. There is no lock, no in-process single-flight, and no stale serving. Twelve call sites use it outside prototypes.
- `cacheSet()` sends an unawaited `redis.info()` before every write. It has no purpose and can produce an unhandled rejection.
- The option `offlineQueue: false` sits inside `redisOptions`. The documented ioredis option name is `enableOfflineQueue`. Whether `offlineQueue` has any effect is not verified. `sentinelRetryStrategy` has no effect in cluster mode.

### Other Redis users

A topology change affects every user in this table. All rows are verified (code).

| User | Keys | Multi-key or Lua | Rebuildable |
|---|---|---|---|
| `cached()` helper, `app/utils/cache.ts` | `cached-<name>:<sha256>` | No | Yes, from Crate and Qdrant |
| Homepage warm-up, `app/server/homepage-warmup.server.ts` | Cache key plus lease `{<cache key>}:warmup` | Yes. A two-key Lua script. The hash tag puts the lease in the cache key's slot | Yes |
| Search coordination, `app/server/search-runtime/coordination.server.ts` | All under `{goodwatch-search-v2}:` (lease, lock, admission, rate, interpretation) | Yes. Lua scripts with five or more keys, and `redis.call('TIME')`. One hash tag, so one slot and one node | Yes. The code calls it "temporary coordination". Crate holds the authoritative interpretation |
| Poster impressions, `app/routes/api.poster-impressions.ts` | `poster-rate:<hash>`, `poster-seen:<visitor>:<type>:<id>` | One-key Lua | Yes. Rate and dedup state with TTLs of 60 s and 30 min |
| OG images, `app/server/og-image/og-image.server.tsx` | PNG buffers | No | Yes, but a rebuild costs CPU for rendering |
| Share-card images, `app/server/share-card/images.server.ts` | PNG buffers | No | Yes, same CPU cost |
| Title cards, `app/server/title-cards.server.ts` | Per-title display fields, 6 h | No | Yes |
| Title filter sets, `app/server/title-filter/id-sets.server.ts` | `title-filter:v1:<kind>:<id>`, 30 min | No | Yes |
| Member taste, `app/server/taste/member.server.ts` | `taste:v2:<user>`, `taste:touched:<user>`, 180 days | No | Yes. A reader rebuilds inline from Crate |
| Taste portrait and wishlist summary | `taste-portrait:…`, `living-room:wishlist:v1:<user>` | No | Yes |
| Title snapshot reader, `app/server/title-snapshot/index.server.ts` | `title-snapshot:current`, `title-snapshot:<version>:<n>`, ratings chunks | No. Chunks of at most 1 MB, spread over all nodes | Yes, by the Windmill script below |
| Title snapshot writer, `goodwatch-flows/windmill/f/sync/copy/title_snapshot.py` | Same keys plus `title-snapshot:lock` | No Lua. `SET NX` lock. `SCAN` on every primary through `get_primaries()`, with a fallback for a single Redis | Yes |
| Spend pause, `goodwatch-flows/windmill/f/dna/generate/spend_pause.py` | `dna:openrouter:spend_pause` | One-key Lua | Mostly. If the key is lost, the next rejected OpenRouter request sets it again |
| Windmill connector, `goodwatch-flows/windmill/f/db/redis.py` | n/a | `redis-py` 5.2.1 `RedisCluster`, hosts from the Windmill variable `u/Alp/REDIS_HOSTS` | n/a |

Three consequences:

- Every Lua script reads only keys passed in `KEYS`, and every multi-key script uses a hash tag. The scripts work on a cluster, on a single Redis, and on a failover of either.
- Four modules already accept a single non-cluster Redis through `TITLE_SNAPSHOT_REDIS_URL`, `TASTE_REDIS_URL`, `TITLE_CARDS_REDIS_URL`, and `TITLE_FILTER_REDIS_URL`. They use narrow interfaces (`get`, `set`, `getBuffer`). A move away from cluster mode is a small change in the webapp.
- Under `allkeys-lfu`, Redis can evict any key when memory is full. That includes leases, locks, the spend pause, and title snapshot chunks, which have no TTL. Whether evictions happen is not verified. Check `evicted_keys`.

## Why all three nodes are masters

The owner asked: "can't we have a real cluster with 3 nodes? why do all need to be masters?"

Short answer: the current setup is a real cluster. Three masters is the smallest cluster that can fail over at all. Replicas are an addition to the three masters, not a replacement for some of them.

The rule comes from the Redis Cluster specification:

- A node is marked as failed only when a majority of masters report it. `FAIL` "means that a node is failing and that this condition was confirmed by a majority of masters within a fixed amount of time."
- A replica must win an election to take over. "Replicas trying to replace failing masters increment their epoch and try to get authorization from a majority of masters." And: "Once the replica receives ACKs from the majority of masters, it wins the election."
- Only masters vote. Replicas request votes and do not grant them. Valkey keeps the same rule with the word "primaries".
- A node that can't reach the majority of masters stops accepting queries after the node timeout.

Source: [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/), [Valkey cluster specification](https://valkey.io/topics/cluster-spec/).

Apply the rule to three hosts:

| Layout | One host fails | Result |
|---|---|---|
| 1 master, 2 replicas | If the master's host fails, zero masters remain. Nobody can vote | No failover. The cluster stays down |
| 2 masters, 1 replica | One master remains. One of two is not a majority | No failover |
| 3 masters, 0 replicas (today) | Two masters remain, a majority. They mark the node as failed. No replica exists to promote | The failed node's slots stay uncovered |
| 3 masters, 3 replicas, each replica on a different host than its master | Two masters remain, a majority. They elect the replica that lives on a surviving host | Automatic failover. All slots covered |

The Redis documentation says the same: "the minimal cluster that works as expected must contain at least three master nodes. For deployment, we strongly recommend a six-node cluster, with three masters and three replicas." Source: [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/).

So the choices on three hosts are:

- Six Redis processes in cluster mode: three masters and three cross-placed replicas. This is option (b).
- Three Redis processes without cluster mode: one primary, two replicas, and three Sentinel processes that vote. Sentinel uses the same majority idea, but the voters are the Sentinels. This is option (c).

## Is the data worth replicating

No key in the table above is authoritative. Crate, Mongo, Qdrant, and the Windmill flows can rebuild everything. Replication can't protect data that needs no protection. It can only keep the cache warm when a host fails.

The value of a warm cache depends on what a cold cache costs:

- **`cached()` entries:** each miss runs a Crate or Qdrant query. A cold cache during a spike sends every concurrent request for the same key to the database, because there is no single-flight. This is the real risk. Replication does not fix it. A cold key also appears with every TTL expiry and every deploy of a new cache name.
- **OG and share-card images:** each miss renders an image. The map lists OG rendering as its own open decision.
- **Title snapshot:** the webapp holds it in memory. A running webapp keeps its loaded snapshot when chunks disappear. A webapp that starts while chunks are missing has no snapshot until the Windmill script publishes again.
- **Member taste:** rebuilt inline per member. Signed-in load is not the spike scenario.
- **Coordination, rate limits, leases:** short-lived by design.

Redis replication is asynchronous, so a failover can lose the most recent writes. For a cache this is harmless. Source: [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/).

One caution from the same page applies if replicas are added and persistence is ever turned off: a master that restarts empty makes its replicas empty too. The Compose files use `restart: unless-stopped`. Keep AOF on, or accept the cold cache.

## Options

`M` is the `maxmemory` of one master. Today `M` is 6000 MB, at least on `main`. Host memory is unknown, so the table gives formulas.

### Comparison

| | (a) As is, plus app changes | (b) Three masters, three cross-placed replicas | (c) One primary, two replicas, Sentinel |
|---|---|---|---|
| Redis processes | 3 | 6 | 3 Redis, 3 Sentinel |
| Usable cache capacity | 3 × M | 3 × M | 1 × M |
| Memory per host | M plus overhead | 2 × M plus overhead | M plus overhead, where M must hold the whole dataset |
| One host fails | Slots of that node are gone until it returns. With full coverage required, the whole cluster stops | Automatic failover after the node timeout. Cache stays warm | Automatic failover after `down-after-milliseconds`. Cache stays warm |
| Traffic spike | Solved by the app changes | Same as (a). Replicas don't help | Same as (a). One node serves all traffic |
| Webapp client | No change | No change | New connection code |
| Windmill client | No change | No change | New connector code |
| Lua and hash tags | No change | No change | No change needed. Hash tags become plain text |
| Migration | App deploy, one config change | Online, node by node | Parallel deployment, cold cutover |
| Downtime | None | None expected | None, but the cache starts cold |

"Overhead" means memory beyond the dataset: client and replication buffers, fragmentation, and copy-on-write pages during an AOF rewrite or a full resync. Under heavy writes, copy-on-write can approach the dataset size. The exact figure is not verified. Measure `used_memory_rss` and `mem_fragmentation_ratio`.

### (a) Keep three masters, add stampede protection and stale-while-revalidate

**Memory per host.** Unchanged. Stale serving needs a physical TTL longer than the logical TTL, so more keys stay in memory. With a 24-hour stale window, key count can grow several times for short-TTL entries. Measure before choosing the window.

**One host fails.** Two behaviors are possible. The live setting decides, and it is not verified:

- `cluster-require-full-coverage yes` is the Redis default. "By default Redis Cluster nodes stop accepting queries if they detect there is at least a hash slot uncovered." The whole cache goes away after the node timeout, which defaults to 15 seconds. The webapp then runs every request uncached.
- With `cluster-require-full-coverage no`, the two surviving masters keep serving their slots. About a third of the keys miss. This is the behavior the ticket describes, and it is the right setting for a cache.

Source: [redis.conf for 7.2](https://raw.githubusercontent.com/redis/redis/7.2/redis.conf).

How the ioredis client behaves with one node down is not verified. The error handler replaces the whole client on connection errors, which could turn a partial outage into a full cache bypass. A failure drill must show this.

**Traffic spike.** This option is the one that addresses the spike. Redis serves hot keys from memory at a rate far above 500 requests per second. The danger is the moment a hot key is missing. Needed changes:

- In-process single-flight: one promise per cache key, shared by concurrent callers. The webapp runs as one process today, so this covers every request. It needs no Redis.
- A cross-process lock for later, when more webapp hosts exist: `SET <key>:lock <owner> NX EX <seconds>`. It is a single-key command and needs no hash tag. A hash tag is needed only if a Lua script touches the lock and the value together, as the homepage warm-up does.
- Stale-while-revalidate: entries already store `{ data, timestamp }`. Store them with a physical TTL of logical TTL plus stale window. Serve a stale entry at once and refresh in the background under the single-flight. This matches the accepted trade-off in the map: title data can be up to 24 hours stale.
- Serve stale on error: if the refresh fails, keep serving the stale entry.

Large values deserve a check. The helper warns at 500 KB. A 500 KB value at 500 requests per second is 250 MB per second from Redis to the webapp, plus a JSON parse per request. If hot keys are that large, a short in-process cache in front of Redis is needed. Value sizes are not verified.

**Client changes.** Only inside `cached()`. Also remove the stray `redis.info()` call, and disconnect the old `Cluster` before creating a new one.

**Lua scripts and hash tags.** No change.

**Migration and downtime.** A webapp deploy. `CONFIG SET cluster-require-full-coverage no` works at runtime on each node. To persist it, add it to `REDIS_EXTRA_FLAGS` and recreate the nodes one at a time, as `docs/private-redis.md` describes. That document notes that `CONFIG REWRITE` can't persist settings with this image.

### (b) Three masters plus three cross-placed replicas

Each host runs two Redis processes: its master, and the replica of another host's master. For example, `.14` holds master A and replica C, `.15` holds master B and replica A, `.16` holds master C and replica B.

**Memory per host.** About 2 × M plus overhead. With today's 6000 MB that is 12 GB of data per host, plus buffers and copy-on-write headroom. Two details from the Redis documentation matter:

- "By default, a replica will ignore `maxmemory`". The master drives eviction. A replica can use somewhat more memory than its master.
- The output buffers that feed replicas are subtracted from the used memory count of the master.

If the hosts can't hold 2 × M, halve `maxmemory` to 3000 MB. Capacity then drops from 18 GB to 9 GB. Whether 9 GB is enough depends on the measured `used_memory`.

**One host fails.** One master and one replica disappear. The two surviving masters are a majority. They mark the master as failed and elect its replica, which lives on a surviving host. The specification gives the timing: the cluster is available again "after `NODE_TIMEOUT` time plus a few more seconds". The default node timeout is 15 seconds. A value of 5 seconds is common.

After the failover, one host runs two masters. If that host fails next, only one master of three remains and the cluster stops. When the failed host returns, its old master rejoins as a replica. Run `CLUSTER FAILOVER` on it to restore one master per host. This is a manual step, or a small script.

During the failover window, the webapp's fail-fast settings make requests for the affected slots run uncached. Option (a) is still needed.

**Traffic spike.** No benefit. ioredis reads from masters by default (`scaleReads: "master"`). Reading from replicas adds capacity that the workload does not need.

**Client changes.** None. Both ioredis `Cluster` and redis-py `RedisCluster` discover replicas from the cluster and follow a failover. `title_snapshot.py` scans `get_primaries()`, which stays correct.

**Lua scripts and hash tags.** No change. Scripts replicate to the replica.

**Migration and downtime.** Online, with no expected downtime:

1. Confirm host memory from the survey (#238).
2. Add a second Compose service per host on client port 6380 and bus port 16380, with its own volume.
3. Open the firewall: 6380 from `10.0.0.0/24` and 16380 between the peers. `goodwatch-cache/firewall/policy.py` currently treats 16380 and 16381 as unused and removes their grants. Update the policy and its tests.
4. Join each new node as a replica of the master on another host: `redis-cli --cluster add-node <new> <existing> --cluster-slave --cluster-master-id <id>`.
5. Wait for the full sync. The master forks to produce the snapshot. This is the moment of peak memory.
6. Run a failure drill: stop one host's containers, watch the failover, restart, fail back.

The Bitnami image can't be pulled any more, so the new containers must use the locally cached image or a different image. Mixing images in one cluster is possible if the Redis versions are compatible. Not verified for this setup.

### (c) One primary, two replicas, and Sentinel

Plain Redis replication without cluster mode. Each host runs one Redis and one Sentinel. The Redis documentation shows this layout as "Example 2: basic setup with three boxes" with `quorum = 2`.

**Memory per host.** Every host holds the whole dataset. Capacity is one host's `maxmemory`, not three. With today's setting that is 6000 MB in total instead of 18 GB. If the measured total `used_memory` is under about 5 GB, this option fits in the current footprint. If not, it needs a higher `maxmemory` on every host.

**One host fails.** If a replica's host fails, nothing changes for clients. If the primary's host fails, the two remaining Sentinels agree and promote a replica. Detection takes `down-after-milliseconds`. The documented examples use 10 to 60 seconds. A lower value such as 5 seconds is possible. The rules: "You need at least three Sentinel instances for a robust deployment", and a failover happens only "with the vote of the majority of the Sentinel processes".

Source: [High availability with Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/).

**Traffic spike.** One node takes all reads and writes. Redis executes commands on one thread, so this uses one core instead of three. For 500 requests per second with a few cache reads each, one node is enough. Not verified by a benchmark. Large values are the limit, as in (a).

**Client changes.**

- Webapp: replace `new Redis.Cluster(nodes, options)` with `new Redis({ sentinels, name, password, … })`. ioredis documents `sentinels`, `name`, and `sentinelPassword`, and it reconnects to the new primary after a failover. Rename `getRedisCluster`. `SearchRedis` in `coordination.server.ts` is typed as `Pick<Cluster, …>` and needs the plain type.
- Windmill: `f/db/redis.py` must use `redis.sentinel.Sentinel` in place of `RedisCluster`. `title_snapshot.py` already has a branch for a client without `get_primaries()`.
- The four `*_REDIS_URL` overrides keep working.

**Lua scripts and hash tags.** Everything works. Without cluster mode, hash tags have no function and all keys live on one node. Keep the tags so that a return to cluster mode stays possible.

**Migration and downtime.** A cluster can't be converted in place. Because the data is rebuildable, no data migration is needed:

1. Start the new Redis and Sentinel processes on other ports next to the cluster. This needs memory for both during the overlap.
2. Open the firewall for the new Redis port and the Sentinel port (26379 by default).
3. Run the title snapshot script with `force` against the new deployment, and check `dna:openrouter:spend_pause` on the old one.
4. Deploy the webapp and the Windmill connector with the new connection settings, at a quiet hour.
5. The cache starts cold. Warm the homepage with the existing warm-up endpoint.
6. Remove the old cluster containers and volumes.

No hard downtime, but a cold cache for every key. Do this only after option (a) is in place.

### (d) Drop-in alternatives

None of the alternatives changes the quorum rule or removes the need for option (a).

**Valkey.** A fork of Redis 7.2.4 under the BSD license, maintained by the Linux Foundation project. "Valkey is compatible with Redis OSS 7.2 and all earlier open-source Redis versions, as Valkey 7.2.4 is a fork of Redis OSS 7.2.4." It keeps the same cluster and Sentinel design and the same majority rule. Current releases on 2026-10-03: 9.1.2, 8.1.10, 8.0.11, and 7.2.14. The official image is `valkey/valkey` on Docker Hub. The migration guide describes a rolling move for a cluster: add Valkey nodes as replicas of the Redis primaries, then promote them. ioredis and redis-py work unchanged with a 7.2-compatible server. Valkey is the natural replacement for the Bitnami image. It changes the image and license picture, not the topology.

Source: [Valkey migration guide](https://valkey.io/topics/migration/), [Valkey releases](https://github.com/valkey-io/valkey/releases).

**Redis, official image.** The 7.2 line still gets patch releases. The newest is 7.2.16 from 2026-08-17. The official image `redis:7.2` exists on Docker Hub. Redis 7.2 keeps the BSD license. Redis 7.4 moved to RSALv2 and SSPLv1, and Redis 8 added AGPLv3 as a third choice. License facts come from secondary reports and are not verified against the Redis license files. The Valkey guide warns that Redis 7.4 and later "produce data files that are not compatible with Valkey". Staying on 7.2 keeps both paths open.

Source: [Redis releases](https://github.com/redis/redis/releases).

**Dragonfly.** A multi-threaded server that speaks the Redis protocol. One instance replaces a small cluster. In emulated cluster mode, cluster clients keep working against a single instance. Points that matter here:

- High availability is not built in. "Dragonfly only provides a data plane", and node health monitoring and automatic failover "are out of the scope of Dragonfly server functionality". The documented automatic failover comes from the Kubernetes operator, which this project does not run. Sentinel support is not verified.
- Lua scripts may only access declared keys by default. The scripts in this repository pass all keys in `KEYS`, so they should work. Not verified by a test.
- Replication from Redis is supported only up to Redis 6.2, so the move would be a cold cutover.
- The README claims lower memory use and snapshots without a fork. These are vendor claims.
- The license is not verified. Check the repository's license file before adoption.

A single Dragonfly node loses the whole cache when its host fails. It simplifies the cluster away but makes failure behavior worse than today unless replicas and an external failover tool are added.

Source: [Dragonfly cluster mode](https://www.dragonflydb.io/docs/managing-dragonfly/cluster-mode), [Dragonfly scripting](https://www.dragonflydb.io/docs/managing-dragonfly/scripting), [Dragonfly replication](https://www.dragonflydb.io/docs/managing-dragonfly/replication).

**KeyDB.** Rule it out. The last release is v6.3.4 from 2023-10-30, and the last commits on the default branch date from March 2024. It tracks the Redis 6 line.

Source: [KeyDB releases](https://github.com/Snapchat/KeyDB/releases).

**ioredis.** Its README now says: "ioredis is a stable project and maintenance is done on a best-effort basis for relevant issues", and it recommends node-redis for new projects. This is no reason to switch clients for this work.

Source: [ioredis README](https://github.com/redis/ioredis/blob/main/README.md).

### Bitnami image status

- Bitnami announced that from 2025-08-28 the public catalog keeps only a limited set of hardened images, "intended for development and … only available on the 'latest' tag". All versioned images move to `docker.io/bitnamilegacy`, which "will receive no further updates or support and should only be used for temporary migration purposes". The deletion of the public catalog was postponed to 2025-09-29. Source: [bitnami/containers issue 83267](https://github.com/bitnami/containers/issues/83267).
- Checked on 2026-10-03 against the Docker Hub registry API: `bitnami/redis-cluster` returns zero tags. `bitnamilegacy/redis-cluster` still has `7.2` and `7.2.4`, last updated 2025-07-03. `bitnamisecure/redis-cluster` requires authorization.
- Consequence: the Compose files reference an image that can't be pulled. The nodes run only because each host has the image cached locally. `docker image prune`, a disk replacement, or a new host breaks recreation. The legacy image is frozen and gets no security fixes.
- The Bitnami startup scripts read `REDIS_NODES`, `REDIS_CLUSTER_CREATOR`, and `REDIS_EXTRA_FLAGS`. An official Redis or Valkey image needs a `redis.conf` or command-line flags in their place, and uses `/data` as the data directory. Cluster creation becomes an explicit `--cluster create` step, as in the root `README.md`.

A short-term patch is to point the Compose files at `docker.io/bitnamilegacy/redis-cluster:7.2`. The digest should match the running image. Not verified. The lasting fix is a move to `valkey/valkey` or `redis:7.2`.

## What to measure

Ticket #238 restores access. Then collect these on each of `.14`, `.15`, `.16`:

| Measurement | Command | Decides |
|---|---|---|
| Host RAM, free memory, other containers' use | `free -m`, `docker stats --no-stream` | Whether 2 × M fits for (b) |
| Dataset size and resident size | `INFO memory`: `used_memory`, `used_memory_rss`, `used_memory_peak`, `mem_fragmentation_ratio` | Whether the total fits on one host for (c), and whether M can be halved for (b) |
| Memory limit and policy on every node | `CONFIG GET maxmemory`, `CONFIG GET maxmemory-policy` | Whether the drift on `.15` and `.16` is real |
| Eviction and hit rate | `INFO stats`: `evicted_keys`, `keyspace_hits`, `keyspace_misses`, `expired_keys` | Whether the cache is under memory pressure today |
| Coverage and timeout settings | `CONFIG GET cluster-require-full-coverage`, `cluster-node-timeout`, `cluster-allow-reads-when-down` | Whether one failure stops the whole cluster |
| Topology | `CLUSTER NODES`, `CLUSTER INFO` | Three masters, no replicas, announced addresses |
| Version and persistence | `INFO server`, `INFO persistence`, `CONFIG GET appendonly` | Exact version, AOF state, rewrite cost |
| Image | `docker image inspect` digest, compared with `bitnamilegacy/redis-cluster:7.2` | Whether the legacy tag is a drop-in |
| Largest and hottest values | `redis-cli --bigkeys`, `--memkeys`, the webapp's "cached (big)" warnings | Whether value size limits throughput |
| Key count per prefix | `SCAN` with patterns, sampled | Memory effect of a stale window |
| CPU and network of Redis at load | During the benchmark: `INFO commandstats`, `instantaneous_ops_per_sec`, host metrics | Whether Redis is anywhere near a limit |

Two tests need a deliberate action:

- **Failure drill.** Stop one Redis container. Record what the webapp logs, whether keys on the other two nodes still hit, and how long recovery takes after restart.
- **Cold-key benchmark.** Delete a hot key during the load test. Count the target calls before and after the single-flight change.

## Recommendation

1. **Do option (a) now.** Add in-process single-flight, stale-while-revalidate, and serve-stale-on-error to `cached()`. It is the only change that addresses the spike, and it is a precondition for every other option. The map already lists it as not yet specified.
2. **Make a node failure partial.** Set `cluster-require-full-coverage no` on all three nodes if the survey shows the default. Fix the webapp's error handler so one dead node does not disable the whole cache. Confirm with the failure drill.
3. **Fix the drift.** Put the same `maxmemory` and policy on all three nodes.
4. **Leave the Bitnami image.** Point the Compose files at an image that can be pulled. Prefer `valkey/valkey` on a current 8.x line, or `redis:7.2` for the smallest change.
5. **Don't add replicas for the spike.** They don't change spike behavior. They double memory per host or halve capacity, and they add a manual fail-back step.
6. **Revisit after the survey.** If the hosts have memory for 2 × M and the failure drill shows that a cold third of the cache hurts even with stale serving, choose (b). It needs no client change and no cold start. Choose (c) only if the total dataset is small enough for one host and the owner prefers one dataset without slots. It costs a client change in two codebases and a cold cutover.

The reasoning for the order between (b) and (c): the map says keep it simple, and the data clusters stay. Option (b) keeps every client and every key as is. Option (c) is the simpler system to reason about, but the more invasive change.

## Open decisions for the owner

1. Is a cold third of the cache acceptable when one host fails, given stale serving and single-flight? If yes, no replicas are needed.
2. How long may a stale `cached()` entry be served: 24 hours for all entries, or a window per call site?
3. If replicas are wanted: (b) with 2 × M per host, (b) with M halved, or (c) with one dataset?
4. Which image replaces Bitnami: Valkey or the official Redis 7.2 image? And in place on the running cluster, or with a fresh cluster and a cold cache?
5. Should coordination keys (leases, locks, spend pause, title snapshot chunks) stay under `allkeys-lfu`, where they can be evicted? The alternative is `volatile-lfu`, which evicts only keys with a TTL. Then the snapshot chunks are safe, but keys without a TTL can fill memory.
6. Rename `goodwatch-cache/replica`, and when?

## Not verified

- Every runtime fact: host memory, dataset size, live `maxmemory` on `.15` and `.16`, `cluster-require-full-coverage`, the node timeout, the running version and image digest, AOF state, evictions.
- Whether the Bitnami `run.sh` passes `REDIS_EXTRA_FLAGS` through when the Compose `command` adds its own arguments.
- How ioredis behaves in this configuration when one of three masters is down, and whether `offlineQueue: false` has any effect.
- Redis license details for 7.4 and 8, and the Dragonfly license.
- Dragonfly compatibility with the Lua scripts in this repository, and Dragonfly's Sentinel support.
- Whether one Redis node handles the spike in option (c). No benchmark exists yet.
- The size of hot `cached()` values.

## Sources

- [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/)
- [High availability with Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/)
- [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [redis.conf for Redis 7.2](https://raw.githubusercontent.com/redis/redis/7.2/redis.conf)
- [Redis releases](https://github.com/redis/redis/releases)
- [Valkey cluster specification](https://valkey.io/topics/cluster-spec/)
- [Valkey migration guide](https://valkey.io/topics/migration/)
- [Valkey releases](https://github.com/valkey-io/valkey/releases)
- [Dragonfly cluster mode](https://www.dragonflydb.io/docs/managing-dragonfly/cluster-mode)
- [Dragonfly scripting](https://www.dragonflydb.io/docs/managing-dragonfly/scripting)
- [Dragonfly replication](https://www.dragonflydb.io/docs/managing-dragonfly/replication)
- [Dragonfly README](https://github.com/dragonflydb/dragonfly/blob/main/README.md)
- [KeyDB releases](https://github.com/Snapchat/KeyDB/releases)
- [ioredis README](https://github.com/redis/ioredis/blob/main/README.md)
- [Bitnami catalog announcement, bitnami/containers issue 83267](https://github.com/bitnami/containers/issues/83267)
- Docker Hub registry API, `tags/list` for `bitnami/redis-cluster`, `bitnamilegacy/redis-cluster`, `valkey/valkey`, and `library/redis`, queried 2026-10-03
- Local: `goodwatch-cache/`, `docs/private-redis.md`, `goodwatch-webapp/app/utils/cache.ts`, and the files in the table of Redis users

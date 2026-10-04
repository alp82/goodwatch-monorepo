---
status: accepted
---

# Run Redis as a cluster of masters with a memory limit and `volatile-lfu`

The cache stays a Redis Cluster of three masters without replicas. Every node runs with `maxmemory 7gb`,
`maxmemory-policy volatile-lfu`, and `cluster-require-full-coverage no`. The append-only file stays on. Decided with
the owner on October 4, 2026.

Before this decision the nodes had no memory limit, `noeviction`, and `cluster-require-full-coverage yes`. A full host
would have failed every write, and one failed node stopped all three.

## Choices

- **Masters only, no replicas.** The owner's two requirements are that the cache survives a node being down and that
  another node adds capacity. Redis Cluster is the only layout where a new node adds capacity. Replicas are rejected:
  all data can be rebuilt from the databases, node failures are rare, and a replica needs as much memory as its master
  on hosts that can't hold two.
- **Redundancy means availability, not warm data.** With `cluster-require-full-coverage no`, the remaining nodes keep
  serving their slots when one node fails. Lookups for the missing slots fail, and the webapp runs the target instead
  (1-second command timeout). The data of the failed node returns from its append-only file when the node restarts.
- **7 GiB per node.** The cache hosts have 15.6 GB of memory and no swap, and each also runs a Windmill worker with a
  4 GiB limit. 7 GiB leaves about 4 GiB for the fork of a background save or rewrite, the page cache, and the system.
- **`volatile-lfu`, not `allkeys-lfu`.** Every cache entry has an expiry and is evictable. The title snapshot chunks
  have no expiry on purpose: the webapp can't serve filters without them, so Redis must never evict them.

## Consequences

- A key without an expiry can never be evicted. If such keys fill a node, writes to that node fail. Every new Redis
  write must set an expiry unless the key is as essential and as small as the title snapshot. On October 4, 2026, the
  keys without an expiry used about 30 MB per node. [Private Redis](../private-redis.md) has the measurement.
- When a node reaches the limit, Redis evicts the least frequently used cache entries. `evicted_keys` above zero is
  normal from now on. A node that stays at the limit is the signal to add a node or raise the limit.
- The settings live in `goodwatch-cache/valkey.conf` since the move to Valkey 8
  ([ADR 0004](0004-valkey-8-from-the-official-image.md)) and take effect when a container starts. Before that, they
  were `command` arguments in both Compose files, because the Bitnami image ignored `REDIS_EXTRA_FLAGS` and ran Redis
  without a config file.
- If the Windmill workers move off the cache hosts, the limit can go to about 10 GiB per node.

Evidence: [Redis topology research](https://github.com/alp82/goodwatch-monorepo/blob/research/redis-topology/docs/research/viral-spike/redis-topology.md)
and the resolutions of the tickets "Decide the Redis topology" and "Set memory limits, eviction, and partial coverage
on the Redis cluster".

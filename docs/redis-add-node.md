# Add a node to the cache cluster, and remove it again

This runbook adds a fourth master to the Valkey cluster on `10.0.0.14` to `.16` (cache1 to cache3), gives it a share of the slots that matches its memory limit, and removes it again. The topology and settings are decided in [ADR 0003](adr/0003-redis-cluster-of-masters-with-volatile-lfu.md) and [ADR 0004](adr/0004-valkey-8-from-the-official-image.md). [Private Redis](private-redis.md) describes the three existing nodes.

**Status:** rehearsed end to end on October 7, 2026, on a throwaway four-node cluster on a worker host, with the production image and `goodwatch-cache/valkey.conf`. Not yet run on production. [Rehearsal record](#rehearsal-record) has the evidence, and [Not rehearsed](#not-rehearsed) lists what the rehearsal couldn't cover.

## What to expect

- **Requests keep working.** Slots move one at a time while both nodes serve. Clients follow the cluster's redirects by themselves. In the rehearsal, no read or write failed and no value was wrong in any slot move that ran to its end.
- **No data is lost by a move.** Keys keep their lifetime. They lose their usage counter, so a moved key counts as never read until it's read again.
- **A move takes minutes.** Plan 2 to 3 minutes for a 2 GB node and 5 to 10 minutes for a 7 GB node at the fill of October 7, 2026. See [How long it takes](#how-long-it-takes).
- **Three things can hurt, and each has a step below:**
  - A client that can't reach the new node on TCP 6379 loses the cache for the new node's slots as soon as they move. Check reachability before the join.
  - An interrupted move leaves one slot open. Reads of resettable caches in that slot fail until the slot is closed. See [Stop midway](#stop-midway).
  - A master that gives away its last slot turns itself into a replica and copies a whole node's data, unless `cluster-allow-replica-migration` is `no` on it. See [Remove a node](#remove-a-node).

## When to add a node

`evicted_keys` above zero is normal: the nodes are meant to run full. Add a node when eviction takes entries that requests still ask for. No metric shows that directly, so read three things over a full day:

1. **Every node is at its limit.** `USE%` is 95 or more on all nodes in `goodwatch-cache/cluster-status.sh`, run on a cache host.
2. **Keys leave by eviction more than by lifetime.** On each node, `evicted_keys` grows faster than `expired_keys` (`INFO stats`, two readings a day apart).
3. **The webapp's hit share falls.** The share of `hit` and `stale` results per cache name (`goodwatch_data_cache_requests_total`, queries in [Viral spike metrics](benchmarks/viral-spike-metrics.md)) drops by more than five points against the last reading with free memory, and stays there. The title details caches are the ones to watch: 38% for movies and 42% for shows on October 6, 2026, when each node used 3.0 GB.

The node's own usage counter doesn't help as a trigger. With `lfu-decay-time 1`, a key that hasn't been read for a few minutes is at zero, and on October 7, 2026, 397 of 400 sampled keys were at zero.

Before adding a node, look at what fills the memory:

```sh
sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/key-sample.sh        # on a cache host: 400 random keys by prefix
```

If one prefix with a long lifetime holds most of the memory, a shorter lifetime for it is cheaper than a node. On October 7, 2026, conditions 1 and 2 were met on all three nodes: each stood at 6.99 GB of 7 GB and evicted 4.2 keys per second against 1.65 expiries per second. In a sample of 400 keys on cache2, `og-card` held about 80% of the memory with a 7-day lifetime.

A node adds its own limit and no more. A 2 GB node next to three 7 GB nodes is 9.5% more cache.

## Who does what

| Step | Changes | Who |
|---|---|---|
| 1. Prepare the host | The new host only: a kernel setting, files, the image | Operator |
| 2. Open the ports | Firewall rules on the new host and on cache1 to cache3 | **Owner.** Another session owns the firewall. This runbook names ports and hosts and doesn't write rules. |
| 3. Start the blank node | The new host only | Operator |
| 4. Check reachability | Nothing | Operator |
| 5. Join the node | **Production cluster.** The three nodes learn a fourth, which owns nothing. | Operator, **owner present** |
| 6. Move slots | **Production cluster and production data.** | Operator, **owner present** |
| 7. Verify | Nothing | Operator |
| Remove a node | **Production cluster and production data**, then firewall rules | Operator, **owner present**. Deleting the node's volume is the owner's call. |

Steps 1 to 4 can be done days ahead. Steps 5 and 6 belong in one quiet hour: no webapp deploy, no load run against production, and not at 08:00 or 20:00 UTC, when the TMDB copy loads Crate and a cache miss costs more.

## Values

Run the cluster commands in a `tmux` session on cache1, so that a lost SSH connection doesn't take the terminal with it. Set these there once. `NEW` is the new host's private address, and `NEW_GB` is its memory limit in GB.

```sh
NEW=10.0.0.N
NEW_GB=2
# valkey-cli inside cache1's container. The password stays in the container.
vk() { docker exec main-redis-main-1 sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" exec valkey-cli "$@"' vk "$@"; }
```

The two helper scripts are read-only and come from the repository. Get them on cache1 once. This adds two files to the checkout and changes nothing that runs:

```sh
cd /root/goodwatch/goodwatch-monorepo
git fetch origin main
git checkout FETCH_HEAD -- goodwatch-cache/cluster-status.sh goodwatch-cache/key-sample.sh
```

Without a checkout, they also run from a machine that has the repository: `ssh root@10.0.0.14 'sh -s' < goodwatch-cache/cluster-status.sh`.

**Memory limit of the new node.** Take the host's memory, subtract the limits of the other containers on it, and keep about 1.5 GB for the system and for the pages that a background save copies. A worker host with 7.7 GB and a Windmill worker limited to 4 GiB carries a 2 GB node.

**Weight.** A node's weight is its memory limit in GB. The three cache nodes have 7 each, so a 2 GB node gets 2 of 23 parts: 1,425 of the 16,384 slots.

## Step 1: Prepare the host

On the new host:

1. Check the kernel settings that the cache hosts run with. A background save forks the process, and without overcommit the fork can fail when the host is tight.

   ```sh
   sysctl vm.overcommit_memory                      # want: 1
   cat /sys/kernel/mm/transparent_hugepage/enabled  # want: [madvise] or [never]
   ```

   If overcommit is 0, set it and keep it across reboots:

   ```sh
   sysctl -w vm.overcommit_memory=1
   echo 'vm.overcommit_memory = 1' > /etc/sysctl.d/90-valkey.conf
   ```

2. Check the disk: the data volume needs about three times the memory limit (the append-only file, its rewrite, and the RDB file that a shutdown writes).

   ```sh
   df -h /var/lib/docker
   ```

3. Check that TCP 6379 and 16379 are free: `ss -ltn | grep -E ':(6379|16379)\b'` prints nothing.

4. Get the files. Host checkouts can have local changes, and the workspace layout on the hq host runs `git pull` in them (`goodwatch-hq/zellij/goodwatch.kdl`), so check out single files:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo
   git fetch origin main
   git checkout FETCH_HEAD -- goodwatch-cache/valkey.conf goodwatch-cache/node/docker-compose.yml goodwatch-cache/cluster-status.sh goodwatch-cache/key-sample.sh
   ```

5. Write the `.env` file next to the Compose file. Copy the password line from a cache host without printing it. From a machine that reaches both hosts:

   ```sh
   ssh root@10.0.0.14 'grep "^REDIS_PASSWORD=" /root/goodwatch/goodwatch-monorepo/goodwatch-cache/main/.env' \
     | ssh root@10.0.0.N 'umask 077; cat > /root/goodwatch/goodwatch-monorepo/goodwatch-cache/node/.env'
   ```

   Then, on the new host, add the node's own values:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-cache/node
   printf 'REDIS_PRIVATE_IP=%s\nREDIS_MAXMEMORY=%s\n' 10.0.0.N 2gb >> .env
   chmod 600 .env
   cut -d= -f1 .env        # REDIS_PASSWORD, REDIS_PRIVATE_IP, REDIS_MAXMEMORY
   ```

6. Pull the image: `docker compose pull`.

`goodwatch-cache/node/docker-compose.yml` is the Compose file for every added node. It differs from `main/` and `replica/` in two arguments: `--maxmemory` from `REDIS_MAXMEMORY`, because the limit in `valkey.conf` is 7 GB and a node's limit isn't propagated, and `--cluster-allow-replica-migration no`. The Compose project, container, and volume names come from the directory name: `node-redis-node-1` and `node_redis-data`.

## Step 2: Open the ports (owner)

The firewall on every host denies incoming connections by default. The owner adds these rules, each with a short comment that names the owner and the purpose (`AGENTS.md`):

| On host | From | TCP port | Purpose |
|---|---|---|---|
| New host | `10.0.0.0/24` | 6379 | Clients: both webapp hosts, the Windmill workers, and the three cache nodes, which send the moved keys to this port |
| New host | `10.0.0.14`, `10.0.0.15`, `10.0.0.16` | 16379 | Cluster bus |
| cache1, cache2, cache3 | New host | 16379 | Cluster bus. One new rule on each of the three hosts. |
| New host, if a Windmill worker runs on it | The worker's Docker bridge subnet | 6379 | The local worker reaches the node through the bridge. The worker firewall reconciler owns this kind of rule ([Worker firewall](worker-firewall.md)). |

TCP 6379 on cache1 to cache3 is already open for `10.0.0.0/24`, which covers the new host. No public rule is needed on any host.

When the node is removed for good, the owner removes the same rules again.

## Step 3: Start the blank node

On the new host:

```sh
cd /root/goodwatch/goodwatch-monorepo/goodwatch-cache/node
docker compose up -d
nk() { docker exec node-redis-node-1 sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" exec valkey-cli "$@"' nk "$@"; }
```

Check before going on. All of these must match:

```sh
nk INFO server | grep valkey_version              # valkey_version:8.1.10
nk CLUSTER INFO | grep -E 'known_nodes|slots_assigned'   # cluster_known_nodes:1, cluster_slots_assigned:0
nk DBSIZE                                         # 0
nk CONFIG GET maxmemory                           # the limit in bytes, for example 2147483648
nk CONFIG GET maxmemory-policy                    # volatile-lfu
nk CONFIG GET cluster-require-full-coverage       # no
nk CONFIG GET cluster-allow-replica-migration     # no
nk CLUSTER NODES                                  # one line, with the node's private address
```

A blank node reports `cluster_state:fail` until it joins. That's expected. The node also takes the client output buffer limit for normal clients from `valkey.conf`, like every other setting except its memory limit.

If the node shows keys, more than one known node, or assigned slots, its volume isn't new. Stop and find out why before any join.

## Step 4: Check reachability

Nothing in this step changes anything. Every check must print `open` or `PONG`.

1. Client port and bus port, from each cache node to the new node. On cache1, cache2, and cache3 (the container is `replica-redis-replica-1` on cache2 and cache3):

   ```sh
   docker exec main-redis-main-1 sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" valkey-cli -h 10.0.0.N PING'
   docker exec main-redis-main-1 bash -c '(exec 3<>/dev/tcp/10.0.0.N/16379) 2>/dev/null && echo open || echo closed'
   ```

2. Client port and bus port, from the new node to each cache node. On the new host:

   ```sh
   for h in 10.0.0.14 10.0.0.15 10.0.0.16; do
     nk -h $h PING
     docker exec node-redis-node-1 bash -c "(exec 3<>/dev/tcp/$h/16379) 2>/dev/null && echo open || echo closed"
   done
   ```

3. Client port, from every client host: both webapp hosts (`10.0.0.21`, `10.0.0.20`), and every host that runs a Windmill worker (the worker hosts and the cache hosts). On each host:

   ```sh
   timeout 3 bash -c '</dev/tcp/10.0.0.N/6379' && echo open || echo closed
   ```

   On the two webapp hosts, also check from the webapp's Docker network:

   ```sh
   docker run --rm --network coolify busybox:1.37-musl nc -z -w 3 10.0.0.N 6379 && echo open || echo closed
   ```

Don't join a node that any client can't reach. After the slots move, that client would time out on every lookup for them.

## Step 5: Join the node (production, owner present)

In the `tmux` session on cache1:

1. Check the cluster first. All three nodes report `ok`, no slot is open, and no save runs:

   ```sh
   sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh
   vk --cluster check 10.0.0.14:6379 | tail -n 5       # "All nodes agree", "All 16384 slots covered"
   for h in 10.0.0.14 10.0.0.15 10.0.0.16; do vk -h $h INFO persistence | grep -E 'aof_rewrite_in_progress|rdb_bgsave_in_progress|aof_last_write_status'; done
   ```

2. Join. This sends `CLUSTER MEET` to the new node. No slot and no key moves, and clients don't notice.

   ```sh
   vk --cluster add-node $NEW:6379 10.0.0.14:6379
   ```

   The command stops without joining if the new node holds keys or already knows other nodes.

3. Check, after about 10 seconds, on **every** node's own view. Each of the four must list four lines, all `master`, all `connected`, with no `fail`, `fail?`, or `handshake` flag, and report `cluster_known_nodes:4` and `cluster_state:ok`:

   ```sh
   for h in 10.0.0.14 10.0.0.15 10.0.0.16 $NEW; do
     echo "== view of $h"
     vk -h $h CLUSTER NODES | cut -c1-8,41-
     vk -h $h CLUSTER INFO | grep -E 'cluster_state|known_nodes'
   done
   ```

   A `fail?` flag in one view means that the bus port is blocked in one direction. Fix the firewall rule, or take the node out again with step 3 of [Remove a node](#remove-a-node). A joined node without slots is harmless and can stay for days.

## Step 6: Move slots to the node (production, owner present)

1. Set the weights. A weight is the node's memory limit in GB:

   ```sh
   ID1=$(vk -h 10.0.0.14 CLUSTER MYID); ID2=$(vk -h 10.0.0.15 CLUSTER MYID); ID3=$(vk -h 10.0.0.16 CLUSTER MYID); IDN=$(vk -h $NEW CLUSTER MYID)
   WEIGHTS="$ID1=7 $ID2=7 $ID3=7 $IDN=$NEW_GB"
   echo $WEIGHTS
   ```

2. Dry run. It prints the plan and moves nothing:

   ```sh
   vk --cluster rebalance 10.0.0.14:6379 --cluster-use-empty-masters --cluster-weight $WEIGHTS --cluster-simulate | grep -E 'weight|Moving'
   ```

   For a 2 GB node, expect three lines of about 475 slots each, all **to** the new node. If a line moves slots between two of the cache nodes, or the counts are far off, stop: a weight or an ID is wrong.

3. Note the key counts and memory: `sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh`.

4. Move. Keep the default pipeline of 10 keys per step: a larger one makes each step block both nodes for longer.

   ```sh
   vk --cluster rebalance 10.0.0.14:6379 --cluster-use-empty-masters --cluster-weight $WEIGHTS 2>&1 | tee /root/rebalance-$(date -u +%Y%m%dT%H%M%S).log
   ```

   The command prints one `#` per slot. It runs inside the container and keeps running when the terminal, the SSH connection, or the `docker exec` process goes away. **Ctrl-C doesn't stop it either:** the prompt returns and the move goes on. Don't start it a second time. `cluster-status.sh` shows whether slots still move, and [Stop midway](#stop-midway) has the command that stops it.

5. Watch while it runs, in a second terminal:

   - On cache1, every 20 seconds or so: `sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh`. The new node's `SLOTS`, `KEYS`, and `USED` grow. One open slot is listed while a move runs. Two readings of `SLOTS` tell how long the rest takes.
   - On the webapp host, the error and breaker counters must not rise:

     ```sh
     docker run --rm --network coolify busybox:1.37-musl wget -qO- http://goodwatch-webapp:9464/metrics | grep -E 'goodwatch_redis_breaker_events_total|result="(error|open)"'
     ```

   If the counters rise steadily, or the new node reaches `USE%` 100 long before the end, [stop midway](#stop-midway).

## Step 7: Verify

1. The command ended without an error line, and:

   ```sh
   vk --cluster check 10.0.0.14:6379 | grep -E 'slots:|agree|open|covered'
   sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh
   ```

   - `All nodes agree about slots configuration`, no open slot, `All 16384 slots covered`.
   - The slot counts match the dry run. The total of `KEYS` is about what it was before. It's lower when the new node had to evict.
   - Every node reports `ok`, and the new node's `MAX` is its own limit.

2. A read through cache1 works for a key wherever it lives now. With `-c`, `valkey-cli` follows a redirect as the clients do. This prints the length of the title snapshot's manifest, a number above zero:

   ```sh
   vk -c -h 10.0.0.14 STRLEN title-snapshot:current
   ```

3. On the webapp hosts, `goodwatch_redis_breaker_open_nodes` is 0 and the `error` and `open` results have stopped rising (the command in step 6).

4. The clients' start addresses stay the three cache nodes (`REDIS_HOST`, `REDIS_HOST2`, `REDIS_HOST3` in the webapp, `REDIS_HOSTS` in Windmill). Clients learn about the fourth node from the cluster. Don't add a temporary node to those settings.

5. Record the new node in [Private Redis](private-redis.md) if it stays.

## Stop midway

A rebalance can stop after any slot. The cluster works with any split of the slots, so there is no hurry to go forward or back. Only the slot that was moving at that moment needs care.

1. Stop the command by signalling the process inside the container. Ctrl-C in the terminal isn't enough: it ends only the `docker exec` process on the host.

   ```sh
   docker exec main-redis-main-1 sh -c 'for p in /proc/[0-9]*; do grep -qx valkey-cli $p/comm 2>/dev/null && kill -INT ${p#/proc/}; done'
   ```

2. Look for an open slot:

   ```sh
   sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh
   ```

   `Open slots: none` means the stop fell between two slots, and nothing is left to do.

3. Close an open slot at once. While it's open, plain reads and writes in that slot still work, but a read of a resettable cache (member data, share lists) for a stored key in that slot fails after about half a second, and each such failure makes that webapp process skip the cache for the whole source node for one second.

   ```sh
   vk --cluster fix 10.0.0.14:6379
   vk --cluster check 10.0.0.14:6379 | grep -E 'agree|open|covered'
   ```

   `fix` moves the slot's remaining keys to the node that holds most of them and assigns the slot to it. It took 0.2 seconds in the rehearsal and asked nothing. Never close a slot by hand with `CLUSTER SETSLOT`: that can leave keys on a node that doesn't own them.

4. Then decide:
   - **Go forward:** run the dry run and the move from step 6 again. It continues from the current split.
   - **Go back:** follow [Remove a node](#remove-a-node).
   - **Stay:** a partly filled node is a valid state. Come back later.

## Remove a node

This is also the way back after step 5 or step 6. It moves all of the node's slots to the remaining nodes and then takes the node out of the cluster. Production, owner present.

The remaining nodes must take the node's keys. If they're at their limit, they evict about as much as they receive, so the cluster ends up with less cached data than before the node was added. That's the cache working as designed, and the webapp answers the misses from the databases.

In the `tmux` session on cache1, with `NEW` set to the leaving node and `vk` defined as in [Values](#values):

1. **Make sure the node can't turn into a replica.** This must print `no`:

   ```sh
   vk -h $NEW CONFIG GET cluster-allow-replica-migration
   ```

   A node started from `goodwatch-cache/node/` has it. For any other node (cache1 to cache3 run with the default, `yes`), set it on the leaving node first:

   ```sh
   vk -h $NEW CONFIG SET cluster-allow-replica-migration no
   ```

   With `yes`, the node becomes a replica of the node that takes its last slot and loads that node's whole data set. A replica ignores its own memory limit (`replica-ignore-maxmemory yes`). In the first rehearsal round, the emptied node did exactly that and held a full copy of another node 11 seconds after its last slot left. A 2 GB node on a small host would try to load 7 GB.

2. Move the slots away with weight 0 for the leaving node, dry run first:

   ```sh
   ID1=$(vk -h 10.0.0.14 CLUSTER MYID); ID2=$(vk -h 10.0.0.15 CLUSTER MYID); ID3=$(vk -h 10.0.0.16 CLUSTER MYID); IDN=$(vk -h $NEW CLUSTER MYID)
   WEIGHTS="$ID1=7 $ID2=7 $ID3=7 $IDN=0"
   vk --cluster rebalance 10.0.0.14:6379 --cluster-weight $WEIGHTS --cluster-simulate | grep -E 'weight|Moving'
   ```

   Every line must move slots **from** the leaving node. Then:

   ```sh
   vk --cluster rebalance 10.0.0.14:6379 --cluster-weight $WEIGHTS 2>&1 | tee /root/rebalance-$(date -u +%Y%m%dT%H%M%S).log
   ```

   Watch as in step 6. Check afterward:

   ```sh
   sh /root/goodwatch/goodwatch-monorepo/goodwatch-cache/cluster-status.sh
   vk -h $NEW DBSIZE                           # 0
   vk -h $NEW CLUSTER NODES | grep myself      # "myself,master", and no slots at the end of the line
   ```

   The leaving node must show `master`, 0 slots, and 0 keys. The three cache nodes must hold 5,461 or 5,462 slots each.

   If the node shows `slave` (step 1 was skipped), go on with step 3 at once. It works the same for a replica and ends the copy.

3. Take the node out of the cluster. This is the one place where `CLUSTER FORGET` is right: the command sends it to the remaining nodes and resets the leaving node.

   ```sh
   vk --cluster del-node 10.0.0.14:6379 $IDN
   ```

   The command refuses to remove a node that still owns slots.

4. Verify on the three cache nodes: three known nodes, state `ok`, all slots covered.

   ```sh
   for h in 10.0.0.14 10.0.0.15 10.0.0.16; do vk -h $h CLUSTER INFO | grep -E 'cluster_state|known_nodes|slots_assigned'; done
   vk --cluster check 10.0.0.14:6379 | grep -E 'slots:|agree|open|covered'
   ```

5. Stop the container on the leaving host:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-cache/node
   docker compose down
   ```

   This keeps the volume. It still holds the node's append-only file (542 MB in the rehearsal) and its old identity, and no key that the cluster needs. Before the host gets a node again, remove the volume, so that the next node starts blank: `docker volume rm node_redis-data`. That deletes data, so it's the owner's call.

6. The owner removes the firewall rules from step 2.

To replace one of cache1 to cache3 with another host, add the new node with weight 7 first, then remove the old one with this section, and change the clients' start addresses afterward. That case isn't rehearsed.

## What clients see

Read from the webapp's client code (`goodwatch-webapp/app/utils/cache.ts`, `redis-breaker.ts`) and measured in the rehearsal with the same client library version (`ioredis` 5.4.1), the same options and Lua scripts, a copy of the breaker, and `redis-py` 5.2.1 as the Windmill scripts use it.

| Event | What the client does | What a request sees | Rehearsal |
|---|---|---|---|
| The join and the final `del-node` | Nothing | Nothing | No redirect and no error |
| A slot has moved (`MOVED`) | `ioredis` and `redis-py` retry on the new owner and refresh their slot table | One more round trip, once per moved slot range and client | 185 followed by the `ioredis` loop, none failed |
| A key of the one slot in motion was already moved (`ASK`) | Retry on the target for this one command | One more round trip | 15 followed, none failed |
| A two-key command hits the slot in motion while its keys are split (`TRYAGAIN`). The webapp sends these for resettable caches: `MGET` of a value and its reset marker, and the two Lua scripts. | `ioredis` retries after 100 ms | The lookup takes 100 to 125 ms and still answers from the cache. It stays under the 1-second limit, so it isn't counted as `error` and the breaker isn't touched. | 4 of 465,713 operations, with half of the loop aimed at the slots in motion |
| A key arrives on a node that is at its limit | The node evicts other keys | Later lookups for the evicted keys miss and run the target | 8,574 keys evicted on one receiver in the removal, no error |
| The new node is unreachable for a client (missed in step 4) | Connect fails within 300 ms and the breaker for that node opens | Every lookup for the new node's slots skips the cache and runs the target, in that process, until the port is open | Not rehearsed, read from the code |

Totals over both rehearsal rounds, with five complete slot moves, one interrupted move, and one node that turned into a replica for a minute:

- **`ioredis` loop, 300 operations per second:** 465,713 reads and writes, every one answered with the right value. No error, no timeout, no breaker opened. p95 per second was 5 to 10 ms on the shared host with and without a move in progress. Four operations took longer than 100 ms, and the longest took 125 ms.
- **`redis-py` loop, 50 operations per second:** 98,650 reads and writes, no error, and the longest took 43 ms.
- **1 MB values without an expiry** (stand-ins for the title snapshot chunks) moved with their slots and were read throughout.

What that means for production requests:

- **The webapp keeps answering from the cache during every step.** Redirects are followed inside the client library and never reach `cache.ts`. The 1-second command limit and the breaker only see a command that fails or hangs, and no step produced one.
- **At production density a slot is in motion for about 45 ms**, and one slot of 16,384 moves at a time. With 15 to 21 commands per second per node (October 7, 2026), a move of a few minutes meets a handful of commands in the slot in motion. Expect some `MOVED` redirects per webapp process and perhaps no `TRYAGAIN` at all.
- **Each webapp process opens a connection to the new node** at the first redirect to it. That needs the client port from step 2.
- **A moved key loses its usage counter.** In the rehearsal, keys read 400 times went from a counter of 14 to the start value of 5, and kept their lifetime to the second. Until they're read again, moved keys are the first candidates for eviction on their new node.
- **An open slot is the one state that reaches requests.** With a slot left open by an interrupted move, `GET` and `SETEX` still worked, but `MGET` of a stored value and its absent reset marker failed after 549 ms with `Too many Cluster redirections. Last error: TRYAGAIN`. `cache.ts` counts that as a node failure, so the breaker of the source node opens in that process and its lookups skip the cache until a probe closes it a second later. Only keys of that one slot trigger it, so it's rare, and `--cluster fix` ends it.
- **Removing a node costs cached data when the others are full.** The receivers evict about as much as they take in. With today's fill, removing a 2 GB node would evict about 1.8 GB, around 60,000 entries, and their next lookups go to the databases.

## How long it takes

Measured in the rehearsal, with the default pipeline of 10 keys, the two client loops running, and all four nodes on one 4-core host:

| Move | Slots | Keys | Data | Time | Per slot |
|---|---|---|---|---|---|
| Round 1, add with weight 2 (2.8 keys and 85 KB per slot) | 1,426 | 3,927 | 112 MB | 12.6 s | 9 ms |
| Round 1, on to equal weights | 2,245 | 6,193 | 185 MB | 24.6 s | 11 ms |
| Round 1, remove (receivers at their limit) | 4,096 | 11,284 | 331 MB | 41.5 s | 10 ms |
| Round 2, add: the 299 slots with production's density (48 keys and 1.4 MB per slot) | 299 | 14,300 | 428 MB | 13.4 s | 45 ms |
| Round 2, add: whole move | 1,426 | 17,430 | 535 MB | 25.5 s | |
| Round 2, remove: the dense slots, into a receiver that evicts | 299 | 14,300 | 428 MB | 14.8 s | 50 ms |
| Round 2, remove: whole move | 1,426 | 17,430 | 535 MB | 27.7 s | |

The two densities give a cost of about 8 ms per slot plus 0.8 ms per key (about 26 ms per MB at 30 KB per key). At production's density the move ran at about 1,000 keys and 30 MB per second.

Production on October 7, 2026: 698,000 keys and 21 GB in total, so 43 keys and 1.3 MB per slot, and about 41 ms per slot by this model.

| Node added or removed | Slots | Keys | Data | On the rehearsal host | Plan for |
|---|---|---|---|---|---|
| 2 GB, weight 2 | 1,425 | about 61,000 | 1.8 GB | about 1 minute | 2 to 3 minutes |
| 7 GB, weight 7 | 4,096 | about 175,000 | 5.3 GB | about 3 minutes | 5 to 10 minutes |

Why the plan is two to three times the measurement:

- **Network.** In the rehearsal every node and `valkey-cli` shared one host. In production each step is a round trip between hosts, about 12 per slot, and 30 MB per second is about 240 Mbit/s on the private network.
- **Hardware and disk.** The cache hosts have other CPUs and disks, and the receiving node writes every key to its append-only file.
- **Value sizes.** The rehearsal's dense slots matched production in keys and in megabytes per slot at once, so it can't say which of the two drives the time. Production has values of 500 KB to 1 MB (large person profiles, snapshot chunks), and each key moves in one blocking step.
- **Fill.** The numbers follow the data. At 3 GB per node the same slots hold less than half of it.

The first minute of the real move gives a better number than any estimate: read the new node's `SLOTS` in `cluster-status.sh` twice and extrapolate.

## Rehearsal record

October 7, 2026, on a worker host, in Docker, on a private bridge network with one address per node, so that the nodes used the production ports and the unchanged `goodwatch-cache/valkey.conf`.

- **Cluster:** three nodes from `goodwatch-cache/replica/docker-compose.yml` and a fourth from `goodwatch-cache/node/docker-compose.yml`, image `valkey/valkey:8.1.10` by digest, with a password. A Compose override replaced host networking with the bridge network. The three base nodes got a 1 GB limit at runtime, lowered to 400 to 600 MB before each removal so that they evicted, as production's nodes do today.
- **Data:** 40,000 keys with expiries, shaped like a production sample (80% data entries of 1 to 20 KB, 20% cards near 110 KB, mean 30 KB), 36 keys of 1 MB without an expiry, and in round 2 another 13,500 keys of 30 KB placed in slots 0 to 299, which gave those slots production's 48 keys and 1.4 MB.
- **Clients:** `goodwatch-cache/rehearsal/probe.mjs` (`ioredis` 5.4.1 with the webapp's options, scripts, deadline, and a copy of its breaker) and `probe.py` (`redis-py` 5.2.1), running through every step.

Round 1 found three things that the first draft of this runbook had wrong or didn't have:

1. **The emptied node became a replica.** After the move with weight 0, the fourth node reconfigured itself as a replica of the node that took its last slot, synchronized in full, and held 13,337 keys and 399 MB again. `del-node` removed it cleanly from that state. `goodwatch-cache/node/docker-compose.yml` now starts added nodes with `cluster-allow-replica-migration no`, and round 2 confirmed that the emptied node stays an empty master.
2. **Ctrl-C doesn't stop a move.** The prompt returned and `valkey-cli` kept moving slots inside the container. The same happened when the `docker exec` process was killed. A signal to the process inside the container stopped it at once and left one slot open.
3. **A node shows open slots only in its own view.** The status helper asked one node and reported none. It now asks every node.

Round 2 followed this runbook as written, with the rehearsal's container names and addresses in place of production's: step 1 (the `.env` commands only), steps 3 to 7, and all of [Remove a node](#remove-a-node). Every check printed what the runbook says. The interrupted move and `--cluster fix` are from round 1.

To repeat the rehearsal, for example before a Valkey upgrade, use the scripts in `goodwatch-cache/rehearsal/`: `load.mjs` fills a cluster, `probe.mjs` and `probe.py` are the client loops, and `open-slot.mjs` shows what a client gets from an open slot.

## Not rehearsed

- **Production itself.** No command of this runbook has run on cache1 to cache3. The ticket's plan was a temporary 2 GB node on a worker host in the production cluster. That run is still open and needs the owner.
- **Step 1 on a real host:** the kernel setting, the checkout, and copying the password line between hosts.
- **Step 2 and step 4 across hosts:** firewall rules, the bus port between real hosts, and the client port from the webapp hosts and the Windmill workers. The rehearsal's nodes shared one bridge network without a firewall.
- **A client that can't reach the new node.** The effect is read from the code.
- **The real webapp.** The loop copies the client's options, scripts, and breaker. It isn't the webapp, and it doesn't count `goodwatch_data_cache_requests_total`.
- **Host networking and `10.0.0.x` announce addresses** for the fourth node. The Compose file's command, environment, user, and volume were used as they are.
- **Scale.** The largest single move was 535 MB. Production moves 1.8 to 5.3 GB between hosts. No append-only-file rewrite or background save was forced during a move.
- **`add-node` refusing a node that isn't blank, and `del-node` refusing a node with slots.** Both are documented `valkey-cli` behavior and weren't provoked.
- **A node failure during a move,** and a title snapshot publish (`f/sync/copy/title_snapshot.py`) during a move. The publish scans each node for old chunks: a chunk that moves during the scan can be missed and is then pruned by the next run.
- **Replacing one of cache1 to cache3,** and a second added node.

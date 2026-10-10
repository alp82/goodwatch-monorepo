# One cache node down: the drill

What production does while one of the three cache nodes is down, for
[Run a one-node Redis failure drill](https://github.com/alp82/goodwatch-monorepo/issues/290). Run on October 10, 2026,
07:24 to 07:39 UTC, with the owner's go-ahead.

## Result

- **No request failed.** Neither page instance and neither search role counted a 5xx answer from 07:23 to 07:39 UTC.
- **The other two nodes kept serving.** The cluster stayed `cluster_state:ok` with 10,923 of 16,384 slots.
- **Lookups for the missing slots cost 3 errors per page instance,** then the client marked the node as down and
  sent those lookups straight to the database.
- **A webapp that starts during the outage serves pages,** without a title snapshot until the node is back.
- **The node came back with its data** 16 seconds after its start, and every process used it again within a minute.
- **Not exercised: a ranked search during the outage.** By the code and its tests, it gets basic results without the reading. See [What the drill exposed](#what-the-drill-exposed).
- **Not measured: page latency during the outage.** The benchmark load didn't run. See [What wasn't measured](#what-wasnt-measured).

## What was done

| Time, UTC | Event |
| --- | --- |
| 07:26:14 | `docker kill` of the node on cache1 (slots 0 to 5,460), which is an abrupt stop. That node holds the title snapshot's manifest and the search coordination keys. Its start was scheduled on the host itself, 300 seconds later |
| 07:26:46 | A third webapp started on vector1 from production's image and settings, without a route, so it got no visitor |
| 07:27:16 | Smoke check on the public route |
| 07:28:56 | Four pages requested from the third webapp |
| 07:31:13 | `docker start` of the node |
| 07:31:29 | The node answers `PONG` |
| 07:33:59 | The same four pages again, then the smoke check |
| 07:39:15 | The third webapp removed |

Traffic was production's own, about 14 answered requests per second per page instance (counted from the instances'
response counters between 07:28 and 07:39).

## What the processes did

| Question | Reading |
| --- | --- |
| Do the other two nodes keep serving? | Yes. `cluster_state:ok` throughout, 10,923 slots ok, 5,461 flagged as failed. Lookups for the other nodes' slots went on as hits and misses |
| How fast do lookups for the missing slots fall through? | 3 lookups per page instance ended as `error` (each within the 1 second command timeout). After that the breaker for the node was open and lookups ended as `open` without waiting: 1,142 on one instance and 1,491 on the other until the node was back |
| Failed requests | None. No 5xx on the page instances (about 5,500 and 5,700 answers with 2xx during the sampled 11 minutes) or on the search roles |
| The breaker | Open on every process at the first reading, 62 seconds after the kill. Closed on the page instances at 07:31:31 and 07:31:32, 18 seconds after the node's start. Closed on the search roles at 07:32:02 and 07:32:12: a breaker closes on a probe under traffic, and the roles had almost none |
| The title snapshot in the running processes | Kept. Every process logged `Title snapshot check failed` once a minute (first `Command timed out` or `Too many Cluster redirections`, then `Redis node is marked down`) and went on with the snapshot it had |
| A webapp that starts during the outage | The client connected (`goodwatch_redis_client_ready` 1), with the breaker open for the one node. Home, a movie page, Discover, and a person page answered 200 in 193 to 473 ms. It had no title snapshot until the node was back, and then loaded it by itself (243,285 titles in 1.2 s). What Discover and the home page show without a snapshot wasn't looked at |
| Does the node rejoin with its data? | Yes. 229,550 keys before the kill and 229,543 when it answered again, 16 seconds after its start. The other nodes cleared the failed flag by themselves |
| The smoke check | During the outage it failed two lines per process, as intended: the breaker gauge and the snapshot log line. Every page, OG image, and search request line passed |

The earlier worry that a process stays without a cache after a failed connect didn't show: every process, the one
that started during the outage included, read the returned node again without a restart.

## What the drill exposed

- **A search that needs a reading depends on the node that holds its coordination keys.** All of them share one
  slot (`{goodwatch-search-v2}`, on cache1), and the admission script runs on that node. While it is down, such a
  search answers with basic results and no paid reading starts. This page first said that it fails: that was a
  misreading of the code, which already caught the error and recorded it as `storage`. Since
  [Decide what a search does while the cache node with its coordination keys is down](https://github.com/alp82/goodwatch-monorepo/issues/408)
  the case has its own reason (`coordination`), one log line per minute, and tests. Searches that are answered from
  the interpretation cache in Crate keep their readings. The drill didn't send a search: a ranked search on
  production writes history rows and can start a paid reading call.
- **The smoke check kept failing after the node was back,** for the page instances until the next deploy and for
  the search roles even after a restart, because it read the container's whole log. It now reads the log since the
  process started, so a restart clears it.
- **The home warm-up** takes a lease on one node (`{...}:warmup`). When that node is down, the warm-up request
  fails and the home page is computed on request, as it is without a warm-up. Read from the code, not exercised:
  no warm-up ran during the outage.

## What wasn't measured

- **Page latency and the error rate seen by a client.** The benchmark load that should have run next to the drill
  stopped at its start (its short mode allows 120 seconds, and the drill asked for 840). The numbers above are the
  instances' own counters.
- **The moment the breaker opened.** The sampler's first two minutes are lost to a mistake in its connection
  settings. The first reading is 62 seconds after the kill.
- **Load.** Production's own traffic only. During a spike, the lookups for a third of the slots would all reach
  the databases.
- **A longer outage,** and a node that comes back without its data.

## Reproduce

The scripts were one-off and aren't in the repository. The steps: sample `goodwatch_redis_breaker_open_nodes`,
`goodwatch_redis_breaker_events_total`, `goodwatch_data_cache_requests_total`, and `goodwatch_http_responses_total`
on every webapp container every 5 seconds, `docker kill` one node with its start scheduled on the same host, and
follow [Recreate a node](../private-redis.md#recreate-a-node) for the checks after its return.

---
status: accepted
---

# Guard data cache resets across processes with a reset marker in Valkey

A cache that has a reset path declares it with `declareResettableCache`. A reset then writes a marker next to the
value, and a run stores its value only if the marker is the one it saw when it started. Decided on October 4, 2026,
before a second webapp instance takes traffic.

Without the guard, `resetCache` deleted the key and outdated the in-flight run only in the process that received the
write. A run in another process that had read the old rows stored them after the reset, and both processes served
them until the entry expired: 60 seconds for member settings, up to 10 minutes for a deleted or unlisted share list.

## Choices

- **A marker per key, in the value's slot.** The marker key is `cached-reset:{<value key>}`. The hash tag makes it
  hash like the value key, so one script or one `MGET` can touch both on a cluster. The value key doesn't change.
- **A random token, not a counter or a time.** A reset writes a new token. A counter repeats after the marker
  expires. A time needs the two hosts' clocks to agree.
- **The lookup reads the marker with the value.** A guarded lookup is one `MGET` of both keys in place of one `GET`.
  The run keeps the marker it saw: a token, "none", or "unknown" when Redis didn't answer.
- **The store is a compare-and-set.** One script reads the marker and stores the value only if the marker is
  unchanged. Valkey runs a script as one step, so a reset can't land between the check and the store.
- **The reset is one script.** It writes the token and deletes the value.
- **A hit doesn't check the marker.** A value in Redis was stored by a run that passed the check, and a reset deletes
  the value that was stored before it. Only the in-flight run can carry an old value past a reset.
- **A lookup joins a run only if both saw the same marker.** Otherwise a process would hand the old run's result to
  lookups that arrive after the reset.
- **A run with an unknown marker, or one older than 270 seconds, stores nothing.** The marker lives for the value's
  lifetime plus its stale window plus 300 seconds, so a run that can still store can always see the reset that
  outdated it.
- **An unconfirmed reset stays pending in the process that issued it.** That process skips the cache for that key
  and retries the reset every 5 seconds, from a timer and from lookups, until Redis confirms it or the marker lifetime
  has passed. At most 1,000 keys are pending.
- **The declaration can't be forgotten.** `resetCache` and `resetCacheConfirmed` throw for a name that isn't
  declared. `cached()` guards every declared name by itself.

Rejected:

- **A message bus or pub/sub between processes:** a new moving part, and a missed message is a missed reset.
- **A marker check on every hit:** a second key read on the hottest path, for a case the reset's delete already
  covers.
- **A version inside the value:** it needs the same marker to compare with, and changes the value format.
- **A lock around the run:** a reset would wait for, or have to break, a run in another process.

## What holds

Guaranteed, while Redis answers the reset:

- A run that started before a reset in any process doesn't store its value.
- A lookup that starts after the reset doesn't get the result of a run that started before it.
- No process serves the pre-reset value from Redis, fresh or stale, after the reset returns.

Best effort:

- **The reset isn't confirmed** (the node is down, its breaker is open, or the command timed out). The process that
  issued it serves fresh data and retries. Other processes can't read the value while the node is down. When the node
  returns from its append-only file with the old value, they can serve it until the next retry lands: up to about 5
  seconds, plus the time the issuing process's breaker needs to close.
- **The issuing process exits before a retry lands.** The pending reset is lost. The old value lives until it
  expires.
- **The node loses the last second of writes** (`appendfsync everysec`) and restarts after a confirmed reset. The
  old value can return until it expires.
- **A process can't read Redis for a key while a run for it is in flight.** Lookups in that process may join that
  run for as long as it runs.
- **Lookups that started before the reset** can return the pre-reset value.

## Consequences

- Caches without a declaration send the same commands as before: one `GET` per lookup, one `SETEX` per store.
- A guarded lookup is one `MGET`, a guarded store one script call, and a reset one script call. The round trips per
  operation don't change.
- A declared cache with a lifetime of zero sends nothing on a reset.
- The share list module's own "skip the cache after an unconfirmed reset" map moved into `cached()` and now covers
  every declared cache.
- A third instance or a restart changes nothing: the marker lives in Valkey, and a new process has no in-flight runs.
- `goodwatch_data_cache_reset_guard_total` counts the guard's events per cache. The queries are in
  [viral spike metrics](../benchmarks/viral-spike-metrics.md).

Evidence: the resolution of the ticket "Make data cache resets hold across webapp processes", which has the
two-process test results.

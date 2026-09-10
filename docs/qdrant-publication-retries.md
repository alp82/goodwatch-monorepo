# Qdrant publication retries

Issue [#7](https://github.com/alp82/goodwatch-monorepo/issues/7) retries the
prepared Qdrant upsert without restarting source crawlers. Point IDs and payloads
remain the same between attempts. The streaming publication leases introduced
in [partial publication](streaming-partial-publication.md) remain held through
backoff and completed writes; ownership is checked again before any retry.

The request deadline is 30 seconds. Each retained point batch has a total retry
budget of 120 seconds and at most four attempts. A new attempt is admitted only
when its whole request deadline fits the remaining budget. Backoff uses jitter
in the ranges 1–2, 2–4, and 4–8 seconds. Thus repeated full request timeouts may
exhaust the budget before all four attempts are admitted. The existing lease
requires four minutes of remaining ownership, longer than this retry budget.

These values follow three real gRPC upserts from the previously affected
`06b3c66b44d9` default worker on `10.0.0.20`: 13.0, 13.3, and 11.6 milliseconds.
The probe copied a real media point into a disposable collection with matching
vector schemas, verified the saved payload, and removed its collection. This
measures a small targeted write, not the largest scheduled batch. The explicit
30-second allowance provides room for larger writes and temporary server load.
Pinned qdrant-client 1.15.1 uses its configured client timeout for gRPC upsert;
its default when configured with `None` was five seconds, not necessarily an
unbounded wait. There is no per-upsert timeout argument in that version.

Only selected transient transport/service failures are retried. Authentication,
schema, invalid-data, and non-completed write results fail promptly. Exhausted
attempts or budget and lost ownership surface a structured failure, leaving
priority demand unacknowledged. Logs contain counts and error categories, never
point payloads or credentials. A completed transport response is acknowledged
only when Qdrant reports the completed write status and ownership still holds.

Transient classifications are gRPC `UNAVAILABLE`/`DEADLINE_EXCEEDED`, HTTP
connect/timeouts, and HTTP 502/503/504. Other HTTP responses, including 429,
are not retried by this publication policy. Failure categories distinguish
`attempts_exhausted`, `budget_exhausted`, `lease_lost`, authentication,
invalid data, and incomplete write status; original errors are counted separately.

A second probe on the same affected worker injected one `UNAVAILABLE` before
calling the real upsert with the identical retained point. It completed on
attempt two after one retry (1.177 seconds total), performed four ownership
checks, and returned an exact matching read-back. Its disposable collection was
removed. The injected failure did not interrupt Qdrant or change any firewall.

Rollback restores the previous `priority/publish` and `sync/copy/vector_data`
script definitions and their locks; existing publication leases and source
records remain unchanged. The pre-change deployment snapshots are retained
privately at `/home/alp/.local/state/goodwatch/issue-7/20260910T233545Z`.

Validation: all 112 discovered Python tests pass, with five optional Crate
integration checks skipped because this change does not alter Crate behavior.
Eight retry-boundary tests cover recovery, permanent failures, completion status,
full-request budget admission, attempts exhaustion, and ownership loss.
Twenty priority/vector tests include a composed retry that confirms source
transformations run once while deterministic points are reused. The three
changed production modules pass Pyright with zero errors.

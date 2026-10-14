# G1 webapp ordering, stage 2

Stage 2 consumes stage 1's `g1:v1:<member>` payload. It never fits B3/B5 in a request.
The pinned model hash is `e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1`.
The six public Python fixtures pass exact TypeScript parity for order, groups and mix prefix length.

## Request behavior

`REC_G1_ORDER` accepts `off` (default), `shadow`, `preview`, or `on`. Invalid values resolve to off.
`REC_PREVIEW_USERS` is a comma-separated list of explicit member ids. Preview and shadow apply only
there; guests always keep today's order. On enables members generally and is reserved for a later owner decision.

Discover applies G1 only to catalogue Best match, after filtering and before paging. Search lists,
Explorer lists, and For you under other sorts retain today's order. F3 recomputes franchise leaders
on the request's filtered list, retaining global B5 membership. Watch next and My movies apply F3
to their Wishlist under Best match, then keep their fit/time groups and Not tonight positions within
each group. Only fitting, non-passed candidates receive the first-100 mix. Other Watch next sorts,
suggestions and mood pictures retain today's rules. Tonight's direct planner calls retain today's order.

**The taste match on cards and the taste match filter stay today's formula. They can disagree with
G1's order. Tell the owner this before the trial.**

The reader validates format, hash, snapshot version, build time, column alignment/types/ranges,
unique sorted point ids and snapshot mapping. Payloads older than **36 hours** fall back (the job's
48-hour TTL is eviction, not freshness). Missing, bad, stale, mismatched, unmappable or unavailable
payloads retain today's entire order and log a reason on every attempted G1 request. Titles outside
the offline candidate pool follow keyed titles in today's relative order, subject to Watch next's
own fit/time groups. JSON GET runs each request so new builds and deletion are immediately visible;
validated row mappings are reused per member, payload build and snapshot for ten minutes, capped
at twenty members. The raw payload is also compared, so a changed payload with an identical build
time cannot reuse stale components. No payload is exposed to the browser.

Exposure records carry `ordering` and the resolved boolean flag plus nullable G1 mode, fallback
reason, build time, hash, snapshot version, aligned per-card group/mix fields and Watch next tier
(`hero`, `then`, or the tier key). Under G1, `today_first_100` holds the control list before paging;
under shadow, `g1_first_100` holds the candidate list. Suggestions/unkeyed titles have null G1
fields. Shadow retains today's displayed order and logs the first-30 intersection count and the
number compared. Watch next's comparison is after fit/time/Not tonight grouping and refill.

## Owner activation (nothing deployed or executed against production)

1. Apply [the exposure table DDL](exposure-log/schema.sql) if #525 has not been deployed, or
   [the nullable-column migration](exposure-log/g1-migration.sql) to the existing table, before
   deploying the webapp.
2. Validate the locked worker's NumPy 2.5.3 with stage 1's pack parity command before enabling preview.
   Local stage 1/2 tests use existing NumPy 2.5.2. Keep the declared live/all-member input differences.
3. Deploy `g1_order`, `g1_trigger`, and the updated `title_snapshot` scripts and their metadata/locks.
   Provision a dedicated **g1-order worker tag with exactly one worker process** (at least 1 GiB
   for a pack-sized pool). The G1 script also declares concurrency limit 1 and zero time window.
   [Windmill concurrency limits](https://www.windmill.dev/docs/script_editor/concurrency_limit)
   require a supported edition; the single worker serializes builds regardless. Do not allow
   another worker to consume this tag. All preview ids are built sequentially in that job.
4. Set Windmill variable `f/sync/g1_preview_members` to a JSON array containing only the owner's id:
   `["<owner-member-id>"]`. Missing/empty config means disabled. The trigger only passes these ids.
   Every successful snapshot publication enqueues G1; the existing nightly title snapshot schedule
   also enqueues it when no title analysis changed. Ensure that existing nightly schedule is enabled.
   Dry runs, lock contention and failed snapshot runs enqueue nothing. G1 queue errors do not fail
   the snapshot. Manual `g1_order` calls still default to `dry_run=true`; an approved publish needs
   `dry_run=false` and explicit member ids. No new schedule is deployed by this change.
5. Deploy/restart the webapp with `REC_PREVIEW_USERS=<owner-member-id>` and
   `REC_G1_ORDER=shadow`. G1 reads the existing webapp Valkey cluster (no new endpoint setting).
   Review a day of overlap/fallback logs and exposures, then restart with `REC_G1_ORDER=preview`.
   Roll back with `REC_G1_ORDER=off`. Keep `on` unused until the second owner decision.

## Follow-ups and validation

Rating-triggered rebuilds are deferred: `markTasteChanged` debounces the local taste rebuild,
but the webapp has no Windmill client, enqueue API, or credentials. Adding that integration is not
cheap reuse of the current path. Until it exists, new ratings use the previous G1 payload until
snapshot/nightly publication, with the 36-hour limit enforced. Snapshot changes can briefly fall
back while the queued G1 job rebuilds. Action-to-exposure attribution remains #525's follow-up.

Checks run serially after `free -m`, with fake backends and no installed packages: the TypeScript
fixture/reader/integration tests, the existing exposure/list/filter cache/My pages/taste/Watch next/
For you/filter-state/Crate insertion suites, Python G1 and enqueue tests, and exposure schema checks.
The enqueue tests load the snapshot module with stub connectors; the wider snapshot suite's
optional `crate`, `fakeredis`, `mongomock`, `mongoengine`, and `wmill` packages are absent locally.
Typecheck has the same 174 existing diagnostics and no added or removed diagnostics against branch base `4ea4b8bbbbb7e493f014dbbbee2806d1d41eb0e7` with the same existing
webapp dependencies, ignoring path and line shifts. This change touches only server ordering and
logging; it adds no browser imports or landing assets. No production mode, production write,
deployment, push, PR, research-worktree edit or git metadata write was performed.

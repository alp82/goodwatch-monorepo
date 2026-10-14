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
time cannot reuse stale components. Composed orders, groups, mix placements and ranks are also cached:
member, validated payload identity/build time, snapshot version, SHA-256 of the **ordered** filtered
candidate keys, and mix mode define a hit. Input order matters for stable ties and the unknown suffix.
The order cache expires after ten minutes and uses LRU eviction, with at most four variants per
member, forty entries and 200,000 retained title slots in total. Oversized lists are computed without
retention. Watch next copies the cached F3 metadata before adding its fitting-only mix. No payload
is exposed to the browser.

With G1 enabled or shadowed, the initial Watch next response carries a random opaque `planId`.
Later `/api/watch-next/cards` requests send it as `plan`; their exposure uses that original plan's
build time, groups, mix placements, control order and tiers even if a new payload is published or
deleted in between. New whole-list requests still check the current payload and its freshness.
Plans are member/choice scoped, expire after ten minutes, and are bounded to forty plans and
100,000 Wishlist entries per process. A missing, evicted, expired, wrong-member or wrong-choice
plan returns empty cards with `refreshRequired=true` and no exposure; the browser refetches the
whole list, then requests batches with the new plan. This also handles restarts and requests reaching
another instance; sticky routing improves reuse but is not required for correctness. Off-mode
requests keep their previous card query identity and ordering path.

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
   `dry_run=false` and explicit member ids. All manual calls, including dry runs, now validate
   every supplied id against that variable **before opening database connectors**. Missing,
   malformed or empty configuration fails closed. No new schedule is deployed by this change.
5. Deploy/restart the webapp with `REC_PREVIEW_USERS=<owner-member-id>` and
   `REC_G1_ORDER=shadow`. G1 reads the existing webapp Valkey cluster (no new endpoint setting).
   Review a day of overlap/fallback logs and exposures, then restart with `REC_G1_ORDER=preview`.
   Roll back with `REC_G1_ORDER=off`. Keep `on` unused until the second owner decision.
6. Set server-only `G1_WINDMILL_URL` to the Windmill HTTPS origin, `G1_WINDMILL_TOKEN` to a
   dedicated token scoped to `jobs:run:scripts:f/sync/copy/g1_order`, and (if needed)
   `G1_WINDMILL_WORKSPACE` (default `goodwatch`). Keep `REC_PREVIEW_USERS` in sync with
   `f/sync/g1_preview_members`. No URL/token means the interaction trigger is disabled; snapshot
   and nightly triggers still work. The executing identity must have the script's existing
   connector/preview-variable permissions. Configure no broader run scopes or worker-tag override.

## Follow-ups and validation

Committed score changes (including clears), Want to See, Skip and Not interested additions/removals
schedule G1 only for `REC_PREVIEW_USERS`; `REC_G1_ORDER=on` never broadens rebuild eligibility.
The server adapter coalesces changes per member until 1.5 seconds after the last write, following
`markTasteChanged`'s settle timing. Writers schedule immediately after committed storage changes,
before cache/tracking follow-up work can fail; `markTasteChanged` also covers imports and tracking's
Want to See removals. Clearing Not interested through a positive interaction triggers it as well.
The timer rechecks membership, then POSTs `{member_ids:[id],dry_run:false}` to the existing
`f/sync/copy/g1_order` queue, whose `g1-order` tag and single-worker/concurrency settings still
serialize builds. Debounce is process-local: multiple instances can enqueue duplicates, but builds
remain serialized. Queue failures are contained and logged without credentials; there is one
five-second attempt and no automatic retry of a potentially accepted POST. Snapshot/nightly builds
remain the recovery path. The old payload stays usable until replacement or the 36-hour limit.

The webapp had no Windmill invocation pattern. The simplest existing repo integration is direct
HTTP with a Bearer header (`goodwatch-flows/scripts/export_tvtropes_cohort.py`, `variable()`), rather
than an added SDK. This adapter uses native server `fetch` with explicitly provisioned credentials,
never the CLI profile, forbids redirects, and accepts only a credential-free HTTPS origin.
The endpoint/body and restricted run scope are confirmed by Windmill's
[job inputs documentation](https://www.windmill.dev/docs/core_concepts/jobs) and
[token documentation](https://www.windmill.dev/docs/core_concepts/user_tokens).
Action-to-exposure attribution remains #525's follow-up.

Synthetic 60,000-title benchmark (30,000 movies/30,000 shows, deterministic ranks, franchise
triples, animation every fifth title, own shares `[0.4,0.2]`): three warmups and twenty measured
requests include the fake payload GET/freshness checks and composition, excluding real network,
filtering and rendering. Baseline is branch HEAD `576980649f1fee10e9a97feacdf5a88b6c9905c5`'s
reader; both runs use identical data and the same existing Node runtime.

| Request composition | Min | Median | Max |
| --- | ---: | ---: | ---: |
| Before | 128.67 ms | 249.86 ms | 598.72 ms |
| After (warm order cache) | 0.86 ms | 1.14 ms | 1.96 ms |

Run `node scripts/bench-g1-order.ts` from `goodwatch-webapp` after `free -m` for the current code.
An optional absolute reader-module path runs the same harness against a baseline copy (resolve
that copy's `order.ts` import to the repository's absolute path). Cold requests still pay composition
cost; warm requests avoid the two sorts and full-title metadata maps.

Checks run serially after `free -m`, with fake backends and no installed packages: the TypeScript
fixture/reader/integration tests, the existing exposure/list/filter cache/My pages/taste/Watch next/
For you/filter-state/Crate insertion suites, Python G1 and enqueue tests, and exposure schema checks.
The enqueue tests load the snapshot module with stub connectors; the wider snapshot suite's
optional `crate`, `fakeredis`, `mongomock`, `mongoengine`, and `wmill` packages are absent locally.
The review fixes passed 201 Node tests across twelve files and twenty Python G1/trigger tests,
one test file/process at a time after `free -m`. Use `node --test --test-isolation=none <file>`
for the local Node runner. Coverage includes payload publication/deletion between card requests,
lost/expired/evicted plans, cross-member/choice rejection, cache bounds and the warm 36-hour
freshness boundary, committed interaction writes/removals, non-preview exclusion even in `on`,
debounce, queue failure containment and manual-job allowlist enforcement.
The review fixes have exactly the same 174 existing typecheck diagnostics (including diagnostic
details) as the captured typecheck of branch HEAD
`576980649f1fee10e9a97feacdf5a88b6c9905c5` with the same existing webapp dependencies, ignoring
line shifts. The browser's existing Watch next hook carries the plan and refetches expired lists;
no new browser imports or landing assets are added. No production mode, production read/write,
deployment, push, PR, research-worktree edit or git metadata write was performed.

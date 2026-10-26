# Recovering a show's first state insert without undoing a later action

Q32 follows the [#607 review](https://github.com/alp82/goodwatch-monorepo/pull/607#issuecomment-6198791860).
The first episode watch writes its log row, then inserts `user_watch_state`. Previously the generic fixed-key
helper resent a lost insert. If the insert landed and the member unwatched the episode before that resend,
`DELETE` freed the key and the resend recreated Watching with no watches. A conflict could also restart the
whole event and put its old tick back after a later rewatch.

The member's state machine and [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md) stay the same. Physical
storage now retains an empty row after a show's state is removed. This is a technical receipt, not a sixth
show status. The empty representation is Not started, pass 1, no press and no remembered prompts; individual
tracking reads return `null`, and list reads already exclude Not started. A later valid watch updates the retained
row with its sequence/primary-term guard. The logical `delete` in the pure tracking storage module means removal
of the member's state; its server implementation retains the key.

A new nullable `insert_token TEXT` holds a random token for the first physical show-state insert. Every later
tracking update and logical deletion preserves it. The first insert owns its SQL, values and token instead of
using `insertRows`' unconditional replay:

1. A successful response succeeds; a known zero-row conflict follows the existing conflict loop (see below).
2. On a recoverable lost response, read the whole key in real time. Our token proves our insert landed, including
   when it has since been unwatched, put on hold, dropped or watched again. Return success without another insert
   or another application of the event. The token is never logged or returned to the member; an import's
   write-ahead plan journals it server-side with the prior row.
3. Only an absent key permits one resend of the identical insert. If the original lands after that readback and
   is then unwatched, the retained key makes the resend a no-op. A zero-row resend is read back and our retained
   token proves the outcome. The same applies if the second response is lost.
4. Another creator's token, an unavailable readback or an unconfirmed second attempt remains an indeterminate
   error. A different creator can have observed and undone our log effects, so restarting the event is unsafe.
   Ordinary applied and unapplied lost responses recover silently; a conflicting creator without our receipt
   cannot be silently claimed as our successful insert.

The same reasoning holds for a known conflict. The conflict loop runs the event again from the new state, after
taking out the log rows of its last round. If the action that came first took one of those rows away, it had read
it, so the member undid this event on another device: running it again would put the tick back over that later
choice. The loop then answers `TrackingConflictError` (HTTP 409, "please try again") instead, for a first insert
and for a CAS update alike. Rows that are still there are taken out and written again as before.

A token on a row that is physically deleted is insufficient: absence cannot distinguish an unapplied insert
from an applied-then-deleted insert. A separate receipt table with a check before resend also leaves a gap,
because CrateDB cannot atomically commit that receipt with the title row. Retaining the title's unique key closes
the gap at the actual SQL mutation, including delayed original requests.

## Migration and rollout, after review

No production schema or deployment change is part of this draft. In order:

1. **Every build that will serve tracking contains #607 and this change.** `auth/integration` and the
   `auth/mcp-*` branches still carry the pre-#607 writer; deploying one of them unmerged is an old writer (step 5).
2. **Add the column, before any new container starts.** The new `STATE_ROW_QUERY` selects `insert_token`, so a
   new container without it fails every show tracking read and write. Old containers keep working with it: their
   statements name their columns, and their rows get NULL.
   `ALTER TABLE doc.user_watch_state ADD COLUMN insert_token TEXT;`
   It is declared in `f/sync/models/crate_schemas.py` too, so `f/sync/init/cratedb` reports nothing missing
   afterwards. Prefer the single statement over the initializer, which also adds any other missing column.
3. **Check it through every coordinator**, each node's HTTP endpoint in turn:
   `SELECT data_type FROM information_schema.columns WHERE table_schema = 'doc' AND table_name = 'user_watch_state' AND column_name = 'insert_token';`
   (one row, `text`) and `SELECT insert_token FROM doc.user_watch_state LIMIT 1;` (no error). Existing rows keep
   NULL: no backfill. Their later changes use the existing version guard and retain their key on logical removal.
4. **Deploy the flows and the webapp.** The flows change is the schema declaration and a test fixture only; its
   order does not matter after step 2.
5. **Drain the old containers.** Until no old request runs, an old writer still physically deletes a show's row,
   so the original Q32 window stays open exactly as on main. That is no regression, but do not restart or
   decommission a CrateDB node in that window. Wait at least the longest tracking request (the Crate timeout)
   after the last old container stopped.
6. **Watch.** `crate.readback` events with `guard: "insert_token"` and outcome `conflict`, and 409 answers from
   `/api/tracking/show`, should stay rare. Empty receipts grow by at most one row per member and show:
   `SELECT count(*) FROM doc.user_watch_state WHERE media_type = 'show' AND state = 'not_started' AND pass = 1 AND rate_prompt_dismissed_at IS NULL AND seen_question IS NULL;`

Other rules:

- Do not garbage-collect empty show receipts while a delayed write could still exist. Receipt rows carry no
  watch history and stay excluded from lists and filters; every reader of the table filters on `state`.
- Account deletion still hard-purges tracking rows and receipts for privacy. This fix governs ordinary tracking
  actions within the account lifetime; coordinating account deletion with already-running authenticated writes
  is a separate pre-existing concern.

Rollback:

- Redeploy the previous image (at least `511e4be`, which has #607). Keep the column: old code never names it, and
  dropping it while any new container runs breaks all show tracking reads.
- Old code reads a retained receipt as a Not started row with nothing to remember. Lists already exclude it, the
  state machine treats it like no row, and the show page treats `null` and Not started alike. The old writer
  deletes it on the next logical removal. No cleanup is needed, and none should run while a new container may
  still have a write in flight.
- The first-insert protection stops as soon as an old writer can delete keys, as on main.

Known residuals, unchanged by this fix:

- **Movies (#633 follow-up).** Movie keys now use the same immutable first-insert receipt and logical removal.
  Single settlement uses guarded insert/CAS recovery; bulk settlement keeps batched first inserts and checks
  existing keys by version. Empty first settlements also fence an older in-flight insert. A later watch updates
  the retained key. No schema change: `insert_token` and `not_started` already apply to both media types.
  `stateOnly` hides receipts from individual/MCP reads; `STATES_QUERY`, Discover, smart titles, recommendations
  and prototype readers filter on state. Awaited-title reads restrict show states. Account deletion still purges
  receipts. The proof now runs the original ten show scenarios plus ten matching movie watch-log scenarios.
  Deployments must drain older movie writers, which still physically delete these keys. Redeploy
  **goodwatch-search** (`search-a` and `search-b`, serving `/mcp`) by hand with `goodwatch-search/deploy.sh`
  right after the pages: they are tracking writers too. Bulk updates now issue
  one CAS per existing movie; first inserts and log IO remain batched.
- **Removal retries (#634 follow-up).** Each round completes its log deletion before its state CAS. If a later
  round selects any log rows for deletion, they were added or restored after the previous deletion/snapshot;
  return `TrackingConflictError` (409) before touching them. This also protects restored rows with reused IDs,
  season removals and an initially empty selection. A retry with no fresh deletion targets can still converge.
  The original insert-side conflict guard remains unchanged. No schema change or extra query is needed.
- The generic watch-log insert retry behavior is unchanged.

## Verification

The regression seam uses `applyTrackingEvent` and real `getShowTracking` reads through `FakeTrackingCrate`.
Three new cases fail on main: an unchanged lost insert is resent; unwatch leaves Watching without ticks;
unwatch/rewatch restores the old tick. Additional cases cover reset/timeout, unapplied and pending original
requests, a lost second response, an original landing after an absent readback followed by unwatch before resend,
a different creator, legacy rows, hidden empty receipts and later valid watches. Existing CAS supersession
regressions remain in force.

The local three-node graceful proof additionally drives the real `/api/tracking/show` HTTP action through a
loopback SQL proxy. It drops acknowledged responses (reset or timeout), runs the intervening unwatch/rewatch,
and audits the returned logical state, SQL state, watch IDs, immutable receipt and sequence number. It also
holds the original request until after the absent readback to exercise the check-to-resend gap.

```sh
# Run from goodwatch-webapp; disposable local Docker only, with normal cleanup checks.
CRATE_PROOF_FIRST_INSERT=1 CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
  CRATE_PROOF_OUTPUT=/tmp/tracking-first-insert/observations.json bash scripts/crate-failover/run.sh

# Same proof with main's tracking writer as the red control; leave the rest of the harness unchanged.
CRATE_PROOF_TRACKING_BASELINE_COMMIT=511e4be329d9b381e2b824dd52cea161537cabd5 \
  CRATE_PROOF_FIRST_INSERT=1 CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
  CRATE_PROOF_OUTPUT=/tmp/tracking-first-insert-red/observations.json bash scripts/crate-failover/run.sh
```

Measured results and source hashes are recorded with the PR evidence. The HTTP proof replaces auth, cache/Valkey
and external-service boundaries; CrateDB queries, tracking recovery and Remix actions are real. It does not
establish browser, Valkey, account-deletion or all possible concurrent-action resilience.

## Measured results, 2026-10-15

The final runtime is implementation commit `a4f803a0c736cc0b436272a5a0a68e66abba3ec2`; subsequent evidence commits change
only documentation and JSON receipts. All recorded source hashes match that runtime. Rebuilding the route bundle
from the proof's working directory reproduces its exact hash (esbuild source comments depend on that directory).

- Main control (`511e4be329d9b381e2b824dd52cea161537cabd5`): the real HTTP action returns Watching after the intervening unwatch; the exact
  assertion is `first-insert-unwatch-reset: returned logical state: 'watching' !== null`.
- Fixed: **0 / 1233 route failures**, **1848 probe reads**, **501 guarded writes**,
  and **48 acknowledged watches stored uniquely**. Decommission exited normally and the node rejoined during load.
- All **10 first-insert scenarios** and **8 existing lost-response cases** passed. The later action's sequence
  number stays unchanged by recovery, including the absent-readback/late-original/unwatch/resend case.
- The migration preserved the existing row and version with a NULL token. Both red and fixed runs verified
  removal of every owned Docker container, volume and network.
- Full suite: **2,720 passed, one optional Valkey-cluster skip, zero failed**. **44 flow tests** passed.
  Typecheck: **174 identical diagnostics on main and branch**. Production build/precompression: **814 files**.
  An earlier full run hit an unchanged auth-session assertion (two server calls instead of one); its isolated
  14-test run and the final full suite passed. No auth files were changed.

Receipts: [red control](../../../goodwatch-webapp/scripts/crate-failover/results/tracking-first-insert-red.json),
[final proof](../../../goodwatch-webapp/scripts/crate-failover/results/tracking-first-insert-final.json),
and [validation](../../../goodwatch-webapp/scripts/crate-failover/results/tracking-first-insert-validation.json).

### Conflict guard, 2026-10-15

The conflict-loop guard is implementation commit `940fc6db`. Two new cases (first INSERT and CAS UPDATE) fail on
`865d7539`, where the rerun restores the removed tick, and pass with the guard. The statement counts of the
existing conflict tests are unchanged. Full suite: **2,722 passed, one optional skip, one todo (the movie
residual), zero failed**. Typecheck: still **174** diagnostics, none in tracking files.

The same graceful proof on that runtime (`trackingRuntimeSha256` `c9173afe…`) passed: **10 / 10 first-insert
scenarios**, **0 / 968 page-route failures**, 35 acknowledged watches stored uniquely, and cleanup verified. An
earlier attempt stopped before the tracking scenarios: a generic read during node loss received CrateDB's
internal `NullPointerException` (code 5000, `ClusterService.state()` null) while the node shut down. Receipt:
[conflict guard](../../../goodwatch-webapp/scripts/crate-failover/results/tracking-first-insert-conflict-guard.json).



## Tracking write race proof (#633 and #634)

The local loopback harness supports a focused run of the response-loss scenarios, independent of concurrent page
load and graceful decommission. It still seeds the declared schema, verifies receipt rollout, and calls real HTTP
tracking/watch-log actions with the real Crate client and writer. It does not prove graceful decommission safety:

```sh
TMPDIR="$HOME/.cache/gw-work/634" \
CRATE_PROOF_TRACKING_ONLY=1 CRATE_PROOF_PAGES=1 CRATE_PROOF_FIRST_INSERT=1 \
CRATE_PROOF_OUTPUT="$HOME/.cache/gw-work/634/proof.json" \
bash scripts/crate-failover/run.sh
```

Without `CRATE_PROOF_TRACKING_ONLY`, the original graceful/failover load and lost-response client checks still run.
The focused mode covers the original ten show first inserts plus ten equivalent movie watch-log cases (reset and
timeout; unchanged, removed, removed/re-watched, unapplied and delayed-after-readback). Six removal cases interleave
another device's replacement tick before the original state CAS reaches Crate: unwatch/season removal, with either
a known conflict (409), or the conflicting CAS response dropped as a reset/timeout (500, no unsafe replay). The
replacement watch and state version must survive unchanged in all six. The proof records expected error responses
separately from the concurrent load's zero-failure requirement.

Current main's title-page three-second deadline can fail the graceful route gate before the post-load tracking
scenarios run. Two local graceful attempts during this work hit five and four title-page 503s respectively; watch,
score, library and catalog routes had no failures in the second attempt. These results are retained separately,
and the focused mode does not relax that gate or change application deadlines.

The untouched-main writer (`bb1265d4a`) reproduced four title-page 503s under the same final harness (three movie,
one show), with no watch, score, library or catalog route failures. The final focused proof passed all 26 cases
and verified complete cleanup. The validation receipt in `scripts/crate-failover/results` records the red tests,
full-suite baseline comparison, identical 192 typecheck diagnostics, 211 related webapp tests and 70 flows tests.

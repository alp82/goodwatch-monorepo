# TV Time matching stays queued: 2026-10-20

## Root cause and production evidence

The resolution store added `kind = 'resolution'` to its optimistic-concurrency
UPDATE. Crate rejects extra non-key predicates on a write using `_seq_no` and
`_primary_term`, even when both primary-key columns are supplied. Every attempt
to claim the queued job therefore failed before resolving an observation.

Production was running build `8db86770`, role `page`, with a TMDB key present.
Coolify's control services are on the documented control host; the webapp runs
on its deployment target, abio. The compiled server contains the reconciler
startup call. Filtered container logs show:

- The upload returned HTTP 200 at 15:59:19 UTC.
- Its detached claim failed with `VersioningValidationException`, error 4000,
  HTTP 400, on the resolution payload UPDATE.
- Background claims failed with the identical SQL shape at 15:59:52,
  16:00:52, 16:01:52 and 16:02:52 UTC. The reconciler was running.
- Summary polling continued returning HTTP 200.

Read-only SELECTs at 16:03:08 UTC found one TV Time import. Its header was
`preview`. The root metadata row (`kind='resolution'`, `row_index=-1`) was
`queued`, phase `watched_parents`, generation 1, empty cursor, no owner,
lease 0, attempts 0, processed 0 of 8,088, matched 0, no failure codes and no
replacement. The slot row's full primary key is
`('resolution:resolution/slots', -1)`; it contained exactly that root's
reservation. There was no stale earlier import or test holding capacity.
The job deadline is **2026-10-20T16:29:19.269Z**.

The deployed table has primary key `(import_id,row_index)` and runs Crate
5.10.16. The failure occurs before the rate limiter or TMDB transport. No
production member/catalog writes, slot edits, restarts or deployments were
performed. Source observations, member identifiers, credentials and private
export contents are omitted here.

## Fix and regression

Remove only the non-key predicate from the OCC UPDATE. Keep both primary-key
columns and both version predicates. The read still checks `kind`, and the
observed version fences a subsequent change to that row.

Before the fix, the real job runner plus resolution store failed on isolated
Crate with the production exception. Removing only `kind` made the claim
succeed. The existing import database adapter incorrectly accepted this SQL;
it now rejects the invalid predicate, making the upload/runtime test fail on
the original implementation too.

`npm run test:imports:crate` starts and cleans up a throwaway Crate 5.10.16
container on a randomly assigned loopback port. The integration tests use a
unique schema and the real resolution store/job runner. They cover initial
claim and progress, reconciler recovery, slot reuse, stale-version rejection,
non-resolution row protection and recovery after the admission deadline.
They require Docker and never use app database credentials or Valkey.

Validation:

- Imports server: **390 passed**, zero failed.
- Imports UI: **146 passed**, zero failed.
- Real Crate 5.10.16 integration: **3 passed**, zero failed; original claim
  and checkpoint tests were observed red before fixing the SQL.
- Synthetic complete pipeline probe: **400 of 400 episodes matched**,
  400 simulated requests, 1,394 SQL statements, zero failed CAS and zero
  watches applied. No real provider/catalog access.
- Typecheck: **189 diagnostics**, exit 2, on both unmodified current main
  (`8db86770`) and the fix. Zero normalized additions/removals. The earlier
  implementation's documented **185** is a historical baseline.
- Biome and `git diff --check` pass.

## Recovery and minimal repair

No manual production row repair is required for this failure. The queued job
and reservation are valid, and the fixed startup/minute reconciler can claim
them. Deploying before the original deadline lets matching resume automatically.

After the deadline, reconciliation still recovers the job, but publishes a
`limited` preview with budget-exhausted holds and no new remote matching. The
integration regression verifies this behavior. To finish matching then, upload
the export again after the old job settles, or discard its preview and upload
again. Do not clear the global slots row or extend the stored deadline. Confirm
remains the only operation applying the preview to the member's library.

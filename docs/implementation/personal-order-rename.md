# Personal order naming and deployment — October 15, 2026

Repository preparation only. No production calls, deployment, variable/schedule changes, or commit.
The owner confirmed that PR #632's payload keys and member variable have never been deployed.
The rename therefore switches directly, with no aliases or dual reads. Ranking behavior, format-1 gzip,
model hash, expiry, eligibility, flags, caches, and TS/Python numerical parity stay the same.

## Mapping

| Previous name | Product name / meaning |
| --- | --- |
| G1 / `app/server/g1/` | Personal order / `app/server/personal-order/` |
| `loadG1`, `orderG1`, `composeG1`, `logG1` | `loadPersonalOrder`, `orderPersonalOrder`, `composePersonalOrder`, `logPersonalOrder` |
| `G1Payload`, `G1Components`, `G1PreparedPayload`, `G1Prepared`, `G1Read`, `G1Exposure` | Corresponding `PersonalOrder*` types |
| `createG1Reader`, `createG1OrderCache`, `createG1DirtyMarker` | `createPersonalOrderReader`, `createPersonalOrderCache`, `createPersonalOrderDirtyMarker` |
| `g1Exposure`, `g1`, `g1Read`, `g1First100` | `personalOrderExposure`, `personalOrder`, `personalOrderRead`, `personalOrderFirst100` |
| `mixFitting`, `markG1Changed` | `mixPersonalOrderFitting`, `markPersonalOrderChanged` |
| `recG1Order`, `resolveRecG1` | `recPersonalOrder`, `resolveRecPersonalOrder` |
| `G1_MODEL_HASH`, other `G1_*` constants | `PERSONAL_ORDER_MODEL_HASH`, corresponding `PERSONAL_ORDER_*` constants |
| `g1:v2:<member>`, `g1:dirty` | `personal-order:v1:<member>`, `personal-order:dirty` |
| `f/sync/copy/g1_order` | `f/sync/copy/personal_order` (Python, YAML and dependency lock) |
| `f/sync/copy/g1_trigger`, `start_g1`, `G1_SCRIPT` | `f/sync/copy/personal_order_trigger`, `start_personal_order`, `PERSONAL_ORDER_SCRIPT` |
| `f/sync/g1_members` | `f/sync/personal_order_members` |
| Documented `f/sync/copy/g1_dirty` schedule | `f/sync/copy/personal_order_dirty`, targeting `personal_order_trigger` |
| Snapshot result `g1` | `personal_order` |
| B3 / `b3_predict` / `b3Rank` | Standardized own taste / `own_taste_predict` / `ownTasteRank`: the member's own taste percentile against the reference pool, stored as float32 |
| B5 / `b5_predict` / `b5TopHalf` | Pooled rating predictor / `pooled_rating_predict` / `pooledRatingTopHalf`: inclusive top half at the global candidate median, retained after filtering |
| F3 / `f3` / reference `f3_predict` | Franchise grouping / `franchiseGroups` (TS), `franchise_groups` (Python) / `franchise_grouping_predict`: promote the best own-taste title per franchise within the filtered list |
| B1, B2, B4 in copied comments | Public score with member offset, unstandardized own taste, pooled consensus |
| `g1_flag_mode`, `g1_fallback_reason`, `g1_payload_build_time`, `g1_model_hash` | Same suffixes under `personal_order_` |
| `g1_snapshot_version`, `g1_groups`, `g1_mix_placed`, `g1_first_100` | Same suffixes under `personal_order_` |
| Exposure `ordering = 'g1'` | `ordering = 'personal-order'` |
| Benchmark, tests, parity driver and JSON fixture named `g1*` | Corresponding `personal-order` / `personal_order` paths below |
| `REC_G1_ORDER`, `REC_PREVIEW_USERS` | **Unchanged**, including the exposure flag key `ordering_flags.REC_G1_ORDER` |

Research documents and `docs/implementation/g1-*.md` retain historical labels. Each historical implementation
report gets only a short mapping note. The earlier additive `exposure-log/g1-migration.sql` is migration history;
apply the new rename migration to the existing table, rather than replaying that old migration.

## Verifiable copied math

The frozen block's function names, markers, comments and docstrings are renamed; calculations and whitespace
are unchanged. `docs/research/personal-order-source-mapping.json` records the exact reversible substitutions,
original source path, source SHA-256 and original copied-block SHA-256. The test helper reverses **only** those
substitutions before checking the original byte digest
`0f77aa86e764cf193ae1a2c70e4c248dd25839ae4bcea4dabe79f28299dd2517`.
The unit test independently pins both original digests. The full pack driver also checks the original research
file hash and compares the reconstructed block byte for byte. It adapts the reference's names in memory only;
no research source is rewritten. Its scratch output now accepts a dedicated writable directory such as `/tmp`.

## Migration and exact deploy order

Use [exposure-log/personal-order-rename.sql](exposure-log/personal-order-rename.sql). It renames all eight
columns in place, updates only `ordering = 'g1'` rows, refreshes, and checks counts and resulting column types.
It preserves the 64 owner-reported rows; the row count was not independently checked in production.
CrateDB 5.10 supports [RENAME COLUMN](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html#rename-column)
for tables created on version 5.5 or newer. These statements are not transactional or blindly rerunnable;
stop on errors and inspect the actual column names before resuming a partial migration.

`schema.sql` does **not** override the table's `column_policy`. CrateDB 5.10's
[default table policy is strict](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-table.html#column-policy).
`ordering_flags OBJECT(DYNAMIC)` allows nested flag keys; it does not make the table dynamic.
Under strict policy, an old writer after the rename fails its insert. **If the live table's policy has been
changed to dynamic, old writes can recreate the `g1_*` columns, even with the feature flag off**, because the
writer always sends those columns. Similarly, deploying the new writer before migration could create the new
columns and make the rename fail. The migration's preflight reports the actual policy. The sequence is:

1. Keep `REC_G1_ORDER=off`. Pause any schema initializer and pause snapshot/nightly triggers while updating
   Windmill scripts. Drain and stop **all** old webapp instances/background exposure writes before the SQL;
   the flag alone does not stop logging. Keep traffic stopped through the webapp replacement.
2. With writers stopped, run the migration preflight: check table creation version, current policy, row count
   (64 expected per owner), and the eight existing old column names. Run the eight `ALTER TABLE ... RENAME COLUMN`
   statements, then the `UPDATE` and `REFRESH`. Check unchanged row count, zero old ordering rows, all eight new
   columns/types and no old columns. Do not run the schema initializer before these renames: it adds missing
   columns rather than migrating data.
3. Deploy all new webapp instances (reader, dirty marker, exposure writer and callers) with the flag off.
   Remove all old instances before restoring traffic; do not overlap versions. Missing new payloads fall back
   to today's ordering. Resume schema initialization only with the updated `crate_schemas.py`.
4. Create `f/sync/personal_order_members` with the intended JSON cohort list or literal/JSON string `all`.
   Deploy `personal_order` and `personal_order_trigger` (including YAML/locks), then the updated `title_snapshot`.
   Resume the existing snapshot/nightly schedules after all dependencies use the new names. No old variable,
   script alias, or old-key backfill is required. Run the builder dry first (its default), inspect summaries,
   then backfill with `{"dry_run":false}` while the serving flag is off.
5. Create schedule `f/sync/copy/personal_order_dirty` targeting script `f/sync/copy/personal_order_trigger`,
   UTC cron v2 `0 */3 * * * *`, args `{"dirty_only":true}`. The trigger queues the same serialized builder
   with `dry_run:false`. The variable and schedule are documented owner actions, not created by this patch.
6. Keep `REC_PREVIEW_USERS` aligned with the cohort. Progress through shadow and preview using the unchanged
   `REC_G1_ORDER`; verify freshness, coverage and serving latency before `on`. Restart instances for flag changes
   and refresh retained Watch next pages. The rename does not establish the historical rollout's performance gate.

To stop serving personal order, set the existing flag off and restart, retaining this renamed build/schema.
If a full code rollback is needed, stop/drain writers again, reverse the eight column renames and ordering update,
then restore the old build before traffic resumes. Do not start an old writer against the renamed table.

## Validation

Every affected webapp suite was invoked directly as `node <file>`, using fake backends. The test inventory below
records individual results. The five renamed feature suites include all six committed Python parity fixtures,
both directly and through gzip/typed-array decoding. Python commands:

```sh
python -m unittest discover -s goodwatch-flows/tests -p 'test_personal_order*.py'
python -m unittest discover -s goodwatch-flows/tests -p 'test_list_exposure_schema.py'
python -m unittest discover -s goodwatch-flows/tests -p 'test_title_snapshot.py'
```

The first two commands pass (37 + 2 tests). The snapshot suite cannot import because `fakeredis` is missing;
snapshot publish/no-change/dry-run/lock-contention/error enqueue behavior passes in the renamed trigger suite.
The synthetic predictor inputs retain the existing NumPy empty-slice warning. Windmill YAML and renamed lock
references are checked locally; `git diff --check` passes. No migration was executed against a database.

Full external-pack parity passes with 72,101 titles and 59,767 candidates: input arrays including dtypes,
own taste float64 and float32 payload, pooled prediction and top-half bits, franchise groups/order, first-100 mix,
suffix, JSON roundtrip, sorted product order, and all six committed fixture cases are exact.
The original research source and copied-block hashes both pass. The driver used the existing local pack at
`/home/alper/goodwatch-research/taste/packs/2026-10-13` and scratch `/tmp/personal-order-parity`; no connector is imported.

Webapp suites (paths relative to `goodwatch-webapp/`):

| File | Result |
| --- | --- |
| `app/server/discover-filter-cache.test.ts` | 15 pass |
| `app/server/imports/service.server.test.ts` | 5 pass, 5 fail: missing `saxes` |
| `app/server/list-exposure-lists.test.ts` | 4 pass |
| `app/server/list-exposure.test.ts` | 7 pass |
| `app/server/living-room/home-language.test.ts` | 1 pass |
| `app/server/my-pages.test.ts` | 30 pass |
| `app/server/newly-available.test.ts` | 25 pass |
| `app/server/personal-order/integration.test.ts` | 12 pass |
| `app/server/personal-order/order.test.ts` | 14 pass |
| `app/server/personal-order/reader.test.ts` | 10 pass |
| `app/server/personal-order/rebuild.test.ts` | 2 pass |
| `app/server/personal-order/writes.test.ts` | 1 pass |
| `app/server/show-tracking.test.ts` | 33 pass |
| `app/server/taste/taste.test.ts` | 6 pass |
| `app/server/title-filter/passes.test.ts` | 22 pass |
| `app/server/tracking.test.ts` | 98 pass |
| `app/server/userData.test.ts` | 18 pass |
| `app/server/watch-log.test.ts` | 13 pass |
| `app/server/watch-next-plans.test.ts` | 1 pass |
| `app/server/watch-state.test.ts` | 34 pass |
| `app/ui/living-room/tv/tv-taste.test.ts` | 30 pass |
| `app/domain/for-you.test.ts` | 13 pass |
| `app/domain/filter-state.test.ts` | 11 pass |
| `app/utils/crate-insert-rows.test.ts` | 7 pass |

407 tests pass across 23 fully passing files; the additional import-service file has five passing tests
and five dependency failures (`ERR_MODULE_NOT_FOUND: saxes`). An offline install into `/tmp` was attempted,
but the package is absent from the npm cache. No dependency manifest or lockfile was changed.

`tsc --pretty false` exits 2 with 177 diagnostics, none in changed files. A baseline comparison
was not run, so this is not a clean repository-wide typecheck.

## Grep proof

The following token scan over every changed/renamed product source, test, fixture, and script definition
returns only the unchanged flag name; excluding it yields **zero matches**. Renamed file paths likewise
have no old feature label. Research/history/migration mappings intentionally retain the old labels.

```sh
rg -n --pcre2 '\b(?:g1|b3|b5|f3)\w*|\w*(?:G1|B3|B5|F3)\w*' \
  $(cat /tmp/personal-order-product-files.txt) | rg -v REC_G1_ORDER
# No output (rg exit 1). Inventory below is the durable equivalent of that temporary file.
```

A raw substring grep across the entire monorepo also finds unrelated content: `log1p`/`log10`,
hex colors, hashes, public asset ids, old prototype PCA/generation variables, test ids and lockfile
package `urllib3`. Those are not research component labels and were not rewritten. The zero-match claim
applies to the shipped personal-order feature and all its changed callers, rather than those unrelated strings.

## Changed files

Renamed paths are represented by their new names; the old `app/server/g1/`, benchmark, builder/trigger
Python/YAML/locks, Python tests/driver, and JSON fixture paths are removed.

- `docs/implementation/exposure-log/README.md`
- `docs/implementation/exposure-log/personal-order-rename.sql`
- `docs/implementation/exposure-log/schema.sql`
- `docs/implementation/g1-order-review-astra.md`
- `docs/implementation/g1-order-stage1.md`
- `docs/implementation/g1-order-stage2.md`
- `docs/implementation/g1-rollout-preparation.md`
- `docs/implementation/personal-order-rename.md`
- `docs/research/personal-order-names.md`
- `docs/research/personal-order-source-mapping.json`
- `goodwatch-flows/tests/fixtures/personal_order.json`
- `goodwatch-flows/tests/personal_order_pack_parity.py`
- `goodwatch-flows/tests/personal_order_source.py`
- `goodwatch-flows/tests/test_personal_order.py`
- `goodwatch-flows/tests/test_personal_order_trigger.py`
- `goodwatch-flows/windmill/f/sync/copy/personal_order.py`
- `goodwatch-flows/windmill/f/sync/copy/personal_order.script.lock`
- `goodwatch-flows/windmill/f/sync/copy/personal_order.script.yaml`
- `goodwatch-flows/windmill/f/sync/copy/personal_order_trigger.py`
- `goodwatch-flows/windmill/f/sync/copy/personal_order_trigger.script.lock`
- `goodwatch-flows/windmill/f/sync/copy/personal_order_trigger.script.yaml`
- `goodwatch-flows/windmill/f/sync/copy/title_snapshot.py`
- `goodwatch-flows/windmill/f/sync/copy/title_snapshot.script.yaml`
- `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`
- `goodwatch-webapp/app/server/discover-results.server.ts`
- `goodwatch-webapp/app/server/features.server.ts`
- `goodwatch-webapp/app/server/list-exposure.server.ts`
- `goodwatch-webapp/app/server/list-exposure.test.ts`
- `goodwatch-webapp/app/server/not-interested-store.server.ts`
- `goodwatch-webapp/app/server/not-interested.server.ts`
- `goodwatch-webapp/app/server/personal-order/integration.test.ts`
- `goodwatch-webapp/app/server/personal-order/order.test.ts`
- `goodwatch-webapp/app/server/personal-order/order.ts`
- `goodwatch-webapp/app/server/personal-order/reader.server.ts`
- `goodwatch-webapp/app/server/personal-order/reader.test.ts`
- `goodwatch-webapp/app/server/personal-order/rebuild.server.ts`
- `goodwatch-webapp/app/server/personal-order/rebuild.test.ts`
- `goodwatch-webapp/app/server/personal-order/writes.test.ts`
- `goodwatch-webapp/app/server/scores.server.ts`
- `goodwatch-webapp/app/server/skipped.server.ts`
- `goodwatch-webapp/app/server/taste/member.server.ts`
- `goodwatch-webapp/app/server/title-filter/index.server.ts`
- `goodwatch-webapp/app/server/watch-next.server.ts`
- `goodwatch-webapp/app/server/wishList.server.ts`
- `goodwatch-webapp/app/utils/features.ts`
- `goodwatch-webapp/scripts/bench-personal-order.ts`
- `goodwatch-webapp/scripts/crate-failover/build-page-proof.mjs` (renamed dirty-marker stub)

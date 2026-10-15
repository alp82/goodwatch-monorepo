# Production snapshot restore and auth import rehearsal — 2026-10-15

Owner-authorized work for [#563](https://github.com/alp82/goodwatch-monorepo/issues/563)
and the rehearsal slice of [#551](https://github.com/alp82/goodwatch-monorepo/issues/551).
Importer: [PR #576](https://github.com/alp82/goodwatch-monorepo/pull/576),
`auth/supabase-importer`. Integration: [PR #591](https://github.com/alp82/goodwatch-monorepo/pull/591),
`auth/integration`. Neither PR is authorized to merge to main or deploy.

## Isolation and provenance

The source was production `crate-cluster`, nodes `crate-01` 5.10.9 and
`crate-02`/`crate-03` 5.10.16. Only SELECTs and BLOB GETs were issued to production.
No production repository registration/settings, tables, users, services or firewall
rules were changed. Scheduled production activity continued independently.

The target was a fresh, three-node Docker cluster on private host `10.0.0.11`,
cluster `goodwatch-restore-563-551`, nodes `restore-563-1` through `restore-563-3`,
CrateDB 5.10.16 pinned to image digest
`sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307`.
It used a new internal Docker network, no production seed hosts or data volumes,
and separate `gw-rehearsal-563-*` volumes. Each node was limited to 1.5 GiB RAM,
768 MiB heap, and at most 1.5 CPUs with reduced CPU shares. Production was not
restarted or reconfigured. The operator's loopback SSH forward terminated on the
copy's internal container address, never on production's HTTP endpoint.

The existing repository mount was bound into all three copy nodes read-only.
Registration was made only on the copy:

```sql
CREATE REPOSITORY rehearsal_563 TYPE fs WITH (
  location='/snapshots/v2', readonly=true, compress=true,
  max_restore_bytes_per_sec='20mb'
);
RESTORE SNAPSHOT rehearsal_563.hourly_20261015_160501 ALL
  WITH (wait_for_completion=true);
```

`sys.repositories` independently reported `readonly=true`; the production
repository retained its original settings. The selected snapshot was the newest
successful scheduled snapshot when the drill started, finished at 16:05:17.045 UTC,
reported version 5.10.9, and contained 92 SQL tables, including the two historical
backup schemas. `ALL` was chosen to exercise users, privileges and cluster settings
as well as table data. This proves restoration onto 5.10.16; it is not a proof of
restoring newer-format tables onto 5.10.9.

The Supabase export used a direct TLS connection with hostname/CA verification,
`default_transaction_read_only=on`, and an explicit repeatable-read read-only
transaction. It selected `auth.users` and `auth.identities`; it created no Supabase
role, marker, advisory lock or other write. Exported JSON and any reports containing
member identifiers remained in a mode-0700 directory outside the repository.
The local Postgres copy used a SELECT-only reader with read-only transactions and
an explicit `restored-copy` marker. Production Crate and source Supabase snapshots
were taken at different times while live writes continued; a production cutover
still requires the source write freeze and final consistent export.

## Repeatable procedure

1. Inspect production cluster identity, versions, repositories, latest successful
   snapshot, every non-system table, and BLOB manifests using read-only queries.
   Save counts, users, privileges, settings and sampled `_id`/`_raw` values privately.
2. Create fresh owned containers, network and volumes. Verify the exact copy
   cluster name and all three node names/versions before any target mutation.
   Mount the repository read-only and register it with `readonly=true`.
3. Restore `ALL`, time the request, and retain its result. During this run, initial
   primary recoveries were raised on the copy only, from 4 to 8, 16, then 32 per
   node to reduce repository-latency overhead. The 20 MiB/s per-node read cap
   remained. Replica recovery concurrency and concurrent rebalances were raised
   from 2 to 8 on the copy only. Restore all three transient settings afterward
   and wait for all replicas.
4. Compare the complete table list and counts with read-only production SELECTs.
   Record live-data differences rather than equating a later production count
   with the snapshot's exact point in time. Compare sampled values canonically,
   and compare restored users, privileges and cluster settings.
5. Recover BLOB files separately: read every file referenced by every restored
   `search_index_builds` manifest, verify its declared byte size and SHA-1, PUT it
   only into the copy's new BLOB table, then GET and verify it again. Use a client
   that handles CrateDB's HTTP 307 redirects for uploads as well as downloads.
   A first urllib upload attempt failed with a broken pipe after one file;
   a redirect-aware requests client resumed the content-addressed uploads.
6. After restore checks pass, run `migrateAuthTables` only against the verified
   copy. Keep all other target writers stopped. Preserve a dedicated payload key
   privately. Configure the importer with `AUTH_IMPORT_TARGET_PROFILE=restored-563`
   and the loopback copy endpoints from [the importer runbook](../../auth-supabase-import-rehearsal.md).
   Require the default fake profile to reject this target before the actual run.
7. Run dry mode, apply, and an exact apply rerun against the same exported source.
   Save full reports privately. Require source/target counts to agree and the
   rerun to create zero users and accounts. Independently compare UUIDs, normalized
   emails, verified state, bcrypt bytes, Google subjects and account ownership.
8. Check representative password, Google-only, linked and unconfirmed mappings,
   and compare existing member rows before/after through the preserved UUID.
   Mapping and hash equality do not prove a real password or Google OAuth login.
9. Publish aggregate counts/timings and sanitized outcomes only. Delete the source
   export, local Postgres copy, keys, private member samples and all owned
   throwaway cluster containers/volumes. Keep only non-identifying evidence.

## Results

- SQL restore: **878.798 seconds (14m38.8s)**, from
  **16:19:10.891 to 16:33:49.689 UTC**. RESTORE returned success; all snapshot
  primary shards became STARTED.
- Restored **92 SQL tables / 82,738,215 rows**. All table identities matched
  production, including both historical backup schemas. **88/92** table counts
  matched the later production baseline exactly; **every member table** matched.
  The four differing tables were:

| Table | Snapshot copy | Production baseline | Production recheck |
| --- | ---: | ---: | ---: |
| `doc.media_image` | 5,580,452 | 5,580,453 | 5,580,484 |
| `doc.streaming_availability` | 18,935,228 | 18,935,194 | 18,935,100 |
| `doc.translation` | 3,958,481 | 3,958,483 | 3,958,483 |
| `doc.workflow_monitoring` | 110,898 | 110,908 | 110,916 |

  These are live ingestion/monitoring tables, read after the snapshot while
  production continued writing. The recheck demonstrates ongoing churn in three
  tables; translation's two-row difference was stable between the later reads.
  No claim is made that a live post-snapshot count is an exact snapshot baseline.
  No restore shard failure, missing table or member-count discrepancy occurred.
- **35/35** canonical sampled `_id`/`_raw` rows matched, five each from country,
  genre, movie, Wishlist, score, setting and profile tables.
- Both database users and all four privilege records matched the source baseline.
  Effective setting comparisons showed only the three intentional copy-only
  recovery overrides (subsequently reset), heap-scaled breaker/log limits, `2h` versus `7200000ms`,
  empty awareness attributes represented as null versus an empty list, and the
  5.10.16 default `indices.recovery.max_concurrent_file_chunks=2`. The transient
  recovery overrides are reset before the final settings comparison.
- BLOB recovery: **18/18 files, 126,888,186 bytes**, covering every file referenced
  by all three restored build rows (including `current`). Source bytes and copy
  GETs matched each declared SHA-1 and size. The successful redirect-aware pass
  took **13.401 seconds**; the earlier helper failure is recorded above.

- The copy reached **107/107 GREEN health rows, 998/998 shard copies STARTED**
  at **16:42:05 UTC**, **22m54.4s** after RESTORE began. This includes the 42
  additional shard copies from auth storage prepared during replica recovery.
  All three temporary recovery settings returned to their original values;
  the final metadata comparison contains only the documented representation,
  version-default and heap-size differences.

### Import and rerun

No source rows were edited, excluded, merged or promoted to verified.

| Step | Importer elapsed | Full command wall time | Result |
| --- | ---: | ---: | --- |
| Read-only source export | — | 0.717s | 718 users / 721 identities |
| Dry-run | 87.373s | 87.865s | Planned; zero issues; target unchanged |
| Apply | 196.581s | 197.143s | 718 users / 721 accounts created |
| Exact apply rerun | 114.084s | 117.378s | Zero created; 718 users / 721 accounts unchanged |

Target totals after apply and rerun: **718 users, 721 accounts, 718 email claims**;
accounts are **381 credential / 340 Google**. The source has **493 verified /
225 unverified** users, and every imported verified value matched the source.
All reports have zero issues. The source-copy reader independently reported
`transaction_read_only=on`, SELECT allowed, INSERT/UPDATE denied.

The export/dry/apply/rerun command wall times sum to **403.103 seconds (6m43.1s)**.
These were measured from the laptop through a loopback SSH forward while the copy
was recovering, with a stopped-writer target and 718 source users. They are a
conservative measurement of these database steps, not a timed complete cutover.
Source freeze, final backup, service start, real sign-ins and rollback gates need
their own window. A different execution location or dataset requires fresh timing.

Independent audits using **both PR #576 and PR #591's adapters** authenticated all
718 user envelopes and all 721 account envelopes, and checked every UUID,
normalized email, email verification value, all **381 byte-identical bcrypt
hashes**, and all **340 Google subjects and user owners**. Case-folded email lookup
returned the original UUID for each acceptance sample:

| Sample | Provider mapping | Pre-existing member rows unchanged |
| --- | --- | ---: |
| Confirmed password member | Credential account keyed by original UUID | 31,412 |
| Google-only member | Google subject to original UUID; no credential account | 18,528 |
| Linked password/Google member | Both methods retain the same original UUID | 1,137 |
| Unconfirmed password member | Original UUID/email retained; verified remains false | 0 |

All **14 member tables / 300,082 rows** retained their restored counts. The four
samples cover **51,077** existing member rows, queried through each mapped UUID.
These are mapping/hash/member-data checks, **not real member sign-ins**. No member
password, Google authorization/code/token, consent or copy-only OAuth callback
was supplied. No real password or Google OAuth login was attempted. Keep #551 open
for that acceptance evidence and the end-to-end cutover gates.

### Code and CI

The original CLI admitted only its one-node 5.10.12 fake target. Commit `a35eae74`
on `auth/supabase-importer` added a fixed `restored-563` profile for exactly this
three-node 5.10.16 copy and requires its `restored-copy` marker. Loopback endpoint,
argument and credential restrictions remain. The actual default-profile refusal
and positive restored-profile dry/apply/rerun were exercised. A new regression
rejects unknown profiles before connecting and without leaking secrets.
No data-mapping bug or adapter workaround was needed.

Merged into `auth/integration` at `e2cb785b`. Resolved package-file conflicts by
retaining integration's isolated `@goodwatch/auth-stack` dependency and adding the
importer commands; the importer integration tests use the same stack exports.
Added that package to the importer workflow paths. Focused types and all seven
CLI refusal tests pass locally on both branches. Hosted importer CI passes all
29 cases on both branches; adapter CI is green, and integration's MCP,
maintenance and wiring jobs are green. No main merge or deployment occurred.

### Cleanup

All three owned CrateDB containers, their three data volumes and internal network
were removed and their absence verified. The local Postgres copy and its anonymous
volume were removed and absence verified; the owned SSH forward was stopped.
The private Supabase export, local database-copy credentials, payload key, member
samples and helper directory were deleted. No exported auth data remains in the
repository or private rehearsal directory. Only the sanitized evidence is retained.
A fresh read-only production check after cleanup still reported **93 GREEN health
rows / 956 STARTED shard copies**, the same mixed versions, and unchanged repository
settings. Production's existing container remained running.

The [sanitized machine-readable evidence](cratedb-restore-rehearsal-20261015.json)
contains full table counts, source/target totals, timings, metadata differences,
BLOB digest checks, mapping classes and production final health. It contains no
member UUIDs, emails, hashes, passwords, tokens or payload keys.


## Cutover prerequisites revealed by the copy

- Production still has a 5.10.9 node. Finish #547's reviewed upgrade gates before
  creating auth tables; do not treat a mixed-version cluster as launch-ready.
- Production has no `auth_*` tables. The adapter migration creates its 13 model
  tables plus `auth_user_email`, with one shard each, two replicas,
  `write.wait_for_active_shards=1`, `translog.durability=REQUEST`, and
  `refresh_interval=-1`. Ciphertext payloads and receipts must use `INDEX OFF`
  and `columnstore=false`; the email claim schema includes `user_seq`.
- The current production HBA boundary remains a #562 prerequisite: creating an
  auth database user alone does not enforce its credentials. This drill did not
  change production HBA or prove a dedicated production role's grants.
- Keep the same durable payload/HMAC secret for import (`AUTH_IMPORT_PAYLOAD_SECRET`)
  and the runtime (`AUTH_CRATEDB_ENCRYPTION_SECRET`).
  New-secret reruns cannot authenticate existing rows or email claims. Stop all
  other target writers, freeze source auth changes, and take a final export;
  insert-only reruns deliberately reject stale changed emails/passwords.
- BLOB table `blob.search_index_files` and its files require separate recovery.
  SQL snapshots omit BLOBs. Verify every digest needed by the restored manifests;
  retention must preserve those files with the matching snapshot.
- A whole-cluster restore should refresh planner statistics with `ANALYZE` before
  performance acceptance. The drill's count/data checks do not prove serving
  performance or a deployed recovery.
- Real member password and Google redirect sign-ins require separately available
  credentials/consent and a copy-only auth service/provider callback. This drill
  must report those separately from mapping checks and fake-data CI sign-ins.

## References

- [CrateDB snapshot behavior and BLOB exclusion](https://cratedb.com/docs/crate/reference/en/5.10/admin/snapshots.html).
- [RESTORE SNAPSHOT metadata and restore options](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/restore-snapshot.html).
- [Supabase TLS verification](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Full SQL table/count comparison

The production column was read after the snapshot; see the drift explanation above.

| Table | Restored snapshot rows | Production baseline rows |
| --- | ---: | ---: |
| `backup_20260925_deleted_titles.alternative_title` | 328 | 328 |
| `backup_20260925_deleted_titles.media_image` | 1,961 | 1,961 |
| `backup_20260925_deleted_titles.media_video` | 147 | 147 |
| `backup_20260925_deleted_titles.movie` | 279 | 279 |
| `backup_20260925_deleted_titles.person_appeared_in` | 9,252 | 9,252 |
| `backup_20260925_deleted_titles.person_worked_on` | 3,473 | 3,473 |
| `backup_20260925_deleted_titles.release_event` | 112 | 112 |
| `backup_20260925_deleted_titles.season` | 1,428 | 1,428 |
| `backup_20260925_deleted_titles.show` | 446 | 446 |
| `backup_20260925_deleted_titles.streaming_availability` | 3,628 | 3,628 |
| `backup_20260925_deleted_titles.streaming_evidence` | 312 | 312 |
| `backup_20260925_deleted_titles.translation` | 1,254 | 1,254 |
| `backup_20260925_deleted_titles.trope` | 11,883 | 11,883 |
| `backup_20260925_stale_child_rows.alternative_title` | 4,786 | 4,786 |
| `backup_20260925_stale_child_rows.media_image` | 86,076 | 86,076 |
| `backup_20260925_stale_child_rows.media_video` | 2,881 | 2,881 |
| `backup_20260925_stale_child_rows.movie` | 458 | 458 |
| `backup_20260925_stale_child_rows.person_appeared_in` | 45,721 | 45,721 |
| `backup_20260925_stale_child_rows.person_worked_on` | 24,520 | 24,520 |
| `backup_20260925_stale_child_rows.release_event` | 10,487 | 10,487 |
| `backup_20260925_stale_child_rows.season` | 1,142 | 1,142 |
| `backup_20260925_stale_child_rows.show` | 461 | 461 |
| `backup_20260925_stale_child_rows.streaming_availability` | 5,182 | 5,182 |
| `backup_20260925_stale_child_rows.streaming_evidence` | 229 | 229 |
| `backup_20260925_stale_child_rows.translation` | 1,456 | 1,456 |
| `backup_20260925_stale_child_rows.trope` | 6,175 | 6,175 |
| `doc.age_certification` | 596 | 596 |
| `doc.alternative_title` | 619,503 | 619,503 |
| `doc.buzz_pageview` | 33,557 | 33,557 |
| `doc.buzz_score` | 16,348 | 16,348 |
| `doc.buzz_snapshot` | 34 | 34 |
| `doc.buzz_title` | 682 | 682 |
| `doc.buzz_trending` | 377 | 377 |
| `doc.country` | 251 | 251 |
| `doc.crawl_priority` | 1,194,248 | 1,194,248 |
| `doc.episode` | 6,774,624 | 6,774,624 |
| `doc.episode_translation` | 105,536 | 105,536 |
| `doc.genre` | 35 | 35 |
| `doc.imdb_episode` | 846,303 | 846,303 |
| `doc.imdb_season` | 78,663 | 78,663 |
| `doc.job` | 940 | 940 |
| `doc.language` | 187 | 187 |
| `doc.media_image` | 5,580,452 | 5,580,453 |
| `doc.media_video` | 351,845 | 351,845 |
| `doc.metacritic_season` | 23,605 | 23,605 |
| `doc.movie` | 1,261,590 | 1,261,590 |
| `doc.movie_series` | 9,565 | 9,565 |
| `doc.network` | 5,162 | 5,162 |
| `doc.person` | 4,914,026 | 4,914,026 |
| `doc.person_appeared_in` | 9,234,642 | 9,234,642 |
| `doc.person_worked_on` | 9,676,850 | 9,676,850 |
| `doc.production_company` | 247,077 | 247,077 |
| `doc.release_event` | 2,029,710 | 2,029,710 |
| `doc.rotten_tomatoes_season` | 48,167 | 48,167 |
| `doc.search_control` | 1 | 1 |
| `doc.search_embedding_inputs` | 257,422 | 257,422 |
| `doc.search_embedding_state` | 3 | 3 |
| `doc.search_history` | 1,366 | 1,366 |
| `doc.search_index_builds` | 3 | 3 |
| `doc.search_interpretations` | 582 | 582 |
| `doc.search_shadow` | 18 | 18 |
| `doc.search_spending` | 1,155 | 1,155 |
| `doc.search_terms` | 2,152,495 | 2,152,495 |
| `doc.season` | 402,437 | 402,437 |
| `doc.season_translation` | 7,332 | 7,332 |
| `doc.show` | 234,588 | 234,588 |
| `doc.social_content_quality` | 8,237 | 8,237 |
| `doc.social_ingest_run` | 42 | 42 |
| `doc.social_link_report` | 0 | 0 |
| `doc.social_post` | 8,241 | 8,241 |
| `doc.social_title_link` | 634 | 634 |
| `doc.streaming_availability` | 18,935,228 | 18,935,194 |
| `doc.streaming_evidence` | 9,248,262 | 9,248,262 |
| `doc.streaming_service` | 1,666 | 1,666 |
| `doc.timezone` | 249 | 249 |
| `doc.translation` | 3,958,481 | 3,958,483 |
| `doc.trope` | 3,830,141 | 3,830,141 |
| `doc.user_favorite` | 72 | 72 |
| `doc.user_handle` | 12 | 12 |
| `doc.user_import` | 4 | 4 |
| `doc.user_import_item` | 3,534 | 3,534 |
| `doc.user_list` | 8 | 8 |
| `doc.user_list_exposure` | 50 | 50 |
| `doc.user_not_interested` | 2 | 2 |
| `doc.user_profile` | 12 | 12 |
| `doc.user_score` | 9,127 | 9,127 |
| `doc.user_setting` | 1,806 | 1,806 |
| `doc.user_skipped` | 13,830 | 13,830 |
| `doc.user_watch_log` | 261,300 | 261,300 |
| `doc.user_watch_state` | 8,251 | 8,251 |
| `doc.user_wishlist` | 2,074 | 2,074 |
| `doc.workflow_monitoring` | 110,898 | 110,908 |

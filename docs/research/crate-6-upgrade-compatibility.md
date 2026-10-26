# CrateDB 5.10.16 → 6.4.6 compatibility research

Initial review/rehearsal used main `7ee29ce30`; expanded release audit on 2026-10-26 used main `1770d08d1`. The release audit uses public documentation and repository source. The separate dated read-only production inventory and successful isolated rehearsals are recorded in the runbook; no production settings, schedules or data were changed. The execution plan and actual local results belong in [the upgrade runbook](../implementation/crate-6-upgrade.md).

## Supported rolling path

Use **5.10.16 → 6.0.8 → 6.1.6 → 6.2.11 → 6.3.7 → 6.4.6**, completing all three nodes and health/client gates at each stage. This is fifteen node upgrades. A direct mixed 5.10/6.4 rolling cluster is not the documented path. The [rolling guide](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements) permits adjacent minor versions or the next major version, subject to release-specific requirements.

| Target | Documented rolling predecessor | Primary source |
| --- | --- | --- |
| 6.0.8 | 5.10.1 or later | [6.0.8 notes](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.8.html), [6.0.0 notes](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.0.html) |
| 6.1.6 | 6.0.2 or later | [6.1.6 notes](https://cratedb.com/docs/crate/reference/en/6.1/appendices/release-notes/6.1.6.html) |
| 6.2.11 | 6.1.2 or later | [6.2.11 notes](https://cratedb.com/docs/crate/reference/en/6.2/appendices/release-notes/6.2.11.html) |
| 6.3.7 | 6.2.0 or later | [6.3.7 notes](https://cratedb.com/docs/crate/reference/en/6.3/appendices/release-notes/6.3.7.html) |
| 6.4.6 | 6.3.0 or later | [6.4.6 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.6.html) |

The 6.0.8 note appears to contain a copy-edit error: its target in the rolling sentence is **6.0.6**. The 6.0.0 note explicitly allows >=5.10.1, and same-minor patch transitions are supported by the generic guide. The conservative path above selects patched releases and passed the bounded mixed-cluster rehearsal recorded in the runbook; it does not treat a successfully booting unsupported version mixture as evidence of support.

Avoid the initial 6.0/6.1/6.2/6.3 releases: the notes warn of corruption when older-than-5.5 table metadata is changed. Fix releases are 6.0.6, 6.1.4, 6.2.6 and 6.3.2 respectively. All selected stages are later. This is separate from the hard prohibition on 4.x-created indices in 6.x.

## Production-preflight qualification of this matrix

The same preparation collected read-only production metadata; see the dated inventory and approvals in
[the runbook](../implementation/crate-6-upgrade.md#read-only-production-preflight--october-26-2026).
All145 base tables were created on5.10.9/5.10.16, with no partitions/closed tables, so pre5.x reindex and
pre5.5 metadata warnings are not current exposure. SHOW CREATE for144 SQL tables found only the standard
analyzer; BLOB metadata was checked separately. Actual settings are PRIMARIES/force=false/2h and40MiB/s
recovery, with enabled password HBA. The BLOB scope is currently one21-object131.27MiB table, but a schema
DQL grant also applies to future tables. Both page and both search containers run node-crate3.0.0/pg8.23.1.
Seventeen Python worker caches contain crate-python2.0.0/2.2.1/2.3.0; cache presence does not prove the active
script lock. Backup runs requests2.32.5. Supplemental isolated canaries now pass all three cached Python drivers on
both5.10.16 and6.4.6 for array/object parameters and legacy `_version` OCC; these are not full worker jobs. These readings qualify metadata-dependent rows below; repeat before
execution. Two persistent RELOCATING shard rows mean this is not an execution-ready cluster despite GREEN.

The compatibility patch covers the webapp matcher and `scripts/populate_trope_catalog.py`'s separate
backend-error classifier. Regression tests cover both Participating/Coordinator messages, generic-write
non-replay, unrelated cancellation and the operator tool's explicit `retryable=False` indeterminate-write
guard. There is no broad JobKilled retry rule or production deployment in this turn.

## Breaking changes mapped to the repository

| Boundary / change | GoodWatch evidence and necessary check |
| --- | --- |
| **6.0: 4.x-created tables cannot be read** | Current schema source does not establish creation versions of existing tables, closed tables, retained backup schemas or partition indices. Require the table-recreation cluster check to pass and inventory actual creation versions before approving production. A fixture created on 5.10 cannot prove this gate. [6.0 notes](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.0.html), [table compatibility](https://cratedb.com/docs/crate/reference/en/6.4/admin/system-information.html#tables-need-to-be-recreated). |
| **6.0: analyzer/token-filter changes and removed `soft_deletes.enabled`** | No `dutch_kp`, `lovins`, `german2`, `CREATE ANALYZER` or `soft_deletes.enabled` match in the central `crate_schemas.py` or auth schema. Actual stored analyzer definitions and old table settings remain a production gate. [6.0 notes](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.0.html). |
| **6.0: function/aggregate output names change** | `app/utils/crate.ts:78`, `app/server/combined-search/catalog.server.ts:50` and `f/db/cratedb.py:88` turn returned column names into object keys. Named consumers must use explicit `AS`; new SQL result names cannot be assumed. Sampled production aggregates already alias output (`app/server/new-on-services.server.ts`, `f/monitoring/backlog_collection.py`), use positional rows (`proposal-release-operator.ts`, `f/sync/copy/title_snapshot.py`) or are scalar subqueries. No literal `['count(*)']`/`['sum(...)']` consumers found in the scanned server/pipeline source. Rehearse real queries rather than assuming all dynamically generated SQL is covered. |
| **6.0: 262,144-character `statement_max_length` default** | Most writes use bound values. `app/utils/crate.ts:628` builds 500-row placeholder statements; `CrateConnector.upsert_many` builds one placeholder statement and bulk arguments. Parameters do not inflate SQL text, but very wide tables times 500 can still do so. Bound key lists and generated SQL need a measured-length gate. No automatic setting increase is proposed. |
| **6.0: LIKE-left-pattern and stricter TABLE/VIEW grants** | Scanned query matches are ordinary `column ILIKE ?` / `column LIKE ?` (`dna.server.ts`, `similar-media.server.ts`, import resolution); no SQL `LIKE ANY(...)` / `ILIKE ANY(...)` match found. #562 mostly grants schemas, but enumerate actual views and privileges before replaying relation-level GRANT/DENY. The source schemas showed no IP primary keys or BOOLEAN partitions requiring the other 6.0 recreation changes. |
| **6.1: `information_schema.columns.is_nullable` becomes YES/NO; relative paths change** | No `is_nullable` read found in scanned application/pipeline SQL. `f/db/cratedb.py:get_existing_columns` reads only name/type. Production Compose uses absolute `/data` and `/snapshots`; preserve them. Force-merge defaults increase on larger hosts, so watch I/O and avoid adding OPTIMIZE to maintenance. [6.1 notes](https://cratedb.com/docs/crate/reference/en/6.1/appendices/release-notes/6.1.0.html). |
| **6.2: changed SHOW result label and detailed error codes; system-column writes rejected** | Auth uses positional `SHOW CREATE TABLE` output, not `SHOW parameter` keyed by `setting`. No active code branches on detailed codes 4100 or 5030 found; the latter appears in a failover test fixture. `_seq_no` / `_primary_term` are deliberately used in CAS predicates; that is different from inserting system columns. Rehearse CAS and upsert paths. [6.2 notes](https://cratedb.com/docs/crate/reference/en/6.2/appendices/release-notes/6.2.0.html). |
| **6.3: removed cloud-repository options** | Inspected production Compose mounts a filesystem repository; no evidence of S3/GCS/Azure usage in the central backup helper. Actual `sys.repositories` must confirm that assumption. Removed options include S3 `canned_acl`/proxy, GCS `token_uri`, and several Azure settings. [6.3 notes](https://cratedb.com/docs/crate/reference/en/6.3/appendices/release-notes/6.3.0.html). |
| **6.4: removed `gateway.auto_import_dangling_indices`; stricter INSERT casts** | No removed-setting match in production Compose. Check actual command, `crate.yml` and all setting layers before each node; a present removed setting prevents startup. `crate_schemas.py` has many `ARRAY(TEXT)` columns and explicit dynamic/strict objects. Model source types `streaming_availabilities` as `list[str]` and constructs strings in `f/sync/copy/tmdb_streaming.py:520`; this is compatible with the stricter rule. Test real typed writes and reject object arrays bound to text-array fields rather than relying on prior single-row coercion. [6.4 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.0.html). |

The changed SQL `stddev` population/sample semantics and percentile compression deserve attention if introduced later; grep found only application/Python percentile calculations, not use of these SQL aggregates in the reviewed source. Lucene 10's Linux read-advice change can affect the6.0 stage;6.1.3 already reverted the default to NORMAL (thus selected6.1.6+ needs no workaround). Do not turn the6.0 release-note flag into an unmeasured permanent default change.

### Concrete client recovery gap

Before this preparation patch, `goodwatch-webapp/app/utils/crate.ts:isNodeLossError` recognized only the exact **Participating node … disconnected** `JobKilledException` message. The [6.4.3 coordinator cleanup fix](https://github.com/crate/crate/pull/19901) adds the distinct **Coordinator node … disconnected** form, which that regular expression did not match. That can turn a transient read into a surfaced failure rather than recovery. This preparation patch recognizes both roles and adds read-recovery/non-replayed-write regression tests; it still requires review and deployment before the upgrade. Extend only the relevant error classification; do not use it to authorize generic write retries. Auth transport already treats cancellation as indeterminate and must retain that rule.

### BLOB authorization is an application-availability gate

The [BLOB authorization advisory GHSA-2xv8-gjwh-fv8p](https://github.com/crate/crate/security/advisories/GHSA-2xv8-gjwh-fv8p) is fixed in **6.2.8 / 6.3.2**. Both fixes are included in the planned path from 6.2.11 onwards. Before that change, HBA authenticated BLOB HTTP requests but did not enforce their table privileges. The tagged [6.2.8 handler](https://github.com/crate/crate/blob/6.2.8/server/src/main/java/io/crate/protocols/http/HttpBlobHandler.java#L208) and [6.4.6 handler](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/io/crate/protocols/http/HttpBlobHandler.java#L212) explicitly require **DQL on the BLOB table for GET/HEAD**, and **DML for PUT/DELETE**. The [6.2.8](https://cratedb.com/docs/crate/reference/en/6.2/appendices/release-notes/6.2.8.html) and [6.3.2](https://cratedb.com/docs/crate/reference/en/6.3/appendices/release-notes/6.3.2.html) release notes reference the advisory.

The #562 baseline in `docs/implementation/auth/cratedb-production-rollout.md:290` grants `goodwatch_search` DQL on **doc** and DML on three **doc** search-control tables, but no privilege on **blob**. `app/server/search-ranking/search-index-build.server.ts:139` loads the index over authenticated `/_blobs/search_index_files/<sha1>` HTTP. Therefore preserving the historical grants alone can break index loading as soon as a patched coordinator/shard handles the request.

The initially proposed table-only DQL grant is **not sufficient on the tested 6.4.6**. The execution agent restored the v5 `USERMANAGEMENT` metadata into a fresh 6.4.6 lab and verified the exact canonical `sys.privileges` row for `blob.search_index_files`. GET/HEAD still returned HTTP 404 with `Schema 'blob' unknown`; reissuing the same table grant on 6.4.6 returned rowcount 0 and did not repair it. A schema-DQL user succeeded, and adding schema DQL to the search identity changed GET to HTTP 200. These are local observations, not production-grant changes.

The tagged source explains why this is more than a missing schema-visibility permission. [`HttpBlobHandler`](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/io/crate/protocols/http/HttpBlobHandler.java#L184) passes the internal BLOB index name `.blob_search_index_files` to the privilege checker. [`RolePrivileges.matchPrivilege`](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/io/crate/role/RolePrivileges.java#L121) first looks up that exact table identifier, whereas [`PrivilegesAnalyzer`](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/io/crate/analyze/PrivilegesAnalyzer.java#L246) stores the table grant under `blob.search_index_files`. Schema fallback decodes the internal name and can find a grant on `blob`. This is a source-supported identifier-mismatch explanation for the observed table-grant failure. The same HTTP-call shape remains in inspected 6.5.0 source; no newer-version cure was established here.

A locally tested workaround is:

```sql
GRANT DQL ON SCHEMA blob TO goodwatch_search;
```

This **broadens read access to every current and future BLOB table**, not just the search index. It therefore requires a separate explicit owner decision and current BLOB-table/data-classification inventory before the first **6.2.11** node. Do not silently broaden privileges, grant DML, alter underlying privilege metadata, or present the original table-only grant as a verified fix. Options are to accept this read-only schema workaround after reviewing every BLOB table, or defer the patched stage pending a table-scoped upstream correction. The same internal-index/canonical-table identifier mismatch can also defeat a canonical table-scoped DENY in the HTTP path. Do not assume SQL DENY results protect other BLOB tables after the schema grant; require an explicit negative HTTP test and accept only the actually approved readable-table inventory, or defer the workaround.

Verify GET and HEAD, including the 307 shard redirect, plus negative PUT/DELETE tests in the disposable lab, for every page/search identity loading an index. The #562 Windmill baseline already has DQL/DML/DDL on the BLOB schema and should retain it for its index writer, whose `BlobStore` in `f/search/build_indexes.py:284` uses HEAD, PUT and DELETE. This is an authorization-compatibility gate independent of password/HBA correctness. The initial isolated rehearsal inspected no production grants. Current grant readbacks belong to the authorized production preflight in the runbook; no production grant change is authorized here.

### Aggregate output-name callers checked

The node-crate wrapper's `json` result is keyed by the server's `cols`, so the 6.0 naming change is real even though no confirmed broken active caller was found in the scan:

- `app/utils/crate.ts:557` uses `SELECT count(*) AS n` for guarded write readback.
- Import stores/apply code uses `count(*) AS n`; `profile/library.server.ts:168` uses `MIN(...) AS first`; `new-on-services.server.ts:344` uses `max(updated_at) AS updated`; `my-shows.server.ts:295` names its filtered count `aired`. These explicit aliases preserve their object keys.
- The unaliased count in `auth/supabase-importer.server.ts:103`, the room-empty check in `yepwatch/proposal-release-control.ts:127`, and count/min/max inventory in `yepwatch/proposal-release-operator.ts:79` read positional `.rows`, not `json['count(*)']` or an aggregate-derived object key.
- `details.server.ts:290` and `title-cast.server.ts:48` put scalar `count(*)` subqueries under explicit object keys such as `cast_total`; `dna.server.ts` puts an unaliased scalar `array_agg` inside an expression aliased `aliases`. The scalar subquery's internal result label is not used as a client object key.
- `f/monitoring/backlog_collection.py:160` explicitly aliases every aggregate consumed by name. `f/sync/copy/title_snapshot.py:257` destructures count/sum values positionally.

Keep real-query result-shape assertions in the rehearsal, especially dynamically constructed SQL. These inspections justify **no blanket alias rewrite**, not a claim that every possible dormant query was statically proven safe.

## Client inventory and tests required

- `goodwatch-webapp/package-lock.json`: **node-crate 3.0.0**, **pg 8.23.1**. Runtime catalog operations use the HTTP node-crate wrapper or direct undici HTTP; auth uses a dedicated HTTP transport. The `pg` package is also used for the Supabase PostgreSQL importer source and its tests; its presence does not mean every production Crate connection uses PG wire protocol.
- `goodwatch-search/docker-compose.yml`: search-a/b run the **same webapp image** with `WEBAPP_ROLE=search`. There is no independent Python search client to upgrade; test the current search image's catalog and authenticated BLOB paths.
- Checked-in Windmill script locks include **crate-python 2.2.1** (32 files) and **2.3.0** (26 files). `f/db/cratedb.py` uses HTTP `crate.client`, cursor bulk requests, parameter binding and `urllib3.Timeout`. A local test of one version does not qualify both or prove installed worker lock versions.
- Bulk writes already inspect individual results in `_failures`, `run_many` and `_bulk`; test both pinned Python clients against mixed and final versions because [6.4.3](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.3.html) changes the HTTP presentation of unavailable-shard bulk failures. Actual installed client/version readbacks now belong to the authorized production preflight recorded in the runbook; cached historical packages do not establish the version of every active job.

## HBA, users and privileges

Preserve #562 enforcement exactly. [6.4 HBA settings](https://cratedb.com/docs/crate/reference/en/6.4/config/node.html#host-based-authentication) remain node-local startup settings and retain password authentication. `goodwatch-crate/docker-compose.yml` already uses trusted loopback for `crate`, then password for everyone else. Preserve those flags on all fifteen replacements; do not rely on a snapshot to configure node-level HBA.

The six historical #562 users/grants and subsequent auth grants are cluster metadata. Do not regenerate secrets or re-create existing users during an upgrade. The prior role inventory is evidence at its recorded date, not a current complete inventory. Test good/wrong/missing HTTP credentials and PG-wire password behavior, trusted local administration, schema DQL/DML, backup privileges, and explicit auth-table DENY behavior at every stage. [RESTORE SNAPSHOT](https://cratedb.com/docs/crate/reference/en/6.4/sql/statements/restore-snapshot.html) needs cluster DDL; including user-management metadata additionally needs cluster AL. Do not grant AL to the scheduled backup user just to perform an operator restore.

## Three-copy tables and the zero-primary stop gate

The initial local rehearsal reported by the execution agent found that native decommission entered its active-request wait while the final 5.10 node still held ten primaries. The fixture included auth tables and YepWatch tables with two replicas: every shard already had one copy on each of the three data nodes. A request to leave all copies on the two survivors cannot be satisfied merely by moving another copy there. The explicit zero-primary check correctly prevented a normal stop; the decommission acknowledgement and log message were not sufficient clearance. This is a lab observation, not a fresh production-shard inventory.

Two attempted lab policies must be distinguished:

1. Native decommission without a settings exception failed the explicit zero-primary gate on the last old-version node. It was not force-stopped.
2. Reducing replicas from 2 to 1 before the **first** mixed-major replacement, then attempting to restore three copies, left the cluster YELLOW. The allocation decider refused recovery from a newer primary onto an older data node. The execution agent discarded that cluster and rebuilt fresh 5.10 directories from its pre-upgrade snapshot; it did not downgrade a directory opened by 6.x.

The allocation restriction is expected: [`NodeVersionAllocationDecider` in 6.0.8](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java#L82) only permits replica recovery onto an equal-or-newer major/minor node than its primary. [The 6.4.6 source](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java#L82) retains the same protection. Removing an existing copy can therefore create a placement that cannot be repaired until the remaining older nodes advance. A proposed maintenance policy must not assume it can freely remove and restore copies while versions differ.

The **protocol that subsequently completed all fifteen local replacements** is below. Its production use still requires approval and fresh preflight; see [receipts and limitations](../implementation/crate-6-upgrade/20261026-rehearsal/README.md).

- Capture each table's exact replica expression and write-wait setting, including partition-specific settings. For affected three-active-copy gates, briefly block writes, RESET the old write-wait, SET 2, verify, then restore the original write-block state; this prevents admitting writes during the default-1 transition.
- For the first two node replacements of each stage, preserve replicas=2 and existing copies. Temporarily lower only a 3/`all` write gate to 2 during that node's stop, require native decommission to reach zero target primaries, then replace/rejoin and require full STARTED/GREEN/checkpoint recovery before restoring the exact original write gate. Do not reduce the replica count on these first two replacements.
- Only for the **last old-version node**, when both survivors already run the stage's target version, lower its applicable 3/`all` write gates to 2 and set affected two-replica tables to one replica. Require the two survivors' copies STARTED/GREEN/checkpoint-ready, drain to zero target primaries, and perform the guarded stop/replacement. After all nodes run the target version, restore replicas=2, require all three copies STARTED/GREEN/checkpoint convergence, then restore the original 3/`all` write gate.
- Leave original write-wait values 1 or 2 unchanged. Stop on another node failure; do not lower further. Take a stage snapshot only after full settings restoration.

This is a **resilience-policy exception requiring explicit owner approval for any production use**. Prior #562 approval to drain to zero primaries and use unlimited-grace normal SIGTERM did not authorize changes to table replication or write-admission settings. The first/second-node reduced active-copy gate and the last-node two-copy interval must both be included in the approval; they are different exceptions.

Auth's [storage implementation](../../goodwatch-webapp/app/server/auth/IMPLEMENTATION.md#storage-and-receipt-recovery) and `crate-adapter.server.ts:101` specify two replicas, `translog.durability=REQUEST` and `write.wait_for_active_shards=1`. Preserve REQUEST and the original **1**; never rewrite its CAS/readback rules. The last-node reduction still lowers its physical redundancy. YepWatch's historical `storage-v1/schema.ts:335` and current `proposal-storage-schema.ts:349` specify replicas=2 and a three-active-copy gate. Lowering 3/`all` to 2 weakens that deliberate admission condition. The [typed-storage ADR](../adr/yepwatch-typed-room-storage.md) preserves atomic publication through immutable records plus one room-head CAS; these settings changes do not alter the algorithm, but do change its physical failure envelope. The ADR grants no standing permission for that exception.

**Active-copy admission is not an acknowledgement quorum.** [`write.wait_for_active_shards`](https://cratedb.com/docs/crate/reference/en/6.4/sql/statements/create-table.html#write-wait-for-active-shards) checks availability before a write starts; it does not guarantee a write ultimately reaches that many copies. Describe the exception as “two copies, two-active-copy admission” where applicable, not “two acknowledgements.” If the owner declines these exceptions, keep the zero-primary guard and redesign around sufficient additional compatible data-node capacity or a separately approved outage; do not use `force=true` or waive the zero-primary gate.

The [shared-description ADR](../adr/yepwatch-shared-room-description.md) records typed format 2 deployed on October 23. The current fixture should therefore use `proposal-storage-schema.ts`; a storage-v1-only fixture tests the same replication conflict but does not qualify current deployed columns or room behavior.

## Backup, restore and rollback constraints

`goodwatch-crate/backup.py` uses still-documented CREATE/DROP SNAPSHOT and selected `sys.snapshots` columns; its connection-refusal failover and refusal to replay ambiguous writes must remain intact. It also hardcodes `REPO_NAME="goodwatch-db-backup-v2"`; `f/monitoring/backup_health.py` hardcodes the same registration. [Snapshot guidance](https://cratedb.com/docs/crate/reference/en/6.4/admin/snapshots.html) advises a new repository/path after a major upgrade. Plan how writer **and monitor** move together, or preserve the identifier while deliberately moving its registration to a new path and retaining the pre-6 path under a protected registration. Simply creating v3 without switching the clients leaves routine backup activity on v2.

Freeze/protect a pre-upgrade snapshot repository and separately back up/verify BLOB files; SQL snapshots omit BLOB tables. Test restore of the 5.10 snapshot into a clean 6.4.6 cluster and verify sample values, not just a SUCCESS row. `TABLES` restores table data without metadata; `ALL` also overwrites cluster metadata/settings, users/roles/privileges. Use separate repositories/paths and no concurrent writers during a restore drill.

The [upgrade-planning guide](https://cratedb.com/docs/guide/admin/upgrade/planning.html) requires backup-based rollback for major/minor transitions, and advises stopping scheduled backups during upgrade. Both are future production actions needing explicit authorization. Once a data directory has been opened by 6.x, do not run 5.10 on it. Rebuild an isolated 5.10.16 cluster from the preserved pre-upgrade snapshot and separate BLOB artifacts, then cut over deliberately; account for all writes after that snapshot through an approved write freeze/queue/replay/RPO decision. Node-local volume copies are not a replacement for a cluster-consistent SQL snapshot.

## Remaining production-only gates

The original isolated planning/rehearsal did not read production metadata. The subsequent authorized read-only preflight is recorded in the runbook; recheck time-sensitive gates before execution. Require actual table/partition creation versions, cluster/node checks, settings layers, analyzer definitions, repository types/options, privileges/users, installed client versions, disk headroom, data sizes, recent backup success and protected restore capacity before approving execution. A fresh-schema lab cannot prove these production-specific facts or estimate full-data recovery throughput. Existing #644 residual behavior remains a separate accepted risk: 6.4.6 was not shown to cure all context retention.

## Complete release-note audit added for upgrade preparation

Re-read on **2026-10-26**, against repository main `1770d08d1`, all **43** release notes:
6.0.0–6.0.8 (9), 6.1.0–6.1.6 (7), 6.2.0–6.2.11 (12), 6.3.0–6.3.7 (8),
6.4.0–6.4.6 (7). The complete [6.0.0 document](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.0.html)
was read, including every breaking-change, deprecation and Changes subsection, warning and example;
it has no separate Fixes heading. All subsequent patch-note Fixes sections were read in full.
This extends the earlier selective review; it does not replace the production measurements in the runbook.

The tables below distinguish confirmed source usage, absent source usage, and metadata-dependent gates.
“None” means no upgrade-driven code change was established in the searched source, not proof that dormant
or externally installed queries are absent. Correctness/performance fixes usually need a verification gate,
not client workarounds. Purely additive features are grouped where they do not change existing calls.
Each version heading links to the first-party release notes for every row beneath it. Repeated backports
are recorded at each release boundary so no skipped patch's behavior is silently omitted.

### Grep scope and evidence keys

Searches covered **goodwatch-webapp, goodwatch-search, goodwatch-flows, goodwatch-crate and top-level scripts**,
including script SQL, schema builders, Compose/YAML and users/grant setup; generated dependency trees,
lock-file bulk and historical JSON receipts were excluded from semantic SQL matches. Package lock files
were inspected separately for client versions. Exact source matches and negative patterns are retained
in the [preflight evidence archive](../implementation/crate-6-upgrade/20261026-preflight/README.md) as `release-grep-evidence.json`. These keys keep the matrix readable:

| Key | Repository evidence |
| --- | --- |
| **S** | `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`; auth `crate-adapter.server.ts`; current `yepwatch/proposal-storage-schema.ts`; schema initializer `f/sync/init/cratedb.py`. There are DYNAMIC/IGNORED/STRICT objects, arrays, defaults and routing, but no SQL generated columns, ARRAY(VARCHAR), NUMERIC columns, IP primary keys, BOOLEAN partition columns or removed analyzer names in source. Live metadata is a separate gate. |
| **Q** | `goodwatch-webapp/app/server/utils/recommend.ts`, `watch-state.server.ts`, `talked-about-now/{start-row,social-store}.server.ts`, `goodwatch-flows/windmill/f/social/store.py`: joins, NULLs, CASE and row_number windows occur. `f/imdb_datasets/diff.py` also has windows, but its DuckDB execution is not evidence of Crate use. |
| **C** | `goodwatch-webapp/app/utils/crate.ts` (HTTP driver, bound values, named-column mapping and retry policy), `combined-search/catalog.server.ts`, auth `crate-adapter.server.ts`, `goodwatch-flows/windmill/f/db/cratedb.py` (HTTP cursor, parameters, row mapping, bulk per-item errors). Search containers reuse the webapp image. |
| **O** | `goodwatch-crate/docker-compose.yml` has absolute data/repository paths and password HBA after local trusted crate; `backup.py` uses selected sys.snapshots columns and CREATE/DROP SNAPSHOT, not COPY FROM or OPTIMIZE. |
| **B** | `search-ranking/search-index-build.server.ts` authenticated BLOB GET; `f/search/build_indexes.py` BlobStore HEAD/PUT/DELETE. #562 privilege declarations are in the password-rollout runbook; runtime grants require inventory. |
| **V** | `feedback/store.server.ts:33,65,76` and `feedback/correction-store.server.ts:29,60,69,221` actively SELECT and predicate on `_version`; auth and YepWatch instead use `_seq_no`/`_primary_term`. Deprecation alone is not removal. |
| **N** | No SQL `stddev`, `hyperloglog_distinct`, SQL percentile call, current_catalog identifier, explicit OBJECT→OBJECT cast, COPY FROM, SQL UDF, CREATE ANALYZER, OPTIMIZE TABLE, publication/subscription, `is_nullable` consumer or `optimizer_equi_join_to_lookup_join` override found. Percentile matches are JavaScript/NumPy/Taste methods, not SQL. No schema generated columns or constrained VARCHAR arrays found. |
| **U** | SQL char_length occurs in `f/sync/backfill/trope_lengths.py:45`; ordinary ILIKE predicates occur in `dna.server.ts` and `similar-media.server.ts`. No pattern-on-left LIKE ANY or hyperloglog SQL found. |

### 6.0.0 — [full notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.0.html)

| Breaking or behavior change | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| 4.x-created indices unreadable in 6.x | Source S cannot establish creation versions of deployed tables/partitions. | **Preflight check:** inventory all concrete indices/closed/retained tables; recreate incompatible ones before 6.x. |
| Removed dutch_kp/lovins token filters | No source match (S/N); stored analyzers may differ. | **Preflight check:** inspect stored analyzers; reindex affected tables. |
| german/german2 share expanded-umlaut stemmer | No source analyzer definition (S/N). | **Preflight check:** inspect live definitions and reindex affected german-analysis tables if required. |
| Lucene MADV_RANDOM changes file I/O advice | Linux production and local rehearsal use Lucene files (O). | **Runbook step:** watch IOPS/recovery on 6.0.8; no automatic JVM override. See 6.1.3 correction below. |
| Removed soft_deletes.enabled | No source match (S/N). | **Preflight check:** reject removed stored/startup setting. |
| OBJECT→OBJECT cast now merges inner types unless target STRICT | No explicit SQL object cast found (N); S defines objects without those casts. | **None:** no confirmed caller rewrite; include typed-object result canary. |
| LIKE/ILIKE no longer treats left argument as pattern | Ordinary column-left/value-right predicates (U), no pattern-left ANY call. | **None:** retain ordinary predicates. |
| Percentile default compression 100→200 | No SQL percentile found (N); frontend percentiles are unrelated. | **None:** no SQL compatibility change. |
| GRANT/DENY requires TABLE/VIEW securable to match relation | #562 mostly grants schemas; table grants exist (B/O). | **Preflight check:** inventory views/table grants and replay exact relation types. |
| IP literals/PK values normalize IPv4-mapped IPv6 | No IP PK in source S. | **Preflight check:** inspect actual PK types; recreate affected IP-PK tables if found. |
| BOOLEAN partition encoding/filtering corrected | No BOOLEAN partition in source S. | **Preflight check:** inspect live partition key types; recreate affected tables if found. |
| statement_max_length defaults to 262144 | C parameterizes values, but multirow insertRows builds SQL text. | **Preflight check:** measure largest generated statement; keep bound/bulk writes; no global limit increase. |
| Function/constant-expression result labels change | C maps cols to object keys; named aggregates inspected above already alias; other callers use positional rows. | **Preflight check:** result-shape assertions for named consumers; no blanket alias rewrite. |
| stddev changes population→sample | No SQL stddev call (N). | **None:** use explicit stddev_pop if added later. |
| current_catalog becomes reserved | No source identifier match (N). | **None:** inventory dormant external SQL separately. |
| `_version` fully deprecated | **Yes: V is active**, missed by earlier review; still supported in target. | **Preflight check:** exercise feedback/correction OCC on both versions; plan later seq_no/primary_term migration, no upgrade-required rewrite. |
| COPY FROM infers gzip when every filename ends .gz | No Crate COPY FROM found (N); backup is snapshots (O). | **None:** no current caller to change. |
| Added starts_with, lowercase to_char format patterns, CURRENT_CATALOG | No dependency on new semantics (N); additive. | **None:** retain 5.10-compatible SQL. |
| Added role-information tables and pg_index.indnkeyatts values | O reads sys metadata explicitly, no SELECT * dependency on added catalogs. | **None:** keep explicit mixed-version projections. |
| Dynamic nested-array mapping support | Object/array ingestion exists (S/C). | **Preflight check:** typed-array ingestion canary; do not rely on dynamic inference replacing schema. |
| Missing nested-object-key errors now follow policy/session setting | Objects used (S); no error_on_unknown_object_key override (N). | **Preflight check:** NULL/missing-key canary, retain default; no global suppression. |
| NUMERIC avg/avg DISTINCT and POWER/DEGREES/RADIANS support/performance | No NUMERIC schema (S/N). | **None:** additive. |
| Added array_overlap/&&, stddev_pop/stddev_samp | No dependence in pre-upgrade SQL (N). | **None:** do not introduce 6.x-only syntax into compatibility patch. |
| Percentile digest AVLTreeDigest→MergingDigest | No SQL percentile (N). | **None:** application percentile implementation unchanged. |
| Read-task prioritization protects sys.shards/sys.nodes monitoring | O and runbook query these during load/drain. | **Runbook step:** continue independent metadata/health checks; no result-count shortcut. |
| Virtual-table/object WHERE pushdown improves | Q uses SQL subqueries; affected optimization changes plan, not supported syntax. | **Preflight check:** representative result/latency comparison. |
| COUNT(not_null_column) optimized like COUNT(*) | Named aggregate callers already alias; no intentional reliance on slower count plans (C). | **None:** retain NULL-vs-star semantics and aliases. |
| Temporary unavailable-shard reads recover internally more often | C implements bounded read recovery. | **Runbook step:** retain timeout/retry budgets and do not infer write replay safety. |
| Mixed implicit/explicit joins execute in source order | Joins exist (Q); previous fixture sampled limited queries. | **Preflight check:** compare representative multi-join result/latency; no automatic SQL reorder. |
| = ALL array execution improves | No confirmed active = ALL query found in searched SQL. | **None:** optimizer improvement. |
| Idle-shard recovery and retention-lease synchronization change | Cluster recovery/drains are central to O. | **Runbook step:** measure current recovery; do not extrapolate toy timing. |
| Added sys.segments merge columns, sys.cluster_health, sys.shards.last_write_before | O uses explicit columns; no need to switch monitoring during mixed versions. | **None:** preserve 5.10-compatible checks. |
| Added insert_select_fail_fast session setting | No override found; DuckDB INSERT SELECT matches are not Crate (N/C). | **Preflight check:** retain default; preserve per-item error handling and schema-job hold. |
| mapping.depth.limit re-enabled, default100 | S has nested objects but shallow declared structure; dynamic live objects not bounded by source. | **Preflight check:** inspect actual nesting/mapping and reject incompatible depth; no global increase. |

### 6.0.1 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.1.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| Generated/default values evaluated on UPDATE/ON CONFLICT again | Defaults exist (S); SQL generated columns absent (N). | **Preflight check:** default/upsert values canary; target includes fix. |
| PG outbound-message race/memory leak fixed | pg present, Crate's main clients are HTTP (C). | **Preflight check:** actual PG client parameter/query canary. |
| Mixed6.0/old5.x writes retain seqNo/primaryTerm replication metadata | Auth OCC uses these (C); source5.10.16 is later than affected <5.10.11. | **None:** selected path includes fix; retain mixed-copy verification. |
| DELETE NPE fixed | Application deletes rows (C/V). | **Preflight check:** restricted disposable DELETE canary, no production test delete. |
| PG EXECUTE maxRow exact-result-count hang fixed | No manual protocol maxRow settings in app C. | **None:** positive driver regression test covers current clients. |
| Network-partition INSERT hang fixed | Production write load and earlier node-loss incident relevant (C). | **Runbook step:** bounded observation/abort; no forced kill or blind replay. |
| Logical-subscription loss during rolling upgrade fixed | No publication/subscription source (N). | **Preflight check:** verify no external subscriptions; otherwise no change. |
| Recovery file-chunk setting becomes changeable | No source override (O). | **None:** do not tune production during upgrade. |
| Distributed aggregate memory-pressure OOM fixed | Aggregates exist (Q/C). | **Runbook step:** monitor breaker/heap; patch is included. |
| Window PARTITION/GROUP mismatch error clarified | Window use exists but no intentional invalid grouping (Q). | **None:** no matcher depends on this text. |
| NULL object with nondeterministic child NPE fixed | No SQL generated subcolumns (S/N). | **None:** retain object NULL canary. |
| Generated-column reference to PK update bounds error fixed | No generated column (N). | **None.** |
| FORCE_MERGE parallel shard execution fixed | No OPTIMIZE caller (N). | **None:** do not introduce optimization jobs. |

### 6.0.2 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.2.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| PG batch parse/bind-error response ordering fixed | C clients parameterize; no manual wire handling. | **Preflight check:** installed-driver canary; no error-string branch. |
| 5.x BLOB metadata migration made forward-compatible with6.1 | **Yes: BLOB search index exists (B).** | **Runbook step:** retain6.0.8 before6.1; do not substitute6.0.0/1. |

### 6.0.3 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.3.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| PG repeated-fetch result truncation fixed | C pg dependency, no low-level fetch implementation. | **Preflight check:** driver result-count assertion. |
| PG result/field message ordering race fixed | C. | **Preflight check:** driver parameter/result-shape assertion. |
| LIMIT query interrupted by breaker cleans jobs/memory | LIMIT used widely (Q/C); relevant to#644 but distinct failure trigger. | **Runbook step:** observe operations/jobs/heap, no assertion this cures every orphan. |
| COPY FROM nondeterministic default/generated bounds error fixed | No Crate COPY/generated usage (N). | **None.** |
| Queried NULL object children no longer omitted | Objects used (S/C); prior toy samples not exhaustive. | **Preflight check:** nullable-object result-shape canary. |
| Failed subquery resets query breaker accounting | Subqueries exist (Q). | **Runbook step:** monitor breakers, not kill residuals. |

### 6.0.4 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.4.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| PG large-result disconnect leak fixed | PG dependency present (C); main Crate transport HTTP. | **Preflight check:** installed-client read/cancel canary. |
| ARRAY inner-type constraints enforced | No ARRAY(VARCHAR) source (S/N); arrays otherwise typed. | **Preflight check:** actual array constraints/ingestion values. |
| Window partition on view/CTE object child corrected | Windows and objects exist (Q/S), no confirmed exact active shape. | **Preflight check:** social/window query result comparison. |
| Distributed hash-join deadlock fixed | Multi-node joins exist (Q). | **Runbook step:** timeout/health abort gates; no workaround. |
| EXPLAIN ANALYZE subquery breaker leak fixed | No active EXPLAIN ANALYZE call found (N). | **None.** |
| Partition+cluster routing WHERE narrowing improved | Routing exists (S); most current schemas not partitioned. | **Preflight check:** live partitions/routing and representative plan/latency. |
| Oversized integral IGNORED-object replication corrected | IGNORED objects active (S). | **Preflight check:** preserve typed values, representative object write/replica canary. |
| PowerShell crate.bat -C startup fixed | Production uses Linux Docker (O). | **None.** |
| Complex lookup-join optimizer rule error fixed | Joins active (Q); no rule override (N). | **None:** retain default optimizer; compare actual queries. |
| HTTP large-result RAM accounting fixed | **Yes, C uses HTTP.** | **Runbook step:** watch breaker/memory under representative reads. |
| RETURNING includes default/generated object children | No generated source; auth uses RETURNING (C/S). | **Preflight check:** auth/object returned-value assertions. |
| Generated children inside/referencing object arrays rejected | No SQL generated columns (N). | **Preflight check:** stored DDL inventory; no source migration needed. |
| Dropped pg_attribute.atttypid reset to0 | No pg_attribute SQL consumer found (N). | **None:** PG introspection fix. |
| INSERT VALUES execution failures clean sys.jobs | C bulk/upsert paths can fail, relevant to retained work. | **Runbook step:** retain explicit per-item failures/operation sampling. |
| Restored-table added-column docvalues error fixed | Restore drill/future schema evolution relevant (O/S). | **Preflight check:** restored data/schema canaries; target includes fix. |
| Pre5.5 IGNORED-object NULL translog recovery fixed | Live creation versions required (S). | **Preflight check:** inventory versions/translog; do not apply global strict_duplicate_detection workaround. |
| GROUP BY LIMIT0 breaker leak fixed | Aggregates exist; no exact GROUP BY LIMIT0 use found. | **None:** use normal breaker monitoring. |
| Aliased-CTE nested join on unknown object children corrected | Q/S; exact shape not confirmed. | **Preflight check:** representative object/join result comparison. |
| COPY FROM adaptive bulk-size breaker failure fixed | No Crate COPY FROM caller (N). | **None.** |

### 6.0.5–6.0.8

| Version / source | Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- | --- |
| [6.0.5](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.5.html) | Percentile serialization EOF/unexpected-byte errors fixed | No SQL percentile (N). | **None.** |
| [6.0.6](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.6.html) | SWAP/DROP metadata corruption in mixed5.10/6.x fixed | Pipeline schema/table lifecycle exists (S). | **Runbook step:** choose patched target and freeze schema-changing jobs through mixed stages/snapshots. |
| [6.0.6](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.6.html) | SWAP of partitioned pre5.10 tables corrected | Source alone cannot establish retained partitions (S). | **Preflight check:** live partition inventory; no swap during upgrade. |
| [6.0.6](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.6.html) | Pre5.5 table metadata mutation data-loss fixed | Potentially relevant live old indices (S). | **Runbook step:** pinned6.0.8; no earlier6.0 substitution. |
| [6.0.7](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.7.html) | CREATE/DROP SNAPSHOT hang fixed | **Yes: actual backup helper (O). Earlier review omitted this backport.** | **Runbook step:** selected6.0.8 already has fix; no claim it persists until6.1.6. |
| [6.0.8](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.0.8.html) | Primary-key INSERT IllegalStateException fixed | PK writes pervasive (C/S). | **Preflight check:** default/upsert/OCC canaries; retain exact patch. |

### 6.1.0 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.0.html)

| Breaking or behavior change | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| information_schema.columns.is_nullable BOOLEAN→YES/NO text | No consumer (N); schema introspection reads column names/types only. | **None:** update future external inventory consumers if discovered. |
| Relative path resolution bases on CRATE_HOME | O paths are absolute. | **Preflight check:** inspect installed path.conf/data/repo/logs and preserve absolute mounts. |
| FORCE_MERGE default pool1→processors/8 | No OPTIMIZE SQL (N); may affect externally scheduled work. | **Preflight check:** avoid concurrent optimization and record hardware. |
| MADV_RANDOM repeated warning | Linux O; selected6.1.6 includes6.1.3 NORMAL correction. | **Runbook step:** no automatic workaround for6.1.6+. |
| Added pg_auth_members | No source consumer (N). | **None:** additive. |
| Percentile performance improvements | No SQL percentile (N). | **None.** |
| ANALYZE statistics persist over restart | Queries use optimizer (Q), no application pg_stats ownership. | **Runbook step:** preserve/compare plans; no forced ANALYZE during upgrade. |
| Added sys.sessions.last_job_id | O uses explicit monitoring columns. | **None:** additive. |

### 6.1.1 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.1.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| PG large-result disconnect leak fixed | C. | **Preflight check:** installed-client read/cancel. |
| ARRAY inner-type constraint enforcement | S; no ARRAY(VARCHAR) in source. | **Preflight check:** typed-array canary. |
| Window partition on object child from view/CTE corrected | Q/S, exact shape not established. | **Preflight check:** representative social/window query comparison. |
| Concurrent ALTER shard-count operations no longer interrupt each other | Schema initializer exists (S), no reason to reshard during upgrade. | **Runbook step:** freeze schema/reshard jobs. |
| Distributed hash-join deadlock fixed | Joins active (Q). | **Runbook step:** monitor timeout/heap, target includes fix. |
| EXPLAIN ANALYZE subquery leak fixed | No active use (N). | **None.** |
| RETURNING default/generated object children restored | Auth transport (C), no generated source (N). | **Preflight check:** returned-value assertions. |
| Persisted pg_stats survives full restart | Optimizer used (Q). | **Runbook step:** preserve plans/stats; no full-cluster restart proposed. |
| Generated children in/referencing object arrays disallowed | No generated source (N). | **Preflight check:** live DDL check only. |
| pg_attribute.atttypid for dropped columns corrected | No source consumer (N). | **None.** |
| INSERT VALUES errors clean sys.jobs | Writes active (C). | **Runbook step:** retain per-item error checks and operation sampling. |
| Restored-table added-column docvalues error fixed | Restore/schema lifecycle (O/S). | **Preflight check:** restore validation; target includes fix. |
| Logical replication from older clusters fixed | No publication/subscription source (N). | **Preflight check:** actual subscriptions if externally configured. |
| Pre5.5 IGNORED-object NULL translog recovery fixed | IGNORED object source (S), actual age uncertain. | **Preflight check:** versions/translog; no global workaround. |
| GROUP BY LIMIT0 leak fixed | No exact caller found. | **None:** monitor breaker ordinarily. |
| Nested joins/aliased CTE unknown child results corrected | Q/S. | **Preflight check:** representative result comparison. |
| COPY FROM adaptive bulk failure fixed | No Crate COPY FROM (N). | **None.** |

### 6.1.2 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.2.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| length supplementary Unicode counts codepoints correctly | Trope backfill uses char_length (U); frontend JS length is unrelated. | **Preflight check:** Unicode content-length canary; accept corrected character semantics. |
| Forward-compatible cast representation for6.2 | Parameter casts/object types active (C/S). | **Runbook step:** selected6.1.6 precedes6.2.11. |
| COUNT(NULL) returns one zero row | No literal COUNT(NULL) SQL found. | **None:** named count aliases already used. |
| LEFT JOIN unmatched-row hash-collision results corrected | LEFT JOIN active (Q). | **Preflight check:** representative join counts/results. |
| Percentile serialized-state errors fixed | No SQL percentile (N). | **None.** |

### 6.1.3 — [notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.3.html)

| Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- |
| Dynamic object-array schema addition with mixed NULL types succeeds | DYNAMIC/array ingestion (S/C). | **Preflight check:** representative array/object ingestion; no client inference workaround. |
| NOT NULL child constraints in object arrays enforced | Source has strict object arrays (S), no confirmed invalid child. | **Preflight check:** real schema/data constraint compatibility. |
| ILIKE matches text containing newline | **Yes, ordinary ILIKE search (U)**; broader corrected matches possible. | **Preflight check:** search result canary including newline; no code change. |
| CASE/multicolumn/LIMIT execution-context failure fixed | CASE/LIMIT common (Q/C). | **Preflight check:** real-query result assertion. |
| hyperloglog FILTER empty→0 instead NULL | No SQL hyperloglog (N). | **None.** |
| HTTP no longer mixes partial success and error output | **Yes, C uses HTTP.** | **Preflight check:** retain per-item bulk error handling. |
| Wrong/missing-HBA credentials no longer leak memory | #562 password enforcement (O). | **Runbook step:** preserve HBA, monitor auth errors, never weaken auth as workaround. |
| HTTP large-result direct-memory accounting corrected | C. | **Runbook step:** monitor direct/heap pressure. |
| Mixed CROSS/INNER CASE join wrong results fixed | Q contains joins; exact malformed old result dependency not established. | **Preflight check:** join results. |
| Dynamic NULL subcolumn IS NULL correctly matches | S dynamic objects, predicates active. | **Preflight check:** NULL-object canary. |
| Dynamic nested object after NULL insertion no longer NPE | S/C object ingestion. | **Preflight check:** object-NULL→typed-value canary. |
| Cached-query memory accounting corrected | Query workload (C). | **Runbook step:** memory/breaker observation. |
| UDF execution requires schema DQL | No SQL UDF source (N). | **Preflight check:** actual UDF inventory/role grants; none to alter in source. |
| UNNEST missing IGNORED child honors error_on_unknown_object_key | IGNORED objects exist (S); no override (N). | **Preflight check:** missing-key semantics, no blanket global relaxation. |
| Empty startup-setting errors clarified | O config is explicit. | **None:** no client matcher depends on bootstrap text. |
| NOT EXISTS/BOOLEAN OR anti-join corrected | Q, exact shape not found. | **Preflight check:** representative joins/results. |
| Lucene read advice reverted to NORMAL | **Earlier review omitted that selected6.1.6 already contains this fix.** | **Runbook step:** watch6.0.8; no unnecessary6.1.6+ JVM flag. |
| Nested array-object UNNEST child paths corrected | S objects/arrays; exact active path not found. | **Preflight check:** typed nested-array result canary. |
| NULL-created subcolumn accepts later concrete value | Dynamic object ingestion (S/C). | **Preflight check:** NULL→typed-value canary. |

### 6.1.4–6.1.6

| Version / source | Behavior change/fix | Affects GoodWatch? Evidence | Action |
| --- | --- | --- | --- |
| [6.1.4](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.4.html) | Mixed5.10 table SWAP/DROP metadata corruption fixed | S table lifecycle; path enters6.1 from6.0.8, not5.10. | **Runbook step:** retain staged path and schema-job hold. |
| [6.1.4](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.4.html) | Partitioned pre5.10 table SWAP migration fixed | Live partition versions uncertain (S). | **Preflight check:** actual table/partition metadata. |
| [6.1.4](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.4.html) | Pre5.5 metadata-mutation data-loss fixed | S cannot establish actual age. | **Runbook step:** do not substitute earlier6.1 targets. |
| [6.1.5](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.5.html) | 6.0→6.1 unknown index.name shard-allocation error fixed | **Directly relevant to selected hop.** | **Runbook step:** selected6.1.6 includes fix; verify all copies after each node. |
| [6.1.6](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.6.html) | CREATE/DROP SNAPSHOT hang fixed | O backup operations. | **Runbook step:** homogeneous-stage backup gate;6.0.8 already has corresponding6.0.7 backport. |
| [6.1.6](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.1.6.html) | Primary-key INSERT IllegalStateException fixed | C/S writes. | **Preflight check:** real keyed insert/upsert/OCC tests. |

### Detailed 6.2–6.4 audit

All sections of all 27 notes in these ranges were read, not only sections labelled breaking. Row version links point to the official complete note. Evidence abbreviations below describe source inspected across `goodwatch-webapp`, `goodwatch-search`, `goodwatch-flows`, `goodwatch-crate`, and root `scripts`; negative matches mean no active Crate SQL use found, not proof about ad-hoc external clients.

- **W:** `app/utils/crate.ts` binds HTTP arguments; generic writes do not automatically replay. `f/db/cratedb.py:17,68,97,251` inspects bulk-item errors, negative rowcounts and response cardinality. Auth uses explicit id and `_seq_no`/`_primary_term` CAS; `proposal-storage-schema.ts:345` supplies typed columns/keys.
- **T:** `f/sync/models/crate_schemas.py:17,113,192,832,1117,1140,1243` contains dynamic, ignored, strict and array objects; explicit text arrays include streaming availability strings. These are active payload/type gates.
- **Q:** Active SQL joins/UNION occur in `app/server/details.server.ts:165,179`; nested/object aggregate access in `dna.server.ts:80`. Dynamic queries need result comparisons. Active row-number windows occur in `app/server/talked-about-now/start-row.server.ts:70`, `social-store.server.ts:110` and `f/social/store.py:200`; no explicit aggregate RANGE/frame use was found. No Crate SQL `string_agg`, `stddev`, `variance`, `topk`, `percentile`, `pg_sleep`, `regclass`, `has_table_privilege` or geo `distance` caller was found in the scan; JavaScript/Python statistics and UI geometry are unrelated.
- **B:** `goodwatch-crate/backup.py` uses CREATE/DROP SNAPSHOT and `sys.snapshots`; `f/monitoring/backup_health.py` monitors the same repository. The planned repository is filesystem-backed. No active Crate COPY FROM file/S3, SWAP/RENAME job, FDW/server/subscription/publication or UDF DDL was found. Production metadata/settings, old scripts and concurrent external operators still require preflight.
- **H:** `goodwatch-crate/docker-compose.yml:53–57` uses loopback trust then password HBA. `app/utils/crate.ts:183,188` and `search-index-build.server.ts:128,142` send Basic authorization per request. The search reader loads BLOBs; `f/search/build_indexes.py:284` writes/deletes them. Schema-level grants and auth DENYs must be checked against the actual inventory.
- **M:** `f/monitoring/cluster_health.py` reads explicit sys columns; mixed-version preflight also selects explicit columns. New sys columns are additive, but SELECT-star consumers outside this scan remain an operator check.

| Version / breaking or behavior change | GoodWatch impact and grep evidence | Action |
| --- | --- | --- |
| [6.2.0]: SHOW uses parameter-name label | No named `setting` result consumer; auth SHOW CREATE reads positional rows. | None |
| [6.2.0]: Duplicate Object code 4100→40910 | No active branch on 4100 found; W preserves detailed errors. | None |
| [6.2.0]: Query killed code 5030→5005 | No active code branch on 5030; fixture use does not set application policy. | None |
| [6.2.0]: System-column writes rejected | W uses system columns in SELECT/CAS predicates, not INSERT targets. | Preflight check: real typed bulk/CAS |
| [6.2.0]: Underscore-prefixed user columns accepted | No required rename; keep avoiding system-name collisions. T enumerates columns. | None |
| [6.2.0]: client_encoding UTF8 setting | HTTP primary clients; pg lock canary remains required. No other SQL encoding requested. | None |
| [6.2.0]: PG protocol minor negotiation | Additive; pinned pg client tested in rehearsal. | Preflight check: installed PG administration |
| [6.2.0]: Parser cache eviction on pressure | W generates parameterized SQL; monitor heap, no client adaptation. | Runbook step: observe memory |
| [6.2.0]: Scalar-subquery predicate pushdown | Q can change plans; expected same semantics. | Preflight check: real query comparison |
| [6.2.0]: hyperloglog state memory reduction | No SQL hyperloglog caller found. | None |
| [6.2.0]: DNS SRV falls back to TCP | B Compose uses seed hosts; actual discovery settings inventory required. | Preflight check |
| [6.2.0]: New schema DDL, UUID, multicolumn EXISTS, ALTER timeout, sys/JMX fields | Additive; W/M do not require new syntax. Do not introduce it into 5.10-compatible patch. | None |
| [6.2.0]: More specific HTTP error codes | W matches explicit recoverable types/messages/status, not every server error. | Preflight check: existing error suites |
| [6.2.1]: Dynamic object-array mixed-null insert fixed | T active object payloads; selected 6.2.11 includes correction. | Preflight check: representative payloads |
| [6.2.1]: Child NOT NULL enforced in object arrays | T strict items; invalid payloads should fail, not be accepted. | Preflight check: fixture constraints |
| [6.2.1]: UDF requires schema DQL | B found no Crate UDF caller/DDL. Actual UDF inventory remains necessary. | Preflight check |
| [6.2.1]: Cached-query memory accounting fixed | W query load benefits; no API change. | Runbook step: memory observation |
| [6.2.1]: Ignored-object UNNEST missing-child behavior fixed | T/Q; false unknown-key setting returns NULL, default throws. No dependence on ClassCastException found. | Preflight check: object access |
| [6.2.1]: Empty node-setting values get clearer errors | H startup flags use explicit values; never silently drop invalid setting. | Preflight check: actual argv/config |
| [6.2.1]: Anti-join OR/boolean result fix | Q query patterns need correctness comparison; no workaround retained in code. | Preflight check |
| [6.2.1]: Reserved-schema CREATE/DROP blocked | B found no such DDL against reserved schemas. | None |
| [6.2.1]: Nested UNNEST object-path resolution fixed | T/Q; selected target includes fix; no data rewrite inferred. | Preflight check: nested fields |
| [6.2.1]: Null-created dynamic child later accepts typed values | T dynamic schemas; selected target includes fix. | Preflight check: typed writes |
| [6.2.2]: ALTER supports undefined dynamic columns | T plus runbook table-setting changes; target includes fix. | Preflight check: actual table metadata |
| [6.2.2]: topk NULL no longer throws | Q scan found no SQL topk. | None |
| [6.2.2]: Window SUM NULL handling fixed | Q scan found no SQL window SUM. | None |
| [6.2.2]: Mixed-5.10 SWAP/DROP metadata corruption fixed | B; no direct 5.10→6.2 rolling jump planned. | Runbook step: staged path and schema freeze |
| [6.2.2]: Old partition SWAP migration fixed | B; old metadata must still be inventoried. | Preflight check |
| [6.2.2]: Distributed circuit-break cancellation no longer sticks | Q/W distributed load; independent of proving #644 fully solved. | Runbook step: memory/task monitoring |
| [6.2.2]: KILL ALL works under memory pressure | No production KILL authorized or prescribed. | None |
| [6.2.2]: Unknown table-function subpaths honor unknown-key setting | T; selected target fixes 6.0 regression. | Preflight check: object reads |
| [6.2.2]: Ignored nested arrays accept incompatible child shapes again | T ignored objects exist; representative payloads, no blanket coercion. | Preflight check |
| [6.2.2]: Heavy cache structures released | W active queries; no client API change. | Runbook step: heap observation |
| [6.2.3]: BLOB endpoint memory leak fixed | H active BLOB reader/writer. | Runbook step: BLOB/heap verification |
| [6.2.3]: Failed HTTP authentication session leak fixed | H wrong/missing-password checks; no credential change required. | Preflight check |
| [6.2.3]: HTTP response-send errors reach clients | W distinguishes unavailable reads and indeterminate writes. | Preflight check: failover tests |
| [6.2.4]: PG bulk response ordering fixed | W HTTP bulk primary; pg administration canary covers pinned client. | Preflight check |
| [6.2.4]: Ignored-key correlated subquery ClassCast fixed | T/Q; no reliance on wrong failure. | Preflight check: query comparison |
| [6.2.4]: Concurrent partition deletion/insert RelationUnknown fixed | B schema changes frozen during mixed versions. | Runbook step |
| [6.2.5]: HAVING aggregate placeholders fixed | No active SQL HAVING-placeholder aggregate caller found. | None |
| [6.2.5]: Subscription recovery after shard relocation fixed | B found no logical-replication DDL. | Preflight check: publication/subscription inventory |
| [6.2.6]: Pre-5.5 metadata corruption fixed | Mandatory patched-stage selection; fresh-schema lab did not cover historical metadata. | Runbook step: use 6.2.11 |
| [6.2.7]: PG prepared idle time no longer expires statements | Pinned pg clients; no HTTP behavior change. | Preflight check: client canary |
| [6.2.8]: sys.allocations resize race fixed | M; do not resize during rolling upgrade. | Runbook step |
| [6.2.8]: Bulk throughput regression fixed | W active bulk; earlier 6.0/6.1 stages can be slower. | Runbook step: load/timeout observation |
| [6.2.8]: sys.snapshots concurrent-DDL race fixed | B actual helper/monitor query; schema-changing jobs still frozen. | Runbook step |
| [6.2.8]: Distributed aggregate/join OOM fix | Q/W; no memory-limit relaxation justified. | Runbook step: memory observation |
| [6.2.8]: BLOB HTTP authorization enforced | H search role historically lacks blob grant; table-grant failure reproduced. | Preflight check + owner-approved runbook grant policy |
| [6.2.9]: Remote UDF metadata resolution fixed | B no active UDF/replication found. | Preflight check: metadata inventory |
| [6.2.9]: Persisted UUID mappings start correctly | T no new UUID schema dependency required. | Preflight check: actual columns |
| [6.2.9]: CREATE/DROP SNAPSHOT stuck-query regression fixed | B active helper; target includes fix, earlier stages need independent completion checks. | Runbook step |
| [6.2.9]: Heavy cache retention fixed | W active load. | Runbook step: heap observation |
| [6.2.9]: Partition COUNT handles unavailable shards | Q/W; read error behavior can improve, never waive health gate. | Preflight check |
| [6.2.10]: Failed DECLARE query no longer hangs | No Crate SQL DECLARE cursor caller found; Python DB-API cursor is different. | None |
| [6.2.11]: KILL/timeout cleanup leak fixed | W sets finite client deadlines; server timeout distinct. Does not prove #644 cure. | Runbook step: retain guarded stop/no KILL |
| [6.2.11]: Primary-key INSERT IllegalState fixed | W all catalog/auth keys; target includes fix. | Preflight check: fixed-key writes |
| [6.3.0]: Removed S3 canned_acl/proxy settings | B planned filesystem repo; actual repository type/options are authoritative. | Preflight check |
| [6.3.0]: Removed GCS token_uri | B no GCS helper configuration found. | Preflight check: actual repo options |
| [6.3.0]: Removed Azure location/secondary/suffix/timeout/proxy options | B no Azure helper configuration found. | Preflight check: actual repo options |
| [6.3.0]: ANALYZE serializes table processing | No active Crate ANALYZE job found; automatic/operator statistics may take longer. | Runbook step: no unplanned ANALYZE |
| [6.3.0]: Experimental top_consumer breaker policy added | Existing behavior remains default; preserve current setting. | Preflight check: actual settings |
| [6.3.0]: SWAP/RENAME avoids shard relocation | B; reverted in 6.3.6/6.4.1, so not target behavior. | Runbook step: never assume concurrent snapshot safety |
| [6.3.0]: Partition inserts survive SWAP/RENAME | B; source has no active SWAP; patch-level fixes matter. | Runbook step: schema freeze |
| [6.3.0]: S3 path-style URI default and region option | B fs-backed repository expected. | Preflight check: actual repo type |
| [6.3.0]: ORDER BY supports ignored child/null | T ignored columns present; additive capability, avoid new 5.10-incompatible SQL. | None |
| [6.3.0]: udt_name/udt_catalog populated | Existing connector introspection reads name/type, not these fields. | None |
| [6.3.0]: ALTER DEFAULT, CREATE LIKE, DROP CASCADE, comment-only/columnless SELECT, DEFAULT values, boolean predicates added | B/W not dependent on new forms. | None |
| [6.3.0]: view_column_usage, pg_sleep, privilege/regex/identifier functions and interval percentile added | Q scan found no new-function consumers. | None |
| [6.3.1]: ALTER COLUMN needs table DDL instead of superuser | B no active ALTER DEFAULT; current table grants suffice where applicable. | Preflight check: installed initializer rights |
| [6.3.1]: Empty statement no longer requires superuser | W no empty SQL dependence. | None |
| [6.3.1]: Azure default endpoint restored | B fs-backed repository expected. | Preflight check |
| [6.3.1]: HAVING parameter aggregation fixed | No active such Crate query found. | None |
| [6.3.1]: Relocated-publisher subscription recovery fixed | B no replication DDL found. | Preflight check |
| [6.3.2]: Allocation resize race fixed | M; target includes fix. | Runbook step: no resize |
| [6.3.2]: Multi-shard bulk throughput fixed | W; selected stage includes fix. | Preflight check: representative bulk |
| [6.3.2]: Idle prepared PG statement timeout fixed | W HTTP primary; PG canary. | Preflight check |
| [6.3.2]: Pre-5.5 metadata corruption fixed | Mandatory patched-stage gate. | Runbook step: use 6.3.7 |
| [6.3.2]: Partition INSERT interruption on SWAP/RENAME fixed | B; keep schema freeze. | Runbook step |
| [6.3.2]: Snapshot-monitor concurrent-DDL race fixed | B active helper. | Runbook step: independent snapshot verification |
| [6.3.2]: Distributed join/aggregate OOM fixed | Q/W active workload. | Runbook step: monitor heap |
| [6.3.2]: BLOB authorization enforced | H active search/BLOB path. | Preflight check + approved scope policy |
| [6.3.2]: Restore into existing closed table rejected | B restore runbook uses fresh directories; closed target is not a safe overwrite method. | Runbook step: fresh restore cluster |
| [6.3.3]: PG timestamp-without-zone text loses UTC offset | Runtime Crate uses HTTP epoch timestamps; pg source importer targets PostgreSQL, not Crate. | Preflight check: PG time canary; no blanket parser rewrite |
| [6.3.3]: Incompatible partition restore rejected | B cannot accept SQL acknowledgement alone or incompatible target schema. | Runbook step |
| [6.3.3]: PG multiple empty statements supported | No active Crate caller found. | None |
| [6.3.3]: Partial-shard restore now reports failure | B independent health/data verification remains mandatory, including disk watermarks. | Runbook step |
| [6.3.3]: Remote UDF resolution fixed | B no replication/UDF caller found. | Preflight check |
| [6.3.3]: UUID persisted mapping startup fixed | T actual column inventory gate. | Preflight check |
| [6.3.3]: Snapshot CREATE/DROP hang fixed | B active helper. | Runbook step: verify completion |
| [6.3.3]: Heavy cache retention fixed | W active workload. | Runbook step: memory observation |
| [6.3.3]: Partition COUNT unavailable-shard failure fixed | Q; do not treat improved retries as GREEN proof. | Preflight check |
| [6.3.4]: Fulltext analyzer after SWAP corrected | B/Q fulltext active but SWAP not found; stored analyzer inventory still required. | Preflight check |
| [6.3.4]: PG binary DATE codec corrected | W pinned pg canary, mostly HTTP runtime. | Preflight check |
| [6.3.4]: PG binary NUMERIC codec corrected | No Crate NUMERIC schema found; source PostgreSQL NUMERIC is separate. | Preflight check: actual columns |
| [6.3.4]: Failed DECLARE no longer hangs | No SQL DECLARE cursor caller found. | None |
| [6.3.5]: Primary-key INSERT state failure fixed | W actual-key inserts. | Preflight check |
| [6.3.5]: JWT key alg authentication accepted | H uses password; no Crate JWT HBA found. | Preflight check: actual HBA |
| [6.3.5]: S3 COPY region regression fixed | B no active Crate S3 COPY. | None |
| [6.3.5]: HBA pg protocol matching fixed | H baseline applies password to all protocols; preserve flags. | Preflight check: actual HBA + PG |
| [6.3.5]: Repository verification errors clarified | B; never treat clearer message as successful backup. | Runbook step |
| [6.3.5]: KILL/timeout leak fixed | W/#644; no production KILL authorized. | Runbook step: task/memory observation |
| [6.3.5]: mean(DISTINCT) alias fixed | No SQL mean caller found; Python/JS means excluded. | None |
| [6.3.6]: SWAP/RENAME reallocates again; snapshots can abort | B explicit snapshot/schema-job coordination required on selected 6.3.7. | Runbook step |
| [6.3.6]: pg_sleep SELECT corrected | No caller found. | None |
| [6.3.6]: Foreign REGCLASS fixed | B no FDW/REGCLASS caller found. | Preflight check: metadata inventory |
| [6.3.7]: Concurrent INSERT/SWAP wrong-target race fixed | B/W; do not add concurrent SWAP to rehearsal or production run. | Runbook step |
| [6.3.7]: Analyzer filter order preserved | No Crate CREATE ANALYZER source found; custom stored definitions need inventory. | Preflight check |
| [6.3.7]: Floating SUM group overflow corrected | Q uses aggregate reads; no intentional NaN dependence found. | Preflight check: result comparison |
| [6.3.7]: Foreign-query UnsupportedOperation fixed | B no active FDW found. | Preflight check |
| [6.3.7]: Old-table REGCLASS OIDs corrected | No SQL REGCLASS consumer found. | None |
| [6.3.7]: Embedded FDW JDBC security update | This is server-internal JDBC, not npm pg; no client bump inferred. B lacks FDW use. | Preflight check: foreign-server inventory |
| [6.3.7]: Visibility/privilege OID functions corrected | H policy readback uses sys.privileges, not OID helper results. | None |
| [6.3.7]: Large-value deviation/variance corrected | Q found no SQL deviation/variance caller. | None |
| [6.3.7]: ARM64 S3 repository creation fixed | B fs-backed expected. | Preflight check: actual platform/repo |
| [6.3.7]: Aliased boolean join filters preserved | Q query correctness comparison, no workaround detected. | Preflight check |
| [6.3.7]: View alias ORDER BY/LIMIT fetch fixed | No active CREATE VIEW schema found; actual views inventory required. | Preflight check |
| [6.4.0]: gateway.auto_import_dangling_indices removed | No source setting match; actual startup/config inventory blocks if present. | Preflight check |
| [6.4.0]: Single-row INSERT coercion becomes strict | T explicit typed arrays/objects; arbitrary object→text-array no longer accepted. | Preflight check: representative typed payloads |
| [6.4.0]: HTTP args now supply guessed type hints | W/T broader than prior text-array example; NULL/timestamp/object/number canaries needed. | Preflight check: real parameterized queries |
| [6.4.0]: Larger write queue/fewer internal INSERT retries | W active bulk; can increase resident memory or alter rejection timing. | Runbook step: preserve app retry safety; watch heap/latency |
| [6.4.0]: Lookup-join LIMIT defers fetching | Q active joins; expected same result, workload benchmark needed. | Preflight check |
| [6.4.0]: Aggregation/sys.shards/scalar-subquery/to_char/UDF-write performance changes | Q/M additive optimization, no correctness workaround needed. | Runbook step: compare workload behavior |
| [6.4.0]: fix-metadata CLI removed | B no tool invocation source; unresolved legacy corruption must be fixed on 5.x first. | Preflight check |
| [6.4.0]: ALTER REPOSITORY, PG/catalog/type/function capabilities added | W/B remain on common 5.10 SQL; do not require newer syntax. | None |
| [6.4.0]: New sys session/state columns | M explicit columns; avoid cross-version SELECT-star assumptions. | Runbook step |
| [6.4.0]: remove-corrupted-data CLI added | No repair authorized; not rollback or upgrade step. | None |
| [6.4.1]: SWAP/RENAME again reallocates/interrupts snapshots | Same target-relevant reversal as 6.3.6. B. | Runbook step: freeze schema jobs during backup gates |
| [6.4.1]: pg_sleep SELECT corrected | No caller found. | None |
| [6.4.1]: Foreign REGCLASS fixed | B no active FDW found. | Preflight check |
| [6.4.2]: Concurrent INSERT/SWAP target fixed | B/W; selected target contains fix. | Runbook step: schema freeze |
| [6.4.2]: Analyzer filter order fixed | No Crate CREATE ANALYZER source found; inventory stored analyzers. | Preflight check |
| [6.4.2]: Floating SUM overflow fixed | Q no intentional NaN reliance found. | Preflight check |
| [6.4.2]: Foreign-query UnsupportedOperation fixed | B no active FDW found. | Preflight check |
| [6.4.2]: Old-table REGCLASS OIDs corrected | No active REGCLASS consumer found. | None |
| [6.4.2]: Embedded JDBC 42.7.13 security update | B no FDW found; does not replace installed npm/Python inventory. | Preflight check |
| [6.4.2]: OID visibility/privilege helpers corrected | H sys.privileges remains authority. | None |
| [6.4.2]: Large-value deviation/variance fixed | Q no active SQL caller. | None |
| [6.4.2]: ARM64 S3 repo creation fixed | B expected fs repository. | Preflight check |
| [6.4.2]: Aliased bare-boolean join filter fixed | Q real-query comparisons. | Preflight check |
| [6.4.2]: View alias/LIMIT fetch duplication fixed | Actual view inventory needed; no source CREATE VIEW found. | Preflight check |
| [6.4.3]: Bulk unavailable-shard errors move to per-item results | W checks error/error_message/negative counts and response length. No new patch required. | Preflight check: bulk partial-failure suite |
| [6.4.3]: Usermanagement restore additionally needs cluster AL | B use authorized restore operator; backup identity must not gain AL. | Runbook step |
| [6.4.3]: HTTP authenticates each request, not each connection | H already sends Basic per request including BLOB redirect. | Preflight check: keepalive/wrong-password tests |
| [6.4.3]: PG unauthenticated connection timeout | H clients authenticate immediately; not a SQL runtime timeout. | Preflight check: PG identity |
| [6.4.3]: PG unauthenticated message size capped | H no client expects large unauthenticated payloads. | None |
| [6.4.3]: COPY FROM file restricted to superusers | B no active Crate file COPY source; old scripts/operators must not assume DDL suffices. | Preflight check: restore/reindex operator identity |
| [6.4.3]: X-Real-IP local-address HBA spoof fixed | H inventory `auth.trust.http_support_x_real_ip`; preserve trusted loopback; no proxy-trust relaxation. | Preflight check |
| [6.4.3]: UPDATE/DELETE subqueries require source DQL | H schema DQL grants already expected; auth-table DENYs retained; W uses direct-key CAS. | Preflight check: privileges by actual query identity |
| [6.4.3]: Integral window RANGE cast fixed | Q no active window frame. | None |
| [6.4.3]: Nested IS NULL partition pruning corrected | T actual partition inventory plus query comparison. | Preflight check |
| [6.4.3]: Window FILTER/NULL aggregation fixed | Q no active window aggregate. | None |
| [6.4.3]: Aggregate OOM accounting corrected | Q active aggregate load. | Runbook step: heap/circuit-break observation |
| [6.4.3]: RANGE FOLLOWING/NULL aggregate crash fixed | Q no active window aggregate. | None |
| [6.4.3]: Single-row window string_agg crash fixed | Q no SQL string_agg. | None |
| [6.4.3]: Window SUM trailing NULL result fixed | Q no window SUM. | None |
| [6.4.3]: Unreachable-node task memory leak fixed | W distributed node-loss handling; new Coordinator-message shape is covered by the prep patch. | Code change: both roles tested in webapp/operator classifier, deployment required |
| [6.4.3]: DESC window RANGE boundaries corrected | Q no active window frame. | None |
| [6.4.3]: Empty-prefix starts_with matches nonnull rows | No active SQL starts_with caller found; JS startsWith unrelated. | None |
| [6.4.3]: INDEX OFF low-precision NUMERIC ranges fixed | T no NUMERIC schema found; production types inventory needed. | Preflight check |
| [6.4.3]: Extreme round precision bounded | Q no SQL extreme-precision round found. | None |
| [6.4.3]: CREATE USER persists session settings | H no user recreation planned; actual per-user settings preserved. | Preflight check |
| [6.4.3]: UNION/order-by unselected-column result fixed | Q UNION active; compare actual result shape. | Preflight check |
| [6.4.3]: Only outermost join distributed | Q multiple-join plans may slow, including details queries; tiny fixture not peak benchmark. | Preflight check: real-query latency |
| [6.4.3]: Framed rank/dense_rank results fixed | Q no active SQL rank frame. | None |
| [6.4.3]: OUTER JOIN/subquery result fixed | Q no wrong-result workaround retained; real query comparison. | Preflight check |
| [6.4.3]: lag/lead dynamic offset/default respected | Q no active SQL lag/lead. | None |
| [6.4.4]: Bit parameter CREATE VIEW fixed | No active bit-column/view schema found. | None |
| [6.4.4]: Omitted default primary key routes correctly | W explicit keys; T defaults are non-key fields in reviewed schemas. Does not repair old misrouted rows. | Preflight check: actual generated/default keys |
| [6.4.4]: PG multi-statement command tags corrected | W HTTP primary; no tag-dependent Crate batch logic found. | Preflight check: PG client |
| [6.4.4]: UNION/order-by extra-column error fixed | Q active UNION patterns. | Preflight check: query shape |
| [6.4.4]: Nondeterministic filters no longer pushed below aggregates/windows/functions | Q no explicit workaround found; random SQL must be compared where present. | Preflight check |
| [6.4.4]: array_agg/DISTINCT memory accounted | Q `dna.server.ts:80`; can trip breakers sooner rather than silently overuse heap. | Runbook step: observe memory and query failures |
| [6.4.4]: Regex on INDEX OFF matches correctly | No active Crate regex-filter SQL found; T contains INDEX OFF storage. | Preflight check: dormant query inventory |
| [6.4.4]: force=false survives decommission health timeout | Directly relevant guarded shutdown; earlier intermediates still need external zero-primary/no-missing check. | Runbook step: keep external guard |
| [6.4.4]: Uncorrelated join-subquery error clarified | Q matching reads should fail meaningfully; no error-string branch found. | None |
| [6.4.4]: Correlated bare-boolean join filter preserved | Q result-correctness gate. | Preflight check |
| [6.4.4]: Framed array_agg corrected | Q plain array_agg active; no OVER frame found. | None |
| [6.4.4]: NULL ALL empty-array yields TRUE | Q array predicates may use empty input; compare edge cases. | Preflight check |
| [6.4.4]: string_agg memory accounted | Q no SQL string_agg caller. | None |
| [6.4.4]: Framed string_agg dynamic delimiter corrected | Q no SQL string_agg window. | None |
| [6.4.4]: NULL ANY empty-array yields FALSE | W bound array filters require empty-list edge checks. | Preflight check |
| [6.4.4]: UNION numeric widening corrected | Q active UNION; no compensating casts need removal. | Preflight check |
| [6.4.4]: False aggregate breaker regression fixed | Q active aggregate queries; select patched6.4.6. | Runbook step |
| [6.4.4]: CREATE SNAPSHOT hang fixed | B active helper; independently verify completion. | Runbook step |
| [6.4.5]: Invalid JWT returns401 instead of500 | H uses password; W already treats401 as authentication failure. | None |
| [6.4.5]: Cross/equijoin repeated-relation filter corrected | Q no deliberate wrong-result dependence. | Preflight check |
| [6.4.5]: Cross/outer/multiple-join conditions preserved | Q plans/results need real comparison. | Preflight check |
| [6.4.5]: Bit widening zero-pads correctly | No Crate bit-column schema found. | None |
| [6.4.5]: NULL-to-bit cast fixed | No Crate bit-column schema found. | None |
| [6.4.5]: Parent/local relation-alias collision fixed | Q dynamic queries need comparison; no workaround removed. | Preflight check |
| [6.4.5]: PG interval text decoding corrected | No Crate interval-write schema found; pg canary remains. | None |
| [6.4.5]: Percentile memory leak fixed | Q no SQL percentile caller. | None |
| [6.4.5]: Heavy query-cache structures released | W active load. | Runbook step: heap observation |
| [6.4.5]: Correlated-subquery GROUP BY planning fixed | Q actual SQL comparison; no application repair needed. | Preflight check |
| [6.4.5]: Azure snapshot slowdown fixed | B fs expected; no benefit asserted for filesystem snapshots. | None |
| [6.4.5]: Missing-column relation/privilege error identity fixed | W does not parse missing-column relation names into security decisions. | None |
| [6.4.5]: Padded CHAR hash joins corrected | T uses TEXT, not fixed CHAR, in reviewed schema. | Preflight check: actual columns |
| [6.4.6]: PG pipelined write/read descriptions corrected | W HTTP primary; pinned pg canary. | Preflight check |
| [6.4.6]: UUID/NUMERIC ANY/IN corrected | T no such schema found; actual column inventory gate. | Preflight check |
| [6.4.6]: Pre-epoch timestamp→date rounding corrected | W HTTP timestamp canaries; catalog dates can precede1970. | Preflight check: historical-date samples |
| [6.4.6]: Ordered UNION array/string aggregation corrected | Q plain array_agg/UNION exist, not confirmed combined pattern. | Preflight check |
| [6.4.6]: Integral RANGE frame overflow fixed | Q no active window frame. | None |
| [6.4.6]: Frame NULL/negative offsets rejected; overflow fixed | Q no active explicit window frame. | None |
| [6.4.6]: Snapshot creation tolerates transient DELETE failure | B active helper; still fail on unverified snapshots. | Runbook step |
| [6.4.6]: numeric_scale reflects type | Connector reads column_name/data_type, not numeric_scale. | None |
| [6.4.6]: Foreign restore limited to requested sections/servers | B no FDW source found; actual foreign table/server inventory required. | Runbook step: explicit restore sections |
| [6.4.6]: Query-breaker state reset race fixed | W active load; no KILL required to demonstrate upgrade success. | Runbook step |
| [6.4.6]: EXPLAIN ANALYZE race fixed | No ongoing EXPLAIN ANALYZE maintenance planned. | None |
| [6.4.6]: Publisher-restart partition replication fixed | B no active logical replication found. | Preflight check |
| [6.4.6]: AL/superuser sees all publications | B actual metadata inventory should use trusted operator identity. | Preflight check |
| [6.4.6]: Geo distance comparisons exclude NULL correctly | Q no Crate geo distance caller found. | None |
| [6.4.6]: Geo distance NULL queries no longer crash | Q no Crate geo distance caller found. | None |
| [6.4.6]: ORDER BY preserves Infinity | T numeric DOUBLE fields exist; no intended Infinity fixture found. | Preflight check: numeric result boundaries |
| [6.4.6]: Password HTTP performance regression corrected | H/W all deployed password clients; final target avoids6.4.3 regression. | Runbook step: compare real latency |
| [6.4.6]: NaN range matching corrected | No intended NaN catalog values found; no client coercion introduced. | Preflight check: data anomalies |
| [6.4.6]: Headerless certificate-auth user preserved | H uses explicit Basic, no Crate certificate HBA source found. | Preflight check: actual HBA |

[6.2.0]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.0.html
[6.2.1]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.1.html
[6.2.2]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.2.html
[6.2.3]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.3.html
[6.2.4]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.4.html
[6.2.5]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.5.html
[6.2.6]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.6.html
[6.2.7]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.7.html
[6.2.8]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.8.html
[6.2.9]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.9.html
[6.2.10]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.10.html
[6.2.11]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.2.11.html
[6.3.0]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.0.html
[6.3.1]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.1.html
[6.3.2]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.2.html
[6.3.3]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.3.html
[6.3.4]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.4.html
[6.3.5]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.5.html
[6.3.6]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.6.html
[6.3.7]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.3.7.html
[6.4.0]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.0.html
[6.4.1]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.1.html
[6.4.2]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.2.html
[6.4.3]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.3.html
[6.4.4]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.4.html
[6.4.5]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.5.html
[6.4.6]: https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/6.4.6.html


### Explicit corrections to the earlier review and rehearsal limits

- **The earlier review was selective, not an exhaustive release-note audit.** The tables now cover every
  release on the path, including correctness, memory, authentication, shutdown and restore fixes that had
  been absent from the earlier high-level summary.
- **`_version` has active callers**, notably feedback and correction OCC. The earlier auth-only discussion
  missed these. It remains documented in [6.4 system columns](https://cratedb.com/docs/crate/reference/en/6.4/general/ddl/system-columns.html),
  so deprecation does not require changing semantics as part of this upgrade. These stores deserve a
  positive compatibility canary and a later deliberately tested OCC migration; the original fixture's
  auth/typed-room CAS tests do not qualify every feedback/correction flow.
- **Snapshot hangs were already backported to6.0.7**, included in selected6.0.8. Naming only6.1.6 implied
  an unnecessary known-bug interval. Snapshot checks remain mandatory despite the fix.
- **The MADV_RANDOM workaround is not needed on selected6.1.6+**:6.1.3 defaults to NORMAL and6.2 removes
  that need. Do not add a permanent fleet-wide JVM flag from the6.0 warning. The first6.0.8 stage still
  needs actual I/O/recovery observation.
- **SWAP/RENAME snapshot safety was reverted in6.3.6/6.4.1.** Selected6.3.7 and6.4.6 can again abort
  snapshots on these operations. Keep schema-changing/swap/rename jobs held through snapshot gates;
  do not infer safety from6.3.0's original improvement.
- **HTTP parameter inference changed more broadly than ARRAY(TEXT)** in6.4.0. Typed text/object arrays,
  NULLs, timestamps and numeric parameters must be exercised through actual installed clients. The earlier
  fixture's selected canaries do not exhaust dynamic ingester payloads or historic driver versions.
- **Authentication/privilege changes go beyond BLOB:**6.4.3 authenticates every HTTP request, limits
  unauthenticated PG messages/connections, restricts file COPY FROM to superusers, closes X-Real-IP trust
  bypasses, requires source DQL for UPDATE/DELETE subqueries and adds AL authority for USERMANAGEMENT
  restore. Current HTTP transports send Basic per request; no active Crate file COPY/UDF/FDW source was
  found. External clients/operators and actual grants/settings remain read-only preflight gates.
- **Restore success/failure behavior became stricter:**6.3.2 refuses existing closed targets;6.3.3 rejects
  incompatible partitions and reports partial-shard failure. Fresh directories plus explicit sections,
  data checks and independent GREEN health are required; an HTTP acknowledgement is insufficient.
- **Shutdown/load timing needs correction:**6.4.4 fixes force=false handling when decommission's health
  wait times out; keep the independent zero-primary/no-missing-primary gate on all intermediates.6.4.0's
  larger write queue/fewer retries and6.4.3's nested-join distribution change need load/latency observation.
  The6.4.6 target includes the password-auth HTTP performance regression fix and historical-date rounding
  fixes; neither was established by toy-throughput measurements alone.
- **Windows are active Crate SQL**, especially social ranking row_number queries. No explicit RANGE/window
  aggregate frame was found, so those many fixes do not mandate source rewrites, but the full audit does
  not claim the application is window-free.

The only confirmed mandatory source compatibility change from this release audit is node-loss message
classification, extended narrowly to both Participating/Coordinator roles. Other changes above produce
explicit preflight/runbook gates or no action where the affected SQL feature is absent. Do not use the
absence of a confirmed source break as authorization to change production grants/settings or to waive
an unverified metadata/client gate.

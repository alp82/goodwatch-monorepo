# Q65 read-only follow-up: backups and the mixed 5.10/6.0 cluster

Investigation on **October 27, 2026, 23:36–23:46 UTC**, after Q64's first-node stop. Starting main
`1a360fc17`; branch `fix/644-mixed-cluster-readonly-diagnosis`. **No production mutation, restart,
JVM attachment, service start, snapshot/registration change, table change, job hold or scheduled
operation was performed. No action is armed.** SELECT queries, HTTP GET probes, logs/configuration
reads and stable read-only copies of persisted metadata were used. The copies were decoded locally;
no Crate node was started. Raw metadata remains private in `~/.cache/gw-work/644-q65` and is not committed.

[Source investigation and reproduction](q65-upstream.md), [sanitized evidence](q65-evidence.json.gz),
[decoded state comparison](q65-metadata-comparison.json), [summary](q65-summary.json).

## 1. Backups: no failed run yet; the next writer is currently missing

**Correction to Q64's wording:** a broken future backup route is not evidence that a scheduled run
has already failed. At this investigation's cutoff, the logs have **no failed hourly run since
the last successful22:05 run**. The23:05 invocation was deliberately suppressed by the approved
cron hold, not attempted and failed. The next scheduled invocation is00:05 UTC onOctober28;
it has not happened at this report's cutoff. No CREATE was sent merely to demonstrate its error.

| Event | Exact UTC evidence |
| --- | --- |
| Last hourly SUCCESS | `hourly_20261027_220501`: started22:05:02.393, finished**22:05:38.217**,567shards, no failures; identical on all three coordinators, now under read-only alias`goodwatch-pre6` |
| Helper finished last hourly run | Created acknowledgement22:05:40; retention finished22:06:25; verification and `Backup run finished.` at**22:06:43** |
| Latest verified recovery snapshot | Protected`goodwatch-pre6.q53_pre6_20261027`, finished**23:02:34.012**,567shards/no failures; verified on all three |
| Cron hold |23:01:51.608–23:28:54.889, so23:05 was skipped; journal contains20:05/21:05/22:05 invocations, no23:05 backup invocation |
| V2 name removed | Q64 preparation step3: `DROP REPOSITORY "goodwatch-db-backup-v2"` acknowledged**23:10:01.496**; replacement read-only alias`goodwatch-pre6` acknowledged23:10:02.270 |
| Cron restored |23:28:54.889, exact original SHA256`374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37` |
| Failing runs/errors after22:05 | **None observed; no attempted23:05 run**. Missing repository is a predicted failure of00:05, not an observed error message |

This was introduced **tonight**, while all nodes were still5.10.16, to protect the pre-upgrade
repository. It did not predate Q64. The plan intentionally deferred a new V2 registration until
homogeneous6.0; the first-node abort prevented that step. Restoring cron at handover followed the
latest GO, but could not make its hardcoded writer name exist.

Repositories are **cluster-wide registrations**, not separate objects to create on each node.
All three coordinators agree:

| Name | Type | Location | Options | Meaning |
| --- | --- | --- | --- | --- |
| `goodwatch-pre6` | fs | `/snapshots/v2` | `readonly=true,compress=true` | Protected original V2 files/snapshots, including22:05 and23:02 |
| `goodwatch-db-backup` | fs | `/snapshots` | `readonly=true,compress=true` | Older legacy root repository; made read-only at23:10:03.979 |
| `goodwatch-db-backup-v2` | **Absent** | None | None | Name hardcoded by hourly helper and backup-health monitoring; there is no writable registration at this name |

The helper [configuration](../../../../../goodwatch-crate/backup.py) names V2 and sends
CREATE SNAPSHOT before cleanup. An absent registration prevents that CREATE; the helper then logs
snapshot creation failure and exits before retention or verification. Its error logging intentionally
prints HTTP exception type rather than server response bodies, so do not invent an observed SQL error.
The source validates repository existence before snapshot creation. [Repository mechanics and exact source](q65-upstream.md#snapshot-repository-mechanics-and-smallest-sql-only-candidate).

### Smallest recommended repair — proposal only, requires owner approval

A direct CREATE at`/snapshots-v6` cannot work yet: **only crate-02** has that mount and path.repo
allowlist; crate-01/03 allow only`/snapshots`. All3 still mount the same shared source at`/snapshots`
read-write. The proposed new directory does not exist onany node. Shared source hashes/mount facts
and filesystem capacity are retained in the evidence: all three report the same source hash and **1,135,049,834,496 available bytes** (about1.03TiB). Read-only inspection does not substitute for
actual repository write verification once a change is approved.

After fresh GREEN/no active snapshot/no concurrent backup-helper gates, record exact registrations
and confirm protected`goodwatch-pre6` stillread-only. If separately approved, send **one statement
at a time through the runbook's crate_sql recipe**, once for the cluster, not three times:

```sql
-- PROPOSED ONLY. Not executed, scheduled or armed by Q65.
DROP REPOSITORY "goodwatch-db-backup";
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs WITH (
    location='/snapshots/q65-mixed-20261027',
    compress=true,
    readonly=false
);
```

1. DROP unregisters the **read-only old root alias only**; it deletes no snapshot/file. Its old files
   remain, but their old SQL alias disappears until deliberately restored.
2. CREATE establishes the missing writer name in a **new shared sibling** of protected`/snapshots/v2`,
   within all three existing allowlists. The parent root registration is removed first to avoid overlapping
   registered repository roots. **Do not restore the parent alias while this child writer is active.**
   Do not fall back to writing the protected`/snapshots/v2` or legacy root if verification fails.

Read back exact registrations/options via all coordinators. The CREATE's normal fs verification must
succeed across the nodes; any permission/shared-path failure is a stop, not permission to restart
or change the path allowlist. Then, only if the owner also approves the validation snapshot and it
will not collide with the hourly helper, choose an unused name and execute:

```sql
-- Separate proposed validation, also NOT executed.
CREATE SNAPSHOT "goodwatch-db-backup-v2".q65_mixed_validation_20261027 ALL
WITH (wait_for_completion=true);
SELECT repository,name,state,total_shards,failures FROM sys.snapshots
WHERE repository='goodwatch-db-backup-v2'
  AND name='q65_mixed_validation_20261027';
```

Require SUCCESS/no failures/current expected shard count on all three, preserved old read-only alias/options,
and normal pages. Then observe the next real cron run's creation/retention/verification completion
before claiming hourly backups repaired. Do not directly run the full helper as a test: it also
performs retention deletions. Its normal cron retention will affect only the new repository because
the expected name points there. The protected snapshot's name is not an hourly/daily retention target.

**Risks and limits:** first full snapshot I/O/space in a new repository; fs permissions/shared visibility;
loss of the legacy root SQL alias; and **unproven mixed-snapshot restore compatibility**. The source does
not categorically prohibit mixed snapshot creation, but official guidance normally holds backups during
active upgrading and creates the new repository after upgrading. This is a separate interruption-recovery
exception requiring approval. Treat the new snapshot as a forward6.x recovery candidate, **not** a
replacement for the protected5.10 rollback target; newer shard segments may not restore to5.10 even if
snapshot metadata advertises an older compatibility version. A successful CREATE is not a restore test.
No new grants, replica changes, node stop or production restore is part of this proposal.

**Recommendation:** approve this isolated writer repair plus one validation snapshot, rather than
reopening either protected repository for writes or leaving cron predictably broken. Leave the23:02
snapshot+BLOB pair untouched. If the owner defers repair, explicitly accept the growing RPO and expected
00:05 failure; no successful post23:02 recovery point has been established.

## 2. Wait discrepancy: persisted dual metadata, index enforcement still3

Live queries through all coordinators at23:39:48–49 report **cluster_state_version1144863 for every
node**. The master iscrate-03. Stable copies of each node's `_state` files were read without touching
their locks or starting/attaching a JVM; before/after file hashes matched. Local Lucene DirectoryReader
plus matching Crate6.0.8 jars decoded only whitelisted settings/counters. Persisted accepted state
**1144863 and term1419 match on all three**, and agree with the later live queries.

| Representation, all 14 tables | crate-01/5.10 | crate-02/6.0 | crate-03/5.10 |
| --- | --- | --- | --- |
| Legacy IndexMetadata | **wait 3**, replicas 2, write-block false | **wait 3**, replicas 2, write-block false | **wait 3**, replicas 2, write-block false |
| New RelationMetadata.Table | Not present in5.10 format | **wait 2**, replicas 2, write-block false | Not present in5.10 format |
| information_schema settings |3 |2 |3 |

Every table's index UUID and legacy settings-version/index-version counters agree across nodes.
This is **not split-brain or different accepted cluster-state epochs**. It is a stale **persisted6.0
relation representation** within an otherwise current index-level state, not just text formatting or
only a volatile cache. Local metadata-version counters differ across major representations and must
not be mistaken for coordination versions. The decoded JSON and source explanation are retained.

The6.0 upgrade code initializes relation metadata when an index arrives, but does not refresh an
already-present relation containing the same index UUID after a pre6.0 master sends a legacy index
settings diff. The6.0 table-info factory reads that stale relation's settings. Sending the same ALTER
through6.0 still forwards it to the5.10 master and does not solve the representation mismatch.
This is a source-supported explanation matching the observed persisted state, not a claim of an
upstream-fixed issue/version. [Exact migration/cache source](q65-upstream.md#persisted-metadata-proves-a-dual-representation-discrepancy).

**Normal SQL write enforcement:** upsert/delete requests inherit the default active-shard requirement;
the replication action resolves it from **IndexMetadata**, not the stale table-info settings. IndexMetadata
is3 onall nodes, so the production evidence plus exact source support **restored wait 3 enforcement**.
This corrects Q64's uncertainty about whether enforcement might still be2. No production write or
missing-copy experiment was performed. [Request, resolution and replication check source](q65-upstream.md#which-wait-normal-sql-writes-enforce).

**Recommendation:** do not repeat ALTER/RESET or restart to repair the displayed2. Preserve the index-level
wait 3 and existing copies. Treat the broader stale relation model seriously for planning/schema changes;
this audit did not compare every column/property of all 145 relations. When a homogeneous transition is
separately approved, verify both representations and explicitly review any required reconciliation before
further upgrades. Reapplying original settings once a6.x master controls homogeneous metadata is a
candidate to rehearse, not a repair executed or armed here.

## 3. Check3: exact message and meaning

Exact `description` returned bycrate-02, with id3/passedfalse/severity1:

```text
The following tables need to be recreated for compatibility with future major versions of CrateDB: [doc.yepwatch_candidate, doc.yepwatch_member_intent, doc.auth_oauth_client, doc.streaming_service, backup_20260925_deleted_titles.person_appeared_in, backup_20260925_stale_child_rows.streaming_availability, backup_20260925_stale_child_rows.release_event, doc.feedback_report, doc.search_index_builds, doc.user_wishlist, doc.season_translation, backup_20260925_stale_child_rows.media_video, doc.anime_mapping_snapshot, doc.user_score, backup_20260925_stale_child_rows.alternative_title, doc.auth_user, doc.auth_oauth_client_assertion, blob.search_index_files, doc.search_terms, doc.streaming_availability, doc.crawl_priority, backup_20260925_deleted_titles.release_event, doc.movie_series, doc.episode_translation, doc.metacritic_season, doc.auth_account, doc.availability_history, doc.buzz_pageview, doc.translation, doc.buzz_title, doc.auth_user_email, doc.search_shadow, doc.discord_together, doc.social_relevance, doc.auth_oauth_refresh_token, doc.episode, backup_20260925_deleted_titles.streaming_evidence, doc.person_appeared_in, doc.user_list, doc.trope, backup_20260925_deleted_titles.translation, backup_20260925_stale_child_rows.person_appeared_in, doc.search_control, doc.yepwatch_invitation, doc.yepwatch_agreement, backup_20260925_stale_child_rows.movie, doc.media_video, doc.imdb_episode, doc.yepwatch_runtime, doc.language, doc.workflow_monitoring, doc.trope_catalog_reference, doc.yepwatch_vote, backup_20260925_deleted_titles.media_image, doc.profile_tropes_snapshot, doc.search_spending, doc.search_embedding_state, doc.user_setting, doc.timezone, backup_20260925_deleted_titles.trope, doc.user_avatar, doc.auth_oauth_resource, doc.person, doc.social_title_link, doc.person_worked_on, backup_20260925_stale_child_rows.season, doc.auth_oauth_client_resource, doc.user_import_item, doc.buzz_snapshot, doc.yepwatch_participant, doc.auth_rate_limit, doc.catalog_correction_event, doc.search_history, doc.show, backup_20260925_deleted_titles.show, doc.network, doc.yepwatch_decision, doc.yepwatch_proposal, doc.user_list_exposure, doc.imdb_season, doc.streaming_evidence, doc.genre, doc.season, doc.user_mcp_action, doc.social_ingest_run, doc.auth_jwks, doc.yepwatch_room, doc.production_company, doc.yepwatch_control, doc.social_image, doc.social_content_quality, doc.yepwatch_command_receipt, doc.yepwatch_ticket, doc.auth_oauth_consent, doc.auth_verification, doc.social_post, doc.user_favorite, doc.feedback_screenshot, doc.auth_oauth_access_token, doc.yepwatch_member_grant, doc.search_interpretations, doc.media_image, backup_20260925_stale_child_rows.media_image, doc.discord_guild, backup_20260925_stale_child_rows.streaming_evidence, backup_20260925_stale_child_rows.translation, doc.search_embedding_inputs, backup_20260925_deleted_titles.season, backup_20260925_deleted_titles.media_video, doc.buzz_signal_mapping, doc.auth_session, doc.age_certification, backup_20260925_stale_child_rows.person_worked_on, doc.user_profile, doc.alternative_title, doc.trope_catalog, doc.user_episode_score, doc.social_link_report, doc.rotten_tomatoes_season, doc.auth_capacity, backup_20260925_stale_child_rows.show, doc.user_import_connection, backup_20260925_deleted_titles.movie, doc.trope_catalog_page, backup_20260925_deleted_titles.person_worked_on, doc.availability_history_before_682, doc.user_watch_state, doc.country, doc.release_event, doc.user_handle, doc.buzz_score, backup_20260925_deleted_titles.streaming_availability, doc.catalog_correction, backup_20260925_deleted_titles.alternative_title, doc.user_not_interested, doc.movie, doc.job, backup_20260925_stale_child_rows.trope, doc.user_skipped, doc.buzz_signal_run, doc.user_discord_link, doc.user_import, doc.buzz_trending, doc.buzz_signal, doc.user_watch_log] https://cr8.is/d-cluster-check-3
```

The list contains145 tables, including the BLOB and retained backup schemas. The exact6.0.8 source
uses `Severity.LOW` and compares each index's creation major with the current major. Thus **all5.x-created
indices trigger this warning on6.x**. It anticipates recreating those unchanged tables before**7.x**,
not incompatibility with6.0. The actual6.0 storage precondition is no4.x-created indices; the preflight
inventory and fresh23:45:43 queries found **94 tables created5.10.9 and51 created5.10.16**, identically on all three. [Exact check and compatibility sources](q65-upstream.md#check-3-is-expected-for-5x-indices-on-6x).

**Recommendation:** a reviewed future gate should treat this exact severity1/id3 warning as expected
when every listed index is verified5.x-created. Do not force recreation of these145 tables for6.0,
do not waive other checks or actual4.x incompatibility, and do not silently change the current approved
gate. Q64's first-failed-gate stop remains an execution fact; Q65 does not resume anything.

## 4. Remaining mixed for about a day

**No unconditional24-hour safety guarantee was established.** This adjacent major pair is supported
for a transient rolling upgrade; official guidance provides no numerical expiry that forces immediate
continuation, but does not bless a planned day-long mixed production state. GREEN now does not remove
the demonstrated metadata limitation or asymmetric recovery. [Version restrictions/source](q65-upstream.md#a-day-in-the-mixed-cluster).

If the owner needs a temporary pause, treat it as a staffed incident exception with these constraints:

- Preserve **allocationall/rebalancenone**, original replica counts and started copies. Do not rebalance,
  lower replicas, force allocation/cancel copies, drain/decommission or restart another node. Newly
  recovered replicas cannot be placed on5.10 from a6.0 primary; losing an existing old replica can
  therefore prevent returning toGREEN until the mixed condition is resolved.
- Keep normal already-supported traffic within the current behavior, but avoid deployments or jobs
  that change schemas/settings, add/drop/rename/swap/reindex tables, change partitions, or introduce
  dynamic columns. Dynamic ingestion can perform implicitDDL even without an explicit migration.
  Avoid new6.x-only SQL/features. Do not change users/HBA/privileges while paused; Q55 was not reached.
  These are recommendations for the owner, **not new job holds applied by this investigation**.
- Use only a separately approved isolated writer if snapshots must resume. Never write into the protected
  pre6 paths, treat mixed snapshots as proven5.10 rollback artifacts, or infer restoreability fromSUCCESS.
  No snapshot creation, restore, deletion or cron change was made here.
- Retain the protected pre-upgrade SQL+BLOB/config pair. Never run5.10 on the6.0-opened data directory.
  Rollback remains a separately approved restore, not a node-image downgrade.
- Arrange human monitoring of health/missing or unassigned copies, heap/disk, backup outcomes, errors
  and deployment/schema activity, plus a decision deadline. **No watcher or recurring check was armed**.

**Recommendation:** repair the isolated backup route first, then make a prompt owner decision to finish
at least the6.0 hop under a newly reviewed gate/runbook. Prefer that to an unattended full day mixed.
A decision to wait a day should explicitly accept impaired recovery options, metadata restrictions and
the RPO until a new compatible snapshot is verified; it does not authorize another stop or rollback.

## Validation and limits

Live read-only SQL through all three coordinators, timestamped backup/helper logs and cron journal, selected
Docker mount/path.repo inspection, shared-filesystem read-only facts, immutable metadata-copy hashes,
all three offline decodes, cross-node setting/UUID/version agreement and source request-path checks passed.
The evidence archive and JSON comparison are parsed and checked before commit; no private raw metadata,
credentials, jar binaries or full global role metadata are committed. Local decoder source is included.
No production snapshot fix/restore, write-enforcement experiment, cache reset or restart was tested.
No webapp/flow source changed, so webapp suites/typecheck and pytest were not rerun for this documentation
and offline forensic decoder. No push or issue comment.

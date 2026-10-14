# CrateDB auth prerequisites: upgrade sources

Research date: 2026-10-14. Scope: official sources for issue [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), supporting the production runbook in `docs/implementation/auth/cratedb-prereqs.md`. This note records documentation and source-code findings; local rehearsal and live production inspection are recorded by the implementation task.

## Target and supported path

Use **5.10.16**, released 2025-12-10: it is the newest released 5.10.x listed in the official release index at research time. Its notes permit rolling upgrades from 5.9.x; the general rolling guide also permits upgrades between patches of one minor version, covering the inspected production version **5.10.9 → 5.10.16**. No intermediate patch is required. [Release index](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/index.html), [5.10.16 notes](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/5.10.16.html), [rolling requirements](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements).

**Never start 5.10.11.** The 5.10.12 notes explicitly recommend skipping it: 5.10.11 introduced generated/default-column evaluation regressions and missing sequence/primary-term metadata during replication to earlier-version nodes. [5.10.12 fixes](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.12.html).

Docker Hub's first-party tag API returned an active `library/crate:5.10.16` on 2026-10-14, with these digests. Pin the manifest list for production and retain the actual old image digest for recovery; architecture-specific children differ. [Docker Hub tag metadata](https://hub.docker.com/v2/repositories/library/crate/tags/5.10.16).

| Object | Digest |
| --- | --- |
| Manifest list | `sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` |
| linux/amd64 | `sha256:039f0fc6f1cdd3b275310e1a182a67092efb9d916b875f8c3fca811d30c5e050` |
| linux/arm64 | `sha256:97713429eb89bedbaaa33dfc3c92428beb7f3e28fe1c95cc1e8c14602497bf67` |

Relevant intermediate fixes include PostgreSQL protocol/result ordering and memory leaks, a Lucene update to 9.12.3 in 5.10.13, IGNORED-object replication in 5.10.14, and translog recovery for older tables in 5.10.15. The final patch fixes a LEFT JOIN hash collision. Review representative catalog queries as well as auth writes. [5.10.13](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.13.html), [5.10.14](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/5.10.14.html), [5.10.15](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.15.html), [5.10.16](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/5.10.16.html).

## Stop, allocation, and recovery

The official recipe requires green table health, passing node checks, a current snapshot, transient allocation `primaries`, SQL `ALTER CLUSTER DECOMMISSION '<node-name>'`, replacement after process exit, version verification in `sys.nodes`, and allocation recovery. `TERM` is an ordinary stop, not a graceful decommission; requests may fail, so critical clients need retries. [Rolling procedure](https://cratedb.com/docs/guide/admin/upgrade/rolling.html), [5.10 signal handling](https://cratedb.com/docs/crate/reference/en/5.10/cli-tools.html#signal-handling).

With three nodes and two replicas, `full` minimum availability cannot decommission a node: it requires more nodes than `max_replicas + 1`. `primaries` permits yellow health while a node is down. As a conservative runbook adaptation, restore allocation and wait for GREEN with no recovering shards after each node before proceeding. [Availability requirements](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#data-availability-options).

```sql
SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
ALTER CLUSTER DECOMMISSION '<exact-node-name>';
-- Replace only that stopped node, retaining its data mount and node identity.
-- Wait for its exact target version, then recover before the next node.
SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all';
```

The recovery statement above presumes the initial allocation value was `all`. Record the initial value and restore it exactly if it differed. `RESET GLOBAL` has no `TRANSIENT` keyword and removes overrides, so do not use it to erase a pre-existing persistent configuration. Docker restart policies must also be accounted for so a decommission does not restart the old image automatically before replacement; this is an operational recommendation to be rehearsed. [SET/RESET syntax](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/set.html).

Defaults are `cluster.graceful_stop.min_availability = primaries`, timeout `2h`, and force `false`. Do not force a failed drain. The source clears the internal decommission marker when the departed node is removed, so a normal returning node does not need a manual recommission operation. [5.10 graceful-stop settings](https://cratedb.com/docs/crate/reference/en/5.10/config/cluster.html#graceful-stop), [tagged decommission implementation](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/cluster/gracefulstop/DecommissioningService.java).

During mixed versions, list selected `sys` columns explicitly rather than using `SELECT *`. [5.10 system-information warning](https://cratedb.com/docs/crate/reference/en/5.10/admin/system-information.html).

## Rollback boundaries

Official planning guidance permits an in-place downgrade for a patch-only upgrade with a performance problem and no corruption; major/minor changes or corruption require backup restoration. The `NodeMetadata` guard in both 5.10.9 and 5.10.16 checks major/minor versions and expressly ignores hotfix differences, so claiming that every patch downgrade is prohibited would be wrong. [Upgrade planning](https://cratedb.com/docs/guide/admin/upgrade/planning.html#define-a-rollback-plan), [5.10.9 guard](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/org/elasticsearch/env/NodeMetadata.java#L97), [5.10.16 guard](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/env/NodeMetadata.java#L97).

The guard is not proof that every data/gateway state can be read by the old binary. 5.10.9 uses Lucene 9.12.0, while 5.10.16 uses 9.12.3; verify the actual downgrade after target-version writes in the local rehearsal. If startup rejects metadata or the old process cannot read shards, stop recovery, preserve all affected volumes and logs, and restore the pre-upgrade snapshot to a fresh cluster on the retained old image. [Tagged version/Lucene mapping](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/Version.java#L230).

Do not use `crate-node override-version` as rollback: it bypasses the data-path guard and its own warning says old software may read incorrectly and lose data. Do not delete gateway metadata or copy an individual old shard over a newer live cluster. [Override-version implementation and warning](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/env/OverrideNodeVersionCommand.java#L34).

Snapshots exclude BLOB tables. `ALL` restores tables plus metadata/settings, while `TABLES` and `USERMANAGEMENT` narrow the restore; existing tables cannot be overwritten by a restore. A recovery plan therefore needs a fresh destination, the pre-upgrade snapshot, external configuration/secrets, separate BLOB backup if applicable, and a way to replay writes since the snapshot. [5.10 snapshots](https://cratedb.com/docs/crate/reference/en/5.10/admin/snapshots.html), [backup planning](https://cratedb.com/docs/guide/admin/upgrade/planning.html#back-up-and-plan-recovery).

## Dedicated user and table settings

`CREATE USER` grants no privileges. Grant `DQL, DML ON TABLE <explicit table list>` after tables exist. `DQL` covers reads/refresh and `DML` covers insert/update/delete; do not grant `DDL`, `AL`, schema-wide or cluster-wide privileges to the runtime user. CrateDB privilege classes are used instead of PostgreSQL's `GRANT SELECT, INSERT, ...` syntax. [CREATE USER](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-user.html), [GRANT syntax](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/grant.html), [privilege meanings](https://cratedb.com/docs/crate/reference/en/5.10/admin/privileges.html#privilege-types).

```sql
-- Template only; the implementation runbook owns the exact approved table list.
CREATE USER goodwatch_auth WITH (password = '<secret-injected-out-of-band>');
GRANT DQL, DML ON TABLE doc.<auth_table_1>, doc.<auth_table_2>
TO goodwatch_auth;

SELECT grantee, class, ident, type, state
FROM sys.privileges
WHERE grantee = 'goodwatch_auth'
ORDER BY class, ident, type;
```

Use `number_of_replicas = 2`, `"write.wait_for_active_shards" = '1'`, and `"translog.durability" = 'REQUEST'` for the auth tables. Two replicas give three copies on a healthy three-node cluster. Waiting for one means only the primary must be active before a write proceeds; it supports one-node maintenance but is not a guarantee of three durable copies after failures. REQUEST syncs after each operation rather than on the asynchronous interval. Nested settings need double-quoted names. [5.10 table settings](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-table.html#with).

## HBA is a prerequisite, not provided by CREATE USER

`auth.host_based.enabled` defaults to **false**, while `auth.trust.http_default_user` defaults to `crate`. When HBA is disabled, the server uses trust authentication, and HTTP without credentials chooses `crate`; a supplied Basic username selects an existing user without checking its password. Table grants still restrict that chosen user, but a reachable client can choose the superuser identity instead. A dedicated user therefore supplies no credential-based security boundary until HBA is enabled and password rules are effective. [5.10 authentication settings](https://cratedb.com/docs/crate/reference/en/5.10/config/node.html#authentication), [fallback authentication](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/io/crate/auth/AlwaysOKAuthentication.java), [HTTP credential extraction](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/io/crate/auth/HttpAuthUpstreamHandler.java), [trust method](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/io/crate/auth/TrustAuthenticationMethod.java).

The regular distribution's shipped `crate.yml` explicitly enables HBA; the Docker project's minimal config does not. Inspect actual image/mount configuration and probe behavior rather than inferring from command-line password rules alone. HBA evaluates the first matching rule, and unmatched clients are denied. Enabling it may break credentialless backups or other existing clients; prepare their credential rollout as a separately reviewed prerequisite. No production config change is authorized by this research. [Distribution config](https://github.com/crate/crate/blob/5.10.9/app/src/main/dist/config/crate.yml#L81), [Docker config](https://github.com/crate/docker-crate/blob/master/config/crate.yml), [5.10 HBA semantics](https://cratedb.com/docs/crate/reference/en/5.10/admin/auth/hba.html).

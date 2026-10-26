# Read-only production preflight and compatibility preparation

Collected October 26, 2026, from main `1770d08d1`. See the
[runbook measurements and approval list](../../crate-6-upgrade.md#read-only-production-preflight--october-26-2026)
and the [complete release audit](../../../research/crate-6-upgrade-compatibility.md).

## Evidence

- [results.json](results.json) contains the dated inventory, exact thirty-table policy list, client
  versions, sizes, snapshot totals, test results, local-canary results and archive SHA256.
- [receipts.json.gz](receipts.json.gz) is a gzip-compressed JSON `files` map. It includes read-only
  query scripts/results, effective settings and selected runtime metadata, SQL DDL, snapshot manifest
  totals/parser, test output, all43 official release-note sources with their SHA256 manifest, and
  repository grep evidence. It contains no passwords, auth headers, member rows or snapshot data files.
  Backup filesystem account identifiers are redacted. Container inventory excludes unrelated services.

All production SQL was SELECT/SHOW through trusted loopback over SSH. Runtime inspection used Docker
metadata, installed package metadata and filesystem metadata. No backup, restore, schedule/config/grant
change, restart, decommission, KILL or data mutation was performed in production. Importing the installed
backup environment's `requests` used Python `-B`/`PYTHONDONTWRITEBYTECODE`; no installer was invoked.

## Snapshot-size method

The latest captured snapshot was `hourly_20261026_020501`, SUCCESS,567 SQL shards,41.454s elapsed.
`sys.snapshots` has no byte-size column. We therefore read its repository index and **only** the567 shard
manifest files, transferred their compressed metadata locally, and decoded the tagged5.10.16 format.
The source formats are
[ChecksumBlobStoreFormat](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/repositories/blobstore/ChecksumBlobStoreFormat.java),
[BlobStoreIndexShardSnapshot](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/snapshots/blobstore/BlobStoreIndexShardSnapshot.java)
and [StoreFileMetadata](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/store/StoreFileMetadata.java).

The parser checks snapshot identity, shard count and complete consumption of each decoded stream.
It sums referenced file lengths for the full recovery set, separately from incremental bytes/files:

- Full set: **36,257,350,348 bytes,58,837 files**.
- Incremental upload: **2,129,430,348 bytes,11,561 files**.
- Active repository apparent size from `du -sb`: **131,239,461,309 bytes**.

This does **not** validate content checksums, file readability or actual restore throughput. Snapshot
data were never read or restored in production. The legacy parent repository's traversal exceeded a100s
read budget and was stopped; its separate retained size remains unknown. The active v2 measurement
succeeded within a separate60s budget. An initial generic Smile-decoder assumption was rejected; the
successful parser follows Crate's versioned binary stream, whose source is archived.

## Tests and supplemental local canaries

| Check | Result |
| --- | --- |
| Webapp node-loss regression before patch | Coordinator-message read failed; Participating case passed |
| Webapp Crate utility/catalog suite after patch | 55 passed |
| Operator-script regression before patch | Both node-role subtests failed; initial full run also lacked a parser dependency |
| Population catalog/pages and page-receipt tests after patch | 65 passed,35 subtests |
| Relevant flow backup-health/cluster-health/bulk tests | 38 passed,17 subtests;11 existing deprecation warnings |
| Backup pytest suite | 38 passed,9 subtests |
| `npx tsc --noEmit` | Exit2,192 existing diagnostics outside changed files |
| Python2.0.0/2.2.1/2.3.0 clients against local5.10.16 and6.4.6 | All six typed-array/object parameter and legacy `_version` OCC canaries passed |

The flow test dependencies were isolated with `uv run --no-project` (`pytest`, `requests`, `pydantic`,
`crate==2.3.0`, `wmill`, `pymongo`, `beautifulsoup4`, `html5lib`; monitoring tests also use `croniter`).
No local server loaded production environment files. The supplemental canaries used one disposable
single-node container per version, an internal Docker network and data under `~/.cache/gw-work/644-prep`.
All owned containers/networks/data were removed. Package/image caches remain. An initial local address
guard assumed172.x; it was corrected to accept Docker's inspected private address while rejecting the
three production URLs. Those harness failures were not database/client incompatibilities.

## Execution status and limits

- **NO-GO:** Two `person_appeared_in` rows remained RELOCATING in both all-coordinator samples despite
  GREEN/no missing copies. Do not drain until routing/checkpoints settle; investigate read-only if persistent.
- **No reindex prerequisite found:** All145 tables were created on5.10.9/5.10.16; no partitions/closed tables.
- **Expanded policy:** Production has30 three-copy tables, one more than the earlier rehearsal:
  `user_mcp_action`. Its wait1/REQUEST settings must be preserved and its actual action-receipt path qualified.
- **Installed versus selected:** Seventeen Python workers cache three crate versions, including2.0.0;
  cache inventory and local canaries do not establish current script-lock selection or full active-job behavior.
- **Config layers:** Startup argv and effective cluster settings were captured. The unsupported REST
  settings route returned404, so persistent/transient provenance remains an operator-config export gate.
- **RTO:** Metadata supports a60–120min planning allowance, not a validated full-volume RTO. Protected
  per-minor reverse recovery and full-volume restore on isolated capacity still need qualification.
- **Code and approvals:** This patch is committed for review, not deployed. BLOB schema scope, exact temporary
  write/copy policy, RPO/write handling, named rollback/cutover owner, backup/config changes and the twelve-hour
  slot all need explicit approval. No production change is authorized by this preflight.

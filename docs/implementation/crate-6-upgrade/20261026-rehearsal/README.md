# Isolated staged-upgrade rehearsal — October 26, 2026

Prepared from `7ee29ce30` for #644. Production was never contacted. See the
[proposed production runbook](../../crate-6-upgrade.md) and
[compatibility review with primary citations](../../../research/crate-6-upgrade-compatibility.md).

## Results and receipts

- [results.json](results.json) contains pinned image digests, fifteen replacement/gate receipts, five
  stage snapshots, load totals, final data/policy checks, independent restore and cleanup receipts.
- [receipts.json.gz](receipts.json.gz) is a gzip-compressed JSON object with a `files` map of UTF-8
  scripts, synthetic fixture definitions/ledger, chronological events, selected container logs,
  test output and downloaded release-note sources. Its SHA256 is in `results.json`.
  Passwords in these disposable lab scripts are synthetic, never production credentials.
  Database files, snapshot data and BLOB content are deliberately excluded.

The verified path was **5.10.16 → 6.0.8 → 6.1.6 → 6.2.11 → 6.3.7 → 6.4.6**,
node order **2 → 3 → 1** at every hop. All fifteen replacements preserved node identity and passed
zero-primary/no-missing-primary guards, normal shutdown and recovery. The final state had 108 GREEN
health rows and 676 STARTED/STARTED copies. Exact original replica/write policies were restored for
29 three-copy tables; auth REQUEST durability and its original write-wait 1 were retained.

The fixture used actual pipeline schema definitions, actual auth migration and current YepWatch
`proposal-storage-schema.ts`, plus synthetic movie/probe data and a BLOB. It was freshly created on
5.10.16; production table/partition creation versions remain an execution gate.

The load completed **11,453 reads and 9,143 writes**. The full acknowledged key/value ledger matched
stored rows exactly. There were 1,856 transient attempts and no exhausted logical requests. Retries
were bounded and writes used fixed keys plus readback. This does not establish safe retry semantics
for arbitrary application writes or zero user-visible interruption.

A separate clean three-node 6.4.6 cluster restored the protected original 5.10.16 SQL snapshot and
USERMANAGEMENT, with a separate BLOB copy. Catalog/auth/current typed-room samples, grants, passwords,
BLOB SHA1 and GREEN replication matched. Source-repository file hashes were unchanged. The actual
backup helper also passed create/verify/list/drop against the new repository registration.

## Validation

| Check | Result |
| --- | --- |
| `python3 -m pytest goodwatch-crate -q` | 38 passed, 9 subtests |
| Flow backup-health, cluster-health and crate-bulk pytest files | 38 passed, 17 subtests; 11 existing `utcnow` deprecation warnings |
| Actual auth `adapter.integration.ts`, with only import paths and local fixture ports adapted | 25 passed upgraded; 25 passed independently restored |
| Webapp Crate utility and catalog failover tests | 50 passed |
| node-crate 3.0.0 / pg 8.23.1 | Parameterized HTTP/PG reads passed |
| crate-python 2.2.1 / 2.3.0 | Parameterized reads, bulk upsert and OCC passed |
| Real webapp wrapper queries | NULL timestamp, typed array, named fulltext count and restricted auth CRUD passed |
| `npx tsc --noEmit` | Exit 2, 192 diagnostics in unchanged source; full output archived |

Exact test invocations and outputs are in `after-roll.py`, `final-checks.py`, driver scripts and
the archived logs. Flow tests ran through `uv run --no-project` with isolated dependencies:
`pytest`, `croniter`, `requests`, `pydantic`, `crate==2.3.0`, `wmill`.

## Findings and limits

- The current node-loss classifier misses the 6.4.3+ `Coordinator node … disconnected` wording.
  The canary records participating=true/coordinator=false. A separate tested application patch is required.
- Table-level BLOB DQL returned 404 on 6.4.6 even after re-granting. Schema DQL allowed GET/HEAD while
  PUT/DELETE stayed denied, but widens reads to all present/future BLOB tables. See `blob-grant-proof.json`.
- Native drain without a policy exception retained primaries; early replica reduction prevented GREEN
  mixed-major recovery. Both discovery strategies were rejected. The successful last-old-node reduction
  and brief write blocks need explicit production approval; they change redundancy/admission policy.
- Discovery and first-hop controller/observer corrections appear in chronological receipts. The qualified
  sequence resumed after corrections. This is a bounded successful drill, not an uninterrupted execution
  of frozen production automation. Follow the reviewed runbook rather than blindly invoking archived scripts.
- Protected original-5.10 forward restore was tested. Protected per-minor rollback copies and pre-hop
  reverse recovery were not tested. Production metadata, actual credentials/workers, volume-scale recovery,
  peak traffic and old-index reindex requirements remain fresh-preflight gates.
- Production's SSH-independent systemd stop wrapper was not exercised locally; Docker normal stop with
  unlimited grace was. No forced kills, production operations, pushes or issue comments were performed.
- All six owned containers, both internal networks, six data directories, repository/BLOB data and two
  loopback proxies were removed. Only scripts/logs/receipts and shared image cache remain.

The proposed production window is provisionally **six hours**, subject to current production sizing and
restore measurements. Major/minor rollback requires fresh directories and a protected pre-hop snapshot,
with an explicitly accepted RPO or separately approved write freeze/queue/replay.

# Q53 plain-stop rolling rehearsal — October 27, 2026

**The full five-hop path completed locally; production was never contacted or changed.** All fifteen
node replacements returned to **145 GREEN tables and 1,175 STARTED copies before the next stop**,
using the BLOB cross-check explained below during the 6.0/6.1 mixture. No decommission, drain, zero-primary
requirement, replica removal or forced stop was used. The route is ready for review, subject to the
explicit approvals and fresh production gates in [tonight's runbook](../../crate-6-upgrade.md).

Owner Q53 selects a **23:00 UTC October 27** start (midnight CET); execution still waits for explicit go
around 22:45. **Q55 approves schema BLOB DQL before the first 6.2.11 node**, with authenticated index-file
read verification afterwards. That grant was exercised only in the disposable lab, not production.

## Fixture and result

Started from `origin/main` **aa8a51bd8**, using Docker on two internal local networks, no published database
ports and no production `.env` or credentials. Scratch/data lived under `~/.cache/gw-work/644-q53`.

- Replayed the archived production SHOW CREATE definitions for **144 SQL tables**, including archive
  schemas, all auth/MCP/YepWatch tables, plus the **BLOB table** with its original three-shard/`0-1` policy.
  All 144 SQL tables received synthetic sample rows; the BLOB had a known immutable SHA1 object.
- Replayed **212 privilege entries** and all 11 production user names, with synthetic passwords for
  passworded users, plus a separate lab administrator. HBA required passwords externally and retained
  trusted local `crate` administration. Wrong-password reads were denied at node checkpoints.
- Preserved the exact original 145 table policies: **30 replicas `2`, 106 literal `0-1`, nine literal `1`**.
  Lowered **only the 14 YepWatch waits 3→2**, behind brief blocks/readbacks, once across the campaign.
  Auth and `user_mcp_action` kept wait 1/REQUEST. Restored all policies exactly at the end.
- Took a protected **5.10 snapshot: SUCCESS, 567 SQL shards, no failures**. Retained the BLOB fixture content
  before the first node; subsequently exercised the reviewed SHA1 copy helper against all three physical
  BLOB stores, including an empty node and duplicate copies. The production plan runs that helper and
  reference reconciliation before its first node. Every protected SQL repository file hash remained unchanged.
- Upgraded **5.10.16 → 6.0.8 → 6.1.6 → 6.2.11 → 6.3.7 → 6.4.6**, order **2→3→1 at every hop**, with normal
  `docker stop --timeout=-1`, same data directory and persistent node ID, then the pinned next image.
  Allocation was `primaries` during the stop and `all` after rejoin; rebalance stayed `none`.
- Light authenticated load used distributed catalog reads and keyed writes to movie, invitation and
  auth-capacity tables. **2,196 reads and 7,055 acknowledged writes** completed, **117 transient attempts**,
  no exhausted logical request. Exact persisted key/value readback matched every acknowledged write.
- Registered the old repository read-only and a separate mounted 6.x repository after homogeneous 6.0.
  All five stage snapshots succeeded; the real `backup.py` helper also created and verified a fresh
  6.4.6 snapshot as `goodwatch_backup`. Schema BLOB DQL was granted before 6.2, then final search GET/HEAD
  through every node returned 200 and GET content matched its SHA1.

This small, keyed SQL workload does not prove arbitrary member writes can be safely retried, or that
production pages will stay within their deadlines. The unchanged production watcher can abort on one
slow 200, as today's Q50 restart demonstrated.

## What the allocation experiment proved

**GREEN is possible after every plain-stop replacement; no special last-old-node copy reduction was
needed.** Existing older replicas stayed STARTED alongside newer primaries. After the second node of
successive hops, the placement inventories counted **26, 35, 35, 35, 35** such older-replica/newer-primary
pairs. The same 2→3→1 order worked despite primary placement changing across hops; fewest-primaries-first
was not a compatibility requirement.

A separate one-table, three-node negative control made an older **6.0.8** replica actually require recovery
from a **6.1.6** primary. It stayed **YELLOW, zero missing primaries, one missing replica**, and the read-only
allocation decision explicitly refused the older target. Upgrading that node to 6.1.6 restored GREEN.
Thus preserving an existing old copy does **not** mean rebuilding onto an old node is supported. A major-hop
control also showed a 5.10 node cannot simply rejoin after both remaining members are 6.x; its old data
had never been opened by 6.x. No newer directory was ever downgraded.

Allocation `decisions` must be selected separately from `explanation`: a lazy-cache ordering issue can
otherwise return null decisions. [Exact source and qualified query](../../../research/crate-q53-plain-rolling-source-check.md).

## Newly found mixed 6.0/6.1 BLOB behavior — production approval needed

The first 6.1 coordinator returned **1,171** `sys.shards` rows, omitting four BLOB copies on older nodes,
while older coordinators returned all **1,175**. All coordinators' allocation routing still contained
1,175 STARTED copies; the union of each node's own physical shard rows was complete. BLOB SQL through the
new coordinator failed `RelationUnknown`, while authenticated BLOB HTTP reads through all three nodes
returned the correct content. Full SQL/stat agreement returned at homogeneous 6.1.

Tagged source explains it: 6.1 uses UUID collection-routing keys; 6.0 looks up names, skipping unknown keys
for stats and failing SQL collection. This affects the BLOB cleanup SQL in
`goodwatch-flows/windmill/f/search/build_indexes.py:444`; webapp index download uses HTTP.
[Mechanism and citations](../../../research/crate-q53-plain-rolling-source-check.md).

The runbook therefore proposes an **explicitly bounded exception only for this version mixture**:
full all-coordinator allocation identities/counts + each node's own shard inventory + BLOB HTTP/SHA1 checks,
with the index builder/publication/schema jobs held. SQL-table rows must still agree; missing allocation,
failed HTTP, unexpected version/error or later homogeneous disagreement remains a stop. Owner must approve
this exception and holds; otherwise stop at homogeneous 6.0.8 and do not start the 6.1 hop.

## Timings and production estimate

[All fifteen node timings](timings.csv) include normal stop, version-confirmed rejoin and the all-coordinator
GREEN gate. Routine nodes took **53.0–66.9 seconds stop-to-GREEN**; normal stop itself was about **0.2–0.6s**.
One 6.1 node was deliberately held for the source investigation, so its row has no useful benchmark.
The upgrade wall interval was approximately **18:15–18:36 UTC**, including that diagnostic hold; final
client/auth/helper checks finished 18:41, cleanup 18:42. These are local fixture timings, not volume benchmarks.

Production's real restart took about three minutes stop-to-GREEN. Propose **7–10 minutes per node**, including
preparation and three minutes stable verification, plus protected baseline, the first full 6.x snapshot, homogeneous checkpoints and final
restoration: **roughly 3–4½ hours, book 23:00–04:00 UTC**. The proposed shorter between-node soak, cutoffs and
end time need approval. Keeping ten minutes settled GREEN between every node instead adds 105 minutes,
requiring about **6–7 hours**. Restore-only rollback needs its own **60–120 minute unqualified allowance**.

## Validation

| Check | Result |
| --- | --- |
| Full path, identity, 145 policies, 30 three-copy tables, original copy counts | Passed at all 15 node checkpoints |
| Exact acknowledged-write ledger | 7,055 rows matched; no missing or incorrect writes |
| Protected repository file hashes | Unchanged through the full path |
| Webapp Crate utility/catalog failover tests | **55 passed** |
| Actual auth adapter integration, upgraded cluster | **25 passed** |
| Backup pytest suite | **38 passed, 9 subtests** |
| Flow backup-health, cluster-health, bulk suites | **38 passed, 17 subtests**; 11 deprecation warnings |
| Watcher unit tests | **10 passed** |
| SHA1 copy helper tests and real fixture layout | **4 passed**; actual duplicate/empty-node copy verified |
| Node libraries against 6.4.6 | node-crate **3.0.0**, pg **8.23.1** passed parameterized reads |
| Webapp wrapper/auth canaries | NULL timestamp, typed array, fulltext named count, restricted encrypted CRUD passed |
| Python clients against 6.4.6 | **2.0.0, 2.2.1, 2.3.0** passed reads, bulk upsert and OCC |
| Real backup helper and search BLOB access | Snapshot verified; GET/HEAD/SHA1 passed all three nodes |
| Compose override, config-only | Pinned image, original mounts/env/ports/HBA preserved, new mount present, restart no→always passed |
| Runbook snippets | Bash syntax and embedded Python compile checks passed; 6/6 digests match cached manifests |
| `npx tsc --noEmit` | **Exit 2: 189 diagnostics in unchanged files**, output archived |

Installed webapp dependencies with `npm ci --include=dev`; the host's global libvips first triggered a sharp
source build failure, resolved locally with `SHARP_IGNORE_GLOBAL_LIBVIPS=1`. No production env was copied.
Auth integration used the unchanged repository test source, adapting only absolute import bases and its
allowlisted loopback ports (15648–15650); private local proxies forwarded solely to the owned internal lab
with synthetic administration credentials and were closed afterwards.

## Harness corrections and limits

This was an investigative rehearsal, **not an uninterrupted run of frozen production automation**. Receipts
retain the first discarded trial and the qualification/resumption:

1. The first controller stopped on a coordinator-local shard-state/count mismatch. The fresh rerun waited
   for every coordinator, which exposed the persistent mixed-version BLOB behavior rather than a transient.
2. Held the first 6.1 node, checked source/physical routing/HTTP, then resumed from that verified GREEN mixed
   checkpoint with the bounded BLOB gate. No node was downgraded or force-stopped to recover the rehearsal.
3. The first final ledger predicate also included two unchanged baseline `q53-fixture` rows. Excluding these
   gave an exact 7,055-row match; no acknowledged data was missing. Readback is archived before test cleanup.
4. Older canaries expected the previously fixed coordinator-error classifier gap and used a disallowed port.
   Their expectations/ports were updated. Plain placeholder auth payloads were removed **only from the local
   fixture, after ledger verification**, so actual encrypted adapter tests could run against valid fixtures.
   No application compatibility change was made for these harness issues.
5. The negative-control allocation query initially selected `explanation` before `decisions`, masking the
   useful refusal. The separate read-only query exposed the exact version rule; upgrading the old node fixed it.

No production heap/load/credentials/deploy/schedule/metadata gate was checked today; the archived DDL is not
proof tonight's schema remains identical. No production-volume recovery/restore RTO was qualified. Actual
production systemd/SSH stop dispatch was proven by Q50, not re-executed here. Local replacements used Docker
directly; the production Compose merge was tested without starting containers. Client/runtime canaries do not
replace fresh worker credential checks. The repository type check remains red independently of these doc/helper changes.

## Evidence and cleanup

- [results.json](results.json): images/digests, timings, version/copy matrices, negative control, final checks,
  test results and cleanup. [node-matrix.json](node-matrix.json): exact 15 production host/node/image/unit rows.
- [receipts.json.gz](receipts.json.gz): text scripts, original synthetic fixture/ledger/readback, schema/settings
  provenance, chronological events, mixed-version SQL/HTTP observations, negative-control decisions, selected
  container logs and test output. Only synthetic passwords/rows; no production credentials or member data.
  Its SHA256 and file count are in results.json. Physical database/snapshot/BLOB files are excluded.
  Files prefixed `old-` or `rehearsal-` are prior-run references. This run used `lab.py`, `seed.py`,
  `roll.py`, `roll-resume.py`, `final-verification.py`, `postcheck.py` and `cleanup.py`; corrections are
  described above and retained in earlier controller/log files.
- [copy-blob-sha1.py](copy-blob-sha1.py) and [tests](test_copy_blob_sha1.py): narrowly scoped production helper
  for use only after go and backup-path approval; no production copy was performed during preparation.

**Removed all six owned containers, both internal networks, six data directories, both clusters' repository
and BLOB directories, and the loopback proxies.** Only receipts/scripts/fixture ledgers and pre-existing
shared image cache remain. No push, production write, restart, schedule change, grant or issue comment occurred.

Pending owner decisions are the [runbook checklist](../../crate-6-upgrade.md#owner-approvals-before-2300-utc).
Q53 route/start and Q55 grant are already approved; explicit execution go remains required.

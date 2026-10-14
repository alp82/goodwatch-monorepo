# Production upgrade attempt: stopped before mutation

Owner go: **2026-10-14T18:29:59Z**. Scope: upgrade and its checks only; no auth-user creation, HBA, firewall or table-setting changes. Runbook baseline: branch `auth/cratedb-prereqs`, commit `e4e5da3e`.

The attempt stopped at **runbook pre-check 3**, before snapshot creation, image pulls or node changes. That gate says: “If the repository is disabled/stale or restore has not been validated for this deployment, stop and fix that prerequisite under separate authorization.” No validated CrateDB restore was located; [serving-architecture.md](../../../../serving-architecture.md) explicitly records that a restore was never tried. The successful local patch rollback does not validate production snapshot restoration. The runbook gate was not waived or edited to permit execution.

| Item | Observed result |
| --- | --- |
| `crate-01` / `10.0.0.11` | 5.10.9; running; restart `always` |
| `crate-02` / `10.0.0.12` | 5.10.9; running; restart `always` |
| `crate-03` / `10.0.0.13` | 5.10.9; running; restart `always` |
| Health | All 90 table/partition rows GREEN; zero missing/underreplicated shards |
| Shards / node checks | All 920 copies STARTED; all 21 node checks passed |
| Allocation / graceful stop | `all`; `PRIMARIES`, force false, timeout two hours; unchanged |
| Compose | Live file hashes match this checkout on all hosts; no tracked Compose drift |
| Backup mount | Present on all hosts; approximately 1.2 TiB available |
| Named pre-upgrade snapshot | **None created**: failed gate occurred before this step |
| Client errors seen | Three actual-webapp read-only SQL probes returned HTTP 200; no SQL/transport errors in those probes |
| Production mutations | **None**; no rollback/restart needed |
| Auth user | Absent; creation deliberately deferred to #562 |

Timings (UTC):

- Attempt began **2026-10-14T18:31:59Z**.
- Live host/SQL checks recorded **2026-10-14T18:34:00.974662+00:00**.
- All nodes verified GREEN/STARTED at the clean stop **2026-10-14T18:35:08.904907+00:00**.
- Final webapp SQL probes finished **2026-10-14T18:35:41.586525+00:00**; total elapsed **222.587 seconds**. Probe times were [127, 13, 13] ms.
- This is well before the laptop cutoff at **2026-10-15 03:00 UTC**. There is no pending snapshot, upgrade process or scheduled continuation from this attempt.

A first read-only client-probe helper had a JavaScript quoting error before issuing any SQL; it was corrected and all three probes passed. Both attempts are retained in [client-probes.json](client-probes.json). No conclusion about all organic application traffic is claimed from three probes.

Evidence: [prechecks.json](prechecks.json), [client-probes.json](client-probes.json), [outcome.json](outcome.json).

Before restarting the production upgrade, validate recovery of a production CrateDB snapshot in an isolated destination and verify the separately excluded BLOB recovery path, or provide an existing restore-validation record. Any changed acceptance gate or expanded recovery-drill scope requires an explicit owner decision. Keep #547 open. Account/password enforcement work belongs to #562.

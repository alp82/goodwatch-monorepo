# Q33/Q34 final-node production upgrade — complete

All three production nodes run **5.10.16** on the pinned manifest from the runbook. The upgrade and post-upgrade scheduled backup passed. **#547 remains open:** its original completion criterion includes `goodwatch_auth`, absent and explicitly excluded pending #562. No auth/HBA rollout occurred.

## Authorization and scope

Q33 authorized crate-01 as the last node after #604/#607, with the owner watching. Q34 option 1 authorized revalidation and individual KILL of exactly the fixed 69 IDs through crate-02, followed after about five minutes by a normal graceful container stop if native exit remained blocked. The patch-only restore-validation waiver remains recorded; restoration was not tested. Known concurrent tables were accepted. No HBA, auth user/tables, app/config, manual firewall or table-setting changes. No KILL ALL, force flag, SIGKILL or additional node restart.

## Gates and actions (UTC)

| Gate | Evidence/result |
| --- | --- |
| Prechecks | 94 GREEN rows, 958 STARTED copies, 21 checks passed; original node IDs; PRIMARIES, force=false, timeout 2h; allocation all |
| Safety snapshot | `goodwatch-db-backup-v2.pre_auth_547_20261015190551` SUCCESS; CREATE 13.659s, 19:09:24.575–19:09:38.234 |
| BLOB protection | 18 unique files / 126,888,186 bytes, SHA1/size verified, privately retained on crate-01 under `/root/cratedb-maintenance/547-20261015190551/blob-artifacts`; snapshots exclude BLOBs |
| Staging | Only pinned image changed; protected before copies of env/Compose/runtime; temporary Docker restart=no; allocation primaries |
| Decommission | Exact original crate-01 ID through crate-02, HTTP7500s/SSH7530s; SQL success 19:20:39.690 after 542.780s; zero primaries |
| Independent exit wait | Original daemon stayed live, logging active requests; read-only evidence found 206 old operation entries on crate-01 from about04:01 UTC, 13 on crate-02; sys.jobs had no candidate IDs. Internal-counter causality unproven |
| Q34 revalidation | All 69 fixed IDs still represented by old crate-01 operations, absent from current jobs; zero primaries /94 GREEN /958 STARTED /21 checks |
| Exact cancellation | 69 individual KILL requests, all HTTP200 / rowcount 0; completed 20:32:08.705. No operation entries cleared by these receipts |
| Normal stop | Revalidated after at least 300s. `docker stop --timeout=-1 crate-01` at 20:37:11.640; completed in2.777s, exit 143, signal 15 only, no OOM/noSIGKILL |
| Target start | Pinned5.10.16 process started20:37:27.192; all runtime fields except image preserved, restart always |
| Rejoin | Original ID `xlclgwGeSHe18p5J4WvfFA` returned on5.10.16 at 20:37:48.078 |
| Normal allocation | Restored allocation all after rejoin,20:37:49.240; no RESET of persistent settings |
| Recovery | First complete94 GREEN /958 STARTED/STARTED /21 checks at 20:46:59.772; observed relocation progress throughout; independent coordinator gates passed20:47:46–47 and repeated after backup |
| Postchecks | 94 current GREEN health rows, [['STARTED', 'STARTED', 958]] shard states, 21 checks passed. All21 actual page/search/worker reads pass across three coordinators |
| Scheduled backup | `hourly_20261015_210502` SUCCESS, unchanged scheduled routine verified finished; see backup receipts |

The first post-rejoin readiness assertion sampled two relocating copies and did not pass; observation continued until fully STARTED. That was ongoing expected recovery, not a health abort. An optional operator diagnostic selected nonexistent sys.jobs.classification and returned ColumnUnknownException/404; it was a read-only operator error, not an application failure. New crate-01 logs have no exception/OOM/corruption/aborted-shutdown patterns. One startup warning is the existing disabled dangling-index autoimport notice.

## Final configuration and firewall

Versions: crate-01/02/03 **5.10.16 /5.10.16 /5.10.16**, original Crate IDs. Image ID `sha256:9946365265397a39897876cdbc3d2c2a3c5c19c77a2c626a017dd22e96deb98f`, manifest pin `sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307`.

[Configuration comparison](configuration-comparison.json) verifies original commands/environment/HBA, full sorted mounts, private 4200/4300/5432 bindings, memory/logging/restart always and rendered service except image. Baseline table settings unchanged; original node identities retained; crate-02/03 container IDs/starttimes unchanged. Final placement audit verifies479 logical shards, exactly two STARTED copies on distinct hosts and one primary each. Firewall reconcilers remainactive onall three.

The runbook's read-only firewall finding still applies: private destination bindings and matching Docker DNAT; active UFW with private SQL/worker allowances, but DOCKER-USER is not a blanket private-source allowlist. Docker forwarding bypasses a claim based on UFW INPUT alone. Existing legacy/generated comments do not uniformly satisfy the literal every-rule owner/purpose convention. No manual firewall changes. External Internet/provider ACL reachability remains untested.

## Captured client outcomes

Window begins19:11:00 UTC, through final observer shutdown at 21:07:12 UTC recorded in outcome/observer receipts. **{'recovered': 8193, 'failed': 2, 'cancelled': 1}** final `crate.query` outcomes. Captured request HTTP5xx minimum **2**. Both failed queries are POST `/api/poster-impressions`, CrateTimeoutError after one about 10s attempt to crate-01 (19:19:02 and19:56:22): additive demand increments left indeterminate and not replayed; both correlate to request HTTP 503/hadCrateFailure=true. No guarded recovery outcome followed. They were actual endpoint failures, not operator writes/auth-state changes. The cancelled catalog read is AbortError on `/api/combined-search`, kept separate. Search roles together captured 7 recovered / 0 failed / 1 cancelled SQL outcomes, no observed 5xx.

**46 generic-route503 diagnostics** have hadCrateFailure=false. Source inspection shows readiness is wrapped before lifecycle routing and can map `/health/ready` to `/:type/:category`. These remain ambiguous readiness responses, not proven member failures. HTTP metrics were also sampled; removed containers prevent complete full-window deltas.

Public probes: **{'responses': 3858, 'statusCounts': {'200': 3858}, 'non200': 0}**. They cover GET home/movie/show/person/related/palette. No signed-in mutation or synthetic full ranked search was issued; that API can write history/start paid work. Production query totals include the public probes and other traffic; they count SQL calls, not unique members or requests.

| Outcome | Route | Source | Error class of failed attempt(s) | Count |
| --- | --- | --- | --- | --- |
| cancelled | /api/combined-search | catalog | AbortError | 1 |
| failed | /api/poster-impressions | crate | CrateTimeoutError | 2 |
| recovered | /:type/:category/:page | crate | CrateTimeoutError | 1 |
| recovered | /api/combined-search | catalog | CrateTimeoutError | 1 |
| recovered | /api/combined-search | crate | CrateTimeoutError | 1 |
| recovered | /api/command-palette | crate | CrateTimeoutError | 5 |
| recovered | /api/poster-impressions | crate | CrateTimeoutError | 1 |
| recovered | /api/related | crate | CrateTimeoutError | 1 |
| recovered | /api/related-map | crate | CrateTimeoutError | 1 |
| recovered | /movie/:movieKey | crate | CrateTimeoutError | 1397 |
| recovered | /movie/:movieKey | crate | Error | 1 |
| recovered | /movie/:movieKey | crate | NoSuchNodeException | 1 |
| recovered | /movie/:movieKey | crate | NodeNotConnectedException | 2 |
| recovered | /person/:personKey | crate | CrateTimeoutError | 4346 |
| recovered | /person/:personKey | crate | Error | 5 |
| recovered | /person/:personKey | crate | Error,NodeNotConnectedException | 2 |
| recovered | /person/:personKey | crate | NodeNotConnectedException | 1 |
| recovered | /show/:showKey | crate | CrateTimeoutError | 2410 |
| recovered | background | crate | CrateTimeoutError | 17 |

| Phase (captured events since boundary) | Since | Final query outcomes | Correlated Crate HTTP5xx |
| --- | --- | --- | --- |
| Q34 owner continuation | 2026-10-15T20:31:08.303547+00:00 | {'failed': 0, 'recovered': 653, 'cancelled': 0} | 0 |
| Target start | 2026-10-15T20:37:27.191817292Z | {'failed': 0, 'recovered': 6, 'cancelled': 0} | 0 |
| First settled recovery | 2026-10-15T20:46:59.771732+00:00 | {'failed': 0, 'recovered': 0, 'cancelled': 0} | 0 |

### Coverage limits

Independent automatic page deployments replaced containers throughout the earlier drain. Initial pages f4be666b descend from 02b3ca5b; search roles retain exact 02b3ca5b. Final sampled pages run 67660993, independently verified as descendants of 02b3ca5b, with runtime diagnostic/recovery markers present. Original ABIO page collection failed on older Python's dict-union support, corrected to dict.update; its old container/logs had already been removed. A bounded read-only log-drain/open-FD recovery check found no recoverable copy. Current/later replacement logs were recaptured/continuously followed, original vector1 logs retained, with SHA256 deduplication. **Counts are captured minima; no complete full-window zero/rate or zero-impact guarantee.** Raw SQL values/params, credentials and raw exceptions are not retained. Redacted full events/streams and health history are gzip archived with byte-for-byte decompression checks. Axiom ingestion/read access remains unverified under the earlier Q30 skip.

## Backup and follow-ups

The 20:05 scheduled run blocked against its only coordinator, crate-01, then logged READTIMEOUT/FAILED20:35:01. Repository inspection confirmed hourly_20261015_200501 absent; the pre-upgrade snapshot remainedSUCCESS. The unchanged21:05 scheduled routine subsequently created/verified `hourly_20261015_210502` asSUCCESS and finished. No backup config/cron/coordinator changes or manual backup retry. Its single coordinator is a follow-up.

Thirteen old operation entries remain on crate-02; those outside the 69 exact IDs were deliberately not broadened into further cancellation. No real health issue observed. Internal-counter causality is still unproven; future drain diagnostics deserve follow-up.

#547 stays open for dedicated auth-user preparation after #562, then adapter-specific table grants/settings under separate authorization. No remaining node upgrade is needed. Restoration/BLOB recovery exercise, external-source firewall verification and production password migration were not performed. No changes pushed to main, no merge/PR. Remote branch `auth/cratedb-prereqs`; final issue comment records exact commit.

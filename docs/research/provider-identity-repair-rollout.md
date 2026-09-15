# Provider identity repair rollout

September 15, 2026. Structural repair and database prevention are complete. Fresh country verification continues through the durable retry queue; three historical aliases remain explicitly unresolved in quarantine.

## Independent review and additions

Reviewed the transaction/archive implementation and reran its real MongoDB replica-set tests. Added:

- Lossless quarantine for a whole title whose stored numeric ID conflicts with its watch URL. Originals are copied transactionally into `provider_identity_quarantine`; a durable `provider_identity_unresolved` marker prevents either initializer from recreating those sources and freezes the entire published title, including API availability. Quarantines remain separately visible in verification counts.
- A count cross-check on every archived Crate title snapshot so a truncated SQL response cannot be accepted as a complete backup.
- Two pending-repair slots in each five-country scheduled batch, respecting eligibility, source leases, shared upstream blocking and failure backoff. Ordinary due work retains three slots. A partial eligibility index covers pending repairs.
- Full verification uses server counts and a conservative canonical-URL fast path; every noncanonical candidate is checked with the existing exact parser. The server compiles a constant URL regex once and compares its captured ID/country against stored identity fields. Differential tests cover malformed BSON, missing fields, Unicode slugs, percent-encoded query values, wrong IDs/countries and control characters. Exact two-character country length closes the regex trailing-newline loophole.
- Progress callbacks for verification and removal of the redundant drain scan when finishing an already-frozen maintenance window.
- Existing monitoring reports now retain all pending, failed, backoff and leased repair counts plus unresolved quarantines, even when ordinary backlog reporting excludes shared upstream backoff. No new notification route or rule was added.

Fourteen real MongoDB integration tests, 49 streaming tests and 20 priority tests cover the original repair and these additions. Eleven monitoring tests and two read-only backlog tests also pass; five existing Crate integration tests require a separate test endpoint and were skipped. All original BSON values and published rows are archived privately before source deletion. Archives are fsynced and checked against complete hashes; transaction receipts make completed mutations restartable.

## Full inventory

The read-only scan completed at 08:35:50 UTC. It observed 8,126,594 records while ordinary writers remained live; plans are reread under maintenance before application.

| Collection | Documents | Duplicate country groups | Excess documents | Titles with duplicates | Unready records | Invalid records |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Movie | 6,616,576 | 68,380 | 69,436 | 3,154 | 350,580 | 171 |
| TV | 1,510,018 | 16,376 | 16,647 | 806 | 94,042 | 0 |
| Total | 8,126,594 | 84,756 | 86,083 | 3,960 | 444,622 | 171 |

35,878 titles require duplicate consolidation or normalization. These are different counts from the 3,960 titles with duplicates.

All 171 invalid records belong to three historical movie aliases. The corresponding details records also use the mismatched URL, while the URL's numeric title has its own details/providers. No offers are reassigned between IDs.

| Stored ID | URL ID | Title | Invalid source records |
| --- | --- | --- | ---: |
| 5338654 | 658039 | The Forgotten Mountain / Mali i Harrum | 3 |
| 3635601 | 872517 | Treasure Island: The Adventure Begins | 131 |
| 162483 | 10679 | Iron Sky | 37 |

These alias identities remain explicitly unresolved in quarantine; structural uniqueness must not be mistaken for their resolution.

## Controlled sample

Six live titles were archived and repaired under the persistent MongoDB gate with source validators rejecting concurrent writes. 393 originals were archived and 122 excess records removed. All four affected schedules were restored after this window.

The sample includes movie 526028, TV 69283, movie/TV 406, movie 18, and TV 42412. Every duplicate survivor remains pending until the existing fenced scraper reports success; old offer arrays are never combined.

Fresh source evidence from the actual deployed priority flow:

- Movie 526028: 30 countries freshly verified; Argentina has three offers.
- TV 69283: 64 countries freshly verified; Australia has a verified empty snapshot.
- TV 406: four countries freshly verified.
- Movie 406 is an already-unique overlap control; ordinary upstream failures remain durable backoff, independently of identity repair.

The initial explicit priority attempts encountered existing two-hour queue leases left by prior failed flows. Owning selection jobs and terminal failed parents were matched by exact lease token before invoking the existing fenced release operation. Demand was not acknowledged by that release. One owning failed parent is the original reported run `01a0a3de-c2ae-8dee-1fca-0950def1eb15`.

Completed priority verification parents:

- `01a0a43a-46f1-b37a-6382-13816bb2fb0e`: movie 526028 and TV 69283.
- `01a0a43a-473d-b310-c2af-514970b49f49`: movie and TV 406.

Both parent flows completed and their real Crate queue rows were read back after acknowledgment. The original-failure sample acknowledged movie 526028 demand 90 and TV 69283 demand 132 with overall success. The overlap sample acknowledged movie 406 demand 0 and TV 406 demand 133 with partial success due only to movie 406/Niger being in source backoff. All four queue leases were cleared.

Movie 526028/Argentina publishes three offers. TV 69283/Australia has no remaining scrape URL/price/quality contribution after the verified empty scrape; two current API offers remain correctly published. An empty scrape does not erase independently verified API availability.

## Deployment handling

Only scoped Python paths are deployed via the Windmill API with captured parent hashes, schemas, locks and runtime fields. Windmill automatically rebuilt dependent script locks, including an unwanted standalone `bson` package and Python upgrades. Those generated locks were replaced with the repository's known-good pinned locks. Four actual read-only Windmill jobs imported the complete fetch, priority initializer, bulk initializer and priority publisher dependency chains and verified that the new guards were loaded.

Full replay/production evidence and recoverable source/publication archives are in the private directory `/home/alp/.local/state/goodwatch/provider-identity-repair`. Credentials are loaded in memory and are not included in repository artifacts. Exact schedule states are retained in `paused-schedules.json`; archive receipts reference their durable paths and hashes.

## Capacity and execution

The scheduled crawler runs every 20 seconds. Two repair slots per media type imply a theoretical ceiling of 8,640 repaired countries per day per media type: roughly eight days for the movie backlog and two days for TV, before pauses, upstream limits and failed retries. This is capacity arithmetic, not a freshness promise. Existing published availability remains frozen per pending country until verified success.

Structural application uses 200-title checkpoints and 32 bounded workers. Country replacements are grouped into one ordered Mongo bulk operation within each title transaction. Complete Crate snapshots are fetched per checkpoint and independently checked against per-title counts before archiving. A separate four-worker verifier checks archive hashes, source after-hashes and unchanged publication while the gate remains closed. Interrupted execution resumed from majority-committed receipts without losing completed titles. A read-only verification scan exceeded the initial two-minute socket timeout; no mutations were repeated, obsolete queries were confirmed gone, and the final scan restarted with a nine-minute server limit, ten-minute socket timeout and automatic read retries disabled.

## Completed full structural repair

The full batch completed 35,875 targets, including five already-repaired/no-op targets. It removed 85,961 excess source documents; the sample removed 122, giving exactly 86,083 excess documents removed across both windows. The full phase normalized 273,568 singleton country records and marked 84,634 duplicate survivors pending refresh.

Independent frozen-window verification checked 35,870 mutated-title archives containing 444,201 original source documents and 230,594 unchanged published rows, totaling 722,127,066 bytes. Every archive hash and repaired source after-hash matched its transaction receipt. All three quarantines were additionally checked against their archive hashes, transactionally preserved MongoDB originals and unchanged publication.

The reopen baseline contains 68,337 pending movie countries and 16,325 pending TV countries (84,662 total), including 28 countries still pending from the sample. These countries remain durably eligible/backed off for fresh verification; pending does not mean freshly verified. Existing scheduled monitoring has already persisted repair counters and all three quarantine markers in its normal latest report.

## Final full identity verification

Every active record passed final identity validation while the maintenance gate remained closed:

| Collection | Active documents | Invalid identities | Duplicate groups | Unready records | Pending fresh verification |
| --- | ---: | ---: | ---: | ---: | ---: |
| Movie | 6,546,972 | 0 | 0 | 0 | 68,337 |
| TV | 1,493,378 | 0 | 0 | 0 | 16,325 |
| Total | 8,040,350 | 0 | 0 | 0 | 84,662 |

Ten valid records appeared between the concurrent original inventory and frozen final verification (three movie, seven TV). The separate unresolved quarantine population is 171 source documents across three movie aliases.

Both collections now enforce a nonpartial unique `(tmdb_id, country_code)` index and a strict validator requiring positive integer IDs, exact uppercase two-character country codes and ready identities. Live rollback-only transaction probes on each collection confirmed duplicate rejection (11000) and rejection of unready records, newline-suffixed countries and noninteger IDs (121). Valid positive controls were also inserted and aborted; no probe records persisted.

The maintenance gate is open and all four schedules were restored to their original enabled state: streaming publication, provider initialization, priority crawl and scheduled country crawl.

## Scheduled progress after reopening

The first resumed scheduled parent `01a0a468-23cb-0f6d-a978-8ee96a40fbe3` produced actual fresh source successes for movie 18 in Luxembourg/Netherlands and TV 42412 in Iceland/South Korea. Each country was present in the reopen pending baseline, its source timestamp advanced, its failure count is zero, and its pending marker was removed. Representative fetch jobs are `01a0a468-66d4-dcf3-5f99-5b49f051836d` (movie/Luxembourg) and `01a0a468-7737-c172-3b01-e1c04a0226a3` (TV/South Korea).

The live read-only monitoring check `01a0a468-9d13-6aac-81f5-d4fe90e45087` at 09:31:55 UTC confirmed the gate open, both full unique indexes present, all three quarantine markers retained, and pending counts down to 68,335 movie / 16,323 TV with zero pending failures at that observation. Counts continue changing as schedules run.

Scoped repository commits contain the deployed runtime protections, operator tooling, focused tests and this evidence. Unrelated workspace edits are excluded from integration.

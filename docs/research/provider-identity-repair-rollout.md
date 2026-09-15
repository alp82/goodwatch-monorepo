# Provider identity repair rollout

September 15, 2026. Live rollout in progress; this document is updated as evidence completes.

## Independent review and additions

Reviewed the transaction/archive implementation and reran its real MongoDB replica-set tests. Added:

- Lossless quarantine for a whole title whose stored numeric ID conflicts with its watch URL. Originals are copied transactionally into `provider_identity_quarantine`; a durable `provider_identity_unresolved` marker prevents either initializer from recreating those sources and freezes the entire published title, including API availability. Quarantines remain separately visible in verification counts.
- A count cross-check on every archived Crate title snapshot so a truncated SQL response cannot be accepted as a complete backup.
- Two pending-repair slots in each five-country scheduled batch, respecting eligibility, source leases, shared upstream blocking and failure backoff. Ordinary due work retains three slots. A partial eligibility index covers pending repairs.
- Full verification uses server counts and a conservative canonical-URL fast path; every noncanonical candidate is checked with the existing exact parser. Differential tests cover malformed BSON, missing fields, Unicode slugs, percent-encoded query values, wrong IDs/countries and control characters. Exact two-character country length closes the regex trailing-newline loophole.
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

Current actual priority verification parents:

- `01a0a43a-46f1-b37a-6382-13816bb2fb0e`: movie 526028 and TV 69283.
- `01a0a43a-473d-b310-c2af-514970b49f49`: movie and TV 406.

Both parent flows completed and their real Crate queue rows were read back after acknowledgment. The original-failure sample acknowledged movie 526028 demand 90 and TV 69283 demand 132 with overall success. The overlap sample acknowledged movie 406 demand 0 and TV 406 demand 133 with partial success due only to movie 406/Niger being in source backoff. All four queue leases were cleared.

Movie 526028/Argentina publishes three offers. TV 69283/Australia has no remaining scrape URL/price/quality contribution after the verified empty scrape; two current API offers remain correctly published. An empty scrape does not erase independently verified API availability.

## Deployment handling

Only scoped Python paths are deployed via the Windmill API with captured parent hashes, schemas, locks and runtime fields. Windmill automatically rebuilt dependent script locks, including an unwanted standalone `bson` package and Python upgrades. Those generated locks were replaced with the repository's known-good pinned locks. Four actual read-only Windmill jobs imported the complete fetch, priority initializer, bulk initializer and priority publisher dependency chains and verified that the new guards were loaded.

Full replay/production evidence and recoverable source/publication archives are in the private directory `/home/alp/.local/state/goodwatch/provider-identity-repair`. Credentials are loaded in memory and are not included in repository artifacts. Exact schedule states are retained in `paused-schedules.json`; archive receipts reference their durable paths and hashes.

## Capacity and execution

The scheduled crawler runs every 20 seconds. Two repair slots per media type imply a theoretical ceiling of 8,640 repaired countries per day per media type: roughly eight days for the movie backlog and two days for TV, before pauses, upstream limits and failed retries. This is capacity arithmetic, not a freshness promise. Existing published availability remains frozen per pending country until verified success.

Structural application uses 200-title checkpoints and 32 bounded workers. Country replacements are grouped into one ordered Mongo bulk operation within each title transaction. Complete Crate snapshots are fetched per checkpoint and independently checked against per-title counts before archiving. A separate four-worker verifier checks archive hashes, source after-hashes and unchanged publication while the gate remains closed. Interrupted execution resumed from majority-committed receipts without losing completed titles.

## Remaining rollout work

Complete sample publication/acknowledgment verification; apply the full checkpointed batches and lossless quarantines; perform final full invariant verification and install nonpartial unique indexes/strict validators; restore schedules and verify real pending-repair progress; integrate the scoped code into the repository so future deployment retains the protections.

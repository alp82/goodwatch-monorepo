# Shared awards pipelines

The domain and migration rationale are in [the model document](award-model-proposal.md) and [ADR 0014](../adr/0014-separate-award-observations-from-entries.md).

## Storage and consumers

`f/awards/registry.py` owns reviewed program/category aliases. Categories, ceremonies and entries use persisted UUIDs. Program keys are internal family/program codes; provider identifiers are explicit crosswalks. The original TVDB collections and `tvdb_nomination` table remain available for audit/rollback. No existing actor or character image data is removed.

`award_raw_snapshots` manifests refer to compressed, hashed chunks in `award_raw_chunks`. `award_scopes.active_revision` selects a fully committed source snapshot. Historical observations retain their source, stable record identity, references, flags and raw snapshot pointer. Source normalizer versions invalidate adapter checkpoints, allowing replay without another TVDB crawl.

`award_entries` embeds explicit recipients, recognized/context works, supported portrayals and observation evidence. Missing or ambiguous ceremony/recipient data remains unresolved. Shared `award_title_display` and `award_person_display` views select the generation in `award_publication`. Title pages, award badges, quick views, Discover, the awards hub, person pages and MCP consume these shared read models. Per-person results are bounded highlights with partial coverage; no competitive totals are exposed.

Wikidata reads incoming P166/P1411 and category-owned P1346/P2453 statements, preserving GUIDs, rank, for-work, date, ceremony, recipient and character qualifiers, plus reference URLs. Only explicit, unique TMDB IDs with local existence checks become catalog links; title IMDb conflicts/deleted source titles are withheld. Person identity never comes from a title's cast. A character needs explicit role evidence and an exact person/title/credit match; otherwise the external role evidence remains unverified.

## Schedules (UTC)

| Script | Frequency | Purpose |
|---|---|---|
| `f/awards/tvdb` | Every 15 minutes | Normalize changed saved TVDB category snapshots; up to 1,000 scopes/run. |
| `f/awards/wikidata` | Every 15 minutes, minute 2 | Up to 12 minutes of resumable category imports; weekly refresh per completed category. |
| `f/awards/discovery` | Sunday 02:20 | Discover categories for the 21 reviewed award programs. |
| `f/awards/materialize` | Every 5 minutes, minute 3 | Reconcile committed scope revisions and atomically publish a serving generation. |
| `f/awards/health` | Every 15 minutes, minute 9 | Fail on stalled normalization, reconciliation/publication or repeated category failures. |

Discovery and ingestion have independent leases, so weekly discovery can run while a historical category import is active. The Wikidata query service also shares a database query budget with the existing external-ID backfill. Queries honor cooldowns/429s and identify GoodWatch. Statement identities are paged before qualifier details; completed detail batches are checkpointed, so a deferred run resumes without publishing a partial category. Metadata is cached for seven days. A complete fetched scope remains staged while normalization finishes. Operational runs expire after 90 days; source evidence does not.

## Rollout and recovery

1. Run `f/awards/schema(dry_run=false)` to create the neutral Crate tables and views.
2. Discover Wikidata categories and import initial categories; run `f/awards/tvdb` to replay all 594 existing source categories. No TVDB API re-download is required.
3. Run `f/awards/materialize`. Validate active source counts, local title/person IDs, source attribution and known examples, including Cillian Murphy's 2024 Oscar for Oppenheimer. Five invalid/future TVDB years stay excluded from public display.
4. Deploy the application and pipeline scripts, verify the enabled schedules and their first successful runs, then set Mongo `award_state._id='legacy-publication', disabled=true` after pre-deployment TVDB publishers have drained. The legacy character publisher continues normally.
5. Initial discovery currently covers 581 category relationships, plus program roots. Track queue rows with `fetched_at`, `due_at`, `fetch_failures` and staged fetch checkpoints. Estimate remaining time from committed scopes per worker minute and the 12/15-minute duty cycle; do not treat discovery as complete population.

For rollback, the old TVDB tables and raw snapshots remain intact. Deploy the prior application read path and clear the legacy-publication flag if resuming its award publisher. A serving-only rollback can set the single Crate publication pointer to the retained previous published generation and refresh that table. Do not delete/rewrite source observations to repair a read model: replay the adapter or reconcile a new generation instead.

The read-model publisher retains the current and one prior successful generation and prunes older serving rows. Source withdrawal only replaces that source's active scope. Unmapped works, people and uncertain categories remain evidence for later resolution rather than guessed links. Coverage stays partial until a separately validated complete slate, recipients and outcomes justify changing it.

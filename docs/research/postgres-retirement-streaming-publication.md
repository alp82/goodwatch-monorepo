# Streaming publication and provider crawl handoff

Research date: 2026-09-10. Read-only investigation; no production changes.

## Finding

Two defects combine: targeted publication assumes every selected title has a processed provider document, while the targeted provider branch passes initialization **counts** to a function expecting provider document **IDs**. A `KeyError` guard alone would hide the second defect. Neither path needs the retired PostgreSQL cluster. [Publisher](../../goodwatch-flows/windmill/f/priority/publish.py), [streaming transformation](../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py), [priority flow](../../goodwatch-flows/windmill/f/priority/crawl_all.flow/flow.yaml).

## Evidence and causal chain

1. Initialization upserts one provider document per `(tmdb_id, tmdb_watch_url)`, setting `created_at` on insertion and updating title/popularity. It deliberately does not set `updated_at`. MongoDB documents that `$setOnInsert` applies only on insertion; this is a pending-work marker, not evidence of corruption. [Initializer](../../goodwatch-flows/windmill/f/tmdb_web/tmdb_init_providers/main.py), [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/).
2. The targeted initializer returns `{count_new_movies, count_new_tv}`. Priority flow module `u` forwards that result as `next_ids`. Its iterator calls `get_documents_for_ids`, which reads `movie_ids` and `tv_ids`, defaults missing keys to empty lists, and queries Mongo `_id`, not TMDB ID. Consequently the branch schedules no provider fetches. Passing original detail-document IDs directly would also be wrong because provider documents have their own IDs and there are multiple countries per title. [Initializer update](../../goodwatch-flows/windmill/f/tmdb_web/tmdb_init_providers/update.py), [flow](../../goodwatch-flows/windmill/f/priority/crawl_all.flow/flow.yaml), [iterator](../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/iterate.py), [ID helper](../../goodwatch-flows/windmill/f/data_source/common.py).
3. Read-only Windmill API inspection on 2026-09-10 confirmed deployed `f/priority/crawl_all` module `u` uses `results.j`; deployed `f/tmdb_web/tmdb_init_providers/update` content exactly matches the repository. Sources: authenticated `GET /api/w/goodwatch/flows/get/f/priority/crawl_all` and `GET /api/w/goodwatch/scripts/get/p/f/tmdb_web/tmdb_init_providers/update` at the configured Windmill remote. Tokens are omitted.
4. Successful provider fetches set `updated_at`; rate-limit failures set `failed_at` without falsely refreshing `updated_at`. The per-title provider loop permits skipped failures. Thus even after the handoff fix, partial country coverage remains a valid state that publication must handle. [Fetch/store](../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/fetch.py), [provider loop](../../goodwatch-flows/windmill/f/tmdb_web/crawl_all_by_id.flow/flow.yaml), [Windmill loop semantics](https://www.windmill.dev/docs/flows/flow_loops).
5. Targeted publication uses `recent_only=False`, selecting pending documents too. `fetch_all_documents_in_batch` then discards rows lacking either timestamp. Indexing `tmdb_all_providers[tmdb_id]` raises when every country for a selected title was discarded. Scheduled synchronization usually avoids this all-pending case because it selects a recent `updated_at`. [Transformation](../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py), [publisher](../../goodwatch-flows/windmill/f/priority/publish.py).

The parent investigation executed the actual helper extracted with Python AST against live MongoDB using `/tmp/gw-provider-audit.py` (read-only). The four failing TV titles reproduced `KeyError`; all documents had `created_at` and none had `updated_at`:

| TV TMDB ID | Provider documents | Missing `updated_at` |
| --- | ---: | ---: |
| 1859 | 2 | 2 |
| 226254 | 1 | 1 |
| 240442 | 1 | 1 |
| 245170 | 77 | 77 |

Movie 1859, a distinct media identity, had 94 valid documents. This is a targeted reproduction, not a full collection audit; additional pending or mixed-state titles may exist. The reported ten failures refer to the earlier observation window, not ten distinct titles.

## Publication semantics and recommended approach

**Recommendation:** repair the handoff and make incompleteness explicit. Resolve every existing/new provider document for the selected TMDB titles and return its provider `_id`, or change the iterator contract to accept explicitly named TMDB IDs and resolve them there. Validate required input keys rather than silently treating count objects as an empty request. Preserve the initializer's useful counts separately. Cover both previously initialized and newly inserted provider rows; returning only newly inserted rows would skip refreshes. This recommendation follows the current multi-country document model and call chain above.

For all-pending titles, preserve current streaming fields and freshness timestamps and return `deferred` with a reason/count, rather than creating empty arrays or fabricated timestamps. For mixed processed/pending countries, apply only verified source results without erasing unprocessed country data. A genuinely successful empty response must be distinguishable from “never fetched” so obsolete availability can eventually be cleared intentionally. This is proposed behavior requiring an explicit product decision, not a claim that current code implements it.

The distinction matters because current transformation builds fresh streaming arrays from available sources and upserts them into the media row. Crate upserts preserve SQL null through `COALESCE`, but empty arrays are real replacement values. Child availability rows are upserted without deletion, so naive replacement can also leave stale child rows while media arrays say something else. Keep media aggregates and child availability consistent; scope deletion to a source/country verified by a successful fetch. [Transformation](../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py), [Crate upsert](../../goodwatch-flows/windmill/f/db/cratedb.py).

The current publisher validates exact detail-row coverage but not streaming coverage, then the flow acknowledges all claims after publisher success. Queue acknowledgment updates last-success and applies a seven-day cooldown; calling a skipped streaming update “success” can delay recovery. [Publisher](../../goodwatch-flows/windmill/f/priority/publish.py), [reset](../../goodwatch-flows/windmill/f/priority/reset.py), [queue](../../goodwatch-flows/windmill/f/priority/queue.py).

Recommended initial policy: incomplete streaming prevents acknowledgment of that title unless a separate, durable provider retry path is explicitly accepted. Publish unrelated valid data, report deferred titles, and avoid starving healthy titles in the same batch. Per-title acknowledgment is a real contract change to the current all-claims reset, so ticket estimates must include it if selected. A strict batch failure is simpler initially but repeats unrelated work. Do not silently acknowledge incomplete streaming under the existing cooldown.

## Proposed ticket

**Title:** Repair targeted provider crawling and publish incomplete streaming data safely.

Scope:

- Correct and validate the initializer → iterator input contract for all countries and existing records.
- Represent processed-empty, processed-with-links, pending, and failed country results distinctly; never invent `updated_at`.
- Implement the agreed preservation/partial-publication and acknowledgment policy with observable counts/reasons.
- Keep media aggregate fields and availability rows consistent for country-level updates.
- Replay TV 1859, 226254, 240442, 245170 after the shared Qdrant connectivity fix; retain pre/post evidence and preserve newer poster demand.

Acceptance:

- A real targeted title with provider rows schedules a nonzero number of provider fetches; initialized and existing rows are both covered.
- Tests cover all-pending, mixed processed/pending, processed-empty, absent providers, rate-limited fetches, movie/show ID collisions, and unchanged existing availability for deferred countries.
- No `KeyError`, false freshness timestamp, accidental availability clearing, or silently acknowledged incomplete title.
- Replay evidence links fetched countries, Crate writes, Qdrant publication, and the agreed acknowledgment/defer outcome; normal scheduled sync remains compatible.

## Decisions for the combined interview

1. Is streaming completeness required to acknowledge a poster-driven refresh, or may it complete using retained availability while a durable independent provider retry remains pending? Recommend requiring completion initially unless the independent retry has explicit ownership and a freshness target.
2. For one failed country among many, should successful countries publish immediately with retained failed-country values? Recommend yes; make partial freshness visible operationally.

## Limits and adjacent work

This investigation verified the live handoff definition and reviewed source semantics; the table uses the parent agent's fresh live reproduction. It did not exhaustively count pending country records or verify every affected title's current Crate state. An impact query and before/after replay belong in implementation. Recovery of the orphaned broad provider schedule is covered by the separate provider/monitoring ticket; repairing that schedule alone does not repair the targeted handoff. Qdrant connectivity is separately required before a complete replay can pass.

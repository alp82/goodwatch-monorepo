# Media text production: canonical season/episode translations

2026-10-14, `feat/media-language`. Owner Q1–Q3 supersede the earlier phase-3b page-prose plan. **Only media fields are localized.** No migration, production write, deployment, real TMDB fetch or paid translation ran in this follow-up.

## Scope and source inventory

| Content | Canonical source | Release behavior |
| --- | --- | --- |
| Title FAQ | `ui/details/titleQuestions.ts`: availability, scores, certification, duration, budget/revenue, origin and dates | Deterministic English templates as before; no locale resource or source job |
| Title fingerprint narrative / skip conditions | `ui/fingerprint/fingerprintText.ts`: fixed dictionaries, score/pillar thresholds | Canonical English; scores and driver order unchanged |
| Taste portrait identity/line/side/edge/everyone/family descriptions | `taste-portrait/{words,fingerprint,sides,everyone,families}.server.ts` | Deterministic English; no translated profile resources/lookups |
| Category subtitle/description/FAQ | `ui/explore/category/*.ts` | Handwritten canonical English |
| Essence text/tags | `f/dna/generate/fetch.py` → Mongo DNA → `f/sync/copy/dna_data.py` → `movie/show` fields | Model-authored canonical output as before; no localization job or request-time lookup; existing generation unchanged |
| Title/poster/overview/tagline | Canonical `movie/show`, existing `translation`/`media_image` | Batched media overlays with per-field source/language |
| Season/episode names/overviews | TMDB canonical season/episode IDs plus additive translation tables | Only proved stable IDs after canonical membership/rating alignment; missing translations preserve the entity |

Owner **Q2/Q3:** the 14-locale template pack, model/reviewed-template translation jobs/importers, prose runtime readers/types/tests and proposed `prose_translation` table definition were removed. There is no dormant lookup, scheduler or paid prose path to enable. No cost estimate or prose-review checkpoint is relevant to this release; historical `media-language-text-verification.json` records the earlier committed phase, not current scope.

## Additive Crate schema

`docs/implementation/media-language-text-schema.sql` contains **only two tables**; the same definitions remain registered in `f/sync/models/crate_schemas.py`. PK `(show_id,tmdb_id,language_code,country_code)`, clustered by show, six shards, replicas `0-1`, name/overview only. `tmdb_id` is the real season/episode ID, never its display number. Overview has no index/column store. No DROP/DOWN/delete or canonical episode backfill is included.

**Owner Q1:** apply only after the branch is on main, coordinated by the owner, before any `--apply` ingestion. No application was made here. Missing tables are detected and yield English fallback; table-presence results expire after five minutes with no stale window.

## Season/episode ingestion

The active canonical pipeline is `tmdb_fetch_episodes_from_api/fetch.py` → Mongo season documents → `sync/copy/tmdb_episodes.py`; `episode_catalog.py` owns completeness/removal. The new independent Windmill companion is `f/media_language/ingest_episode_translations`, backed by `episode_translations.py`. It deliberately does not enter canonical membership/removal logic. It is callable on the same explicit priority IDs after the canonical episode fetch. **No schedule was enabled and no existing scheduler/deletion path changed.** Omitted/None dry-run arguments stay read-only.

The companion reads the canonical TMDB show/season catalog to obtain stable IDs, then the official [season translations](https://developer.themoviedb.org/reference/tv-season-translations) and [episode translations](https://developer.themoviedb.org/reference/tv-episode-translations) endpoints. Every translation response must identify the expected stable ID. A failed or malformed response contributes no writes. Only supported language/region records with nonblank fields are published. Responses are staged per title before publication. Any fetch failure or bounds hit makes the cohort partial: publication may insert locales or fill missing fields, but SQL preserves every existing nonblank field. Only a complete successful cohort may refresh returned nonblank fields. Neither mode clears missing fields, removes omitted locales or touches canonical season/episode rows. Duplicate locale entries merge only nonblank fields. Successful independent endpoints survive a later failure as additive writes, with existing text protected. Rerunning fills gaps; translation absence is never evidence of episode deletion.

From repository root, default dry run (explicit IDs are the priority list):

```sh
TMDB_ACCESS_TOKEN=... python goodwatch-flows/scripts/backfill_episode_translations.py \
  --titles 1396,1399 --max-titles 2 --max-seasons 10 --max-episodes 100 \
  --max-requests 250 --requests-per-second 2
```

`TMDB_API_KEY` is also supported. Nothing prints the credential or HTTP error body. Limits are global per run, never more than 100 titles / 100 seasons / 1000 episodes / 5000 requests / 5 requests per second; requests are serial with timeouts. `truncated` and path/error-class failures are reported. Optional per-title caps (`--max-seasons-per-title`, `--max-episodes-per-title`; Windmill `max_seasons_per_title`, `max_episodes_per_title`) stop one long show without ending the run; they cannot exceed the run-wide caps. Long shows continue by paging: every title a bound cuts short gets a cursor in `continuation` (`tmdb_id`, the first unfetched `season_number`, and `episode_number` when it stopped mid-season), and titles a run never reached are listed in `unstarted`. Pass the continuation list back (`--resume file.json`, Windmill `resume`) with the same titles to fetch only what is left; seasons before the cursor are skipped in catalog order, and a mid-season cursor skips the season text it already fetched. A cursor whose season has left the catalog records a `LookupError` failure for that title and writes nothing. There is no unbounded catalog or priority-queue scan. The caller can pass its selected priority IDs in descending priority order.

Owner-approved publication adds `--apply` and uses the existing Windmill-configured `CrateConnector`. **Owner Q1 permits this only after the branch lands on main; the owner coordinates schema and execution.** Do not use `--apply` before that condition and migration. No migration/publication ran here. Real TMDB credentials were not configured in this worktree/environment. Verified the offline CLI instead:

```sh
python goodwatch-flows/scripts/backfill_episode_translations.py --titles 1396,1399 \
  --fixture goodwatch-flows/tests/fixtures/media-language-tmdb.json
```

Fixture IDs/text are mocked, not production coverage evidence. Result: 8 requests, 2 seasons, 2 episodes, 4 translation rows, zero failures, dry-run true. A fixture can never be combined with `--apply`.

## Regrouped display seasons

Release policy confirmed: **canonical season text only where a canonical stable season ID exists**. Reviewed split/merged display buckets keep their English season-number interface labels; canonical season translation must not be attached by display number. Episode translations still apply through proved stable episode IDs after rating alignment.

The smallest future stable bucket identity is `(show_id, alignment_namespace, explicit_bucket_key)`, with the key owned by the reviewed mapping and independent of its display ordinal. Keep the sorted member-TMDB-ID hash as a separate **text source revision**, not as identity: adding/renumbering an episode should not create a different bucket, but must invalidate misleading bucket prose. A direct canonical-season join is permissible only with proved equivalent membership. No synthetic identity/table or inferred membership was introduced in this release.

Design note with the reading rule and when to build it: [regrouped display seasons](media-language-regrouped-seasons.md).

## Read-side safeguards and preview

Ordinary grids enrich IMDb cells with proved canonical TMDB IDs in one show-scoped query per cold grid build. Unique external IDs win; otherwise a unique real title on each side of the same season proves the match (including renumbering). Equal numbers, placeholders, contradictory external IDs and ambiguous names do not join. Ratings, numbering and membership are untouched. `episode-grid-media-v2` separates older cached grids without IDs. Reviewed grids retain their mapping-owned IDs. A failed identity read preserves the rated grid without localization rather than hiding it.

Text candidates for Arabic, Russian, Japanese, Korean and Chinese must contain expected-script letters when the candidate contains letters. Latin-only mislabeled translations are missing for that field; numeric/punctuation-only titles and mixed proper names remain allowed. Region/script family selection still governs Chinese/Portuguese text; this is a script check, not a semantic or Hans/Hant-quality validator. Posters retain base-language selection. Rejected/missing rows fall back with honest field-language metadata.

`GET /api/media-title?type=movie|show&id=<id>&displayLanguage=<tag>` is a media-only, read-only preview: title/poster/overview/synopsis/tagline and presentation metadata. No essence/template/prose projection or generation is added. Cache namespace `localized-title-payload-v3`, type/ID/full language plus canonical/live render policy, 30m/no stale, no country/account dimension; bots canonical/private. Optional fields in older responses remain harmless to existing consumers.

## Verification / rollout

Native Node tests cover script and per-field fallback, no prose table lookup, grid stable identity and fallback, special wire indices, batching/query counts and mixed-version APIs. Python unittest covers bounded completeness-safe ingestion and the two-table schema. [Rollout](media-language-rollout.md) records TTL/cardinality, search-role compatibility, deployment order, read-only probes and rollback; saved pairs and translation rows are not deleted by rollback.

The fixture dry run uses only local mocked payloads. Actual TMDB quality/coverage, Crate schema execution/publication, browser RTL and landing budget remain production/UI release checks; none is inferred from the fixture. No paid prose checkpoint remains. The season/episode execution condition is main plus owner coordination.

# Media text production and revision-matched readers

2026-10-14, phase 3b, `feat/media-language`. Changes are uncommitted for orchestrator review. No migrations, production writes, deployment or paid requests were executed.

## Sources and revisions

| Content | Actual source in this checkout | Revision / production boundary |
| --- | --- | --- |
| Title FAQ | `app/ui/details/titleQuestions.ts`: streaming, scores, certification, duration, source keywords, critic/audience comparison, budget/revenue, airing dates, languages, countries and tropes | Deterministic, **not model prose**. Canonical question + answer SHA-256, source facts and country, plus `media-facts-v1` resource revision. Prepared after display-season alignment. |
| Title fingerprint narrative / skip conditions | `app/ui/fingerprint/fingerprintText.ts`: fixed dictionaries and score/pillar thresholds | Deterministic. Launch resources provide compact factual pillar verdicts/sentences and the existing nine skip conditions. Scores/driver order remain canonical. |
| Taste portrait identity, line, side/edge names and leads, everyone headline, family descriptions | `taste-portrait/{words,fingerprint,sides,everyone,families}.server.ts` | Deterministic, **not a model-generated personal profile**. Variable blocks use `template:<SHA-256 of canonical UTF-8 text>`, and the same hash as revision. Fixed family description resources exist for all launch locales. |
| Category subtitle/description/FAQ | `ui/explore/category/*.ts`, through `$type.$category.$page` | Handwritten fixed content. Reader recognizes `pageData` prose and `faq[].q/a`; content-addressed reviewed translation rows can supply it. Navigation/filter names stay English. |
| Essence text and essence tags | `f/dna/generate/fetch.py` → Mongo DNA → `f/sync/copy/dna_data.py` → `movie/show.essence_text/essence_tags` | Model prose. Current generator uses OpenRouter `qwen/qwen3.8-flash`, Alibaba, reasoning disabled; economy generation also has `qwen/qwen3.7-flash`. Translation uses the primary model and pinned provider. Revision is SHA-256 of the **currently published canonical text bytes**, rather than an ingestion timestamp. |
| Search interpretation, match reason controls, availability/progress controls | Existing search/ranking/view modules | English interface and canonical computation. No translation/generation is inserted into ranking, retrieval text, embeddings or matching. |

`app/locales/media/templates.json` has 57 named draft strings per locale for **en, de, fr, es, it, pt-BR, pt-PT, ja, ko, zh-Hans, zh-Hant, pl, ru, ar**, with `reviewStatus: owner-review-required`. These are locally drafted resources, not paid output. They load on the server; the browser receives the selected projection, not all 14 dictionaries.

**Owner review point:** the non-English title FAQ/fingerprint projection is deliberately compact factual wording, not a sentence-by-sentence reproduction of the richer English narratives. FAQ retains availability services, classification, counts, ratings, budget/revenue, origin and dates where present; it omits some English elaborations. Certification-less advisory-only answers remain English with provenance. Fingerprint uses actual pillar tiers (0–4) and unchanged driver scores; detailed adjectives are replaced by localized tier statements. Check this copy before release. Variable portrait prose, handwritten category prose and inline narrative sentences remain canonical English until reviewed blocks are supplied. These are content gaps, not missing reader wiring. Fixed descriptions and title templates require no job or spend.

## Crate schema

Apply **only at an owner checkpoint**: `docs/implementation/media-language-text-schema.sql`. The same three table definitions are registered in `f/sync/models/crate_schemas.py` for fresh installs / the existing initializer. This is additive, with no DELETE or canonical episode backfill.

- `season_translation` and `episode_translation`: PK `(show_id, tmdb_id, language_code, country_code)`; routed by show; `name`, `overview`; six shards, `0-1` replicas. `tmdb_id` is the actual TMDB season/episode ID, never a display number. Language/country storage matches the existing overlay reader's Chinese/Portuguese region rules. Overview has no index/column store.
- `prose_translation`: PK `(source_id, source_revision, language)`; text, valid/failed status, validation revision, provider/model, cumulative attempts/token usage/cost; three shards, `0-1` replicas. No model work occurs in readers.

Model source IDs: `movie:603:essence_text`, `show:1396:essence_text`, and `movie:603:essence_tag:<SHA-256 of canonical tag>`. Content-addressed tags survive reordering; changes create a new source/revision. Template source IDs use `template:<canonical-text-hash>` without account IDs. Old revisions coexist and never become eligible through a “latest translation” lookup.

## Season/episode ingestion

The active canonical pipeline is `tmdb_fetch_episodes_from_api/fetch.py` → Mongo season documents → `sync/copy/tmdb_episodes.py`; `episode_catalog.py` owns completeness/removal. The new independent Windmill companion is `f/media_language/ingest_episode_translations`, backed by `episode_translations.py`. It deliberately does not enter canonical membership/removal logic. It is callable on the same explicit priority IDs after the canonical episode fetch. **No schedule was enabled and no existing scheduler/deletion path changed.** Omitted/None dry-run arguments stay read-only.

The companion reads the canonical TMDB show/season catalog to obtain stable IDs, then the official [season translations](https://developer.themoviedb.org/reference/tv-season-translations) and [episode translations](https://developer.themoviedb.org/reference/tv-episode-translations) endpoints. Every translation response must identify the expected stable ID. A failed or malformed response contributes no writes. Only supported language/region records with nonblank fields are published. Responses are staged per title before publication. Any fetch failure or bounds hit makes the cohort partial: publication may insert locales or fill missing fields, but SQL preserves every existing nonblank field. Only a complete successful cohort may refresh returned nonblank fields. Neither mode clears missing fields, removes omitted locales or touches canonical season/episode rows. Duplicate locale entries merge only nonblank fields. Successful independent endpoints survive a later failure as additive writes, with existing text protected. Rerunning fills gaps; translation absence is never evidence of episode deletion.

From repository root, default dry run (explicit IDs are the priority list):

```sh
TMDB_ACCESS_TOKEN=... python goodwatch-flows/scripts/backfill_episode_translations.py \
  --titles 1396,1399 --max-titles 2 --max-seasons 10 --max-episodes 100 \
  --max-requests 250 --requests-per-second 2
```

`TMDB_API_KEY` is also supported. Nothing prints the credential or HTTP error body. Limits are global per run, never more than 100 titles / 100 seasons / 1000 episodes / 5000 requests / 5 requests per second; requests are serial with timeouts. `truncated` and path/error-class failures are reported. There is no unbounded catalog or priority-queue scan. The caller can pass its selected priority IDs in descending priority order.

Owner-approved publication adds `--apply` and uses the existing Windmill-configured `CrateConnector`. Do not use `--apply` before the migration/checkpoint. Real TMDB credentials were not configured in this worktree/environment. Verified the offline CLI instead:

```sh
python goodwatch-flows/scripts/backfill_episode_translations.py --titles 1396,1399 \
  --fixture goodwatch-flows/tests/fixtures/media-language-tmdb.json
```

Fixture IDs/text are mocked, not production coverage evidence. Result: 8 requests, 2 seasons, 2 episodes, 4 translation rows, zero failures, dry-run true. A fixture can never be combined with `--apply`.

## Regrouped display seasons

Release policy confirmed: **canonical season text only where a canonical stable season ID exists**. Reviewed split/merged display buckets keep their English season-number interface labels; canonical season translation must not be attached by display number. Episode translations still apply through proved stable episode IDs after rating alignment.

The smallest future stable bucket identity is `(show_id, alignment_namespace, explicit_bucket_key)`, with the key owned by the reviewed mapping and independent of its display ordinal. Keep the sorted member-TMDB-ID hash as a separate **text source revision**, not as identity: adding/renumbering an episode should not create a different bucket, but must invalidate misleading bucket prose. A direct canonical-season join is permissible only with proved equivalent membership. No synthetic identity/table or inferred membership was introduced in this release.

## Prose jobs and safeguards

Install worker dependencies: `pip install -r goodwatch-flows/tests/requirements-media-language.txt`. Scripts resolve the existing Crate/Windmill resource only for explicit reads or publication. Model translation is **dry-run by default, cap $0**. There is no automatic paid backfill.

Bounded, read-only export after owner approval of the named sample (do not run a broad scan):

```sh
python goodwatch-flows/scripts/export_media_prose.py \
  --titles movie:603,show:1396 --output /tmp/media-prose-sources.json
python goodwatch-flows/scripts/translate_media_prose.py \
  --sources /tmp/media-prose-sources.json --locales de,ja
```

Manifest: JSON array `{source_id, text, source_revision?, kind:"model"}`. Any supplied revision must match current text. At most 1000 source blocks, supported non-English locales only. The export accepts at most 100 explicitly named titles. The dry job does not connect to Crate or initialize a provider and emits per-source token/reservation estimates.

At a separate **paid owner checkpoint**, supply `OPENROUTER_API_KEY`, `--execute --spend-cap-usd <approved cap> --ledger <durable path>`. The exclusive file lock serializes runs sharing the ledger. Reservations are appended and fsynced **before** HTTP. Reuse that ledger across restarts and all jobs sharing the cap; do not split one approved cap across different ledgers. Each attempt reserves a conservative UTF-8-byte prompt bound plus the full 4096-token completion allowance and 25% contingency. Provider routing pins Alibaba, disables fallback/reasoning and enforces maximum prompt/completion prices. A lower actual `usage.cost` refunds the difference; missing usage/timeouts keep the entire reservation. Cost-contract/ledger failures halt execution. A provider violating its own advertised max-price contract cannot be prevented by client code; it is detected and stops further requests.

Validation is local/deterministic (`langdetect`, seeded), with no model validation calls. Require nonblank text, language detection (Chinese script tag must also match), unchanged number/placeholder/markup token multisets, 0.15–5× character-length ratio and a 20,000-character ceiling. Up to three attempts, exponential waits, with every charged/unknown-cost attempt tracked. Existing valid rows for the exact revision and `prose-v1` validation revision are skipped. Failed row accounting accumulates across resumes. Bump the validation revision if the validation contract changes. Short tags and regional dialects still need owner quality review; uncertain detection rejects instead of presenting the wrong language.

Fixed template manifests **cannot enter paid execution**. For variable deterministic/category blocks use `import_media_template_translations.py --manifest <file>` (dry run), with explicit `--apply` only after owner review. Each block is `{source, source_revision, language, text, reviewed_by:"owner"}`. Source hash, local validation and duplicate identities are checked; model/cost are `reviewed-template` / $0. This does not mark the shipped draft resource pack reviewed.

## Reader contract, caching and UI handover

`overlayProsePayload(payload, language)` runs after canonical cache/matching at the shared catalog boundary and details getters. It recognizes essence snake/camel aliases, stable work keys/IDs, portrait narrative fields, category prose/FAQ, and explicitly registered `{sourceId,sourceRevision,text}` display blocks. It copies, deduplicates and reads at most 200 **exact source/revision pairs** per query; missing schema/read errors return canonical content. All eligible table rows must have the requested full locale, matching source revision, `status=valid` and `validation_revision=prose-v1`. `canonicalProse` retains the source for a second overlay; `prosePresentation[field]` (array for tags) carries `{language,source:localized|canonical|template,fallback,sourceId,sourceRevision}`. Rendering uses `proseFieldLanguage(value,field,index?)`; metadata does not change canonical matching or links.

`TitleTemplateProse` is the details loader's selected projection: `{language,revision,sourceRevision,country,questions,fingerprint:{line,briefs,sentences,skip,skipLanguages}}`. Questions have their own language/source revision. A country mismatch discards projected FAQ and computes canonical answers, rather than showing stale availability facts. The template JSON stays on the server.

`GET /api/media-title?type=movie|show&id=<id>&displayLanguage=<tag>` retains the existing DTO and adds optional `essence_text`, `essence_tags`, `prosePresentation`. Its cache namespace is now `localized-title-payload-v2`. No save, source job or model call occurs in preview. The details shape intentionally omits full essence text because it has no current panel; the endpoint supports it when a consumer needs it. About/quiz badges use tag provenance. The UI thread can use the optional fields without editing the save/preview lifetime contract.

Prose source caches include selected **full language + source IDs/revisions**, have a five-minute TTL and no stale source results. Fixed resources use exact canonical source hashes. Canonical cards/details/portrait source caches remain neutral; existing phase-3a URLs/query keys/page identities already include effective language. Keep language independent of country. No device version/provenance enters shared HTML. Deploying a resource/schema/source update needs the existing cache purge/restart policy; source/table-presence TTL and page/preview caches can delay visibility. Crawlers/OG/download/static renderers bypass localized projections and remain canonical.

## Cost estimate (no real calls)

The committed DNA test fixture has one essence paragraph and nine tags: ten source jobs/title. `estimate_media_prose_cost.py` counted **754 prompt proxy tokens and 194 source/envelope proxy tokens** using `cl100k_base`. Qwen's tokenizer is different; this is a reproducible proxy estimate, not a provider usage claim. At 1.5× output expansion: 291 completion tokens/title; at 2×: 388. Using [OpenRouter's published $0.15 input / $0.47 output per million tokens](https://openrouter.ai/qwen/qwen3.8-flash/providers), checked 2026-10-14:

- Approx. **$0.25 / 1000 titles / locale** at 1.5× output, **$0.30** at 2×, before retries, fee/tax differences and owner quality review.
- Three fully billed attempts would be approximately **$0.75–$0.89 / 1000 titles / locale** with those token assumptions.
- Conservative reservation ceiling: **$25.75 / 1000 titles / locale / attempt**, because each tag also reserves the entire 4096-token completion allowance; up to **$77.26** for three unknown-cost attempts. Actual reconciled usage can be much lower. Default approved spend remains **$0**.

```sh
python goodwatch-flows/scripts/estimate_media_prose_cost.py \
  --sources /tmp/media-prose-sources.json --locale de --output-token-factor 1.5
```

Install `tiktoken` only for this optional offline estimator. Refresh provider prices and measure an owner-approved small batch before choosing a production cap. No actual translated output/token usage or quality claim is inferred from this estimate.

## Verification

See `media-language-text-verification.json` for exact commands/results and changed files. Full Python unittest and native Node suites were run sequentially; Node test-file concurrency was bounded to one after one pre-existing timing assertion failed under the default concurrent run. Typecheck is compared to committed HEAD by diagnostic file/code/headline, ignoring shifted locations. No production build, dev server, paid generation, live TMDB request, migration/publication or deployment was performed. Browser RTL/layout/Lighthouse budget checks are left for the UI/local release checkpoint: RAM is constrained and the benchmark's default production target is not used under the no-production-write rule.

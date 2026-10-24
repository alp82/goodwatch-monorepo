# Member correction overrides: write, read, and cache inventory

Research date: 2026-10-25. Step 1 of [#766](https://github.com/alp82/goodwatch-monorepo/issues/766), under [#762](https://github.com/alp82/goodwatch-monorepo/issues/762). Inspected working-tree source at `17fe4ec71` and read both issues with `gh issue view`. Read [User feedback channels](user-feedback-channels.md), including the October 25 owner decisions. Those decisions supersede its earlier upstream-first proposal.

This investigation used local file reads and the two issue views only. No servers, jobs, databases, or other network services were accessed. Only this document was written. **Verified source** below means repository behavior, not proof of deployed behavior. **Documented cadence** means a local runbook or source comment describes a schedule. Most Windmill schedules live outside git. Their current enabled state and exact timing remain unverified.

Source references use `file:line`. Prefixes expand from the repository root:

- `F/` = `goodwatch-flows/windmill/f/`.
- `W/` = `goodwatch-webapp/`.
- `D/` = `docs/`.

## Findings

1. Imports already separate source storage from serving storage: Mongo feeds Crate, Qdrant, Redis, and process memory. Corrections must reach every serving representation. Updating a title-page response alone leaves search, filters, and member lists inconsistent.
2. Title credits exist. Season and episode credits do not have equivalent serving tables. Episode ingestion explicitly drops `crew` and `guest_stars`. Person birth and death dates have no implemented catalog fields or readers found in this checkout.
3. The compact Redis title snapshot is not a title-details document. It contains dates and numeric discovery fields, but no cast, crew, episode titles, person dates, or availability. Its change detector watches DNA timestamps only. A date correction does not trigger publication by itself.
4. Existing invalidation is local or field-specific. There is no catalog correction publication event that reaches every page process, search process, Redis cache, and browser tab.
5. Recommend a separate correction ledger and versioned effective catalog projections. Keep imports as source data. Build discovery and search artifacts from the same effective values used by detail readers. Publish and invalidate asynchronously, without query-time LLMs.

## Import and write paths

### Title credits and dates

| Writer and trigger | Store and fields | Write behavior and evidence |
| --- | --- | --- |
| TMDB API details fetch, regular queue or targeted priority crawl | Mongo `tmdb_movie_details` and `tmdb_tv_details`: movie `credits`, show `aggregate_credits` and `created_by`; `release_date`, `release_dates.results`, `first_air_date`, `last_air_date`, `seasons[].air_date` | Appended API responses are converted and assigned to the existing document, then saved. Returned fields replace their source values; this is not a member override merge. Requests: `F/tmdb_api/tmdb_fetch_details_from_api/fetch.py:115`, `:128`. Assignment and save: `:141`, `:180`, `:197`. Models: `F/tmdb_api/models.py:496`, `:531`. |
| Crate details copy, scheduled incremental or targeted/full copy | `movie.release_date`, `movie.release_year`; `show.first_air_date`, `show.last_air_date`, `show.release_year`; `season.air_date`; country-specific `release_event.release_date` with country, release type, certification, and note | Reads Mongo changes since its successful checkpoint, or a named/full selection. Assigns imported dates and derived year. Upserts partial model rows, rather than replacing every column in the title. Default conflict handling is `COALESCE(excluded, existing)`: non-null imports overwrite, null usually preserves. Date mapping: `F/sync/copy/tmdb_details.py:328`, `:414`, `:448`, `:577`. Upsert: `:155`. SQL behavior: `F/db/cratedb.py:200`. |
| Same Crate details copy | `person`; `person_appeared_in` with person, character, order, credit id, and episode counts; `person_worked_on` with person, job, department, credit id, and episode counts | Movie credits and show aggregate roles/jobs become title-level rows. Show creators become `Creator` jobs. Source-owned child rows absent from a complete payload are deleted, and stale seasons are deleted. There is no protected member flag. Mapping: `F/sync/copy/tmdb_details.py:85`, `:608`, `:647`, `:692`; cleanup: `:727`, `F/sync/copy/stale_child_rows.py:1`. Schemas and keys: `F/sync/models/crate_schemas.py:619`, `:633`, `:647`. |
| Priority publisher after targeted crawlers | The same Crate source tables, then Qdrant | Calls the shared details, ratings, streaming, tropes, and DNA copies with `recent_only=False`, then vector publication. This is a second entry point to the same writers, not a separate merge policy. `F/priority/publish.py:50`. Historical documentation describes `f/priority/crawl_all` every 20 seconds; current schedule is unverified: `D/research/tvtropes-repair/windmill-drift-2026-09-21.md:48`. |
| Vector copy, scheduled incremental or targeted priority publication | Qdrant `media_fingerprint_v1`: `release_year`, `release_decade`, title metadata, scores, fingerprint, and `streaming_availability` | Derives year directly from Mongo TMDB dates. It does not read the Crate date back. Existing points receive payload updates; points with vectors can be upserted. A correction confined to Crate therefore misses this path. `F/sync/copy/vector_data.py:49`, `:270`, `:480`, `:601`. No exact release day or full credit list is published here. Collection name: `F/sync/models/qdrant_schemas.py:6`. |
| Title snapshot publisher after scheduled vector copy, or forced manual publication | Redis `title-snapshot:current`, `title-snapshot:<version>:<n>`, optional `title-snapshot:<version>:ratings:<n>` | Reads Crate dates and analysis. Movie day is `release_date`; show day is `last_air_date`. Writes a whole immutable version, swaps the manifest, and prunes older versions except the previous one. It skips unchanged DNA source marks unless forced. `F/sync/copy/title_snapshot.py:1`, `:182`, `:219`, `:251`, `:552`, `:599`; trigger: `F/sync/copy/vector_data.py:714`. |

The details copy's fallback window is 48 hours, but normal scheduled runs use a persisted successful checkpoint. This is a selection window, not the schedule interval (`F/sync/copy/tmdb_details.py:39`, `:267`). The exact current details and vector copy cron definitions are not in the inspected source. The September audit also records the standalone details crawler as disabled then. Do not infer that it is disabled today (`D/research/tvtropes-repair/windmill-drift-2026-09-21.md:68`).

Country release events are stored separately from the title's primary date. The current main title query selects the title and seasons but does not expose a release-event list (`W/app/server/details.server.ts:46`, `:64`). An override contract must distinguish a primary date from a country and release-type event.

### Seasons, episodes, episode titles, and person dates

| Writer and trigger | Store and fields | Write behavior and cadence |
| --- | --- | --- |
| TMDB season fetch | Mongo `tmdb_tv_season_details`, keyed by show and season: season fields and `episodes[]`, including episode `name` and `air_date` | `$set` replaces each returned season's episode array. Complete fetches delete seasons no longer listed; incomplete fetches preserve missing seasons. Episode `crew` and `guest_stars` are removed before storage. `F/tmdb_api/tmdb_fetch_episodes_from_api/fetch.py:63`, `:95`; field policy: `F/tmdb_api/episode_catalog.py:21`, `:90`. |
| Episode catalog copy | Crate `episode.name`, `episode.air_date`, season/episode numbers, overview, and other catalog columns; `show.episodes_updated_at`, `show.aired_episode_count` | Compares source rows with stored rows. Changed/new episodes are upserted with `replace_nulls=True` for owned columns. Missing episodes are marked `removed_at` only after a complete fetch and purged after 180 days. Other columns, including external IDs, are not owned by this copy. `F/sync/copy/tmdb_episodes.py:39`, `:109`, `:135`, `:152`; row conversion: `F/tmdb_api/episode_catalog.py:181`. |
| IMDb dataset ingestion | Mongo `imdb_tv_episode_rating.name`; Crate `imdb_episode.name`, episode mapping and score columns; `imdb_season` aggregate scores | `title.basics` supplies another episode-name source. Mongo merges changed records with `$set`; Crate upserts owned columns with null replacement and deletes missing dataset rows. Ratings and episode mappings run daily; basics names refresh weekly. This does not update `episode.name`. `F/imdb_datasets/ingest.py:1`, `:50`, `:271`, `:309`, `:447`. |
| Bounded translation ingest and nightly episode translation runner | Crate `season_translation.name` and `episode_translation.name`, scoped by show, TMDB entity id, language, and country; also overview | Manual clean responses update returned nonblank fields. Partial/failed pages preserve existing values. Nightly ingestion fills missing text with `preserve_existing=True`. Neither path writes the canonical English `episode.name`. `F/media_language/episode_translations.py:31`, `:56`, `:237`; `F/media_language/nightly_episode_translations.py:297`, `:322`; entry point `F/media_language/ingest_episode_translations.py:8`. Documented daily window: 00:00 to 03:00 UTC, `D/implementation/media-language-nightly-episodes.md:13`. |
| Person birth/death dates | No implemented source-to-serving path found | `person` has identity, name, picture, popularity, gender, adult, and department, but no birth/death columns. The profile reader selects no dates. IMDb ingestion reads title datasets, not person `name.basics`. Evidence: `F/sync/models/crate_schemas.py:619`, `W/app/server/person.server.ts:545`, `F/imdb_datasets/ingest.py:1`. Adding these corrections also requires a source importer, schema, and presentation contract, or an explicit override-only value when source is absent. |
| Season/episode cast and crew | No implemented serving credit path found | Existing credit keys identify a movie/show, person, and credit, with aggregate episode counts. They have no season or episode identity (`F/sync/models/crate_schemas.py:633`, `:647`). The season fetch strips episode credits. A title-level credit correction cannot stand in for a season/episode correction. |

The episode queue and copy are documented as running every five minutes, with a daily TMDB change feed. A show is due daily around recent/upcoming episodes, otherwise in up to 30 days. Retry after an incomplete/failed fetch is one day. These are documented settings and source rules, not a fresh schedule read (`D/episode-catalog.md:187`, `:263`; `F/tmdb_api/episode_catalog.py:249`).

Episode air-date changes also affect aired counts and member eligibility. They are not cosmetic. The catalog copy computes `show.aired_episode_count` from its source episode rows (`F/sync/copy/tmdb_episodes.py:109`). Effective dates must drive this count too.

### Streaming providers per title and country

| Writer and trigger | Store and fields | Write behavior and cadence |
| --- | --- | --- |
| Appended TMDB API details response | Mongo title details `watch_providers` and `watch_providers_check`, with attempt/error metadata | Replaces a validated provider snapshot, keeps proof of the payload hash and freshness, and records failures separately. `F/tmdb_api/tmdb_fetch_details_from_api/fetch.py:141`, `:185`, `:286`. |
| TMDB watch-page crawler, regular queue, country retry, or targeted priority request | Mongo `tmdb_movie_providers`, `tmdb_tv_providers`: per-country `streaming_links`, timestamps, leases, retry state | Country identity and claim checks fence writes. Success replaces that country's link list, including an empty list. Failure updates retry state. Successful data is due again in seven days; failures use staged backoff. `F/tmdb_web/tmdb_crawl_providers/next.py:20`, `F/tmdb_web/tmdb_crawl_providers/fetch.py:200`, `:268`, `F/tmdb_web/country_state.py:16`, `:93`. Current queue cron is unverified. |
| Recent-release recheck | The same Mongo details and watch-page source documents | Daily 13:00 UTC is documented. It requests fresh data and leaves offer publication to the regular writer. It adds no third offer store. `F/tmdb_api/recent_releases.py:1`; `D/recent-release-rechecks.md:48`, `:91`. |
| Shared streaming copy, scheduled or targeted priority publication | Crate `streaming_availability`: title, media type, country, service, offer type, priority, TMDB link, stream URL, quality, price, timestamps; `streaming_evidence.payload`; title `streaming_country_codes`, `streaming_service_ids`, `streaming_availabilities` | Reconciles validated API/watch-page evidence under title leases. Upserts changed offer rows with null replacement, deletes removed offers by full key, and rewrites title arrays from the resulting offers. Missing/failed evidence can preserve existing countries. This is a country-aware reconciliation, not a whole-title blind replacement. `F/sync/copy/tmdb_streaming.py:341`, `:501`, `:519`, `:546`, `:593`, `:635`, `:688`; schema `F/sync/models/crate_schemas.py:691`. Documented cron is every six hours at 02:00, 08:00, 14:00, and 20:00 Europe/Berlin, not UTC (`D/recent-release-rechecks.md:54`). |
| Availability history within streaming publication | Crate `availability_history`; Mongo `streaming_history_pending` for retry/reconciliation state | Writes and closes country/service/offer-type stays under the same title leases. Uses source evidence precision and primary/premiere dates. Daily service-list evidence can also feed history, without writing current offers. `F/sync/availability_history.py:95`, `:300`, `:344`; `F/sync/copy/tmdb_streaming.py:581`; daily-list storage `F/tmdb_api/daily_list_storage.py:1`. A correction needs a decision about current watchability versus historical stays. |
| Vector publication | Qdrant `streaming_availability`, encoded `serviceId_country` | Reads the published Crate title array, encoded `country_serviceId`, and converts it. Scheduled and priority paths share this policy. Replaces that payload field under publication ownership. It does not retain offer URLs, prices, or full offer types. `F/sync/copy/vector_data.py:461`, `:610`. |
| Provider country initialization, daily or targeted | Mongo `tmdb_movie_providers` and `tmdb_tv_providers`: per-title country identity and watch URL | Initializes country work from API `watch_providers.results` and normalizes existing documents. It does not replace fetched offer lists. `F/tmdb_web/tmdb_init_providers/main.py:65`, `:75`, `:114`; priority initializer `F/tmdb_web/tmdb_init_providers/update.py:31`. Daily initialization is historically documented in `D/research/postgres-retirement-job-coverage.md:19`. |
| Provider catalog population | Crate `streaming_service` names, logos, and country ordering | Fetches TMDB provider catalogs directly, then partial upserts by provider id and media type. It does not stage a Mongo catalog. Runs in the populate-Crate flow; current cron is unverified. `F/sync/populate/tmdb_providers.py:11`, `:41`; `F/sync/populate_crate.flow/flow.yaml:89`. A missing offer for an existing service need not edit this catalog. |
| Daily provider-list snapshots | Mongo `tmdb_daily_provider_lists`, `tmdb_daily_provider_list_pending`, and leases; then Crate availability history | Replaces successful list checkpoints, buffers pending evidence, and publishes stays under ownership checks. This is evidence for history, not a current-offer writer. Default mode is a preview; the schedule is an owner-applied proposal, not verified here. `F/tmdb_api/daily_list_storage.py:80`, `:113`, `:188`, `:239`; `goodwatch-flows/README.md:142`. |

Corrections must be applied after evidence reconciliation. Editing a source offer row alone is vulnerable to the next valid source snapshot and removal reconciliation. A removal needs a persisted suppression rule; absence from an additions list is insufficient.

### Analysis and scores are flag-only

Keep these fields outside the correction allowlist. Staff can investigate a report and repair a pipeline. Members do not override computed values.

| Data | Writers and stores |
| --- | --- |
| Title analysis, fingerprint, essence, suitability, and context | DNA generation updates Mongo `dna_movie`/`dna_tv` analysis and fingerprint fields (`F/dna/generate/fetch.py:612`). `F/sync/copy/dna_data.py:170` maps them into Crate title columns, including `fingerprint_scores` and `dna_updated_at`; upsert is at `:221`. `F/sync/copy/vector_data.py:399` publishes Qdrant payloads/vectors. `F/sync/copy/title_snapshot.py:182` builds Redis numeric columns. |
| Public title scores | TMDB details supply source votes. IMDb datasets and IMDb/Rotten Tomatoes/Metacritic crawlers store Mongo ratings (`F/imdb_datasets/ingest.py:14`, `F/critic_sites/crawl.py:522`, `F/imdb_web/imdb_crawl_ratings/fetch.py:107`). `F/sync/copy/all_ratings.py:1` writes source-normalized and GoodWatch aggregate title columns; `F/sync/copy/vector_data.py:283` publishes them to Qdrant. Redis title snapshots and title cards copy those serving values. |
| Episode/season public scores | `F/imdb_datasets/ingest.py:309` writes `imdb_episode`/`imdb_season`. Critic crawlers update Mongo season documents and publish Crate season rows (`F/critic_sites/crawl.py:552`, `:666`); season TMDB votes also feed the episode grid (`W/app/server/episode-grid.server.ts:186`). These remain independent of episode-title corrections. |
| Member's own scores | `user_score` and `user_episode_score` are member data, not public catalog correction fields (`W/app/server/userData.server.ts:103`, `W/app/server/episode-scores.server.ts:298`). |

### Other jobs and historical paths

The active serving writes above are Python Windmill scripts. Webapp TypeScript contains the readers and derived cache publishers below. Its member import jobs can write external-ID links, but do not write the requested factual fields (`W/app/server/imports/tvtime-catalog.server.ts:99`, `W/app/server/imports/episode-resolver-data.server.ts:152`).

There are older catalog writers in `F/main_db/copy/tmdb_details.py:255` and `F/main_db/sync/movies_and_shows.py:414`. They write dates, seasons, release events, and title credit edges to the Arango model (`F/main_db/models/arango.py:263`, `:287`, `:352`). Their analogous credit loops start at `F/main_db/copy/tmdb_details.py:501` and `F/main_db/sync/movies_and_shows.py:709`. A third Arango path, `F/main_db/copy/tmdb_streaming.py:86`, writes availability documents, title arrays, and edges (`:157`, `:232`, `:257`). The combined sync and details copy also include streaming (`F/main_db/copy/tmdb_details.py:560`). All use the Arango connector, which omits nulls and merges duplicates with `on_duplicate=update` (`F/db/arango.py:243`, `:279`). These are alternate-store paths still present under the Windmill tree, not evidence that Arango serves current pages. Their current schedules are unknown.

Retired Postgres provider writers remain under `goodwatch-flows/retired/f/combine_data/`, including `copy_streaming_providers/populate_from_tmdb_api.py:28`. Other archived writers are `goodwatch-flows/retired/f/combine_data/copy_movies/main.py:184` (dates and title cast/crew arrays), `copy_tv/main.py:163` (show dates and credits), `copy_cast/main.py:27`, `copy_crew/main.py:27`, and `copy_streaming_provider_links/main.py:331` (offer updates/deletes, then inserts). They use Postgres conflict updates (`goodwatch-flows/retired/f/db/postgres.py:46`). The archive classification is explicit in `goodwatch-flows/retired/README.md:9`. Do not add correction handling to retired code unless it is reactivated. Local seed scripts can synthesize catalog fields for tests, such as `W/scripts/mcp-features/seed-local.py:30`, and `W/scripts/write-title-snapshot.ts:1` can publish a sample Redis snapshot. Neither establishes a production import schedule. Worker Dockerfiles package the Windmill runtime; they are not another field-mapping implementation (`goodwatch-remote/worker/Dockerfile:1`, `goodwatch-hq/worker/Dockerfile:1`).

## Read paths

The following groups include direct SQL reads, cached reads, and downstream consumers. A caller sharing a server module inherits its correction policy. The shared module must resolve effective values before a caller caches them.

| Reader or surface | Data path and consequence |
| --- | --- |
| Movie and show page loaders | `W/app/routes/movie.$movieKey.tsx:100` and `W/app/routes/show.$showKey.tsx:100` call `details.server.ts`. Its query reads title dates, season dates, country offers, and title credits (`W/app/server/details.server.ts:46`, `:64`, `:83`, `:151`). It caches canonical detail documents, then applies presentation (`:322`, `:337`). |
| Full cast and cast picker APIs | `W/app/routes/api.title-cast.ts:1` calls `W/app/server/title-cast.server.ts:12`, reading `person_appeared_in` and `person`. `W/app/routes/api.cast.tsx:11` calls `W/app/server/cast.server.ts:25`, querying people for filter choices. `title-cast-sql.ts:4` groups cast roles and order. |
| Person page, filmography, collaborators, and profile statistics | `W/app/routes/person.$personKey.tsx:93` calls `getPersonProfile`. Direct credits: `W/app/server/person.server.ts:221`; collaborator credits: `:396`; cached profile: `:487`. Top people and credit-derived statistics also read the credit tables in `W/app/server/best-lists.server.ts:137` and `W/app/server/profile/taste-stats.server.ts:270`. No current birth/death display path was found. |
| Episode grids and tracking APIs | `W/app/server/episode-grid.server.ts:169` uses mapped presentation first, otherwise IMDb names/scores and canonical episode names (`:186`, `:224`). `W/app/server/tracking.server.ts:729` reads the canonical episode list. `W/app/server/episode-presentation.server.ts:19` combines that list with IMDb names and explicit numbering mappings. `W/app/routes/api.episode-grid.ts:1` and `W/app/server/show-tracking.server.ts:63` expose these results. There are no separate production season/episode detail page loaders in this checkout. |
| Localized episode text | `W/app/server/episode-text-overlay.server.ts:54` reads `season_translation`/`episode_translation` after canonical data. The overlay is applied to aligned grids and grouped episodes (`:101`, `:112`, `:122`). An override applied before this step can be hidden by a translation. |
| My shows, Watch next, and new-episode signals | `W/app/server/my-shows.server.ts:208`, `:292`, `:346` use names, air dates, and aired counts, including direct episode SQL and the cached list. `W/app/server/show-tracking.server.ts:63` combines the member's watches with this catalog. `W/app/server/new-episodes.server.ts:1` consumes the derived show view. `W/app/server/watch-next.server.ts:261` also reads release/last-air dates directly. A date correction can change watchability and announcements without changing stored member watches. |
| Redis title snapshot and title cards | `W/app/server/title-snapshot/index.server.ts:1` loads a complete Redis version into memory and checks for a new manifest once a minute. `format.server.ts:1` documents the exact fields. `W/app/server/title-cards.server.ts:88` combines snapshot values, per-title Redis display fields, and country availability; display SQL includes `release_year` (`:301`). These are distinct caches, not one snapshot. |
| Discovery, filters, country availability, and related titles | `W/app/server/title-filter/index.server.ts:1` uses the numeric snapshot. Credit filters read `person_appeared_in`/`person_worked_on` through `id-sets.server.ts:129`. `W/app/server/availability-index.server.ts:14` loads country/service membership from `streaming_availability` (`:246`). During initial loading, filters fall back to title `streaming_availabilities`. Legacy discovery SQL and Qdrant paths remain in `W/app/server/discover.server.ts:116`, `W/app/server/related.server.ts:78`, and `W/app/server/search.server.ts:63`. |
| Search role, name lookup, reference search, and rankings | Search uses the webapp image with `WEBAPP_ROLE=search` (`goodwatch-search/docker-compose.yml:9`). `F/search/build_indexes.py:6` builds nightly Crate blobs and Qdrant reference profiles from Qdrant year/score payloads and Crate credit tables (`:155`). `W/app/server/search-ranking/search-index.server.ts:1` atomically loads those artifacts in a worker. `search-filter.server.ts:119` filters year; `references.server.ts:373` resolves people/team/studio references. Direct person lookup also exists in `W/app/server/search-people/people.server.ts:1`. Rebuilding only title pages does not update search reference credits. |
| MCP catalog and title tools | `W/app/server/mcp/data.server.ts:260` performs title/year lookup; `:621` gets native detail documents. Enrichment reads crew directly and obtains the episode grid (`W/app/server/mcp/title-details.server.ts:42`, `:66`). People tools read profiles and `getPersonCredits` (`people.server.ts:92`, `:117`). Discover/ranked tools use the native discovery/search stack. Watch links directly query current offer URLs and timestamps (`watch-links.server.ts:55`), so an added provider must have a defined link/freshness policy. |
| All-country streaming list and share lists | `W/app/server/streaming-countries.server.ts:20`, `:40` read all offers for a title. `W/app/server/share-lists/availability.server.ts:70`, `:110` cache country offers; `share-lists/titles.server.ts:73` reads title display/year fields. These bypass the title details cache. |
| OG images | `W/app/server/og-image/content.server.ts:184` obtains movie/show details; `:233` obtains person profiles. Discovery cards and profile/list cards derive from catalog readers too. Image storage is independent of loader storage (`W/app/server/og-image/store.server.ts:22`). |
| Sitemaps | Offline Python reads Crate release dates for inclusion (`W/scripts/sitemap_query.py:20`) and credit tables for people selection (`W/scripts/sitemap_people.py:20`). Last-modified calculation is separate (`W/scripts/sitemap_lastmod.py:1`). Generated XML in `W/public/sitemaps/` is a file snapshot. The documented job runs Saturdays at 03:00 UTC (`D/sitemap.md:12`); a correction does not rebuild it immediately. |
| Discord bot and stream redirect | Commands use native MCP/search readers; Discord has a second guest title-result cache. `W/app/server/discord/router.server.ts:229`, `:251`, `W/app/server/discord/title-cache.server.ts:18`, `:46`; redirect use `stream-redirect.server.ts:125`; native search transport `search-engine.server.ts:207`. A correction must invalidate the guest result or its embedded provider buttons can persist. |
| YepWatch bridge | `W/app/server/yepwatch/goodwatch.server.ts:16` reads the canonical episode list and mapped episode presentation; `:65` reads show titles/years. This is another consumer of GoodWatch data even though the interface is in another app. It inherits shared readers only where it calls them. |

Other operational readers need an explicit source/effective policy. Import matching reads episode names directly (`W/app/server/imports/episode-resolver-data.server.ts:119`), and Watcharr previews use air dates to decide which episodes existed by a watch date (`watcharr-preview.server.ts:41`). The seen-group fill job also reads episode air dates before adding member watch rows (`F/sync/tracking/fill_seen_groups.py:26`). Buzz copies title release dates into `buzz_title` and derives release/season signals (`F/buzz/store.py:76`, `F/buzz/collect.py:35`). Critic crawl scheduling reads Mongo release/air dates (`F/critic_sites/crawl.py:75`, `:199`). These consumers should not silently switch the meaning of historical observations when corrections publish.

Repository prototype readers also query the source tables. Examples include `W/app/server/prototype-rec-discover.server.ts:1`, `prototype-rec-explorer-2.server.ts:1`, and `prototype-my-library.server.ts:1`. They need either effective-table routing or an explicit unsupported status if retained. Static downloaded study CSVs, historical research snapshots, and local fixtures are not live serving readers and should not be rewritten when a correction goes live.

## Cache invalidation

Use the same dependency list for going live and reverting. `pending` and `rejected` corrections do not change public data. A revert must reveal the latest imported source value, not restore the source value captured when the report was filed.

For generic Redis data caches, the physical key is `cached-<name>:<hash(params)>` (`W/app/utils/cache.ts:511`). A resettable cache must be declared. Reset writes a cross-process marker at `cached-reset:{<physical key>}` and deletes the value. Guarded stores prevent a slow earlier refresh from repopulating the old value. Unconfirmed resets are retried (`W/app/utils/cache.ts:324`, `:353`, `:885`, `:936`). Most catalog caches below do not declare such a reset today. Generic cache TTLs below are freshness intervals. Unless explicitly disabled or overridden, `cached()` adds a stale window of the smaller of the TTL and 60 minutes (`W/app/utils/cache.ts:274`, `:631`). Direct Redis stores have their own expiry rules.

| Cache | Current lifetime and invalidation | Required correction behavior |
| --- | --- | --- |
| Anonymous HTML page cache | Process memory, keyed by build, host, URL, locale identity, and encoding. Lifetime follows response headers. `resetPageCache(predicate)` resets this process only, including in-flight renders (`W/app/server/page-cache.server.ts:14`, `:29`, `:830`). Share-list writes already use it (`W/app/server/share-lists/view.server.ts:281`). | Reach every page process. Clear affected title/person pages and pages whose result sets changed, for every country/language identity. Existing Redis reset markers do not clear HTML. Browser/shared HTTP caches also require a version/purge or bounded staleness contract. |
| Browser loader cache | Identity + route + URL. Forward/seed age 1 minute; history age 10 minutes. Revalidation bypasses it. `clearLoaderCache()` clears current-tab entries and pending loads; wrapped member writes and TanStack mutations call it (`W/app/navigation/loader-cache.ts:1`, `:20`; `instant-navigation.ts:107`, `:516`; `W/app/root.tsx:231`). | Clear and revalidate in the submitting/moderating tab. Existing session broadcast is not a catalog-change broadcast. Other tabs/devices need a catalog revision check or an explicitly accepted stale interval. |
| Canonical title details and cast | `details-movie-v2`, `details-show-v3`: 12 hours fresh plus 12 stale. `title-cast-v1` has separate parameterized entries fresh for 24 hours (`W/app/server/title-details-cache.ts:11`, `W/app/server/title-cast.server.ts:20`). | Declare/reset these caches or include an entity correction revision. Cover every country/language and cast page. Refresh source/projection visibility before allowing a refill. |
| Episode data and translations | `tracking-episode-list-v1`: 10 minutes (`tracking.server.ts:748`); `episode-presentation-v2`: show + mapping version, 10 minutes (`episode-presentation.server.ts:29`); `episode-grid-media-v3`: 6 hours (`episode-grid.server.ts:174`). Locale source keys are `episode-text-show-v3:{episode-text-show-v3:<language>}:<kind>:<showId>`, default 30 minutes in Redis and bounded memory (`episode-text-overlay.server.ts:42`, `locale-source-cache.server.ts:22`, `:59`). | Reset every derived show representation, including mapped grids and localized text. Include affected show aired-count/next-episode views. Clearing the raw episode list alone leaves derived presentation cached. |
| Person and credit-derived views | `person-profile-v2` caches a complete profile for 24 hours fresh (`W/app/server/person.server.ts:522`). Profile statistics use `profile-taste-stats:v1:<userId>` for 10 minutes, invalidated by member taste changes, not catalog credits (`profile/taste-stats-cache.server.ts:1`). Best lists have process memory (`best-lists.server.ts:188`). | Invalidate old and new credited people's views and derived statistics. A credit removal affects the previous person too. Avoid iterating every member synchronously; use a catalog revision for derived views or a background rebuild. |
| Member data cache | `cached-user-data-v2:<hash({user_id})>`, 5 minutes, no stale window. `resetUserDataCache` refreshes member tables, then performs the guarded reset (`W/app/server/userData.server.ts:19`, `:204`). | This cache contains member scores, IDs, watches, and state, not imported names, credits, or availability (`:95`). Catalog corrections alone do not require flushing all members' raw data. Clear client queries and derived member catalog views; reset raw member data only if an operation also changes member rows. |
| Title cards | Redis `title-card:v1:<numeric TitleKey>` for 6 hours, plus 10-minute display memory (`W/app/server/title-cards.server.ts:35`, `title-display-memory.server.ts:1`). | A primary date/year change requires both layers to expire or change revision. Current display memory offers whole-cache `clear`, not a distributed per-title reset. Availability on cards comes from a separate index. |
| Title snapshot | Versioned Redis chunks and current manifest; each process polls once a minute and retains the old version if loading fails (`W/app/server/title-snapshot/index.server.ts:1`, `:110`). | Publish a new snapshot after effective dates change. Include correction revision in its source mark. Current DNA-only mark can skip a date-only update. Keep the current version readable while publishing; do not delete chunks in place. |
| Credit and fallback filter sets | Redis `title-filter:v2:<kind>:<id/hash>`, 30 minutes, with in-flight sharing but no correction reset (`W/app/server/title-filter/id-sets.server.ts:23`, `:49`, `:129`). Guest filter results have another process cache for 30 minutes, keyed by snapshot version and availability state (`discover-filter-cache.server.ts:1`, `:87`). | Invalidate person sets for old/new credits and availability fallback sets. Advance a correction dependency revision for final filter-result keys too. A new snapshot version alone does not change a cached person set. |
| Availability indexes and offer caches | Country membership in process memory refreshes after 6 hours (`W/app/server/availability-index.server.ts:14`, `:215`). `streaming-countries-v1` has 12 hours fresh + 12 stale (`streaming-countries.server.ts:20`). Share-list offers have their own cache (`share-lists/availability.server.ts:70`). | Publish effective offer rows and title arrays together, then reload affected country indexes in each process and invalidate affected offer documents. Otherwise On my services can contradict title details. |
| Search artifacts and results | Crate build pointer/blob files and Qdrant reference profiles are versioned together; search processes poll and swap builds (`F/search/build_indexes.py:14`, `W/app/server/search-ranking/search-index.server.ts:263`). Legacy `search` results last 2 hours; Discover 30 minutes; related queries 24 hours (`search.server.ts:63`, `discover.server.ts:116`, `related.server.ts:78`). | Rebuild or incrementally patch credit reference indexes after credit changes. Publish effective year and availability to Qdrant before treating its filters as current. Include catalog revision in result/cursor caches that retain IDs or embedded display values. Parsing/reading a query need not be repeated by an LLM to update the catalog result. |
| MCP ranked query and paging snapshots | Redis `mcp-ranked:{<member digest>}:query:<query hash>` lasts 60 seconds; `:page:<id>` and `:view:<id>` last 15 minutes. Current keys do not include catalog revision (`W/app/server/mcp/ranked.server.ts:148`, `:235`, `:348`). | Expire or version result snapshots whose candidate sets depend on corrected credits, dates, or availability. Keep quotas and active-search locks intact. A stale cursor should expire explicitly rather than silently start a paid search. |
| Discord guest title results | `discord:title:v1:<id>:<country>:<service-set hash>`, 300 seconds. TTL-only storage; no invalidation method (`W/app/server/discord/title-cache.server.ts:5`, `:18`). | Invalidate every affected country/service-set key or add an entity revision. Guard against an earlier asynchronous read writing an old result after reset. |
| OG cards | Redis `og-card:v7:<canonical path>`, 30 minutes initially, extended to 7 days on reuse, redraw after 24 hours. Also process memory and a separate 10-second HTTP hot-card cache with a process-local `forget(predicate)` (`W/app/server/og-image/hot-cards.server.ts:22`, `:97`). `forgetStoredCard` deletes bytes and writes `og-card-reset:v1:<path>` (`W/app/server/og-image/store.server.ts:22`, `:74`). Only `/u/` paths currently opt into reset-marker checks (`og-image.server.tsx:164`). HTTP permits browser 1 day and shared cache 1 week (`og-image-route.server.ts:20`). | Extend reset support to title/person paths and clear local hot cards. Reset underlying content caches first. Use a correction-versioned OG URL or purge mechanism for external caches; Redis deletion alone cannot recall a card already cached by a social service. List/profile OGs need dependency treatment when their displayed facts change. |
| Sitemap files and other generated artifacts | Generated XML changes only when regenerated and deployed. Last-modified dates use imported timestamps (`W/scripts/sitemap_lastmod.py:1`, `D/sitemap.md:38`). | Feed effective dates/credits to the next generator. Include live/revert revision time in honest last-modified calculation. Decide whether a correction queues a targeted regeneration or waits for the weekly build. |

### Publication order

**Proposal:** accept a correction into durable storage, build its effective rows and dependent artifacts, then acknowledge publication at a revision. Use a retryable publication record or outbox rather than assuming one request can atomically update Crate, Redis, Qdrant, every process, and Discord.

1. Validate the target and field. Resolve trusted-member status through one function. Persist the suggestion and immutable audit event before queuing public changes.
2. Serialize publication by affected entity. Derive effective values from the latest source plus the winning live correction. Refresh the effective Crate tables before cache refill.
3. Update affected Qdrant payloads, title arrays, aired counts, search artifacts, and snapshot versions. Retain older complete versions until replacements are usable.
4. Advance dependency revisions and invalidate server/Redis/browser caches. Guard or version in-flight refreshes. Record publication failures and retry them.
5. Show the published revision to the correcting member and staff. Discord is the moderation interface, not the durable source of truth.

A sub-second page target is a request latency budget, not an established publication-time guarantee. The owner must choose how quickly approved values must appear everywhere and what to show during partial publication.

## Storage-shape options

These are proposals. No schema or implementation was changed.

| Option | Re-import survival | Latency | Revert and history | Read-path work |
| --- | --- | --- | --- | --- |
| Separate ledger, applied while building effective catalog projections | Source rows remain untouched. Every import republishes effective values with live corrections applied. Suppressions survive replacement snapshots. | Fast reads from indexed effective tables and existing versioned artifacts. No extra per-card correction query or request-time LLM. More write/publication work. | Append events; change active correction; rebuild from the latest source. Keep source observations separate from historical member suggestions. | Change all direct catalog readers to effective relations, plus publishers. At least ten integration groups below. The existing compact title snapshot alone cannot implement this option. |
| Separate ledger, overlay on every read | Imports cannot erase the ledger. | Bounded batch lookup can work for detail pages. Credit filters, search membership, aggregates, and country sets require overlay before filtering and pagination. Request joins and cache variation add latency risk. | Simple logical revert; immutable event history still needed. | All ten groups still need handling. Native detail helpers cover only a subset. Build-time overlays remain necessary for search/snapshot artifacts, making this a hybrid in practice. |
| Write corrected values into source rows with a protected flag | Only survives if every writer, null merge, deletion, full rebuild, and priority path honors the flag. Conflicts with #766's explicit source/override separation. | Existing readers stay fast. | Must retain incoming source updates separately to revert to today's source. A flag alone provides no audit history. | Fewer direct reader changes, but every writer must change. Cache and derived-store work remains. Missing season/episode credit and person-date schemas still need implementation. |

### Recommended shape

Use the first option: a separate ledger plus effective projections. Do not put correction metadata into Mongo imported documents, generated analysis, or the compact Redis snapshot as the authority.

A proposed `catalog_correction` row represents one suggested field change. A separate immutable `catalog_correction_event` records submission, approval, rejection, publication, and revert. A small active-pointer relation identifies the winning live correction for a target field. Use conditional updates to prevent two moderators from silently replacing each other's decision.

Proposed identity and payload:

- Target: entity kind, media type where applicable, title/show TMDB id, season TMDB id or episode TMDB id, or person TMDB id. Keep season/episode numbers as context, not the only stable identity.
- Scope: typed field name, optional language/country, and a typed item key for a credit or offer. Represent `set`, `add`, `replace`, and `remove` explicitly. An explicit unknown/null date differs from no override.
- Offer identity: title, media type, country, provider id, and offer type. An added offer needs an explicit link policy. Do not manufacture imported freshness proof.
- Credit identity: person, character/job, entity scope, ordering, and optional imported credit id. GoodWatch additions need their own stable IDs because they have no TMDB credit id. Do not replace a whole credit array to correct one character or job.
- Evidence: member id when present, report id, source link, submitted time, observed old value and source version/hash, new value, status, reviewer, and reason. Preserve all transitions.
- Publication: monotonically increasing entity/catalog revision and durable pending work. Public status and publication state must distinguish approval from successful propagation.

Maintain separate effective title/date, credit, episode, person, and country-offer projections. Import writers continue writing source rows. A shared deterministic projector reapplies current live corrections after each source update and each moderation transition. Existing read queries can keep the same field types and primary-key access patterns when redirected to effective relations. Preserve uncorrected columns through a deliberate schema contract; do not accidentally copy only the fields listed in this issue.

This is more work than one `title_correction` join. It is justified by credit filters and availability queries that must see corrected membership before pagination. Read-time presentation overlays are still useful for language selection, but corrections must have an explicit precedence over those translations.

Plan for these ten integration groups, not one title-page patch:

1. Details, full cast, and person profiles.
2. Canonical episodes, mapped grids, localized titles, and aired counts.
3. Member lists, Watch next, and new-episode views.
4. Title display cards and numeric snapshot publication.
5. Credit filters, country availability, and discovery caches.
6. Search artifact builds, Qdrant payloads, and ranked/name search.
7. MCP direct SQL and native readers.
8. Discord result caches, links, and the YepWatch bridge.
9. Share lists, profile statistics, best lists, and OG content.
10. Sitemap generation and retained prototype readers.

Reverting removes that correction from the effective calculation. It does not write the submission-time old value back into the source. When an upstream value catches up with the correction, retain the audit record and decide whether the override remains active or is marked resolved.

## Open questions for the owner

1. **Publication promise:** what is the maximum acceptable delay from approval to consistent pages, filters, search, MCP, Discord, and OGs? Does `live` mean approved, or published to all required readers?
2. **Credit scope:** can members add/remove people, change character/job/order, and correct aggregate episode counts? How should a season/episode credit affect the show's aggregate credits and person filmography?
3. **Dates:** does release date mean the primary title date, a country/type release event, or both? Are partial dates allowed? Should an air-date correction alter aired counts and announcement eligibility immediately, while preserving existing watch records?
4. **Person dates:** should the first release add a TMDB person importer and birth/death display, or permit an override-only value with absent source data?
5. **Language precedence:** are episode-title corrections canonical, language-specific, or both? Does a canonical correction replace an existing localized title, or only the source fallback?
6. **Availability:** do removals suppress one offer type or every offer from a provider in that country? Do additions require a verified URL? When does a temporary availability correction expire or need review?
7. **Availability history:** should corrections change current watchability only, or repair stays and Newly available signals too? Member evidence must not masquerade as a fresh upstream check.
8. **Trust:** what precise account-age and kept-correction thresholds apply? How are staff roles checked, trust revoked, and guest suggestions attributed?
9. **Conflicts and source changes:** what happens when two live suggestions disagree, a source credit disappears, or TMDB replaces an episode/season id? Who can supersede a correction, and when is a matching upstream update resolved?
10. **Historical and generated outputs:** can sitemaps wait until Saturday? Which OG/social previews have a bounded freshness promise? Are retained prototypes expected to reflect live corrections?

Before implementation, confirm deployed schedules and schema through a separately authorized operational check. This inventory does not claim live-state verification.

## Review and first release scope (Fable, 2026-10-25)

The inventory is accurate. The ledger direction is right, but ten integration groups is too large for a first release.

### Citation fixes

- `fetch.py:180` and `episode_catalog.py:90` point at blank lines next to the described code.
- `movie.$movieKey.tsx:100` is `relatedPrefetchBudgetMs`. The `getDetailsForMovie` call is at line 103.
- `details.server.ts:64` is a closing `: ""`, not the seasons query.
- `my-shows.server.ts:208` is a type field, not a read.
- `og-image.server.tsx:164` lacks the `og-image/` folder prefix.
- `cratedb.py:200`: callers pass `replace_nulls=True` (episodes) or `replace_null_columns`, so "null usually preserves" is only the default.

### Missed paths

- `app/server/collection.server.ts:34` orders a movie collection by `release_date`.
- `app/server/living-room/intro/netflix.server.ts:104` reads `streaming_availability` directly, with a 6-hour memory cache.
- `app/server/combined-search/search-filters.ts:122` filters on the Qdrant `streaming_availability` payload.
- `app/server/command-palette.server.ts:148` shows dates.
- `social/matcher.py:177` and `social/deterministic.py:226` match posts to titles through `person_appeared_in`.
- Webapp writes to `episode.tvdb_id` and `show.tvdb_id` must keep targeting source rows.
- `season_translation` names need the same precedence rule as `episode_translation`.

### First release

1. Crate tables `catalog_correction` (target ids, field, op `set`/`add`/`remove`, value JSON, old value, status, member, reviewer, report id, times) and `catalog_correction_event`. One live row per target field; no active-pointer relation.
2. Apply corrections in the shared readers, not at import: `details.server.ts` (dates, country offers, credits), `title-cast.server.ts`, `episode-presentation.server.ts` and the episode grid (names, after translations; corrections win), and `person.server.ts` credits. One `applyCorrections(entity, rows)` helper with a batched lookup. Imports keep writing source rows.
3. Reset only these caches on live or revert: details, title cast, episode presentation, grid and list, person profile, page cache for title and person paths, OG store (extend `resettable` to `/movie`, `/show`, `/person`), and the loader cache in the acting tab.
4. Accepted lag: discover and filter sets, title cards and snapshot, search artifacts, Qdrant, MCP ranked search, Discord, share lists, sitemaps, best lists, and the socials matcher show the source value until their normal refresh. Exception: corrected provider removals also reload `availability-index`, so the "On my services" badge doesn't contradict the title page.
5. Not in the first release: person birth and death dates (no schema), season and episode credits (no table), release events, aired-count recalculation, and availability history.

Effective projections can follow once correction volume shows which readers diverge.

### Proposed defaults for the open questions

- Q1: live means title pages, cast, and episodes within seconds; everything else by its next refresh.
- Q3: primary date only, full dates, no aired-count change.
- Q4: defer person dates.
- Q5: corrections are canonical and win over translations.
- Q7: current watchability only.
- Q8: trusted means an account at least 90 days old or at least 3 kept corrections; staff means the existing Discord staff role.
- Q9: the newest live correction wins; an upstream match marks it `resolved`.
- Q10: sitemaps wait for the weekly run; OG purge is best effort.

Q2 (add or remove credits) and Q6 (provider removal scope, URL for additions) need the owner.

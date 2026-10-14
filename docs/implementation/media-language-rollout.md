# Media-language rollout, mixed versions and rollback

2026-10-14. Prep only: no deployment, production writes or live production probes ran here. Owner scope revision Q1–Q3 applies: localize title/poster/overview/tagline and season/episode names/overviews; page prose remains canonical English. No prose translation jobs or runtime prose-table lookup are part of this release.

## Compatibility boundary

[ADR 0011](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md) allows explicitly deployed search roles to lag the page image. The proxy routes exactly `/api/combined-search` and `/api/command-palette`, with any query string, to the search roles. Page/Remix loaders, preference saves, preview, Discover, related maps and tracking APIs remain on page instances. Check `SOURCE_COMMIT` for both roles; never assume a page deployment updates search.

Verified the pre-language contract at `ad44d748^` against current code, rather than assuming every historical release is compatible.

| Contract / store | New consumer → old producer | Old consumer → new producer |
| --- | --- | --- |
| Combined-search POST body and NDJSON `reading/provisional/batch/error` envelopes | Body remains unchanged; old roles ignore the new URL parameter and return English. New consumers accept absent provenance/canonical-title fields. Ranking, paid-reading identity and ordering are unchanged. | Missing `displayLanguage` keeps the exact canonical row projection. No browser/cookie language is imposed on the old client. |
| Palette `{titles,more}` | Unknown query parameter is ignored by old loader. Missing presentation defaults to English and canonical slug uses old `title`. | Explicit API opt-in now required. This fixes the previous implicit Accept-Language/cookie localization of old palette requests. |
| Page/catalog/search/display DTOs | Core scalar fields, IDs, row order and counts stay present. Presentation/canonical-title fields are optional additions. Old source rows/missing translation tables produce canonical media. | API requests lacking the opt-in skip overlays, including viewer/card contexts. Explicit full-locale URLs can return optional per-field metadata. Interface/page prose stays English. |
| URL parameter | `displayLanguage` is separate from historical `language` (upstream matching), country, filters and typed query. Unknown explicit values normalize to English. | No parameter means canonical API response; HTML always uses recipient context independently of a page `displayLanguage` parameter. |
| TanStack/browser keys | Locale-bearing keys/URLs include normalized language, so old canonical responses occupy the requested locale's bucket with actual field language English. Related-map code accepts old packs without a language marker; it rejects an explicitly conflicting marker. | Old client caches remain canonical because old requests have no opt-in. New tuple/wire metadata is additive. |
| Detail caches | `details-movie-v2` / `details-show-v3`; canonical getter still stores English, independently of presentation language. Older show shape is isolated by version. | Additive text/ID fields are harmless. Old unversioned/v2 show readers do not consume the v3 entry. |
| Related caches | Ranking neighborhoods/`related-map-{nearest,pack,page}-v1` remain canonical. Category card identity addition already uses `related-by-category-v2-*`. Localization happens after matching. | Missing `displayLanguage` keeps canonical API payloads; old tuple consumers ignore optional seventh metadata element. Public related/map API bot responses stay canonical/private so they cannot populate the human localized URL. |
| Pair-aware user-settings cache | **Fixed:** `cached-user-settings-media-v1:<hash>` is isolated from old roles' `cached-user-settings:<hash>`. An old cache projection cannot hide the pair's country. | New writers invalidate both namespaces for ordinary settings. Old writers invalidate only the old namespace; the new cache has a 5-minute fresh TTL and no stale window. The account pair itself uses direct PK/OCC reads and wins over legacy country. |
| Preference request/response | This page-owned boundary is not routed to old search roles. A fully rolled-back page server cannot save a new pair protocol; open new tabs must reload. The client retains prior intent on missing/invalid responses. | Historical member `{settings,options}` requests remain supported by the new action. Pair Keep/Undo uses the separate complete-pair contract with version/conflict semantics. |
| HTML/static assets | In-process HTML keys include source commit, host, normalized URL, pair, render policy, header-policy bit and asset base; different page builds cannot share an entry. Keep deploy asset continuity from `webapp-deploys.md`. | Older HTML keeps its matching assets. Reverting the image starts a separate cache/build identity; do not mix an HTML body and another build's asset manifest. |

All API/catalog opt-in is additive: no new mandatory NDJSON envelope field, route renaming, query-body flag or data deletion. Do not reinterpret missing metadata as proof the selected language was served. A response without metadata is canonical English. An English fallback is a valid result, never an entity-not-found condition.

## Durable rollback

- `gw_loc` is an extra cookie. Older auth/cache parsers identify auth cookies separately and ignore this name. Old pages use their browser/legacy country behavior and English media; they do not erase the cookie. Rolling forward restores the saved choice until its normal expiry.
- `media_preferences_v1` is one extra `user_setting` row. The verified old `_convertSettingValue` skips keys absent from `UserSettingsSchema`, so JSON is not parsed as an old setting and does not crash settings reads. Old code may continue updating `country_default`; it does not delete or overwrite the pair. On rolling forward the saved pair wins over that legacy row. Do not silently mirror/delete the pair to make old UI appear current.
- Translation tables are additive and are not owned by webapp rollback. Revert the image, **not the data/schema**. Keep season/episode translation rows, old legacy country rows and saved pair JSON. Do not run DOWN/DROP/truncate, wildcard Valkey deletion or a preference cleanup.
- An older search role may remain through page rollback: no-opt-in search/palette requests return English. If desired, roll search back separately, one role at a time using the existing deployment procedure. A complete page rollback requires reloading open tabs before using the older settings UI.
- Guest/member saves retain atomic pair/OCC/request sequence boundaries in the new page code; undo is the same boundary. Never try to roll back preferences by rewriting two legacy rows.

## Cardinality and limits

Let `L=14`, `C` be active country values, `U` be distinct canonical URLs, and `B` be distinct requested title-ID batches in a TTL window. Keys are created on demand, not prewarmed as a language/country product.

| Cache | New growth | Lifetime and bound |
| --- | --- | --- |
| Anonymous page HTML | At most `L*C*U` for one render/header-policy/build/host/asset combination; further policy/build combinations multiply independently. Saved cookie revisions, device/client IDs and browser-vs-explicit preference provenance do **not** multiply keys. | Per process: **128 MiB / 2,000 entries**, LRU; 4 MiB compressed entry, 8 MiB raw HTML; admission map 20,000, repeat threshold 2, bounded flights/waiters/refreshes. Response cache policy controls fresh/stale; deployment may set `PAGE_CACHE_MAX_FRESH_SECONDS=1800`; `PAGE_CACHE=off` is the existing switch. |
| Canonical details | Country-sensitive offers already multiply by `C`; new wrapper forces language English in this cache, so no new 14× detail-value copies. | 12h fresh + 12h stale, physical 24h; missing-title marker 60s and title-only. |
| Media source overlay | At most `14*B`, **not** `14*C*B`; key uses sorted/deduplicated type/ID set and full locale, independent of country. Batch composition can cause more keys than per-title caching. | 30m fresh, **no stale**, 200 IDs per query batch; hashed parameter keys. |
| Episode text source | Table-presence key constant, shared across all locales/countries; actual row reads are not cached. | Presence **5m fresh, no stale** (made explicit in prep). One read per table/200 stable IDs; warm pages still perform these row reads. |
| Preview (`localized-title-payload-v3`) | Up to `14*T` live named-title keys plus `T` canonical-bot keys; no country/private state dimension. The render-policy bit prevents a bot from receiving cached English localized artwork. | Versioned namespace, 30m/no stale; public response 30m; bot answers private/canonical. |
| Canonical cards / portrait / maps / search reading/ranking | Language is applied after these reads. No new language product inside canonical caches. | Cards 6h; portrait 10m; map neighborhoods 24h fresh + default capped 1h stale; existing bounds stay in place. |
| Pair-aware settings | One additional per-member versioned projection plus the old namespace during mixed deployment. | 5m/no stale, reset markers; saved record reads bypass it. |

The repository's country-name resource has **250** entries: illustrative `14*250=3,500` variants per URL before policy dimensions. Country normalization intentionally retains existing two-letter behavior; the syntactic ceiling is `26²=676`, or **9,464** pair variants per URL. The actual selectable `country` table was not broadly scanned. For 10,000 distinct URLs and 250 countries the theoretical product is 35 million, but page admission, the 2,000-entry/128-MiB cap and request demand prevent allocation of that product. At 64 KiB per admitted HTML variant, 2,000 entries use about 125 MiB before accounting overhead; the byte cap can evict earlier.

Valkey nodes have repository defaults **7 GiB maxmemory / volatile-lfu** (`goodwatch-cache/valkey.conf`), and node compose can override `REDIS_MAXMEMORY`. All new source entries have an expiry and are eligible for that eviction policy. TTL is a lifetime bound, not a per-cache key-count budget. At illustrative `B=1,000` distinct batches/30m and 25 KiB/source value, the language ceiling is 14,000 values (~342 MiB before overhead), shared across countries; actual value size and locality must be observed after deployment. Do not raise global limits or prewarm all pairs on the strength of this estimate.

## Measured query counts (tests, no production)

`media-rollout-contract.test.ts` instruments actual server overlay entry points with an in-memory cache and a fake bounded query seam. Canonical data/matching is supplied as a fixture; counts are **additional overlay queries**, excluding canonical detail SQL, auth/account reads, search ranking and unrelated extras.

- Show details + 40 related cards + one stable-ID season group + 62 aligned episodes: **9 cold** = two media batches × three tables, one presence read, one season read, one episode read. **2 warm**, the season/episode reads. No query per episode.
- Search: 20-title provisional + 100-title final, different ID sets: **6 cold**, **0** for a repeated final batch. Basic/fallback uses the same batch boundary. A 401-title fixture requires **9** reads (three batches × three tables).
- Discover 60-title fixture: **3 cold**, **0 warm** for the same batch; matching/order/counts are not translated.
- An old API request without opt-in: **0 overlay queries**, and no language/context adoption call. Missing tables/fields remain fallback cases.

These are deterministic fixture measurements, not latency or live production coverage claims. `episode-grid-identity.test.ts` also measures six total show-scoped queries for an ordinary cold grid: the five existing provider reads plus one canonical-episode identity read. `episode-grid-media-v2` caches that result for six hours plus the existing default one-hour stale window. Identity-read failures preserve the grid; only proved IDs select translations. The normal grid's stable-ID enrichment is a cache miss cost, not a per-cell lookup. Existing baseline grid queries and that identity read are outside the above overlay counts.

## Deployment order and owner checkpoints

Owner Q1 approves schema/ingestion **only after this branch is on main**, coordinated by the owner. No application was made during prep.

1. **Schema:** apply `media-language-text-schema.sql` for **season/episode tables only**, or use the existing additive initializer. It has no prose table, destructive operation or episode backfill. Existing pages/search remain compatible.
2. **Webapp:** deploy main's page image with reviewed UI/media changes; keep resource/asset continuity. Cache/build keys isolate old HTML. Restart/purge HTML through the existing deployment procedure, without wildcard data deletion. No new media-language runtime flag was introduced; page cache/feature flags remain as before.
3. **Search roles:** deploy the same compatible image separately, one role at a time, checking readiness and commit. The mixed-version matrix above permits roles to lag. Do not alter ranking/model/provider/spend settings for localization.
4. **Ingestion:** owner runs the bounded serial season/episode companion on explicit priority IDs. Dry run remains default; `--apply` is the owner-approved publication step. Start with two named titles, inspect failures/truncation, then expand bounded cohorts. A partial cohort protects existing nonblank locales/fields.
5. **Prose jobs:** **omitted** by owner Q2/Q3. Page prose stays English. There is no paid translation job, source table or request-time lookup to enable.

An actual job is documented in `media-language-text-production.md`. Do not run it during this prep task or before the owner's main/deployment checkpoint.

## Read-only production verification after deploy

Use named titles and GET/HEAD or bounded SELECTs. GETs can warm ordinary caches; do not confuse that with a preference/data write. Do not use a POST search for verification: combined search writes history and can invoke paid interpretation.

- Inspect `/health/ready` and role/commit health using the existing deployment runbook. Check the proxy still routes exactly the two search paths, including query strings; direct role checks use the existing authenticated operator path.
- GET a small title sample (e.g. Breaking Bad, Spirited Away, Sword Art Online) with guest language cookies/headers for `en,de,ar,ja,zh-Hant`, keeping country fixed. Check media field `lang`, script-compatible title fallback, canonical hrefs and unchanged episode ratings/membership. GET preference/bootstrap only as a guest or an already-saved test account: first sign-in adoption can write a pair, so it is not a read-only account probe.
- GET `/api/command-palette?q=breaking` without opt-in (English), then with `displayLanguage=de` (localized or English fallback). A lagging old role may return English in both cases, with no error. Do **not** POST combined search to prove localization; use the tested fixture contract plus role version/readiness.
- GET `/api/media-title?type=show&id=1396&displayLanguage=de`; expect entity present even before translations. Probe a valid uncommon unsupported explicit language once: it normalizes to English.
- Bounded SELECTs for named show/season/episode IDs confirm translation keys and nonblank source text. Verify canonical episode rows/IDs and counts against the same named sample; absence of translation is not an episode-existence signal. No global coverage COUNT, broad scan or repair write.
- Observe existing page/data-cache metrics and bounded `INFO memory`, `INFO stats`, `INFO keyspace` / exact-key TTL checks through the operator procedure. Compare evictions, hit rate, refusal/entry/byte gauges and Crate timeouts with the predeploy baseline. Do not use `KEYS`, broad SCAN or a mass warming script.
- Wait out the five-minute table-presence TTL after schema creation if a node previously cached absence. Ingestion source visibility can also wait for Crate refresh and the 30-minute media/preview cache TTL. Use an owner-approved normal restart/cache reset only when needed; that is a separate mutation checkpoint, not a read-only probe.

## Rollback steps

Stop/leave ingestion unscheduled; it is additive and independent of presentation. Redeploy the last known page image using normal asset continuity, optionally then older search images serially. Reload browser tabs. Leave cookies/account JSON/translation tables intact. Canonical English responses and existing country behavior are the safe fallback. If only cache behavior is suspect, the existing `PAGE_CACHE=off` is available at an operator restart; do not delete persisted choices or translations.

[Verification artifact](media-language-rollout-verification.json) records exact commands/counts, diagnostics and all changed files. Typecheck matches a clean merged-HEAD baseline (212 existing diagnostics; none added). Python passed 1,220 tests with 51 skips. Both full Node runs had failures in unchanged timing-sensitive suites; every failing case passed in isolation, and changed media suites passed. The full suite is not claimed green. Browser checks belong to the UI thread; no build or additional dev server was started for this prep.

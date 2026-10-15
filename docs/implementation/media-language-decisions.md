# Media language decisions — policy, persistence and launch scope

Decided **2026-10-14 by the Ghostex orchestrator under the owner's “work until done” instruction**. These decisions are revisable. The defaults in the thread brief settle the open product policies; the archived F prototype is behavior evidence, not production code. This record implements the policy/persistence slice of the [handover](media-language-handover.md), using the [inventory](../research/media-language-localization.md). It does not declare phases 3–5 complete.

## Owner revision, 2026-10-14 (Q1–Q3)

The owner supersedes the orchestrator's original page-prose defaults below:

- **Q3 decided:** page prose is outside this release: title FAQ, fingerprint narratives/skip copy, taste/portrait/category narratives and FAQs, essence text/tags/templates, and other page prose stay canonical English. Only media title/poster/overview/tagline and canonical season/episode name/overview are localized. Owner-authored text stays literal. The 14-locale template pack and all prose reader/job wiring were removed, rather than retaining dormant complexity.
- **Q2 decided:** no paid prose translation. There is no prose job, template importer, `prose_translation` schema or request-time prose lookup. Existing model generation outside localization is unchanged. This release has no prose-translation spend or further prose approval checkpoint.
- **Q1 decided, execution conditional:** additive season/episode translation schema and bounded ingestion are approved **only after the branch lands on main**, coordinated by the owner. Do not apply the migration or ingestion now. No schema/data change was executed in this worktree.
- **Live-check correction:** non-Latin translation text with no expected-script letters is missing for that field. This applies to Arabic, Russian, Japanese, Korean and Chinese text, including season/episode names/overviews and original-title fallback. Numeric/punctuation-only names remain eligible; mixed proper names with native letters remain eligible. The guard proves script compatibility, not meaning, quality, Hans/Hant equivalence or a native-script percentage. Posters retain their existing base-language policy. Canonical fallback carries its source language (unknown mislabeled original text is `und`), preventing a Latin-only Arabic row from forcing RTL.
- **Live-check correction:** ordinary IMDb grid cells now retain stable TMDB IDs when a unique external-ID or real canonical-title match in the same season proves identity. Numbers alone and ambiguous/placeholder names never join. Ratings, counts and grid membership stay canonical. An unavailable identity source leaves the grid usable with unknown-language text; translation rows never prove existence.

The original nonblank coverage sample below did not test script validity. It must not be read as a post-filter translation-quality claim. Launch locales stay the same; field fallback may reduce effective title coverage.

## Launch locales and bounded evidence

Offer **en, de, fr, es, it, pt-BR, pt-PT, ja, ko, zh-Hans, zh-Hant, pl, ru, ar**. The interface and document-level `lang` stay English. No country-derived initial language. No script exclusion based on current fonts; multilingual/RTL rendering remains a phase 4–5 check.

[Coverage evidence](media-language-evidence/coverage.json) is a 2026-10-14 production **SELECT-only** observation through `docker exec crate-01 crash` on `10.0.0.11`. The [repeatable probe](media-language-evidence/probe.py) constrains all catalog queries to these 20 named titles, not the full catalog:

- Movies: Fight Club (550), The Shawshank Redemption (278), The Godfather (238), The Dark Knight (155), Inception (27205), Interstellar (157336), The Matrix (603), Forrest Gump (13), Spirited Away (129), Parasite (496243).
- Shows: Breaking Bad (1396), Game of Thrones (1399), Stranger Things (66732), Black Mirror (42009), Friends (1668), The Office (2316), The Sopranos (1398), The Last of Us (100088), Wednesday (119051), Squid Game (93405).

All 20 canonical rows exist. The table counts below count **nonblank fields**, not inferred translations; each text region has 20 rows. Posters count distinct works, not image rows. Popular-title coverage is launch evidence, not a completeness/quality/freshness guarantee for the long tail.

| Offered locale | Preferred text row (`language_code`, `country_code`) | Title / 20 | Overview / 20 | Tagline / 20 | Language-tagged poster / 20 |
| --- | --- | ---: | ---: | ---: | ---: |
| en | en, US | 3 | 20 | 20 | 20 |
| de | de, DE | 7 | 20 | 17 | 13 |
| fr | fr, FR | 9 | 20 | 18 | 19 |
| es | es, ES | 12 | 20 | 18 | 19 |
| it | it, IT | 12 | 20 | 14 | 15 |
| pt-BR | pt, BR | 14 | 20 | 20 | 19 (pt, shared) |
| pt-PT | pt, PT | 15 | 20 | 14 | 19 (pt, shared) |
| ja | ja, JP | 19 | 20 | 11 | 15 |
| ko | ko, KR | 18 | 20 | 13 | 17 |
| zh-Hans | zh, CN | 19 | 20 | 16 | 20 (zh, shared) |
| zh-Hant | zh, TW | 20 | 20 | 11 | 20 (zh, shared) |
| pl | pl, PL | 14 | 20 | 13 | 17 |
| ru | ru, RU | 20 | 20 | 19 | 20 |
| ar | ar, SA | 18 | 20 | 17 | 20 |

The additional pt-PT/pl/ru/ar choices have strong overview and poster coverage, with useful title/tagline coverage. Other sampled locales remain deferred to keep the initial set bounded, not because their scripts are prohibited. For example Hindi had only 10 nonblank overviews in 17 rows; Dutch had six titles, two taglines and five language-tagged posters. Swedish is unsupported in the current set.

Current checkout verification agrees with the inventory's storage seams:

- `f/sync/models/crate_schemas.py` and live schema expose `translation`, keyed by work/type/language/country, with title/overview/tagline/homepage/runtime. `media_image` has work/type/path/image type/base language and dimensions/votes; the real poster image type is **`posters`**. No region or script column exists on images. Blank image language means neutral, not English.
- The schema metadata lists only `translation` as a translation/locale table. Live `episode.overview` exists; season and episode text currently has no locale key. Do not repeat the already completed canonical episode-description backfill.
- Current `f/sync/copy/tmdb_details.py` writes translations and artwork separately from canonical movie/show fields. At phase 1, `details.server.ts` and `title-cards.server.ts` still read canonical display fields. The later batched overlays are now implemented; see the surface matrix. The original-language column is `original_language_code`, not `original_language`.
- The original inventory's phase 3–4 boundaries have since been reconciled in the surface matrix, with generated page prose excluded by owner Q2/Q3. No deployed Windmill flow binding was inspected or changed here; no backfill or model call was performed.

## Negotiation and fallback

Use q-ordered Accept-Language (stable original order for equal weights), with the same ordered rule for `navigator.languages`. Match exact supported tag, then compatible script, then base language. Chinese region aliases: TW/HK/MO → Hant, CN/SG → Hans; explicit Hans/Hant takes precedence over region. Bare `zh` selects Hans; bare Portuguese selects pt-BR. Exact pt-PT stays pt-PT. This resolves the previously undecided deterministic default variants. Country never selects a language or Portuguese variant.

Discard malformed tags/weights, private-use/extension tags and q=0 ranges. Specific positive ranges can override a broader wildcard exclusion; equal-specificity q=0 excludes its positive duplicate. A positive wildcard chooses the first allowed locale in the offered order. Unsupported explicit saved values normalize to **explicit English**, rather than silently following the browser. No match returns English with `languageProvenance: "default"`, **including when English/all offered choices were explicitly excluded**: this is the orchestrator's product fallback for an English-interface catalog, not a claim that English was negotiated. There is no language-based 406, title 404 or entity hiding.

Preferred text regions above are independent of availability country. For later overlays, use per-field nonblank values from that region, then compatible same-language rows in a documented deterministic region order. Portuguese variants do not silently substitute each other; Chinese candidates must stay within the selected script's region family (Hans CN then SG; Hant TW then HK). Base locales can use stable lexical country-code order after their preferred region. Do not let storage row order decide the display.

| Field | Decided fallback | Actual language to carry |
| --- | --- | --- |
| Title | localized nonblank; else original title if original language matches selected language; else canonical title | chosen row's locale; or known original language; or canonical source language |
| Poster | localized language-tagged poster; else canonical poster | stored base language or neutral/unknown; never invent region/script |
| Overview/tagline | localized nonblank; else canonical English text | selected row's locale or canonical source language |
| Generated/page prose block | intact canonical English; localization out of scope (owner Q2/Q3) | canonical source language |
| Season/episode text | localized by verified stable ID after canonical alignment; else canonical English | chosen field's language; do not change episode identity |

Whitespace-only strings are missing independently for each field. Missing one field does not discard another translated field. Original-language codes cannot prove a Chinese script: use base `zh` for actual-language provenance when script is unknown. Canonical title fallback already sometimes uses `original_title` when `title` is empty (`details.server.ts`); mark that known original language, not English. Canonical page prose remains unchanged under owner Q2/Q3. The phrase “canonical English” is not permission to label unknown/original text `en` or fill missing translations with English. Later adapters carry actual language and fallback source to each rendered element and `lang` attribute.

**Evidence constraint on the default:** script/region-specific poster selection cannot be guaranteed with current base-language-only image rows. Use a matching base-language poster with honest base/unknown provenance or canonical fallback; do not advertise a verified pt-BR/pt-PT or Hans/Hant poster distinction. No other initial phase-1 default required reversal; owner Q2/Q3 later supersede the generated/page-prose default.

## F preview, Keep and Undo

Preview is client-only, scoped to the current page. Navigation away, reload, and opening a new tab start from saved context. In-page use, scroll, Rent, dialog reopening and hash-only navigation retain it. Each tab owns its own draft. No preview writes a cookie, account row, localStorage or URL. Live shared links carry no sender language; hand-written language query parameters have no preference/display override in this release. Existing `?country=` view overrides remain availability-only and never save automatically.

An optional accepted companion belongs to the **draft country until Keep**, matching the prototype: another draft country pick clears that unsaved companion. Keep saves its language explicitly as part of the pair. After Keep, country picks always preserve that explicit language. A manually selected language survives draft country picks too. Browser default means `language: "browser"`, with copy saying “follow browser”; the currently resolved language is only context. Companions are never checked automatically, never change country, and must be drawn from the offered set; multilingual-country alternatives use real radios with a decline choice. The prototype suggestion fixtures are not a country-language policy.

Escape in the open dialog closes only that dialog. Outside it, Escape discards the draft only while focus is inside the pair/question region. A phone uses one compact anchored row; there is no global Escape listener. All pair/alternate-country entry points are disabled during a save. The API sequence guard is additional protection, not a substitute for disabling or serializing saves.

Confirming an unchanged guessed country is allowed: keeping the complete pair records a real explicit country even when its string matches the inferred country. The UI compares saved provenance/record existence as well as values. English settings use the same pair, save call, toast Undo and save destination. Settings has no title to preview a pick on, so a pick there saves at once and the toast offers Undo of the whole pair (owner decision, 2026-10-14); the old navigation/write semantics are gone. Same-page sign-in/out refreshes the saved baseline and destination but may retain a visible draft; it must require a new Keep, never auto-save that draft. Navigating to sign-in discards it under the navigation rule. A tab learns other tabs' saved choices on its next server read/revalidation; drafts are not synchronized.

Keep saves the whole intended pair. Success publishes the returned pair/context and offers Undo using the **same endpoint** and previous pair. Pre-Keep Undo only drops the draft. Failure retains previous saved context plus draft and Retry. A timeout means “could not confirm save”, because a write may have landed; it must not claim “nothing changed” without evidence. Save confirmation says **this device** for guests and **account** for members.

## Preference storage and precedence

One server-readable cookie **`gw_loc`** for guests and members, holding one envelope:

```ts
{ schemaVersion: 1, country: string, language: MediaLanguage | "browser", version: string }
```

Country is a trimmed uppercase two-letter code, preserving existing country validation. Cookie is URI-encoded JSON, Path=/, HttpOnly, SameSite=Lax, one-year Max-Age, Secure for production/configured public HTTPS (including Coolify forwarding HTTP to Remix). The action checks the configured public APP_ORIGIN, with the repo's production goodwatch.app fallback, rather than its internal proxy URL. Parse errors, duplicate cookie names, oversized values, invalid shape/revision and unknown schema versions discard the cookie. Unsupported explicit language tags normalize to English. No parallel language localStorage record is introduced.

Members save the entire envelope in **one `user_setting` row** at `(user_id, key = "media_preferences_v1")`; no column migration and no two-row country/language write. Keep and Undo both use it. The generic `upsert` really loops over multiple rows in this checkout, so a pair must never go through that multi-row path. Crate guarantees [atomicity at document/row level and immediate full-primary-key reads](https://cratedb.com/docs/crate/reference/en/5.10/concepts/storage-consistency.html). Updates with a supplied expected revision use the full primary key plus [Crate `_seq_no` and `_primary_term` optimistic concurrency](https://cratedb.com/docs/crate/reference/en/5.10/general/occ.html), rather than claiming a multi-row transaction. These semantics were checked against the 5.10 documentation; real writes were not tested in production.

Pair precedence: **member account pair > valid cookie > browser**. `?country=` remains the top view-country override. With no pair/cookie, legacy `country_default` wins over the existing Accept-Language region fallback, then US. Existing region inference remains the first q-ordered entry with a two-letter region, independent of which language is supported. Explicitly selecting a language never changes country.

Review revision (2026-10-14): sign-in adoption runs only at POST session establishment. An account without a saved pair adopts a **proven guest-origin** kept cookie (`sourceUserId: null`), never a cookie synced from another member or an older cookie with unproved origin. Second-review clarification: a guest cookie is written only by Keep, which explicitly confirms the whole pair. Its country therefore wins on adoption; inferred browser context never creates a guest cookie. The unused `countryExplicit` flag/API path was removed. Legacy country rows remain intact; unproved/member-origin cookies are never adopted. Account with a pair wins, including an explicit browser-following setting, and rewrites the device cookie. Adoption uses insert-if-absent/conditional update so another device's newly saved pair wins a race. No cookie means no inferred-browser pair is mass-saved. Sign-out leaves the device cookie as the last account pair (the deliberate device continuity policy); it does not expose member-only data.

Old country rows remain intact. `getUserSettings` projects the envelope country as `country_default` for its existing consumers; old country-only setters update an existing envelope while preserving its language. Guest-progress transfer also reads/writes the envelope country when present. The availability-index preload's direct old-row country counts remain a warming heuristic; runtime availability country reads use the settings projection. Other unrelated settings retain their historical write semantics.

The database and HTTP cookie are not a cross-store transaction. Members' confirmed account row is authoritative; if delivery of Set-Cookie fails, the next member request reconciles it. After a confirmed row write, cache invalidation failure is logged rather than presenting an unsaved result. An unconfirmed write sends no replacement cookie; retries/revalidation recover account state. Guest success means the response carries the whole cookie, with normal browser cookie delivery semantics.

## Root/resolver and save API for the UI thread

Shared pure contract: `goodwatch-webapp/app/utils/media-language.ts`, especially `resolveEffectiveMediaContext`, `negotiateMediaLanguage`, pair/record parsers and `isCurrentLocalizationResponse`. Server wrapper: `app/server/media-context.server.ts::resolveMediaContext(request, userId?)`. It returns `{effectiveContext, record, setCookie}`. Root resolves it after auth and before its user-data prefetch. Movie/show loaders use the same request-scoped resolution for country, preventing parallel loaders from reading a pre-adoption legacy country; their canonical metadata reads remain unchanged. Root/page GETs never write an account pair; member presentation reads share a bounded 15-second memo, refreshed on writes and on an owned-cookie version mismatch. Browser sign-in and initial member session establishment call POST `/api/media-preferences/session` once per tab/user, remembered in sessionStorage. It returns `{changed}` and emits a cookie only when it changes. Revalidation happens only when preferences or user identity change; unchanged hard loads do no second loader pass. Foreign Origins are rejected using the settings endpoint policy. Member requests bypass anonymous caches; cookie/header context is already resolved in the HTTP cache identity before any anonymous page-cache lookup.

Root loader data is deliberately shareable: `locale: {country: string, language: MediaLanguage}`. It contains **no saved record, revision, writer identity/sequence, language setting or provenance**. `useLocale()` retains this contract and SSR's effective pair is preserved for hydration. The country override eligibility in movie/show loader data depends only on the URL, not device state; only a differing legacy localStorage country triggers a private provenance read before migration. This prevents a cached fallback flag from overriding another visitor's kept cookie choice.

**GET `/api/media-preferences`** returns `GetMediaPreferencesResponse`:

```ts
{
  effectiveContext: EffectiveMediaContext; // country, countryProvenance, language, languageProvenance, languageSetting
  mediaPreferences: LocalizationRecord | null;
  destination: "device" | "account";
}
```

This endpoint is always `private, no-store`, never an HTML/catalog cache entry. The UI fetches it when opening the picker (and after auth changes or a conflict) for saved state, the current revision and save destination. It is the source for full provenance/explicit-vs-browser state; do not read those from shared root data. Client previews use the pure resolver with the saved baseline and prospective pair. Only negotiate navigator.languages for an intentional preview/browser reset; never silently replace SSR's language during hydration.

**POST `/api/user-settings/set`**, Content-Type application/json:

```json
{"clientId":"page-session-uuid","pair":{"country":"DE","language":"fr"},"sequence":12,"expectedVersion":"saved-opaque-revision"}
```

`clientId` is required: a fresh opaque UUID for the page/picker session, retained through Keep/Undo/retries, with a fresh ID on reload. It is not a second preferences cookie or localStorage record. Sequence is a nonnegative safe integer increasing per intent **within this client ID**. `expectedVersion` is optional for compatibility but the UI should send the private GET/last-save revision (null when no account pair exists). Country/language-only picks still send a complete pair. `language: "browser"` clears explicit language. Whole-pair Undo sends the previous pair with the current saved revision and the next sequence. Existing `{settings, options}` callers remain compatible.

Success returns `{pair, version, sequence, effectiveContext, destination}`, sets `gw_loc` for everyone and uses no-store. The envelope now optionally includes `writer: {clientId, sequence}`; old envelopes without writer metadata still parse. Member account writes persist that metadata in the same single atomic row and reject a lower/equal-but-different intent from the same client. Equal intent retries return the same saved revision. A later intent from the same client can supersede its own earlier in-flight write; other-client revision conflicts remain conflicts. Conditional writes use Crate OCC.

Saves are queued per member or guest client in each process. A bounded 30-minute/10,000-client high-water map rejects lower sequences and suppresses an already-running response when a newer intent arrived before completion. Member row ordering additionally works across instances/restarts, and a final primary-key read suppresses a response superseded on another instance while cache invalidation was in flight; guests check the writer sequence in their incoming cookie and the process's remembered saved record. Tests hold an older member write in flight, admit a newer intent, and verify the older operation cannot produce a successful cookie response while the newer pair persists.

**409 response**, with no Set-Cookie:

```ts
{
  error: string;
  sequence: number; // rejected request sequence, for the stale-response guard
  current: {pair: LocalizationPair, version: string, sequence: number} | null;
}
```

`current.sequence` is the saved writer sequence (0 for an old record with no writer); it is separate from the request sequence. `current` is null only when no saved record exists. The client guards the response against latest issued intent, adopts the current saved baseline/revision, retains its preview, and retries with the next sequence and `current.version`. A saved sequence from another client is not a global account counter. Guest expectedVersion also conflicts with a different current device revision; a newer intent may supersede its own preceding writer revision. Invalid pair/clientId/sequence/revision → 400; unconfirmed/refused persistence → 503, with no replacement cookie.

Client saves must still be serialized / controls disabled during saving. Server protection rejects known stale intent before emitting a cookie, but cannot recall bytes already sent or control HTTP response delivery order. Fresh guest requests on different processes without a current cookie do not share the cheap process-local guard. No cross-instance guest session store was added. This limitation is why the UI serialization requirement remains; do not claim the JSON guard or server queue alone makes arbitrary overlapping fetches safe. Revalidate root after saves/auth changes with the existing request helper; root revalidates on entering/changing/leaving a country URL override.

## Canonical outputs, library and generated prose

Crawlers, OG images, downloads and static renderers use canonical English **catalog** content, regardless of request/browser language. No hreflang, localized URLs or sender-locale query strings this release; that explicit release policy supersedes the webapp AGENTS.md's generic hreflang advice. Live title/list/profile pages use the recipient's context. Preserve owner-authored list/profile text literally; the English catalog policy is not authority to translate or relabel user-authored prose. The canonical/live renderer boundaries are implemented; see the current surface matrix.

My library **Title sort and pagination remain canonical**. Current `server/my-library.server.ts::titlesOf` reads canonical names for all status keys before pagination; `domain/my-library.ts` folds accents/case, strips only English a/an/the for Title sort, collates with `localeCompare(..., "en")`, breaks ties by stable key, then slices 60-title steps. Current library search is a case/accent-folded substring of that canonical name. It does not read translation aliases. Evaluate localized-name recognition separately without changing relevance, taste, date, score ordering, library sorting or episode alignment. This explicitly supersedes the research inventory's recommendation to sort displayed localized names.

FAQ, fingerprint/skip narratives, taste/portrait/category copy, essence text/tags and other page prose render canonical English as before, by **owner Q2/Q3**. Locale resources, translation jobs/importers, runtime readers and the proposed prose table are removed. No prose translation is executed or looked up in SSR/search/preview. The additive season/episode companion remains; schema and publication await main plus owner coordination under Q1. Existing DNA scores/vectors/generation remain unchanged.

## HTML and data cache policy

Checked current `cache-identity.server.ts`, `page-cache.server.ts`, `utils/cache.ts`, [cache rules](../cache-identity.md), [page cache](../page-cache.md), [serving architecture](../serving-architecture.md) and [ADR 0010](../adr/0010-static-hostname-with-server-side-fallback.md):

- Document/API DNS is **DNS only**, not Cloudflare-proxied; Cloudflare caches static assets on the separate static hostname. No live Cloudflare account configuration was queried. A future HTML CDN must compute the same normalized identity from gw_loc before lookup and bypass members; it may not ignore preferences and key only on Accept-Language.
- In-process anonymous HTML key includes normalized complete URL, host/build/assets and independent `anon;<COUNTRY>;<LANGUAGE>`, plus whether a front cache named it. Browser-negotiated language and identity header grammar now support only the offered set, including pt-BR/pt-PT/Hans/Hant. A saved cookie resolves before lookup and overrides a conflicting header. Country stays an independent dimension under ADR 0005; the old country-derived-language motivation is superseded.
- **Saved-cookie guests remain cacheable**, sharing `anon;country;language` with every request that produces the same effective pair. Root data contains no device record/provenance, and explicit/browser mode is private API state, so neither revisions/sequences nor a mode bit are key dimensions. The page-cache integration test warms with one guest cookie revision and observes a hit for a different revision.
- No front-cache identity header → private,max-age=0 externally, with normal in-process HTML storage. A valid matching cookie-aware header → shared policy and Vary: GW-Cache-Identity. Cookie/header conflicts use the actual cookie pair and private policy. Errors, member responses and Set-Cookie responses remain private/no-store; an unsupported front-cache locale is ignored.
- Repository search found **no upstream HTML worker/proxy computing GW-Cache-Identity**. Caddy/Traefik route requests without an HTML cache; the docs say there is no front HTML cache. No proxy config deployment is needed today. Roll out the webapp readers to both page instances before exposing the preference UI; restarts empty their page caches. A future edge must deploy the cookie-aware pre-lookup rule in [cache-identity.md](../cache-identity.md), overwrite client headers and purge old entries. The origin mismatch check cannot fix an already-served edge hit.
- Valkey `cached` data is keyed by cache name and explicit params. Canonical title/detail/ranking/alias/alignment caches remain canonical and can be shared across locales. Any **localized** detail/card/episode response or presentation cache must add locale independently of country plus any applicable schema/source revision. Root/prefetch, API query URLs, TanStack keys, streamed/provisional search responses and locale-bearing payloads must agree when readers are wired in phases 3–4. The current localized reader/cache inventory is in the surface matrix.
- Canonical static assets and canonical OG/download images require no language variant. If later policy makes image bytes localized, their URL/cache identity must include locale, fonts and source/image revision before that change ships.

## Coverage of the handover's “Decisions still open” list

| Open item | Covered decision | Status |
| --- | --- | --- |
| Launch locales, matching, no-match, field/poster/generated fallback | Offered 14-tag set and bounded evidence; q/script/region matching; honest per-field and block provenance; English no-match policy | Decided; image region/script limitation recorded |
| Preview lifetime; accepted companion then later country | Page-only draft; independent tabs; draft companion cleared on country repick; Keep promotes explicit language | Decided |
| Escape scope and phone question | Pair/question focus scope; open dialog Escape only closes it; compact phone row | Decided; UI implementation in its thread |
| Member/device conflicts, missing account language, guest adoption, SSR persistence | One cookie + one account envelope; account > cookie > browser; guest-origin adoption at session POST; explicit-country safeguard; account rewrites cookie | Decided and implemented in this slice |
| Unchanged guessed country, settings adaptation, country-bearing URLs | Allow explicit confirmation of same guessed country; same pair boundary in settings; `?country=` is view-only; no language override URLs | Decided; settings/F UI is owned by the merged UI thread |
| Crawler/OG/download locale, quality/provider/budget, priority/refresh, library names | Canonical English catalog outputs; owner text preserved; page prose canonical by owner Q2/Q3; no translation job or spend; season/episode additive ingestion approved after main under Q1; canonical library sorting/current search documented | Decided; no page-prose implementation remains; season/episode publication conditional on main |

No further prose decision is required. The remaining execution condition is the owner-coordinated season/episode migration and bounded publication after main; this worktree performs neither.

## Verification of this slice

- `node --test app/utils/media-language.test.ts app/server/media-context.test.ts`: pure-core and mocked storage/action suites (final totals in the thread report). Node:test and node:assert follow neighbouring tests; server tests use the same Node loader-hook pattern. Vitest/config/package changes were removed and the lockfile restored exactly to HEAD. No `.env`, real backing service or model call in those suites.
- Relevant Node suites: cache identity/page cache/headers, member settings/user data, root revalidation, Crate timeout recovery, canonical details cache/missing/concurrent-error behavior, share-list page loaders and guest-progress hydration.
- `npm run typecheck` fails at the existing repository baseline. A clean `git archive HEAD goodwatch-webapp` snapshot using the same installed dependencies is compared by diagnostic file/code/message, ignoring line shifts; no additional diagnostics in the final comparison.
- Production evidence is SELECT-only, named-title and schema metadata. No account/catalog/Valkey writes, commit, push, deploy, paid calls or backfill.
- Not exercised: real member writes, HTTP cookie delivery in a browser, F/settings UI, full server build, multilingual rendering, or landing budgets. The new unit tests use storage mocks; Crate atomicity/OCC are documentation-backed. A landing benchmark against production would measure the deployed branch and can invoke production impression writes, so it cannot validate this uncommitted patch under this thread's no-production-writes constraint. UI/browser/budget acceptance remains a pre-release check for the orchestrator.

## Phase 5 compatibility and cache follow-up

See [rollout plan](media-language-rollout.md). Old API callers without `displayLanguage` remain canonical even when a cookie/browser requests another language. New callers tolerate old search-role payloads with absent metadata as canonical fallback. The settings projection uses `user-settings-media-v1` separately from old roles; writes invalidate both projection namespaces. Preview is media-only in `localized-title-payload-v5` (URLs also carry `presentationVersion=5`); ordinary grids use `episode-grid-media-v3` to avoid stale cached cells without IDs. Canonical media source caches and shared guest HTML identity remain independent of device revision/provenance. Translation data and saved pairs survive webapp rollback.


## Review performance / provenance revision (2026-10-14)

English-equivalent canonical media projections retain canonical English text and artwork without translation/poster IO, with canonical provenance (unproved image language stays `und`). Unproved upstream text and non-equivalent originals still use the resolver. Episode/season English requests never read translation sources. Non-English sources use bounded per-entity locale caches and indexed batches. Explorer APIs without explicit `displayLanguage` stay canonical; the private page SSR uses the live member/guest language. Both overlay at most 800 unique titles (raised from 200 after measuring production worlds; see [Explorer cap](media-language-explorer-cap.md)) and retain the canonical tail; crawler SSR stays canonical. This bounds whole-world work without hiding works or changing matching/ranking.

Canonical season text is still ingested additively, but the current UI renders season-number interface labels and has no season-name/overview reader. The unused season text fetch/overlay was removed; adding such a visible reader remains deferred. Episode names/overviews retain their stable-ID readers and post-alignment overlays. Owner-approved schema initialization through the daily `populate_crate` flow is allowed after main/script sync; it does not itself run translation ingestion.


## Read-error fallback cache policy — 2026-10-14

A successful source read with no usable translation remains a valid cacheable canonical fallback. A failed/expired optional source read is transient: preserve the canonical entity, but publish no dependent localized Valkey entry and send `private, no-store` so HTTP/CDN/page caches cannot pin the fallback. Request/dependency health stays server-side; it never adds device state to cache identity or public payloads. Optional Crate localization reads use a cancellable 1,000 ms deadline (`MEDIA_OVERLAY_TIMEOUT_MS`), then skip subsequent batches after failure. Existing canonical query deadlines remain unchanged. Preview cache/query/URL v5 bypasses old v4 fallback values. See the rollout/review runbooks for verification.

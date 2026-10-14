# Media-language review fixes — 2026-10-14

Uncommitted follow-up to merge `7e4bb2a0` on `feat/media-language`. All changes were made in `/home/alper/projects/goodwatch-media-language`. No deployment, production mutation, paid request, commit or push was performed.

## Presentation and source caches

- A whole overlay call indexes canonical records, translations and posters in Maps. Winner selection scans posters once. Poster SQL restricts candidates to the selected base language or a canonical/input poster path; batches have at most 200 missing title references.
- Source caches now use reusable per-title entries (`media-overlay-title-v2`), not exact page-batch keys. Only candidate translations, the winning localized poster and canonical/input image metadata are retained. Redis-cluster-safe concurrent GETs replace a cross-slot MGET. Values are capped at 64 KiB; process memory at 4 MiB serialized bytes / 2,048 LRU entries. Entries expire after 30 minutes, and a late Redis read preserves the original expiry.
- Proven English-equivalent title projections skip source IO. A prefilled original foreign title is not proof of English equivalence. Repeated card/route overlays reuse complete, script-valid presentation; tests exercise tonight, watch-next, Discover, living-room, TV home and My shows payload shapes.
- English episode presentation skips table presence/cache/source IO. Non-English episode sources are cached by stable ID and locale in `episode-text-title-v2` with the same limits. Unread season name/overview fields and their overlay fetch have been removed; season translation ingestion remains available for a future visible reader.
- Explorer requires explicit `displayLanguage`, including SSR, and caps presentation at 200 unique titles. The remaining graph stays canonical. Client initial data and placeholders never seed a different-language query.
- Discover crawler initial-data keys and collection prefetch keys use `en`, matching client hydration while returning canonical data.

## Arabic fallback and person facts

The earlier fresh resolver rejected Latin-only Arabic translation text, but cached payloads and persisted browser presentations could bypass that resolver. Completed presentation is now validated before reuse. Locale case/region normalization and meaningful native-script letter checks reject `Sword Art Online` / `JUJUTSU KAISEN` tagged `ar-SA`; digits or tatweel cannot make Latin names Arabic. Script compatibility does not prove translation quality.

Preview server keys use `localized-title-payload-v4`; query keys use `media-title-v4`; generated GET URLs include `presentationVersion=4`. This also avoids old browser/CDN responses at the previous URL. Persisted exploration data retains navigation/filter state but discards invalid presentations. Canonical fallback receives its actual language rather than inheriting a rejected translation's language.

Person `stats.best` copies canonical identity and presentation metadata, and the route renders its title through the existing `MediaText`. Ranking and canonical links are unchanged.

## Account/session boundary and tracking

Root/page GETs never write account preference rows. Member presentation reads share a bounded 15-second memo; mutation/CAS/conflict/adoption reads are uncached. An owned cookie with a different saved version forces a fresh account read before cookie reconciliation.

POST `/api/media-preferences/session` establishes preferences after browser sign-in or initial member session, before root revalidation. It requires authentication, is private/no-store, accepts no pair payload and returns `{ok:true}` plus a reconciled cookie when applicable. Repeated same-user auth events do not repeat the POST; a failed request does not prevent sign-in or an explicit Keep.

Cookies now carry `sourceUserId`: `null` for a guest, the account ID for a member. Only proven guest-origin cookies are automatically adopted. Older unmarked cookies continue to work for guests; foreign/member-origin cookies are never adopted into a different account. `countryExplicit:false` preserves the latest legacy `country_default` through a direct primary-key read, independent of old-role settings caches. Ordinary explicit pair saves default to `countryExplicit:true`. These are optional, backwards-compatible fields; the existing pair/save/version/409 contract remains intact.

Tracking stores use user + show identity, independent of presentation language. Language-keyed reads update episode text while retaining in-flight mutation queues and optimistic marks.

## Ingestion and rollout

The Windmill ingestion lock pins `requests==2.34.2` and its `charset-normalizer==3.5.1` dependency, consistent with the repository's existing TMDB ingestion lock. Schema comments now identify the adjacent tables correctly. Owner Q1 permits additive schema initialization by the existing daily `populate_crate` flow after this branch reaches main and scripts are synced; no separate manual schema checkpoint is required. Bounded ingestion still waits for the owner's coordinated main/deployment step. See [rollout](media-language-rollout.md) for order, TTL/cardinality limits and read-only verification.

## Verification

UI-owned preference/dialog/header checks remain with the UI thread; its files were not edited here.

- Focused Node regression run: **133/133 passed**, 8.21 seconds. Command: `node --test --test-concurrency=1 app/server/media-context.test.ts app/server/media-overlay.test.ts app/server/media-rollout-contract.test.ts app/server/title-extras-prefetch.test.ts app/utils/media-language.test.ts app/utils/media-script.test.ts app/server/crawler-media-keys.test.ts app/server/locale-source-cache.test.ts app/ui/tracking/store.test.ts app/utils/person-best.test.ts`.
- Full default-concurrency `npm test`: **2,464 tests; 2,458 passed, 5 failed, 1 skipped**, 98.50 seconds. Failures: two lifecycle timing cases, one search serve-deadline timing case and two auth-session timing/memo cases.
- Full reduced-concurrency `node --test --test-concurrency=2 'app/**/*.test.ts'`: **2,464 tests; 2,461 passed, 2 failed, 1 skipped**, 412.83 seconds. Failures: lifecycle child did not start within its test deadline; auth-session HS256 expected one request, saw two. The opt-in cross-process Valkey reset test is skipped without its backend configuration.
- These three failing suites were rerun serially on the branch: **29/30 passed**, with the HS256 case still failing on that run. A subsequent auth-only run passed **14/14**; the lifecycle case newly failing in the reduced full run passed alone (**1/1**). The same three suites passed **30/30** on frozen main `ac8bb55a`; their files had no diff against `origin/main` at that run (`2d978601`); they also remain unchanged against the final typecheck baseline (`ad7e6d19`). Full-suite timing failures remain visible here; the full suite is **not claimed green**.
- Overlay CPU benchmark (JIT warmed, excludes DB/network time): 500 unique titles / 1,000 references / 50,000 posters, five measured iterations. Median **31.37 ms** in default full run, **45.17 ms** in reduced full run, **54.47 ms** in focused run; assertion requires <75 ms. Source-query count fixtures remain details **8 cold / 0 warm**, search **6 cold / 0 repeated final**, Discover **3 cold / 0 warm**; no query per title/episode.
- Python ingestion/schema/lock regression suite: **8/8 passed**. Command: `python3 -m unittest discover -s goodwatch-flows/tests -p test_media_language_text.py -v`. Uses mocks; no live TMDB request or production write.
- Local landing-budget attempt: `BENCH_TARGET_URL=http://127.0.0.1:33999 SHARE_LIST_PATH=/u/local/lists/local ./bench.sh budget --where local --runs 1 --label media-language-review --path public`, from `goodwatch-benchmark` after confirming no `config.env` override. **Exit 2:** Docker API socket permission denied; no Lighthouse result directory. No local fixture server or production benchmark was started. Budget remains unverified.

- Fresh typecheck after restart: branch **174 diagnostics**, frozen `origin/main` **174 diagnostics**, **zero new or removed**. Main baseline: `ad7e6d1905706a565ab0f2635da3b9af32e877a8`, extracted with `git archive` outside either project worktree and using the same installed dependencies. Both commands: `NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck -- --noEmit`; both exit **2** because the existing diagnostics remain. Branch elapsed **77.19 seconds**, main **87.27 seconds**. Comparison uses file/code/message counts, ignoring line/column shifts and quoted union-member ordering; it does not suppress errors.

- Fresh production build after restart: **passed, exit 0**, **49.10 seconds**. Command: `SENTRY_DISABLE_AUTO_UPLOAD=true NODE_OPTIONS=--max-old-space-size=2048 npm run build`. Client and server bundles compiled; **705 files** precompressed. Sentry auto-upload was disabled. The build reports the existing Node `module.register()` deprecation warning; no build error. Typechecks and build ran one heavy job at a time, with a 2-GiB heap cap.
- Final `git diff --check` is clean. Protected media-preference/media-text/details/WhereToWatch/settings UI files, package manifests and npm lockfile have no changes. HEAD remains `7e4bb2a0`; all review fixes are uncommitted/unstaged.

A machine/session restart cleared the earlier temporary logs; the Node/Python counts above were recorded before that restart. Fresh typecheck/build logs are under `/tmp/gw-language-review-*` and remain local ephemeral artifacts. Browser sign-in/session establishment and live localized rendering were not exercised here; those checks remain with the UI/release thread.


## Changed files

- `docs/implementation/media-language-decisions.md`
- `docs/implementation/media-language-review-fixes.md`
- `docs/implementation/media-language-rollout.md`
- `docs/implementation/media-language-surface-matrix.md`
- `goodwatch-flows/tests/test_media_language_text.py`
- `goodwatch-flows/windmill/f/media_language/ingest_episode_translations.script.lock`
- `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`
- `goodwatch-webapp/app/root.tsx`
- `goodwatch-webapp/app/routes/api.media-preferences_.session.ts`
- `goodwatch-webapp/app/routes/api.media-title.ts`
- `goodwatch-webapp/app/routes/api.user-settings.set.tsx`
- `goodwatch-webapp/app/routes/discover.($type).tsx`
- `goodwatch-webapp/app/routes/explorer.tsx`
- `goodwatch-webapp/app/routes/person.$personKey.tsx`
- `goodwatch-webapp/app/routes/show.$showKey.tsx`
- `goodwatch-webapp/app/server/crawler-media-keys.test.ts`
- `goodwatch-webapp/app/server/details.server.ts`
- `goodwatch-webapp/app/server/episode-text-overlay.server.ts`
- `goodwatch-webapp/app/server/explorer/http.server.ts`
- `goodwatch-webapp/app/server/locale-source-cache.server.ts`
- `goodwatch-webapp/app/server/locale-source-cache.test.ts`
- `goodwatch-webapp/app/server/media-context.server.ts`
- `goodwatch-webapp/app/server/media-context.test.ts`
- `goodwatch-webapp/app/server/media-overlay.server.ts`
- `goodwatch-webapp/app/server/media-overlay.test.ts`
- `goodwatch-webapp/app/server/media-payload.server.ts`
- `goodwatch-webapp/app/server/media-preferences-store.server.ts`
- `goodwatch-webapp/app/server/media-rollout-contract.test.ts`
- `goodwatch-webapp/app/server/person.server.ts`
- `goodwatch-webapp/app/server/title-extras-prefetch.test.ts`
- `goodwatch-webapp/app/server/title-extras-prefetch.ts`
- `goodwatch-webapp/app/ui/auth/AuthProvider.tsx`
- `goodwatch-webapp/app/ui/explorer/ExplorerMap.tsx`
- `goodwatch-webapp/app/ui/taste/exploration-cache.ts`
- `goodwatch-webapp/app/ui/tracking/store.test.ts`
- `goodwatch-webapp/app/ui/tracking/store.ts`
- `goodwatch-webapp/app/utils/episode-text-overlay.ts`
- `goodwatch-webapp/app/utils/media-language.test.ts`
- `goodwatch-webapp/app/utils/media-language.ts`
- `goodwatch-webapp/app/utils/media-overlay-core.ts`
- `goodwatch-webapp/app/utils/media-payload-core.ts`
- `goodwatch-webapp/app/utils/media-presentation.ts`
- `goodwatch-webapp/app/utils/media-script.test.ts`
- `goodwatch-webapp/app/utils/media-script.ts`
- `goodwatch-webapp/app/utils/person-best.test.ts`
- `goodwatch-webapp/app/utils/person-best.ts`

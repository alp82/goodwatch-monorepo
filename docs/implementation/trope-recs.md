# By your tropes backend

The member receives one ranked list of unseen movies and shows, or one list for a selected trope from their own profile. This implements prototype G (`prototype/trope-recs`, `rank3.ts`), without UI or availability filtering.

## API

`GET /api/trope-recs?kind=all|movie|show&trope=<URL-encoded trope ID>`

`kind` defaults to `all`; omitting `trope` selects For you. The authenticated session supplies the member ID. Query parameters cannot select another member. Signed-out requests return 401. Invalid kinds, empty/oversized trope IDs, and tropes outside the member's positive top 60 return 400. IDs are canonical TV Tropes URLs or the existing unresolved `label:` identities, never guessed slugs or display names.

The JSON response contains:

- `pending`: no completed candidate index or member profile snapshot yet. HTTP 202 with `Retry-After: 2`; retry the request. HTTP 200 means a completed result, including a legitimately empty list.
- `refreshing`: a candidate/profile rebuild is running while the last complete generation remains usable.
- `kind`, `trope` (null for For you).
- `tropes`: the member's top 60 positive tropes, each `{ id, name, rank, z, count, loved, labels }`; rank starts at 1. `count`/`loved` are the member's titles carrying it and those scored 8+; `labels` are the aggregate title trope names merged into the identity (the title page matches its trope names against them). The profile uses the member's entire scored pool; `kind` filters candidate titles only.
- `titles`: at most 120 For you or 60 single-trope titles. Each has `{ id, kind, name, year, poster, gwScore, href, match, matchedTropes, matchedCount, wishlist }`. `id` is `movie-<TMDB ID>` or `show-<TMDB ID>`. `poster` is the stored poster path; `href` comes from the existing `titlePath`. `matchedTropes` contains at most eight `{ id, name, rank, d }` entries in member rank order. All matched tropes contribute to scoring even when only eight are returned; `matchedCount` counts them all. In single-trope mode the selected trope is always among the eight (it takes the eighth place when ranked lower).

Every response is `Cache-Control: private, no-store`, `Vary: Cookie`. Backend read failures propagate as failures rather than masquerading as an empty recommendation list. A failed shared build retains its previous complete generation and retries with exponential backoff and jitter (starting at 30–37.5 seconds); without a previous generation the resource remains pending.

`GET /api/trope-recs/tropes` returns only `{ pending, tropes }` (same trope shape, no candidate index, no member data reads beyond the profile snapshot); 202 with `Retry-After: 2` while the snapshot builds, 401 signed out, always `private, no-store`. The For you switch, the profile's "Picks with this trope" link and the title page's trope links read it.

## UI

`/watch/for-you/tropes` (route `watch.for-you_.tropes.tsx`, UI `app/ui/trope-recs/`; `/for-you/tropes` redirects there). Query: `trope=<key>` (`tropeSlug` in `app/domain/trope-recs.ts`: a Main page name, `Namespace.Page`, or the `label:` identity) and `kind=movie|show`. The page is `private, no-store` and `noindex, follow`; data loads in the browser. `/watch/for-you` shows "Curated for you | By your tropes" only when the loader finds the member has top tropes.

## Lazy text

`GET /api/trope-recs/excerpts?trope=<ID>&keys=movie-123,show-456` accepts at most 16 valid distinct title keys, using the existing profile excerpt parameter validation. It authenticates the session, validates the trope against the member's profile, and allows a title key when it is in the shared index, carries the requested trope, and is not excluded for that member. Titles outside the ranked result limits are eligible. It returns `{ pending, examples: [{ key, text, label }] }`; pending uses HTTP 202. Unknown/unavailable title keys produce no example. Responses are private and not stored by HTTP caches.

Only this lazy resource fetches `trope.content`. It filters SQL by the requested identity’s raw source URLs from the shared index; null-URL unresolved identities use `url IS NULL AND match(name, ?)` with an exact identity check in code. It paginates matching associations and returns the longest nonempty matching example per title, converted with `htmlToText` and shortened with `trimExample`. Recommendations do not send descriptions or excerpts eagerly.

Descriptions use the existing `/u/:handle/tropes/descriptions` route for the member's own handle, using POST with a JSON array of at most 60 IDs as the request body. The profile excerpts route remains for scored titles; it deliberately cannot authorize recommendation titles. Consumers displaying TV Tropes text must show the source link and CC BY-NC-SA 3.0 attribution as existing trope views do.

## Data sources and eligibility

`loadProfileTropes` supplies the existing URI-indexed member pool and reuses `tropes-cache.server.ts`: Redis `profile-tropes:v2:<member>` and the durable Crate `profile_tropes_snapshot` generation. Its existing `taste:touched:<member>` checks and background rebuilds apply. The recommendation code does not implement a second profile builder or write a second profile snapshot. Request paths use `wait: false` and omit descriptions.

The shared candidate build reads Crate `movie` and `show`, taking the top 6,000 eligible titles of each by descending popularity (TMDB ID breaks ties). Eligibility requires GW score >=66, a nonempty poster, and at least 12 entries in the title's aggregate `tropes` array. There is no per-member database candidate query.

For those titles, batches of 200 IDs read `trope.media_tmdb_id`, `name`, `url`, and imported `content_length`, with 10,000-row pagination. No article content is read. The build collects the union of URLs across both kinds and every batch and resolves it once (including negative lookups). A dedicated serial reader uses a bounded 15-second query timeout for both metadata and reference queries, independently of the four-wide profile catalog queue and its request deadlines. The reference resolver reads the existing `trope_catalog_reference` and `trope_catalog_page` tables, and `tropeTarget` supplies exactly the profile's canonical/unresolved identity rules. Aliases within a title merge once, keeping the maximum excerpt length. Aggregate names lacking a source row remain unresolved with length zero. Candidate associations have no minimum catalog frequency threshold.

Existing `getUserData` supplies scores, Wishlist, skipped, not-interested and watch state, with its existing cache/reset behavior. Every scored title and every watch-state title is excluded, including Watching, On hold and Dropped. A separate grouped `user_watch_log` read also excludes log-only titles: the existing `watchStateOf` map deliberately omits titles in Not started. Wishlist titles remain eligible and carry `wishlist: true` unless another exclusion applies.

## Ranking

`memberTropes` calls the Tropes tab's existing `rankTropes` function. Its binomial z compares the trope's 8+ share with the member's own 8+ rate. Recommendations then enforce the prototype's fixed minimum of ten titles, keep z >0, and take the top 60 with the tab's loved-count/name tie rules. A zero or one base rate yields no positive profile.

Definingness uses the existing `defining(length, titleTropeCount)` measure:

```
d = round(100 * ln(1 + max(0, content_length)/100) / ln(10 + titleTropeCount))
```

As in the fixture builder, `titleTropeCount` is the distinct count of aggregate title trope names. The x100 scale is intentional: it is the scale in the prototype and the profile's compact matrix, and is also the API's `d` scale. The denominator differs from the URI-indexed Tropes tab, which counts merged identities rather than aggregate names.

For every eligible unseen title with at least one profile trope:

```
raw = sum(z * (0.5 + min(d, 60)/60)) / sqrt(matched count) * GW/100
match = round(100 * raw / best raw)
```

Sort by raw descending, then GW descending, then title ID for deterministic exact ties. Normalize over the full eligible list after the kind filter, then take 120. Each title occurs once.

Single-trope mode uses every eligible title carrying the selected profile trope, including titles outside the first 120 For you results:

```
rawSingle = 0.6 * min(d,60)/60 + 0.4 * ForYouMatch/100
matchSingle = round(100 * rawSingle / best rawSingle)
```

ForYouMatch is the rounded match from the full kind-filtered list, exactly as prototype G uses it. Sort by rawSingle, retaining For you order for ties, normalize to top=100, then take 60.

## Cache lifecycle and performance

The shared candidate index is one module-level in-memory generation per webapp process, containing title metadata, one shared `string[]` of trope IDs with parallel names and raw source references, and numeric `{ i, d }` associations per title. It lives for one hour. Concurrent builds join one promise; stale reads keep the last complete generation during refresh. Cold reads start a build and return pending. Restarts build again; instances can temporarily have different catalog generations. No Redis copy or Crate writes are needed for this index. Build-local rows and resolver maps are discarded after publication; member results contain copied display fields and do not retain the index, so replacing the shared generation releases the old one after active requests finish. Failed builds publish nothing and back off exponentially from 30 seconds to a 15-minute base delay, with up to 25% added jitter. A successful build resets the failure count. Page and both-role processes schedule one warm read 30 seconds after the module loads; search-role processes skip it. The timer is unreferenced and uses the same build deduplication as requests.

The log-key read uses the existing `cached` helper with name `trope-recs-watch-log-v1`, parameters `{ userId }`, 15-second fresh TTL and no stale window. Its physical Redis key is generated by `cached`, following the existing data-cache convention. It needs no mutation-path changes; log-only exclusions converge within 15 seconds after the underlying Crate read can see a write.

Member results use an in-memory map with 15-second TTL and at most 128 entries. Each key is SHA-256 of member ID, kind, selected trope, candidate generation, profile generation/ranks, sorted exclusion keys and sorted Wishlist keys. Current member inputs are read before looking up a result. Existing `resetUserDataCache` on score/mark mutations therefore changes the key immediately when exclusion or Wishlist membership changes. Profile weights refresh on the existing profile snapshot schedule; a stale snapshot is explicitly marked refreshing. In-flight results under old inputs cannot overwrite new-input entries. Log-only membership changes use the short log TTL. Existing member-data fallback TTLs still apply if a reset fails.

Warm candidate scoring is entirely in memory; auth, member-data, profile and log reads use their existing or short caches. The synthetic unit check scores 12,000 candidates with 20 matched associations each against a 60-trope profile in under 300 ms. This measures the ranking computation, not an end-to-end latency guarantee: actual auth/Redis latency and large member-profile ranking costs need deployment measurements. No production reads or server startup were used to validate this change.

## Verification

Run `node --test app/server/trope-recs/*.test.ts` from `goodwatch-webapp`. Tests cover the ranking formulas and limits, profile reuse/minimum, identity aliases, candidate eligibility query and pagination, exclusions/Wishlist, cache refresh/expiry/failure, resource auth/ownership/validation, excerpt membership and SQL source filtering, independent serial build reads, startup role/delay behavior, exponential retry/reset, and the warm scoring budget. Run the repository TypeScript check and compare diagnostics against the unchanged baseline; unrelated existing errors are not changed by this module.

# MCP search filters and query-free discovery

Owner decision Q53 (2026-10-17). `search_titles` accepts the Discover filters, and `discover_titles` browses without query text. `get_discover_filters` returns exact genre names and provider IDs/names for the member's saved country, including saved providers, plus the shared Discover metadata described below. All three are read-only and require `mcp:read`. No new tables, DML grants or action receipts are needed.

## Contract

Both title tools accept the same optional filters. Without the facts sidecar, budget, box office, returns, seasons, show status and hours do not narrow results. `discover_titles` reports `facts_available: false` in that case:

| Parameters | Meaning |
| --- | --- |
| `type` | `all`, `movie`, `show` |
| `genres` | One exact genre name or an array of names from `get_discover_filters`; matches any selected genre |
| `min_year`, `max_year` | Inclusive release years, 1800–2100 |
| `min_runtime`, `max_runtime` | Inclusive minutes: movie runtime or the site's usual show episode length (`episode_runtime[1]`); missing runtime fails a range. When episode bounds are supplied these apply only to movies. |
| `min_episode_runtime`, `max_episode_runtime` | Inclusive episode minutes, independent of movie bounds; missing episode length fails a range. Without these arguments runtime bounds retain their old meaning for both kinds. |
| `rest_of_world` | At least one production country outside US, IN, KR, JP, GB, FR, CN, HK; co-productions included. Joins picked production countries with any-of. |
| `min_budget_musd`, `max_budget_musd` | Inclusive nominal USD millions; movies with known budgets only. |
| `min_box_office_musd`, `max_box_office_musd` | Inclusive nominal USD millions; movies with known box office only. |
| `returns` | Single `hit` (box office at least 3× budget) or `flop` (below budget); movies with both amounts known only. |
| `min_seasons`, `max_seasons` | Inclusive season counts; shows with known seasons only. |
| `show_status` | Single `running`, `ended`, or `canceled`; shows with known production status only. |
| `min_hours`, `max_hours` | Inclusive total hours, episodes × episode length / 60; shows with both facts known only. |
| `min_votes`, `max_votes` | Inclusive rating count bounds. Catalog eligibility still starts at 1,000 ratings. URL: `votes=10000-100000`; Hidden gems uses `votes=-9999`. |
| `min_popularity_rank`, `max_popularity_rank` | Inclusive rank in the eligible catalog's Popular order (both kinds), 1 first. Shared across viewers and filters, cached per snapshot version. URL: `rank=1-1000`. Unknown/unranked titles fail active ranges. Reversed ranges are rejected. `page_url` preserves both popularity ranges; recovery clears both. |
| `source_scores` | Inclusive minimums keyed by `imdb`, `rtCritics`, `rtAudience`, `metacritic` (critics), `metacriticUsers`; all must pass. Normalized integers 0–100: 70 means 7.0 for IMDb/Metacritic users, 70% for RT, 70 for Metascore. Suggested shared steps: 60, 70, 80, 90; arbitrary integer thresholds remain valid. Missing scores fail even at zero. URL: `sources=metacriticUsers:70`. Like the other sources, option counts are currently unavailable (SQL sets load only active thresholds). |
| `minimum_score` | Inclusive GoodWatch score, integer 0–100 |
| `on_my_services` | Saved services in the saved country; defaults false. As on the site, no saved services means no narrowing |
| `providers` | Any of the selected numeric provider IDs in the saved country; cannot combine a nonempty list with `on_my_services=true` |
| `anime` | `any`, `only`, `none` |
| `match_all` | Array of `moods`, `themes`, `styles`, `genres`: require every pick within each named group; other groups keep any-of matching. Ignored with fewer than two distinct picks. The matching `page_url` carries `all=`. All-of counts for picked options show removal of that unit; unpicked options show adding it. Folded genre pairs form one unit, matching either name. Group recoveries remove the whole group. |
| `moods`, `themes`, `styles` | Up to three of each; valid keys are enumerated from the site's constants in the schemas. Mood descriptions use the shared names: Cozy (`feelgood`), Romantic (`romance`), Thrilling (`action`), Sad (`heavy`), Trippy (`mind`). The original 11 keys and rules are unchanged; Tense (`tense`), Dark (`dark`), Deep (`deep`), Magical (`magical`) and Quirky (`quirky`) are appended, for 16 moods total. Descriptive search also accepts previous names. Include a group in `match_all` to require every pick. |
| `seen_only` | Seen before (`seen=1`); mutually exclusive with `exclude_seen=true`. URL parsing uses the last valid seen/unseen choice. Requires a member. |
| `wishlist_only` | On your wishlist (`wishlist=1`); combines with either seen choice. Requires a member. |
| `outside_usual` | Outside your usual (`match=outside`): taste match 50–59; supersedes `minimum_match`. Requires a member and taste; otherwise does not narrow. |
| `minimum_match` | Site taste-match thresholds: 0, 60, 70, 80, 90; does not narrow without taste |
| `released` | Site presets: `any`, `recent` (current year and two before it), `2010s`, `2000s`, `before2000` |
| `rating_country` | ISO alpha-2 code for the age-rating ladder and title rating badges, independent of streaming country/services. Defaults to the saved country; codes absent from the snapshot ratings fall back to that default. `page_url` carries `ratingCountry=DE`. |
| `age_limit`, `hide_content`, `show_content` | `rating_country` or the saved country's rating ladder and the site's content choices; hidden choices win conflicts. Unavailable ratings do not narrow, matching the site |
| `order` | `for_you` (default), `popularity`, `newest`, `score`, `match` |
| `for_you`, `exclude_seen` | Existing switches: For you on by default, seen titles included by default |
| `limit`, `cursor` | Up to 40 titles per page; repeat filters for `offset:N` pages |

For you uses the site's popular browse order with its taste adjustment, or bounded relevance adjustment in ranked search. Explicit popularity/newest/score orders default to the plain sort; `for_you=true` can retain the site's adjustment. `match` uses the site's Best match order and reports the fallback `sort_used` without taste. Cheap name lookup retains its name order unless `order` is supplied; it does not apply a taste adjustment. Use `discover_titles` for browsing without a query. For compatibility, `search_titles` with a missing, empty or whitespace-only query runs that same discovery path, including its full filter/order model and grid page URL. This also applies when `ranked=true`: no smarter-match attempt is charged, and offset paging remains valid. A `ranked:` cursor still inherits its original search query and view.

Discovery items carry canonical `url`, Markdown `link`, current `match`/`match_label`, `runtime_minutes`, `poster_url` and `goodwatch_score` (0–100). The tool shares the existing poster-grid resource. No per-title availability requests are added. `availability` reports `everywhere`, `mine` or `providers`; `country` and `approximate_availability` describe service scope and the site's column fallback while its country index loads.

## Discover metadata (B15)

`get_discover_filters` keeps `country`, `saved_provider_ids`, `genres` and `providers` unchanged and adds compact guidance. No tool argument schema changes or schema version are introduced. The pure `mcp/discover-metadata.ts` adapter reads shared domain constants; `discover.server.ts` supplies the live snapshot's `facts_available` boolean. A missing snapshot still returns `data_unavailable`.

- `scores`: GoodWatch minimum steps and each source's stable key, name, notation (`ten`, `percent`, `hundred`) and normalized steps with display labels. For example IMDb `7.0+` and Tomatometer `70%+` both send 70. Arbitrary integer thresholds 0–100 remain accepted; missing scores fail active thresholds.
- `votes`, `popularity_rank`, `budget`, `box_office`, `seasons`, `time_to_finish`: units, steps, min/max argument names and presets with ready-to-use `args`. Bounds are inclusive and absent bounds are open. Votes retain the 1,000-rating browse floor; catalog Popular ranks start at 1 and refresh per snapshot. Money is nominal USD millions. Budget seams use 4.999/49.999/99.999; watch-time seams use whole minutes expressed in hours. `returns` and `show_status` carry the shared labels.
- `released`: current UTC year, This year, Last 2/3/5 years, decades from the 1920s, After 2000/1950, Any time and Before 2000. Last N years starts at current year minus N: in 2026, Last 2 years starts at 2024 and sends `released=recent`. Other year tiles supply `min_year`/`max_year`. Current-year upper ends stay open, matching the website. Preset arguments replace the previous selection's year arguments; do not merge stale bounds into them.
- `length`: shared five-minute slider step, 240-minute open-end stop, movie and episode presets with their separate argument names. Runtime alone retains its legacy meaning for both kinds. Explicit episode bounds make runtime movie-only. Preset boundaries stay inclusive, including the website's “Under 90 min” at 90.
- `origin`: industry and region names with country codes from `film-industries.ts`, and Rest of the world with excluded codes and `args: {rest_of_world: true}`. Co-productions match any listed country. **Industries and regions are website reference options:** the current MCP schemas have no production-country/industry/region argument. `rating_country` cannot select them. Rest of the world remains directly selectable.
- `moods`: all 16 stable keys, current names and old-name aliases from `moods.ts`, including Tense, Dark, Deep, Magical and Quirky. Clients send keys; aliases describe previous names accepted in descriptive search, not new enum values.
- `match`: minimum steps 0/60/70/80/90 and Outside your usual (50–59), which supersedes the minimum. Without member taste these do not narrow. `list_filters` describes member-only `seen_only` and `wishlist_only`, including the seen/exclude conflict. `match_all` lists the four supported groups and all-of behavior.
- `rating_country`: ISO alpha-2 rating-ladder/badge scope, saved-country default and fallback for unavailable codes; independent of streaming country and production origin.
- `facts_available` and `facts_note`: without a facts sidecar, money, returns, seasons, show status and hours do not narrow results. With facts, unknown values fail active filters and movie/show applicability follows the existing engine.

No full country directory or additional service list is returned. Preset keys identify guidance, not new tool arguments. Unit tests validate every advertised preset against the unchanged strict schema, shared ranges/notation, year rollover, names/aliases and compact payload size. The isolated SDK case table also covers the newly described arguments and metadata response; it requires databases and must not run against production.

## Shared implementation

`mcp/discover-filters.ts` adapts the public arguments to `domain/filter-state.ts`. Discovery and filtered search call the same `title-filter/index.server.ts` used by Discover/Explore, including hidden-title rules, provider aliases, eligibility, sort fallback, age/content rules, For you and Best match. Search keeps hidden titles findable, as the site's search does. Defaults deliberately override website saved defaults: everywhere, seen included, For you on.

Popularity ranges share one fail-mask group and one recovery. `title-scales.ts` defines the slider stops and presets. `optionCounts.popularity` uses `votes:<preset key>` and `rank:<preset key>` for tiles, `votes:<stop>` and `rank:<stop>` for minimum thresholds, and `votes:any` / `rank:any` for clearing one range. Each count replaces that range while keeping the other range and all other groups applied. Bounds follow the existing inclusive convention; strict “under 10K” and “past #10K” presets use 9,999 and 10,001 respectively.

Year bounds use the existing shared legacy predicate path. For a search or Wishlist universe, those predicates are scoped to its title IDs and do not impose Discover's browse vote/poster floor, so little-known namesakes remain searchable. Runtime bounds extend that same shared path and URL codec (`minRuntime`/`maxRuntime`), with parameterized SQL and separate movie/show runtime expressions. Minimum score now accepts every integer 0–100 through the shared URL parser; the filter bar retains its existing quick choices. These choices let the website reproduce a tool's runtime and score ranges without a separate MCP filter engine.

`page_url` uses the site's `filterQuery` codec, with explicit services/unseen/For you defaults. Discovery links add `layout=grid`, which keeps the route in its ordinary grid instead of its optional Sides of you rows. Search retains its broader-results note because the website performs ranked search even when MCP used name lookup. Website and offset pages can change as the catalog, availability or member's taste changes; URLs reproduce the view, not a frozen result snapshot.

Name queries with filters read the complete bounded name batch before filtering/paging, preserving canonical IDs and distinct namesakes. A query matching more than 100,000 names returns `query_too_broad` rather than presenting a truncated result as complete. The original indexed cheap path remains for unfiltered name lookup. No paid search is used for discovery or filters.

Ranked search still pays only for admitted raw query work. Its 60-second raw cache is independent of filter choices; changing filters creates a free 15-minute view. View IDs cover all normalized filters. Ranked cursors inherit their original filters and page URL, reject explicitly changed filters, and never rerun ranking. Public filter metadata is stored with the view; raw query text remains encrypted and no private marks/taste vectors or derived match percentages are added to snapshots.

Policy flags are `REC_MCP_DISCOVER_TITLES` and `REC_MCP_DISCOVER_FILTERS`, in addition to the existing shared read flag. Both default enabled, and policy is checked at listing and call time. Existing authenticated request limits and bounded metrics apply.

## Verification

From `goodwatch-webapp`:

```bash
npm ci
node --test app/server/mcp/*.test.ts app/domain/filter-state.test.ts
bash scripts/mcp-discover/run.sh
npm run test:auth:mcp
npm run build
```

The new runner creates its own pinned CrateDB 5.10.12/Valkey 8.1.3 containers on loopback ports 15867/16867, refuses existing containers and other clusters, and removes only the containers it created. It does not load `.env`. The 72-title snapshot and rating sidecar go through the real Redis publisher format/loader. The public SDK handler checks the filter/sort case table against the real Discover engine and website URL parser, plus populated taste via the existing isolated `mcp-personal` fixture, defaults, 40+32 pagination, provider options, numeric score ranges, movie/show runtimes, poster links, inherited ranked cursors, rejection of changed cursor filters and free filter changes. Unit tests cover schema bounds for every parameter, conflicting selections, all orderings and cache-key coverage.

Both `scripts/mcp-discover/run.sh` and `npm run test:auth:mcp` require disposable database containers; the auth runner also starts its rehearsal server. They are not unit-only commands. For B15, run only the focused `node --test` metadata/filter tests and the TypeScript check; these integration runners were not executed.

The existing read, write, ranked, native provider and personal-result MCP suites were also run in isolated copies targeting those disposable ports; the native provider fixture used port 15869. The OAuth/MCP suite uses its separate disposable three-node Crate/Valkey rehearsal.


## Owner retest fix (2026-10-17)

On build `4e88c842`, both vector1 search-role logs recorded repeated `/mcp` catalog queries at 13:01–13:04 UTC with no name predicate: a movie/show union ordered by title, runtime and ID. Each query exhausted three CrateDB attempts and the 8-second request budget (`CrateTimeoutError`, then cancellation `TimeoutError`, code 23). Filtered blank searches fetched up to 100,001 catalog names before applying the filters; the filters did not reach the bounded Discover engine in time. This was a dispatch bug, not an unavailable genre/provider or a need to raise database timeouts.

Blank search now delegates directly to `readDiscover`, before any name lookup or ranked admission. The page-link adapter makes the same distinction, so it supplies the ordinary Discover grid URL and no name-search broader-view note. A single genre string normalizes to the same shared filter model as an array. Named searches and inherited ranked cursors retain their existing paths.

The SDK regression compares complete search/discovery payloads for both owner examples, omitted/empty/whitespace queries, `ranked=true`, defaults and offset pages. The isolated fixture verifies exact shared-engine parity rather than attempting to recreate production catalog size or database overload. Existing named-search and ranked-cursor tests cover the other dispatch paths.

The October 17 fix originally added formatting instructions for title/person links and bulleted answers. The October 19 owner decision removed these directives from every tool description and replaced initialization instructions with neutral field facts for directory review; see the [cleanup report](mcp-description-cleanup-2026-10-19.md). Cast, directors, creators, people search and filmography subjects retain `link` alongside `person_id`, `name`, `url` and department. Unit and real SDK tests still check linked person payloads; endpoint tests now check that answer-formatting directives are absent. Claude.ai chooses its final answer formatting.

Verification for this fix: 103 focused tests passed; the full app suite passed 3,300 tests (zero failures, one existing skip, one existing tracking TODO). The discovery SDK runner passed all 29 filter/order cases plus blank-query/offset regression cases and a zero-ranked-work assertion. Read, write, fresh-process receipts, ranked/native search, personal results, real-Qdrant details/similarity, scoped people/list/settings/range and feature-replay integrations passed. The details probe's stale poster resource expectation was updated to v2; feature probes were run with fixture Redis cleared between seed sets. All 44 OAuth/MCP tests, auth typechecking and production build/precompression passed. Whole-app typechecking reports the known 178 diagnostics, with none in changed MCP files.

Episode bounds and Rest of the world use the shared filter state and are carried in `page_url` as `episodeRuntime=<min>-<max>` and `restOfWorld=1`. Website URLs can explicitly leave episodes unlimited with `episodeRuntime=any` while limiting movies with `runtime`. Both lengths share one recovery group; Rest of the world shares the Made in country group.

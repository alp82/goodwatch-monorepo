# MCP search filters and query-free discovery

Owner decision Q53 (2026-10-17). `search_titles` accepts the Discover filters, and `discover_titles` browses without query text. `get_discover_filters` returns exact genre names and provider IDs/names for the member's saved country, including saved providers. All three are read-only and require `mcp:read`. No new tables, DML grants or action receipts are needed.

## Contract

Both title tools accept the same optional filters:

| Parameters | Meaning |
| --- | --- |
| `type` | `all`, `movie`, `show` |
| `genres` | Any of the selected exact genre names from `get_discover_filters` |
| `min_year`, `max_year` | Inclusive release years, 1800–2100 |
| `min_runtime`, `max_runtime` | Inclusive minutes: movie runtime or the site's usual show episode length (`episode_runtime[1]`); missing runtime fails a range |
| `minimum_score` | Inclusive GoodWatch score, integer 0–100 |
| `on_my_services` | Saved services in the saved country; defaults false. As on the site, no saved services means no narrowing |
| `providers` | Any of the selected numeric provider IDs in the saved country; cannot combine a nonempty list with `on_my_services=true` |
| `anime` | `any`, `only`, `none` |
| `moods`, `themes`, `styles` | Up to three of each; valid keys are enumerated from the site's constants in the schemas |
| `minimum_match` | Site taste-match thresholds: 0, 70, 80, 90; does not narrow without taste |
| `released` | Site presets: `any`, `recent` (current year and two before it), `2010s`, `2000s`, `before2000` |
| `age_limit`, `hide_content`, `show_content` | Saved country's rating ladder and the site's content choices; hidden choices win conflicts. Unavailable ratings do not narrow, matching the site |
| `order` | `for_you` (default), `popularity`, `newest`, `score`, `match` |
| `for_you`, `exclude_seen` | Existing switches: For you on by default, seen titles included by default |
| `limit`, `cursor` | Up to 40 titles per page; repeat filters for `offset:N` pages |

For you uses the site's popular browse order with its taste adjustment, or bounded relevance adjustment in ranked search. Explicit popularity/newest/score orders default to the plain sort; `for_you=true` can retain the site's adjustment. `match` uses the site's Best match order and reports the fallback `sort_used` without taste. Cheap name lookup retains its name order unless `order` is supplied; it does not apply a taste adjustment. Empty-query browsing should use `discover_titles`.

Discovery items carry canonical `url`, Markdown `link`, current `match`/`match_label`, `runtime_minutes`, `poster_url` and `goodwatch_score` (0–100). The tool shares the existing poster-grid resource. No per-title availability requests are added. `availability` reports `everywhere`, `mine` or `providers`; `country` and `approximate_availability` describe service scope and the site's column fallback while its country index loads.

## Shared implementation

`mcp/discover-filters.ts` adapts the public arguments to `domain/filter-state.ts`. Discovery and filtered search call the same `title-filter/index.server.ts` used by Discover/Explore, including hidden-title rules, provider aliases, eligibility, sort fallback, age/content rules, For you and Best match. Search keeps hidden titles findable, as the site's search does. Defaults deliberately override website saved defaults: everywhere, seen included, For you on.

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

The new runner creates its own pinned CrateDB 5.10.12/Valkey 8.1.3 containers on loopback ports 15867/16867, refuses existing containers and other clusters, and removes only the containers it created. It does not load `.env`. The 72-title snapshot and rating sidecar go through the real Redis publisher format/loader. The public SDK handler checks 29 filter/sort combinations against the real Discover engine and website URL parser, plus populated taste via the existing isolated `mcp-personal` fixture, defaults, 40+32 pagination, provider options, numeric score ranges, movie/show runtimes, poster links, inherited ranked cursors, rejection of changed cursor filters and free filter changes. Unit tests cover schema bounds for every parameter, conflicting selections, all orderings and cache-key coverage.

The existing read, write, ranked, native provider and personal-result MCP suites were also run in isolated copies targeting those disposable ports; the native provider fixture used port 15869. The OAuth/MCP suite uses its separate disposable three-node Crate/Valkey rehearsal.

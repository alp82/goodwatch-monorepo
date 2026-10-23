# Member MCP read tools (#567)

The Q53 additions (people, share lists, episode ranges and Settings) are documented in [MCP people, lists, progress and settings](mcp-people-lists-progress-settings.md).

The write extension built on #577 is documented in [Member MCP write tools](mcp-write-tools.md).

Q53 adds [More like this and richer title details](mcp-similar-title-details.md), including the `get_similar_titles` poster-grid tool and `get_title` include groups/episode paging.

The Remix resource route `goodwatch-webapp/app/routes/mcp.ts` serves a stateless MCP SDK **2.3.1** handler at `/mcp`, including stateless legacy clients. It shares the webapp's server readers and tracking state machine; it does not import the spike's fixture store or OAuth server. Schemas use the exact **Zod 4.6.7** `zod4` package alias; existing webapp schemas keep Zod 3.

## Authorization handoff to #566

`app/server/mcp/authorization.server.ts` exports the single SDK `OAuthTokenVerifier` seam, `mcpAuthorization`. It is wired to the durable Better Auth JWKS and grant verifier by #566; see [MCP authorization](mcp-authorization.md). There is no development token, member override header, session-cookie fallback, or environment switch that bypasses authorization in the application route.

The verifier checks Better Auth JWKS and current member, client and grant state. Its returned `AuthInfo` must contain the verified token, OAuth client ID, scopes, expiration in epoch seconds, resource audience as a `URL`, and `extra.userId` mapped from the verified member subject. Missing identity, missing/expired expiration, an audience other than this resource, or missing `mcp:read` cannot reach member data. JWT signature verification, issuer checks, grant revocation/last-use, OAuth metadata and token refresh belong to #566. The local integration probe supplies a verifier only to its private handler instance, never to the Remix route.

Set `MCP_RESOURCE_URL` to the canonical external `/mcp` URL. The gate advertises `/.well-known/oauth-protected-resource/mcp` at that origin; #566 must serve that metadata. Requests must arrive with that origin, and browser `Origin` headers must match it. Requests without an `Origin` header are supported. Every response gets `Cache-Control: private, no-store, no-transform`, and `/mcp` is excluded before the HTML page cache can resolve an identity or allocate an entry.

## Tools and data sources

| Tool | Source | Result |
| --- | --- | --- |
| `search_titles` | `combined-search/catalog.server.ts`'s local SQL reader | Indexed name lookup over movies and shows, without TMDB fallback, ranking, paid interpretation, or daily ranked-search charges |
| `get_title` | `details.server.ts`, `viewer.server.ts`, `userData.server.ts`, `availability.server.ts` | Details, the member's marks, and evaluated availability evidence for saved country/services |
| `get_my_shows` | `my-shows.server.ts`, `viewer.server.ts`, `taste/index.server.ts` | Continue, Pick up, Waiting for episodes, Want to See, On hold and Dropped in the page's order |
| `get_show_progress` | `show-tracking.server.ts`, `tracking/storage.ts`, `tracking/machine.ts` | Stored status, current-pass progress, next episode, and paged watch records across passes |
| `get_tonight` | `tonight.server.ts` | **Watch next**: one next episode, Wishlist choice or suggestion, linked to `/my-movies` or `/my-shows` |
| `get_library` | `userData.server.ts`, `title-cards.server.ts` | Only the member's marked titles, including Not interested and ratings, with status/kind filtering, Wishlist `added_at` dates and native library sorts |
| `get_taste` | `taste/index.server.ts`, `userData.server.ts` | Actual taste signal/leanings and member rating/Wishlist counts, with an explanation when the model is unavailable or evidence is insufficient |

Results carry compact `structuredContent` and matching text for older clients. List-like results include `page_url` for the corresponding GoodWatch page and, where the website has no identical filter or uses different search behavior, a `page_note` explaining the difference. Since the October 19 owner decision, tool descriptions contain no answer-formatting directives and initialization describes these result fields factually; see the [cleanup report](mcp-description-cleanup-2026-10-19.md). Title IDs are `movie:603` or `show:1399`, with canonical title URLs and a ready-made Markdown `link` labelled `Title (Year)`. My shows reads the real catalog year for each returned page. Unknown years are labelled “Year unknown”, never guessed. Taste returns counts and attributes, not title items; it still returns its page URL. Search pages default to 40 and cannot exceed 40; other pages default to 20 and cannot exceed 20; `offset:N` cursors follow a deterministic order and may shift if the catalog or member's marks change between calls. Name selectors require exactly one ID or name, accept a year, and return candidates on ambiguity. Catalog search and the member's library are explicitly separate tools. Library totals count marked keys; catalog-deleted keys have no display row and are omitted while the cursor still advances.

### Owner retest parity (2026-10-17)

Name lookup resolves the known retired movie IDs to canonical catalog rows **before pagination**, without collapsing distinct works by name/year. The production `Arrival (2016)` pair was verified to be two works: TMDB `329865` / IMDb `tt2543164` (116-minute science-fiction feature), and TMDB `472349` / IMDb `tt5433758` (22-minute animated short). Name results include `runtime_minutes`; descriptions/instructions explain that namesakes can be distinct works. Smarter-match batches also deduplicate canonical identities before building pages.

`get_library` accepts `sort=match|runtime|added|last|score|title`, matching My library's Last added, Last watched, My score, and Title (ignoring initial articles), plus `waiting` for oldest Wishlist additions first. Missing dates/scores sort last, with stable identity ties. Its default is Best match when GoodWatch taste is available, otherwise Last added for Wishlist/all and Last watched for other statuses. Runtime sorts longest first over the complete filtered library, before pagination. Explicit sorts keep their requested order. `kind=all|movie|show` matches the site's type filter. `added_at` is the stored Wishlist creation date in ISO UTC, or null for non-Wishlist items; it is not a watch/activity date. Supported status/sort/type combinations appear in `/my-library` links. Sorts the selected website status does not support, including mixed Wishlist oldest-first, carry a broader-view note rather than inventing URL behavior.

**Watch next is not the full Wishlist.** `get_tonight` retains its internal name and the site's selection logic but is titled **Watch next**: one next episode from a currently watched show, otherwise a movie/show to start, or a suggestion for an empty Wishlist. Wishlist and Want to See are synonyms in descriptions; requests for the full list route to `get_library(filter=want_to_see)`. The pick links to `/my-movies` or `/my-shows` according to its media type.

Both search modes explicitly default to **everywhere, include seen**, regardless of saved services/filters. This is the requested MCP default, rather than the signed-in website's saved/default On my services and Not seen yet state. Links explicitly set `services=all&unseen=0&foryou=1`. `exclude_seen=true` uses the site's Not seen yet rule (rated titles, all stored watch states and quiz skips), with canonical identity and separate movie/show namespaces, before pagination. Clients should use this filter instead of calling `get_title` per result. Smarter matches default to the website's bounded **For you** ordering; `for_you=false` keeps relevance order. Name lookup retains its indexed name order and reports `for_you_applied=false`.

Search returns up to 40 titles on its first page (the Discover page size), with a cursor for more. There is no four-result cap; the native engine may genuinely find fewer eligible titles, and explicit smaller limits are respected. No unrelated titles or extra paid searches are added to pad pages. See [smarter-match caching and stable filter views](mcp-ranked-search.md).

### Taste, runtime and watch links (owner retest #3, 2026-10-17)

Every returned title (including name choices, My shows, progress and write receipts) carries `match`, `match_label`, and `runtime_minutes`. `match` is the exact 50–99 percentage from the site's `Taste.match`, and the label is the site's “N% taste match”. Null means no GoodWatch match, whether the member lacks five liked fingerprinted titles, the title has no fingerprint, or taste is unavailable; neither the server nor client should invent a replacement. A top-level `taste` names the signal/liked count. Group badges such as “Close to your taste” have separate site rules and are not inferred from the numeric score. Initialization describes the match fields and their null semantics without directing client behavior.

For libraries, `sort=match` uses the site's full-precision taste percentile, highest first (the displayed percentage can tie). It is the default when taste exists, with the previous date default when it does not. Explicit `added`, `waiting`, `last`, `score`, `title` and `runtime` sorts remain exact. Search retains name relevance or the site's bounded For you search rule, on by default. Runtime is the movie duration or the usual episode duration for shows, read from the existing batched display cache. Runtime and title sorts batch all filtered library keys before selecting the requested page, so a longest-title answer covers the whole library. Unknown values sort last. My library lacks match/runtime URL sorts; those links carry the existing broader-order note.

A shared response presentation step reads taste once and display fields in batches of at most 60. It runs **after** search snapshot caching and durable write receipt storage: personalized numbers never enter public display caches, ranked snapshots, or durable receipts. Retries retain their original action state while refreshing presentation; a metadata read failure leaves the committed outcome intact and returns null taste.

Watch next now returns `pick.title.availability`, using the same evidence evaluator as `get_title`, scoped to the member's **Watching from** (`country_default`) and expanded owned service IDs. Eligible offers carry `name`, `url`, `link_kind`, and a filled `stream_url` when a direct provider URL exists. Link preference is evidence's direct URL, then a current country/title/provider/type row from the site's `streaming_availability`. Equivalent provider IDs resolve through the site's duplicate mapping; repeated evidence offers collapse. Offers come in the site's per-country provider popularity order (country order, falling back to the default), with stable ordering for ties and unranked providers. Without a direct URL, `link_kind=where_to_watch` identifies the site's country-specific TMDB fallback, rather than promising playback. Missing/stale/conflicting evidence remains unknown; a catalog URL cannot make an ineligible offer available. No per-result streaming reads were added to search or library.

Personal metadata rehearsal (same guarded loopback services as the other suites):

```bash
python3 scripts/mcp-personal/seed-local.py
python3 scripts/mcp-write/scoped-grants.py
node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/mcp-personal/local.integration.ts
```

The test-only Vite transform selects deterministic populated taste only for fixture members, using the **real** `makeTaste`, quantiles, match and percentile calculations. It cannot affect production builds. The public SDK handler reads real local CrateDB data as the production-style scoped search identity. Checks cover cross-member scores/order, exact sorts, longest titles beyond the first page, usual episode runtime, missing fingerprints/taste, all title-returning tools, owned-service DE/US links, retries, metadata failure after a write, and absence of personal scores from Redis snapshots/durable receipts. Pure link tests cover missing/unsafe URLs, aliases, deduplication and labelled fallback; existing availability tests retain freshness/conflict/selection rules.

Watch dates come only from stored watches. Progress retains earlier passes in its watch records, but counts only the current pass. Null dates say **No date recorded**. Summary dates are explicitly the latest *recorded* date; they are never taken from activity timestamps. Availability uses the existing evidence evaluator, including expired/unknown evidence. Read tools never record a My shows/My movies visit or mutate tracking, scores, Wishlist or settings. Existing data caches, taste rebuilds and public availability-index warmups still operate as in the webapp.

### Poster cards (MCP Apps, 2026-10-17)

`search_titles`, `discover_titles`, `get_similar_titles`, `search_people`, `get_person`, `get_list`, `get_library` and `get_tonight` (Watch next) show optional poster cards in clients that support [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), such as Claude and ChatGPT. Owner decisions Q51 and Q52 chose posters first; OG previews come later. The research and spike are on `research/mcp-images`. Version 2 follows the owner's picks from the [design prototype](mcp-poster-grid/prototype/poster-card-variants.html) (Q54, Q55); version 3 puts the GoodWatch score on the posters and adds people cards (owner follow-up after the v2 retest).

- **Watch next (Q54, variant A):** The pick over its backdrop, with a large poster beside the eyebrow ("Next episode · S3 E7 · name"), title, tagline, facts and taste match, a white **Watch on** button with the provider's logo, and **Open in GoodWatch**. The GoodWatch logo sits top right inside the card and links to `page_url`. Below 520 px the episode name goes and the actions stack.
- **Scores:** Every poster carries the site cards' GoodWatch score tab (`app/ui/ratings/RatingOverlay.tsx`): the G over the floored score, in the score's vibe color. The taste match is no longer under the posters; the banner and Watch next end their facts line with it ("2017 · Show · 74% taste match").
- **People:** `search_people` shows the first person on the backdrop of their top known-for title, with their profile photo, department and up to two known-for titles, then the others as profile cards with their department. `get_person` puts the person in the banner the same way and fills the row with their filmography. Every person card opens the GoodWatch person page.
- **Every other card tool (Q55, variant B):** The first title on its backdrop with its poster and facts, then the rest as large posters in a row that scrolls sideways, ending in a **See it on GoodWatch** tile. Arrows scroll the row on pointer devices; touch devices swipe. The eyebrow says where the titles come from: "Best match on your Wishlist" (sort and filter from the call's arguments), "Top result for “dark”", "Top pick in Discover", "More like Dark", "From Denis Villeneuve’s titles", "On your list “Comfort”". 
- **Data:** The card tools and `get_title` add `poster_url` (TMDB `w185`), `backdrop_url` (`w780`) and `goodwatch_score` (the rounded GoodWatch score) to each title, each null when unknown; a tool's own `goodwatch_score` (Discover's) is kept. Watch next also adds `tagline`. Availability offers carry the provider's `logo_url` (`w92`) when the service list knows it, also in `get_title`. `goodwatch_score` is floored, as the site shows it. People from `search_people` and the person of `get_person` add `profile_url` (`w185`), `known_for` (up to two titles with ready-made links, from the site's people search, cached per person for an hour) and `backdrop_url` (`w780`, the top known-for title's backdrop). Everything comes from the batched display read and the service list that the tools already used. Other tools don't get the card fields, to keep their answers short.
- **Metadata:** The card tools carry `_meta.ui.resourceUri`, the ext-apps legacy key `ui/resourceUri`, and ChatGPT's `openai/outputTemplate`, all `ui://goodwatch/posters-v3.html`. The resource has MIME type `text/html;profile=mcp-app`, `prefersBorder: false`, and a CSP with `resourceDomains` [`https://image.tmdb.org`, the site origin] and no `connectDomains`. Change the URI's version when the widget's data contract changes: hosts may cache by URI, and a member's connector keeps the tool list it read until they reconnect.
- **Same answer everywhere:** A client without MCP Apps ignores the metadata. Text and `structuredContent` are identical with and without UI support; stateless requests carry no negotiated capabilities to branch on.
- **Theming:** As [Claude's theming guide](https://claude.com/docs/connectors/building/mcp-apps/transparent-theming) asks, the page is transparent and declares `color-scheme: light dark`, and the widget sets the root color scheme from the host's theme. A mismatch makes the browser paint an opaque backdrop behind the frame. Text outside the dark media blocks uses the host's style variables (`--color-text-primary` and others) when the host sends them.
- **Widget:** One inline HTML file of about 23 KB (9 KB gzipped), no framework and no ext-apps runtime. `app/server/mcp/poster-grid/` holds the sources: `cards.ts` (validation and view model, tested in Node), `widget.ts` (the postMessage bridge and DOM), `widget.css` and `template.html`; the logo's G comes from `app/ui/brand/GoodWatchWordmark.tsx`. Run `npm run build:mcp-poster-grid` after changing any of them; a unit test fails while `html.generated.ts` is stale. The widget opens every link through the host's `ui/open-link`, reports its height, writes text with `textContent` only, keeps title links on the site origin and images on TMDB's image host, and accepts provider links only as `http(s)` addresses.
- **Font:** Gabarito loads from `/fonts/mcp/gabarito-latin.woff2`, a copy of `app/fonts/gabarito-latin.woff2` at a stable public path. Font files get `Access-Control-Allow-Origin: *`.
- **Checks:** `app/server/mcp/poster-grid.test.ts` covers tool metadata, the resource and its CSP, the card fields, unchanged no-UI output, URL validation and the view model; `watch-links.test.ts` covers the provider logo. [`mcp-poster-grid/`](mcp-poster-grid/README.md) renders the real resource in a minimal host under its CSP, with screenshots at desktop and phone widths and a touch swipe of the row.

### Request log

Every authenticated JSON-RPC message logs one line from `app/server/mcp/rpc-log.ts`, for diagnosing client behavior, such as whether a host asked for the poster resource:

```text
MCP rpc: method=initialize protocol=2025-06-18 client=claude-ai/0.1.0 ui=text/html;profile=mcp-app
MCP rpc: method=tools/call tool=get_tonight protocol=2025-06-18
MCP rpc: method=resources/read uri=ui://goodwatch/posters-v3.html protocol=2025-06-18
```

The line names the method, the tool (from the known tool names, otherwise `other`), the poster resource URI (otherwise `other`), the protocol version, and on `initialize` the client's name and version and whether it advertises MCP Apps (`ui=`). It never logs tokens, arguments, query text, member IDs or results; client names are cut to 40 safe characters. Read it with `docker logs goodwatch-search-a` on vector1, which serves `/mcp`.

## Search filters and discovery (Q53, 2026-10-17)

`search_titles` now accepts the shared Discover filters. `discover_titles` browses without a query, with the same filters, For you defaults, ordering choices and poster grid. `get_discover_filters` lists exact genres and providers for the saved country. See [the tool contract, shared implementation and verification](mcp-discover-tools.md). This supersedes the earlier seven-read-tool count and the statement that search availability is always everywhere: everywhere remains the default and can now be narrowed explicitly.

## Member policy, limits and metrics

`main` removed the old recommendation rollout helpers. The small MCP policy reads `REC_MCP_READ` plus each tool's `REC_MCP_*` flag both when registering/listing tools and immediately before a call. Each accepts `on`, `off`, or a comma-separated member ID allowlist. Unset means enabled for all members; authorization requires the enabled Better Auth service and an active grant.

Tool flags are `REC_MCP_SEARCH_TITLES`, `REC_MCP_TITLE`, `REC_MCP_MY_SHOWS`, `REC_MCP_SHOW_PROGRESS`, `REC_MCP_TONIGHT`, `REC_MCP_LIBRARY` and `REC_MCP_TASTE`. Hidden tools cannot be forced by name. A policy change after registration is also checked in the callback.

The existing Valkey rate limiter counts all authenticated HTTP requests, across OAuth clients, under `mcp-read` and the verified member ID: **60/minute and 1,000/hour**. Denials return HTTP 429 with `Retry-After`. It inherits the webapp's bounded process-memory fallback when Valkey is unavailable; that fallback is per process, not a cluster-wide guarantee.

Prometheus exposes `goodwatch_mcp_tool_calls_total{tool,outcome}` and `goodwatch_mcp_tool_duration_seconds{tool}` through the existing metrics listener. Labels are bounded tool/outcome names, with no member IDs, tokens or query strings. Tool data errors are reported without leaking database errors.

## Local verification

The dedicated rehearsal services are disposable and bind loopback only. These commands neither load `.env` nor use production credentials. Set `DOCKER_HOST` to your local daemon if needed (on this laptop: `unix:///run/user/1000/docker.sock`). Do not point the fixture script at another database: it hardcodes loopback and refuses any cluster name other than `gw-mcp-567`.

```bash
docker run -d --name gw-mcp-567-crate -p 127.0.0.1:15767:4200 \
  -e CRATE_HEAP_SIZE=512m crate:5.10.12 \
  -Cdiscovery.type=single-node -Ccluster.name=gw-mcp-567 -Cnetwork.host=0.0.0.0
docker run -d --name gw-mcp-567-valkey -p 127.0.0.1:16767:6379 valkey/valkey:8.1.3
python goodwatch-webapp/scripts/mcp-read/seed-local.py
cd goodwatch-webapp
node --test app/server/mcp/endpoint.test.ts app/server/page-cache.test.ts app/server/metrics/registry.test.ts
node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-read/local.integration.ts
npm run build
```

Wait for CrateDB's local HTTP endpoint to answer before seeding. The fixture uses repository table schemas with one shard and no replicas, 34 catalog titles and two members. The probe resets only its local member rate counters, and exercises all seven tools through SDK HTTP requests with real CrateDB/Valkey: pagination, canonical URLs, marks, next episodes, current/earlier passes, recorded/unknown dates, Tonight parity, empty-model Taste, member isolation, name ambiguity/year selection, missing titles, strict schemas and shared member rate limits across clients. The endpoint tests additionally cover the modern `2026-07-28` envelope and headers, scope/audience/expiry/identity rejection, origin rejection, policy rechecking and metric exposition.

The probe closes its clients, taste store and snapshot polling. Stop its dedicated containers after verification. Live OAuth, JWKS, populated taste-model calibration, hosted client linking and production deployment are not part of this slice; OAuth is the explicit #566 handoff. No merge or release is authorized by #567's implementation brief.

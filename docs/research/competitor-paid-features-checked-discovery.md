# Checked discovery capabilities against current main

Research/audit date: **2026-10-19**. Source-code snapshot: **[`97eb3179844c4f68a70ccbd997bab4f2a735516d`](https://github.com/alp82/goodwatch-monorepo/commit/97eb3179844c4f68a70ccbd997bab4f2a735516d)**. This dossier assesses the fourteen assigned curated groups and **71 distinct contributing opportunity records**, covering **186 eligible offer IDs**. It does not alter the comparison data, app, issues or campaign. **Have / Partial / Missing are code-backed documentary findings for the exact stated scope.** Deployment is unverified and is not required to assess the source implementation.

All fourteen groups are assessed: **9 Partial, 5 Missing** at the current broad grouping level; record conclusions are **13 Have, 37 Partial, 21 Missing**. Group Partial must not erase the stronger or weaker record/subvariant conclusions below. No generic “Not checked” or “unknown implementation” disposition remains in this assignment.

## Scope, evidence and method

The assignment comes from `/tmp/goodwatch-unchecked-audit-discovery-brief.md`. The local `origin/main` resolved to the pinned SHA. I read the snapshot’s `AGENTS.md`, `CONTEXT.md`, `goodwatch-webapp/AGENTS.md`, `docs/agents/{domain,issue-tracker,triage-labels}.md` and ADRs 0001, 0002, 0008, 0009, 0011 and 0012 before tracing implementation. `CONTEXT-MAP.md` does not exist at this SHA. Code was inspected in a `git archive` extracted under `/tmp/goodwatch-discovery-audit-97eb317`; the working checkout was not switched or modified.

The current view JSON supplies record membership and eligible offer IDs; the opportunities CSV supplies exact vendor free/paid differences and source caveats. The core, landscape, named-expansion and discovery-expansion dossiers supply the underlying primary-source context. Their [older GoodWatch audit](competitor-paid-features-goodwatch.md) is a lead, not proof. Only targeted primary-source reads were added: [Letterboxd ad/tracking wording](https://letterboxd.com/about/pro/), [TVmaze no-tracking wording](https://www.tvmaze.com/premium), [Upflix](https://www.upflix.net/), [Next Episode Premium](https://next-episode.net/premium), [its chart](https://next-episode.net/hot/), [Flickchart VIP](https://www.flickchart.com/vip), [Filmarks feature article JSON](https://filmarks.zendesk.com/api/v2/help_center/ja/articles/360053383653.json) and [price article JSON](https://filmarks.zendesk.com/api/v2/help_center/ja/articles/360052601594.json). Accessed 2026-10-19. The inspected pricing/feature pages expose no publication/update date; Filmarks reports **2024-09-10T08:43:48Z** and **2020-10-08T03:29:28Z** respectively. The human Filmarks feature URL failed in the browser tool, while its official public JSON succeeded. A guessed Next Episode `/Top-Shows/` returned404; the actual chart was followed from Premium. Flickchart FAQ direct HTTP returned403; no new FAQ fact is inferred. Letterboxd specifically removes ad-associated tracking, while TVmaze says no tracking more broadly; the distinction prevents incorrectly treating ordinary analytics alone as a Letterboxd ad-parity gap.

Positive findings follow route → visible/documented control → schema/domain predicate → reader/writer → configuration/tests where relevant. Read-only filters need no data mutation: URL state is the control and the catalog engine is its reader. Negatives combine the closest real route/UI/model/reader/writer and repository searches; they are scoped conclusions, not claims about arbitrary outside services. Test files cited were inspected, not executed. No account, external client, production setting or provider call was exercised.

## Complete feature matrix

| Checked feature | Recommended label | Exact conclusion | Records |
|---|---|---|---|
| [x] `filters` | **Partial** | Combinable discovery and MCP runtime/year controls exist; production-origin, IMDb vote selector and chart-specific controls are missing. | `OP-001`, `OP-002`, `OP-003`, `OP-018`, `OP-019`, `OP-392`, `OP-602` |
| [x] `ai-recs` | **Partial** | Personalized/descriptive discovery and external-assistant tools exist; first-party instant/unlimited AI chat and vendor allowance contracts do not. | `OP-022`, `OP-023`, `OP-027`, `OP-622` |
| [x] `reference` | **Partial** | Continuing cast/crew lookup exists; ages/end-time/Live Activity and Callsheet-style provider lookup do not. | `OP-473`, `OP-479`, `OP-477` |
| [x] `spoilers` | **Missing** | No global/per-show masks for character and episode spoiler fields. | `OP-474` |
| [x] `result-depth` | **Partial** | Popularity pagination, finite trend board and finite paged similarity are separate assessed objects. | `OP-016`, `OP-017` |
| [x] `summaries` | **Missing** | Score-based verdict exists; review-prose synthesis does not. | `OP-024` |
| [x] `language` | **Partial** | Saved English/Japanese title language exists; Romaji, catalog organization/configuration and named ranking modes are distinct gaps. | `OP-345`, `OP-439`, `OP-440`, `OP-572` |
| [x] `ranking-stats` | **Partial** | Current taste/rating analytics exist; Top100 completion, historic title percentiles and pairwise-ranking histories do not. | `OP-223`, `OP-224`, `OP-571` |
| [x] `people-alerts` | **Missing** | People lookup is present; creator/channel follow storage, delivery and favorite-cast capacities are absent. | `OP-143`, `OP-511` |
| [x] `api` | **Partial** | OAuth read/write MCP and multiple grants exist, with concrete bounds; competitor REST contracts and daily allowance ladders are not replicated. | `OP-163`, `OP-164`, `OP-165`, `OP-501`, `OP-654` |
| [x] `widgets` | **Partial** | Native widgets/Shortcuts are absent; updating share-card and MCP Apps are a subset of public embed use. | `OP-167`, `OP-168`, `OP-169`, `OP-170`, `OP-171`, `OP-172`, `OP-476`, `OP-569` |
| [x] `keyboard` | **Missing** | Ordinary numeric rating/keyboard navigation exists; pairwise-ranking keyboard accelerators do not. | `OP-570` |
| [x] `metadata-refresh` | **Missing** | Catalog refresh is automatic/operator controlled; no member-triggered metadata-refresh path. | `OP-494` |
| [x] `ads` | **Partial** | Own browser display pages have no ad slots; tracking, outside video behavior, native/group scopes and promotional controls require distinct dispositions. | `OP-204`, `OP-205`, `OP-206`, `OP-207`, `OP-208`, `OP-209`, `OP-210`, `OP-211`, `OP-347`, `OP-348`, `OP-394`, `OP-406`, `OP-410`, `OP-478`, `OP-481`, `OP-487`, `OP-553`, `OP-565`, `OP-579`, `OP-590`, `OP-596`, `OP-600`, `OP-605`, `OP-607`, `OP-611`, `OP-619`, `OP-623`, `OP-626`, `OP-643` |

## Exact record conclusions

Each source link below is vendor evidence already established in the input dossiers unless explicitly identified as a fresh targeted read above. Source uncertainty stays on the competitor side; it is not a reason to leave GoodWatch code unassessed. Evidence IDs link to pinned GoodWatch code chains, with bounds and inspected negative surfaces. Per-record eligible offers are preserved verbatim in the JSON handoff; contextual offers are never promoted to entitlements.

### Advanced discovery filters (`filters`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-001` **JustWatch** — Runtime range. Paid: Runtime filter [Source1](https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro) | **Have**. Inclusive minimum/maximum runtime via documented MCP discovery and legacy Discover URL; movie duration versus first usual episode length. | Browser Filters sheet lacks a range picker. MCP accepts 0–10000 minutes; unknown runtimes fail bounds; legacy SQL caps candidate rows at100000. Do not claim UI-identical controls. | [F01](#F01) [F02](#F02) |
| `OP-002` **JustWatch** — Production-country filter. Paid: Production origin,not streaming territory [Source1](https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro) | **Missing**. Streaming-country choice and production-country metadata exist. | No selectable production-origin/co-production filter in shared state, UI or MCP predicate; saved streaming country is different. | [F01](#F01) [F03](#F03) |
| `OP-003` **JustWatch** — IMDb vote-count selector. Paid: Vote-count control separate from score [Source1](https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro) | **Missing**. Fixed aggregate vote floor1000 and votes tie-break exist. | No IMDb-specific user vote-count selector or adjustable vote floor. | [F01](#F01) [F03](#F03) |
| `OP-018` **Next Episode** — Chart filters. Paid: Additional chart filters [Source1](https://next-episode.net/premium) | **Partial**. Genre, release, saved-service and personal seen filtering; popular/top-rated ordering. | Next Episode chart controls additionally include lifecycle status, broadcast channel and followed actors/creators/channels; no equivalent predicates. Its premiered-within presets are not identical to GoodWatch release presets. | [F01](#F01) [F03](#F03) [P01](#P01) |
| `OP-019` **Movie Paradise** — Advanced filter set. Paid: Advanced filters; controls not fully enumerated [Source1](https://movieparadise.app/faq) | **Partial**. Several combinable discovery filters plus year/runtime ranges over MCP. | Movie Paradise does not enumerate the complete advanced control set or daily allowance. Inspected GoodWatch controls are concrete; whole-set equivalence cannot be inferred. No saved smart-list/advanced-discovery allowance contract proved. | [F01](#F01) [F02](#F02) [A02](#A02) |
| `OP-392` **StreamGuide (Christian Krueger)** — Genre, rating, year and service filters. Paid: FAQ assigns advanced controls to Premium; enforcement untested. [Source1](https://streamguide.app/faq) [Source2](https://streamguide.app/resources/getting-started-with-streamguide) | **Have**. Combinable genres, minimum rating, release year and streaming-service controls on web/MCP. | Have is scoped to these four control families. GoodWatch uses its aggregate0–100 score, web year presets or explicit MCP year bounds; does not imply identical upstream metric, provider coverage, native UI or all future Premium filters. | [F01](#F01) [F02](#F02) [F03](#F03) |
| `OP-602` **Filmarks** — Multi-condition title search/sorting. Paid: App-only Premium advanced combination/sort; exact controls/caps unspecified. [Source1](https://filmarks.zendesk.com/hc/ja/articles/360053383653) [Source2](https://filmarks.zendesk.com/hc/ja/articles/360052601594) | **Partial**. Multiple discovery conditions and popular/top/newest/match/relevance sorting. | Filmarks primary summary verifies multi-condition search but not a full control/sort enumeration. GoodWatch has no review filtering/sorting path in these title controls; no identical Filmarks native-app sort options are claimed. | [F01](#F01) [F02](#F02) [U01](#U01) |

Fresh chart clarification: Next Episode’s unauthenticated public `/hot/` HTML exposes named selects for popularity/top-rated, premiered-within (all time,2years,1year,6/3/1months,1week), lifecycle status, channel, genre, include/exclude my shows, followed actors/creators/channels, and service availability. Premium labels chart filtering paid, but visible HTML does not prove every control is executable without membership. GoodWatch common genre/service/seen/score sorting is a demonstrated subset; broadcast channels, lifecycle and followed-person predicates are missing. [Chart](https://next-episode.net/hot/), [Premium](https://next-episode.net/premium).

### AI recommendation access & allowances (`ai-recs`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-022` **Likewise / Pix** — Personalized recommendation delivery. Paid: More personalized recommendations; quota unknown [Source1](https://pix-media.com/faq) | **Partial**. Personalized For you discovery, taste ordering and assistant-accessible suggestions. | No equivalent daily-versus-more recommendation delivery schedule/quota or same candidate quality proved; Pix paid count undocumented. External assistants own chat generation. | [A01](#A01) [A02](#A02) |
| `OP-023` **Likewise / Pix** — Instant AI Ask responses. Paid: Instant responses [Source1](https://pix-media.com/faq) | **Partial**. Descriptive query results and external-assistant recommendations. | No first-party Ask conversational endpoint or guaranteed instant priority-response service. MCP20 uncached ranked attempts/day and search backpressure remain. | [A01](#A01) [A02](#A02) |
| `OP-027` **Movie Paradise** — AI recommendation allowance. Paid: AI recommendations; unlimited not established [Source1](https://movieparadise.app/press) | **Partial**. AI-interpreted descriptive search and MCP smarter matches. | No Movie Paradise-specific daily AI-chat/advanced-discovery allowance contract. Its numeric paid allowance is undocumented; GoodWatch MCP20/day is ranked attempts, not chat messages. | [A01](#A01) [A02](#A02) |
| `OP-622` **Watch’n’Roll** — AI chats per day. Paid: Premium explicitly unlimited chats; no monetary price-period inference. [Source1](https://watchnroll.com/) [Source2](https://apps.apple.com/us/app/id6760292218) [Source3](https://play.google.com/store/apps/details?id=com.watchandroll.app) | **Partial**. An external AI app can converse using GoodWatch tools; website offers descriptive search. | No built-in unlimited AI-chat entitlement or rewarded-ad extra chats. MCP20 uncached smarter matches/day is neither five free chats/day nor unlimited paid chat; host quotas are separate. | [A01](#A01) [A02](#A02) |

### Reference search & cast/crew tools (`reference`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-473` **Callsheet** — Lookup access after20 searches. Paid: Subscription ongoing use; one-week trial; not an AI quota. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Have**. Continuing title/person/cast/crew lookup without Callsheet’s cumulative20-search subscription gate. | Have covers reference lookup, not every Callsheet integration/fact/native control. Search burst, catalog eligibility and per-person credit query limits apply; no unlimited-search claim. | [R01](#R01) [A02](#A02) |
| `OP-479` **Callsheet** — Cast/crew age, runtime/end-time and Live Activity. Paid: Tools inside overall20free-search/subscription-access model. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Partial**. Title runtime, release dates/years, season/episode counts and cast/crew filmographies. | No connected current age/age-at-release calculations, runtime end-time calculator or Apple Live Activity. Each is distinct from displayed runtime/career years. | [R01](#R01) [R02](#R02) [W01](#W01) |
| `OP-477` **Callsheet** — Channels and one-time-login Plex/Jellyfin lookup. Paid: Overall access model; not universal playback-history sync. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Missing**. Plex connection exists for a finite history/watchlist import preview. | No Channels/Jellyfin lookup integration or retained one-time Plex-login reference lookup; do not substitute importing for the paid media-info integration. | [R03](#R03) |

### Spoiler hiding & per-show overrides (`spoilers`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-474` **Callsheet** — Spoiler hiding with per-show overrides. Paid: Subscription access: character names,episode counts/titles/thumbnails/summaries, global/show override. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Missing**. Episodes and cast use normal collapsible sections; legacy DNA spoiler code is disabled. | Missing global/per-show override for character names, episode counts/titles/thumbnails/summaries. Tracking and collapsed panels do not implement that policy. | [S01](#S01) |

### More discovery results (`result-depth`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-016` **Criticker** — Trending result count. Paid: Top100 [Source1](https://www.criticker.com/sponsor/) | **Partial**. Paginated popularity browse beyond100; real flagged Hot on socials trending reader. | Current trend publishers emit20 titles despite a reader window40; no100-title trending result path. Popularity pagination is a different object. | [D01](#D01) |
| `OP-017` **Criticker** — Similar-title result completeness. Paid: Full similar-title list [Source1](https://www.criticker.com/sponsor/) | **Partial**. Fingerprint similarity map starts80, pages further in240-title windows up to page6; MCP exposes80 candidates. | No untruncated/full similar-title list contract; quality/catalog exclusions and finite paging differ. Criticker full-list size/algorithm undocumented. | [D02](#D02) |

### Review summaries (`summaries`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-024` **Likewise / Pix** — Review summaries. Paid: Review summaries [Source1](https://pix-media.com/faq) | **Missing**. Templated worth-watching verdict and critic/audience score comparison; synopsis/essence analysis. | No review-text corpus synthesis/review-summary output. Numeric score verdict is a separate assessed subset, not proof of Pix review-summary parity. | [U01](#U01) |

### Title-language & catalog controls (`language`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-345` **SIMKL** — Preferred anime-title display language. Paid: Anime list-title choice: English, Romaji or Japanese; not subtitles/audio/UI language [Source1](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison) [Source2](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro) | **Partial**. Saved title-presentation language includes English/Japanese with translation fallback. | No Romaji choice or anime-specific override. Metadata language does not promise subtitles/audio or UI translation. | [L01](#L01) |
| `OP-439` **Stremio** — Hide, reorder and rename catalogs. Paid: Supporter organize/hide/reorder per live plans; rename in June9 launch. [Source1](https://www.stremio.com/plans) | **Missing**. Title filtering, title hiding and fixed Explorer/Discover layouts exist. | No user catalog hide/reorder/rename settings/writer. Title Not interested is not a catalog section control. | [L02](#L02) |
| `OP-440` **Stremio** — Cinemeta language and recommendation/catalog configuration. Paid: Supporter language/recommendation/catalog configuration; June launch135 catalog choices, personalized/local watched/loved/kids catalogs. [Source1](https://www.stremio.com/plans) | **Partial**. Saved title language and a For you setting; age/content filters. | No Cinemeta/addon/catalog configuration,135 catalog selector or local/watched/loved/kids catalog ecosystem. Age filtering is not configured kids catalogs/profiles. | [L01](#L01) [L02](#L02) [F01](#F01) |
| `OP-572` **Flickchart** — Streamer and vintage modes. Paid: VIP modes; exact controls need verification. [Source1](https://www.flickchart.com/vip) [Source2](https://www.flickchart.com/faq) | **Missing**. Web TV/ordinary display and share-card themes exist. | No pairwise matchup streamer-mode decluttering or whole-site vintage mode. Move streamer mode to ranking/presentation; vintage mode to cosmetic presentation rather than language. | [L02](#L02) [K01](#K01) |

Fresh scope correction: Flickchart’s streamer mode declutters movie matchups for streaming broadcasts; vintage mode is a nostalgic site appearance. Neither is an anime title-language nor a streaming-provider filter. Its live VIP page describes both as current, whereas Rewind and service filtering are explicitly Coming Soon. Keep OP-572 assessed Missing for those named modes, and split/reclassify its presentation dimensions. [VIP](https://www.flickchart.com/vip).

### Ranking & completion analytics (`ranking-stats`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-223` **Criticker** — Top100 completion. Paid: Top100-list completion [Source1](https://www.criticker.com/sponsor/) | **Missing**. Public best-of lists and personal Seen status exist separately. | No personal Top100-list completion percentage/count/join or comparison view. A250-row public list is not top100 completion analytics. | [T01](#T01) |
| `OP-224` **Criticker** — Historical title percentiles. Paid: Percentile charts over time [Source1](https://www.criticker.com/sponsor/) | **Missing**. Current taste percentiles and current aggregate-score comparisons. | No historical title percentile/ranking time-series chart; current percentile is not historical rank data. | [T01](#T01) |
| `OP-571` **Flickchart** — Deeper ranking analytics. Paid: VIP analytics; not personal predicted-score accuracy. [Source1](https://www.flickchart.com/vip) [Source2](https://www.flickchart.com/faq) | **Partial**. Current taste/genre/attribute breakdowns, agreement and personal-versus-aggregate rating gaps. | No head-to-head ranking history analytics or historical pairwise changes; Flickchart full advanced metric list undocumented. Rewind remains Coming Soon, not an additional active requirement. | [T01](#T01) [K01](#K01) |

### Follow creators & their releases (`people-alerts`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-143` **Next Episode** — Follow actors/creators/channels. Paid: Follow people/channels for updates [Source1](https://next-episode.net/premium) | **Missing**. Person filmography filtering and title-based release/availability signals. | No actor/creator/channel follow collection, subscription mutation or updates triggered by followed creator releases. | [P01](#P01) |
| `OP-511` **MDBList / Reeel** — Favorite cast count. Paid: Basic: 35; Standard: 50; Plus: 75; VIP5: 100; VIP10: 200; VIP15: 300; VIP20: 500. Separate object-specific caps; no aggregate conflation. [Source1](https://docs.mdblist.com/docs/supporter) [Source2](https://mdblist.memberful.com/join?splash=1) [Source3](https://docs.mdblist.com/docs/api) | **Missing**. People browsing/search only; title favorites are not cast favorites. | No favorite-cast collection/cap: vendor Free20, Basic35, Standard50, Plus75, VIP5/10/15/20=100/200/300/500 remain unmatched object-specific capacities. | [P01](#P01) |

### Member API & connection allowances (`api`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-163` **TVmaze** — Member read/write API. Paid: User API [Source1](https://www.tvmaze.com/premium) | **Partial**. OAuth MCP supports personal read/write library, ratings, watches and settings. | Exact TVmaze REST user API missing; GoodWatch MCP is a real substitute for overlapping member operations, not the same catalog/schedule/user data contract. | [X01](#X01) [X02](#X02) [X03](#X03) |
| `OP-164` **SIMKL** — Connected-app requests/day. Paid: PRO1000; VIP10000; cached requests excluded [Source1](https://simkl.com/vip/) | **Partial**. Authenticated MCP calls with member-scoped request windows and separate ranked allowance. | SIMKL noncached requests/day500/1000/10000 and API operations are not replicated. GoodWatch60/min1000/hour overall,20 uncached ranked attempts/day; do not compare only20 to10000 or promise an inferred daily maximum. | [X01](#X01) [X02](#X02) |
| `OP-165` **Trakt** — Community app count. Paid: Multi-app; VIP max unknown [Source1](https://forums.trakt.tv/t/an-update-to-community-app-connections/117898) | **Have**. Multiple app/computer grants with listed scopes,last-use and individual disconnect, without a subscription gate. | Not unlimited:128 OAuth consent rows/member,1024 access-token and refresh-token rows each,20 sessions; rows are not distinct-app count. Dynamic registrations30/hour/IP. Trakt VIP upper cap undocumented and legacy free extra-app exceptions remain source caveats. | [X03](#X03) [X01](#X01) |
| `OP-501` **MDBList / Reeel** — API daily requests. Paid: Basic: 10000; Standard: 25000; Plus: 100000; VIP5: 250000; VIP10: 500000; VIP15: 1000000; VIP20: 1500000. Separate object-specific caps; no aggregate conflation. [Source1](https://docs.mdblist.com/docs/supporter) [Source2](https://mdblist.memberful.com/join?splash=1) [Source3](https://docs.mdblist.com/docs/api) | **Partial**. Member MCP read/write interface and rate controls. | No MDBList list/metadata developer API contract or its1k/10k/25k/100k/250k/500k/1m/1.5m daily allowances. Its shared burst windows also differ. GoodWatch MCP request windows/20 ranked attempts are different dimensions. | [X01](#X01) [X02](#X02) |
| `OP-654` **Libib** — REST API access. Paid: Pro account-owner key;1request/2seconds; Ultimate additional scoped keys. [Source1](https://www.libib.com/pricing) [Source2](https://support.libib.com/faqs.html) [Source3](https://support.libib.com/rest-api/introduction.html) | **Partial**. OAuth MCP delegates access to overlapping personal media data. | No Libib owner API-key REST catalog/lending API or Ultimate additional scoped keys. mcp:read/mcp:write scopes are a substitute permission dimension, not Libib collection/key scope;1request/2seconds is a different contract/window. | [X01](#X01) [X02](#X02) [X03](#X03) |

API distinction: **MCP member read/write is Have as a narrower capability**; TVmaze/Libib REST contracts are Missing; the aggregate record stays Partial because a useful member-access substitute exists. SIMKL/MDBList requests/day are different from uncached ranked-search attempts/day. Multiple grants are Have, but **128 consent rows is a storage bound, not a promise of128 unique apps**. A computer-specific grant can consume another row. Preserve Trakt’s July2026 one-community-app announcement, official-app exclusion and legacy exceptions; no current VIP maximum is invented. [X01](#X01) [X02](#X02) [X03](#X03).

### Widgets & device shortcuts (`widgets`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-167` **Hobi** — Home-screen widget. Paid: Widget [Source1](https://hobiapp.com/help/what-hobi-premium-includes) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected Hobi native home-screen widget. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-168` **Sequel** — Advanced countdown/Watch Next widgets. Paid: Advanced widgets [Source1](https://apps.apple.com/us/app/sequel-media-tracker/id1630746993) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected Sequel advanced countdown/Watch Next widgets; free quick-access widget is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-169` **SeriesGuide** — Expanded list widget. Paid: Contents/transparency [Source1](https://www.seriesgui.de/whypay) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected SeriesGuide expanded list widget contents/transparency. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-170` **SeriesGuide** — Home-screen shortcuts. Paid: Show shortcuts [Source1](https://www.seriesgui.de/whypay) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected SeriesGuide per-show home-screen shortcuts. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-171` **FilmNoir; Sofa Time** — Premium widgets. Paid: Advanced widgets [Source1](https://www.filmnoir.app/) [Source2](https://www.reddit.com/r/TVTime/comments/1vgdhzq/sofa_time_full_feature_breakdown_tv_time_import/) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected FilmNoir and Sofa Time premium/advanced widgets; their free widget/Up Next baseline is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-172` **Showly** — Transparent widgets. Paid: Transparent Android widgets [Source1](https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml) [Source2](https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected Showly transparent Android widgets; platform-qualified publisher-source gate retained. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-476` **Callsheet** — Search/media-info Shortcuts. Paid: Part of overall subscription access. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Missing**. Standalone browser icon/web navigation and external MCP tools exist. | No connected Callsheet Apple Shortcuts search/media-info actions, released2026.3. Web manifest, share-card themes and MCP poster views are different platform surfaces. | [W01](#W01) [W02](#W02) |
| `OP-569` **Flickchart** — Embeddable updating widgets. Paid: VIP auto-updating embed widgets. [Source1](https://www.flickchart.com/vip) [Source2](https://www.flickchart.com/faq) | **Partial**. Updating public five-title share-card image/link and MCP Apps rich poster output. | No customizable auto-updating blog/site embed for movie rankings, most-wanted, reviews and yearly favorites; no embed-code/configuration flow. MCP host widget and og:image are separately bounded subsets. | [W02](#W02) |

### Keyboard ranking controls (`keyboard`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-570` **Flickchart** — Keyboard ranking controls. Paid: VIP keyboard controls. [Source1](https://www.flickchart.com/vip) [Source2](https://www.flickchart.com/faq) | **Missing**. Numeric rating buttons and normal keyboard/TV-remote navigation. | No configurable keys for pairwise winner/loser/skip ranking; no connected pairwise-comparison state/writer. | [K01](#K01) |

### Request catalog metadata refresh (`metadata-refresh`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-494` **MyEpisodes** — Trigger metadata refresh. Paid: VIP metadata-refresh trigger, not predicted-rating recalculation. [Source1](https://tv.myepisodes.com/donate/) [Source2](https://www.patreon.com/myepisodes/membership) | **Missing**. Automatic catalog/refetch jobs and detail cache revalidation. | No member-triggered upstream catalog metadata refresh button/request writer; refreshing a page/cache or internal prediction rebuild does not supply it. | [M01](#M01) |

### Ad removal & promotional controls (`ads`)

| Record / competitor / paid requirement | Finding and observed implementation | Remaining scope / limits | Evidence |
|---|---|---|---|
| `OP-204` **JustWatch** — Banner removal. Paid: Remove banners; sponsored recommendations remain [Source1](https://support.justwatch.com/article/just-watchs-terms-of-use) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | JustWatch banner removal (sponsored recommendations explicitly remain there). Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-205` **Letterboxd** — Third-party ads/tracking removal. Paid: Remove third-party ads/tracking; own promotions not expressly covered [Source1](https://letterboxd.com/about/pro/) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Letterboxd third-party ads AND their associated ad tracking removed (not a blanket ban on product analytics). Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD02](#AD02) [AD03](#AD03) |
| `OP-206` **MyAnimeList** — Display-ad removal with exceptions. Paid: Embedded video/advertorials remain [Source1](https://myanimelist.net/membership/faq) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | MyAnimeList display-ad removal excluding embedded-video/advertorial scope. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-207` **MyShows** — Banner removal retaining legal-stream links. Paid: Banners removed; legal-streaming links remain [Source1](https://en.myshows.me/pro/) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | MyShows banner removal while legal streaming links remain. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-208` **SIMKL; Criticker; Serializd; Bingers** — Ad removal. Paid: Ad removal; exact surface coverage untested [Source1](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro) [Source2](https://www.criticker.com/sponsor/) [Source3](https://www.patreon.com/Serializd/membership) [Source4](https://bingers.app/terms) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-209` **TVmaze** — Ad/tracking removal. Paid: No ads/tracking [Source1](https://www.tvmaze.com/premium) | **Partial**. Inspected GoodWatch-owned browser display surfaces have no banner-ad integration. | TVmaze combines ad and tracking removal: GoodWatch still initializes PostHog/Sentry and identity/event capture, and embeds have outside behavior. No exact no-tracking equivalent. Own service promotions are not silently included in third-party removal. | [AD01](#AD01) [AD02](#AD02) [AD03](#AD03) |
| `OP-210` **Moviebase; Movie Paradise; Likewise / Pix; Suite TV** — Ad removal. Paid: Ad removal [Source1](https://moviebase.app/faq) [Source2](https://movieparadise.app/faq) [Source3](https://pix-media.com/faq) [Source4](https://www.suitetv.app/en/about) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-211` **Queue** — iOS ad removal. Paid: No ads; iOS only as of May13 reply [Source1](https://www.reddit.com/r/queueapp/comments/1tavyba/search_suggestions_more/) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Queue+ benefit documented iOS-only as of developer May13 reply; no GoodWatch iOS app/ad-removal path; Android gate unknown. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-347` **Next Episode** — Website ad removal. Paid: Website Premium removes ads; mobile purchase allocation not established [Source1](https://next-episode.net/premium) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Next Episode website display-ad removal; mobile allocation is separate. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-348` **CineTrak** — One-time Premium ad removal. Paid: Regional publisher text attaches ad removal to one-time Premium; latest English text omits matrix. Amount/currency unknown. [Source1](https://www.reddit.com/r/cinetrak/comments/1wfkver/cinetrak_is_back/) [Source2](https://play.google.com/store/apps/details?hl=fil&id=com.cinetrak.mobile) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | CineTrak one-time Premium native ad removal: regional publisher text supports it but latest English text omits the matrix; no GoodWatch Android app path. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-394` **StreamGuide (Christian Krueger)** — Ad removal. Paid: April15/May15 guide explicitly Premium ad-free; current FAQ omits benefit. [Source1](https://streamguide.app/faq) [Source2](https://streamguide.app/resources/getting-started-with-streamguide) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | StreamGuide native Premium ad-free guide versus FAQ omission remains a vendor conflict; no equivalent GoodWatch native app scope. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-406` **Watch Next: AI Streaming Guide (Frulli)** — Remove Ads purchase. Paid: US Apple Remove Ads USD1.99; purchase type/duration unknown. Android mapping not established. [Source1](https://apps.apple.com/us/app/watch-next-ai-streaming-guide/id6450368827) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Frulli Watch Next Remove Ads Apple SKU1.99, duration/type and Android mapping unknown; no GoodWatch Apple-native app scope. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-410` **WatchNext.app** — Ad removal. Paid: Premium and Unlimited ad-free. [Source1](https://watchnext.app/faq) [Source2](https://watchnext.app/terms) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | WatchNext.app Premium/Unlimited broad ad-free promise: GoodWatch embeds retain outside behavior and full-surface equivalence is not established. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-478` **Callsheet** — Ad-free reference experience. Paid: No separate ad-removal upgrade. [Source1](https://callsheetapp.com/) [Source2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Callsheet advertises an ad-free reference app as a whole, not a separate ad-removal purchase; GoodWatch reference pages have outside video/social embed paths and no Apple-native app. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-481` **TV Show & Movie Tracker / TVST (Jonathan ANTOINE)** — Remove ads. Paid: Explicit individual Remove Ads SKU; duration unknown. [Source1](https://apps.apple.com/us/app/id1228141510) [Source2](https://apps.apple.com/fr/app/tv-shows-movies-tracker/id1228141510) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Jonathan ANTOINE TVST Remove Ads native SKU; no GoodWatch native app and vendor SKU period unknown. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-487` **TV Episode Calendar / EpisodeCalendar** — Ad removal. Paid: Premium removes ads. [Source1](https://episodecalendar.com/en/pages/features) [Source2](https://episodecalendar.com/en/pages/premium) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | TV Episode Calendar Premium broad ad removal: app-owned web display subset verified; universal embedded-video behavior not established. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-553` **Bingebase** — Ad removal. Paid: PRO removes ads. [Source1](https://bingebase.com/pro) [Source2](https://bingebase.com/roadmap/shipped) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Bingebase PRO ad removal: app-owned web display subset verified; native/all-ads scope not replicated. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-565` **Flickchart** — Banner-ad removal. Paid: VIP removes banner ads. [Source1](https://www.flickchart.com/vip) [Source2](https://www.flickchart.com/faq) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Flickchart banner-ad removal. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-579` **WerStreamt.es** — Banner/video ad removal. Paid: Pro removes banner/video ads. [Source1](https://www.werstreamt.es/pro/) [Source2](https://www.werstreamt.es/) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | WerStreamt.es Pro banner AND video ad removal: own browser banners absent; no mechanism suppresses vendor video-frame ads. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-590` **Upflix** — Remove ads and tracking. Paid: Site says one-time removal; USApple1.99 SKU duration not printed; separate new Premium subscriptions not assumed identical. [Source1](https://www.upflix.net/) [Source2](https://apps.apple.com/us/app/id562782540) | **Partial**. Inspected GoodWatch-owned browser display surfaces have no banner-ad integration. | Upflix combines ad and tracking removal: GoodWatch still initializes PostHog/Sentry and identity/event capture, and embeds have outside behavior. No exact no-tracking equivalent. Upflix one-time-removal versus new Premium subscription allocation remains unverified; do not merge SKUs. | [AD01](#AD01) [AD02](#AD02) [AD03](#AD03) |
| `OP-596` **AlloCiné** — In-app ad removal. Paid: Premium in-app ad removal. [Source1](https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | AlloCiné Premium IN-APP removal: own GoodWatch web display subset only, no native app parity. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-600` **Filmweb.pl** — Ad removal with native-app conflict. Paid: Filmweb+ marketing includes native app; regulations exclude non-browser apps and sponsored/editorial/own promotion. [Source1](https://www.filmweb.pl/plus) [Source2](https://www.filmweb.pl/plus/regulations) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Filmweb+ marketing includes native app while regulations exclude non-browser apps and sponsored/editorial/own promotion; keep both. GoodWatch-owned browser display subset exists, no native promise. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-605` **Filmarks** — Partial ad removal. Paid: Premium removes some ads, not a blanket no-ads promise. [Source1](https://filmarks.zendesk.com/hc/ja/articles/360053383653) [Source2](https://filmarks.zendesk.com/hc/ja/articles/360052601594) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Filmarks partial ad removal, not all ads everywhere. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-607` **Anime-Planet** — Ad-free website. Paid: Bronze/Silver/Gold ad-free website; no extra licensed video/chapter content. [Source1](https://www.anime-planet.com/about) [Source2](https://www.patreon.com/animeplanet/membership) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Anime-Planet ad-free website browsing, excluding additional licensed playback/content. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-611` **Annict / アニクト** — Ad removal. Paid: Supporter ad removal. [Source1](https://annict.com/supporters) [Source2](https://annict.com/legal) | **Have**. No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages. | Annict supporter removal on ordinary website display surfaces. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim. | [AD01](#AD01) [AD03](#AD03) |
| `OP-619` **Flickz** — Ad-free Watch Together. Paid: Premium ad-free group experience. [Source1](https://flickz.app/) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Flickz Premium ad-free Watch Together: own browser display subset only; no equivalent native/group playback or group-matching ad-control path. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-623` **Watch’n’Roll** — Ad removal. Paid: Premium ad-free. [Source1](https://watchnroll.com/) [Source2](https://apps.apple.com/us/app/id6760292218) [Source3](https://play.google.com/store/apps/details?id=com.watchandroll.app) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Watch’n’Roll Premium ad-free native/group chat experience: web-display subset only; no native or rewarded-ad-to-Premium path. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-626` **Mooveenite** — Ad removal. Paid: Premium removes ads; future exclusive features unspecified. [Source1](https://play.google.com/store/apps/details?id=com.jonumalabs.mooveenite) | **Partial**. No app-owned web banner/ad-slot integration on inspected browser surfaces. | Mooveenite Premium ad-free swipe/group experience: web-display subset only; no equivalent native group/swipe session. External frames/linked providers are outside this code guarantee. | [AD01](#AD01) [AD03](#AD03) [W01](#W01) |
| `OP-643` **iCollect Movies / iCollect Everything** — Promotional notification opt-out. Paid: Pro opt-out documented; not a marketing-consent equivalence claim. [Source1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/) [Source2](https://www.icollecteverything.com/support/) | **Missing**. Settings offer cookies and personalization; no promotional sender was identified in inspected consumer paths. | No explicit persistent promotional-notification opt-out control or sender suppression predicate. This is a missing control, not evidence GoodWatch sends promotions; private visibility is unrelated. | [AD04](#AD04) [AD02](#AD02) |

Ad interpretation: Have rows mean the **app-owned browser display outcome** without a payment gate. They do not assert native-platform parity. Partial rows retain a concrete difference (tracking, video, native or group surface, or broader all-ad scope). OP-208 applies separately to SIMKL, Criticker, Serializd and Bingers; OP-210 separately to Moviebase, Movie Paradise, Likewise/Pix and SuiteTV. OP-171 similarly retains both FilmNoir and SofaTime. The JSON expands those multi-product dispositions; it does not transfer benefits between products. An embedded vendor may show advertising even with a privacy-enhanced embed hostname. OP-643 is Missing for an explicit opt-out **control**, with no identified current promotional sender; do not turn that into a claim that GoodWatch sends marketing notifications.

## Pinned implementation evidence and inspection boundaries

<a id="F01"></a>
### F01 — Connected discovery controls

Discover parses FilterState from the URL, renders the shared FilterBar, and passes that state to filterTitles through getDiscoverResults. The state enumerates services, seen, type/anime, moods/themes/styles, genres, minimum GoodWatch score, taste match, release presets, similar titles, people, age/content and legacy parameters. UI minimum-score choices are 0/60/70/80; match 0/70/80/90. Up to three moods/themes/styles each, URL list parsing takes 20 entries. The sheet has no production-origin or IMDb-vote-count selector. These are read-time URL filters, not saved dynamic list definitions.

Sources: [goodwatch-webapp/app/routes/discover.($type).tsx:155](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/discover.($type).tsx#L155); [goodwatch-webapp/app/ui/discover/DiscoverPage.tsx:423](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/discover/DiscoverPage.tsx#L423); [goodwatch-webapp/app/domain/filter-state.ts:35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L35); [goodwatch-webapp/app/ui/filter-bar/FilterGroups.tsx:196](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/filter-bar/FilterGroups.tsx#L196); [goodwatch-webapp/app/server/discover-results.server.ts:118](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L118); [goodwatch-webapp/app/server/title-filter/passes.server.ts:159](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/passes.server.ts#L159); [goodwatch-webapp/app/domain/filter-state.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.test.ts#L1).

<a id="F02"></a>
### F02 — Runtime and explicit year ranges

MCP discover_titles exposes inclusive min_runtime/max_runtime integer minutes 0–10000, min_year/max_year 1800–2100, validates ascending bounds and maps them to the legacy URL parameters. It calls the same filterTitles reader as Discover. legacyTitles binds >= / <= SQL over movie.runtime or show.episode_runtime[1]; null runtimes do not satisfy either bound. Legacy query LIMIT is 100000. Browser sheet has no runtime range picker, but manually supplied URLs and the documented MCP tool are connected consumer paths. Browser My movies time shortcuts are not an arbitrary minimum/maximum range.

Sources: [goodwatch-webapp/app/server/mcp/tools.server.ts:149](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L149); [goodwatch-webapp/app/server/mcp/tools.server.ts:305](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L305); [goodwatch-webapp/app/server/mcp/data.server.ts:319](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/data.server.ts#L319); [goodwatch-webapp/app/server/mcp/discover-filters.ts:39](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L39); [goodwatch-webapp/app/server/mcp/discover-filters.ts:114](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L114); [goodwatch-webapp/app/server/mcp/discover-filters.ts:146](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L146); [goodwatch-webapp/app/server/mcp/discover.server.ts:40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover.server.ts#L40); [goodwatch-webapp/app/server/title-filter/id-sets.server.ts:132](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L132); [goodwatch-webapp/app/server/title-filter/id-sets.server.ts:181](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L181); [goodwatch-webapp/app/server/title-filter/id-sets.server.ts:23](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L23); [goodwatch-webapp/app/server/mcp/discover-filters.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.test.ts#L1).

<a id="F03"></a>
### F03 — Production origin and vote-count boundary

Title details contain production_country_codes, but FilterState, the Filters sheet, MCP discovery schema and title-filter PassInput contain no selectable production-country predicate. The saved country resolves streaming territory. Discover has a fixed aggregate GoodWatch vote floor of 1000 and vote tie-breaks, not a user-controlled IMDb vote-count minimum. Data presence and a fixed quality floor do not supply the two missing controls.

Sources: [goodwatch-webapp/app/server/title-details-fields.ts:16](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L16); [goodwatch-webapp/app/domain/filter-state.ts:103](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L103); [goodwatch-webapp/app/server/title-filter/order.server.ts:16](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/order.server.ts#L16); [goodwatch-webapp/app/server/title-filter/passes.server.ts:159](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/passes.server.ts#L159); [goodwatch-webapp/app/server/mcp/discover-filters.ts:23](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L23); [goodwatch-webapp/app/routes/settings.country.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.country.tsx#L1).

<a id="A01"></a>
### A01 — Personalized discovery and external-assistant conversation

Discover For you combines taste with the chosen ordering; descriptive search decodes a request into ranked title results. /use-with-ai teaches the member to connect an external AI application. /mcp has read and write tools for discovery, similar titles, tonight, personal library and marks. The site chat panel is an illustrative ChatDemo, not an on-site conversational inference endpoint. External app response generation, subscription and chat allowance belong to that host. These provide recommendation access and an external conversation route, not a first-party unlimited-chat or instant-response guarantee.

Sources: [goodwatch-webapp/app/domain/for-you.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/for-you.ts#L1); [goodwatch-webapp/app/server/discover-results.server.ts:118](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L118); [goodwatch-webapp/app/server/combined-search/reading-retrieval.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/combined-search/reading-retrieval.server.ts#L1); [goodwatch-webapp/app/routes/use-with-ai.tsx:57](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/use-with-ai.tsx#L57); [goodwatch-webapp/app/ui/use-with-ai/ChatDemo.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/use-with-ai/ChatDemo.tsx#L1); [goodwatch-webapp/app/routes/mcp.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/mcp.ts#L1); [goodwatch-webapp/app/server/mcp/tools.server.ts:103](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L103).

<a id="A02"></a>
### A02 — AI/search allowance and configuration

MCP smarter matches enforce 20 uncached admitted attempts per member per UTC day; cached queries and existing pages do not consume that allowance. One smarter match per member may be in flight. This is not a quota on all MCP tools or on external chat messages. Website search has 10 searches/30seconds and 60/10minutes per trusted IP (IPv6 /64); missing trusted header skips that limiter. Search in-flight default is 4 per role. Search readings require a storage key; shared spending budgets are 1e9 nano/day and 5e9 nano/month, and dependencies can cause basic/busy results. Nothing establishes instant or unlimited service.

Sources: [goodwatch-webapp/app/server/mcp/ranked.server.ts:61](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/ranked.server.ts#L61); [goodwatch-webapp/app/server/search-runtime/rate-limit.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/rate-limit.server.ts#L1); [goodwatch-webapp/app/server/search-runtime/limits.server.ts:6](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/limits.server.ts#L6); [goodwatch-webapp/app/server/search-runtime/store.server.ts:12](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/store.server.ts#L12); [goodwatch-webapp/app/server/search-runtime/store.server.ts:138](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/store.server.ts#L138); [goodwatch-webapp/app/server/search-runtime/runtime.server.ts:18](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/runtime.server.ts#L18); [goodwatch-webapp/app/server/mcp/policy.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1); [goodwatch-webapp/app/server/search-runtime/rate-limit.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/rate-limit.test.ts#L1).

<a id="R01"></a>
### R01 — Title and people lookup

/search redirects to Discover search; its people result panel links to a person page. Movie/show pages render cast and crew with links, and person loader reads credits for a filmography with filters. There is no total 20-search paywall in this connected path; burst and service limits still apply. Cast document and Load more are real data reads. Person credits query up to 2000 acting rows and 2000 crew rows, not an unbounded complete external filmography. MCP search_people/get_person add a structured lookup path.

Sources: [goodwatch-webapp/app/routes/search.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/search.tsx#L1); [goodwatch-webapp/app/ui/search/SearchPeople.tsx:59](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/search/SearchPeople.tsx#L59); [goodwatch-webapp/app/ui/details/DetailsContent.tsx:100](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100); [goodwatch-webapp/app/ui/details/Actors.tsx:27](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Actors.tsx#L27); [goodwatch-webapp/app/ui/details/Crew.tsx:17](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Crew.tsx#L17); [goodwatch-webapp/app/routes/person.$personKey.tsx:75](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L75); [goodwatch-webapp/app/server/person.server.ts:222](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L222); [goodwatch-webapp/app/server/mcp/tools.server.ts:253](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L253).

<a id="R02"></a>
### R02 — Reference facts versus native timers and ages

Title details read runtime, release year/date, seasons and episodes; the title questions include ordinary episode length and score-based answers. Person data reader selects name, profile and department; page shows career/credit facts. No person birthday/current-age/age-at-release calculation, end-time calculator or native Live Activity registration is connected. Native-runtime inspection is recorded in W01. Runtime and a career-year range must not be called age-at-release or a timer.

Sources: [goodwatch-webapp/app/server/title-details-fields.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L1); [goodwatch-webapp/app/ui/details/titleQuestions.ts:198](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/titleQuestions.ts#L198); [goodwatch-webapp/app/server/person.server.ts:545](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L545); [goodwatch-webapp/app/routes/person.$personKey.tsx:391](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L391); [goodwatch-webapp/app/ui/details/Runtime.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Runtime.tsx#L1).

<a id="R03"></a>
### R03 — Plex import is not Callsheet provider lookup

/api/imports/plex/:step and the import settings flow implement Plex authorization and read server/watchlist/history data into an import preview. Completion discards credentials for a completed flow. This is material existing integration, but not one-time provider login retained for querying Channels/Plex/Jellyfin media facts or opening corresponding library items. No Channels/Jellyfin live-lookup route or title action was found in routes, import connectors, details UI or MCP tools.

Sources: [goodwatch-webapp/app/routes/api.imports.plex.$step.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.plex.$step.ts#L1); [goodwatch-webapp/app/server/imports/plex-connect.server.ts:62](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-connect.server.ts#L62); [goodwatch-webapp/app/server/imports/plex-connect.server.ts:145](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-connect.server.ts#L145); [goodwatch-webapp/app/server/imports/plex-client.server.ts:163](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-client.server.ts#L163); [goodwatch-webapp/app/ui/details/DetailsContent.tsx:100](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100); [goodwatch-webapp/app/server/mcp/tools.server.ts:175](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L175).

<a id="S01"></a>
### S01 — Spoiler settings boundary

Cast cards render characters when supplied; opened season rows render episode names, and episode tips render names/scores. Season/episode counts come from the details reader. Generic collapsed sections require a click but have no global spoiler preference or per-show override. The user settings schema has no spoiler fields and the tracking state stores viewing status, not spoiler masks. An older DNA component contains spoiler UI code but hard-codes isSpoiler=false; it cannot establish a working hide feature. No connected preference masks character names, counts, episode titles, thumbnails or summaries in Callsheet’s combination.

Sources: [goodwatch-webapp/app/ui/details/Actors.tsx:138](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Actors.tsx#L138); [goodwatch-webapp/app/ui/details/episode-grid/SeasonDetails.tsx:45](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/episode-grid/SeasonDetails.tsx#L45); [goodwatch-webapp/app/ui/details/episode-grid/shared.tsx:201](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/episode-grid/shared.tsx#L201); [goodwatch-webapp/app/server/title-details-fields.ts:32](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L32); [goodwatch-webapp/app/routes/api.user-settings.get.tsx:11](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11); [goodwatch-webapp/app/types/user-data.ts:28](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28); [goodwatch-webapp/app/ui/dna/DNACategory.tsx:53](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/dna/DNACategory.tsx#L53); [goodwatch-webapp/app/ui/details/DetailsContent.tsx:69](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L69).

<a id="D01"></a>
### D01 — Trending objects and depth

Discover permits 40 titles/page and page numbers up to 250, but Popular is TMDB popularity, not the Criticker trending chart. Hot on socials is a separate real trend reader: route -> getHotOnSocials -> published buzz snapshot -> ranked title blocks. Page reader asks for up to 40 board titles, but current primary and backup publishers put only the top 20 in top20. Thus ordinary popularity browsing beyond 100 is Have, while top-100 trending is not supplied by this path. The social route is flag-gated and flags default off. Its social post LIMIT 400 is posts, not 400 trending titles.

Sources: [goodwatch-webapp/app/server/discover-results.server.ts:35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L35); [goodwatch-webapp/app/server/discover-results.server.ts:268](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L268); [goodwatch-webapp/app/server/title-filter/order.server.ts:19](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/order.server.ts#L19); [goodwatch-webapp/app/routes/hot-on-socials.tsx:30](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/hot-on-socials.tsx#L30); [goodwatch-webapp/app/server/talked-about-now/start-row.server.ts:218](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/talked-about-now/start-row.server.ts#L218); [goodwatch-webapp/app/domain/talked-about-now.ts:114](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/talked-about-now.ts#L114); [goodwatch-flows/windmill/f/buzz/daily.py:129](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/buzz/daily.py#L129); [goodwatch-flows/windmill/f/buzz/backup.py:98](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/buzz/backup.py#L98); [goodwatch-webapp/app/server/talked-about-now/flags.server.ts:27](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/talked-about-now/flags.server.ts#L27).

<a id="D02"></a>
### D02 — Similarity objects and paging

Title page uses a fingerprint-neighborhood map when enabled, otherwise its related-title carousel. The map’s initial plain neighborhood is 80; filter page 0 is 80, pages 1–6 are 240 each (upper request window 1520 positions per filter, before dedupe/exclusions). rings.ts requests more pages and /api/related-map dispatches to relatedMapPage. Eligibility includes >=10000 aggregate votes, >=60 GoodWatch score and release year not in future. MCP get_similar_titles intentionally uses only up to 80 neighbors, 40 max per call. No branch means “return every similar title in the catalog”; Criticker’s full list algorithm/size is not known. The old /api/similar-media endpoint is a separate selector search, not proof of full similarity depth.

Sources: [goodwatch-webapp/app/ui/details/DetailsContent.tsx:114](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L114); [goodwatch-webapp/app/server/related-map-pack.ts:28](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.ts#L28); [goodwatch-webapp/app/server/related-map-pack.ts:80](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.ts#L80); [goodwatch-webapp/app/server/related-map.server.ts:66](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map.server.ts#L66); [goodwatch-webapp/app/server/related-map.server.ts:201](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map.server.ts#L201); [goodwatch-webapp/app/ui/related-map/rings.ts:340](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/related-map/rings.ts#L340); [goodwatch-webapp/app/routes/api.related-map.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.related-map.ts#L1); [goodwatch-webapp/app/server/mcp/similar-titles.server.ts:16](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/similar-titles.server.ts#L16); [goodwatch-webapp/app/server/mcp/schemas.ts:72](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/schemas.ts#L72); [goodwatch-webapp/app/server/related-map-pack.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.test.ts#L1).

<a id="U01"></a>
### U01 — Review prose synthesis versus score verdict

Details About renders synopsis/tagline and essence tags; titleQuestions.worthAnswer produces a templated verdict from numerical scores, including critic/audience disagreement. Per-title AI analysis generates fingerprint/essence from original title, release year, type and overview. It does not ingest a review corpus or produce an attributed review-summary field. Read details field selection, DetailsContent, titleQuestions, analysis prompt and input construction, MCP get_title representation and searched review/summarization writers. The numerical verdict is useful, but it is not Pix review-text synthesis.

Sources: [goodwatch-webapp/app/ui/details/About.tsx:15](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/About.tsx#L15); [goodwatch-webapp/app/ui/details/titleQuestions.ts:110](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/titleQuestions.ts#L110); [goodwatch-webapp/app/server/title-details-fields.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L1); [goodwatch-flows/windmill/f/dna/generate/fetch.py:27](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L27); [goodwatch-flows/windmill/f/dna/generate/fetch.py:163](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L163); [goodwatch-flows/windmill/f/dna/generate/fetch.py:547](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L547); [goodwatch-webapp/app/server/mcp/title-details.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/title-details.ts#L1).

<a id="L01"></a>
### L01 — Persisted title presentation languages

Settings /settings/language offers browser default plus 14 supported locales, including English and Japanese. SettingsPair pickLanguage/keep invokes the shared preference machine; save-adapter posts /api/user-settings/set, whose saveMediaPreferences writer persists the atomic country/language pair and media-preferences-store reads/writes user_setting (or a guest cookie). media-payload and media-overlay present translated title/poster/overview/tagline when available. Menus remain English; no Romaji locale/preference or anime-specific display override is defined. Locale choice does not filter original/spoken language or audio/subtitles and does not configure Cinemeta.

Sources: [goodwatch-webapp/app/routes/settings.language.tsx:16](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.language.tsx#L16); [goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx:121](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx#L121); [goodwatch-webapp/app/utils/media-language.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-language.ts#L1); [goodwatch-webapp/app/ui/media-preference/save-adapter.ts:57](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/save-adapter.ts#L57); [goodwatch-webapp/app/routes/api.user-settings.set.tsx:80](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.set.tsx#L80); [goodwatch-webapp/app/server/media-context.server.ts:139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-context.server.ts#L139); [goodwatch-webapp/app/server/media-preferences-store.server.ts:45](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-preferences-store.server.ts#L45); [goodwatch-webapp/app/server/media-payload.server.ts:58](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-payload.server.ts#L58); [goodwatch-webapp/app/server/media-overlay.server.ts:13](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-overlay.server.ts#L13); [goodwatch-webapp/app/utils/media-language.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-language.test.ts#L1).

<a id="L02"></a>
### L02 — Catalog organization and presentation modes

Discover has fixed filter/sort controls, Explorer an island combination model, and Settings a For you preference. No reader/writer for a user’s catalog section order, catalog rename/hide, Cinemeta/addon catalog configuration or streamer/vintage ranking mode was found across these routes, settings schema and UI. Title hiding is a title interest decision, not catalog hiding. Global browser fullscreen/TV remote and share-card themes do not create a clean pairwise-streamer view or nostalgic whole-site mode.

Sources: [goodwatch-webapp/app/domain/filter-state.ts:35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L35); [goodwatch-webapp/app/routes/explorer.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/explorer.tsx#L1); [goodwatch-webapp/app/routes/settings.discover-privacy.tsx:19](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L19); [goodwatch-webapp/app/routes/api.user-settings.get.tsx:11](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11); [goodwatch-webapp/app/ui/settings/paths.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/paths.ts#L1); [goodwatch-webapp/app/ui/share-card/model.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L1).

<a id="T01"></a>
### T01 — Current taste comparisons, no historical ranking/completion series

/taste/everyone reads the current portrait’s Everyone view and shows comparisons to GoodWatch’s aggregate score. everyone.server computes current agreement/offset and higher/lower title and attribute/genre gaps. My library scores sort/group personal numeric ratings; they are not head-to-head match records. /movies/best and /shows/best render a sitemap ranking, 250 per page, with no member join or top100-completion calculation. These readers do not store historic title ranking percentiles or expose a completion metric across ranked top100 lists. A taste percentile at the current moment is not a historical rank chart.

Sources: [goodwatch-webapp/app/routes/taste.everyone.tsx:28](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/taste.everyone.tsx#L28); [goodwatch-webapp/app/server/taste-portrait/everyone.server.ts:24](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/everyone.server.ts#L24); [goodwatch-webapp/app/server/taste-portrait/everyone.server.ts:73](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/everyone.server.ts#L73); [goodwatch-webapp/app/domain/my-scores.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-scores.ts#L1); [goodwatch-webapp/app/server/my-scores.server.ts:25](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-scores.server.ts#L25); [goodwatch-webapp/app/routes/$type.best.tsx:29](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/$type.best.tsx#L29); [goodwatch-webapp/app/ui/best-lists/RankedTitles.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/best-lists/RankedTitles.tsx#L1); [goodwatch-webapp/app/server/taste-portrait/person.server.ts:79](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/person.server.ts#L79).

<a id="P01"></a>
### P01 — People browsing versus following and delivery

Person pages load filmographies, trait signatures and credit filters; they offer no Follow/Favorite creator mutation. userData reads user_favorite as media title keys and all member data is title-based; there is no person/channel-follow reader/writer here. New episodes and newly available signals are computed for tracked/wishlisted titles, not followed people. Inspected person/search/details UI, routes, member model, settings, MCP tools/write registry and flows for person-follow/channel subscription and creator release delivery. Neither a favorite-cast collection with a count nor creator updates are connected.

Sources: [goodwatch-webapp/app/routes/person.$personKey.tsx:180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L180); [goodwatch-webapp/app/server/person.server.ts:637](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L637); [goodwatch-webapp/app/types/user-data.ts:28](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28); [goodwatch-webapp/app/server/userData.server.ts:102](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L102); [goodwatch-webapp/app/server/mcp/write-names.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1); [goodwatch-webapp/app/server/new-episodes.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/new-episodes.server.ts#L1); [goodwatch-webapp/app/server/newly-available.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/newly-available.server.ts#L1).

<a id="X01"></a>
### X01 — Authenticated member API contract

/mcp dispatches a stateless authenticated JSON-RPC MCP server. Endpoint requires bearer token mcp:read, configured MCP_RESOURCE_URL, member subject and mcp:write for writes. Read tools return discovery, titles, people, personal library, progress, lists and settings; write registry includes ratings, watches, interest/state, service/settings and five-title share lists. Those use site domain writers and read-back receipts. It is a genuine member read/write integration but not TVmaze’s REST user contract, Libib’s owner-key/Ultimate scoped-key REST catalog/circulation contract, SIMKL’s API or MDBList list/metadata API. Browser /api routes use site sessions and do not establish a supported general developer REST key service.

Sources: [goodwatch-webapp/app/routes/mcp.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/mcp.ts#L1); [goodwatch-webapp/app/server/mcp/endpoint.server.ts:60](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L60); [goodwatch-webapp/app/server/mcp/endpoint.server.ts:128](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L128); [goodwatch-webapp/app/server/mcp/tools.server.ts:103](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L103); [goodwatch-webapp/app/server/mcp/write-names.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1); [goodwatch-webapp/app/server/mcp/title-write.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/title-write.server.ts#L1); [goodwatch-webapp/app/server/mcp/batch.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L1); [goodwatch-webapp/app/server/mcp/endpoint.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.test.ts#L1).

<a id="X02"></a>
### X02 — Request and write dimensions

MCP endpoint request limiter counts 60 requests/60seconds and 1000/3600seconds per member; it is named mcp-read but runs for both read and write requests. Separate title-write item windows are 300/minute and 2000/hour, with 50 items/batch; heavy grouped writes can cost 5 items (write-names). MCP smarter matching’s distinct 20 uncached attempts/day does not cap API access as a whole. Discovery/search max 40 results/call, general paging max20 by schema. These windows do not replicate SIMKL 500/1000/10000 noncached requests/day or MDBList 1k–1.5m/day plus their object contract/bursts. No conversion from per-hour windows to a promised daily allowance is warranted.

Sources: [goodwatch-webapp/app/server/mcp/endpoint.server.ts:33](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L33); [goodwatch-webapp/app/server/mcp/endpoint.server.ts:143](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L143); [goodwatch-webapp/app/server/mcp/batch.server.ts:21](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21); [goodwatch-webapp/app/server/mcp/write-names.ts:46](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L46); [goodwatch-webapp/app/server/mcp/schemas.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/schemas.ts#L1); [goodwatch-webapp/app/server/mcp/tools.server.ts:149](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L149); [goodwatch-webapp/app/server/mcp/ranked.server.ts:61](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/ranked.server.ts#L61); [goodwatch-webapp/app/server/mcp/batch.test.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.test.ts#L1).

<a id="X03"></a>
### X03 — Multiple grants and actual auth population bounds

Connected apps lists one row per OAuth consent grant (Claude Code can have one per computer), shows read/write access and last use, and disconnects an owned grant. Auth plugin scopes and adapter support multiple clients/grants. This is multi-app support without a consumer payment gate. It is NOT unlimited: authActorBounds is 128 rows per member for oauthConsent, 1024 each for access/refresh token rows, 20 member sessions; createGoodwatchAuth enables populationBounds:true and crate adapter calls admitAuthRow. Grants are not guaranteed unique apps (multiple computers/consents can consume rows). Dynamic registration has an independent 30/hour/IP limiter. Better Auth must be enabled; connected-apps route is 404 when off.

Sources: [goodwatch-webapp/app/routes/settings.connected-apps.tsx:17](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.connected-apps.tsx#L17); [goodwatch-webapp/app/routes/settings.connected-apps.tsx:69](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.connected-apps.tsx#L69); [goodwatch-webapp/app/server/auth/connected-apps.server.ts:30](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/connected-apps.server.ts#L30); [goodwatch-webapp/app/server/auth/auth.server.ts:96](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L96); [goodwatch-webapp/app/server/auth/auth.server.ts:349](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L349); [goodwatch-webapp/app/server/auth/population.server.ts:21](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.server.ts#L21); [goodwatch-webapp/app/server/auth/population.server.ts:48](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.server.ts#L48); [goodwatch-webapp/app/server/auth/crate-adapter.server.ts:340](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/crate-adapter.server.ts#L340); [goodwatch-webapp/app/server/auth/boot.server.ts:19](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/boot.server.ts#L19); [goodwatch-webapp/app/server/auth/population.integration.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.integration.ts#L1).

<a id="W01"></a>
### W01 — Native platform surfaces

Repository package/dependency and platform-file inventory contains a Remix browser app, standalone web manifest/icons and web/MCP components. No WidgetKit/Swift/ActivityKit/AppIntents target, Android AppWidgetProvider/shortcut target, Capacitor/React Native package or OS widget configuration/receiver was found. site.webmanifest has no shortcuts or related native-app declaration. Installing a web icon and web TV remote keyboard navigation are different from Hobi/Sequel/SeriesGuide/FilmNoir/SofaTime/Showly device widgets, SeriesGuide show shortcuts, Callsheet Shortcuts media-info actions or Live Activities.

Sources: [goodwatch-webapp/package.json:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/package.json#L1); [goodwatch-webapp/public/site.webmanifest:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/public/site.webmanifest#L1); [goodwatch-webapp/app/ui/living-room/Remote.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/living-room/Remote.tsx#L1); [goodwatch-webapp/app/routes/use-with-ai.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/use-with-ai.tsx#L1).

<a id="W02"></a>
### W02 — Public share cards and MCP Apps are not blog widgets

Public /u/:handle/lists/:id shows a five-title share list and supplies its current share-card image as og:image. Share-list edits warm the card. This is an updating public image/link subset, not an offered customizable embed for rankings/watchlist/reviews/year-best with an embed-code builder. MCP Apps poster resource ui://goodwatch/posters-v3.html renders tool results in a supporting authenticated host; its CSP has no connectDomains, so it is not an independently refreshing public blog widget. No embed route or widget preferences/writer for that consumer website use was found. Treat this record Partial, native widget/Shortcuts records Missing.

Sources: [goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L1); [goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx:84](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L84); [goodwatch-webapp/app/routes/u.$handle_.lists.$id_.edit.tsx:90](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle_.lists.$id_.edit.tsx#L90); [goodwatch-webapp/app/server/mcp/poster-grid.server.ts:6](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/poster-grid.server.ts#L6); [goodwatch-webapp/app/server/mcp/poster-grid.server.ts:30](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/poster-grid.server.ts#L30); [goodwatch-webapp/app/server/share-lists/store.server.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L1).

<a id="K01"></a>
### K01 — Rating buttons versus pairwise keyboard ranking

My library scores shows numeric score keys/buttons; the score domain sorts numeric ratings and updates them. ScoreControl renders ordinary button choices. TV has registered remote controls and ordinary dialogs/menus have navigation handlers. Route/UI/domain/writer inventory contains no pairwise movie-ranking matchup state, comparison-result writer or configurable keyboard shortcuts for choosing winner/loser/skip in matchups. The visual word keys in My scores are not Flickchart ranking accelerators.

Sources: [goodwatch-webapp/app/routes/my-library.scores.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-library.scores.tsx#L1); [goodwatch-webapp/app/ui/my-library/scores/ScoreRow.tsx:50](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/scores/ScoreRow.tsx#L50); [goodwatch-webapp/app/ui/title-actions/ScoreControl.tsx:53](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/title-actions/ScoreControl.tsx#L53); [goodwatch-webapp/app/ui/scoring/ScoreChoices.tsx:21](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/scoring/ScoreChoices.tsx#L21); [goodwatch-webapp/app/domain/my-scores.ts:31](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-scores.ts#L31); [goodwatch-webapp/app/routes/api.update-scores-batch.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-scores-batch.ts#L1); [goodwatch-webapp/app/ui/living-room/Remote.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/living-room/Remote.tsx#L1).

<a id="M01"></a>
### M01 — Automatic catalog refresh versus member trigger

Title loader reads cached catalog details. Cache is fresh 12h plus at most 12h stale; a read/cache retry is not a request to re-fetch metadata from the upstream provider. Flow TMDB refetch cycle is 30days and DNA staleness 180days. Inspected movie/show routes, Details/Questions, search/MCP tool schemas and write registry, cache-reset routes and flow entrypoints: no member-facing force/request-catalog-refresh action or member-scoped job request writer. Operator refresh/cache jobs and personal-order rebuilds are different. Result is Missing for MyEpisodes user trigger, not a claim that catalog data never updates.

Sources: [goodwatch-webapp/app/routes/movie.$movieKey.tsx:134](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/movie.$movieKey.tsx#L134); [goodwatch-webapp/app/routes/show.$showKey.tsx:183](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/show.$showKey.tsx#L183); [goodwatch-webapp/app/server/title-details-cache.ts:13](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-cache.ts#L13); [goodwatch-webapp/app/ui/details/DetailsContent.tsx:43](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L43); [goodwatch-webapp/app/server/mcp/write-names.ts:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1); [goodwatch-flows/windmill/f/tmdb_api/refetch_cycle.py:17](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/tmdb_api/refetch_cycle.py#L17); [goodwatch-flows/windmill/f/dna/models.py:20](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/models.py#L20); [goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py#L1).

<a id="AD01"></a>
### AD01 — No app-owned display-ad path in inspected browser surfaces

Inspected production root, Discover/title/person/library/settings/share-list/social UI, package dependencies, public files and configuration for ad networks, banner/advertorial slots, sponsored ranking labels, rewarded ads and paid ad-removal gates. Root renders the site shell plus telemetry; title content is catalog/ratings/streaming/reference sections. No first-party banner or ad-network slot integration was found on these connected paths. Thus Have is justified for the scoped equivalent: app-owned web display surfaces without banner ads. This is not a universal assurance about every deployment, native app, linked provider, video embed or social editorial item. No ad-removal purchase is needed on inspected routes.

Sources: [goodwatch-webapp/app/root.tsx:356](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L356); [goodwatch-webapp/app/ui/details/DetailsContent.tsx:73](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L73); [goodwatch-webapp/app/ui/discover/DiscoverPage.tsx:423](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/discover/DiscoverPage.tsx#L423); [goodwatch-webapp/app/routes/person.$personKey.tsx:180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L180); [goodwatch-webapp/package.json:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/package.json#L1).

<a id="AD02"></a>
### AD02 — Analytics and privacy do not establish no tracking

Root mounts TelemetryBoot; after interactivity loadTools imports PostHog and Sentry on non-localhost. PostHog init uses a.goodwatch.app, pageleave capture, localStorage+cookie persistence and session-recording configuration; TelemetryBoot identifies members and captures events. Cookie choice is stored via localStorage and user_setting and is offered in Settings, but inspected telemetry initialization does not read cookie_consent to suppress loading/capture. Therefore TVmaze/Upflix-style broad no-tracking removal is Missing as an exact dimension; those combined records are Partial. Letterboxd instead removes third-party ads and ASSOCIATED ad tracking: ordinary product analytics does not by itself violate that narrower benefit, so OP-205 is Have for the inspected app-owned display/ad-network scope. This is a code comparison, not a legal/privacy compliance assessment or proof which telemetry reaches live services.

Sources: [goodwatch-webapp/app/root.tsx:378](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L378); [goodwatch-webapp/app/telemetry/TelemetryBoot.tsx:42](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/TelemetryBoot.tsx#L42); [goodwatch-webapp/app/telemetry/telemetry.ts:68](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/telemetry.ts#L68); [goodwatch-webapp/app/telemetry/posthog-browser.ts:97](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/posthog-browser.ts#L97); [goodwatch-webapp/app/telemetry/sentry-browser.ts:62](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/sentry-browser.ts#L62); [goodwatch-webapp/app/ui/CookieConsent.tsx:7](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/CookieConsent.tsx#L7); [goodwatch-webapp/app/routes/settings.discover-privacy.tsx:50](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L50).

<a id="AD03"></a>
### AD03 — Embeds and streaming links retain outside behavior

Trailer click lazy-loads a YouTube frame using youtube-nocookie.com/embed with autoplay and origin referrer. Social click mounts official YouTube/Bluesky/Mastodon iframes. These paths do not implement ad blocking or a no-tracking promise inside the vendors’ frames. Banner-only benefits and benefits explicitly exempting embedded video can match a narrower app-owned-web scope; benefits claiming all video ads/no tracking cannot be marked Have universally. Streaming offer type ads is a label in where-to-watch links; it neither inserts an ad in GoodWatch nor proves ad-free browsing.

Sources: [goodwatch-webapp/app/ui/details/hero/Trailer.tsx:73](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/hero/Trailer.tsx#L73); [goodwatch-webapp/app/ui/details/YoutubePlayer.tsx:1](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/YoutubePlayer.tsx#L1); [goodwatch-webapp/app/ui/social-embed/YouTubeFrame.tsx:18](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/YouTubeFrame.tsx#L18); [goodwatch-webapp/app/ui/social-embed/players.tsx:72](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/players.tsx#L72); [goodwatch-webapp/app/ui/social-embed/SocialEmbed.tsx:142](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/SocialEmbed.tsx#L142); [goodwatch-webapp/app/utils/streaming-links.ts:177](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/streaming-links.ts#L177).

<a id="AD04"></a>
### AD04 — Promotion preference boundary

Settings Discover/privacy offers For you and Cookies. UserSettingsSchema has no promotional-push/email opt-out setting; member settings writer validates only the allowed schema. Read notification/email code and flow inventory: auth delivery is present but no consumer promotional-push sender/preference path was identified. Therefore iCollect’s explicit Pro promotional-notification opt-out control is Missing; there is no evidence that GoodWatch is currently sending such promotions or that it needs a fake opt-out to get the no-promotion outcome. Cookie choice, personalization and private list visibility are separate controls.

Sources: [goodwatch-webapp/app/routes/settings.discover-privacy.tsx:19](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L19); [goodwatch-webapp/app/routes/api.user-settings.get.tsx:11](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11); [goodwatch-webapp/app/server/user-settings.server.ts:102](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/user-settings.server.ts#L102); [goodwatch-webapp/app/server/auth/auth.server.ts:305](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L305); [goodwatch-webapp/app/server/auth/mail.server.ts:47](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/mail.server.ts#L47).

## Reproducible negative-inspection ledger

These searches were performed against the isolated pinned tree, followed by reading the closest connected paths above. A zero-match search alone was not treated as proof. Prototype/retired code and static generated widget HTML were distinguished from mounted consumer routes.

| Exact scope | Search surfaces and terms | Connected counterexample/boundary checked |
|---|---|---|
| Production/vote/chart filters | `app/domain/filter-state.ts`, `ui/filter-bar`, `server/title-filter`, `server/mcp/discover-filters.ts`; `production_countr`, `vote_count`, `imdb_votes`, `minRuntime`, status/channel keys | Saved country, fixed aggregate vote floor, runtime SQL and actual FilterBar enumerations: F01–F03. |
| Chat/review synthesis | `app/routes`, `server/combined-search`, `server/mcp`, `ui/use-with-ai`, `ui/details`, `goodwatch-flows/windmill/f/dna`; `chat`, `review.?summar`, `summari[sz]`, `synopsis`, `essence` | External host connection, static chat demo, descriptive ranker and score-based verdict; actual title-analysis prompt input: A01/A02/U01. |
| Spoiler/age/timer/provider reference | Settings schema, details/cast/episode UI, person SQL, tracking model, MCP, import connectors; `spoiler`, `birthday`, `age_at`, `end.time`, `live.?activ`, `Channels`, `Jellyfin`, `Plex` | Rendered characters/episode names, disabled legacy spoiler branch, runtime facts, real Plex import: R01–R03/S01. |
| Ranking/creator follows | Taste portrait, scores, best-list routes/readers, person UI/domain, userData/model, MCP writes, webapp/flows/Crate schemas; `percentile`, `history`, `completion`, `follow_person`, `favorite_cast`, `creator.*alert`, `person.*notif` | Current aggregate-score analytics and title-owned favorites/signals: T01/P01; no historical rank/completion or people-follow consumer chain. |
| Native widgets/shortcuts/keyboard | Repository file inventory, package manifest, public webmanifest, routes/UI; `WidgetKit`, `AppIntents`, `ActivityKit`, `AppWidgetProvider`, native manifest/Swift/Kotlin targets, `shortcut`, `widget`, `keydown`, `pairwise`, `winner`, `ranking` | Web standalone icon, web/TV key navigation, numeric score writer, updating share image and authenticated MCP widget: W01/W02/K01. |
| Metadata-refresh requests | Movie/show/details routes/UI, API route inventory, MCP registry, title caches, flow scripts; `refresh`, `force`, `trigger`, `enqueue`, `Windmill`, `last_updated`, `dna_created_at` | Read-through cache, automatic30day TMDB cycle/180day DNA policy and operator job: M01; no consumer trigger connected. |
| Advertising/tracking/promotion | Root/entry, production UI/routes/settings, public files, package/config, telemetry and embed modules, user settings writers, auth/email/flow paths; `AdSense`, `adsbygoogle`, `doubleclick`, `admob`, `advertising`, `sponsored`, `promotional`, `marketing`, `iframe`, `posthog`, `consent` | Actual PostHog/Sentry boot, cookie preference, click-mounted YouTube/Bluesky/Mastodon, stream offer labels and allowed settings: AD01–AD04. |

## Changes from the older audit and grouping recommendations

`git diff --name-only b15b6cbe6f8dd8aa4fc861b5e7c8443c37d39768 97eb3179844c4f68a70ccbd997bab4f2a735516d` shows import/TVTime wishlist and upstream-ID publication changes. The audited filter/MCP/language/telemetry/people/taste/widget code paths are unchanged between those SHAs. **The more precise findings here are primarily new inspection/coverage, not newly shipped functionality since the earlier audit.** In particular, do not report MCP widgets/runtime ranges or the bounded consent model as new releases just because this dossier first traces them.

Recommended documentary splits (no build plan):

- **`filters`**: `runtime-ranges`, `production-origin`, `imdb-vote-count`, `chart-filter-sets`.
- **`ai-recs`**: `personalized-discovery`, `first-party-ai-chat`, `ranked-search-allowance`, `instant-response`.
- **`reference`**: `reference-lookup`, `age-end-time-live-activity`, `provider-reference-integration`.
- **`spoilers`**: `global-spoiler-mask`, `per-show-spoiler-override`.
- **`result-depth`**: `trending-title-depth`, `similar-title-depth`, `ordinary-popularity-pagination`.
- **`summaries`**: `review-prose-summary`, `score-based-verdict`.
- **`language`**: `anime-title-language`, `catalog-organization`, `cinemeta-configuration`, `streamer-mode`, `vintage-mode-cosmetic`.
- **`ranking-stats`**: `top100-completion`, `historical-title-percentiles`, `current-taste-analytics`, `pairwise-ranking-history`.
- **`people-alerts`**: `creator-channel-follow-updates`, `favorite-cast-capacity`.
- **`api`**: `member-read-write-mcp`, `competitor-rest-contract`, `request-allowances`, `multiple-app-grants`.
- **`widgets`**: `native-home-widget`, `per-show-home-shortcut`, `apple-shortcuts-action`, `public-ranking-embed`.
- **`keyboard`**: `pairwise-ranking-keyboard`.
- **`metadata-refresh`**: `member-request-upstream-refresh`.
- **`ads`**: `own-web-display-ads`, `third-party-tracking`, `embedded-video-ads`, `native-group-ad-scope`, `promotional-notification-optout`.

The broad feature label should remain Partial whenever these variants differ. Have subvariants worth preserving explicitly include runtime-range filtering via MCP, continued reference lookup, common genre/rating/year/service filtering, multiple bounded OAuth grants, personalized recommendations, current taste breakdowns and app-owned browser display surfaces without banner slots. This is not a recommendation to claim whole-product parity or to add every adjacent control.

## Genuine residual uncertainties

- **Competitor specifications**: Movie Paradise’s exact advanced-filter set/AI quotas, Pix recommendation count/free Ask allowance, Filmarks detailed sort controls, Criticker full-similar size, Flickchart full historical analytics fields, several native ad surface/SKU allocations, Trakt VIP connection maximum and the retained Filmweb+/StreamGuide/Upflix source conflicts remain source-side limits. The GoodWatch concrete counterpart has been assessed independently.
- **External/configuration state**: Better Auth/MCP resource and tool flags, search-role/readings configuration, data snapshot availability, social flags/published payload, real OAuth host support and third-party video/tracking behavior were not exercised. These qualify deployment or outside behavior; they do not leave an app-owned code capability Not checked.
- **Scope to preserve in integration**: A single normalized row cannot honestly equate app-native ad removal, no-tracking, banner-only absence and notification opt-out. Likewise, a member MCP substitute can coexist with an absent exact REST contract. Store these dimensions rather than overriding every raw record with one whole-family claim.

## Validation and handoff contract

Validation checks assert exactly the fourteen assigned feature IDs, exactly71 unique contributing record IDs with no extras/omissions, eligible offer IDs copied from each existing record review, valid assessed states, all evidence IDs resolved, and every pinned file/line exists in the archive. A structural parse verifies the JSON block and all internal evidence anchors. Source input hashes are recorded to detect concurrent integration changes. Letterboxd’s narrower ad-associated-tracking wording was checked directly before classifying OP-205. No app tests, production calls, external account flow, purchases or paid access were run. No implementation or deployment claims are made.

The JSON below is a **handoff**, not an instruction to overwrite current companion files. `features[].state` is the proposed broad label, `records[].state` is the exact scoped record label, `observed` and `gap_or_boundary` explain it, and `evidence_ids` resolves to pinned code chains. `competitor_evidence_status` and source URLs preserve uncertainty independently. `eligible_offer_ids` retain the existing plan-level mapping; `context_offer_ids` remain contextual. Integrator should preserve each narrower boundary and rebase against `source_file_sha256` if the UI/data thread has changed inputs.

```json
{
  "schema": "goodwatch.checked-discovery.v1",
  "audit_date": "2026-10-19",
  "code_sha": "97eb3179844c4f68a70ccbd997bab4f2a735516d",
  "previous_audit_sha": "b15b6cbe6f8dd8aa4fc861b5e7c8443c37d39768",
  "deployment_verified": false,
  "assessment_basis": "pinned_source_code",
  "source_file_sha256": {
    "competitor-paid-features-view.json": "afd0e60c2291d8b1a8aac29eff38b70b9f643f97781e0ff4f33753fe4af37c9a",
    "competitor-paid-features-opportunities.csv": "0447775a0b31ed3b421bcfb1d69d47d6329846579f23f3fef1fa25dd64fe0d44",
    "competitor-paid-features-plans.csv": "cabaa76490dd13d470083940f2c59d3c0923890141d1ee34e823e8d9ade02949",
    "competitor-paid-features-core.md": "0ccc1e1e65baa6d1fd51b95fc555af00f295d958584c006977b91b0cce249d64",
    "competitor-paid-features-landscape.md": "3b3f37768f11757d0d4319a49d78d815752a93d0a40b86cb3966330ba133005d",
    "competitor-paid-features-named-expansion.md": "50e9b62bfb000918f0eb5d82fd8681744b1d34ab7a568f42f6246ba34639d7d9",
    "competitor-paid-features-discovery-expansion.md": "36851ff9ad509a167bab8577e810757dbf18df2b8b8283975b38040f20016135",
    "competitor-paid-features-goodwatch.md": "6eaf09a2b6730e18a3453303d907e5a35e579302bc32a773ef0b3c4646f991bd"
  },
  "feature_count": 14,
  "record_count": 71,
  "eligible_offer_count": 186,
  "record_state_counts": {
    "have": 13,
    "missing": 21,
    "partial": 37
  },
  "label_semantics": {
    "have": "Exact stated function/outcome exists in pinned code for stated surface; not universal product/platform parity.",
    "partial": "Demonstrated useful subset with concrete missing contract/control/platform/limit.",
    "missing": "Exact scoped control/data object/consumer path absent after connected-path inspection; nearby capabilities explicitly recorded."
  },
  "evidence": {
    "F01": {
      "title": "Connected discovery controls",
      "finding": "Discover parses FilterState from the URL, renders the shared FilterBar, and passes that state to filterTitles through getDiscoverResults. The state enumerates services, seen, type/anime, moods/themes/styles, genres, minimum GoodWatch score, taste match, release presets, similar titles, people, age/content and legacy parameters. UI minimum-score choices are 0/60/70/80; match 0/70/80/90. Up to three moods/themes/styles each, URL list parsing takes 20 entries. The sheet has no production-origin or IMDb-vote-count selector. These are read-time URL filters, not saved dynamic list definitions.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/discover.($type).tsx",
          "line": 155,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/discover.($type).tsx#L155"
        },
        {
          "path": "goodwatch-webapp/app/ui/discover/DiscoverPage.tsx",
          "line": 423,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/discover/DiscoverPage.tsx#L423"
        },
        {
          "path": "goodwatch-webapp/app/domain/filter-state.ts",
          "line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L35"
        },
        {
          "path": "goodwatch-webapp/app/ui/filter-bar/FilterGroups.tsx",
          "line": 196,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/filter-bar/FilterGroups.tsx#L196"
        },
        {
          "path": "goodwatch-webapp/app/server/discover-results.server.ts",
          "line": 118,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L118"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/passes.server.ts",
          "line": 159,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/passes.server.ts#L159"
        },
        {
          "path": "goodwatch-webapp/app/domain/filter-state.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.test.ts#L1"
        }
      ]
    },
    "F02": {
      "title": "Runtime and explicit year ranges",
      "finding": "MCP discover_titles exposes inclusive min_runtime/max_runtime integer minutes 0–10000, min_year/max_year 1800–2100, validates ascending bounds and maps them to the legacy URL parameters. It calls the same filterTitles reader as Discover. legacyTitles binds >= / <= SQL over movie.runtime or show.episode_runtime[1]; null runtimes do not satisfy either bound. Legacy query LIMIT is 100000. Browser sheet has no runtime range picker, but manually supplied URLs and the documented MCP tool are connected consumer paths. Browser My movies time shortcuts are not an arbitrary minimum/maximum range.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 149,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L149"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 305,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L305"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/data.server.ts",
          "line": 319,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/data.server.ts#L319"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover-filters.ts",
          "line": 39,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L39"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover-filters.ts",
          "line": 114,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L114"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover-filters.ts",
          "line": 146,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L146"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover.server.ts",
          "line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover.server.ts#L40"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/id-sets.server.ts",
          "line": 132,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L132"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/id-sets.server.ts",
          "line": 181,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L181"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/id-sets.server.ts",
          "line": 23,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/id-sets.server.ts#L23"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover-filters.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.test.ts#L1"
        }
      ]
    },
    "F03": {
      "title": "Production origin and vote-count boundary",
      "finding": "Title details contain production_country_codes, but FilterState, the Filters sheet, MCP discovery schema and title-filter PassInput contain no selectable production-country predicate. The saved country resolves streaming territory. Discover has a fixed aggregate GoodWatch vote floor of 1000 and vote tie-breaks, not a user-controlled IMDb vote-count minimum. Data presence and a fixed quality floor do not supply the two missing controls.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/title-details-fields.ts",
          "line": 16,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L16"
        },
        {
          "path": "goodwatch-webapp/app/domain/filter-state.ts",
          "line": 103,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L103"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/order.server.ts",
          "line": 16,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/order.server.ts#L16"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/passes.server.ts",
          "line": 159,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/passes.server.ts#L159"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/discover-filters.ts",
          "line": 23,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/discover-filters.ts#L23"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.country.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.country.tsx#L1"
        }
      ]
    },
    "A01": {
      "title": "Personalized discovery and external-assistant conversation",
      "finding": "Discover For you combines taste with the chosen ordering; descriptive search decodes a request into ranked title results. /use-with-ai teaches the member to connect an external AI application. /mcp has read and write tools for discovery, similar titles, tonight, personal library and marks. The site chat panel is an illustrative ChatDemo, not an on-site conversational inference endpoint. External app response generation, subscription and chat allowance belong to that host. These provide recommendation access and an external conversation route, not a first-party unlimited-chat or instant-response guarantee.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/for-you.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/for-you.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/discover-results.server.ts",
          "line": 118,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L118"
        },
        {
          "path": "goodwatch-webapp/app/server/combined-search/reading-retrieval.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/combined-search/reading-retrieval.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/routes/use-with-ai.tsx",
          "line": 57,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/use-with-ai.tsx#L57"
        },
        {
          "path": "goodwatch-webapp/app/ui/use-with-ai/ChatDemo.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/use-with-ai/ChatDemo.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/routes/mcp.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/mcp.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 103,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L103"
        }
      ]
    },
    "A02": {
      "title": "AI/search allowance and configuration",
      "finding": "MCP smarter matches enforce 20 uncached admitted attempts per member per UTC day; cached queries and existing pages do not consume that allowance. One smarter match per member may be in flight. This is not a quota on all MCP tools or on external chat messages. Website search has 10 searches/30seconds and 60/10minutes per trusted IP (IPv6 /64); missing trusted header skips that limiter. Search in-flight default is 4 per role. Search readings require a storage key; shared spending budgets are 1e9 nano/day and 5e9 nano/month, and dependencies can cause basic/busy results. Nothing establishes instant or unlimited service.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/mcp/ranked.server.ts",
          "line": 61,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/ranked.server.ts#L61"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/rate-limit.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/rate-limit.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/limits.server.ts",
          "line": 6,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/limits.server.ts#L6"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/store.server.ts",
          "line": 12,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/store.server.ts#L12"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/store.server.ts",
          "line": 138,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/store.server.ts#L138"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/runtime.server.ts",
          "line": 18,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/runtime.server.ts#L18"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/policy.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/search-runtime/rate-limit.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/search-runtime/rate-limit.test.ts#L1"
        }
      ]
    },
    "R01": {
      "title": "Title and people lookup",
      "finding": "/search redirects to Discover search; its people result panel links to a person page. Movie/show pages render cast and crew with links, and person loader reads credits for a filmography with filters. There is no total 20-search paywall in this connected path; burst and service limits still apply. Cast document and Load more are real data reads. Person credits query up to 2000 acting rows and 2000 crew rows, not an unbounded complete external filmography. MCP search_people/get_person add a structured lookup path.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/search.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/search.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/search/SearchPeople.tsx",
          "line": 59,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/search/SearchPeople.tsx#L59"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 100,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/Actors.tsx",
          "line": 27,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Actors.tsx#L27"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/Crew.tsx",
          "line": 17,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Crew.tsx#L17"
        },
        {
          "path": "goodwatch-webapp/app/routes/person.$personKey.tsx",
          "line": 75,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L75"
        },
        {
          "path": "goodwatch-webapp/app/server/person.server.ts",
          "line": 222,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L222"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 253,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L253"
        }
      ]
    },
    "R02": {
      "title": "Reference facts versus native timers and ages",
      "finding": "Title details read runtime, release year/date, seasons and episodes; the title questions include ordinary episode length and score-based answers. Person data reader selects name, profile and department; page shows career/credit facts. No person birthday/current-age/age-at-release calculation, end-time calculator or native Live Activity registration is connected. Native-runtime inspection is recorded in W01. Runtime and a career-year range must not be called age-at-release or a timer.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/title-details-fields.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/titleQuestions.ts",
          "line": 198,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/titleQuestions.ts#L198"
        },
        {
          "path": "goodwatch-webapp/app/server/person.server.ts",
          "line": 545,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L545"
        },
        {
          "path": "goodwatch-webapp/app/routes/person.$personKey.tsx",
          "line": 391,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L391"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/Runtime.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Runtime.tsx#L1"
        }
      ]
    },
    "R03": {
      "title": "Plex import is not Callsheet provider lookup",
      "finding": "/api/imports/plex/:step and the import settings flow implement Plex authorization and read server/watchlist/history data into an import preview. Completion discards credentials for a completed flow. This is material existing integration, but not one-time provider login retained for querying Channels/Plex/Jellyfin media facts or opening corresponding library items. No Channels/Jellyfin live-lookup route or title action was found in routes, import connectors, details UI or MCP tools.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/api.imports.plex.$step.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.plex.$step.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/plex-connect.server.ts",
          "line": 62,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-connect.server.ts#L62"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/plex-connect.server.ts",
          "line": 145,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-connect.server.ts#L145"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/plex-client.server.ts",
          "line": 163,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/plex-client.server.ts#L163"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 100,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 175,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L175"
        }
      ]
    },
    "S01": {
      "title": "Spoiler settings boundary",
      "finding": "Cast cards render characters when supplied; opened season rows render episode names, and episode tips render names/scores. Season/episode counts come from the details reader. Generic collapsed sections require a click but have no global spoiler preference or per-show override. The user settings schema has no spoiler fields and the tracking state stores viewing status, not spoiler masks. An older DNA component contains spoiler UI code but hard-codes isSpoiler=false; it cannot establish a working hide feature. No connected preference masks character names, counts, episode titles, thumbnails or summaries in Callsheet’s combination.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/details/Actors.tsx",
          "line": 138,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Actors.tsx#L138"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/episode-grid/SeasonDetails.tsx",
          "line": 45,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/episode-grid/SeasonDetails.tsx#L45"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/episode-grid/shared.tsx",
          "line": 201,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/episode-grid/shared.tsx#L201"
        },
        {
          "path": "goodwatch-webapp/app/server/title-details-fields.ts",
          "line": 32,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L32"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.get.tsx",
          "line": 11,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11"
        },
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "line": 28,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28"
        },
        {
          "path": "goodwatch-webapp/app/ui/dna/DNACategory.tsx",
          "line": 53,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/dna/DNACategory.tsx#L53"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 69,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L69"
        }
      ]
    },
    "D01": {
      "title": "Trending objects and depth",
      "finding": "Discover permits 40 titles/page and page numbers up to 250, but Popular is TMDB popularity, not the Criticker trending chart. Hot on socials is a separate real trend reader: route -> getHotOnSocials -> published buzz snapshot -> ranked title blocks. Page reader asks for up to 40 board titles, but current primary and backup publishers put only the top 20 in top20. Thus ordinary popularity browsing beyond 100 is Have, while top-100 trending is not supplied by this path. The social route is flag-gated and flags default off. Its social post LIMIT 400 is posts, not 400 trending titles.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/discover-results.server.ts",
          "line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L35"
        },
        {
          "path": "goodwatch-webapp/app/server/discover-results.server.ts",
          "line": 268,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/discover-results.server.ts#L268"
        },
        {
          "path": "goodwatch-webapp/app/server/title-filter/order.server.ts",
          "line": 19,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-filter/order.server.ts#L19"
        },
        {
          "path": "goodwatch-webapp/app/routes/hot-on-socials.tsx",
          "line": 30,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/hot-on-socials.tsx#L30"
        },
        {
          "path": "goodwatch-webapp/app/server/talked-about-now/start-row.server.ts",
          "line": 218,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/talked-about-now/start-row.server.ts#L218"
        },
        {
          "path": "goodwatch-webapp/app/domain/talked-about-now.ts",
          "line": 114,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/talked-about-now.ts#L114"
        },
        {
          "path": "goodwatch-flows/windmill/f/buzz/daily.py",
          "line": 129,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/buzz/daily.py#L129"
        },
        {
          "path": "goodwatch-flows/windmill/f/buzz/backup.py",
          "line": 98,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/buzz/backup.py#L98"
        },
        {
          "path": "goodwatch-webapp/app/server/talked-about-now/flags.server.ts",
          "line": 27,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/talked-about-now/flags.server.ts#L27"
        }
      ]
    },
    "D02": {
      "title": "Similarity objects and paging",
      "finding": "Title page uses a fingerprint-neighborhood map when enabled, otherwise its related-title carousel. The map’s initial plain neighborhood is 80; filter page 0 is 80, pages 1–6 are 240 each (upper request window 1520 positions per filter, before dedupe/exclusions). rings.ts requests more pages and /api/related-map dispatches to relatedMapPage. Eligibility includes >=10000 aggregate votes, >=60 GoodWatch score and release year not in future. MCP get_similar_titles intentionally uses only up to 80 neighbors, 40 max per call. No branch means “return every similar title in the catalog”; Criticker’s full list algorithm/size is not known. The old /api/similar-media endpoint is a separate selector search, not proof of full similarity depth.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 114,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L114"
        },
        {
          "path": "goodwatch-webapp/app/server/related-map-pack.ts",
          "line": 28,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.ts#L28"
        },
        {
          "path": "goodwatch-webapp/app/server/related-map-pack.ts",
          "line": 80,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.ts#L80"
        },
        {
          "path": "goodwatch-webapp/app/server/related-map.server.ts",
          "line": 66,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map.server.ts#L66"
        },
        {
          "path": "goodwatch-webapp/app/server/related-map.server.ts",
          "line": 201,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map.server.ts#L201"
        },
        {
          "path": "goodwatch-webapp/app/ui/related-map/rings.ts",
          "line": 340,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/related-map/rings.ts#L340"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.related-map.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.related-map.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/similar-titles.server.ts",
          "line": 16,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/similar-titles.server.ts#L16"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/schemas.ts",
          "line": 72,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/schemas.ts#L72"
        },
        {
          "path": "goodwatch-webapp/app/server/related-map-pack.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/related-map-pack.test.ts#L1"
        }
      ]
    },
    "U01": {
      "title": "Review prose synthesis versus score verdict",
      "finding": "Details About renders synopsis/tagline and essence tags; titleQuestions.worthAnswer produces a templated verdict from numerical scores, including critic/audience disagreement. Per-title AI analysis generates fingerprint/essence from original title, release year, type and overview. It does not ingest a review corpus or produce an attributed review-summary field. Read details field selection, DetailsContent, titleQuestions, analysis prompt and input construction, MCP get_title representation and searched review/summarization writers. The numerical verdict is useful, but it is not Pix review-text synthesis.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/details/About.tsx",
          "line": 15,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/About.tsx#L15"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/titleQuestions.ts",
          "line": 110,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/titleQuestions.ts#L110"
        },
        {
          "path": "goodwatch-webapp/app/server/title-details-fields.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-fields.ts#L1"
        },
        {
          "path": "goodwatch-flows/windmill/f/dna/generate/fetch.py",
          "line": 27,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L27"
        },
        {
          "path": "goodwatch-flows/windmill/f/dna/generate/fetch.py",
          "line": 163,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L163"
        },
        {
          "path": "goodwatch-flows/windmill/f/dna/generate/fetch.py",
          "line": 547,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/generate/fetch.py#L547"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/title-details.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/title-details.ts#L1"
        }
      ]
    },
    "L01": {
      "title": "Persisted title presentation languages",
      "finding": "Settings /settings/language offers browser default plus 14 supported locales, including English and Japanese. SettingsPair pickLanguage/keep invokes the shared preference machine; save-adapter posts /api/user-settings/set, whose saveMediaPreferences writer persists the atomic country/language pair and media-preferences-store reads/writes user_setting (or a guest cookie). media-payload and media-overlay present translated title/poster/overview/tagline when available. Menus remain English; no Romaji locale/preference or anime-specific display override is defined. Locale choice does not filter original/spoken language or audio/subtitles and does not configure Cinemeta.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.language.tsx",
          "line": 16,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.language.tsx#L16"
        },
        {
          "path": "goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx",
          "line": 121,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx#L121"
        },
        {
          "path": "goodwatch-webapp/app/utils/media-language.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-language.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/media-preference/save-adapter.ts",
          "line": 57,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/save-adapter.ts#L57"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.set.tsx",
          "line": 80,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.set.tsx#L80"
        },
        {
          "path": "goodwatch-webapp/app/server/media-context.server.ts",
          "line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-context.server.ts#L139"
        },
        {
          "path": "goodwatch-webapp/app/server/media-preferences-store.server.ts",
          "line": 45,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-preferences-store.server.ts#L45"
        },
        {
          "path": "goodwatch-webapp/app/server/media-payload.server.ts",
          "line": 58,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-payload.server.ts#L58"
        },
        {
          "path": "goodwatch-webapp/app/server/media-overlay.server.ts",
          "line": 13,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-overlay.server.ts#L13"
        },
        {
          "path": "goodwatch-webapp/app/utils/media-language.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-language.test.ts#L1"
        }
      ]
    },
    "L02": {
      "title": "Catalog organization and presentation modes",
      "finding": "Discover has fixed filter/sort controls, Explorer an island combination model, and Settings a For you preference. No reader/writer for a user’s catalog section order, catalog rename/hide, Cinemeta/addon catalog configuration or streamer/vintage ranking mode was found across these routes, settings schema and UI. Title hiding is a title interest decision, not catalog hiding. Global browser fullscreen/TV remote and share-card themes do not create a clean pairwise-streamer view or nostalgic whole-site mode.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/filter-state.ts",
          "line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/filter-state.ts#L35"
        },
        {
          "path": "goodwatch-webapp/app/routes/explorer.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/explorer.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.discover-privacy.tsx",
          "line": 19,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L19"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.get.tsx",
          "line": 11,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11"
        },
        {
          "path": "goodwatch-webapp/app/ui/settings/paths.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/paths.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-card/model.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L1"
        }
      ]
    },
    "T01": {
      "title": "Current taste comparisons, no historical ranking/completion series",
      "finding": "/taste/everyone reads the current portrait’s Everyone view and shows comparisons to GoodWatch’s aggregate score. everyone.server computes current agreement/offset and higher/lower title and attribute/genre gaps. My library scores sort/group personal numeric ratings; they are not head-to-head match records. /movies/best and /shows/best render a sitemap ranking, 250 per page, with no member join or top100-completion calculation. These readers do not store historic title ranking percentiles or expose a completion metric across ranked top100 lists. A taste percentile at the current moment is not a historical rank chart.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/taste.everyone.tsx",
          "line": 28,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/taste.everyone.tsx#L28"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/everyone.server.ts",
          "line": 24,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/everyone.server.ts#L24"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/everyone.server.ts",
          "line": 73,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/everyone.server.ts#L73"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-scores.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-scores.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/my-scores.server.ts",
          "line": 25,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-scores.server.ts#L25"
        },
        {
          "path": "goodwatch-webapp/app/routes/$type.best.tsx",
          "line": 29,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/$type.best.tsx#L29"
        },
        {
          "path": "goodwatch-webapp/app/ui/best-lists/RankedTitles.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/best-lists/RankedTitles.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/person.server.ts",
          "line": 79,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/person.server.ts#L79"
        }
      ]
    },
    "P01": {
      "title": "People browsing versus following and delivery",
      "finding": "Person pages load filmographies, trait signatures and credit filters; they offer no Follow/Favorite creator mutation. userData reads user_favorite as media title keys and all member data is title-based; there is no person/channel-follow reader/writer here. New episodes and newly available signals are computed for tracked/wishlisted titles, not followed people. Inspected person/search/details UI, routes, member model, settings, MCP tools/write registry and flows for person-follow/channel subscription and creator release delivery. Neither a favorite-cast collection with a count nor creator updates are connected.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/person.$personKey.tsx",
          "line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L180"
        },
        {
          "path": "goodwatch-webapp/app/server/person.server.ts",
          "line": 637,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L637"
        },
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "line": 28,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28"
        },
        {
          "path": "goodwatch-webapp/app/server/userData.server.ts",
          "line": 102,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L102"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-names.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/new-episodes.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/new-episodes.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/newly-available.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/newly-available.server.ts#L1"
        }
      ]
    },
    "X01": {
      "title": "Authenticated member API contract",
      "finding": "/mcp dispatches a stateless authenticated JSON-RPC MCP server. Endpoint requires bearer token mcp:read, configured MCP_RESOURCE_URL, member subject and mcp:write for writes. Read tools return discovery, titles, people, personal library, progress, lists and settings; write registry includes ratings, watches, interest/state, service/settings and five-title share lists. Those use site domain writers and read-back receipts. It is a genuine member read/write integration but not TVmaze’s REST user contract, Libib’s owner-key/Ultimate scoped-key REST catalog/circulation contract, SIMKL’s API or MDBList list/metadata API. Browser /api routes use site sessions and do not establish a supported general developer REST key service.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/mcp.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/mcp.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "line": 60,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L60"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "line": 128,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L128"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 103,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L103"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-names.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/title-write.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/title-write.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.test.ts#L1"
        }
      ]
    },
    "X02": {
      "title": "Request and write dimensions",
      "finding": "MCP endpoint request limiter counts 60 requests/60seconds and 1000/3600seconds per member; it is named mcp-read but runs for both read and write requests. Separate title-write item windows are 300/minute and 2000/hour, with 50 items/batch; heavy grouped writes can cost 5 items (write-names). MCP smarter matching’s distinct 20 uncached attempts/day does not cap API access as a whole. Discovery/search max 40 results/call, general paging max20 by schema. These windows do not replicate SIMKL 500/1000/10000 noncached requests/day or MDBList 1k–1.5m/day plus their object contract/bursts. No conversion from per-hour windows to a promised daily allowance is warranted.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "line": 33,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L33"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "line": 143,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L143"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "line": 21,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-names.ts",
          "line": 46,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L46"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/schemas.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/schemas.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/tools.server.ts",
          "line": 149,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/tools.server.ts#L149"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/ranked.server.ts",
          "line": 61,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/ranked.server.ts#L61"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.test.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.test.ts#L1"
        }
      ]
    },
    "X03": {
      "title": "Multiple grants and actual auth population bounds",
      "finding": "Connected apps lists one row per OAuth consent grant (Claude Code can have one per computer), shows read/write access and last use, and disconnects an owned grant. Auth plugin scopes and adapter support multiple clients/grants. This is multi-app support without a consumer payment gate. It is NOT unlimited: authActorBounds is 128 rows per member for oauthConsent, 1024 each for access/refresh token rows, 20 member sessions; createGoodwatchAuth enables populationBounds:true and crate adapter calls admitAuthRow. Grants are not guaranteed unique apps (multiple computers/consents can consume rows). Dynamic registration has an independent 30/hour/IP limiter. Better Auth must be enabled; connected-apps route is 404 when off.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.connected-apps.tsx",
          "line": 17,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.connected-apps.tsx#L17"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.connected-apps.tsx",
          "line": 69,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.connected-apps.tsx#L69"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/connected-apps.server.ts",
          "line": 30,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/connected-apps.server.ts#L30"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/auth.server.ts",
          "line": 96,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L96"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/auth.server.ts",
          "line": 349,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L349"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/population.server.ts",
          "line": 21,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.server.ts#L21"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/population.server.ts",
          "line": 48,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.server.ts#L48"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/crate-adapter.server.ts",
          "line": 340,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/crate-adapter.server.ts#L340"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/boot.server.ts",
          "line": 19,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/boot.server.ts#L19"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/population.integration.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/population.integration.ts#L1"
        }
      ]
    },
    "W01": {
      "title": "Native platform surfaces",
      "finding": "Repository package/dependency and platform-file inventory contains a Remix browser app, standalone web manifest/icons and web/MCP components. No WidgetKit/Swift/ActivityKit/AppIntents target, Android AppWidgetProvider/shortcut target, Capacitor/React Native package or OS widget configuration/receiver was found. site.webmanifest has no shortcuts or related native-app declaration. Installing a web icon and web TV remote keyboard navigation are different from Hobi/Sequel/SeriesGuide/FilmNoir/SofaTime/Showly device widgets, SeriesGuide show shortcuts, Callsheet Shortcuts media-info actions or Live Activities.",
      "sources": [
        {
          "path": "goodwatch-webapp/package.json",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/package.json#L1"
        },
        {
          "path": "goodwatch-webapp/public/site.webmanifest",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/public/site.webmanifest#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/living-room/Remote.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/living-room/Remote.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/routes/use-with-ai.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/use-with-ai.tsx#L1"
        }
      ]
    },
    "W02": {
      "title": "Public share cards and MCP Apps are not blog widgets",
      "finding": "Public /u/:handle/lists/:id shows a five-title share list and supplies its current share-card image as og:image. Share-list edits warm the card. This is an updating public image/link subset, not an offered customizable embed for rankings/watchlist/reviews/year-best with an embed-code builder. MCP Apps poster resource ui://goodwatch/posters-v3.html renders tool results in a supporting authenticated host; its CSP has no connectDomains, so it is not an independently refreshing public blog widget. No embed route or widget preferences/writer for that consumer website use was found. Treat this record Partial, native widget/Shortcuts records Missing.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx",
          "line": 84,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L84"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle_.lists.$id_.edit.tsx",
          "line": 90,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle_.lists.$id_.edit.tsx#L90"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/poster-grid.server.ts",
          "line": 6,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/poster-grid.server.ts#L6"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/poster-grid.server.ts",
          "line": 30,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/poster-grid.server.ts#L30"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L1"
        }
      ]
    },
    "K01": {
      "title": "Rating buttons versus pairwise keyboard ranking",
      "finding": "My library scores shows numeric score keys/buttons; the score domain sorts numeric ratings and updates them. ScoreControl renders ordinary button choices. TV has registered remote controls and ordinary dialogs/menus have navigation handlers. Route/UI/domain/writer inventory contains no pairwise movie-ranking matchup state, comparison-result writer or configurable keyboard shortcuts for choosing winner/loser/skip in matchups. The visual word keys in My scores are not Flickchart ranking accelerators.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/my-library.scores.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-library.scores.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/my-library/scores/ScoreRow.tsx",
          "line": 50,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/scores/ScoreRow.tsx#L50"
        },
        {
          "path": "goodwatch-webapp/app/ui/title-actions/ScoreControl.tsx",
          "line": 53,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/title-actions/ScoreControl.tsx#L53"
        },
        {
          "path": "goodwatch-webapp/app/ui/scoring/ScoreChoices.tsx",
          "line": 21,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/scoring/ScoreChoices.tsx#L21"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-scores.ts",
          "line": 31,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-scores.ts#L31"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.update-scores-batch.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-scores-batch.ts#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/living-room/Remote.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/living-room/Remote.tsx#L1"
        }
      ]
    },
    "M01": {
      "title": "Automatic catalog refresh versus member trigger",
      "finding": "Title loader reads cached catalog details. Cache is fresh 12h plus at most 12h stale; a read/cache retry is not a request to re-fetch metadata from the upstream provider. Flow TMDB refetch cycle is 30days and DNA staleness 180days. Inspected movie/show routes, Details/Questions, search/MCP tool schemas and write registry, cache-reset routes and flow entrypoints: no member-facing force/request-catalog-refresh action or member-scoped job request writer. Operator refresh/cache jobs and personal-order rebuilds are different. Result is Missing for MyEpisodes user trigger, not a claim that catalog data never updates.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/movie.$movieKey.tsx",
          "line": 134,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/movie.$movieKey.tsx#L134"
        },
        {
          "path": "goodwatch-webapp/app/routes/show.$showKey.tsx",
          "line": 183,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/show.$showKey.tsx#L183"
        },
        {
          "path": "goodwatch-webapp/app/server/title-details-cache.ts",
          "line": 13,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-details-cache.ts#L13"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 43,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L43"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-names.ts",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-names.ts#L1"
        },
        {
          "path": "goodwatch-flows/windmill/f/tmdb_api/refetch_cycle.py",
          "line": 17,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/tmdb_api/refetch_cycle.py#L17"
        },
        {
          "path": "goodwatch-flows/windmill/f/dna/models.py",
          "line": 20,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/dna/models.py#L20"
        },
        {
          "path": "goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py#L1"
        }
      ]
    },
    "AD01": {
      "title": "No app-owned display-ad path in inspected browser surfaces",
      "finding": "Inspected production root, Discover/title/person/library/settings/share-list/social UI, package dependencies, public files and configuration for ad networks, banner/advertorial slots, sponsored ranking labels, rewarded ads and paid ad-removal gates. Root renders the site shell plus telemetry; title content is catalog/ratings/streaming/reference sections. No first-party banner or ad-network slot integration was found on these connected paths. Thus Have is justified for the scoped equivalent: app-owned web display surfaces without banner ads. This is not a universal assurance about every deployment, native app, linked provider, video embed or social editorial item. No ad-removal purchase is needed on inspected routes.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/root.tsx",
          "line": 356,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L356"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "line": 73,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L73"
        },
        {
          "path": "goodwatch-webapp/app/ui/discover/DiscoverPage.tsx",
          "line": 423,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/discover/DiscoverPage.tsx#L423"
        },
        {
          "path": "goodwatch-webapp/app/routes/person.$personKey.tsx",
          "line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/person.$personKey.tsx#L180"
        },
        {
          "path": "goodwatch-webapp/package.json",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/package.json#L1"
        }
      ]
    },
    "AD02": {
      "title": "Analytics and privacy do not establish no tracking",
      "finding": "Root mounts TelemetryBoot; after interactivity loadTools imports PostHog and Sentry on non-localhost. PostHog init uses a.goodwatch.app, pageleave capture, localStorage+cookie persistence and session-recording configuration; TelemetryBoot identifies members and captures events. Cookie choice is stored via localStorage and user_setting and is offered in Settings, but inspected telemetry initialization does not read cookie_consent to suppress loading/capture. Therefore TVmaze/Upflix-style broad no-tracking removal is Missing as an exact dimension; those combined records are Partial. Letterboxd instead removes third-party ads and ASSOCIATED ad tracking: ordinary product analytics does not by itself violate that narrower benefit, so OP-205 is Have for the inspected app-owned display/ad-network scope. This is a code comparison, not a legal/privacy compliance assessment or proof which telemetry reaches live services.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/root.tsx",
          "line": 378,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L378"
        },
        {
          "path": "goodwatch-webapp/app/telemetry/TelemetryBoot.tsx",
          "line": 42,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/TelemetryBoot.tsx#L42"
        },
        {
          "path": "goodwatch-webapp/app/telemetry/telemetry.ts",
          "line": 68,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/telemetry.ts#L68"
        },
        {
          "path": "goodwatch-webapp/app/telemetry/posthog-browser.ts",
          "line": 97,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/posthog-browser.ts#L97"
        },
        {
          "path": "goodwatch-webapp/app/telemetry/sentry-browser.ts",
          "line": 62,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/telemetry/sentry-browser.ts#L62"
        },
        {
          "path": "goodwatch-webapp/app/ui/CookieConsent.tsx",
          "line": 7,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/CookieConsent.tsx#L7"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.discover-privacy.tsx",
          "line": 50,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L50"
        }
      ]
    },
    "AD03": {
      "title": "Embeds and streaming links retain outside behavior",
      "finding": "Trailer click lazy-loads a YouTube frame using youtube-nocookie.com/embed with autoplay and origin referrer. Social click mounts official YouTube/Bluesky/Mastodon iframes. These paths do not implement ad blocking or a no-tracking promise inside the vendors’ frames. Banner-only benefits and benefits explicitly exempting embedded video can match a narrower app-owned-web scope; benefits claiming all video ads/no tracking cannot be marked Have universally. Streaming offer type ads is a label in where-to-watch links; it neither inserts an ad in GoodWatch nor proves ad-free browsing.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/details/hero/Trailer.tsx",
          "line": 73,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/hero/Trailer.tsx#L73"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/YoutubePlayer.tsx",
          "line": 1,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/YoutubePlayer.tsx#L1"
        },
        {
          "path": "goodwatch-webapp/app/ui/social-embed/YouTubeFrame.tsx",
          "line": 18,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/YouTubeFrame.tsx#L18"
        },
        {
          "path": "goodwatch-webapp/app/ui/social-embed/players.tsx",
          "line": 72,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/players.tsx#L72"
        },
        {
          "path": "goodwatch-webapp/app/ui/social-embed/SocialEmbed.tsx",
          "line": 142,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/social-embed/SocialEmbed.tsx#L142"
        },
        {
          "path": "goodwatch-webapp/app/utils/streaming-links.ts",
          "line": 177,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/streaming-links.ts#L177"
        }
      ]
    },
    "AD04": {
      "title": "Promotion preference boundary",
      "finding": "Settings Discover/privacy offers For you and Cookies. UserSettingsSchema has no promotional-push/email opt-out setting; member settings writer validates only the allowed schema. Read notification/email code and flow inventory: auth delivery is present but no consumer promotional-push sender/preference path was identified. Therefore iCollect’s explicit Pro promotional-notification opt-out control is Missing; there is no evidence that GoodWatch is currently sending such promotions or that it needs a fake opt-out to get the no-promotion outcome. Cookie choice, personalization and private list visibility are separate controls.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.discover-privacy.tsx",
          "line": 19,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L19"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.get.tsx",
          "line": 11,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11"
        },
        {
          "path": "goodwatch-webapp/app/server/user-settings.server.ts",
          "line": 102,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/user-settings.server.ts#L102"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/auth.server.ts",
          "line": 305,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/auth.server.ts#L305"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/mail.server.ts",
          "line": 47,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/mail.server.ts#L47"
        }
      ]
    }
  },
  "features": [
    {
      "feature_id": "filters",
      "state": "partial",
      "summary": "Combinable discovery and MCP runtime/year controls exist; production-origin, IMDb vote selector and chart-specific controls are missing.",
      "record_ids": [
        "OP-001",
        "OP-002",
        "OP-003",
        "OP-018",
        "OP-019",
        "OP-392",
        "OP-602"
      ],
      "suggested_splits": [
        "runtime-ranges",
        "production-origin",
        "imdb-vote-count",
        "chart-filter-sets"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-063",
        "PLAN-244",
        "PLAN-245",
        "PLAN-246",
        "PLAN-293",
        "PLAN-294",
        "PLAN-308",
        "PLAN-309",
        "PLAN-310",
        "PLAN-311",
        "PLAN-312",
        "PLAN-433"
      ],
      "evidence_ids": [
        "F01",
        "F02",
        "F03",
        "P01",
        "A02",
        "U01"
      ]
    },
    {
      "feature_id": "ai-recs",
      "state": "partial",
      "summary": "Personalized/descriptive discovery and external-assistant tools exist; first-party instant/unlimited AI chat and vendor allowance contracts do not.",
      "record_ids": [
        "OP-022",
        "OP-023",
        "OP-027",
        "OP-622"
      ],
      "suggested_splits": [
        "personalized-discovery",
        "first-party-ai-chat",
        "ranked-search-allowance",
        "instant-response"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128",
        "PLAN-244",
        "PLAN-245",
        "PLAN-246",
        "PLAN-446"
      ],
      "evidence_ids": [
        "A01",
        "A02"
      ]
    },
    {
      "feature_id": "reference",
      "state": "partial",
      "summary": "Continuing cast/crew lookup exists; ages/end-time/Live Activity and Callsheet-style provider lookup do not.",
      "record_ids": [
        "OP-473",
        "OP-479",
        "OP-477"
      ],
      "suggested_splits": [
        "reference-lookup",
        "age-end-time-live-activity",
        "provider-reference-integration"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "evidence_ids": [
        "R01",
        "A02",
        "R02",
        "W01",
        "R03"
      ]
    },
    {
      "feature_id": "spoilers",
      "state": "missing",
      "summary": "No global/per-show masks for character and episode spoiler fields.",
      "record_ids": [
        "OP-474"
      ],
      "suggested_splits": [
        "global-spoiler-mask",
        "per-show-spoiler-override"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "evidence_ids": [
        "S01"
      ]
    },
    {
      "feature_id": "result-depth",
      "state": "partial",
      "summary": "Popularity pagination, finite trend board and finite paged similarity are separate assessed objects.",
      "record_ids": [
        "OP-016",
        "OP-017"
      ],
      "suggested_splits": [
        "trending-title-depth",
        "similar-title-depth",
        "ordinary-popularity-pagination"
      ],
      "eligible_offer_ids": [
        "PLAN-047"
      ],
      "evidence_ids": [
        "D01",
        "D02"
      ]
    },
    {
      "feature_id": "summaries",
      "state": "missing",
      "summary": "Score-based verdict exists; review-prose synthesis does not.",
      "record_ids": [
        "OP-024"
      ],
      "suggested_splits": [
        "review-prose-summary",
        "score-based-verdict"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128"
      ],
      "evidence_ids": [
        "U01"
      ]
    },
    {
      "feature_id": "language",
      "state": "partial",
      "summary": "Saved English/Japanese title language exists; Romaji, catalog organization/configuration and named ranking modes are distinct gaps.",
      "record_ids": [
        "OP-345",
        "OP-439",
        "OP-440",
        "OP-572"
      ],
      "suggested_splits": [
        "anime-title-language",
        "catalog-organization",
        "cinemeta-configuration",
        "streamer-mode",
        "vintage-mode-cosmetic"
      ],
      "eligible_offer_ids": [
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020",
        "PLAN-330",
        "PLAN-331",
        "PLAN-332",
        "PLAN-417",
        "PLAN-418"
      ],
      "evidence_ids": [
        "L01",
        "L02",
        "F01",
        "K01"
      ]
    },
    {
      "feature_id": "ranking-stats",
      "state": "partial",
      "summary": "Current taste/rating analytics exist; Top100 completion, historic title percentiles and pairwise-ranking histories do not.",
      "record_ids": [
        "OP-223",
        "OP-224",
        "OP-571"
      ],
      "suggested_splits": [
        "top100-completion",
        "historical-title-percentiles",
        "current-taste-analytics",
        "pairwise-ranking-history"
      ],
      "eligible_offer_ids": [
        "PLAN-047",
        "PLAN-417",
        "PLAN-418"
      ],
      "evidence_ids": [
        "T01",
        "K01"
      ]
    },
    {
      "feature_id": "people-alerts",
      "state": "missing",
      "summary": "People lookup is present; creator/channel follow storage, delivery and favorite-cast capacities are absent.",
      "record_ids": [
        "OP-143",
        "OP-511"
      ],
      "suggested_splits": [
        "creator-channel-follow-updates",
        "favorite-cast-capacity"
      ],
      "eligible_offer_ids": [
        "PLAN-063",
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395"
      ],
      "evidence_ids": [
        "P01"
      ]
    },
    {
      "feature_id": "api",
      "state": "partial",
      "summary": "OAuth read/write MCP and multiple grants exist, with concrete bounds; competitor REST contracts and daily allowance ladders are not replicated.",
      "record_ids": [
        "OP-163",
        "OP-164",
        "OP-165",
        "OP-501",
        "OP-654"
      ],
      "suggested_splits": [
        "member-read-write-mcp",
        "competitor-rest-contract",
        "request-allowances",
        "multiple-app-grants"
      ],
      "eligible_offer_ids": [
        "PLAN-009",
        "PLAN-010",
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020",
        "PLAN-057",
        "PLAN-058",
        "PLAN-059",
        "PLAN-060",
        "PLAN-061",
        "PLAN-062",
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395",
        "PLAN-468",
        "PLAN-469",
        "PLAN-472"
      ],
      "evidence_ids": [
        "X01",
        "X02",
        "X03"
      ]
    },
    {
      "feature_id": "widgets",
      "state": "partial",
      "summary": "Native widgets/Shortcuts are absent; updating share-card and MCP Apps are a subset of public embed use.",
      "record_ids": [
        "OP-167",
        "OP-168",
        "OP-169",
        "OP-170",
        "OP-171",
        "OP-172",
        "OP-476",
        "OP-569"
      ],
      "suggested_splits": [
        "native-home-widget",
        "per-show-home-shortcut",
        "apple-shortcuts-action",
        "public-ranking-embed"
      ],
      "eligible_offer_ids": [
        "PLAN-078",
        "PLAN-079",
        "PLAN-086",
        "PLAN-087",
        "PLAN-088",
        "PLAN-089",
        "PLAN-090",
        "PLAN-091",
        "PLAN-092",
        "PLAN-093",
        "PLAN-094",
        "PLAN-095",
        "PLAN-096",
        "PLAN-097",
        "PLAN-152",
        "PLAN-153",
        "PLAN-154",
        "PLAN-161",
        "PLAN-162",
        "PLAN-163",
        "PLAN-164",
        "PLAN-165",
        "PLAN-166",
        "PLAN-167",
        "PLAN-168",
        "PLAN-169",
        "PLAN-170",
        "PLAN-171",
        "PLAN-172",
        "PLAN-299",
        "PLAN-302",
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357",
        "PLAN-417",
        "PLAN-418"
      ],
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "feature_id": "keyboard",
      "state": "missing",
      "summary": "Ordinary numeric rating/keyboard navigation exists; pairwise-ranking keyboard accelerators do not.",
      "record_ids": [
        "OP-570"
      ],
      "suggested_splits": [
        "pairwise-ranking-keyboard"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "evidence_ids": [
        "K01"
      ]
    },
    {
      "feature_id": "metadata-refresh",
      "state": "missing",
      "summary": "Catalog refresh is automatic/operator controlled; no member-triggered metadata-refresh path.",
      "record_ids": [
        "OP-494"
      ],
      "suggested_splits": [
        "member-request-upstream-refresh"
      ],
      "eligible_offer_ids": [
        "PLAN-378",
        "PLAN-379",
        "PLAN-380",
        "PLAN-381"
      ],
      "evidence_ids": [
        "M01"
      ]
    },
    {
      "feature_id": "ads",
      "state": "partial",
      "summary": "Own browser display pages have no ad slots; tracking, outside video behavior, native/group scopes and promotional controls require distinct dispositions.",
      "record_ids": [
        "OP-204",
        "OP-205",
        "OP-206",
        "OP-207",
        "OP-208",
        "OP-209",
        "OP-210",
        "OP-211",
        "OP-347",
        "OP-348",
        "OP-394",
        "OP-406",
        "OP-410",
        "OP-478",
        "OP-481",
        "OP-487",
        "OP-553",
        "OP-565",
        "OP-579",
        "OP-590",
        "OP-596",
        "OP-600",
        "OP-605",
        "OP-607",
        "OP-611",
        "OP-619",
        "OP-623",
        "OP-626",
        "OP-643"
      ],
      "suggested_splits": [
        "own-web-display-ads",
        "third-party-tracking",
        "embedded-video-ads",
        "native-group-ad-scope",
        "promotional-notification-optout"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020",
        "PLAN-023",
        "PLAN-024",
        "PLAN-025",
        "PLAN-026",
        "PLAN-029",
        "PLAN-030",
        "PLAN-031",
        "PLAN-032",
        "PLAN-033",
        "PLAN-034",
        "PLAN-035",
        "PLAN-036",
        "PLAN-037",
        "PLAN-038",
        "PLAN-039",
        "PLAN-040",
        "PLAN-041",
        "PLAN-042",
        "PLAN-043",
        "PLAN-044",
        "PLAN-045",
        "PLAN-046",
        "PLAN-047",
        "PLAN-056",
        "PLAN-057",
        "PLAN-058",
        "PLAN-059",
        "PLAN-060",
        "PLAN-061",
        "PLAN-062",
        "PLAN-063",
        "PLAN-069",
        "PLAN-070",
        "PLAN-071",
        "PLAN-121",
        "PLAN-122",
        "PLAN-123",
        "PLAN-124",
        "PLAN-125",
        "PLAN-127",
        "PLAN-128",
        "PLAN-137",
        "PLAN-138",
        "PLAN-139",
        "PLAN-140",
        "PLAN-141",
        "PLAN-142",
        "PLAN-144",
        "PLAN-146",
        "PLAN-148",
        "PLAN-150",
        "PLAN-151",
        "PLAN-220",
        "PLAN-221",
        "PLAN-222",
        "PLAN-223",
        "PLAN-234",
        "PLAN-235",
        "PLAN-236",
        "PLAN-237",
        "PLAN-238",
        "PLAN-239",
        "PLAN-244",
        "PLAN-245",
        "PLAN-246",
        "PLAN-293",
        "PLAN-294",
        "PLAN-295",
        "PLAN-296",
        "PLAN-297",
        "PLAN-298",
        "PLAN-303",
        "PLAN-304",
        "PLAN-305",
        "PLAN-308",
        "PLAN-309",
        "PLAN-310",
        "PLAN-311",
        "PLAN-312",
        "PLAN-317",
        "PLAN-324",
        "PLAN-325",
        "PLAN-326",
        "PLAN-327",
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357",
        "PLAN-364",
        "PLAN-370",
        "PLAN-375",
        "PLAN-411",
        "PLAN-412",
        "PLAN-413",
        "PLAN-414",
        "PLAN-417",
        "PLAN-418",
        "PLAN-420",
        "PLAN-421",
        "PLAN-422",
        "PLAN-423",
        "PLAN-424",
        "PLAN-428",
        "PLAN-429",
        "PLAN-430",
        "PLAN-431",
        "PLAN-432",
        "PLAN-433",
        "PLAN-436",
        "PLAN-437",
        "PLAN-438",
        "PLAN-439",
        "PLAN-440",
        "PLAN-441",
        "PLAN-442",
        "PLAN-443",
        "PLAN-444",
        "PLAN-445",
        "PLAN-446",
        "PLAN-447",
        "PLAN-462",
        "PLAN-463",
        "PLAN-464"
      ],
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01",
        "AD02",
        "AD04"
      ]
    }
  ],
  "records": [
    {
      "record_id": "OP-001",
      "feature_id": "filters",
      "competitors": [
        "JustWatch"
      ],
      "capability": "Runtime range",
      "competitor_free_behavior": "Pro required",
      "competitor_paid_behavior": "Runtime filter",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-293",
        "PLAN-294"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "Inclusive minimum/maximum runtime via documented MCP discovery and legacy Discover URL; movie duration versus first usual episode length.",
      "gap_or_boundary": "Browser Filters sheet lacks a range picker. MCP accepts 0–10000 minutes; unknown runtimes fail bounds; legacy SQL caps candidate rows at100000. Do not claim UI-identical controls.",
      "evidence_ids": [
        "F01",
        "F02"
      ]
    },
    {
      "record_id": "OP-002",
      "feature_id": "filters",
      "competitors": [
        "JustWatch"
      ],
      "capability": "Production-country filter",
      "competitor_free_behavior": "Pro required",
      "competitor_paid_behavior": "Production origin,not streaming territory",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-293",
        "PLAN-294"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Streaming-country choice and production-country metadata exist.",
      "gap_or_boundary": "No selectable production-origin/co-production filter in shared state, UI or MCP predicate; saved streaming country is different.",
      "evidence_ids": [
        "F01",
        "F03"
      ]
    },
    {
      "record_id": "OP-003",
      "feature_id": "filters",
      "competitors": [
        "JustWatch"
      ],
      "capability": "IMDb vote-count selector",
      "competitor_free_behavior": "Pro required",
      "competitor_paid_behavior": "Vote-count control separate from score",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-293",
        "PLAN-294"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Fixed aggregate vote floor1000 and votes tie-break exist.",
      "gap_or_boundary": "No IMDb-specific user vote-count selector or adjustable vote floor.",
      "evidence_ids": [
        "F01",
        "F03"
      ]
    },
    {
      "record_id": "OP-018",
      "feature_id": "filters",
      "competitors": [
        "Next Episode"
      ],
      "capability": "Chart filters",
      "competitor_free_behavior": "Ordinary discovery",
      "competitor_paid_behavior": "Additional chart filters",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://next-episode.net/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-063"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Genre, release, saved-service and personal seen filtering; popular/top-rated ordering.",
      "gap_or_boundary": "Next Episode chart controls additionally include lifecycle status, broadcast channel and followed actors/creators/channels; no equivalent predicates. Its premiered-within presets are not identical to GoodWatch release presets.",
      "evidence_ids": [
        "F01",
        "F03",
        "P01"
      ]
    },
    {
      "record_id": "OP-019",
      "feature_id": "filters",
      "competitors": [
        "Movie Paradise"
      ],
      "capability": "Advanced filter set",
      "competitor_free_behavior": "Daily advanced-discovery allowance,number unknown",
      "competitor_paid_behavior": "Advanced filters; controls not fully enumerated",
      "competitor_evidence_status": "No per-control allocation verified",
      "competitor_source_urls": [
        "https://movieparadise.app/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-244",
        "PLAN-245",
        "PLAN-246"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Several combinable discovery filters plus year/runtime ranges over MCP.",
      "gap_or_boundary": "Movie Paradise does not enumerate the complete advanced control set or daily allowance. Inspected GoodWatch controls are concrete; whole-set equivalence cannot be inferred. No saved smart-list/advanced-discovery allowance contract proved.",
      "evidence_ids": [
        "F01",
        "F02",
        "A02"
      ]
    },
    {
      "record_id": "OP-392",
      "feature_id": "filters",
      "competitors": [
        "StreamGuide (Christian Krueger)"
      ],
      "capability": "Genre, rating, year and service filters",
      "competitor_free_behavior": "Generic provider preferences/region switching advertised.",
      "competitor_paid_behavior": "FAQ assigns advanced controls to Premium; enforcement untested.",
      "competitor_evidence_status": "conflicting_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://streamguide.app/faq",
        "https://streamguide.app/resources/getting-started-with-streamguide"
      ],
      "eligible_offer_ids": [
        "PLAN-308",
        "PLAN-309",
        "PLAN-310",
        "PLAN-311",
        "PLAN-312"
      ],
      "context_offer_ids": [
        "PLAN-313"
      ],
      "state": "have",
      "observed": "Combinable genres, minimum rating, release year and streaming-service controls on web/MCP.",
      "gap_or_boundary": "Have is scoped to these four control families. GoodWatch uses its aggregate0–100 score, web year presets or explicit MCP year bounds; does not imply identical upstream metric, provider coverage, native UI or all future Premium filters.",
      "evidence_ids": [
        "F01",
        "F02",
        "F03"
      ]
    },
    {
      "record_id": "OP-602",
      "feature_id": "filters",
      "competitors": [
        "Filmarks"
      ],
      "capability": "Multi-condition title search/sorting",
      "competitor_free_behavior": "Core ratings/reviews/Clip browsing.",
      "competitor_paid_behavior": "App-only Premium advanced combination/sort; exact controls/caps unspecified.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://filmarks.zendesk.com/hc/ja/articles/360053383653",
        "https://filmarks.zendesk.com/hc/ja/articles/360052601594"
      ],
      "eligible_offer_ids": [
        "PLAN-433"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Multiple discovery conditions and popular/top/newest/match/relevance sorting.",
      "gap_or_boundary": "Filmarks primary summary verifies multi-condition search but not a full control/sort enumeration. GoodWatch has no review filtering/sorting path in these title controls; no identical Filmarks native-app sort options are claimed.",
      "evidence_ids": [
        "F01",
        "F02",
        "U01"
      ]
    },
    {
      "record_id": "OP-022",
      "feature_id": "ai-recs",
      "competitors": [
        "Likewise / Pix"
      ],
      "capability": "Personalized recommendation delivery",
      "competitor_free_behavior": "Daily recommendations",
      "competitor_paid_behavior": "More personalized recommendations; quota unknown",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://pix-media.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Personalized For you discovery, taste ordering and assistant-accessible suggestions.",
      "gap_or_boundary": "No equivalent daily-versus-more recommendation delivery schedule/quota or same candidate quality proved; Pix paid count undocumented. External assistants own chat generation.",
      "evidence_ids": [
        "A01",
        "A02"
      ]
    },
    {
      "record_id": "OP-023",
      "feature_id": "ai-recs",
      "competitors": [
        "Likewise / Pix"
      ],
      "capability": "Instant AI Ask responses",
      "competitor_free_behavior": "Free allowance unknown",
      "competitor_paid_behavior": "Instant responses",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://pix-media.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Descriptive query results and external-assistant recommendations.",
      "gap_or_boundary": "No first-party Ask conversational endpoint or guaranteed instant priority-response service. MCP20 uncached ranked attempts/day and search backpressure remain.",
      "evidence_ids": [
        "A01",
        "A02"
      ]
    },
    {
      "record_id": "OP-027",
      "feature_id": "ai-recs",
      "competitors": [
        "Movie Paradise"
      ],
      "capability": "AI recommendation allowance",
      "competitor_free_behavior": "Daily allowance unspecified",
      "competitor_paid_behavior": "AI recommendations; unlimited not established",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://movieparadise.app/press"
      ],
      "eligible_offer_ids": [
        "PLAN-244",
        "PLAN-245",
        "PLAN-246"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "AI-interpreted descriptive search and MCP smarter matches.",
      "gap_or_boundary": "No Movie Paradise-specific daily AI-chat/advanced-discovery allowance contract. Its numeric paid allowance is undocumented; GoodWatch MCP20/day is ranked attempts, not chat messages.",
      "evidence_ids": [
        "A01",
        "A02"
      ]
    },
    {
      "record_id": "OP-622",
      "feature_id": "ai-recs",
      "competitors": [
        "Watch’n’Roll"
      ],
      "capability": "AI chats per day",
      "competitor_free_behavior": "Free5/day; rewarded ads for more.",
      "competitor_paid_behavior": "Premium explicitly unlimited chats; no monetary price-period inference.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://watchnroll.com/",
        "https://apps.apple.com/us/app/id6760292218",
        "https://play.google.com/store/apps/details?id=com.watchandroll.app"
      ],
      "eligible_offer_ids": [
        "PLAN-446"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "An external AI app can converse using GoodWatch tools; website offers descriptive search.",
      "gap_or_boundary": "No built-in unlimited AI-chat entitlement or rewarded-ad extra chats. MCP20 uncached smarter matches/day is neither five free chats/day nor unlimited paid chat; host quotas are separate.",
      "evidence_ids": [
        "A01",
        "A02"
      ]
    },
    {
      "record_id": "OP-473",
      "feature_id": "reference",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Lookup access after20 searches",
      "competitor_free_behavior": "First20 searches free; reset not established.",
      "competitor_paid_behavior": "Subscription ongoing use; one-week trial; not an AI quota.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "Continuing title/person/cast/crew lookup without Callsheet’s cumulative20-search subscription gate.",
      "gap_or_boundary": "Have covers reference lookup, not every Callsheet integration/fact/native control. Search burst, catalog eligibility and per-person credit query limits apply; no unlimited-search claim.",
      "evidence_ids": [
        "R01",
        "A02"
      ]
    },
    {
      "record_id": "OP-479",
      "feature_id": "reference",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Cast/crew age, runtime/end-time and Live Activity",
      "competitor_free_behavior": "Publisher advertises facts, age at release/current age and Live Activity.",
      "competitor_paid_behavior": "Tools inside overall20free-search/subscription-access model.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Title runtime, release dates/years, season/episode counts and cast/crew filmographies.",
      "gap_or_boundary": "No connected current age/age-at-release calculations, runtime end-time calculator or Apple Live Activity. Each is distinct from displayed runtime/career years.",
      "evidence_ids": [
        "R01",
        "R02",
        "W01"
      ]
    },
    {
      "record_id": "OP-477",
      "feature_id": "reference",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Channels and one-time-login Plex/Jellyfin lookup",
      "competitor_free_behavior": "Publisher advertises integration.",
      "competitor_paid_behavior": "Overall access model; not universal playback-history sync.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Plex connection exists for a finite history/watchlist import preview.",
      "gap_or_boundary": "No Channels/Jellyfin lookup integration or retained one-time Plex-login reference lookup; do not substitute importing for the paid media-info integration.",
      "evidence_ids": [
        "R03"
      ]
    },
    {
      "record_id": "OP-474",
      "feature_id": "spoilers",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Spoiler hiding with per-show overrides",
      "competitor_free_behavior": "Available during free allowance.",
      "competitor_paid_behavior": "Subscription access: character names,episode counts/titles/thumbnails/summaries, global/show override.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Episodes and cast use normal collapsible sections; legacy DNA spoiler code is disabled.",
      "gap_or_boundary": "Missing global/per-show override for character names, episode counts/titles/thumbnails/summaries. Tracking and collapsed panels do not implement that policy.",
      "evidence_ids": [
        "S01"
      ]
    },
    {
      "record_id": "OP-016",
      "feature_id": "result-depth",
      "competitors": [
        "Criticker"
      ],
      "capability": "Trending result count",
      "competitor_free_behavior": "Top20",
      "competitor_paid_behavior": "Top100",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.criticker.com/sponsor/"
      ],
      "eligible_offer_ids": [
        "PLAN-047"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Paginated popularity browse beyond100; real flagged Hot on socials trending reader.",
      "gap_or_boundary": "Current trend publishers emit20 titles despite a reader window40; no100-title trending result path. Popularity pagination is a different object.",
      "evidence_ids": [
        "D01"
      ]
    },
    {
      "record_id": "OP-017",
      "feature_id": "result-depth",
      "competitors": [
        "Criticker"
      ],
      "capability": "Similar-title result completeness",
      "competitor_free_behavior": "Restricted list; size unknown",
      "competitor_paid_behavior": "Full similar-title list",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.criticker.com/sponsor/"
      ],
      "eligible_offer_ids": [
        "PLAN-047"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Fingerprint similarity map starts80, pages further in240-title windows up to page6; MCP exposes80 candidates.",
      "gap_or_boundary": "No untruncated/full similar-title list contract; quality/catalog exclusions and finite paging differ. Criticker full-list size/algorithm undocumented.",
      "evidence_ids": [
        "D02"
      ]
    },
    {
      "record_id": "OP-024",
      "feature_id": "summaries",
      "competitors": [
        "Likewise / Pix"
      ],
      "capability": "Review summaries",
      "competitor_free_behavior": "Free equivalent unknown",
      "competitor_paid_behavior": "Review summaries",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://pix-media.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Templated worth-watching verdict and critic/audience score comparison; synopsis/essence analysis.",
      "gap_or_boundary": "No review-text corpus synthesis/review-summary output. Numeric score verdict is a separate assessed subset, not proof of Pix review-summary parity.",
      "evidence_ids": [
        "U01"
      ]
    },
    {
      "record_id": "OP-345",
      "feature_id": "language",
      "competitors": [
        "SIMKL"
      ],
      "capability": "Preferred anime-title display language",
      "competitor_free_behavior": "Preference unavailable in comparison matrix",
      "competitor_paid_behavior": "Anime list-title choice: English, Romaji or Japanese; not subtitles/audio/UI language",
      "competitor_evidence_status": "PRO docs call setting VIP settings but explicitly describe it under PRO; comparison checks both PRO/VIP; platform enforcement untested",
      "competitor_source_urls": [
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison",
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro"
      ],
      "eligible_offer_ids": [
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020"
      ],
      "context_offer_ids": [
        "PLAN-022"
      ],
      "state": "partial",
      "observed": "Saved title-presentation language includes English/Japanese with translation fallback.",
      "gap_or_boundary": "No Romaji choice or anime-specific override. Metadata language does not promise subtitles/audio or UI translation.",
      "evidence_ids": [
        "L01"
      ]
    },
    {
      "record_id": "OP-439",
      "feature_id": "language",
      "competitors": [
        "Stremio"
      ],
      "capability": "Hide, reorder and rename catalogs",
      "competitor_free_behavior": "Core discovery free; customization baseline unspecified.",
      "competitor_paid_behavior": "Supporter organize/hide/reorder per live plans; rename in June9 launch.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.stremio.com/plans"
      ],
      "eligible_offer_ids": [
        "PLAN-330",
        "PLAN-331",
        "PLAN-332"
      ],
      "context_offer_ids": [
        "PLAN-329"
      ],
      "state": "missing",
      "observed": "Title filtering, title hiding and fixed Explorer/Discover layouts exist.",
      "gap_or_boundary": "No user catalog hide/reorder/rename settings/writer. Title Not interested is not a catalog section control.",
      "evidence_ids": [
        "L02"
      ]
    },
    {
      "record_id": "OP-440",
      "feature_id": "language",
      "competitors": [
        "Stremio"
      ],
      "capability": "Cinemeta language and recommendation/catalog configuration",
      "competitor_free_behavior": "Core discovery free.",
      "competitor_paid_behavior": "Supporter language/recommendation/catalog configuration; June launch135 catalog choices, personalized/local watched/loved/kids catalogs.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.stremio.com/plans"
      ],
      "eligible_offer_ids": [
        "PLAN-330",
        "PLAN-331",
        "PLAN-332"
      ],
      "context_offer_ids": [
        "PLAN-329"
      ],
      "state": "partial",
      "observed": "Saved title language and a For you setting; age/content filters.",
      "gap_or_boundary": "No Cinemeta/addon/catalog configuration,135 catalog selector or local/watched/loved/kids catalog ecosystem. Age filtering is not configured kids catalogs/profiles.",
      "evidence_ids": [
        "L01",
        "L02",
        "F01"
      ]
    },
    {
      "record_id": "OP-572",
      "feature_id": "language",
      "competitors": [
        "Flickchart"
      ],
      "capability": "Streamer and vintage modes",
      "competitor_free_behavior": "Baseline ranking.",
      "competitor_paid_behavior": "VIP modes; exact controls need verification.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Web TV/ordinary display and share-card themes exist.",
      "gap_or_boundary": "No pairwise matchup streamer-mode decluttering or whole-site vintage mode. Move streamer mode to ranking/presentation; vintage mode to cosmetic presentation rather than language.",
      "evidence_ids": [
        "L02",
        "K01"
      ]
    },
    {
      "record_id": "OP-223",
      "feature_id": "ranking-stats",
      "competitors": [
        "Criticker"
      ],
      "capability": "Top100 completion",
      "competitor_free_behavior": "Basic recommendations/first charts",
      "competitor_paid_behavior": "Top100-list completion",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.criticker.com/sponsor/"
      ],
      "eligible_offer_ids": [
        "PLAN-047"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Public best-of lists and personal Seen status exist separately.",
      "gap_or_boundary": "No personal Top100-list completion percentage/count/join or comparison view. A250-row public list is not top100 completion analytics.",
      "evidence_ids": [
        "T01"
      ]
    },
    {
      "record_id": "OP-224",
      "feature_id": "ranking-stats",
      "competitors": [
        "Criticker"
      ],
      "capability": "Historical title percentiles",
      "competitor_free_behavior": "Basic recommendations/first charts",
      "competitor_paid_behavior": "Percentile charts over time",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.criticker.com/sponsor/"
      ],
      "eligible_offer_ids": [
        "PLAN-047"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Current taste percentiles and current aggregate-score comparisons.",
      "gap_or_boundary": "No historical title percentile/ranking time-series chart; current percentile is not historical rank data.",
      "evidence_ids": [
        "T01"
      ]
    },
    {
      "record_id": "OP-571",
      "feature_id": "ranking-stats",
      "competitors": [
        "Flickchart"
      ],
      "capability": "Deeper ranking analytics",
      "competitor_free_behavior": "Head-to-head ranking available.",
      "competitor_paid_behavior": "VIP analytics; not personal predicted-score accuracy.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Current taste/genre/attribute breakdowns, agreement and personal-versus-aggregate rating gaps.",
      "gap_or_boundary": "No head-to-head ranking history analytics or historical pairwise changes; Flickchart full advanced metric list undocumented. Rewind remains Coming Soon, not an additional active requirement.",
      "evidence_ids": [
        "T01",
        "K01"
      ]
    },
    {
      "record_id": "OP-143",
      "feature_id": "people-alerts",
      "competitors": [
        "Next Episode"
      ],
      "capability": "Follow actors/creators/channels",
      "competitor_free_behavior": "Ordinary discovery",
      "competitor_paid_behavior": "Follow people/channels for updates",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://next-episode.net/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-063"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Person filmography filtering and title-based release/availability signals.",
      "gap_or_boundary": "No actor/creator/channel follow collection, subscription mutation or updates triggered by followed creator releases.",
      "evidence_ids": [
        "P01"
      ]
    },
    {
      "record_id": "OP-511",
      "feature_id": "people-alerts",
      "competitors": [
        "MDBList / Reeel"
      ],
      "capability": "Favorite cast count",
      "competitor_free_behavior": "Free: 20.",
      "competitor_paid_behavior": "Basic: 35; Standard: 50; Plus: 75; VIP5: 100; VIP10: 200; VIP15: 300; VIP20: 500. Separate object-specific caps; no aggregate conflation.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.memberful.com/join?splash=1",
        "https://docs.mdblist.com/docs/api"
      ],
      "eligible_offer_ids": [
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395"
      ],
      "context_offer_ids": [
        "PLAN-396",
        "PLAN-397",
        "PLAN-398",
        "PLAN-399",
        "PLAN-400",
        "PLAN-401",
        "PLAN-402",
        "PLAN-403"
      ],
      "state": "missing",
      "observed": "People browsing/search only; title favorites are not cast favorites.",
      "gap_or_boundary": "No favorite-cast collection/cap: vendor Free20, Basic35, Standard50, Plus75, VIP5/10/15/20=100/200/300/500 remain unmatched object-specific capacities.",
      "evidence_ids": [
        "P01"
      ]
    },
    {
      "record_id": "OP-163",
      "feature_id": "api",
      "competitors": [
        "TVmaze"
      ],
      "capability": "Member read/write API",
      "competitor_free_behavior": "Public catalog API separate",
      "competitor_paid_behavior": "User API",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.tvmaze.com/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-057",
        "PLAN-058",
        "PLAN-059",
        "PLAN-060",
        "PLAN-061",
        "PLAN-062"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "OAuth MCP supports personal read/write library, ratings, watches and settings.",
      "gap_or_boundary": "Exact TVmaze REST user API missing; GoodWatch MCP is a real substitute for overlapping member operations, not the same catalog/schedule/user data contract.",
      "evidence_ids": [
        "X01",
        "X02",
        "X03"
      ]
    },
    {
      "record_id": "OP-164",
      "feature_id": "api",
      "competitors": [
        "SIMKL"
      ],
      "capability": "Connected-app requests/day",
      "competitor_free_behavior": "500/day",
      "competitor_paid_behavior": "PRO1000; VIP10000; cached requests excluded",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://simkl.com/vip/"
      ],
      "eligible_offer_ids": [
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020"
      ],
      "context_offer_ids": [
        "PLAN-022"
      ],
      "state": "partial",
      "observed": "Authenticated MCP calls with member-scoped request windows and separate ranked allowance.",
      "gap_or_boundary": "SIMKL noncached requests/day500/1000/10000 and API operations are not replicated. GoodWatch60/min1000/hour overall,20 uncached ranked attempts/day; do not compare only20 to10000 or promise an inferred daily maximum.",
      "evidence_ids": [
        "X01",
        "X02"
      ]
    },
    {
      "record_id": "OP-165",
      "feature_id": "api",
      "competitors": [
        "Trakt"
      ],
      "capability": "Community app count",
      "competitor_free_behavior": "July announcement1 community app; official excluded; old extras may persist",
      "competitor_paid_behavior": "Multi-app; VIP max unknown",
      "competitor_evidence_status": "Dated announcement,not October counter",
      "competitor_source_urls": [
        "https://forums.trakt.tv/t/an-update-to-community-app-connections/117898"
      ],
      "eligible_offer_ids": [
        "PLAN-009",
        "PLAN-010"
      ],
      "context_offer_ids": [
        "PLAN-514"
      ],
      "state": "have",
      "observed": "Multiple app/computer grants with listed scopes,last-use and individual disconnect, without a subscription gate.",
      "gap_or_boundary": "Not unlimited:128 OAuth consent rows/member,1024 access-token and refresh-token rows each,20 sessions; rows are not distinct-app count. Dynamic registrations30/hour/IP. Trakt VIP upper cap undocumented and legacy free extra-app exceptions remain source caveats.",
      "evidence_ids": [
        "X03",
        "X01"
      ]
    },
    {
      "record_id": "OP-501",
      "feature_id": "api",
      "competitors": [
        "MDBList / Reeel"
      ],
      "capability": "API daily requests",
      "competitor_free_behavior": "Free: 1000.",
      "competitor_paid_behavior": "Basic: 10000; Standard: 25000; Plus: 100000; VIP5: 250000; VIP10: 500000; VIP15: 1000000; VIP20: 1500000. Separate object-specific caps; no aggregate conflation.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.memberful.com/join?splash=1",
        "https://docs.mdblist.com/docs/api"
      ],
      "eligible_offer_ids": [
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395"
      ],
      "context_offer_ids": [
        "PLAN-396",
        "PLAN-397",
        "PLAN-398",
        "PLAN-399",
        "PLAN-400",
        "PLAN-401",
        "PLAN-402",
        "PLAN-403"
      ],
      "state": "partial",
      "observed": "Member MCP read/write interface and rate controls.",
      "gap_or_boundary": "No MDBList list/metadata developer API contract or its1k/10k/25k/100k/250k/500k/1m/1.5m daily allowances. Its shared burst windows also differ. GoodWatch MCP request windows/20 ranked attempts are different dimensions.",
      "evidence_ids": [
        "X01",
        "X02"
      ]
    },
    {
      "record_id": "OP-654",
      "feature_id": "api",
      "competitors": [
        "Libib"
      ],
      "capability": "REST API access",
      "competitor_free_behavior": "Basic CSV export already free.",
      "competitor_paid_behavior": "Pro account-owner key;1request/2seconds; Ultimate additional scoped keys.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.libib.com/pricing",
        "https://support.libib.com/faqs.html",
        "https://support.libib.com/rest-api/introduction.html"
      ],
      "eligible_offer_ids": [
        "PLAN-468",
        "PLAN-469",
        "PLAN-472"
      ],
      "context_offer_ids": [
        "PLAN-470",
        "PLAN-471",
        "PLAN-473",
        "PLAN-474",
        "PLAN-512"
      ],
      "state": "partial",
      "observed": "OAuth MCP delegates access to overlapping personal media data.",
      "gap_or_boundary": "No Libib owner API-key REST catalog/lending API or Ultimate additional scoped keys. mcp:read/mcp:write scopes are a substitute permission dimension, not Libib collection/key scope;1request/2seconds is a different contract/window.",
      "evidence_ids": [
        "X01",
        "X02",
        "X03"
      ]
    },
    {
      "record_id": "OP-167",
      "feature_id": "widgets",
      "competitors": [
        "Hobi"
      ],
      "capability": "Home-screen widget",
      "competitor_free_behavior": "Basic app",
      "competitor_paid_behavior": "Widget",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://hobiapp.com/help/what-hobi-premium-includes"
      ],
      "eligible_offer_ids": [
        "PLAN-152",
        "PLAN-153",
        "PLAN-154",
        "PLAN-299"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected Hobi native home-screen widget. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-168",
      "feature_id": "widgets",
      "competitors": [
        "Sequel"
      ],
      "capability": "Advanced countdown/Watch Next widgets",
      "competitor_free_behavior": "Quick-access widget",
      "competitor_paid_behavior": "Advanced widgets",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://apps.apple.com/us/app/sequel-media-tracker/id1630746993"
      ],
      "eligible_offer_ids": [
        "PLAN-086",
        "PLAN-087",
        "PLAN-088",
        "PLAN-089",
        "PLAN-090",
        "PLAN-091",
        "PLAN-092",
        "PLAN-093",
        "PLAN-094",
        "PLAN-095",
        "PLAN-096",
        "PLAN-097"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected Sequel advanced countdown/Watch Next widgets; free quick-access widget is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-169",
      "feature_id": "widgets",
      "competitors": [
        "SeriesGuide"
      ],
      "capability": "Expanded list widget",
      "competitor_free_behavior": "Basic widget",
      "competitor_paid_behavior": "Contents/transparency",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.seriesgui.de/whypay"
      ],
      "eligible_offer_ids": [
        "PLAN-079",
        "PLAN-302"
      ],
      "context_offer_ids": [
        "PLAN-080"
      ],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected SeriesGuide expanded list widget contents/transparency. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-170",
      "feature_id": "widgets",
      "competitors": [
        "SeriesGuide"
      ],
      "capability": "Home-screen shortcuts",
      "competitor_free_behavior": "Ordinary tracker",
      "competitor_paid_behavior": "Show shortcuts",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.seriesgui.de/whypay"
      ],
      "eligible_offer_ids": [
        "PLAN-079",
        "PLAN-302"
      ],
      "context_offer_ids": [
        "PLAN-080"
      ],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected SeriesGuide per-show home-screen shortcuts. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-171",
      "feature_id": "widgets",
      "competitors": [
        "FilmNoir",
        "Sofa Time"
      ],
      "capability": "Premium widgets",
      "competitor_free_behavior": "Basic widget/Up Next",
      "competitor_paid_behavior": "Advanced widgets",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.filmnoir.app/",
        "https://www.reddit.com/r/TVTime/comments/1vgdhzq/sofa_time_full_feature_breakdown_tv_time_import/"
      ],
      "eligible_offer_ids": [
        "PLAN-161",
        "PLAN-162",
        "PLAN-163",
        "PLAN-164",
        "PLAN-165",
        "PLAN-166",
        "PLAN-167",
        "PLAN-168",
        "PLAN-169",
        "PLAN-170",
        "PLAN-171",
        "PLAN-172"
      ],
      "context_offer_ids": [
        "PLAN-175",
        "PLAN-176",
        "PLAN-177",
        "PLAN-178",
        "PLAN-179",
        "PLAN-180",
        "PLAN-181",
        "PLAN-182"
      ],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected FilmNoir and Sofa Time premium/advanced widgets; their free widget/Up Next baseline is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ],
      "product_dispositions": [
        {
          "competitor": "FilmNoir",
          "state": "missing",
          "scope_note": "No connected FilmNoir and Sofa Time premium/advanced widgets; their free widget/Up Next baseline is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces."
        },
        {
          "competitor": "Sofa Time",
          "state": "missing",
          "scope_note": "No connected FilmNoir and Sofa Time premium/advanced widgets; their free widget/Up Next baseline is separate. Web manifest, share-card themes and MCP poster views are different platform surfaces."
        }
      ]
    },
    {
      "record_id": "OP-172",
      "feature_id": "widgets",
      "competitors": [
        "Showly"
      ],
      "capability": "Transparent widgets",
      "competitor_free_behavior": "Basic widget",
      "competitor_paid_behavior": "Transparent Android widgets",
      "competitor_evidence_status": "Source-level; not installed build proof",
      "competitor_source_urls": [
        "https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml",
        "https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml"
      ],
      "eligible_offer_ids": [
        "PLAN-078"
      ],
      "context_offer_ids": [
        "PLAN-075",
        "PLAN-076",
        "PLAN-077"
      ],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected Showly transparent Android widgets; platform-qualified publisher-source gate retained. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-476",
      "feature_id": "widgets",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Search/media-info Shortcuts",
      "competitor_free_behavior": "Within free allowance; release2026.3.",
      "competitor_paid_behavior": "Part of overall subscription access.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Standalone browser icon/web navigation and external MCP tools exist.",
      "gap_or_boundary": "No connected Callsheet Apple Shortcuts search/media-info actions, released2026.3. Web manifest, share-card themes and MCP poster views are different platform surfaces.",
      "evidence_ids": [
        "W01",
        "W02"
      ]
    },
    {
      "record_id": "OP-569",
      "feature_id": "widgets",
      "competitors": [
        "Flickchart"
      ],
      "capability": "Embeddable updating widgets",
      "competitor_free_behavior": "No baseline entitlement established.",
      "competitor_paid_behavior": "VIP auto-updating embed widgets.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Updating public five-title share-card image/link and MCP Apps rich poster output.",
      "gap_or_boundary": "No customizable auto-updating blog/site embed for movie rankings, most-wanted, reviews and yearly favorites; no embed-code/configuration flow. MCP host widget and og:image are separately bounded subsets.",
      "evidence_ids": [
        "W02"
      ]
    },
    {
      "record_id": "OP-570",
      "feature_id": "keyboard",
      "competitors": [
        "Flickchart"
      ],
      "capability": "Keyboard ranking controls",
      "competitor_free_behavior": "Baseline ranking.",
      "competitor_paid_behavior": "VIP keyboard controls.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "context_offer_ids": [],
      "state": "missing",
      "observed": "Numeric rating buttons and normal keyboard/TV-remote navigation.",
      "gap_or_boundary": "No configurable keys for pairwise winner/loser/skip ranking; no connected pairwise-comparison state/writer.",
      "evidence_ids": [
        "K01"
      ]
    },
    {
      "record_id": "OP-494",
      "feature_id": "metadata-refresh",
      "competitors": [
        "MyEpisodes"
      ],
      "capability": "Trigger metadata refresh",
      "competitor_free_behavior": "Normal refresh.",
      "competitor_paid_behavior": "VIP metadata-refresh trigger, not predicted-rating recalculation.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://tv.myepisodes.com/donate/",
        "https://www.patreon.com/myepisodes/membership"
      ],
      "eligible_offer_ids": [
        "PLAN-378",
        "PLAN-379",
        "PLAN-380",
        "PLAN-381"
      ],
      "context_offer_ids": [
        "PLAN-376",
        "PLAN-377"
      ],
      "state": "missing",
      "observed": "Automatic catalog/refetch jobs and detail cache revalidation.",
      "gap_or_boundary": "No member-triggered upstream catalog metadata refresh button/request writer; refreshing a page/cache or internal prediction rebuild does not supply it.",
      "evidence_ids": [
        "M01"
      ]
    },
    {
      "record_id": "OP-204",
      "feature_id": "ads",
      "competitors": [
        "JustWatch"
      ],
      "capability": "Banner removal",
      "competitor_free_behavior": "Banners",
      "competitor_paid_behavior": "Remove banners; sponsored recommendations remain",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://support.justwatch.com/article/just-watchs-terms-of-use"
      ],
      "eligible_offer_ids": [
        "PLAN-007",
        "PLAN-008",
        "PLAN-293",
        "PLAN-294"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "JustWatch banner removal (sponsored recommendations explicitly remain there). Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-205",
      "feature_id": "ads",
      "competitors": [
        "Letterboxd"
      ],
      "capability": "Third-party ads/tracking removal",
      "competitor_free_behavior": "Third-party ads",
      "competitor_paid_behavior": "Remove third-party ads/tracking; own promotions not expressly covered",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://letterboxd.com/about/pro/"
      ],
      "eligible_offer_ids": [
        "PLAN-023",
        "PLAN-024",
        "PLAN-025",
        "PLAN-026",
        "PLAN-295",
        "PLAN-296",
        "PLAN-297",
        "PLAN-298"
      ],
      "context_offer_ids": [
        "PLAN-027",
        "PLAN-028"
      ],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Letterboxd third-party ads AND their associated ad tracking removed (not a blanket ban on product analytics). Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD02",
        "AD03"
      ],
      "vendor_source_clarification": "Live official page says removal of third-party ads and ASSOCIATED tracking; not all product analytics. Accessed2026-10-19; no source update date supplied."
    },
    {
      "record_id": "OP-206",
      "feature_id": "ads",
      "competitors": [
        "MyAnimeList"
      ],
      "capability": "Display-ad removal with exceptions",
      "competitor_free_behavior": "Display ads",
      "competitor_paid_behavior": "Embedded video/advertorials remain",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://myanimelist.net/membership/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-220",
        "PLAN-221",
        "PLAN-222",
        "PLAN-223"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "MyAnimeList display-ad removal excluding embedded-video/advertorial scope. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-207",
      "feature_id": "ads",
      "competitors": [
        "MyShows"
      ],
      "capability": "Banner removal retaining legal-stream links",
      "competitor_free_behavior": "Banners",
      "competitor_paid_behavior": "Banners removed; legal-streaming links remain",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://en.myshows.me/pro/"
      ],
      "eligible_offer_ids": [
        "PLAN-069",
        "PLAN-070",
        "PLAN-071"
      ],
      "context_offer_ids": [
        "PLAN-072",
        "PLAN-073",
        "PLAN-074"
      ],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "MyShows banner removal while legal streaming links remain. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-208",
      "feature_id": "ads",
      "competitors": [
        "SIMKL",
        "Criticker",
        "Serializd",
        "Bingers"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Ad-supported baseline",
      "competitor_paid_behavior": "Ad removal; exact surface coverage untested",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro",
        "https://www.criticker.com/sponsor/",
        "https://www.patreon.com/Serializd/membership",
        "https://bingers.app/terms"
      ],
      "eligible_offer_ids": [
        "PLAN-017",
        "PLAN-018",
        "PLAN-019",
        "PLAN-020",
        "PLAN-029",
        "PLAN-030",
        "PLAN-031",
        "PLAN-032",
        "PLAN-033",
        "PLAN-034",
        "PLAN-035",
        "PLAN-036",
        "PLAN-037",
        "PLAN-038",
        "PLAN-039",
        "PLAN-040",
        "PLAN-041",
        "PLAN-042",
        "PLAN-043",
        "PLAN-044",
        "PLAN-045",
        "PLAN-046",
        "PLAN-047",
        "PLAN-056"
      ],
      "context_offer_ids": [
        "PLAN-022",
        "PLAN-050",
        "PLAN-051",
        "PLAN-052",
        "PLAN-053",
        "PLAN-054",
        "PLAN-055"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ],
      "product_dispositions": [
        {
          "competitor": "SIMKL",
          "state": "partial",
          "scope_note": "SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Criticker",
          "state": "partial",
          "scope_note": "SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Serializd",
          "state": "partial",
          "scope_note": "SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Bingers",
          "state": "partial",
          "scope_note": "SIMKL/PRO-VIP; Criticker/Sponsor; Serializd/Fan+; Bingers/Premium: broad ad-removal wording, precise surfaces unverified for each. Each has the same bounded GoodWatch web-display subset; none inherits another product’s native/all-ads scope. External frames/linked providers are outside this code guarantee."
        }
      ]
    },
    {
      "record_id": "OP-209",
      "feature_id": "ads",
      "competitors": [
        "TVmaze"
      ],
      "capability": "Ad/tracking removal",
      "competitor_free_behavior": "Ads",
      "competitor_paid_behavior": "No ads/tracking",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://www.tvmaze.com/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-057",
        "PLAN-058",
        "PLAN-059",
        "PLAN-060",
        "PLAN-061",
        "PLAN-062"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "Inspected GoodWatch-owned browser display surfaces have no banner-ad integration.",
      "gap_or_boundary": "TVmaze combines ad and tracking removal: GoodWatch still initializes PostHog/Sentry and identity/event capture, and embeds have outside behavior. No exact no-tracking equivalent. Own service promotions are not silently included in third-party removal.",
      "evidence_ids": [
        "AD01",
        "AD02",
        "AD03"
      ]
    },
    {
      "record_id": "OP-210",
      "feature_id": "ads",
      "competitors": [
        "Moviebase",
        "Movie Paradise",
        "Likewise / Pix",
        "Suite TV"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Ads; Suite secondary screens",
      "competitor_paid_behavior": "Ad removal",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://moviebase.app/faq",
        "https://movieparadise.app/faq",
        "https://pix-media.com/faq",
        "https://www.suitetv.app/en/about"
      ],
      "eligible_offer_ids": [
        "PLAN-127",
        "PLAN-128",
        "PLAN-137",
        "PLAN-138",
        "PLAN-139",
        "PLAN-140",
        "PLAN-141",
        "PLAN-142",
        "PLAN-144",
        "PLAN-146",
        "PLAN-148",
        "PLAN-150",
        "PLAN-234",
        "PLAN-235",
        "PLAN-236",
        "PLAN-237",
        "PLAN-238",
        "PLAN-239",
        "PLAN-244",
        "PLAN-245",
        "PLAN-246",
        "PLAN-303",
        "PLAN-304",
        "PLAN-305"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ],
      "product_dispositions": [
        {
          "competitor": "Moviebase",
          "state": "partial",
          "scope_note": "Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Movie Paradise",
          "state": "partial",
          "scope_note": "Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Likewise / Pix",
          "state": "partial",
          "scope_note": "Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee."
        },
        {
          "competitor": "Suite TV",
          "state": "partial",
          "scope_note": "Moviebase/Premium; Movie Paradise/Premium; Likewise-Pix/Plus; SuiteTV/Gold: each ad-removal record has the same web-display subset. Native/all-ads entitlement and embedded behavior cannot be generalized between them. External frames/linked providers are outside this code guarantee."
        }
      ]
    },
    {
      "record_id": "OP-211",
      "feature_id": "ads",
      "competitors": [
        "Queue"
      ],
      "capability": "iOS ad removal",
      "competitor_free_behavior": "iOS ads",
      "competitor_paid_behavior": "No ads; iOS only as of May13 reply",
      "competitor_evidence_status": "Current Android status unknown",
      "competitor_source_urls": [
        "https://www.reddit.com/r/queueapp/comments/1tavyba/search_suggestions_more/"
      ],
      "eligible_offer_ids": [
        "PLAN-121",
        "PLAN-122",
        "PLAN-123",
        "PLAN-124",
        "PLAN-125"
      ],
      "context_offer_ids": [
        "PLAN-119",
        "PLAN-120",
        "PLAN-126"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Queue+ benefit documented iOS-only as of developer May13 reply; no GoodWatch iOS app/ad-removal path; Android gate unknown. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-347",
      "feature_id": "ads",
      "competitors": [
        "Next Episode"
      ],
      "capability": "Website ad removal",
      "competitor_free_behavior": "Advertising on ordinary website",
      "competitor_paid_behavior": "Website Premium removes ads; mobile purchase allocation not established",
      "competitor_evidence_status": "Documented,not exercised; only stated gate attributed to paid",
      "competitor_source_urls": [
        "https://next-episode.net/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-063"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Next Episode website display-ad removal; mobile allocation is separate. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-348",
      "feature_id": "ads",
      "competitors": [
        "CineTrak"
      ],
      "capability": "One-time Premium ad removal",
      "competitor_free_behavior": "Free download contains ads.",
      "competitor_paid_behavior": "Regional publisher text attaches ad removal to one-time Premium; latest English text omits matrix. Amount/currency unknown.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.reddit.com/r/cinetrak/comments/1wfkver/cinetrak_is_back/",
        "https://play.google.com/store/apps/details?hl=fil&id=com.cinetrak.mobile"
      ],
      "eligible_offer_ids": [
        "PLAN-151"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "CineTrak one-time Premium native ad removal: regional publisher text supports it but latest English text omits the matrix; no GoodWatch Android app path. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-394",
      "feature_id": "ads",
      "competitors": [
        "StreamGuide (Christian Krueger)"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "FAQ says free ads.",
      "competitor_paid_behavior": "April15/May15 guide explicitly Premium ad-free; current FAQ omits benefit.",
      "competitor_evidence_status": "conflicting_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://streamguide.app/faq",
        "https://streamguide.app/resources/getting-started-with-streamguide"
      ],
      "eligible_offer_ids": [
        "PLAN-308",
        "PLAN-309",
        "PLAN-310",
        "PLAN-311",
        "PLAN-312"
      ],
      "context_offer_ids": [
        "PLAN-313"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "StreamGuide native Premium ad-free guide versus FAQ omission remains a vendor conflict; no equivalent GoodWatch native app scope. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-406",
      "feature_id": "ads",
      "competitors": [
        "Watch Next: AI Streaming Guide (Frulli)"
      ],
      "capability": "Remove Ads purchase",
      "competitor_free_behavior": "Ads present.",
      "competitor_paid_behavior": "US Apple Remove Ads USD1.99; purchase type/duration unknown. Android mapping not established.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://apps.apple.com/us/app/watch-next-ai-streaming-guide/id6450368827"
      ],
      "eligible_offer_ids": [
        "PLAN-317"
      ],
      "context_offer_ids": [
        "PLAN-318"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Frulli Watch Next Remove Ads Apple SKU1.99, duration/type and Android mapping unknown; no GoodWatch Apple-native app scope. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-410",
      "feature_id": "ads",
      "competitors": [
        "WatchNext.app"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Free includes ads.",
      "competitor_paid_behavior": "Premium and Unlimited ad-free.",
      "competitor_evidence_status": "conflicting_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://watchnext.app/faq",
        "https://watchnext.app/terms"
      ],
      "eligible_offer_ids": [
        "PLAN-324",
        "PLAN-325",
        "PLAN-326",
        "PLAN-327"
      ],
      "context_offer_ids": [
        "PLAN-323"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "WatchNext.app Premium/Unlimited broad ad-free promise: GoodWatch embeds retain outside behavior and full-surface equivalence is not established. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-478",
      "feature_id": "ads",
      "competitors": [
        "Callsheet"
      ],
      "capability": "Ad-free reference experience",
      "competitor_free_behavior": "Publisher says no ads;20search trial allowance.",
      "competitor_paid_behavior": "No separate ad-removal upgrade.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "eligible_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Callsheet advertises an ad-free reference app as a whole, not a separate ad-removal purchase; GoodWatch reference pages have outside video/social embed paths and no Apple-native app. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-481",
      "feature_id": "ads",
      "competitors": [
        "TV Show & Movie Tracker / TVST (Jonathan ANTOINE)"
      ],
      "capability": "Remove ads",
      "competitor_free_behavior": "Free main features.",
      "competitor_paid_behavior": "Explicit individual Remove Ads SKU; duration unknown.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://apps.apple.com/us/app/id1228141510",
        "https://apps.apple.com/fr/app/tv-shows-movies-tracker/id1228141510"
      ],
      "eligible_offer_ids": [
        "PLAN-364",
        "PLAN-370"
      ],
      "context_offer_ids": [
        "PLAN-365",
        "PLAN-366",
        "PLAN-367",
        "PLAN-368",
        "PLAN-369",
        "PLAN-371",
        "PLAN-372",
        "PLAN-373",
        "PLAN-374"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Jonathan ANTOINE TVST Remove Ads native SKU; no GoodWatch native app and vendor SKU period unknown. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-487",
      "feature_id": "ads",
      "competitors": [
        "TV Episode Calendar / EpisodeCalendar"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Basic ads.",
      "competitor_paid_behavior": "Premium removes ads.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://episodecalendar.com/en/pages/features",
        "https://episodecalendar.com/en/pages/premium"
      ],
      "eligible_offer_ids": [
        "PLAN-375"
      ],
      "context_offer_ids": [
        "PLAN-511"
      ],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "TV Episode Calendar Premium broad ad removal: app-owned web display subset verified; universal embedded-video behavior not established. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-553",
      "feature_id": "ads",
      "competitors": [
        "Bingebase"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Baseline ads.",
      "competitor_paid_behavior": "PRO removes ads.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://bingebase.com/pro",
        "https://bingebase.com/roadmap/shipped"
      ],
      "eligible_offer_ids": [
        "PLAN-411",
        "PLAN-412",
        "PLAN-413",
        "PLAN-414"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Bingebase PRO ad removal: app-owned web display subset verified; native/all-ads scope not replicated. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-565",
      "feature_id": "ads",
      "competitors": [
        "Flickchart"
      ],
      "capability": "Banner-ad removal",
      "competitor_free_behavior": "General site tools; free caps unknown.",
      "competitor_paid_behavior": "VIP removes banner ads.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "eligible_offer_ids": [
        "PLAN-417",
        "PLAN-418"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Flickchart banner-ad removal. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-579",
      "feature_id": "ads",
      "competitors": [
        "WerStreamt.es"
      ],
      "capability": "Banner/video ad removal",
      "competitor_free_behavior": "Free availability search/email alerts.",
      "competitor_paid_behavior": "Pro removes banner/video ads.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.werstreamt.es/pro/",
        "https://www.werstreamt.es/"
      ],
      "eligible_offer_ids": [
        "PLAN-420",
        "PLAN-421",
        "PLAN-422",
        "PLAN-423"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "WerStreamt.es Pro banner AND video ad removal: own browser banners absent; no mechanism suppresses vendor video-frame ads. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-590",
      "feature_id": "ads",
      "competitors": [
        "Upflix"
      ],
      "capability": "Remove ads and tracking",
      "competitor_free_behavior": "Free information/ad-supported website.",
      "competitor_paid_behavior": "Site says one-time removal; USApple1.99 SKU duration not printed; separate new Premium subscriptions not assumed identical.",
      "competitor_evidence_status": "conflicting_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.upflix.net/",
        "https://apps.apple.com/us/app/id562782540"
      ],
      "eligible_offer_ids": [
        "PLAN-424"
      ],
      "context_offer_ids": [
        "PLAN-425",
        "PLAN-426",
        "PLAN-427"
      ],
      "state": "partial",
      "observed": "Inspected GoodWatch-owned browser display surfaces have no banner-ad integration.",
      "gap_or_boundary": "Upflix combines ad and tracking removal: GoodWatch still initializes PostHog/Sentry and identity/event capture, and embeds have outside behavior. No exact no-tracking equivalent. Upflix one-time-removal versus new Premium subscription allocation remains unverified; do not merge SKUs.",
      "evidence_ids": [
        "AD01",
        "AD02",
        "AD03"
      ]
    },
    {
      "record_id": "OP-596",
      "feature_id": "ads",
      "competitors": [
        "AlloCiné"
      ],
      "capability": "In-app ad removal",
      "competitor_free_behavior": "Free account tracking/community.",
      "competitor_paid_behavior": "Premium in-app ad removal.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863"
      ],
      "eligible_offer_ids": [
        "PLAN-428",
        "PLAN-429"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "AlloCiné Premium IN-APP removal: own GoodWatch web display subset only, no native app parity. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-600",
      "feature_id": "ads",
      "competitors": [
        "Filmweb.pl"
      ],
      "capability": "Ad removal with native-app conflict",
      "competitor_free_behavior": "Free ratings/recommendations/community.",
      "competitor_paid_behavior": "Filmweb+ marketing includes native app; regulations exclude non-browser apps and sponsored/editorial/own promotion.",
      "competitor_evidence_status": "conflicting_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.filmweb.pl/plus",
        "https://www.filmweb.pl/plus/regulations"
      ],
      "eligible_offer_ids": [
        "PLAN-430",
        "PLAN-431",
        "PLAN-432"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Filmweb+ marketing includes native app while regulations exclude non-browser apps and sponsored/editorial/own promotion; keep both. GoodWatch-owned browser display subset exists, no native promise. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-605",
      "feature_id": "ads",
      "competitors": [
        "Filmarks"
      ],
      "capability": "Partial ad removal",
      "competitor_free_behavior": "Baseline ads.",
      "competitor_paid_behavior": "Premium removes some ads, not a blanket no-ads promise.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://filmarks.zendesk.com/hc/ja/articles/360053383653",
        "https://filmarks.zendesk.com/hc/ja/articles/360052601594"
      ],
      "eligible_offer_ids": [
        "PLAN-433"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Filmarks partial ad removal, not all ads everywhere. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-607",
      "feature_id": "ads",
      "competitors": [
        "Anime-Planet"
      ],
      "capability": "Ad-free website",
      "competitor_free_behavior": "Free tracking/recommendations; Tip Jar has no ad-removal allocation.",
      "competitor_paid_behavior": "Bronze/Silver/Gold ad-free website; no extra licensed video/chapter content.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.anime-planet.com/about",
        "https://www.patreon.com/animeplanet/membership"
      ],
      "eligible_offer_ids": [
        "PLAN-436",
        "PLAN-437",
        "PLAN-438",
        "PLAN-439",
        "PLAN-440",
        "PLAN-441"
      ],
      "context_offer_ids": [
        "PLAN-434",
        "PLAN-435"
      ],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Anime-Planet ad-free website browsing, excluding additional licensed playback/content. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-611",
      "feature_id": "ads",
      "competitors": [
        "Annict / アニクト"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Free account core.",
      "competitor_paid_behavior": "Supporter ad removal.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://annict.com/supporters",
        "https://annict.com/legal"
      ],
      "eligible_offer_ids": [
        "PLAN-442",
        "PLAN-443"
      ],
      "context_offer_ids": [],
      "state": "have",
      "observed": "No app-owned web banner/ad-slot integration in inspected shell and connected consumer pages.",
      "gap_or_boundary": "Annict supporter removal on ordinary website display surfaces. Scope is equivalent web display outcome without payment. Outside video/social frames, provider link destinations and native versions are excluded; no universal no-tracking claim.",
      "evidence_ids": [
        "AD01",
        "AD03"
      ]
    },
    {
      "record_id": "OP-619",
      "feature_id": "ads",
      "competitors": [
        "Flickz"
      ],
      "capability": "Ad-free Watch Together",
      "competitor_free_behavior": "Group matching advertised; free ad/cap boundary incomplete.",
      "competitor_paid_behavior": "Premium ad-free group experience.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://flickz.app/"
      ],
      "eligible_offer_ids": [
        "PLAN-444",
        "PLAN-445"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Flickz Premium ad-free Watch Together: own browser display subset only; no equivalent native/group playback or group-matching ad-control path. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-623",
      "feature_id": "ads",
      "competitors": [
        "Watch’n’Roll"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Free ads/rewards.",
      "competitor_paid_behavior": "Premium ad-free.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://watchnroll.com/",
        "https://apps.apple.com/us/app/id6760292218",
        "https://play.google.com/store/apps/details?id=com.watchandroll.app"
      ],
      "eligible_offer_ids": [
        "PLAN-446"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Watch’n’Roll Premium ad-free native/group chat experience: web-display subset only; no native or rewarded-ad-to-Premium path. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-626",
      "feature_id": "ads",
      "competitors": [
        "Mooveenite"
      ],
      "capability": "Ad removal",
      "competitor_free_behavior": "Free ads.",
      "competitor_paid_behavior": "Premium removes ads; future exclusive features unspecified.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://play.google.com/store/apps/details?id=com.jonumalabs.mooveenite"
      ],
      "eligible_offer_ids": [
        "PLAN-447"
      ],
      "context_offer_ids": [],
      "state": "partial",
      "observed": "No app-owned web banner/ad-slot integration on inspected browser surfaces.",
      "gap_or_boundary": "Mooveenite Premium ad-free swipe/group experience: web-display subset only; no equivalent native group/swipe session. External frames/linked providers are outside this code guarantee.",
      "evidence_ids": [
        "AD01",
        "AD03",
        "W01"
      ]
    },
    {
      "record_id": "OP-643",
      "feature_id": "ads",
      "competitors": [
        "iCollect Movies / iCollect Everything"
      ],
      "capability": "Promotional notification opt-out",
      "competitor_free_behavior": "Baseline policy unclear.",
      "competitor_paid_behavior": "Pro opt-out documented; not a marketing-consent equivalence claim.",
      "competitor_evidence_status": "paid_documented; named dossier2026-10-19; documentary evidence, no entitlement/operation test",
      "competitor_source_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "eligible_offer_ids": [
        "PLAN-462",
        "PLAN-463",
        "PLAN-464"
      ],
      "context_offer_ids": [
        "PLAN-460",
        "PLAN-461",
        "PLAN-465",
        "PLAN-466",
        "PLAN-467",
        "PLAN-513"
      ],
      "state": "missing",
      "observed": "Settings offer cookies and personalization; no promotional sender was identified in inspected consumer paths.",
      "gap_or_boundary": "No explicit persistent promotional-notification opt-out control or sender suppression predicate. This is a missing control, not evidence GoodWatch sends promotions; private visibility is unrelated.",
      "evidence_ids": [
        "AD04",
        "AD02"
      ]
    }
  ]
}
```

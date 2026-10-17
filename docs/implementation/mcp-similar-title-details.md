# MCP: More like this and richer title details

Owner decision Q53, October 17, 2026. Extends the existing [read tools](mcp-read-tools.md); no write table or production grant is added.

## More like this

`get_similar_titles(title_id | title_name, year?, for_you=true, exclude_seen=false, kind=all|movie|show, limit=40, cursor?)` reads the first 80 fingerprint neighbors of the title page's related map, through `relatedMapNeighbors` in `related-map.server.ts`. It reuses the same public, one-day nearest-neighbor cache, eligibility rules and Qdrant `fingerprint_v1` vectors. This is a bounded neighborhood, not a catalog-wide search. The site's map can fetch further neighborhoods on interaction; this tool pages only this first pool. No paid descriptive interpretation runs.

The source title and canonical duplicates are removed. Not interested and Dropped are always hidden, and `exclude_seen=true` applies the same rated/watched/in-progress/on-hold/quiz-skipped rule as the other MCP discovery tools. These and `kind` apply before pagination. Everywhere and seen included are the MCP defaults, independent of saved services/filters. `for_you=false` retains descending similarity; the default applies the site's browse For you lift to taste percentiles over the complete eligible pool before paging. Without enough taste it retains similarity order and reports `for_you_applied=false`.

Every result has the normal title URL, Markdown link, poster, runtime and actual GoodWatch `match` / `match_label`. `similarity` is source-title fingerprint cosine on the 0–1 scale, distinct from the member's 50–99 taste match. Personal exclusions/order/taste never enter the public neighbor cache. Offsets require the same source and filters; catalog or member changes may shift pages.

The tool uses the existing `ui://goodwatch/posters-v1.html` resource with all three existing host metadata aliases. `page_url` opens the source title's `#related` section and `page_note` explains the broader/different website ordering. No widget source or permissions change is needed. The tool has read-only annotations and respects `REC_MCP_READ` / `REC_MCP_SIMILAR_TITLES` at listing and call time. The duration metric's bounded tool count is now 15.

## Richer get_title

`get_title` keeps its ID/name/year selector and adds:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `include` | `["cast","scores","analysis"]` | Requested groups; `[]` keeps the smallest details/availability/member answer. `seasons` and `episodes` are opt-in. |
| `episode_limit` | `20` | Episodes per page, maximum 50. |
| `episode_cursor` | Absent | `offset:N` from `title.episodes.next_cursor`; independent of watch history cursors. |
| `season_number` | All | Filter displayed episode season; 0 is Specials, -1 is Additional episodes for reviewed presentations. Requires `include` to contain `episodes`. |

Cast uses the details reader's first five billed actors, plus directors and show creators. People carry `id`, `name`, the site's `personPath` URL and a ready-made Markdown `link`. Creator credits are the synced `person_worked_on.job='Creator'` rows, never inferred from writers/producers.

Scores reproduce the detail page's provider fields: GoodWatch overall, IMDb, Metacritic critics/audience and Rotten Tomatoes critics/audience. Each reports its provider scale (`out_of=10|100`) and source URL when present. Zero/unavailable scores are null. Availability and member marks keep their existing semantics. A safe YouTube `trailer_url`, title `poster_url` and title `page_url` are always available as fields, null when there is no trailer/poster.

`title_analysis` includes stored essence summary/tags, the existing mood/theme rules, featured TV Tropes entries and total trope count. Its `available` flag means the existing detail reader has a fingerprint. Missing evidence is not replaced by generated text. Terms exposed to clients use **title analysis**.

Seasons and episodes use `getEpisodeGrid`, including its reviewed presentation mappings and conservative provider season-score alignment. All catalog seasons are listed when there is no reviewed regrouping, with null scores where no grid season exists. Reviewed seasons retain the displayed numbering and do not borrow an unrelated TMDB name/count. Unmapped Additional episodes keep their own label and canonical labels. Episode scores remain IMDb on a 0–10 scale; an unavailable rating stays null. The ordinary website grid omits unrated episodes, so this is a score view, not a replacement for `get_show_progress` or a complete tracking catalog. The response explains displayed numbering and provider scales. Movie requests do not synthesize seasons/episodes.

## Verification

Run `goodwatch-webapp/scripts/mcp-details/run.sh`. It owns three disposable containers on loopback ports 15967 (CrateDB 5.10.12), 16967 (Valkey 8.1.3) and 15970/15971 (Qdrant 1.15.3), refuses existing containers, and cleans them on exit. The shared seed/grant helpers additionally accept this dedicated Crate port and still check `sys.cluster` before changes. The Vite-only test config reuses the existing deterministic taste/provider fixtures and rewrites the existing suites' loopback ports, allowing other threads to test independently.

The run covers existing read, write, fresh-process durable replay, ranked/cache/quota, native local provider/budget and personal metadata suites, followed by the new real-Qdrant suite using the scoped `goodwatch_search` identity. New checks cover include selection/defaults, top billing/person links/creators, provider scales, title analysis/trailer, real season scores/episode paging, read annotations/policy, posters/grid view, taste matches, seen/hidden/type filtering before paging, member isolation and absent fingerprints. Unit tests cover strict schemas and bounds, full-pool For you lift, canonical identities, page slices, missing scores and reviewed season/Additional episodes handling.

The regular production build succeeds. The repository typecheck is compared with an unchanged checkout of the starting commit; existing diagnostics are reported separately from any new diagnostic. Hosted Claude.ai behavior remains an owner retest after the deploy.

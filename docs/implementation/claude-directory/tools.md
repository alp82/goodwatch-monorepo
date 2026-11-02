# GoodWatch tool reference

Captured from authenticated production MCP Inspector discovery on 2026-10-20, release `5faa8365`. Refresh from live discovery after deployment changes. Account flags and consent can reduce the visible inventory. [Exact input schemas](tool-schemas.json) accompany this reference; runtime refinements also enforce cross-field rules described below and in tool errors.

All reads require `mcp:read`; all writes additionally require `mcp:write`. All writes require a stable `action_id` reused only for retries of the exact action. Account identity comes from OAuth. Reads carry read-only/idempotent hints; all writes carry confirmation and idempotent hints. Share-list writes can publish data. Results return structured JSON plus text, with title/page links where applicable. Read failures set `isError` and a status; successful writes report `applied` or `unchanged`, before/after state and a durable receipt. Conflicts, missing permissions, ambiguous selectors, missing handles, unknown titles, quotas and unavailable data are explicit outcomes; never report them as success.

Unfiltered name lookup sorts matches alphabetically; a small limit can omit the intended exact title. Use title/year resolution, a larger page or a canonical title ID for deterministic demonstrations.

Discovery is bounded to 40 results; other limits and cursors follow the linked schemas. Title selectors accept canonical IDs or names with an optional year. For writes, an ID takes precedence over redundant name/year. Data can be missing or stale, particularly streaming availability and watch dates. Requests are limited to 60/minute and 1,000/hour; descriptive smarter search also has a 20-uncached-attempt daily quota.

## search_titles (read)

**Search titles by name**

Search movie and show names across the GoodWatch catalog, separate from your library. Name lookup by default; for descriptive queries, explicitly set ranked=true for an optional smarter match, ordered For you by default. Defaults to everywhere and includes seen titles. Use the shared Discover filters to narrow by type, genres, years, runtime, score, services, moods and more; filters accept catalog genre and provider IDs. Repeat filters with offset cursors; ranked cursors inherit their view. Except when paging with a ranked cursor, a missing, empty or whitespace-only query runs the native Discover path, filters and For you default; ranked is ignored and no smarter-match attempt is charged. exclude_seen=true returns only unseen results, filtered before pagination. Returns up to 40 results by default; limit bounds the page size. Different works can share a name and year: use runtime_minutes to distinguish them. Smarter matches allow 20 uncached attempts per member per UTC day, one in flight, normalized queries cached for 60 seconds and paging is free.

## discover_titles (read)

**Discover movies and shows**

Discover without a query using the same catalog, filters and ordering as GoodWatch Discover/Explore. For you by default; everywhere and seen titles included. Choose popularity, newest, score or match ordering. Use on_my_services=true for saved services, or providers for specific services, in your saved country. Filters apply before pagination. Repeat filters when paging with offset cursors. Returns up to 40 titles and a matching Discover grid page_url.

## get_discover_filters (read)

**Get Discover filter options**

List exact genre names, provider IDs/names available in your saved country (plus saved providers), and saved services for catalog discovery. Reads existing settings without changing them.

## get_title (read)

**Get a title**

Catalog details, trailer, availability evidence and your marks. Default include=[cast,scores,analysis] adds five top-billed people and directors/creators, each with a ready-made person link, provider scores on labelled scales, and title analysis (moods, themes, tags, featured tropes). Pass include=[] for the smallest answer, or add seasons/episodes for the website’s season/episode ratings. Episodes use the website’s displayed numbering, which can differ from tracking; page with episode_cursor/episode_limit and optionally season_number. Unknown scores and watch dates stay unknown.

## get_similar_titles (read)

**More like this**

Find more like a movie or show from GoodWatch’s own title-page fingerprint neighbors (up to 80 candidates), with each result’s GoodWatch taste match and posters. Ordered For you by default; for_you=false keeps similarity order. Similarity describes the source title, never your taste match. Searches everywhere and includes seen titles by default; exclude_seen=true applies Not seen yet before paging. Not interested and Dropped are always hidden. kind filters all/movie/show. Keep title and filters unchanged when paging. No paid descriptive search is used.

## get_my_shows (read)

**Get my shows**

Only your shows: Continue, Pick up, Waiting for episodes, Want to See, On hold and Dropped.

## get_show_progress (read)

**Get show progress**

Your current pass, next episode and paged watches. Dates are unknown unless recorded.

## get_tonight (read)

**Watch next**

Choose one thing to watch next, using your saved country and services: a next episode from a show you are watching, otherwise a Wishlist movie or show to start (or a suggestion if the Wishlist is empty). Returns one recommendation rather than the complete Wishlist.

## get_library (read)

**Get my library**

Your marked titles, including scores, Wishlist / Want to See, watch progress and Not interested. filter=want_to_see selects your Wishlist. Includes added_at (Wishlist date, null when absent), runtime_minutes (movie duration or usual show episode length), and GoodWatch match. Defaults to match (Best match by your taste) when taste is available, otherwise the usual date sort. Use sort=runtime for the longest titles first across your entire filtered library, without per-title lookups. Explicit sorts are preserved. Sorts match My library: added (last added), last (last watched), score (highest first), title (ignores leading articles); waiting puts the oldest Wishlist additions first.

## get_taste (read)

**Get my taste**

Your real taste signal and strongest attributes; explains when there is not enough evidence.

## search_people (read)

**Search people**

Search cast and crew by name. Returns canonical person_id values and GoodWatch person links.

## get_person (read)

**Get a person's filmography**

A person's catalog credits with your GoodWatch taste match. Returns the subject’s person link and a link for each credited title. Includes every title, even without a poster or score. Defaults to For you, everywhere, including seen titles. Newest and score sort the whole filmography before paging; exclude_seen uses the site's Not seen yet rule. Links open the person's real GoodWatch page; its grouping can differ.

## get_my_lists (read)

**Get my share lists**

Your share lists from Lists, including unlisted lists, newest updated first. Each list has exactly five ranked titles and the share link produced by the site.

## get_list (read)

**Get a share list**

Read one of your share lists and its five titles in rank order, with taste match and the site's share link. Other members' lists are not exposed by this tool.

## get_settings (read)

**Get my settings**

Read Watching from (country), Show titles in (language), and saved streaming service IDs. Browser language is a saved setting, not a language inferred from your country. No browser locale is supplied by MCP.

## log_watch (write)

**Log a watch**

Log one movie or episode watch, an inclusive episode range (season, episode, episode_end), or a whole season (season, whole_season=true). Ranges use the catalog tracking season/episode numbers, mark only aired regular episodes missing in the current pass, never duplicate existing watches, and produce one receipt. Dates remain unknown unless explicitly supplied. Results report every added watch. Batch items are movies, episode ranges or whole seasons; whole-show status transitions are not supported by this tool. To change many titles at once, pass items instead of one title: up to 50 per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; batch_id identifies the complete reversible batch. Full history (hundreds of titles or more) file import is available at: https://goodwatch.app/settings/imports For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## rate_title (write)

**Rate a title**

Set a score from 1 to 10, or clear it with null. Clearing a score is destructive. A movie rating can own one undated watch; show ratings never log episodes or change show status. The result reports the previous score and exact watch changes. To change many titles at once, pass items instead of one title: up to 50 per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; batch_id identifies the complete reversible batch. Full history (hundreds of titles or more) file import is available at: https://goodwatch.app/settings/imports For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## set_want_to_see (write)

**Set Want to See**

Add or remove a title from your Wishlist. Removal is destructive. Adding a Seen title means Want to rewatch and preserves watches. Reports previous membership and added-at time. To change many titles at once, pass items instead of one title: up to 50 per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; batch_id identifies the complete reversible batch. Full history (hundreds of titles or more) file import is available at: https://goodwatch.app/settings/imports For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## set_not_interested (write)

**Set Not interested**

Set or clear Not interested for an unseen, unrated title. Setting it removes an existing Wishlist entry and is destructive. Reports both marks before and after. To change many titles at once, pass items instead of one title: up to 50 per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; batch_id identifies the complete reversible batch. Full history (hundreds of titles or more) file import is available at: https://goodwatch.app/settings/imports For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## set_show_status (write)

**Set show status**

Apply a native show-status transition. Dropped and bulk Seen are destructive. Seen logs aired episodes with no dates. Watching from Seen starts a new pass while retaining earlier watches. Not started never erases watches. Reports previous/new status, pass and watch changes. To change many titles at once, pass items instead of one title: up to 50 per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; batch_id identifies the complete reversible batch. Full history (hundreds of titles or more) file import is available at: https://goodwatch.app/settings/imports For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## undo_watch (write)

**Remove a watch**

Remove one watch record. Choose a watch_id, or omit it for the most recently logged individual watch of this title. Destructive: results identify the exact removed watch, date, pass and resulting marks; retrying the same action never removes a different watch. Or pass only batch_id (from a batch result) to take back every change that batch call made, title by title, through the same undo the site uses; a title changed again since keeps its newer value, and each title reports undone, partly_undone, already_undone, changed_since, not_undoable or error. A batch is undone once: undoing it again returns the first undo's result. For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## set_my_services (write)

**Set my country and services**

Replace your saved country and streaming services. Country changes and removed services are destructive. Services accept exact names or numeric TMDB IDs; unknown/ambiguous names return choices without writing. Reports the full previous/new country and service IDs. For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## set_settings (write)

**Change Watching from or Show titles in**

Change your saved country (Watching from) and/or title language (Show titles in). Omitted fields and streaming services are preserved. Country and language are independent. Language browser follows your browser on the site. Reports previous and new preferences; concurrent changes return conflict. For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## create_list (write)

**Create a share list**

Create a share list of exactly five distinct titles in rank order. Requires an existing site handle; if missing, returns handle_required and the Lists page. Uses the site's default card and Ember theme. Public by default; unlisted is accessible to anyone with the share link. Returns the site's real share link. Does not change ratings or Wishlist. For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

## update_list_titles (write)

**Add and remove share-list titles**

Atomically add and remove titles from one of your share lists. A share list always contains exactly five distinct titles: provide additions and removals together, with equal counts. Remaining titles keep their rank; added titles go at the end in supplied order. Returns previous/new rankings and the site's share link. A concurrent edit returns conflict; read again before choosing a new action. No ratings or Wishlist changes. For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Without title_id, title_name is required and year is optional. Replayed results describe the original action, not current state; a new read returns current state.

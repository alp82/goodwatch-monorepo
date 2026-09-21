# Integration findings from three read-only subagents

The user rejected the first prototype because it replaced header search with a modal launcher and substituted simulated title details. Three independent investigations traced the existing shell, real detail components, and search/filter data contracts before this revision.

## Header and shell

`root.tsx` supplies auth and QueryClient; `app.tsx` renders Header and Outlet as siblings. A shared controller belongs above both. Existing `ui/Search.tsx` uses a small actual search input that expands across the header on focus. The current dev-only branch keeps that input behavior but removes its dropdown results. Every text change immediately navigates to the search page with replace-history; only the page renders results. There is no document-event bridge or separate modal input.

## Real details and actions

`movie.$movieKey.tsx` and `show.$showKey.tsx` load real details and render `Details`. `DetailsHeader` mounts `ExploreBar` above title metadata. Despite being informally called the taste bar, ExploreBar contains navigation and refinement only. The actual actions live in DetailsOverview (Want to See, Mark as Seen, guest Skip) and DetailsRatings (ScoreSelector).

Search-origin visits replace the Taste sequence, not the actions. A puts navigation below title metadata; B uses the old ExploreBar slot; C adds a desktop rail alongside the real page. Ordinary unmarked direct visits retain ExploreBar. No scoring component or user-data mutation was modified.

Both detail routes initialize a missing country through a helper that reconstructs the URL. Search links include an explicit country so this does not erase the origin marker. A narrow dev-only shouldRevalidate rule avoids reloading an unchanged title for variant/filter-only URL changes. Title, country, language and mutation changes retain normal revalidation.

## Retrieval and filters

The accepted balanced blend and title highlighting are preserved in `ui/prototype/search-model.tsx`, copied from the accepted combined-search prototype. Both sources still use the accepted combined-search loader; `runCombinedDescription` is unchanged.

Crate metadata enrichment uses bounded, parameterized queries over whitelisted movie/show tables and does not reorder results. Reliable identities are deduplicated and known adult flags excluded. Genre, type and year refine the loaded result set. The existing watchability endpoint evaluates fresh, scoped evidence for country/service preference or filtering. Legacy streaming arrays are not used. Search preferences stay in the prototype URL and do not call the account preference mutation hook.

The accepted retrieval hardcodes 2,000 discovery votes and the title endpoint excludes adult results. Frontend checkboxes cannot recover excluded candidates. The revised prototype therefore removes fake broadening controls and records those retrieval extensions as remaining work. Editing inferred intent is also deferred rather than simulated.

## Continuity ownership

`taste_exploration` belongs to Taste and is never overwritten. The prototype has a separate sessionStorage namespace containing recent query batches and URL-specific scroll positions. Header, results and detail navigation consume the same provider. Explicit `searchJourney=1` links identify the origin; a stale stored search cannot take over an ordinary detail visit.

Inside this dev-only journey the controller owns scroll restoration. DiscoveryContinuity skips marked URLs and the existing root custom-scroll mechanism suspends Remix restoration. Other routes keep normal behavior. Results and filters survive Back/Forward, return links and reloads without repeating inference for the saved query.

## Follow-up: one result surface and browser history

Live feedback rejected duplicated overlapping results in every variant. Header dropdown rendering was removed. Query URL state now updates on each input change with replace-history, independently of the one-second retrieval debounce. Filter state continues to use push-history. C keeps the compact list treatment and its real-detail rail; the header never adds another list. A reuses FilterBarSection for an inline add-filter row; B reuses FilterBarSection, Select and Checkbox in its sidebar. Full Discover filter components remain bound to a different retrieval contract, so the prototype reuses their presentation primitives without implying unsupported catalog-wide filtering.

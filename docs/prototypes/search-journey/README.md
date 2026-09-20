# Connected header search and real detail navigation

Revised after the user rejected the disconnected sample demo. [Codebase investigation](architecture.md) records findings from three read-only subagents.

[Open the running prototype](http://localhost:3003/prototype/search-journey?variant=A). The existing server runs on port 3003; use it. Source is preserved on `prototype/search-journey`. For an independently configured checkout, the normal app command is `cd goodwatch-webapp && npm run dev`.

This revision uses **the actual header location and expanding search input, live accepted combined search, and normal `/movie/...` and `/show/...` routes**. Movie/show loaders, complete details, fingerprint, ratings, streaming and action components remain real. Rating, Want to See, Mark as Seen and Skip have their normal library effects. Browser QA did not invoke account actions.

## Current interaction

Updated after live feedback rejected overlapping duplicate results. The header has no result dropdown in any variant. Changing its text immediately moves to the search route and replaces the current history entry. It preserves focus and spaces during typing. Search requests remain debounced by one second; Enter requests immediately. Existing results stay visible during loading.

Filter changes push a history entry. Browser Back restores the previous query/filter combination; individual query edits do not create entries. Adding an empty optional filter field only exposes its control; selecting a filter value changes the URL and history.

- **A — Inline filters (preferred in live review):** one horizontally scrollable row of filter summaries. Adding or clicking a filter opens its editor below. Reuses Discover’s actual SectionGenre and SectionRelease editors, FilterBarSection and Tag, the full country selector, and the existing streaming Select/Checkbox.
- **B — Filter sidebar:** the existing colored FilterBarSection design, shared Select for streaming services and Checkbox for paid offers.
- **C — Compact results:** the compact result presentation as the only list on search; its rail remains beside real details on desktop. Focusing the header does not duplicate it, and typing returns to search.

The original real detail navigation placements remain available across the variants. The latest `single-search-*.png` screenshots supersede earlier search screenshots; `integrated-*.png` documents the prior real-detail integration.

## Review walkthrough

1. Open a real title, then edit the header text. It moves immediately to search with one list and no history entry for the edit.
2. Continue typing, including spaces. URL/input stay synchronized and preserve focus; requests wait until typing stops.
3. Change Titles or another filter. Back should undo the filter change, without stepping through each query edit.
4. In A, add Genre or Released since to the single-line row, choose a value, and remove it. On narrow screens the row scrolls rather than expanding into a large box.
5. In B, compare the familiar filter sidebar and shared service selector. Country/service filtering uses the existing fresh availability-evidence endpoint.
6. Compare C's compact search list and real-detail rail. There is no duplicate header result surface in either location.

## Scope and constraints

The provider is shared by Header, results and real Details. The URL owns query, filters, variant and origin; a dedicated sessionStorage namespace retains recent search batches and per-URL scroll. Taste storage is untouched. Dev-only route gates and explicit origin markers limit the integration to the prototype journey.

The accepted D4+ server and original combined prototype are unchanged. Refinements apply to returned results, not a new full-catalog query. Metadata comes from a bounded read-only Crate lookup. Adult-flagged rows are hidden when known; unknown classification remains eligible. Reliable matching identity is collapsed without merging by title alone.

Removing the discovery vote floor, adult opt-in across retrieval sources, and editable inferred intent still need real retrieval contracts. The old simulated controls were removed. Do not interpret a filtered empty top-20 list as proof that the whole catalog lacks matches. Search result people are shown as known-for summaries, not linked to movie/show detail routes.

No production deployment or database writes. This remains an interaction prototype awaiting live user review, not a resolved ticket or implementation ready to ship.

## Verification

Browser QA used Playwright because Chrome DevTools MCP was unavailable. Confirmed actual header input; live Heat/Drive requests; full real movie detail and return; next/back/forward; filter preservation; exact 450px scroll restoration; reload without repeated search; retained old results during debounce; normal behavior for unmarked direct visits; desktop rail; and mobile header/detail layouts without horizontal overflow. Screenshots are adjacent. A real Game of Thrones show visit, variant changes without detail reloads, and retaining the show after a Movies-only refinement also passed. Real Want to See and Skip controls remained present; no library action was invoked. Final walkthrough reported no browser page errors.

UI-only URL changes originally caused unnecessary detail revalidation; the narrowly gated shouldRevalidate rule corrects that. Repository TypeScript still reports the same 270 pre-existing diagnostics, with none in the new prototype modules or revalidation helper. Existing detail-route serialization and Search ref typing diagnostics remain.

The initial revised-route accessibility audit found an unsupported aria-expanded attribute on the search input; it was removed. Final accessibility scored 95/100, recorded in accessibility.json; remaining findings concern the existing footer heading order and unnamed shell links. The full performance/accessibility run timed out at CSS.stopRuleUsageTracking, so no performance score is claimed. Dev-server performance is not a production benchmark.

## Verification of the single-results revision

Browser checks passed: immediate navigation on input change from a real detail page; no additional history entry for query changes; one entry for filter changes; Back restores the prior query and filter; one results list in A/B/C even with header focused; retained results during debounce; input focus preserved; multiword query spaces preserved; shared service selector writes service ID 8 for Netflix; no horizontal mobile overflow or page errors in the main walkthrough. No new prototype TypeScript diagnostics.

## Details failure investigation

The streaming-provider endpoint returned 958 rows but only 949 provider IDs. DISTINCT included logos, so multiple snapshots of provider 110 (Infinity+) survived. The shared server function now deduplicates by provider ID after the cache read, preserving the first entry in provider order and correcting existing cached snapshots too. The endpoint now returns 949 rows with 949 unique IDs.

The intermittent full-page failure was reproduced with Chromium reporting ERR_NETWORK_CHANGED on background requests. FilterCountries and MovieSeries used Remix fetchers; either request failing independently reached the root error boundary and removed the loaded title. A focused browser probe aborting only `/api/countries` or only `/api/movie/collection` reproduced the root error before the fix in both cases.

FilterCountries now uses the existing countries query; MovieSeries uses a collection query keyed by collection ID and movie IDs. Both use abort signals, check response status, retain errors locally, and provide inline retry. Country selection remains visible during failure. After the fix, both failure probes kept the Heat heading, displayed the corresponding inline error, and recovered through Try again when requests were restored. These fixes also apply to normal detail pages and shared country controls. They do not alter the operating system/browser network connection or promise navigation during a total network outage.

Repository TypeScript remains at 270 existing diagnostics, with no added diagnostics. No permanent automated tests were added, per repository instructions; browser probes are temporary files outside the repository.

A longer navigation stress run then reproduced ERR_NETWORK_CHANGED on the main detail loader itself. Movie, show, and root/session loaders now share a client loader that retries transport TypeErrors at most twice (250ms, then 750ms), keeping the current page visible during retry. It delegates to the real Remix server loader; SSR remains unchanged. Aborted/superseded requests, server errors, and redirects are not retried. Browser fault injection confirmed: one interrupted root request recovered; two interrupted movie requests recovered; two interrupted show requests recovered; persistent interruption stopped after three total attempts; an HTTP 500 failed after one attempt.

Final live stress walkthrough completed 37 Next/Previous transitions, including rapid double clicks, with zero root-error crashes and zero duplicate-key warnings. A real ERR_NETWORK_CHANGED occurred again during this run on both a collection request and a main movie loader; navigation recovered and continued. Cancelled requests from superseded double clicks remained cancelled.

## Reusing Discover in A

The user preferred A after verifying the detail-error fixes. A now reuses the actual Discover genre and release editors through optional change callbacks; Discover retains its normal URL navigation. Genre supports multiple selections with AND semantics, matching Discover’s summary. Search checks every selected genre against result metadata. Release supports presets, min/max inputs and the shared slider; both year bounds filter the search results and persist into detail navigation. Opening an editor does not change the URL or history. The country editor uses the shared full country list instead of six hardcoded choices. Streaming continues to use shared Select and Checkbox controls with search’s existing prefer/only behavior.

Browser verification: Crime + Drama selection, one history entry per filter change, no URL change on opening release editor, 2010–2020 preset, Back restoring the prior range, mobile without page overflow, and normal Discover rendering with genre/year filters. The shared release editor now stacks presets and number inputs on narrow screens. TypeScript reports 269 existing diagnostics (one existing genre-component diagnostic was corrected), none in the changed components. Accessibility remains 95; the new filter-button naming issue was corrected, leaving existing shell/footer findings. Search refinements still operate on the returned search batch; this does not add Discover’s full catalog retrieval or unsupported filters.

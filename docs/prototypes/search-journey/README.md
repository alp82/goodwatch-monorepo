# Connected header search and real detail navigation

Revised after the user rejected the disconnected sample demo. [Codebase investigation](architecture.md) records findings from three read-only subagents.

[Open the running prototype](http://localhost:3003/prototype/search-journey?variant=A). The existing server runs on port 3003; use it. Source is preserved on `prototype/search-journey`. For an independently configured checkout, the normal app command is `cd goodwatch-webapp && npm run dev`.

This revision uses **the actual header location and expanding search input, live accepted combined search, and normal `/movie/...` and `/show/...` routes**. Movie/show loaders, complete details, fingerprint, ratings, streaming and action components remain real. Rating, Want to See, Mark as Seen and Skip have their normal library effects. Browser QA did not invoke account actions.

## Current interaction

Updated after live feedback rejected overlapping duplicate results. The header has no result dropdown in any variant. Changing its text immediately moves to the search route and replaces the current history entry. It preserves focus and spaces during typing. Search requests remain debounced by one second; Enter requests immediately. Existing results stay visible during loading.

Filter changes push a history entry. Browser Back restores the previous query/filter combination; individual query edits do not create entries. Adding an empty optional filter field only exposes its control; selecting a filter value changes the URL and history.

- **A — Inline filters:** one horizontally scrollable row, with add/remove controls for extra filters. Reuses FilterBarSection.
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

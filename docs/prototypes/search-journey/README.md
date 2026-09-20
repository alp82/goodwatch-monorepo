# Connected header search and real detail navigation

Revised after the user rejected the disconnected sample demo. [Codebase investigation](architecture.md) records findings from three read-only subagents.

[Open the running prototype](http://localhost:3003/prototype/search-journey?variant=A). The existing server runs on port 3003; use it. Source is preserved on `prototype/search-journey`. For an independently configured checkout, the normal app command is `cd goodwatch-webapp && npm run dev`.

This revision uses **the actual header location and expanding search input, live accepted combined search, and normal `/movie/...` and `/show/...` routes**. Movie/show loaders, complete details, fingerprint, ratings, streaming and action components remain real. Rating, Want to See, Mark as Seen and Skip have their normal library effects. Browser QA did not invoke account actions.

## Alternatives

- **A — Compact header:** four suggestions below the real header; all-results view; search navigation below the real title metadata.
- **B — Expanded header:** larger suggestions surface with refinement; results workspace with sidebar; search navigation in the existing ExploreBar position above title metadata.
- **C — Search rail:** header suggestions plus a desktop list beside the full real detail page. On mobile, use the same real page and return/previous/next controls.

Use the bottom arrows or left/right keys outside form controls to switch. Header input supports one-second debounce, Enter, keyboard result selection, Escape and outside dismissal. Old results remain while the new query loads; title highlights stay tied to the displayed batch.

## Review walkthrough

1. Type Heat in the header. Open the movie from its suggestions. Confirm the complete normal detail page, then return to results.
2. Move among actual movie/show results with Previous/Next, browser Back/Forward, and return links. Scroll the list before opening a title; returning restores that position. Reload restores the saved batch without another inference call.
3. Compare navigation below title metadata (A), in the existing Taste navigation slot (B), and with a desktop result rail (C). All real rating and library actions remain unchanged.
4. Change type, genre or year on results or from Refine on details. A currently open title stays open if excluded, with an Outside filters state. Search order is retained unless streaming preference is selected.
5. Compare Explore everything, Prefer my services, and Only on my services. Choose country and services. These use the existing availability-evidence endpoint rather than illustrative offers. Prototype selections do not update account preferences.
6. Open an unmarked movie/show URL directly: it retains the ordinary Taste exploration bar, without adopting a saved search.

## Scope and constraints

The provider is shared by Header, results and real Details. The URL owns query, filters, variant and origin; a dedicated sessionStorage namespace retains recent search batches and per-URL scroll. Taste storage is untouched. Dev-only route gates and explicit origin markers limit the integration to the prototype journey.

The accepted D4+ server and original combined prototype are unchanged. Refinements apply to returned results, not a new full-catalog query. Metadata comes from a bounded read-only Crate lookup. Adult-flagged rows are hidden when known; unknown classification remains eligible. Reliable matching identity is collapsed without merging by title alone.

Removing the discovery vote floor, adult opt-in across retrieval sources, and editable inferred intent still need real retrieval contracts. The old simulated controls were removed. Do not interpret a filtered empty top-20 list as proof that the whole catalog lacks matches. Search result people are shown as known-for summaries, not linked to movie/show detail routes.

No production deployment or database writes. This remains an interaction prototype awaiting live user review, not a resolved ticket or implementation ready to ship.

## Verification

Browser QA used Playwright because Chrome DevTools MCP was unavailable. Confirmed actual header input; live Heat/Drive requests; full real movie detail and return; next/back/forward; filter preservation; exact 450px scroll restoration; reload without repeated search; retained old results during debounce; normal behavior for unmarked direct visits; desktop rail; and mobile header/detail layouts without horizontal overflow. Screenshots are adjacent. A real Game of Thrones show visit, variant changes without detail reloads, and retaining the show after a Movies-only refinement also passed. Real Want to See and Skip controls remained present; no library action was invoked. Final walkthrough reported no browser page errors.

UI-only URL changes originally caused unnecessary detail revalidation; the narrowly gated shouldRevalidate rule corrects that. Repository TypeScript still reports the same 270 pre-existing diagnostics, with none in the new prototype modules or revalidation helper. Existing detail-route serialization and Search ref typing diagnostics remain.

The initial revised-route accessibility audit found an unsupported aria-expanded attribute on the search input; it was removed. Final accessibility scored 94/100, recorded in accessibility.json; remaining findings concern the existing footer heading order and unnamed shell links. The full performance/accessibility run timed out at CSS.stopRuleUsageTracking, so no performance score is claimed. Dev-server performance is not a production benchmark.

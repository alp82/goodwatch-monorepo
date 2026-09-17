# Taste → real details → Taste

Working prototype for [Choose the connected exploration and signup experience](https://github.com/alp82/goodwatch-monorepo/issues/86), on `prototype/connected-exploration`. Awaiting user review; no final design acceptance is inferred.

## Open

http://localhost:3003/taste/quiz?prototype=journey

Uses the existing app development server. The original `/taste/quiz` is available for comparison. Preview behavior remains gated out of production.

## What changed

The user rejected the standalone layouts, then rejected the mini details dialog because the real details page still lost the journey. Both are removed.

Taste posters now link directly to actual movie/show pages in the same tab. The real details header offers a return to the originating Taste picks, rating card or Wishlist, plus a Wishlist count and the next unhandled suggestion. Related-title links retain this context. Country initialization preserves the preview flag and replaces its URL update rather than adding an extra browser-back step.

The real details action area shares the preview's guest interactions with Taste. Want to See, Skip and ratings update the same progress. The existing ratings section reflects the same score. Trailers, descriptions, fingerprint, related titles and viewing options remain on the real page.

Taste still uses its existing header, styling, scorer and responsive carousel. General suggestions appear immediately; familiar-title ratings can unlock the existing personalized recommendation APIs. A dismissible reminder appears after 10 ratings. At 20, a new rating requires an account; editing a rating, browsing, Wishlist and Skip remain available.

## Walkthrough

1. Open a pick midway through the carousel. It opens the real details page.
2. Choose Want to See. Check the Wishlist count and active action.
3. Follow a related title or Next pick. The Taste return path remains visible.
4. Return to Taste. The source view, carousel position and scroll position are restored; Wishlist reflects the details action.
5. Switch to rating familiar titles, open the current card's real details, and rate it there. Return to the same card and check the shared rating.
6. Repeat at mobile width, with details reloads and browser Back.

## Boundaries

Guest interactions, title metadata and feature state use separate `prototype_journey_*` local-storage keys. The tab's source view, remaining rating queue, selected edit card, suggestion snapshot, carousel position and scroll position use session storage. This intentionally exercises continuity without changing normal guest progress or account data; it is not the final persistence architecture.

Signup remains presentation-only. Real account transfer, global Wishlist integration beyond this path, all remaining discovery entry points, recommendation quality and availability freshness remain delivery/verification work. Existing viewing options are used; the prototype does not claim to implement the 30-day availability rule.

## Evidence

Chrome DevTools MCP walkthrough:

- Opened Better Call Saul from carousel index 4 at scroll position 178, chose Want to See on real details, and returned to index 4 / scroll 178 with Wishlist updated.
- From rating, opened A Clockwork Orange, rated it 8/10, followed the related Blade Runner link, and returned to the original rating card with the rating visible in Taste.
- At 390px, the return path remained visible and page width stayed at 390px.
- Prior shared-store checks retained 20 ratings after a blocked additional rating while Wishlist and Skip succeeded. Normal guest storage remained untouched.

No automated tests were added, following webapp instructions. App-wide TypeScript checking still fails on the existing baseline; this revision introduces no new diagnostics. Whitespace checks pass. Screenshots and Lighthouse reports are under `/tmp/goodwatch-real-details-*`; audit results are recorded in the decision ticket.

The real movie page's mobile Lighthouse navigation audit reported accessibility 84, best practices 77 and SEO 92. Findings included existing unnamed navigation/carousel controls, focusable hidden related-title panels, rating-markup issues, third-party cookies and non-crawlable rating links. A new Next pick accessible-label mismatch was identified and corrected. These figures describe this development-page audit, not a performance or quality improvement over the existing app.

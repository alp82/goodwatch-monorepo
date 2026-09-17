# Connected exploration prototype

Question: how can GoodWatch connect interest discovery, title exploration, Wishlist and signup while retaining its existing experience?

Branch: `prototype/connected-exploration`. Decision: [Choose the connected exploration and signup experience](https://github.com/alp82/goodwatch-monorepo/issues/86).

The user rejected all three standalone variants for both visual design and flow. This revision replaces them with targeted changes inside the existing Taste components. It is awaiting review, not an accepted design or finished delivery.

## Open

http://localhost:3003/taste/quiz?prototype=journey

The existing app development server runs via `npm run dev`. Compare with `/taste/quiz` using the link below the preview. The old variant query parameters are no longer used. Rendering remains gated out of production.

## Changes to review

- Retains the existing header, typography, buttons, progress strip, rating experience and responsive recommendation carousel.
- Starts with general suggestions from the existing title loader. Rating familiar titles remains an optional way to obtain personalized suggestions using the existing recommendation APIs.
- Opens recommendation cards into a responsive title preview with real synopsis/genres, Want to See, Skip and a return to the same underlying screen. Escape closes the dialog; focus is managed by the existing Headless UI library.
- Keeps Wishlist beside discovery and rating, using the existing one-interaction-per-title model. Details and Wishlist share the preview's state.
- Opens the existing full details/viewing-options page in a new tab, leaving Taste in place. Does not invent offers or claim freshness.
- Replaces automatic guest interruption with a dismissible reminder at 10 ratings. At 20, another new rating prompts signup; browsing, Want to See, Skip and editing an existing rating remain available.
- Gives signup a short explanation tied to accumulated progress and browser storage limits. Account creation/import is deliberately not connected in this prototype.

## Storage and boundaries

Interactions, title metadata and feature state use separate `prototype_journey_*` browser-storage keys. This intentional prototype persistence lets reloads retain the preview Wishlist without touching normal guest progress or account data. It is not the production storage design. No simulated account-success path is presented.

This is a bounded Taste review. Global Wishlist integration, actual cross-route context restoration, new/existing-account handoff, availability freshness verification and the complete watchability filter remain with the map's delivery and verification tickets. The full details link opens the existing page with its existing behavior. The prototype does not claim to have connected every entry point or verified personalized recommendation quality.

## Validation

Browser review uses the locally installed Chrome DevTools MCP through its SDK transport. Desktop and 390px mobile views were inspected. The walkthrough checks title opening, Want to See, Wishlist, reload retention, Escape/return, isolated storage and the guest limit. Screenshots and Lighthouse reports are stored under `/tmp/goodwatch-*` in the authoring workspace; final results are recorded in the decision ticket.

No automated tests were added, following the webapp instructions. App-wide TypeScript checking still fails elsewhere; the changed files have no diagnostics. Whitespace checks pass.

Final mobile Lighthouse navigation audit: accessibility 95, best practices 100, SEO 100. The remaining accessibility findings concern unnamed links in the existing header/mobile navigation. Agentic-browsing score was 30; its report also flags the existing llms.txt response and layout shift. No production performance claim is made from this development-server audit. Reports: `/tmp/goodwatch-journey-lighthouse-final/report.html` and `report.json`.

The cap walkthrough retained 20 ratings after a blocked new rating, then successfully added one Wishlist entry and one Skip. Normal `onboarding_ratings` remained untouched in the isolated browser. Desktop title preview, mobile layout, Wishlist reload, and Escape return were exercised. Actual account transfer, freshness and cross-route continuity were not tested by this prototype.

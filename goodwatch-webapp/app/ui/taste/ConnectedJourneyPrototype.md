# Connected exploration prototype

Question: how should discovery, details, Wishlist, watchability and account continuity fit together across entry points?

Throwaway source for [Choose the connected exploration and signup experience](https://github.com/alp82/goodwatch-monorepo/issues/86), on branch `prototype/connected-exploration`. No design has been selected yet.

## Open

Use http://localhost:3003/taste/quiz?prototype=journey&variant=A on the existing app dev server. The project's `npm run dev` command starts the host when needed; repository instructions say agents must use the existing server rather than start it themselves.

The host loader, authentication, header and footer remain unchanged. Prototype interaction and authentication buttons perform no real mutations. Prototype rendering is gated out in production. State is in memory and resets on reload.

- A: discovery feed with progress beside the results.
- B: one-title workbench with controls and progress alongside it.
- C: guided interest → shortlist → watchability journey; every step stays directly accessible.

Switch with the floating arrows or keyboard arrows. Variant changes preserve demo state and update the URL.

## Review walkthrough

1. Explore with no ratings or services. Open details, choose Want to See, and check Wishlist. Rate the same title to see the interaction replace Want to See.
2. Change the arrival selector: title details and Wishlist land on those surfaces; other entries simulate the source of exploration. This is not implementation on every real route.
3. Select What can I watch, supply country/service, and opt into rentals. Open details of other titles to compare current, missing, and unknown offers. Offers are fictional and independent of actual country/service catalogs.
4. Try loading, empty and error responses. Empty results preview a broader direction without silently changing the chosen direction.
5. Seed 10 ratings to review the dismissible reminder. Seed 20 to try another rating while preserving browsing, Want to See and Skip.
6. Keep my progress → existing account: select new entries, inspect unselected example conflicts/preferences, confirm or keep the account unchanged. Close without confirming and resume from the pending-transfer banner.
7. Try new-account success, interrupted transfer/retry, and failed sign-in. Check return to the previous surface and preservation of controls. The simulated member collection shows transferred title interactions, not a real account.
8. Repeat A/B/C at desktop and mobile widths. Choose one presentation or specify pieces to combine.

## Boundaries and verification

The demo reuses real title data when available, with fictional fallback titles. Ranking, search/refinement, direct arrivals, offers, account conflicts and transfers are simulated. It does not prove storage persistence, real import safety, scroll restoration, or continuity across actual routes. Those remain delivery/verification work. Shared guest terminology and limits follow prior decisions.

TypeScript checking reports errors elsewhere in the app, with no diagnostics in the prototype files or modified Taste route. Formatting and whitespace checks pass. Browser QA and Lighthouse have not run: localhost:3003 refused connections and Chrome DevTools MCP was unavailable in the authoring session. Live user review is required before resolving the decision ticket.

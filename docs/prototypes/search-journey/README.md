# Header search, filters, and result navigation

Throwaway interaction prototype for [Prototype header search, filters, and navigation through results](https://github.com/alp82/goodwatch-monorepo/issues/111). Awaiting live user review; no interaction decision is resolved.

Open the existing dev server at http://localhost:3003/prototype/search-journey?variant=A. This session mounted the prototype in the running checkout for review; its durable source is branch `prototype/search-journey`. To run a separate checkout, install the app dependencies and configure its usual environment, then `cd goodwatch-webapp && npm run dev`. Do not start a second server while the existing one is running.

## Alternatives

- **A — Quick search:** existing header opens a compact four-result overlay, expanding into the full list and optional filters. Search sequence navigation is separate from taste actions.
- **B — Search workspace:** header focuses the full results surface. Persistent sidebar filters on desktop. Search sequence navigation lives inside the detail taste bar, alongside independent taste actions.
- **C — Browse beside details:** wider search overlay; results stay beside the selected detail on desktop. Mobile uses a detail view and a return-to-results action. Navigation remains separate from taste actions.

The bottom switcher and left/right arrows change the URL variant. Arrow switching does not intercept form controls. Escape closes the overlay and returns focus to header search; the overlay traps Tab. Arrow Up/Down in the input selects a compact result and Enter opens it. Search also submits on Enter and commits after one second idle. Existing results remain until the simulated new response arrives.

## Review walkthrough

1. Open header search, enter Heat, inspect highlighted text and retained old results; dismiss and reopen. Compare compact A with the larger C surface and the B workspace.
2. Open Her, move next, use browser Back/Forward, then return to the list. Query, filters, result order and scroll position should survive.
3. Try country/service with Explore everything, Prefer my service, and Only on my service. Compare how each changes the sample list. These are alternatives, not settled availability policy.
4. Toggle lesser-known and adult-flagged eligibility. Synthetic fixtures make the controls observable without depicting adult content. Try the low-vote title lookup shortcut; title lookup bypasses the discovery floor.
5. On a movie detail, refine Titles to Shows. The current detail stays open with Outside filters and disabled sequence controls. Taste actions do not navigate.
6. Compare search navigation inside the taste bar (B) and outside (A/C). Direct title visit, under prototype controls, removes search navigation without removing taste actions.
7. Use Result state to try slow (4 seconds), empty, weak, partial-source failure and total failure. Retry returns to the normal scenario.
8. Compare read-only interpretation with Try editing interpretation. Tone editing is deliberately a presentation-only control; adopting it needs an explicit contract compatible with locked D4+.

## State ownership proposal

The URL owns committed query, explicit filters, variant and selected title. In-memory state owns displayed batch, result scroll positions, demo taste actions and interpretation UI. Browser history restores URL state; moving between detail titles does not mutate taste. Query edits begin a new sequence; filter changes retain the open detail and disable sequence navigation if it falls outside the selection. A reload resets memory state. This is a proposal to review, not a finalized production state-storage decision.

## Deliberate limits

This is a sample-driven UI prototype, not live D4+ retrieval. Names, synopses, match reasons, votes and availability are illustrative; offers are not current availability claims. Arbitrary search descriptions reuse the sample list. Exact sample title matches move first. The accepted D4+ server and blended-search prototype remain unchanged. Matching titles are one blended list, with title-fragment highlights and sample fingerprint reasons.

Details are interactive previews within the prototype route, not the full production movie/show route. Taste actions are simulated, never sent to the user's library. Production integration must preserve the real scoring components, title loaders, guest/account flow, real availability freshness, reliable-identity deduplication, filter semantics across retrieval sources, and full navigation continuity. Only one streaming service can be selected in the demo; multi-service selection and the final set of advanced filters remain review questions. No production database writes or deployment occurred.

Prototype route returns 404 in production. Header change is dev-only and limited to this route. Other routes retain existing Search behavior. Poster fixtures were downloaded from TMDB for local review; two unavailable posters use placeholders.

## Verification

Manual browser automation with Playwright (Chrome DevTools MCP was not available): one-second debounce and retained results; focus and Escape; detail selection and Previous/Next; browser Back/Forward; exact scroll restoration (400 px before and after); lesser-known/adult fixtures; country/service filtering; excluded-current-title behavior; independent taste actions; direct visits; empty/weak/partial/failure states; desktop and 390 px mobile layout without horizontal overflow. No browser page errors in the completed walkthrough. Screenshots are adjacent.

TypeScript: no errors in the new route. Repository typechecking remains failing (270 diagnostics in the first run), including the existing `useOutsideClick` RefObject mismatch in Search.tsx; the dev-only header wrapper did not change that existing code.

Full Lighthouse performance/accessibility run failed with a DevTools CSS.stopRuleUsageTracking timeout. The accessibility-only retry scored 96/100; report in accessibility.json. Development-server performance is not a production benchmark.

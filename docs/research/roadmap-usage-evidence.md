# Roadmap usage evidence

Published with the [GoodWatch living roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52): [GitHub evidence record](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686673299).

Date: 2026-09-15. Status: instrumentation inspected; production usage analysis awaits access.

## What is established

- [App initialization](../../goodwatch-webapp/app/root.tsx) configures PostHog outside localhost using `https://a.goodwatch.app`. The client initialization effect is not restricted to signed-in users. A separate effect identifies members and sends explicit initial-login properties and a `Pageview` event.
- The inspected source does not provide a complete named onboarding or retention event specification. SDK-generated events, autocapture, actions, and existing dashboard definitions may still provide useful evidence; their actual presence has not been checked.
- [Client initialization](../../goodwatch-webapp/app/entry.client.tsx) includes Sentry and PostHog integration. This does not establish that a specific replay, error, or session exists in production.
- [Poster impressions](../../goodwatch-webapp/app/routes/api.poster-impressions.ts) feed catalog refresh priority. Do not use those records as a proxy for unique people, recommendation conversion, or successful watching.
- The bounded repository search found no product funnel/retention export. This is not a claim that no such data exists elsewhere.
- A PostHog integration was found through the available plugin directory and offered for installation/connection. At this snapshot, it is not installed/connected, and no analytics query or dashboard read has occurred. The configured analytics host's relationship to the account also needs verification after connection.

The [codebase baseline](roadmap-codebase-baseline.md) contains the broader journey inventory. Neither code presence nor market features establish actual GoodWatch behavior.

## Access required

Install/connect the offered PostHog integration to the GoodWatch project, or use an existing authorized analytics access path if one becomes available. Do not paste credentials into the roadmap. Confirm the project and available date range before interpreting results.

Continue code and backlog reconciliation while access is pending. Keep observed behavior explicitly unknown until data is read; do not replace missing evidence with guessed rates or assumed user segments.

## First pass after access

### Inventory before calculating

- Establish the available date range, project timezone, event coverage, and dates of relevant tracking/product changes. Select an analysis window from actual coverage; no window has been assumed here.
- Inventory actual event names and properties, dashboard/action definitions, SDK versus explicit events, and any usable session/replay data.
- Check guest-to-member identity continuity, duplicate events, internal/test traffic, bot traffic, and what pageviews represent. Different custom and automatic pageview names must not be silently combined or double-counted.
- Establish the sample size and which segments have enough observations to support a comparison. Report missing/unknown country, device, referral, and account-state values.

### Questions and candidate observations

These are concepts to map to existing events, not claims that these event names or measurements exist.

| Question | Candidate observations | Interpretation boundary |
| --- | --- | --- |
| How do people arrive? | Entry pages, acquisition/referrer data, device, country, guest/member status where available | Traffic volume does not establish intent or satisfaction. |
| How far does onboarding progress? | Quiz entry, title search, scoring/skipping, recommendation exposure, signup, import, provider selection | Reconstruct the actual branches; do not force guest and member journeys into a single linear funnel. |
| What happens after recommendations? | Title-detail visits, saving, provider-link clicks, further ratings, another recommendation request | A click/save is a proxy action; it does not prove watching or recommendation quality. |
| What do returning visitors do? | Visits on distinct dates, entry surfaces, saved-list use, rating updates, discovery actions | Repeat visits show behavior; motivations require additional evidence. |
| Where is there friction? | Errors, repeated attempts, abandoned steps, available replay examples, feedback | A replay or anecdote can reveal a problem but cannot establish its prevalence alone. |
| Can we compare starting situations? | Observed guest/member transitions and any evidence of prior history or import intent | Account status alone does not identify whether a person has external ratings to import. |

### Analysis output

- Report counts alongside rates and define each denominator and identity/session rule.
- Describe the first-session paths that actually occur, including alternative entries and users who never enter the quiz.
- Describe observed return intervals before choosing any particular retention window; account for incomplete follow-up for recent users.
- Compare segments only when event coverage and sample size permit, and distinguish descriptive association from causal effects.
- List unusable/missing measurements and the narrowest evidence needed to answer the remaining questions. An instrumentation change is a later scoped proposal, not an assumed feature of this research pass.
- Record what the data supports, what it contradicts, and what remains unknown. Link those findings to backlog families without silently deciding the audience or return-use promise.

## Qualitative follow-up

After the data and code inventory identify useful cases, observe the real journeys and use available feedback or appropriately authorized user research to learn why people act as they do. Candidate cases include starting without history, continuing a guest session after signup, returning with existing ratings, saving a recommendation, and finding that a suggestion is unavailable.

No users have been contacted, interviews performed, or runtime journeys verified in this pass.

## Decisions deliberately left open

- Which onboarding audience leads and whether external imports belong in the initial scope.
- What makes people want to return, and which product mechanism should serve that motivation.
- A definition of useful recommendations, activation, and returning use for future prioritization.
- Product success targets, delivery dates, development capacity, and any implementation commitment.

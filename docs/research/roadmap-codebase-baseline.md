# Roadmap codebase baseline

Published with the [GoodWatch living roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52): [GitHub evidence record](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686672528).

Date: 2026-09-15. Purpose: establish what already exists before prioritizing the backlog.

## Scope and evidence limits

This is a bounded read of the webapp's onboarding, recommendations, personal collections,
streaming preferences, import paths, and instrumentation. It is not a complete architecture audit.
The [webapp instructions](../../goodwatch-webapp/AGENTS.md) were read before inspection.
No application code, production data, tracker issues, or branches were changed.
No browser session, API execution, production analytics, or user interview was performed.

- **Implemented in code:** a visible route/component and its supporting code exist; runtime success remains unverified.
- **Partial:** relevant pieces exist, but the inspected path contains incomplete behavior or only covers part of the backlog idea.
- **Unverified:** this read cannot establish the claim. A missing search result is not proof of absence across the whole system.

The findings below are evidence for further investigation, not decisions about audience, UX, or priority.

## Coverage at a glance

| Area | Code status | Boundary |
| --- | --- | --- |
| Guest taste quiz | Implemented in code | Live usability and completion rates unverified |
| Account onboarding | Implemented in code | Guest import, country, and providers are connected through the app shell |
| Personalized recommendations | Implemented in code | Result quality and practical watchability unverified |
| Personal watchlist | Partial | Populated homepage reader exists; separate wishlist page has incomplete handling |
| Scores, favorites, watch history, skips | Implemented in code | APIs/actions exist; comprehensive collection-management UI not established |
| Country/provider preferences | Implemented in code | Their effect must be checked separately for each discovery surface |
| Guest interaction import | Implemented in code | Same-browser guest data; account-state edge cases unverified |
| External history/rating import | Unverified | No user import flow found in the scoped source search |
| Product analytics and error monitoring | Implemented in code | Actual collected events, dashboards, and data quality unverified |
| User release/availability notifications | Unverified | No implementation found in the scoped app search |

## Entry and onboarding

The [homepage route](../../goodwatch-webapp/app/routes/_index.tsx) renders a taste landing
screen and feature showcase for guests, and a different homepage for signed-in users.
The [quiz route](../../goodwatch-webapp/app/routes/taste.quiz.tsx) loads candidate titles
for either audience and links signup back to the quiz.

The [quiz](../../goodwatch-webapp/app/ui/taste/TasteQuiz.tsx) supports scoring, skipping,
and planning to watch. It requests recommendations at five ratings and Fingerprint preview
at fifteen; guests encounter a signup prompt at twenty ratings.
Those limits are defined in [feature configuration](../../goodwatch-webapp/app/ui/taste/features.ts).
The [scoring hook](../../goodwatch-webapp/app/ui/taste/hooks/useTasteScoring.ts) persists
guest interactions in local storage and sends member actions through mutation hooks.

The [app shell](../../goodwatch-webapp/app/app.tsx) mounts the onboarding banner for members.
The [step selector](../../goodwatch-webapp/app/ui/onboarding/hooks/useOnboardingStep.ts)
checks completion settings, then guest interactions, country, and streaming preferences.
The [banner](../../goodwatch-webapp/app/ui/onboarding/SmartOnboardingBanner.tsx) connects
import progress/retry, country confirmation, provider selection, and continuation to scoring.
Onboarding completion is defined by country and streaming settings, not a rating count.

An initial narrower search missed the shell mount; the verified finding is that the banner
is connected. Runtime continuity across signup, reloads, and existing accounts remains unverified.

## Recommendations and taste profile

The [member recommendation reader](../../goodwatch-webapp/app/server/user-recommendations.server.ts)
uses positively and negatively scored titles with Fingerprint vectors in Qdrant.
Its inspected inputs are user ID, media type, and result limit: no explicit country/provider input.
It excludes previously interacted-with titles through shared recommendation helpers and applies
minimum aggregate voting-count and score filters. It returns no results without positive examples.
These are observable selection rules, not evidence that the recommendations satisfy users.

The homepage's [recommendation section](../../goodwatch-webapp/app/ui/home/RecommendedForYou.tsx)
renders only from four scores with nonempty results. Homepage metadata says three ratings;
the quiz gate uses five. These differing thresholds warrant verification before consolidating copy.
The [quiz recommendation swiper](../../goodwatch-webapp/app/ui/taste/components/RecommendationSwiper.tsx)
renders poster/backdrop cards without a title-detail link in those card components.

The [taste profile](../../goodwatch-webapp/app/ui/taste/TasteProfile.tsx) shows progressively
unlocked taste features. Configuration covers genre, decade, creator, and full Fingerprint views;
neighbor discovery is explicitly marked coming soon. This is existing scope, not an entirely new feature area.

## Saved titles and other personal actions

The [member homepage](../../goodwatch-webapp/app/ui/home/LoggedInHome.tsx) includes recommendations,
a rating prompt, watchlist, mood discovery, and trending sections.
The [watchlist reader](../../goodwatch-webapp/app/server/watchlist-items.server.ts) joins saved
movie/show rows to catalog details and orders by latest addition.
Its [homepage section](../../goodwatch-webapp/app/ui/home/YourWatchlist.tsx) links to `/wishlist`.

The separate [wishlist route](../../goodwatch-webapp/app/routes/wishlist.tsx) maps normalized
action data to IDs/timestamps, while its rendering expects media details. Its filter-change handler
only logs values, and its final item filter accepts every item. This supports a **partial** classification;
it does not establish the exact user-visible failure without running the route.

[Mutation hooks](../../goodwatch-webapp/app/hooks/useUserDataMutations.ts) and action routes
support scores, favorites, watch history, skipped titles, and wishlist changes.
A full standalone ratings/history/favorites management journey was not established by this read.

## Streaming settings and imports

[Country settings](../../goodwatch-webapp/app/routes/settings.country.tsx) save `country_default`;
[streaming settings](../../goodwatch-webapp/app/routes/settings.streaming.tsx) save provider IDs.
Existing preference storage should not be mistaken for verified filtering on every recommendation surface.
The member recommendation reader above does not consume these preferences explicitly.

The [guest import hook](../../goodwatch-webapp/app/ui/onboarding/hooks/useGuestRatingImport.ts)
submits local interactions and clears guest storage after success.
The [import action](../../goodwatch-webapp/app/routes/api.import-guest-interactions.ts) requires
authentication and upserts scores, planned titles, and skips into the member's tables.
This is a GoodWatch guest-to-account transfer, not an IMDb, Letterboxd, Trakt, or CSV importer.
Searches of webapp source and pipeline Python/TypeScript did not locate an external user-history import flow.

## Instrumentation and missing runtime evidence

[Root initialization](../../goodwatch-webapp/app/root.tsx) configures PostHog outside localhost,
identifies signed-in users, and explicitly captures initial-login properties and a pageview.
Initialization also runs for guests; absence of explicit funnel events does not rule out SDK autocapture.
[Client initialization](../../goodwatch-webapp/app/entry.client.tsx) configures Sentry tracing,
session replay, and PostHog integration. No live account or dashboard was inspected.

The [poster impression endpoint](../../goodwatch-webapp/app/routes/api.poster-impressions.ts)
deduplicates catalog impressions and increases crawl priority. This is data-refresh demand evidence;
it should not be treated as a verified recommendation-conversion or retention dataset.
No user notification flow appeared in the scoped app search; privacy-page wording is not implementation evidence.

## Questions the evidence can answer next

1. What happens from guest ratings through signup to the first member recommendations, including existing accounts?
2. Which recommendation surfaces honor country/provider preferences, and which only display them elsewhere?
3. What can a user actually do with a saved title on the homepage versus the separate wishlist route?
4. Which existing analytics events can reconstruct quiz completion, saving, streaming-link clicks, and return visits?
5. Which backlog items describe missing capabilities, versus incomplete or already implemented paths listed above?

These are verification questions. Answers should inform later product choices rather than assume them now.

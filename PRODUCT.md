# Product

<!-- impeccable:product-schema 1 -->

This file covers the GoodWatch product family. It holds the product truth all apps share. Each app keeps its own `PRODUCT.md` with its platform and app-specific facts, and that file wins where the two differ:

- `goodwatch-webapp/PRODUCT.md`: GoodWatch on the web (goodwatch.app).
- `yepwatch-app/PRODUCT.md`: YepWatch, choosing a watch pick together (iOS, Android, and browser guests).

More apps will join the family. Give each new app its own `PRODUCT.md` that inherits this one.

## Users

The primary user is someone who wants to watch something now and doesn't know what. They often pay for several streaming services and still scroll without choosing. Their job is to reach a confident choice of a movie or show they'll enjoy and can watch tonight.

The same people also track and score what they watch. Tracking matters because it curates their taste: every rating, watch, and import is a data point the recommendations depend on. Tracking serves the choice, not the other way round.

## Product Purpose

The family helps people find movies and shows that fit their taste and their evening, then actually watch one. Success is a worthwhile suggestion that turns into a watch, not time spent browsing.

The shared engine combines the following:

- One score built from IMDb, Rotten Tomatoes, Metacritic, and TMDB.
- Streaming availability per country and per service (325 services in 139 countries at the time of writing).
- A taste profile built from the member's ratings, watches, and imports, used to say how well each title fits them.

## Positioning

Recommendations come from the member's own scored history, matched against per-title analysis, and are filtered by where the title streams for that member tonight. A catalog site can't copy the taste fit, and a tracker can't copy the availability filter.

## Operating Context

- A member account is shared across the family. Ratings, watches, Wishlist, show progress, and streaming services saved in one app are available in the others.
- GoodWatch is also reachable from AI apps through its MCP server.
- Decisions usually happen in the evening, on a phone or in front of a TV, often with other people in the room.

## Capabilities and Constraints

- Domain terms are defined in `CONTEXT.md` (for example: worthwhile suggestion, interest discovery, watchability check, unknown availability). Use those terms in UI copy and docs.
- Unknown availability (unknown, or last checked 30 or more days ago) is distinct from a confirmed "not on your services" result. Never present one as the other.
- People can explore without an account. Sign-in unlocks taste, tracking, and saved services.

## Brand Commitments

- Product names: GoodWatch and YepWatch. GoodWatch is the parent brand. YepWatch says it runs on GoodWatch.

## Evidence on Hand

- Product description and feature claims: `README.md`.
- Domain language: `CONTEXT.md`.
- Architecture decisions: `docs/adr/`.
- No testimonials, customer quotes, press, or user-count claims are on record. Don't invent them.

## Product Principles

1. **A choice beats a catalog.** Every surface moves the person toward one title they'll watch, not toward more browsing.
2. **Data points feed taste.** Rating, logging, and importing must stay fast and low-friction, because recommendations are only as good as the data behind them.
3. **Availability is honest.** Show where a title streams for this person, and say plainly when that isn't known.
4. **One member, many apps.** Shared account data and shared terminology across apps. Each app may differ in look and interaction where its situation demands it.

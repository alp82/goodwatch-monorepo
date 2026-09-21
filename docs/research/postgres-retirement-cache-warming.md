# Cache-warming reliability research

Research date: 2026-09-10. Read-only source and Windmill API inspection; no deployment, production mutation, browser automation, or automated test added.

## Findings and confidence

**Confirmed timeout configuration defect.** `visit_pages` creates a context and sets its timeout to 10 seconds, then passes the Browser object to `visit_page`. The latter calls `Browser.new_page`, creating another context that does not inherit the configured timeout. The annotation says `BrowserContext` but does not change the runtime object. Playwright documents this implicit context behavior and recommends explicit context/page ownership for production code. [Script](../../goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py), [Browser.new_page](https://playwright.dev/python/docs/api/class-browser#browser-new-page).

**Confirmed failure mode, incomplete latency diagnosis.** Job `01a0896c-2526-9641-ce8a-6fc907215c5f`, started 2026-09-10 03:55:30 UTC, failed at `page.goto` for the homepage after 30 seconds while waiting for `load`. The inspected earlier failure `01a08959-eb4b-8062-7459-d3a44d7d0915` has the same signature. Eight latest sampled runs, 05:45–06:55 UTC, succeeded in roughly 31–38 seconds total. This is intermittent, not permanent inability to reach the homepage. Logs do not distinguish slow main document/SSR, assets, iframes, or worker-specific network delays. Do not claim a particular third-party resource caused it. Primary evidence: authenticated Windmill GET `/api/w/goodwatch/jobs_u/get/{id}` and completed-job list filtered to `f/utils/visit_goodwatch_and_populate_cache`. No tokens are recorded here.

`goto` defaults to the `load` event and a 30-second timeout. `DOMContentLoaded` is a different milestone; neither event proves application-specific work completed. Playwright discourages `networkidle` as a general readiness criterion. [Page.goto](https://playwright.dev/python/docs/api/class-page#page-goto), [navigation lifecycle](https://playwright.dev/python/docs/navigations).

**Confirmed incomplete/falsely successful coverage.** A navigation exception escapes the per-URL loop, preventing the remaining five URLs from running. HTTP errors are merely printed, so a run can succeed despite a failed page. The two configured `/tv-shows` URLs are invalid under current routes: valid types are `movies` and `shows`; invalid types redirect home. Playwright follows redirects, so final HTTP 200 can incorrectly count homepage success as shows coverage. [Script](../../goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py), [valid types](../../goodwatch-webapp/app/ui/explore/config.ts), [type loader](../../goodwatch-webapp/app/routes/$type._index.tsx), [category loader](../../goodwatch-webapp/app/routes/$type.$category._index.tsx).

**Cache success is currently unproven.** The script prints “cache populated” based solely on HTTP 200. The server cache wrapper intentionally returns computed data when Redis is unavailable or cache writes fail. A successful response is therefore evidence of route serving, not a cache write. [Cache wrapper](../../goodwatch-webapp/app/utils/cache.ts).

## What should be warmed?

The anonymous homepage awaits showcase examples; personalized trending/recommendations/watchlist load only for signed-in visitors. `/discover` awaits initial discovery results. Category pages such as `/movies/moods` and `/shows/moods` await a batch of discovery queries in their loaders. `/movies` and `/shows` return navigation metadata, with viewport-driven link prefetching in the browser: warming those pages alone does not deterministically warm every linked catalogue. Country/language affect the data/cache keys. [Homepage](../../goodwatch-webapp/app/routes/_index.tsx), [showcase cache](../../goodwatch-webapp/app/server/showcase-examples.server.ts), [discover loader](../../goodwatch-webapp/app/routes/discover.($type).tsx), [category loader](../../goodwatch-webapp/app/routes/$type.$category._index.tsx), [type page](../../goodwatch-webapp/app/routes/$type._index.tsx), [locale](../../goodwatch-webapp/app/utils/locale.ts).

Inference: explicit anonymous server-data targets are a clearer warming contract than a full browser load. A browser remains useful if the intended scope includes hydrated client requests, visual health, or link prefetch. HTTP-only requests could cover awaited SSR loaders, but require response/content validation and separate cache evidence. Do not silently replace the browser before agreeing which of these is the goal.

## Recommended ticket

**Make scheduled cache warming cover valid routes and report actual outcomes.**

1. Define the anonymous country/language and target list; replace `/tv-shows` with `/shows`. Retain six conceptual targets initially and document which actually invoke cacheable data.
2. If retaining Playwright, create pages from the configured context and set an explicit navigation timeout. Use `domcontentloaded` plus route-specific required data/readiness checks where needed. Remove arbitrary sleep as proof of readiness. Reuse a bounded browser lifecycle and close each page reliably.
3. Record requested/final URL, response status, elapsed time, main document timing and failed/pending request metadata on failure. Strip sensitive headers/query values; bound retained diagnostic artifacts. Capture a trace from a failing worker before attributing the 30-second delay.
4. Attempt every target, optionally retry only transient failures once within a total run budget, then fail the run if any required target failed. Return a structured per-target result. Never mark HTTP errors or wrong-route redirects successful.
5. Either add verifiable cache hit/write telemetry for agreed target keys, or rename the result to successful route warmup and explicitly separate cache verification from navigation success. No full Redis key scans required.

Acceptance: all required valid routes attempted despite one failure; wrong-route redirect and HTTP error produce failed target; configured timeout is effective; successful scheduled runs show the expected route/data, and cache telemetry proves the agreed warming contract. Verify manually through the allowed browser tooling and scheduled job output; the webapp's [AGENTS.md](../../goodwatch-webapp/AGENTS.md) prohibits writing automated tests. A successful run must not depend on unrelated assets completing.

## Decisions for the combined interview

1. Is this job intended to warm anonymous server-side data, or also monitor hydrated page behavior? Recommend server-data warming, with browser health treated explicitly if retained.
2. Which locale should be guaranteed warm? Recommend one explicit primary locale initially; do not infer multi-country coverage from six URLs.
3. Is a cache-warming defect itself a Postgres deletion blocker? Recommend separate operational tracking once required data pipelines demonstrate no Postgres dependence; cache failures should still fail this job honestly.

# Episodes reserve their initial layout

The owner selected B, the reserved skeleton, on 27 October 2026. The comparison designed with Opus at medium effort is archived on `prototype/episode-loading-options-20261027` (`d7df35ed5`); the comparison route and its page override are excluded from the implementation.

A member's show loader reads public catalog counts in parallel, within the existing one-second optional episode budget. The counts follow the reviewed episode presentation where present; they never reinterpret watch identities. The initial skeleton uses those counts and CSS container queries to match the wrapping grid before JavaScript runs. It uses one placeholder row per season, including for very long catalogs. The member history and tracking code still load near the section. The same heading reserves the Next control, and every show initially shows its overview; a season opens by choice.

The skeleton is not under `content-visibility`'s estimated-height reservation. Its exact responsive layout is available at the first paint. Failed reads keep the space and offer Retry. If the catalog changes between page load and the tracking read, Reload episodes explicitly accepts the new shape. Without catalog counts, the existing read-only grid remains until tracking is explicitly requested. Consistency uses the same fixed 1–10 score axis for guests and members.

Retired, unreferenced `Ratings` and `Streaming` components and the disabled details-page streaming block were removed. The score-rendering regression still tests the live poster pill and details score ring. There was no legacy episode feature flag selecting the older UI: the first comparison had used a stale checkout.

## Verification

- Production build passes. The 21 layout/grid tests, live score-rendering test and five title-timeout tests pass.
- `scripts/check-episode-loading.mjs` uses the real gate, skeleton, overview and tracking components with the existing in-memory server. Twelve combinations of show and width (390, 768 and 1,440 px) have identical server-rendered skeleton, hydrated skeleton and loaded section heights. Separate failure, changed-catalog and empty-response cases retain the reservation and recover on explicit retry.
- A matched TypeScript check against `d5fa01bd7` has no introduced diagnostic; removing the retired streaming component removes three baseline diagnostics. Repository-wide type checking still has existing failures.
- The default full budget command cannot expand an unset `SHARE_LIST_PATH`. A temporary show-only budget, with unchanged limits, was exercised against baseline and candidate production builds in the same local Lighthouse container at CPU slowdown 2.7. This is one sample each, not a timing calibration. Baseline/current: script bytes 430,291/432,064, script requests 40/40, total bytes 715,797/718,363, LCP 2,716/2,722 ms, TBT 7.5/9 ms, CLS 0/0, score 95/96. Both exceed existing HTML, request and script budgets. The committed allowance adds only this change's initial-render cost (2 KiB script, 4 KiB total and 1 KiB HTML); it does not erase inherited budget debt.

Run the browser check against a development server with `PLAYWRIGHT=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome node scripts/check-episode-loading.mjs` from `goodwatch-webapp/`. Its server and mutations are in memory; no member data is written.

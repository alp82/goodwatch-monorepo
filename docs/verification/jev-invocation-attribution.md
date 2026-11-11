# JEV invocation attribution verification

Verified on 2026-11-11 against `origin/main` at `33edb0523`. No production database migration, application deployment or paid model call was performed.

## Checks

- The focused server/browser suite passed 120 tests, including the actual start field, Discover controls, enum/trust boundaries, authenticated YepWatch actor forwarding, cache identity, spending settlements and reconciliation.
- The combined-search title lookup suite passed its 48 existing tests. The added invocation-correlation test passed separately after supplying its required AbortSignal: distinct server UUIDs join each history row to its reading-stage context for both guests and members.
- The TV search tests passed 20 tests.
- The additive SQL migration passed against a disposable local CrateDB 5.10.9: legacy rows remain null; strict objects round-trip; estimates and negative adjustments group to the correct total; unknown object keys are refused.
- Client and server production builds succeeded using the same dependencies for baseline and candidate. Missing dependencies in the retained local install were supplied from a separate temporary install; no application environment file or production database credentials were loaded.

- Full TypeScript checks report the same 179 pre-existing diagnostics on both baseline and candidate, with no added diagnostic after ignoring shifted line numbers.

## Existing failures

The required `./bench.sh budget --runs 1 --label jev-attribution-baseline` was run against the currently deployed site, before this change is deployed. Run: `20261111T184149Z-lighthouse-jev-attribution-baseline`. All six surfaces failed at least one existing cap, including home TBT (1,012 ms versus 150 ms), movie script transfer (406.5 KB versus 357 KB), and existing image/third-party/layout checks. These are deployed-baseline results, not measurements of the candidate. Caps were not raised.

The broader `early-people-hold.test.ts` and `late-catalog-sibling.test.ts` checks failed in both the task checkout and an unchanged checkout of the same `origin/main`: two people-index/credits fixture failures and two catalog fixture assertions. These unrelated failures were preserved.

## Compiled JavaScript comparison

Static route JavaScript closures (entry, route ancestors and manifest-listed static imports), compressed per file with gzip level 9. This isolates code-size impact; it does not simulate landing-page loading, dynamic imports or Lighthouse timing.

| Surface | Baseline files | Candidate files | Added gzip bytes |
| --- | ---: | ---: | ---: |
| Person | 21 | 21 | 321 |
| Discover | 27 | 27 | 559 |
| Movie | 29 | 29 | 358 |
| Show | 29 | 29 | 356 |
| Home | 24 | 24 | 542 |

Deployment order and billing-period queries are in [search invocation attribution](../search-invocation-attribution.md).

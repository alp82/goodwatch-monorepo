# Exact search resolution verification

Verified November 12, 2026, before shipping. No local webapp was started against production databases. No paid provider calls were made during development or replay.

## Automated checks

- 179 focused tests passed across matching, filters, request transport, runtime history, Start and the resolved-search gate; 107 relevant tests passed again after integrating current main and fixing Start catalogue browsing.
- 49 existing combined-search/title-lookup composition tests passed.
- 50 title-filter tests, including strict trope membership, recovery counts and the performance checks, passed without a competing build.
- 26 UI/rendering checks passed.
- The real membership and resolved retrieval SQL passed against an isolated local CrateDB 5.10.9, including redirects, eligibility, empty membership and filter intersections.
- The 14 YepWatch continuous tests affected by integrated main changes passed.
- Production client/server builds passed before and after integration. TypeScript reports the same 111 distinct normalized diagnostics as unchanged main, with no new diagnostics; the repository-wide typecheck is not green.

## Request replay

A read-only replay of 1,238 November 11 requests resolved 27 tropes and 36 titles (63, 5.1%). The remaining 1,175 were unresolved or ambiguous. The replay used 30,132 canonical tropes, 72,186 eligible movies and 13,188 eligible shows. It included canonical/original title names; production also includes localized aliases. No essence tags were considered.

## Landing-page budget

The required `./bench.sh budget --runs 1 --label exact-search-baseline` ran against the deployed, unchanged site. All six surfaces already failed their configured budgets. Existing script/font/origin and timing violations are retained for a separate performance task; no limits were raised.

Compiled initial JavaScript import closures, compressed per file with gzip level 9, compared against task-base main (a2d7ecd4b):

| Route | Additional gzip bytes |
| --- | ---: |
| `routes/person.$personKey` | 345 |
| `routes/discover.($type)` | 456 |
| `routes/movie.$movieKey` | 397 |
| `routes/show.$showKey` | 396 |
| `routes/_index` | 579 |

These static import-closure sizes describe the patch, not a Lighthouse score or a claim that the existing budgets pass. Live deployment checks and their logs are retained in the ignored benchmark results directory after shipping.

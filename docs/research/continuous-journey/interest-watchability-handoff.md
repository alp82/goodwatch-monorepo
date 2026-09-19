# Interest discovery and explicit watchability

Delivery asset for [Implement interest discovery and explicit watchability checks](https://github.com/alp82/goodwatch-monorepo/issues/92). Local implementation and Chrome DevTools verification on 2026-09-19; production acceptance remains with [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94).

## Delivered behavior

The existing Taste suggestions view opens immediately. Its Remix loader supplies general or history-informed suggestions before client queries refresh shared progress. No availability input or rating quota is required. General retrieval uses the existing catalog, mixing movie/show candidates; usable positive ratings and Want to See titles feed the existing fingerprint recommender. Low-only, absent or unindexed positive history falls back to honestly labeled general suggestions. Rated, skipped, watched and Wishlist identities are excluded using composite movie/show point IDs. Skip is not a negative taste seed. Wishlist remains a separate watch-choice path.

Genre refinement and What can I watch? are additions within the existing layout. The latter obtains country/services, defaults to included/free/ad-supported offers, and requires explicit paid opt-in. Saved services never limit initial interest discovery. The old Discover streaming editor no longer switches to Mine when opened. Catalog grids and Wishlist share the explicit check. Search, homepage, category and exploration title links reach the same real details viewing-options check; the header's Taste path remains available. Existing member Taste insights remain available.

Recommendation-result cards open real details and retain the active suggestion pool, Taste view, carousel, scroll and refinement state through the existing exploration context. Current watchability selection uses existing country/service persistence; paid opt-in is part of discovery continuity. Nearby directions show actual initial title previews, describe the constraints they relax, and require a separate explicit action before changing active filters. Unknown and current no-match titles remain discoverable and can be marked Want to See.

Details show only current source-specific confirmed offers, including that source's price/quality/clickout if present. Missing, stale, conflicting or otherwise insufficient proof stays Availability unknown. Complete current negatives say No matching offer found. No legacy streaming row is promoted into confirmed proof. Recent offers do not promise playback entitlement.

## Interfaces

- `getInterestDiscovery(history?, genre?)` returns `{ recommendations, basis }`; `basis` is general/personalized according to the path that actually returned candidates.
- `POST /api/interest-discovery` validates bounded browser interactions and genre. Authenticated requests use server-side member history. Responses are private/no-store. The browser filters newly acted-on composite identities immediately while refreshed suggestions load.
- `POST /api/watchability` validates country, selected services, paid flag and up to 100 title scopes. Reads run in groups of eight through `getAvailabilityEvidence`; canonical identity and country are retained. Responses include raw envelopes plus server evaluations and are no-store.
- `useWatchability` reevaluates raw evidence on every render/selection and schedules the next expiry; focus/visibility also reevaluate. It never caches an indefinitely valid boolean. Larger loaded lists use bounded API batches; catalog watchability does not automatically page through the entire catalog.
- The [availability publication handoff](availability-publication-handoff.md) and [timestamp contract](availability-timestamp-contract.md) remain authoritative for source/age semantics.

## Runtime evidence

Chrome DevTools used isolated browser contexts. Account checks used the already-authorized private fixture; credentials are not in this asset. Availability positives/negatives used a disposable browser fetch fixture supplying only raw source envelopes to the real consumer/evaluator. No production title, offer, source evidence or member history was written for these checks. Real local loaders/API still read live catalog data and safely return unknown before evidence rollout.

| Acceptance case | Local observation |
| --- | --- |
| Zero ratings/services | General suggestions immediately displayed; 40 candidates mix movie/show identities; optional refinement and real details links work. |
| Interest before services | Initial candidates remain visible without availability input. What can I watch? is an explicit separate step; missing selections request input. |
| History/exclusions | Want to See on real details survives returning to Taste and provides personalized seeds. Authorized member fixture with one score, skip and Wishlist title returned 40 personalized candidates and none of those excluded titles. Low-only history returned 40 general candidates. Skipping movie 15 retained show 15. Watched exclusion uses the same composite path; the member fixture had no watched entries. |
| Paid offers | A 40-title mixed fixture yielded 13 included matches; opting into paid offers increased this to 20. Seven rental-only titles moved from current no-match to confirmed. |
| Unknown vs current negative | The same fixture separately displayed 13 stale/conflicting unknowns and 14 current no-matches before paid opt-in (7 afterward). An actual displayed current offer crossed its 30-day expiry and changed to Availability unknown with its offers removed, without navigation. |
| Interest despite unavailable | Want to See persists independently of offers. Real details expose available alternatives without replacing the desired title. API-only fresh proof alongside stale web proof displayed no stale web URL, HD or price. |
| Weak/empty recovery | A synthetic empty genre constraint returned real nearby general movie/show previews, stated the relaxed genre, and retained the active constraint. Watchability previews explicitly state they are not confirmed matches. |

Desktop and 390px mobile walkthroughs cover real details/return, genre continuity and no horizontal overflow. Screenshot and Lighthouse results are recorded with final validation below. This is bounded functional evidence, not a claim of catalog-wide recommendation quality or production availability coverage.

## Release handoff

Use the [deployment and recovery runbook](deployment-recovery-runbook.md). No deployment belongs to this ticket. Publish additive availability evidence before expecting confirmed production offers. Verify real fresh positive, paid-only, complete empty/no-match, stale, conflict, independently fresh source, country and service changes, and displayed/cache expiry in production. Confirm zero-history and member suggestions, composite exclusions, Wishlist, unavailable-title interest and alternative previews on desktop/mobile. Authenticated Google callback remains the separately recorded release gate. Existing account transfer/recovery paths must remain intact.

General discovery still depends on the catalog/Qdrant service. Result checking covers the loaded candidate pool, not every title in the catalog. Unknown remains the correct outcome until sufficient scoped proof is published; broad rescraping is not added or required here.

## Final validation

[Desktop screenshot](interest-discovery-desktop.png) · [Mobile screenshot](interest-discovery-mobile.png) · [Sanitized Lighthouse results](interest-watchability-lighthouse.json).

Lighthouse navigation audit: desktop accessibility/best practices/SEO **100/100/100**; mobile **96/100/100**. The new heading-order finding was corrected and rechecked; remaining mobile unnamed links belong to the existing shared navigation. The audit also reports its separate agentic/llms.txt findings; no performance-score claim is made.

Typecheck reports 266 existing diagnostics, down from 272 because obsolete imports/section access in replaced components were removed. There are no new substantive diagnostic signatures; one unchanged union-type error prints members in a different order. No automated webapp tests were added. The production client/SSR build and whitespace checks pass. A subsequent carousel-control isolation fix was checked with TypeScript and Chrome DevTools (Next advanced index 0 to 1 using its own instance ID).

A desired-title fixture with a complete current negative displayed 39 confirmed alternatives on its real details page while keeping the desired title open. Marking that title Want to See remains independent of this availability result. The separate Wishlist then showed both saved titles; its explicit check displayed one confirmed card and one current no-match without removing either saved interest. The source-specific and expiry fixtures are consumer checks, not deployed source freshness evidence.

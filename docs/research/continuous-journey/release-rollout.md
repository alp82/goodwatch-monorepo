# Continuous journey production rollout

Deployed; production acceptance remains open as of 2026-09-19. Runtime candidate `95b81052825f783c03eb05d685bba0c960fcc804` includes the user's empty-review correction. The user reported a real Google callback reaching the app and identified the empty-review issue. This establishes the actual provider round trip, not every OAuth transfer assertion. Controlled authenticated transfer/recovery evidence and the follow-up no-op/confirmed-retry evidence are recorded in AccountTransfer.md. No personal browser session or provider credentials were inspected.

## Recovery secured before release

Known-good image `gk4owk8:58aa7b3683f82ee4ea58f7da1007ee76400a7115` retained. Guarded recovery image `gk4owk8:d559b358dcdacb0126aa1b0a70c5cb150a17d326`, image ID `sha256:435ff4520048e6ea485c8ea530179c658d4199ef7ad2c721411a3aa7d8fe4279`, was built on the destination from the actual known-good image, with only the exported legacy import route replaced by the prepared recovery source's 503/no-store behavior. This preserves the exact old runtime/client while disabling unsafe selected-transfer replay. Its imported real route handler returned 503/no-store in an isolated no-network container. The clean recovery-source build also passed. It is a derived image, not a claim that Coolify independently rebuilt that source revision.

Both images are archived at `/data/coolify/journey-recovery-20260919/images.tar.gz` on the destination (private, gzip integrity checked), SHA-256 `81b6bd5dcec5042fe4b72c2dd156cb17fbdadf7b894ad0d466a58b8c916479d5`. Runtime generated configuration is separately archived there. Fresh control-plane configuration and environment snapshots remain in the private release state directory. Restore via the verified installed Coolify helper with the guarded image tag and `rollback:true`, loading the archived image first if pruned. Never clear browser snapshots or restore old account data.

## Availability rollout completed

Created the additive `streaming_evidence` table with verified columns. Created/verified failed-at, API-attempt and both partial invalidation indexes on movie and TV source collections. Exported live definitions/locks/schedules and acceptance-source snapshots before writes.

Deployed and exactly read back coordinated Windmill scripts:

| Script | Hash |
| --- | --- |
| API evidence helper | `fd690e330624260d` |
| Publication evidence helper | `4bc08ed8e0fb33e8` |
| Crate models | `0a0962c06fc96344` |
| Crate schemas | `d488dc403bf95e84` |
| API models | `485b9d2d4dc87285` |
| API fetch | `a0e202a15217354d` |
| Streaming publisher | `64a55d7441416c3d` |

Five affected schedules were temporarily paused. The old long-running scheduled publisher was canceled and its active title 17003 included in bounded reconciliation. A pre-existing priority parent drained into the new publisher. All five schedule states were restored and read back: streaming, populate-Crate, priority, API-init enabled; direct API-fetch remains disabled. No schedule remains paused by this release.

Real API job `01a0b845-c065-6068-3c66-d27f75295e75` successfully captured source-bound proof for movies 256591/1226863 and show 1399. Bounded publication produced country envelopes: Focus 133, Mario 64, interrupted title 64, Game of Thrones 127. One preview supplied a scalar show selector rather than the documented `$in` selector and failed after successful movie publication; corrected job `01a0b84c-f2ad-3565-6bef-9270a0df7361` succeeded. This was an invocation correction, with no fabricated source data.

A historical apparently empty CV source lacked its links field, so it correctly stayed unknown. Normal bounded web-fetch job `01a0b84c-1b1f-a94c-4ded-e3c2b778c9d3` established explicit fresh `[]`, then republished it. Actual reader/evaluator results against this production data: Focus/BR service 1825 watchable; Focus/DE service 8 unknown; Mario/DE service 2 no-match with paid off and watchable with paid on; Mario/CV service 2 no-match with paid off and source-conflict unknown with paid on. The latter independently preserves the API's two offers alongside the web's verified empty result. These initial evaluations ran through the local real read boundary; the same six-case matrix subsequently passed through the deployed production `/api/watchability` endpoint.

## Webapp release and acceptance

Coolify deployment `qnxklx0h8heyvm7ngdzwa89v` was queued for the exact published candidate SHA using the verified operator path. Deployment finished at 06:19:35 UTC. Destination container `gk4owk8-060722178746` runs image `gk4owk8:95b81052825f783c03eb05d685bba0c960fcc804` and passed health verification. The guarded recovery image remains available. The release task and map stay open until agreed production acceptance is complete.


### Production browser evidence

Chrome DevTools isolated controlled contexts, September 19, production runtime above; desktop 1440px and mobile 390×844 where noted. No personal session inspected.

- Fresh browser Taste shows immediate general suggestions and real movie/show links without requiring ratings or an account. Browser Wishlist action on Interstellar survives navigation/reload.
- Existing completed account password sign-in returns to Discover. Review presents new Wishlist entry and changed country, both preselected. Unchecking country and transferring only Wishlist preserves the existing country. Before confirmation no Wishlist write occurred.
- Actual browser offline failure preserves confirmed selection. Reload online retains Retry; successful retry saves the selected Wishlist entry, clears transferred browser interactions and pending review. Reload preserves the account entry.
- Actual partial write: after opening review, changing the controlled account country causes the preference concurrency check to fail while the selected Wishlist write succeeds. Both confirmed choices remain retryable after reload; restoring the reviewed baseline and retrying completes the country change and cleanup. No fabricated error response used.
- Logout clears account interaction state. Returning with preferences identical to the account produces no review dialog and no pending transfer. This proves the final production state; transient empty-dialog prevention was observed in the local follow-up QA, not independently instrumented across the production navigation.
- Fixture cleanup readback: existing account country restored to US, original service8 retained, added Interstellar absent from reloaded Wishlist (nine original linked titles). Only owned test additions removed.
- Personalized interest results contain40 candidates and exclude the controlled account's scored, wanted, skipped and watched composite IDs. Mobile Taste opens a real title and preserves its serialized40-title exploration pool. Full browser-back render continuity was not independently asserted from the immediate navigation snapshot.
- Mobile homepage, Taste, Discover, genre index/Drama list, movie/show details, Wishlist and country settings load. Fresh-browser homepage and tested mobile journey surfaces fit the viewport. An earlier immediate member homepage snapshot showed overflow; this was not established as a regression. Legacy `/explore/movies/genres/drama` redirects to `/movies`. Some navigations reported browser `ERR_NETWORK_CHANGED`; successful retries are distinguished from failed attempts.
- Desktop search for Focus returns real suggestions and opens movie256591; search text remains after back navigation. Production Discover renders actual recommendations. A filtered Discover navigation encountered the browser network error and is not claimed as a preserved-filter pass.
- Live Focus/BR/service1825 renders two matching offer links with independent source names and checked dates. Browser-only clock advancement31days plus focus re-evaluation makes it unknown and removes both links; clock restored and full navigation performed. No source timestamps changed for this test.
- Live Mario/DE/service2 renders no matching offer with paid disabled; clicking the real rentals/purchases checkbox yields matching offers and four links. Details fit390px. The six-case API matrix above independently covers unknown and conflicting empty/API evidence.
- Production Lighthouse on Taste: desktop accessibility100, best practices100, SEO100; mobile96/100/100. Contemporaneous old-production baseline95/100/100 and91/100/100 respectively. Performance was not audited. Reports retained locally under `/tmp/goodwatch-release94-lighthouse-production-{desktop,mobile}`.

### Remaining acceptance and durable integration

A genuine production signup succeeded using the authorized disposable email alias ending `20260919-0623`; the original isolated browser holds its automatic-transfer snapshot (Interstellar, DE/service8, return Discover). Email confirmation must be completed by the inbox owner in their own browser. No admin confirmation or fabricated callback was substituted. After confirmation, sign in in the original controlled browser and verify automatic transfer, intended destination, reload persistence and cleanup. The parent session has already requested this one inbox action; no credentials or confirmation URL need to be shared.

Production acceptance is not declared complete. Local source-matched evidence covers the full earlier account/rating/constraint matrix, but production rating reminder/20-title boundary, incomplete-account continuation, and unchanged-constraint alternative preview have not yet been individually replayed. Complete these bounded observations with the final account verification before resolving #94. The actual user-reported Google round trip is recorded above without claiming a separate production provider run.

The published release branch contains the live runtime; `main` remains at prior production `58aa7b3`. Integrate the accepted release into the durable deployment branch after final acceptance, coordinating its automatic webapp/flow workflows rather than silently triggering another simultaneous rollout. All affected Windmill schedules have already been restored. #94 and parent #82 remain open; the map's remaining fog is scoped only to concrete findings from outstanding production acceptance, not a reopened broad algorithm/data program.

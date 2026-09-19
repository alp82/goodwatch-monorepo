# Continuous journey release checkpoint

Prepared 2026-09-19 for [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94). **Not deployed; release acceptance remains open.**

## Exact integration

Candidate `0786981825bddd11c13ffb7a43db037f6876f087` on `release/continuous-journey`, worktree `/tmp/goodwatch-release94`, merges completed delivery `e251efa` into current production history `58aa7b3683f82ee4ea58f7da1007ee76400a7115`. The webapp tree is identical to delivered `e251efa`. Accepted design revision `ef163b0ac13be83069fa042a192d274f35c85acf` is an ancestor; its ExploreBar is unchanged. Recommendation cards retain real detail links through the delivered implementation. Rejected JourneyDetails/JourneyPrototype/journey-session files are absent. Upstream committed Jev research remains intact. Untracked Jev search routes, README edits and other local research were not included. Later checkpoint documentation commits do not change runtime code.

## Completed independent checks

- Clean candidate production client and SSR build passed. No automated webapp tests added.
- Contemporaneous current-production-source TypeScript: 287 diagnostics; candidate: 266. Comparing file/message signatures while ignoring moved lines and union-member order yields zero new diagnostics, 21 removed. Existing errors remain; this is not a clean typecheck.
- Candidate pipeline checks: 10 availability evidence, 30 streaming publication and 20 priority publication tests passed.
- Chrome DevTools navigation Lighthouse, fresh isolated unauthenticated Taste Quiz, desktop/mobile: candidate localhost accessibility 100/96, best practices 100/100, SEO 100/100. Current production accessibility 95/91, best practices 100/100, SEO 100/100. Same browser/tool and audit profiles; environments differ (development vs production). No material regression in these categories; no performance score or performance equivalence claimed. Agentic/llms.txt findings are separate and remain.
- Actual controlled existing account password sign-in reaches Taste. Its two existing watched titles are excluded from 40 personalized results. A stronger controlled watched-only check temporarily marked recommended movie 84092 watched, with no score/skip/Wishlist. After Crate visibility settled, 40 refreshed results excluded it. Immediate post-write reads can see different refresh states; the initial instantaneous probe is not counted as success. The owned added row was then removed; original account activity retained.
- Earlier scenario evidence remains in shared-guest-progress.md, AccountTransfer.md and interest-watchability-handoff.md. Their runtime source is unchanged in this candidate. They do not establish complete production acceptance or authenticated Google callback coverage.

Raw local build/typecheck logs and four Lighthouse reports are under `/tmp/goodwatch-release94-*`; private operational exports are under `/home/alp/.local/state/goodwatch/journey-release94` (0700, files 0600). Credentials stay in the previously documented private fixture paths.

## Live operational state and coordinated rollout

Rechecked established SSH operator route: Coolify healthy, owner deploy permission true, zero queued/in-progress deployments; last finished deployment `xuzfuntvswnsvzwjxgoy7xir` remains production commit `58aa7b3683f82ee4ea58f7da1007ee76400a7115`. No deployment or configuration mutation occurred. Refresh images/configuration immediately before actual release per deployment-recovery-runbook.md.

Exported the five affected existing live Windmill scripts, including locks, plus all 27 schedules privately. Existing hashes: streaming publisher `0999245320595c4f`, Crate models `4ef0495b0cbdfadf`, Crate schemas `5ffdaf803c3e136e`, TMDB API models `0288d0cad79be316`, API fetch `9a1092f60964e64f`. The new helper scripts are additive. Live Crate has no `streaming_evidence` table yet. Scheduled streaming publication, priority crawling and populate-Crate are enabled; direct API-fetch schedule is disabled. Preserve actual schedule states, including disabled ones.

After all local gates pass, pause/drain affected writers, snapshot source/configuration and retain recovery images, create only the additive evidence table, ensure the narrow Mongo indexes, deploy coordinated helpers/models/writer, restore prior schedule states, and run bounded real-source acceptance publication. Follow availability-publication-handoff.md for exact schema and model compatibility. Main auto-deploys webapp and triggers the Windmill workspace workflow, so do not push a partially staged candidate to main. Non-main checkpoint publication is not a release.

## State-preserving recovery

New account writes use existing score/Wishlist/skip/settings tables; the durable transfer journal is additive under `user_setting` keys `browser_transfer:<uuid>`. New browser transfer/discovery records are additive and the shared interaction key stays `onboarding_ratings`. Keep these records, journals and all post-release account activity. Never restore an older user database or clear user browser storage as rollback.

**The unmodified old webapp image alone is insufficient for safe pending-transfer recovery:** its legacy importer ignores selected-transfer journals and can replay interactions outside the confirmed selection. Prepared recovery source `d559b35` on `recovery/continuous-journey-import-guard` is current production source with only that import endpoint replaced by a 503/no-store response. Its actual bundled handler returns 503; legacy client error behavior retains browser progress. Full client/SSR production build passed. Other existing account writes remain available. Pending snapshots and completed journal parts can resume when corrected candidate code returns. This guarded source has not been deployed or built into a retained destination image; prepare and verify that recovery image before enabling the candidate, or establish an equivalently verified route guard with the retained image. Do not represent the current old image as satisfying this boundary.

Windmill recovery is independent: retain new compatible API model fields when rolling back writer behavior, or pause writers and snapshot then remove only the three new evidence metadata fields before restoring an older strict model, as documented in availability-publication-handoff.md. Leave additive Crate table/indexes and legacy offers in place. No new schema/writer mutations have yet occurred.

## Exact human gate and resume

Required authenticated Google callback is still unexecuted. An email plus alias is not a controlled Google login. Use an authorized disposable Google-provider account in a private local browser; never share its password or consent token. The MCP browser is headless, so the user's own local browser can execute the visible checks.

1. Open `http://localhost:3003/sign-in?redirectTo=%2Fdiscover`; use Google to establish a controlled existing GoodWatch account and complete country/service onboarding, then sign out.
2. While signed out, choose country/services and save a title using Want to See. Reopen the same sign-in URL and authenticate using that same controlled Google account.
3. Verify the actual callback returns to Discover and explicit transfer review appears despite completed onboarding. Confirm all intended changes are selected; verify nothing transfers before confirmation.
4. Confirm, reload and verify title/preferences persist. Sign out and verify transferred browser interactions are cleared while discovery/preferences remain. Report the visible result; do not send callback tokens.

If this exposes an issue, correct and revalidate. After this gate, finish the scenario-level local release matrix and fresh operational/image preflight, coordinate schema/writer rollout, deploy an exact recorded candidate, and execute the full desktop/mobile production acceptance matrix with controlled accounts (including actual Google callback and new-account confirmation/recovery). Real production source evidence and expiry behavior remain outstanding. Cleanup owned fixtures only after their downstream checks finish. Keep the release task and parent map open until all production acceptance passes.

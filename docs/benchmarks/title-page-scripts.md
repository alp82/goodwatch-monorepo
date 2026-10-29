# Title-page scripts

> **Outcome (October 29, 2026):** after rebasing, main already loaded about 294 KB of script on title pages, so on-intent loading of Browse, Search and Feedback saved nothing and made their first open on a cold phone 455-589 ms slower (Browse 182 -> 771 ms, `/` 384 -> 840 ms, Ctrl+K 559 -> 1,004 ms). Only the Feedback drawer's measure-after-reveal fix and its touch warm-up were merged. Most of the remaining production script weight is the analytics stack (Google tag 181 KB, Sentry 74 KB, PostHog 48 KB, FastStats 12 KB), which loads after the page is interactive.

This audit supports #784, “Instant page loads everywhere”. It compares the guest mobile baseline captured on October 29, 2026. Sizes are transferred bytes, including response headers, from run 1. They are not uncompressed module sizes. Later runs can use different deployment hashes. KB means 1,024 bytes in the summary below.

## Findings

Matrix and Game of Thrones each transfer about 737 KB of scripts. Primer transfers about 372 KB and the start page about 349 KB. The title routes share almost all their initial modules. The popular-title difference mostly comes from **when the audit ends**, rather than a 365 KB feature unique to those titles.

On Matrix, the social API request starts at 1.56 seconds and ends at 12.03 seconds. The social slot uses an 800 px observer margin, so it starts below the first view. Menu and analytics timers fire while the audit is still observing the page. The navigation dialogs add 44,817 bytes (about 44 KB); PostHog, FastStats, Sentry, the Google tag and their helper scripts add 321,988 bytes (about 314 KB). The social section adds another 7,402 bytes. These groups total 374,207 bytes, within 141 bytes of the Matrix versus Primer difference in run 1. Primer finishes earlier and does not capture those delayed tools. The tools still load for a person who stays on Primer. Changing a timer just to move these bytes outside Lighthouse would not remove their cost.

The audit sampled production HTML with sequential GET requests for Matrix, Game of Thrones, Primer and `/`. Title documents name only the classic related-map script directly, with no parsed `modulepreload` links. The `START_AFTER_PAINT` handle embeds the route imports and preload list inside the after-paint starter. Those requests begin after FCP and the hero picture paints, or after the 5-second fallback. This is distinct from postponing SSR content.

The map engine costs about 19 KB and runs before hydration. The trailer dialog and YouTube player already load on intent or play. The episode grid renders on the server; season details and member tracking load separately. Framer Motion is on the start page, but does not account for the title-page gap. No charting library or developer tool appears in these title request lists.

Across the three mobile runs, the medians are:

| Page | Script transfer bytes | Script requests | JavaScript boot-up audit (ms) | TBT (ms) |
| --- | ---: | ---: | ---: | ---: |
| Start | 357,305 | 34 | 278.8 | 9.5 |
| Matrix | 754,578 | 51 | 646.2 | 33.0 |
| Primer | 380,512 | 37 | 230.3 | 0.0 |
| Game of Thrones | 754,772 | 51 | 604.4 | 33.5 |

The boot-up audit is lab data, not a measurement on a real phone. Primer's second run transfers only 206,330 script bytes, so the inventory uses run 1 and the summary uses medians. The baseline also spans deployments. Use the paired local measurements below to judge the code change.

## Baseline request inventory

The tables list every script request in mobile run 1. “First view” means the module supplies behavior or shared runtime used by the initial screen, not that its execution is necessary to paint the server HTML. A mixed chunk contains first-view and below-fold code. All sources are paths relative to `goodwatch-webapp/` unless they name a package or provider.

Timing abbreviations:

- **Parse**: the HTML parser discovers the async classic script.
- **After paint**: the route's after-paint starter imports the module and its dependencies.
- **Idle**: the feedback drawer loads through `requestIdleCallback` or its timeout.
- **Near**: the social slot's observer and `afterNavigationWork` start its import.
- **Quiet**: the interactive-page trigger starts menu or analytics warm-up after its quiet window.

### /

| Chunk | Transfer bytes | Source | When | First view |
| --- | ---: | --- | --- | --- |
| `manifest-ca11fc58.js` | 8,900 | Remix generated route manifest | After paint | Yes |
| `entry.client-CcNGizgY.js` | 1,057 | app/entry.client.tsx | After paint | Yes |
| `react-B6r3mUaQ.js` | 41,635 | react, react-dom, scheduler | After paint | Yes |
| `shell-BpubkBoo.js` | 75,613 | root/entry static app dependencies; vite.config.js shell rule | After paint | Yes, mixed |
| `remix-Ba_M1-mz.js` | 37,249 | @remix-run/react, react-router, turbo-stream | After paint | Yes |
| `vendor-Clptqw0B.js` | 22,145 | root/entry shared libraries; vite.config.js vendor rule | After paint | Yes, mixed |
| `query-DloiJuQb.js` | 12,784 | @tanstack/react-query and query-core | After paint | Yes |
| `root-DJGhINYj.js` | 2,386 | app/root.tsx | After paint | Yes |
| `_index-LS_8SXQf.js` | 32,878 | start-page route or shared index route | After paint | Yes |
| `title-icons-DcBAuR9E.js` | 1,229 | ChevronLeftIcon and SparklesIcon; explicit feature chunk | After paint | Yes |
| `MovieTvCard-B2xwh-uW.js` | 3,959 | app/ui/MovieTvCard.tsx | After paint | No on titles; yes on start |
| `OwnerScore-qzS-sWQz.js` | 1,159 | app/ui/poster-card/OwnerScore.tsx | After paint | No on titles; yes on start |
| `title-actions-Jn29327c.js` | 4,934 | app/ui/title-actions/; vite.config.js feature group | After paint | Yes |
| `user-data-DZsrDi4C.js` | 2,243 | app/hooks/useUserDataMutations.ts | After paint | Yes |
| `services-r9d8rHiJ.js` | 2,834 | app/ui/poster-card/services.tsx, ScorePill.tsx and pill-parts.ts | After paint | Yes |
| `moods-BfBHMVU-.js` | 1,797 | app/utils moods and fingerprint labels | After paint | Yes |
| `fingerprint-8T2GFbH-.js` | 1,347 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `taste-picker-Y0-FGogO.js` | 1,458 | Shared start-page UI | After paint | Yes |
| `themes-styles-DoxVmXBv.js` | 1,691 | Shared start-page UI | After paint | Yes |
| `useDiscoverBrowse-Bdts2A2k.js` | 2,290 | Shared start-page UI | After paint | Yes |
| `fingerprint-DxWuc5pz.js` | 3,517 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `ReasonChips-DquqJXTN.js` | 1,155 | Shared start-page UI | After paint | Yes |
| `WatchNextHero-Bki7PoCm.js` | 5,797 | Shared start-page UI | After paint | Yes |
| `my-movies-BmtZb84_.js` | 967 | Shared start-page UI | After paint | Yes |
| `labels-DsjsGbQB.js` | 3,803 | Shared start-page UI | After paint | Yes |
| `filter-state-C0AfnD7V.js` | 3,826 | Shared start-page UI | After paint | Yes |
| `PickChip-DR4GRl4e.js` | 1,897 | Shared start-page UI | After paint | Yes |
| `motion-Ct8Pk-Rx.js` | 35,703 | framer-motion | After paint | Yes on start |
| `TitlePosterCard-y7z2Tibs.js` | 976 | Shared start-page UI | After paint | Yes |
| `meta-C1V4IN4_.js` | 2,694 | shared metadata helpers | After paint | Yes |
| `_index-Ct03QFxy.js` | 1,171 | start-page route or shared index route | After paint | Yes |
| `FeedbackDock-D8zK1HaF.js` | 22,492 | app/ui/feedback/FeedbackDock.tsx and fix mode | Idle | No |
| `contact-Da7hpWCx.js` | 12,103 | app/ui/support/contact.ts and zod/v3 | Idle | No |
| `subject-DGUGJjx0.js` | 1,613 | app/ui/feedback/subject.tsx | After paint | No |

### /movie/603-the-matrix

| Chunk | Transfer bytes | Source | When | First view |
| --- | ---: | --- | --- | --- |
| `related-map-zpkbORng.js` | 19,480 | app/ui/related-map/inline.ts and engine.ts | Parse | No |
| `manifest-e62db073.js` | 8,902 | Remix generated route manifest | After paint | Yes |
| `entry.client-DucW1lZQ.js` | 1,055 | app/entry.client.tsx | After paint | Yes |
| `react-B6r3mUaQ.js` | 41,635 | react, react-dom, scheduler | After paint | Yes |
| `shell-gQ5mAQ1R.js` | 75,590 | root/entry static app dependencies; vite.config.js shell rule | After paint | Yes, mixed |
| `remix-Ba_M1-mz.js` | 37,250 | @remix-run/react, react-router, turbo-stream | After paint | Yes |
| `vendor-Clptqw0B.js` | 22,143 | root/entry shared libraries; vite.config.js vendor rule | After paint | Yes, mixed |
| `query-DloiJuQb.js` | 12,781 | @tanstack/react-query and query-core | After paint | Yes |
| `root-Drw5gukl.js` | 2,398 | app/root.tsx | After paint | Yes |
| `detailsMeta-Dc8bORC_.js` | 64,074 | app/utils/detailsMeta.ts; shared title UI dependency graph | After paint | Yes, mixed |
| `MovieTvCard-DLkSqXjE.js` | 3,956 | app/ui/MovieTvCard.tsx | After paint | No on titles; yes on start |
| `OwnerScore-CiWvi6Be.js` | 1,130 | app/ui/poster-card/OwnerScore.tsx | After paint | No on titles; yes on start |
| `title-actions-B_FpZJxK.js` | 4,920 | app/ui/title-actions/; vite.config.js feature group | After paint | Yes |
| `user-data-DxMLx5VX.js` | 2,244 | app/hooks/useUserDataMutations.ts | After paint | Yes |
| `services-0EaAH-kL.js` | 2,838 | app/ui/poster-card/services.tsx, ScorePill.tsx and pill-parts.ts | After paint | Yes |
| `title-icons-DcBAuR9E.js` | 1,231 | ChevronLeftIcon and SparklesIcon; explicit feature chunk | After paint | Yes |
| `ScoreRing-B9i-MsxD.js` | 1,376 | app/ui/details/hero/ScoreRing.tsx | After paint | Yes |
| `MediaPreference-D2vLCbZQ.js` | 3,785 | app/ui/media-preference/MediaPreference.tsx | After paint | Yes |
| `moods-EYQNFuYl.js` | 5,125 | app/utils moods and fingerprint labels | After paint | Yes |
| `fingerprint-DxWuc5pz.js` | 3,523 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `fingerprint-8T2GFbH-.js` | 1,354 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `ShieldCheckIcon-D8NWdB0R.js` | 1,110 | @heroicons/react | After paint | Yes, mixed |
| `FilmIcon-D8Tscd17.js` | 1,424 | @heroicons/react | After paint | Yes, mixed |
| `ChartBarIcon-0w6iF9t-.js` | 1,166 | @heroicons/react | After paint | Yes, mixed |
| `TvIcon-DiiPDSn8.js` | 1,235 | @heroicons/react | After paint | Yes, mixed |
| `RatingChips-BHREHG9V.js` | 5,614 | app/ui/details/hero/RatingChips.tsx | After paint | Yes |
| `scale-C_kTBHKc.js` | 1,319 | app/ui/details/episode-grid/scale.ts | After paint | Yes, mixed |
| `gate-Bf6drtVS.js` | 2,883 | app/ui/tracking/gate.tsx | After paint | Yes, mixed |
| `AdjustmentsHorizontalIcon-xdeXsiw3.js` | 1,063 | @heroicons/react | After paint | Yes, mixed |
| `TitleControl-DIZpFH35.js` | 1,162 | app/ui/title-actions/TitleControl.tsx | After paint | Yes |
| `SeenScore-MabZV07l.js` | 3,096 | app/ui/title-actions/SeenScore.tsx | After paint | Yes |
| `seen-score-faces-DKkuQWnG.js` | 3,016 | app/ui/details/hero/seen-score-faces.tsx | After paint | Yes |
| `subject-CwhYV29L.js` | 1,615 | app/ui/feedback/subject.tsx | After paint | No |
| `meta-ui20ko3r.js` | 2,693 | shared metadata helpers | After paint | Yes |
| `movie._movieKey-BkON88nM.js` | 1,598 | app/routes/movie.$movieKey.tsx | After paint | Yes |
| `TitleSocialSection-DLphdKN8.js` | 3,225 | app/ui/talked-about-now/TitleSocialSection.tsx | Near | No |
| `social-embed-CFssZhAM.js` | 4,177 | app/ui/social-embed/ | Near | No |
| `FeedbackDock-B_SxFs5m.js` | 22,474 | app/ui/feedback/FeedbackDock.tsx and fix mode | Idle | No |
| `contact-Da7hpWCx.js` | 12,113 | app/ui/support/contact.ts and zod/v3 | Idle | No |
| `Hub-BSphIhiS.js` | 3,225 | app/ui/navigation/Hub.tsx | Quiet | No |
| `newly-available-YT4u4__C.js` | 2,697 | app/domain/newly-available.ts | Quiet | No |
| `useAccountSummary-vu-uJ33j.js` | 1,174 | app/ui/account/useAccountSummary.ts | Quiet | No |
| `my-library-Kz2i0d7g.js` | 1,893 | app/domain/my-library.ts | Quiet | No |
| `headless-DFRk8-CL.js` | 34,201 | @headlessui/react and dialog/virtualization libraries | Quiet | No |
| `SearchPanel-cdhza9Qf.js` | 1,627 | app/ui/navigation/SearchPanel.tsx | Quiet | No |
| `posthog-browser-gmYb2263.js` | 48,377 | app/telemetry/posthog-browser.ts and posthog-js | Quiet | No |
| `faststats-browser-1PC-6x_E.js` | 12,281 | app/telemetry/faststats-browser.ts and @faststats/web | Quiet | No |
| `PostHog web-vitals.js` | 4,590 | PostHog helper | Quiet | No |
| `PostHog config.js` | 861 | PostHog project configuration | Quiet | No |
| `sentry-browser-DwDaIkgW.js` | 74,431 | app/telemetry/sentry-browser.ts and @sentry/remix | Quiet | No |
| `Google tag` | 181,448 | Google Analytics | Quiet | No |

### /movie/14337-primer

| Chunk | Transfer bytes | Source | When | First view |
| --- | ---: | --- | --- | --- |
| `related-map-zpkbORng.js` | 19,662 | app/ui/related-map/inline.ts and engine.ts | Parse | No |
| `manifest-676f525a.js` | 8,927 | Remix generated route manifest | After paint | Yes |
| `entry.client-B5OZ7Yok.js` | 1,059 | app/entry.client.tsx | After paint | Yes |
| `react-B6r3mUaQ.js` | 41,642 | react, react-dom, scheduler | After paint | Yes |
| `shell-BKp9h5mq.js` | 75,514 | root/entry static app dependencies; vite.config.js shell rule | After paint | Yes, mixed |
| `remix-Ba_M1-mz.js` | 37,250 | @remix-run/react, react-router, turbo-stream | After paint | Yes |
| `vendor-Clptqw0B.js` | 22,149 | root/entry shared libraries; vite.config.js vendor rule | After paint | Yes, mixed |
| `query-DloiJuQb.js` | 12,783 | @tanstack/react-query and query-core | After paint | Yes |
| `root-D_tBLtBV.js` | 2,388 | app/root.tsx | After paint | Yes |
| `detailsMeta-1bNt1IaI.js` | 64,086 | app/utils/detailsMeta.ts; shared title UI dependency graph | After paint | Yes, mixed |
| `MovieTvCard-o-oiXOz6.js` | 3,960 | app/ui/MovieTvCard.tsx | After paint | No on titles; yes on start |
| `OwnerScore-CMmwkqrS.js` | 1,120 | app/ui/poster-card/OwnerScore.tsx | After paint | No on titles; yes on start |
| `title-actions-CnRGacwt.js` | 4,928 | app/ui/title-actions/; vite.config.js feature group | After paint | Yes |
| `user-data-C0H9L4Wm.js` | 2,243 | app/hooks/useUserDataMutations.ts | After paint | Yes |
| `services-rVSkWEP_.js` | 2,835 | app/ui/poster-card/services.tsx, ScorePill.tsx and pill-parts.ts | After paint | Yes |
| `title-icons-DcBAuR9E.js` | 1,232 | ChevronLeftIcon and SparklesIcon; explicit feature chunk | After paint | Yes |
| `ScoreRing-6zB01KG4.js` | 1,387 | app/ui/details/hero/ScoreRing.tsx | After paint | Yes |
| `MediaPreference-Dt33EcyK.js` | 3,793 | app/ui/media-preference/MediaPreference.tsx | After paint | Yes |
| `moods-EYQNFuYl.js` | 5,116 | app/utils moods and fingerprint labels | After paint | Yes |
| `fingerprint-DxWuc5pz.js` | 3,518 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `fingerprint-8T2GFbH-.js` | 1,344 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `ShieldCheckIcon-D8NWdB0R.js` | 1,120 | @heroicons/react | After paint | Yes, mixed |
| `FilmIcon-D8Tscd17.js` | 1,424 | @heroicons/react | After paint | Yes, mixed |
| `ChartBarIcon-0w6iF9t-.js` | 1,164 | @heroicons/react | After paint | Yes, mixed |
| `TvIcon-DiiPDSn8.js` | 1,236 | @heroicons/react | After paint | Yes, mixed |
| `RatingChips-DrUPOlm5.js` | 5,628 | app/ui/details/hero/RatingChips.tsx | After paint | Yes |
| `scale-DyWLGw69.js` | 1,330 | app/ui/details/episode-grid/scale.ts | After paint | Yes, mixed |
| `gate-CMlZ0cB3.js` | 2,869 | app/ui/tracking/gate.tsx | After paint | Yes, mixed |
| `AdjustmentsHorizontalIcon-xdeXsiw3.js` | 1,065 | @heroicons/react | After paint | Yes, mixed |
| `TitleControl-DgM_ZngB.js` | 1,153 | app/ui/title-actions/TitleControl.tsx | After paint | Yes |
| `SeenScore-DEIz-RKQ.js` | 3,107 | app/ui/title-actions/SeenScore.tsx | After paint | Yes |
| `seen-score-faces-DAZwq8kh.js` | 3,005 | app/ui/details/hero/seen-score-faces.tsx | After paint | Yes |
| `subject-CUgXT1TO.js` | 1,617 | app/ui/feedback/subject.tsx | After paint | No |
| `meta-C0ZCbUXX.js` | 2,701 | shared metadata helpers | After paint | Yes |
| `movie._movieKey-DiD0Yj_j.js` | 1,586 | app/routes/movie.$movieKey.tsx | After paint | Yes |
| `FeedbackDock-9dptRsrb.js` | 22,462 | app/ui/feedback/FeedbackDock.tsx and fix mode | Idle | No |
| `contact-Da7hpWCx.js` | 12,109 | app/ui/support/contact.ts and zod/v3 | Idle | No |

### /show/1399-game-of-thrones

| Chunk | Transfer bytes | Source | When | First view |
| --- | ---: | --- | --- | --- |
| `related-map-zpkbORng.js` | 19,482 | app/ui/related-map/inline.ts and engine.ts | Parse | No |
| `manifest-91a5c115.js` | 8,912 | Remix generated route manifest | After paint | Yes |
| `entry.client-CHgRBIQE.js` | 1,054 | app/entry.client.tsx | After paint | Yes |
| `react-B6r3mUaQ.js` | 41,634 | react, react-dom, scheduler | After paint | Yes |
| `shell-BIfU9iCa.js` | 75,521 | root/entry static app dependencies; vite.config.js shell rule | After paint | Yes, mixed |
| `remix-Ba_M1-mz.js` | 37,250 | @remix-run/react, react-router, turbo-stream | After paint | Yes |
| `vendor-Clptqw0B.js` | 22,145 | root/entry shared libraries; vite.config.js vendor rule | After paint | Yes, mixed |
| `query-DloiJuQb.js` | 12,783 | @tanstack/react-query and query-core | After paint | Yes |
| `root-QCn6WBHE.js` | 2,391 | app/root.tsx | After paint | Yes |
| `detailsMeta-xI2UwWlc.js` | 64,049 | app/utils/detailsMeta.ts; shared title UI dependency graph | After paint | Yes, mixed |
| `MovieTvCard-Do9h4Kcq.js` | 3,961 | app/ui/MovieTvCard.tsx | After paint | No on titles; yes on start |
| `OwnerScore-na3B2eyo.js` | 1,157 | app/ui/poster-card/OwnerScore.tsx | After paint | No on titles; yes on start |
| `title-actions-VlRH9AGy.js` | 4,914 | app/ui/title-actions/; vite.config.js feature group | After paint | Yes |
| `user-data-KxhGrawF.js` | 2,237 | app/hooks/useUserDataMutations.ts | After paint | Yes |
| `services-MWRSfisX.js` | 2,827 | app/ui/poster-card/services.tsx, ScorePill.tsx and pill-parts.ts | After paint | Yes |
| `title-icons-DcBAuR9E.js` | 1,228 | ChevronLeftIcon and SparklesIcon; explicit feature chunk | After paint | Yes |
| `ScoreRing-Cu6na_MV.js` | 1,373 | app/ui/details/hero/ScoreRing.tsx | After paint | Yes |
| `MediaPreference-DMVWkzkT.js` | 3,787 | app/ui/media-preference/MediaPreference.tsx | After paint | Yes |
| `moods-EYQNFuYl.js` | 5,125 | app/utils moods and fingerprint labels | After paint | Yes |
| `fingerprint-DxWuc5pz.js` | 3,516 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `fingerprint-8T2GFbH-.js` | 1,347 | packages/yepwatch-contracts/fingerprint.ts and app/server/utils/fingerprint.ts | After paint | Yes |
| `ShieldCheckIcon-D8NWdB0R.js` | 1,108 | @heroicons/react | After paint | Yes, mixed |
| `FilmIcon-D8Tscd17.js` | 1,429 | @heroicons/react | After paint | Yes, mixed |
| `ChartBarIcon-0w6iF9t-.js` | 1,168 | @heroicons/react | After paint | Yes, mixed |
| `TvIcon-DiiPDSn8.js` | 1,237 | @heroicons/react | After paint | Yes, mixed |
| `RatingChips-f6gyO09z.js` | 5,620 | app/ui/details/hero/RatingChips.tsx | After paint | Yes |
| `scale-CLJxwX17.js` | 1,322 | app/ui/details/episode-grid/scale.ts | After paint | Yes, mixed |
| `gate-9WZL_Ei7.js` | 2,873 | app/ui/tracking/gate.tsx | After paint | Yes, mixed |
| `AdjustmentsHorizontalIcon-xdeXsiw3.js` | 1,065 | @heroicons/react | After paint | Yes, mixed |
| `TitleControl-OyIVgdMn.js` | 1,133 | app/ui/title-actions/TitleControl.tsx | After paint | Yes |
| `SeenScore-flMtvLeE.js` | 3,097 | app/ui/title-actions/SeenScore.tsx | After paint | Yes |
| `seen-score-faces-KAch_gHy.js` | 3,012 | app/ui/details/hero/seen-score-faces.tsx | After paint | Yes |
| `subject-B7l0PoMb.js` | 1,604 | app/ui/feedback/subject.tsx | After paint | No |
| `meta-BHggjTsm.js` | 2,688 | shared metadata helpers | After paint | Yes |
| `show._showKey-C8hEnxux.js` | 1,642 | app/routes/show.$showKey.tsx | After paint | Yes |
| `TitleSocialSection-E36C_EIm.js` | 3,233 | app/ui/talked-about-now/TitleSocialSection.tsx | Near | No |
| `social-embed-DevxwMWD.js` | 4,179 | app/ui/social-embed/ | Near | No |
| `FeedbackDock-BuwZe0Mu.js` | 22,490 | app/ui/feedback/FeedbackDock.tsx and fix mode | Idle | No |
| `contact-Da7hpWCx.js` | 12,113 | app/ui/support/contact.ts and zod/v3 | Idle | No |
| `Hub-BCERfcZM.js` | 3,221 | app/ui/navigation/Hub.tsx | Quiet | No |
| `newly-available-CZEqn0a2.js` | 2,703 | app/domain/newly-available.ts | Quiet | No |
| `useAccountSummary-Ds9Gvg8b.js` | 1,166 | app/ui/account/useAccountSummary.ts | Quiet | No |
| `my-library-Kz2i0d7g.js` | 1,892 | app/domain/my-library.ts | Quiet | No |
| `headless-DFRk8-CL.js` | 34,201 | @headlessui/react and dialog/virtualization libraries | Quiet | No |
| `SearchPanel-DYfhJhKb.js` | 1,612 | app/ui/navigation/SearchPanel.tsx | Quiet | No |
| `posthog-browser-5ropoRYR.js` | 48,308 | app/telemetry/posthog-browser.ts and posthog-js | Quiet | No |
| `faststats-browser-1PC-6x_E.js` | 12,271 | app/telemetry/faststats-browser.ts and @faststats/web | Quiet | No |
| `PostHog web-vitals.js` | 4,591 | PostHog helper | Quiet | No |
| `PostHog config.js` | 887 | PostHog project configuration | Quiet | No |
| `sentry-browser-DKBHMG4b.js` | 74,449 | app/telemetry/sentry-browser.ts and @sentry/remix | Quiet | No |
| `Google tag` | 181,440 | Google Analytics | Quiet | No |

## Local source mapping

The production build's sourcemaps confirm that `detailsMeta` is a mixed chunk with 83 source modules, including the title page components, fingerprint UI, episode grid and nine Swiper modules. `shell` contains 263 shared app modules. `vendor` contains 128 modules: 123 Heroicons, `clsx`, `react-toastify`, `deepmerge`, `use-dehydrated-state`, and React Query Devtools' production no-op. The developer-tool UI is absent. The social embed chunk has four modules: `SocialEmbed`, `target`, `players` and `YouTubeFrame`. The contact chunk includes Zod v3 and `ui/support/contact.ts`.

The shared `server/utils/fingerprint.ts` module contains browser-safe fingerprint helpers. Its directory name does not mean database or server SDK code ships with it. No database SDK appears in the initial chunks inspected here. The complete per-chunk source lists are saved with the local measurement artifacts as `source-modules.json`.

## Changes

The 19 KB map engine stays eager. A prototype that loaded the engine on visibility preserved SSR but regressed the tap test's early jump to the map from 34 to 48 ms on baseline to about 2 to 2.5 seconds on slow 4G with 4× CPU slowdown. High fetch priority did not resolve the queue behind the page's route scripts. Keeping the existing engine preserves immediate map use before hydration. Its source and script tag remain unchanged.

Browse and Search warm on the first interaction anywhere on the page or on their opener's pointer, touch or focus intent. Opening either dialog also loads it. Feedback keeps main's first-interaction warm-up and its intent retry when a background chunk load fails. Its tab also warms on touch. On phones, the drawer measures the tab after the tab becomes visible. This prevents a negative width when Feedback opens before its code loads. The social slot keeps an 800 px observer margin because it has no reserved height. Unrelated first interactions no longer prefetch its code.

The initial measurements below describe the earlier candidate. The follow-up section records the rebased implementation and supersedes the earlier candidate's behavior and verification results.

The route loaders, document hydration, navigation cache and navigation code warm-up remain intact. No title document uses `defer`, `HydrateFallback` or `clientLoader.hydrate`.

## Candidate first-view inventory

Each title requests the following 34 shared chunks, plus its route entry below. All sizes are transferred bytes from the final local cohort; a range covers the three runs and four titles. The after-paint module graph stays intact for full hydration. Feedback, Browse/Search and social chunks from the baseline tables now load only on their described intent or visibility triggers. Analytics retain their quiet-time policy.

| Chunk | Transfer bytes | Source | When | First view |
| --- | ---: | --- | --- | --- |
| `AdjustmentsHorizontalIcon-BccIUuJT.js` | 426 | @heroicons/react | After paint | Yes |
| `ChartBarIcon-C34lpKgT.js` | 510 | @heroicons/react | After paint | Yes |
| `FilmIcon-BHKbvGBI.js` | 780 | @heroicons/react | After paint | Yes |
| `MediaPreference-CYR6choi.js` | 3,148 | ui/media-preference/machine.ts, ui/media-preference/save-adapter.ts (3 modules) | After paint | Yes |
| `MovieTvCard-C1UTLk__.js` | 3,327 | utils/title-demand.ts, hooks/usePosterImpression.ts (6 modules) | After paint | No |
| `OwnerScore-CReAuLQt.js` | 498 | ui/poster-card/OwnerScore.tsx | After paint | No |
| `RatingChips-WBkggkI5.js` | 4,984 | ui/details/episode-grid/ScoreTile.tsx, ui/details/episode-grid/consistency-scale.ts (4 modules) | After paint | Yes |
| `ScoreRing-DNElflCx.js` | 744 | ui/details/hero/ScoreRing.tsx | After paint | Yes |
| `SeenScore-BiqTRWzp.js` | 2,457 | ui/title-actions/SeenScore.tsx | After paint | Yes |
| `ShieldCheckIcon-ByF0VYr-.js` | 490 | @heroicons/react | After paint | Yes |
| `TitleControl-CyUJkFqh.js` | 489 | ui/title-actions/TitleControl.tsx | After paint | Yes |
| `TvIcon-CgolYJGf.js` | 596 | @heroicons/react | After paint | Yes |
| `detailsMeta-BCmaufLk.js` | 63,639 | Title components, fingerprint UI, episode grid and Swiper | After paint | Yes, mixed |
| `entry.client-C3mVQl_v.js` | 424 | entry.client.tsx | After paint | Yes |
| `fingerprint-BLod4SLL.js` | 677 | server/utils/fingerprint.ts | After paint | Yes |
| `fingerprint-Dq1Z2686.js` | 2,856 | ../../../packages/yepwatch-contracts/fingerprint.ts | After paint | Yes |
| `gate-C-h4i8Wk.js` | 2,250 | ui/details/episode-grid/EpisodeSkeleton.tsx, ui/tracking/gate.tsx | After paint | Yes |
| `manifest-75269964.js` | 8,500 | Remix generated build manifest | After paint | Yes |
| `meta-CBeYGPha.js` | 2,074 | utils/watch-actions.ts, utils/meta.ts | After paint | Yes |
| `moods-RFRuuNyI.js` | 4,473 | ui/explore/category/moods.ts | After paint | Yes |
| `query-rvPGO8Qi.js` | 12,095 | @tanstack/query-core, @tanstack/react-query | After paint | Yes |
| `react-B30EqBVp.js` | 41,007 | react, react-dom, scheduler | After paint | Yes |
| `related-map-zpkbORng.js` | 19,187 | ui/related-map/inline.ts, map.ts and engine.ts | Parse | No; retained for early map use |
| `remix-Dib1B-HI.js` | 36,618 | @remix-run/react, @remix-run/router, @remix-run/server-runtime, react-router, react-router-dom, turbo-stream | After paint | Yes |
| `root-dhu32q50.js` | 1,757 | root.tsx | After paint | Yes |
| `scale-ARgeJejU.js` | 714 | ui/details/episode-grid/scale.ts | After paint | Yes |
| `seen-score-faces-DT5q4DM3.js` | 2,374 | ui/details/hero/seen-score-faces.tsx | After paint | Yes |
| `services-C1FfE6fw.js` | 2,198 | img/goodwatch-logo.webp?no-inline, ui/poster-card/pill-parts.ts (4 modules) | After paint | Yes |
| `shell-BjT-DR2C.js` | 73,820 | Shared app shell (263 modules) | After paint | Yes, mixed |
| `subject-BQVCYBhe.js` | 976 | ui/feedback/subject.ts | After paint | No |
| `title-actions-ytk_pDs0.js` | 4,281 | utils/ratings.ts, ui/scoring/score-model.ts (10 modules) | After paint | Yes |
| `title-icons-CRynIHQh.js` | 597 | @heroicons/react | After paint | Yes |
| `user-data-B4Qdaxb1.js` | 1,612 | domain/member-data-updates.ts, hooks/useUserDataMutations.ts | After paint | Yes |
| `vendor-CRpmFpr8.js` | 21,498 | Shared icons and small shell libraries | After paint | Yes, mixed |

| Page | Additional chunk | Transfer bytes | Source | When | First view |
| --- | --- | ---: | --- | --- | --- |
| Matrix | `movie._movieKey-CSrHqL7n.js` | 956 | routes/movie.$movieKey.tsx | After paint | Yes |
| Game of Thrones | `show._showKey-B1ZgluWi.js` | 1,000 | routes/show.$showKey.tsx | After paint | Yes |
| Primer | `movie._movieKey-CSrHqL7n.js` | 956 | routes/movie.$movieKey.tsx | After paint | Yes |
| Breaking Bad | `show._showKey-B1ZgluWi.js` | 1,000 | routes/show.$showKey.tsx | After paint | Yes |

## Paired local measurements

Baseline is `d620383c8`, the starting `origin/main`. Both production builds run with `env -i`, loopback data endpoints, empty external keys, the page role and an egress blocker. The frontend serves precompressed assets over TLS and HTTP/2 and forwards 103 Early Hints. Lighthouse 13.5.0 uses mobile emulation and CPU slowdown 2.7. Each pair alternates baseline then candidate, with a fresh browser, for three runs. The browser guard blocks non-GET requests and outbound app/analytics requests.

The standard local database lacks Primer and person data, trailers and a populated related map. For the four title measurements and tap checks, the harness substitutes public guest loader data captured with sequential production GETs, including the already rendered map and six map packs. Each build's normal components render those data through SSR. The social API returns an empty local result; the baseline still loads its section code when its observer fires. Home and Discover use the standard local fixtures. The repository does not include fixture data or credentials.

The local build disables the Sentry build/upload plugin, and its response headers differ from the static host. Compare bytes within this cohort. These are not production-after measurements or field results.

| Page | Script bytes before → after | Requests before → after | LCP before → after (ms) | TBT before → after (ms) | Score before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Matrix | 362,705 → 323,032 | 39 → 35 | 2,598 → 2,618 | 0 → 0 | 97 → 97 |
| Game of Thrones | 362,765 → 323,076 | 39 → 35 | 2,491 → 2,476 | 0 → 0 | 97 → 97 |
| Primer | 356,566 → 323,032 | 37 → 35 | 2,615 → 2,654 | 0 → 0 | 97 → 96 |
| Breaking Bad | 356,626 → 323,076 | 37 → 35 | 2,869 → 2,809 | 0 → 0 | 95 → 96 |
| Start | 334,871 → 300,389 | 34 → 31 | 2,101 → 2,102 | 4 → 7 | 99 → 99 |
| Discover | 423,884 → 390,366 | 55 → 53 | 3,901 → 3,902 | 8 → 8 | 84 → 84 |

Matrix and Game of Thrones send about 11% fewer initial script bytes. Primer and Breaking Bad send about 9% fewer. All four reach approximately the same script weight. Matrix also drops from 1,328,262 to 1,176,193 decoded JavaScript bytes, removing 152,069 bytes of script input. Timing and scores stay close in this small sample; the byte reduction is the useful result. No new first-view module replaces the deferred UI.

A separate, fixed 12-second observation prevents the audit's end time from hiding delayed work. With no scroll or interaction, Matrix transfers 565,725 → 482,618 script bytes and Game of Thrones 565,784 → 482,662, with 49 → 39 script requests each. That removes 83,107 to 83,122 bytes (about 81 KB) of unused UI code from each visit, even when the visitor stays. Both builds hydrate without browser errors. The candidate requests no Feedback drawer, Browse/Search dialog or social section before use. The map engine remains loaded in both builds.

## Verification

- The production build passes. Typechecking reports the same 189 existing errors on baseline and candidate, with no new diagnostics.
- All 132 focused tests pass: navigation cache, identity, prefetch priority, phone code warm-up, related-map behavior, feedback request/weight checks, hero loading and after-paint startup.
- The full test suite reports failures in unchanged server/auth code and does not finish within 180 seconds on either branch, including with `--test-force-exit`. A candidate-only ranking timing failure passes all nine tests when rerun in isolation. A full-suite green result is unavailable.
- The requested HTML equivalence runner passes 348 documents with zero differences and no class allowlist. Twelve supplemental comparisons using the public title fixtures also pass for browser, Googlebot and Bingbot. No title document uses `defer`, `HydrateFallback` or `clientLoader.hydrate`.
- The tap sweep covers 42 page/control/mode combinations on mobile, slow 4G and 4× CPU. Updated fingerprint and episode selectors exercise the current UI and retain legacy fallbacks. With the current selectors, 41 combinations produce their effects. The early episode-cell tap is lost on both unchanged baseline and candidate, while the scroll case works. The tap lands on the correct cell before React is ready; its current markup has no early-tap replay marker. This is an existing failure, not a passing tap gate.
- The retained map passes the final four targeted checks in 33–50 ms, comparable to baseline's 34–49 ms. Cold phone Browse → Feedback, Search opening/keyboard reopening, and desktop keyboard Feedback opening pass. The phone drawer has a positive measured width before its opening animation.

### Budget results

The movie/show budget check passes every line. The script byte limit becomes 329,728 bytes (322 KiB), down from 331,776 for movies and 363,520 for shows. The legacy count limits already fail on the starting main: Matrix has 39 scripts / 55 host requests and Breaking Bad 37 / 52. Both candidates need 35 / 50 for complete first-view hydration, so the count caps become 36 / 51, with one request of headroom. The audit records this recalibration instead of describing those old count caps as passing.

The full `./bench.sh budget --run ...` check still fails. Home exceeds its existing host-request, script-count and blocking-request limits; Discover exceeds existing request, script, image-byte and total-byte limits. Baseline fails those surfaces too, while this change reduces their scripts. Person and the private share list have no valid local fixture reports. Those unrelated limits are unchanged. Recheck production budgets after an authorized deploy because local asset headers and Sentry instrumentation differ.

## Remaining questions

- Should passive visits keep loading the full analytics stack? About 314 KB of the production gap is analytics. Its loading and visit/error collection policies are unchanged here; postponing it beyond Lighthouse would not remove the cost.
- The production social API took more than ten seconds in the Matrix baseline. Visibility gating removes that request from the first view, but the endpoint still deserves a separate latency investigation.
- The current episode tiles need a cold-tap replay fix. The earlier benchmark exposed the same lost early tap on starting main. The follow-up uses main's current benchmark without selector changes. This ticket preserves document HTML and does not change episode behavior.
- The checks do not cover signed-in browser flows or actual production-after transfer. The task made no production deployment, configuration change or data write.

## Follow-up after rebasing on main

The follow-up uses `origin/main` at `6ea81cf36`. The tap runner is byte-for-byte main's version, including its current fingerprint selectors. FeedbackTab keeps main's first-interaction warm-up and the `wanted` retry path for a failed background chunk import; the only addition is `onTouchStart={onWarm}`. FeedbackDock retains the measure-after-reveal fix. The social observer again uses `rootMargin: "800px"`. Its empty slot has no reserved height, so waiting until intersection risks inserting the section while the reader looks at it.

### Cold dialog opening

Both builds use the same isolated guest fixture harness, TLS and HTTP/2. Each observation starts a fresh Chromium browser and loads the page with an empty browser cache. Applied slow 4G means 150 ms latency, 1.6 Mbit/s download and 750 Kbit/s upload; CPU slowdown is 4×. The phone viewport is 412 × 823 with touch input; keyboard observations use a 1440 × 900 viewport. The probe waits for hydration and another eight seconds without intent before sending the input. It measures from immediately before input dispatch until a MutationObserver sees the visible Browse panel or Search input. These are single observations per condition, sufficient to identify the large regression, not latency percentiles.

Title pages capture `/` for “Find in this title” before global Search sees it. The `/` Search observation therefore uses `/about`; Ctrl+K and phone Browse use Matrix. Main's quiet-time warm-up has loaded Hub, SearchPanel and the shared dialog library before input. The intent-only candidate has loaded none of them.

| Input | Main (ms) | Intent-only candidate (ms) | Final, direct first interaction (ms) | Final, after earlier page interaction (ms) |
| --- | ---: | ---: | ---: | ---: |
| Browse, phone touch | 182 | 799 | 771 | 161 |
| Search, `/` on `/about` | 384 | 816 | 840 | 293 |
| Search, Ctrl+K on Matrix | 559 | 964 | 1,004 | 322 |

The intent-only regressions are 617, 432 and 405 ms, all above the approximately 100 ms allowance. The final implementation therefore retains the opener intent handlers and also calls `onFirstInteraction` to warm both Hub and SearchPanel. The last column sends a neutral pointer movement eight seconds before opening, without focusing or hovering an opener. Resource entries confirm that both chunks load before the final opening only in that condition.

First-interaction warm-up does not make a direct first action free. Main's timer can prepare a passive reader's first opening; the final branch waits for that opening if no earlier interaction occurs. The final direct measurements retain a 455 to 589 ms penalty relative to main. This follows the requested first-interaction fallback while preserving the cost reduction for passive visits. Achieving main's passive-reader first-open latency would require warming before any interaction. Search also loads its command palette on opening or search-entry intent in both builds, so warming SearchPanel alone does not remove every first-open request.

### Final checks

The final production build passes. Biome checks all seven supported changed files using `goodwatch-webapp/biome.json`, including import organization and formatting; Markdown is outside Biome's supported file set. The 141 focused webapp tests and 21 benchmark budget/report tests pass. Typechecking reports 178 errors on both current main and the final branch, with byte-identical diagnostics. This is a baseline comparison, not a passing typecheck.

The final HTML equivalence run compares current main with the working tree: both self-checks and the cross-build gate pass 348 documents with zero differences and no class allowlist. The standard fixture limitations described above still apply.

Three fresh-browser Lighthouse pairs per title use the same public fixture harness and mobile CPU slowdown of 2.7. Current main has already reduced the initial module graph since the original audit, so the historical 11% reduction does not apply to this rebase.

| Page | Script bytes, main → final | Scripts, main → final | Host requests, main → final | LCP, main → final (ms) | TBT, main → final (ms) | Score, main → final |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Matrix | 293,996 → 294,118 | 27 → 27 | 42 → 42 | 2,535 → 2,522 | 0 → 0 | 97 → 97 |
| Breaking Bad | 294,050 → 294,169 | 27 → 27 | 42 → 42 | 2,833 → 2,782 | 0 → 0 | 95 → 96 |

The title byte and count caps pass. Breaking Bad passes every budget line. Matrix fails two unchanged limits on both trees: image bytes are 96,883 on main and 96,878 on the branch, against 94,208; total bytes are 542,615 and 542,730, against 541,696. The final branch adds 122 script bytes on Matrix and 119 on Breaking Bad. The budget remains red for this existing image/total-byte debt. No image or total-byte cap was raised. The count-cap notes explicitly say that the earlier main already exceeded the old caps at 39 scripts and 55 requests; that historical recalibration is separate from the current 27-script graph.

Reproduction uses the existing commands with local-only endpoints and the isolated fixture harness:

```sh
# From goodwatch-webapp, with the isolated test environment:
node --test app/navigation/*.test.ts app/ui/related-map/*.test.ts \
  app/ui/feedback/*.test.ts app/server/hero-hints.test.ts \
  app/utils/start-after-paint.test.ts app/ui/details/hero/hero-backdrop.test.ts

# From the repository root:
node --test goodwatch-benchmark/scripts/budget.test.mjs \
  goodwatch-benchmark/scripts/tap-report.test.mjs
GW_HTML_CHECK_CACHE="$SCRATCH/html" goodwatch-benchmark/html-equivalence/run.sh \
  local origin/main "$PWD"

# From goodwatch-benchmark, after collecting three local Lighthouse reports per title:
./bench.sh budget --run "$SCRATCH/followup-run-after" \
  --budget "$SCRATCH/followup-title-budget.json"
```

The title-only budget file copies the movie and show entries and global settings from `urls/budget.json` without changing limits. The full landing-surface budget was not repeated for this follow-up. The earlier Home/Discover failures and unavailable person/private-share fixtures remain outside this title check. No production requests, deployment, configuration changes or production data writes were needed for the follow-up.

The final tap sweep runs all 42 current-main page/control/mode combinations once, with phone touch input, slow 4G and 4× CPU. It records 33 effects, five lost early taps and four absent cast-tier cases. Fingerprint selection and the section index lose their early taps on both titles; the show also loses its early episode-cell tap. Their scroll cases produce effects. A targeted nine-case early check on current main reproduces all five lost targets and both absent cast-tier controls. This is not a passing strict tap gate. The saved fixtures do not provide cast-tier controls, and the local fingerprint-pairs API returns 500, so those surfaces need fuller fixture coverage before drawing production conclusions.

The branch's early related-map steps take 4,422 ms for Matrix and 4,308 ms for Breaking Bad; the scroll cases take 52 and 60 ms. Current main takes 4,491 ms on the show and misses the five-second limit on the movie, with a late effect at 6,840 ms. These current-run results supersede the historical 33–50 ms claim for early map use above. The map engine remains eager and unchanged. The check uses a scratch copy of main's tap runner with only a GET-only, local-origin/image-host request guard added; selectors, input, timings and effect predicates match main. The repository's `tap.mjs` has no branch diff.

Cold phone Browse → Feedback, Search with keyboard reopening, and desktop keyboard Feedback all pass the functional browser checks. The revealed phone tab measures 40 px wide and its drawer 364 px; the desktop drawer measures 384 px. Both drawers have positive widths before use. Signed-in flows, real phone latency and post-deployment production transfer remain unverified.

# Auth and small-page LCP

Ticket 9 of [Instant page loads everywhere](https://github.com/alp82/goodwatch-monorepo/issues/784).

## Find the late content

The saved [October 29 guest Lighthouse reports](all-pages-baseline-2026-10-29.md) identify these mobile LCP elements. The auth poster wall does not render on mobile.

| Page | Production score | Production LCP | LCP element |
| --- | ---: | ---: | --- |
| `/sign-in` | 89 | 3,637 ms | Create-account paragraph |
| `/sign-up` | 89 | 3,635 ms | Privacy-policy paragraph |
| `/forgot-password` | 86 | 4,122 ms | Email instructions |
| `/reset-password` | 89 | 3,661 ms | Expired-link heading |
| `/verify-email` | 89 | 3,652 ms | Email instructions |
| `/discord` | 89 | 3,596 ms | Project Hail Mary backdrop |
| `/explorer` | 85 | 3,429 ms | “Laying the world out…” message |

Auth pages sent `opacity:0` on the card and waited for Framer Motion to hydrate it. The observed render delay in the saved reports is about 1.4 to 1.7 seconds. The mobile LCP is text, and the same font already paints quickly on legal pages. The saved sign-in report has FCP at 1,762 ms and LCP at 3,637 ms; privacy paints at 1,758 ms with LCP at 1,908 ms. Prioritizing poster images would not address this delay.

Discord already loads its backdrop eagerly from TMDB, but it lacks high fetch priority. Its module preloads compete with the stylesheet and image. Explorer's loading text waits for both the global stylesheet and its own stylesheet. The latter had no 103 hint and did not match the static host's CORS preconnect.

## Change resource scheduling

Auth entrance animations now run in CSS. They retain their duration, easing, offsets, word stagger, and final layout. They start from the document rather than hydration. Reduced motion suppresses the entrance as well as the existing aurora animation. No text, form fields, poster selection, or card dimensions change. Auth scripts retain their existing loading behavior.

Discord shares its preview backdrop URL with the 103 hero hints. The static hint remains available before the first render and after remembered title pages are evicted. The image uses `fetchpriority="high"` and anonymous CORS. The route uses the existing `START_AFTER_PAINT` handle to start its modules after first contentful paint. It does not mark the backdrop as an image to wait for: on short phones the backdrop sits below the fold and cannot report Element Timing until it becomes visible. Links and native FAQ disclosures work before hydration.

Explorer's route stylesheet now appears in its 103 response. Its document link uses the same anonymous CORS mode. Explorer scripts retain their existing loading behavior. Its map, loading message, and crawler fallback stay unchanged.

## Compare local measurements

| Page | Score before | Score after | LCP before | LCP after | After LCP range |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/sign-in` | 95 | 98 | 2,702 ms | 2,026 ms | 1,502–2,027 ms |
| `/sign-up` | 96 | 98 | 2,701 ms | 2,026 ms | 1,501–2,251 ms |
| `/forgot-password` | 95 | 98 | 2,701 ms | 2,026 ms | 1,501–2,251 ms |
| `/reset-password` | 95 | 98 | 2,701 ms | 2,026 ms | 1,651–2,027 ms |
| `/verify-email` | 95 | 98 | 2,701 ms | 2,101 ms | 1,651–2,251 ms |
| `/discord` | 94 | 99 | 3,001 ms | 1,876 ms | 1,876–1,876 ms |
| `/explorer` | 97 | 98 | 2,251 ms | 2,026 ms | 1,651–2,401 ms |

All 35 candidate observations scored at least 95, with LCP below 2.5 seconds and zero CLS. Explorer's before and after ranges overlap; its 225 ms median difference alone does not prove a repeatable speed improvement. The 103 response includes the stylesheet, but production verification remains necessary.

The servers use isolated loopback data stores, empty external keys, `env -i`, and the existing outbound TCP blocker. A local TLS and HTTP/2 proxy forwards 103 responses. Lighthouse uses the existing pages suite's browser and guard with CPU slowdown 2.7, analytics blocked, and a local certificate override. Each side has five cold-browser mobile runs per page. The runs execute on this shared machine, with each page's before and after batches next to each other. Rebuilds interrupted the first forgot-password and verify-email batches; the reported final batches repeat both sides without those interruptions. Other tickets also build on the machine. These local assets use the origin; production uses a separate static host. Do not compare the absolute local scores directly with the production table.

The final source also keeps the static Discord hint outside the evictable map. That change preserves the measured response and does not affect these runs, which do not fill the title hint cache. Formatting and the desktop headline's final `filter:none` do not change the measured mobile view.

Raw Lighthouse reports and harness logs remain under `~/.cache/gw-perf/scratch-lcpauth/`. The local benchmark does not establish production performance after deployment.

## Verify behavior and document content

- Focused tests: 40 pass. The existing HTML normalizer suite also passes all 17 tests. The auth regression fails on the base because the card has permanent inline opacity zero before hydration. The Explorer hint regression fails without its route stylesheet. Static-hint coverage verifies first-visit behavior and survival after title-cache eviction.
- `npm run typecheck`: 178 existing errors on both `origin/main` and the candidate. Both commands exit 2, and their complete output is byte-identical.
- `GW_HTML_CHECK_CACHE=<scratch>/html-gate-final ./goodwatch-benchmark/html-equivalence/run.sh local origin/main <candidate-worktree>`: 348 documents, zero differences. Both self-checks also pass. The bench has 72 rendered shows and no person rows. The standard gate does not include this ticket's supporting pages, so the supplemental comparison below covers them.
- A supplemental comparison covers all seven ticket pages for Googlebot, Bingbot, and Chrome. It compares complete normalized HTML, including loader data, after removing only the reviewed differences below.
- Browser checks confirm identical settled auth card geometry and text at mobile and desktop widths on all five auth pages. The sign-in password toggle works at both widths. Discord's setup anchor and native FAQ taps work with scripts blocked and after hydration, at viewport heights of 600 and 823 pixels; its install link retains `/discord/add`. On the short viewport its backdrop begins below the fold, and module requests still start within 8 ms of FCP rather than waiting for the five-second fallback.
- Biome reports the same six existing findings in the touched file set as the base. The patch adds no findings.

The intended HTML differences are:

1. Auth cards and headline words replace Framer Motion's initial inline hidden styles with CSS animation classes and delays. Their inline scene stylesheet contains the entrance keyframes and reduced-motion rule. Auth pages no longer preload the separate motion chunk.
2. Discord's backdrop adds CORS and priority attributes. Its module preloads and import block move into the existing after-paint scheduler. The scheduler and resource ordering change, while the complete page content stays in the first response.
3. Explorer's stylesheet link adds anonymous CORS. Its new 103 stylesheet hint and Discord's new 103 image hint are response metadata, not document content.

## Limits and follow-up

The local CDP check received the new 103 header, but both stylesheets still had parser-initiated requests after the 200 response. This harness does not establish browser reuse of the stylesheet hint or isolate its performance benefit.

Production was not deployed or changed. Confirm mobile Lighthouse on the live static-host path after deployment. No authenticated production session, real phone, Firefox, or Safari was measured.

Explorer's LCP is loading text, not a ready map. The local bench has no populated Explorer world, so these measurements do not establish map-ready latency or island interaction performance. Track that separately if the owner wants a time-to-usable-map target. No layout or popup changes are included.

Owner decision: the patch also suppresses the auth entrance when a visitor requests reduced motion. The old Framer Motion entrance ignored that preference. The settled page looks the same; the owner can choose to keep the entrance for those visitors instead.

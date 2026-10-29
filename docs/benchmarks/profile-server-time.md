# Profile server reads and stats payload

The profile loaders now read score cards and backdrops together, overlap independent
library reads, and skip list poster reads on tabs that do not render lists. The stats
route sends only the title previews its components use. Visible content, interactive
rankings, decade panels, metadata, and cache policy stay the same.

This work addresses [ticket 11 of #784](https://github.com/alp82/goodwatch-monorepo/issues/784).
The production target of less than 300 ms of data time for a large profile remains
unverified. The isolated fixture is much smaller than the production subject.

## Baseline evidence

The supplied production baseline records a profile miss with 1,559 ms of data time
and a Tropes miss with 1,105 ms. One additional Googlebot GET of
`/u/alperortac/stats` on October 29 returned a page-cache miss with `data;dur=3773.1`
and `render;dur=78.3`. No cache-busting query or authenticated request was sent.
Production access consisted of that one GET.

The existing raw Lighthouse reports give these mobile medians across three runs:

| Page | Performance | LCP | LCP element in the first report |
| --- | ---: | ---: | --- |
| Overview | 97 | 2,269 ms | Profile cover image |
| Seen | 98 | 1,897 ms | First title's text link |
| Stats | 96 | 2,253 ms | Viewer description paragraph |
| Tropes | 98 | 1,997 ms | First trope's description |

The cover is discoverable in HTML and eager, but lacks a high fetch priority hint.
The other three LCP elements are text, without an image request chain. The reports
also show document-to-script chains through the app shell. Tropes adds excerpt GETs
after its page script. Failed audits include FCP, contrast, and label/name mismatch;
Stats also has target-size and source-map findings, and Overview has a list-item
finding. These findings do not justify changing profile layout in this ticket.

## Reads on the critical path

`profileLoader` first awaits `loadProfileShell`, then runs the tab loader. The
existing `data` timing includes both stages and media presentation. It does not
identify individual production SQL durations. The following attribution comes from
the loader graph and a controlled test of the actual library and score loader.

| Work | Reads and dependencies | Change |
| --- | --- | --- |
| Profile identity and lists | Handle lookup, public list index, catalog card reads through `getProfilePage` | Unrelated tabs use `getProfileSummary`, without card reads. Overview and Lists retain the combined cache. |
| Library | User data cache, score-card queries in batches of 500, then backdrop queries in batches of 400 | Score-card queries select backdrops too. Each scored title needs one catalog read instead of two. |
| Library totals | Movie runtimes, show episode runtimes, earliest score and earliest dated watch | Start alongside the score-card reads, instead of after both card and backdrop reads. |
| Overview | Recent title displays, My shows and its taste context, wishlist displays, list cards, fingerprint portrait, optional visitor comparison | Existing dependencies and caches remain. The library changes shorten the shared prerequisite. |
| Stats | Fingerprint, sides and everyone portraits, stats aggregates, optional visitor comparison | Existing parallel reads remain. The loader projects their results before serialization. |
| Tropes | Owner's cached pool, catalog/trope identity reads on a cold pool, optional descriptions | Existing pool cache and read queue remain. The shared shell skips unrelated list cards. |

The query-scheduling test gates the actual score-card query. Both first-date queries
must start before that gate opens, and the completed library must read the scored
movie only once while keeping its backdrop and score. It fails on untouched
`origin/main` and passes on the candidate, without wall-clock assertions.

A fully cold portrait still computes recommendations that its public view later
removes. A fully cold stats aggregate still reads details, credits and people through
the existing four-query queue. This ticket does not establish which of those paths
accounts for the production outliers. No direct production database access was used.

## Cache identity and invalidation

The new `share-profile-summary-v1` data cache uses normalized handles, the same
10-second fresh plus 10-second stale lifetime as the existing public profile cache,
and the reset marker guard in `cached()`. `resetProfileViews` resets both caches.
Its value contains only profile identity and public list previews, which were already
in the combined cache. It contains no viewer or rendered shell.

Each request still resolves its own viewer, applies the current profile visibility,
and reads owner-only lists separately. Member response headers remain
`private, no-store`. No complete member response or visitor comparison enters the
new cache. No country or language affects the metadata cache value. No cache
lifetime, Cloudflare setting, or production configuration changed.

## Stats serialization

The route projects viewer-filtered stats, leaving cached owner models intact:

- Keep five title previews for each of the first four directors, and one for each
  remaining director. Keep both rankings, including the hidden ranking that preserves
  the panel's height when switched.
- Keep every actor, without unused title arrays. Keep the three composers and three
  writers rendered by each ranking, without unused title arrays.
- Keep the portrait title records for the first two posters of each of the first
  three taste groups, the first higher and lower crowd cards, and the agreement card.
- Select the agreement winner from the complete title pool before projecting. Preserve
  dictionary order so equal gaps and scores resolve to the same winner.
- Keep all decade panels, totals, scores permitted by visibility, and other stats.

An exact serialization projection on the captured production Googlebot response gives:

| Bytes | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Raw document | 904,537 | 685,862 | 24.2% |
| Gzip 9 | 166,403 | 101,781 | 38.8% |
| Brotli 11 | 115,084 | 72,406 | 37.1% |

These are recompressed capture bytes, not a deployed measurement or the earlier
browser sample of 1.22 MB. Rendering the full captured data with the real `StatsPage`
component before and after projection produces byte-identical markup: 502,489 bytes.

## Local validation

Both versions use production builds, explicit `env -i` allowlists, empty external
keys, loopback services, the egress-blocking preload, disabled page caches, and
separate throwaway Valkey clusters. A dedicated Crate container holds copies of the
existing local catalog fixtures and synthetic profiles. The shared bench database
was read only. No production dotenv file or endpoint was used by a local server.

The fixture has 134 movies, 72 shows, no people, and 30 rated movies per benchmark
subject. It cannot reproduce all aggregate or trope work of the production profile,
which has 1,010 scores and 11,480 watched episodes. Empty people and trope results
are coverage gaps, not evidence of production equivalence.

Timing uses local TLS and HTTP/2 with a fresh connection for each GET. Each tab has
five previously unread synthetic subjects per build. Baseline and candidate run
back to back for each tab, on the same machine where other tickets also build.
Library and owner caches are cold for each subject; catalog caches can be warm.
The final independent timing sample is recorded below. All requests returned 200.

| Page | Median data before | Median data after | Median TTFB before | Median TTFB after |
| --- | ---: | ---: | ---: | ---: |
| Seen | 18.9 ms | 10.6 ms | 33.1 ms | 24.7 ms |
| Stats | 22.1 ms | 25.9 ms | 42.1 ms | 49.5 ms |
| Tropes | 16.3 ms | 11.9 ms | 24.9 ms | 22.3 ms |
| Overview | 17.1 ms | 14.6 ms | 32.6 ms | 30.8 ms |

The few-millisecond differences vary across repeated passes. The stats timing does
not show a speed improvement in this final sample. Earlier isolated medians were
39.0 to 36.9 ms. Do not extrapolate these timings to a large production subject.
The stable evidence is the removed catalog read, overlapped dependencies, reduced
payload, and unchanged rendered content.

The HTML equivalence check covers 124 paths across Googlebot, Bingbot and browser:
372 documents per round, including eight profile tabs. Both builds repeat with zero
self-check differences. The strict cross-build gate exits 1 for exactly three Stats
loader-script differences. The separate projection comparison passes all 372
responses, including statuses, redirect chains, cache policies, visible markup,
metadata, JSON-LD, and every other loader value. Local Stats shrinks from 486,979
to 481,031 raw bytes for Googlebot; the small fixture exercises fewer unused records
than the production capture.

### Lighthouse regression check

Five mobile Lighthouse 13.5 runs per build ran back to back against the isolated
Stats page behind TLS and HTTP/2. The existing pages suite supplied the GET-only
browser guard and its two-request limit. The scratch launcher added Chromium's
certificate exception for the local self-signed certificate. All ten reports
completed without a Lighthouse runtime error, and all guards stayed at or below
two concurrent requests.

| Median | Before | After |
| --- | ---: | ---: |
| Performance | 96 | 97 |
| Accessibility | 93 | 93 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | 2,326 ms | 2,176 ms |
| FCP | 2,101 ms | 1,951 ms |
| TBT | 0 ms | 0 ms |
| CLS | 0 | 0 |

LCP spans about 2,176 to 2,476 ms on both builds. The one-point performance
movement is within that variation. This check does not establish an LCP gain
or a new production score. The fixture exercises a much smaller payload reduction
than the production capture. Desktop Lighthouse and real member hydration were
not measured. Two earlier launcher attempts failed because of the image entrypoint
and a closed HTTP/2 stream; their partial output is excluded from these ten reports.

Relevant checks:

- 93 profile, domain, privacy, metadata and trope tests pass.
- 18 HTML equivalence tests pass, including rejection of external fixture paths.
- TypeScript reports 178 existing diagnostics on each build. The diagnostic output
  matches after normalizing source line and column offsets.
- No script, style, font or image on the landing surfaces named by the conditional
  asset-budget rule changed. No asset-budget limit was raised.

## Reproduce the payload checks

Use Node.js 24 and the existing npm dependencies in `goodwatch-webapp`.

```sh
cd goodwatch-webapp
node --test app/server/profile/*.test.ts app/domain/profile*.test.ts app/ui/profile/meta.test.ts app/ui/profile/tropes/model.test.ts
cd ..
GW_HTML_CHECK_CACHE="$HOME/.cache/gw-perf/scratch-profile/equivalence" \
GW_HTML_CHECK_CRATE_PORT=15970 \
GW_HTML_CHECK_EXTRA_PATHS='["/u/benchprofile","/u/benchprofile/seen","/u/benchprofile/stats","/u/benchprofile/tropes","/u/benchprofile/lists","/u/benchprofile/scores","/u/benchprofile/shows","/u/benchprofile/wishlist"]' \
  goodwatch-benchmark/html-equivalence/run.sh local origin/main perf/profile
node goodwatch-benchmark/profile/compare.mjs /absolute/path/to/equivalence-run
node goodwatch-benchmark/profile/compare.mjs --project /absolute/path/to/stats.html /absolute/path/to/bytes.json
```

The fixture port must already serve an isolated catalog and the synthetic profile.
The timing, capture, rendering and Lighthouse artifacts remain under
`~/.cache/gw-perf/scratch-profile/`. The production capture is not committed.

## Remaining verification

No visible design decision is required. Browser hydration and authenticated member
behavior need a representative fixture or a supplied test session. Existing visibility
tests and unchanged request authorization do not substitute for an authenticated
browser check.

The owner still needs a production-scale isolated profile fixture, including episode
history, credits and trope data, to verify the 300 ms cold-data target. Production
per-query attribution and post-deployment timing remain open. No changes were pushed,
deployed, or applied to production services.

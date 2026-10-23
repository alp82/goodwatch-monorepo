# Member loader cost

Ticket 3 of #753. Measured on October 23, 2026, from branch base
`955a6a12`, with production builds and local fixtures. These figures measure
server work over loopback, not production navigation latency. An anonymous HTTPS
root-loader read confirmed production `env.BETTER_AUTH_ENABLED` is `true`.

## Changes

- `app/utils/auth-session.ts` and `auth.ts`: share the in-flight session promise
  by loader `Request`. Better Auth never shares it with a different request.
  Legacy Supabase's existing explicit `fresh` check keeps its separate path.
- `app/server/media-context.server.ts`: retain its existing request/member cache
  and start account preferences and legacy settings together.
- `app/server/media-payload.server.ts`: resolve presentation language alongside
  canonical catalog data. Discover, library, Taste, person, category and profile
  loaders using this boundary share their session with presentation.
- Movie and show routes: expose timings. The show starts its canonical episode
  grid before authentication, then applies the resolved language within the
  existing optional-part budget. Details still wait for country and language.
- `app/utils/request-work.ts`: request-local promises and duration-only
  `Server-Timing`. Headers are attached at the loader boundary because Remix
  clones the Request before calling a loader. Document rendering still receives
  the same fully resolved loader JSON. No cache policy changes.

`session` measures the actual session resolution, not each waiter. `context`
measures a context cache miss. `data` measures the canonical catalog loader, or
just the details read on titles. `total` spans the instrumented loader, including
presentation and optional parts. Phases can overlap and are not additive.
Existing timing headers are retained. Thrown errors do not get these timings.
Root and child document loaders receive separate Remix Request objects; sharing
is within each loader Request, including all of its helpers. Navigation `_data`
requests run one route loader.

## Measurements

Median milliseconds, 20 successful responses per cell after three warmups.
Before and after alternate for each sample. Requests use Chrome's full user
agent, `Accept-Language: en-US,en;q=0.9`, and the browser cookie. Member requests
also send the same real Better Auth session cookie to both builds.

| Route | Anonymous before | Anonymous after | Member before | Member after |
| --- | ---: | ---: | ---: | ---: |
| `/movie/603-the-matrix` | 4.98 | 5.03 | 10.58 | 10.84 |
| `/show/1399-game-of-thrones` | 5.61 | 5.70 | 8.27 | 8.70 |
| `/movies/best` | 2.75 | 2.55 | 6.45 | 6.98 |
| `/discover` | 2.35 | 2.48 | 9.86 | 6.86 |
| `/my-library/want` | 1.28 | 1.44 | 7.79 | 5.33 |
| `/taste` | 1.27 | 1.36 | 7.54 | 5.38 |

Candidate member phase medians from `Server-Timing`, in milliseconds:

| Route | Session | Context | Data | Total |
| --- | ---: | ---: | ---: | ---: |
| `/movie/603-the-matrix` | 5.10 | 0.40 | 0.50 | 8.10 |
| `/show/1399-game-of-thrones` | 3.60 | 0.30 | 0.50 | 6.35 |
| `/movies/best` | 3.80 | 0.20 | 0.00 | 4.55 |
| `/discover` | 3.40 | 0.30 | 4.35 | 4.60 |
| `/my-library/want` | 2.90 | 0.30 | 3.40 | 3.50 |
| `/taste` | 3.05 | 0.30 | 3.45 | 3.55 |

Discover, library and Taste member medians fell by 30%, 32% and 29% respectively.
Titles and best lists did not improve in this run. They already resolved the
session only once; sub-millisecond changes include instrumentation overhead and
local scheduling noise. These measurements do not establish a production gain.

[Raw requests](member-loads/requests.csv) contain elapsed time, byte count,
cache policy and candidate phase timings. Before has no phase timings.
[The measurement script](../../goodwatch-benchmark/navigation/member-loads.mjs)
accepts two loopback origins, a file containing the local member Cookie header,
and an output JSON path. It does not record the cookie.

## Safe local setup

Both builds use bench Crate `127.0.0.1:15870`, snapshot Valkey
`127.0.0.1:15871`, and a disposable Valkey cluster on `127.0.0.1:16441`.
Ports 3311 and 3312 were checked before starting the servers.
Builds and servers use an empty inherited environment with an explicit allowlist.
Servers preload `goodwatch-tv-a-verify/bench2/block-egress.mjs`; external service
keys are empty. No production environment file or database was used.

The normal production auth initializer requires external SMTP and Google
credentials. In the **scratch copies of both built auth runtime chunks only**,
`getBetterAuth` instead constructs the unchanged `createGoodwatchAuth` with the
bench Crate transport, the actual `ValkeyAuthStorage`, local-only signing and
encryption secrets, empty Google credentials, and a mail queue that records
verification messages locally. It does not start auth maintenance. No auth
adapter, session validation, cookie cache, or session revocation code is replaced.
A test member was created through sign-up, its locally captured email link was
confirmed, and sign-in supplied the session. The member has no saved titles.

The local harness and builds remain under `~/.cache/gw753-member-auth/`:
`start.py`, `fixed-clock.mjs`, `before/`, `after/`, and build/check logs. The fixed
clock makes document comparisons reproducible, including dehydrated query
update times and loader `now` fields. Performance timing uses the real monotonic
clock. The discarded runs with the short `Mozilla/5.0` user agent are excluded;
`isbot` classifies that incomplete user agent as a bot.

## Verification

- Production `npm run build`: passed before and after, with egress blocked.
- `node --test app/utils/request-work.test.ts app/utils/auth-session.test.ts
  app/server/media-context.test.ts app/server/media-rollout-contract.test.ts
  app/server/title-details-concurrent-errors.test.ts`: 73 passed, zero failed.
  Tests cover concurrent callers, request isolation, revocation, context member
  isolation, response headers and JSON preservation.
- Real local revocation check: read a member library on the candidate, sign out
  through the baseline, then resend the unchanged cookie to the candidate. The
  next request returns the guest result.
- `npm run typecheck`: fails with the same 188 diagnostic lines as an isolated
  `origin/main` checkout (`01e079bc`). There are no candidate-only diagnostics.
  Existing failures include route types, missing test dependencies, and hooks.
- `npx biome check` on the ten changed webapp files: 23 existing errors. The
  same eight existing files on `origin/main` have 25 errors; organizing imports
  removes two. The two new request helper files pass.
- [HTML comparison results](member-loads/html.json): 24 successful document
  comparisons match byte for byte after build-hash normalization only. Six
  routes, Chrome and Googlebot, anonymous and member. Four category comparisons
  also match, but both builds return 500 and those are not success coverage.

## Limits and risks

The bench person table is empty, so successful person pages could not be timed.
Category pages need an uncached TMDB genre lookup; egress blocking makes those
fail on both builds. No production member session or populated member taste
fixture was available. Related maps and some optional extras also fall back
without Qdrant/TMDB; the HTML equality result covers those same local fallbacks.
The ticket 1 equivalence harness should still run with its broader fixtures
before merge. A real member navigation test remains useful after deployment.

A request can keep a session resolved just before a concurrent sign-out until
that request finishes. The next request checks the store again. No cross-request
Better Auth memo or cookie cache was added. A short cross-request memo would save
more store reads but delay revocation. A signed cookie cache also avoids reads,
but keeps accepting a revoked session until expiry unless another authoritative
check is added. Those are separate owner decisions.

# YepWatch E2E harness

Hermetic stack + Playwright gates for the web app. Everything runs on 127.0.0.1, ports 18379–18490.

```sh
cd yepwatch-app/e2e
npm install                 # axe-core only; Playwright comes from yepwatch-app/node_modules
npm run e2e:gate            # < 4 min: every journey once, core journeys under no-WS + rapid taps, timings x3, axe
npm run e2e:full            # < 15 min: every journey under all six faults (restart serially), timings x10, 6 people
npm run e2e:smoke -- --origin https://yepwatch.com   # guests only, production budgets, fast-4G throttling
node run.mjs gate -- --grep invite                   # extra args go to Playwright
```

The commands live here, not in `yepwatch-app/package.json`: that file's scripts are part of the Expo
runtime fingerprint (`docs/ota-updates.md`), so adding scripts there would strand installed builds.

Smoke sampling: one room per run, 20 voting rounds (each a match), so vote → peer gets a p95 from the run
alone. Create and Start happen once a run: their p95 is taken over this run and the newest earlier runs against
the same origin (up to 20 runs or 20 samples; `lib/timing-window.mjs`, history in
`artifacts/smoke-history.jsonl`, kept between CI runs in the Actions cache).

Smoke runner network (`lib/reachability.ts`): during a production smoke the runner process asks YepWatch's readiness
route and an IPv4 reference (`https://1.1.1.1/cdn-cgi/trace`, override with `E2E_SMOKE_REFERENCE_URL`) every 250 ms.
A stretch where neither answered is the runner's own outage: the gates judge the room's words against it, and timing
samples and transport errors that overlap it are left out (and listed under "Runner network" in summary.md), so a
dropped home or CI line doesn't fail YepWatch or poison the smoke history. YepWatch not answering while the reference
does, or answering 5xx, for 1 s or more is a failure of its own.

Reports: `artifacts/<tier>/report.json` (every gate failure with journey, fault, gate, measured vs budget,
artifacts; timing p50/p95 per moment) and `artifacts/<tier>/summary.md`. Traces of failed tests are under
`artifacts/<tier>/results-*/` (`npx playwright show-trace <zip>`). They hold actions and console only, with each
page's network history (headers and timings, no bodies) as a HAR beside them, its final screenshot and accessibility tree: Playwright's screencast and DOM snapshots (taken around every
call, the recorder's 25 ms polls included) cost the measured pages frames no phone pays. `E2E_TRACE=full` brings them
back for local diagnosis, never in a gated run.

## Stack (`stack/`)

`node stack/up.mjs [--reset] [--rebuild]` brings it up or reuses a warm one (warm: < 1 s; after a source
change only the changed bundle/export is rebuilt) and writes `.stack.json`:

| key | what |
|---|---|
| `front` | Caddy (Docker) serving the web export with the production Caddyfile, upstreams rewritten to loopback |
| `api`, `ws` | the same origin's API and realtime routes |
| `control` | supervisor control API (below) |
| `issuer` | fake GoodWatch OAuth issuer + member resource |
| `crate`, `valkey` | Docker Crate (room store) and Valkey (cluster mode, revision + activity bus) |

`node stack/down.mjs [--all]` stops the supervisor and Caddy (`--all` also Valkey and Crate).

Real code paths: the release API runtime (`createReleaseRuntime` + `releaseHttp`: relational Crate store,
release control, member adapter, room search client, readiness, repair), the realtime gateway bundle, the
production Caddy route table, the invite link-card renderer. Substitutes (all loopback):

- catalog reads: a deterministic 600-title fixture (`stack/fixture-titles.mjs`) fed through the real deck
  code (`createContinuousCatalog`, `proposalCatalog`, idea interleaving) instead of the GoodWatch title
  snapshot + catalog SQL; posters are local SVGs; no scores enrichment, trailers or backdrops.
- GoodWatch issuer, member resource and search role: `stack/fakes.mjs`, reached over real HTTP.
- release limits at the storage schema maxima (120 admissions and 2400 commands a minute; production runs
  20/600); neither has a shared cap on active rooms. The full tier resets the store between phases.
- gateway connection caps raised (`stack/gateway-entry.ts`): every browser arrives from 127.0.0.1.

Safety: every server starts from an empty environment plus an allowlist; endpoints must be loopback and
third-party keys empty (`stack/safe-env.mjs`), and Node children load `stack/block-egress.mjs`, which
refuses any non-loopback socket. No `.env` file is read.

### Control API (fault injection, for any client incl. native)

```sh
curl -X POST localhost:18490/restart/api?downMs=1500      # or /restart/gateway, &signal=SIGKILL
curl -X POST localhost:18490/stop/gateway ; curl -X POST localhost:18490/start/gateway
curl -X POST localhost:18490/faults -d '{"wsBlocked":true}'   # refuse WebSocket upgrades (and drop open sockets)
curl -X POST localhost:18490/faults -d '{"wsStall":1}'       # the next WebSocket handshake gets no answer at all
curl -X POST localhost:18490/faults -d '{"latencyMs":150}'    # per-chunk latency on API + gateway
curl -X POST localhost:18490/reset                            # drop + re-provision the room store
curl localhost:18490/status
curl -X POST 'localhost:18485/_e2e/lapse?user=<account>'      # GoodWatch refuses renewal for that account
```

While a service is down its proxy stops listening, so Caddy holds and retries requests exactly as in front
of a restarting production container.

## Harness (`lib/`)

- `harness.ts`: `room.person(name, { device, member })` gives an independent browser (its own Chromium process, so its own
  renderer and GPU process, as each real phone has its own GPU; one shared Chromium made phones that animate at once
  slow each other's frames) with one context (phone 390×844 or
  desktop 1440×900); `person.tap(locator, { expect, moment, observers })` presses a control and
  measures, page-side, from the input event to the first frame showing the expected state (on this and
  other phones). `room.point(label)` is the fault hook journeys call between steps.
- `recorder.page.js`: injected before the app; records screen states per frame (test-id markers),
  notes and blocking words, inputs and their first changed frame, layout shifts, long animation frames. It reads a
  frame only after a DOM change, from a marker list kept by its MutationObserver (no document-wide query per
  marker). `web/recorder.spec.ts` pins what the gates catch
  from it (one-frame flashes five ways, layout shift, every kind of connection and blocking line, a dropped frame
  after a press, dead buttons, waiter times) on synthetic pages, without the stack.
- `gates.ts`, `a11y.ts`: flashes, layout shift, blocking words, connection words (none during an outage
  shorter than 3 s, so none for a hidden tab, a second device or no WebSocket; then one line, gone within 1 s
  of the outage's end; never a countdown; outages are the restart and offline windows), dead buttons, frame
  gaps, errors (console, uncaught, HTTP, schema via the app's own `sharedSchema`/`parseFrame`), axe WCAG 2.2
  AA + accessible names + 48×48 targets. Budgets: `budgets.mjs`.
- Faults (Playwright projects): `none`, `nows`, `rapid`, `slow` (slow network + 4 s offline), `hidden`
  (tab hidden + frozen, clock +5 min), `twodevice` (second tab of the same person, then reload mid-vote),
  `restart` (API/gateway restart mid-journey, serial).
- Black hole (`lib/blackhole.ts`, `web/blackhole.spec.ts`): `room.person(name, { network: hole })` sends that browser
  through a SOCKS5 proxy on loopback; `hole.drop()` / `hole.dropAfterUpgrade()` loses every packet silently (no error,
  no close, navigator.onLine stays true) until `hole.restore()`. TCP is modeled: bytes sent meanwhile arrive at their
  sender's next retransmission (200 ms, then doubling), a new connection at its next SYN retry (1 s, 3 s, 7 s…).
- Smoke member session (`lib/smoke-session.ts`): production smokes keep the member's YepWatch sign-in between runs in
  `~/.config/yepwatch/smoke-member-session.json` (mode 600, `E2E_SMOKE_MEMBER_SESSION` overrides), so back-to-back
  runs don't each go through GoodWatch's OAuth authorize (30 a minute per address). Delete the file to sign in afresh.
- Fake sign-in: `room.person(name, { member: 'member-x' })` sets a cookie the fake issuer reads, so
  Continue with GoodWatch comes straight back signed in as that account (`person.roundTrip(button)`).

## Diagnosing frames (never in a gated run)

Switches for perf work. run.mjs, the gate and CI never set them; the normal smoke deals its looks at random.

| env | what |
|---|---|
| `E2E_LOOK=wall` or `wall,neon` | every card gets that look (a list is dealt in order), so a run measures one look's frames |
| `E2E_DIAG=1` | the recorder also keeps every frame gap over 17 ms, when each room answer and WebSocket message arrived, React commit times, the look of the card each input aimed at, and the largest room update (`renders`: plus the components each commit rendered; needs `--no-minify`) |
| `E2E_DUMP_DIR=<dir>` | each traced person's recordings and command log as `<test>/rec-<name>.json` |
| `E2E_PERF_TRACE=<regex>` | a Chrome trace of each matching person into `E2E_DUMP_DIR` (`E2E_PERF_TRACE_CATS` picks the categories; tracing costs frames itself) |
| `E2E_DIAG_CPU_THROTTLE=2` | CPU throttling against the local stack in any target (production mode included) |

Posters on the local stack are flat SVGs; `curl -X POST 'localhost:18485/_e2e/posters?dir=<folder of JPEGs>'` serves
photo JPEGs instead (no `dir`: back to SVGs), so posters cost what TMDB's w500 JPEGs cost to decode and paint.

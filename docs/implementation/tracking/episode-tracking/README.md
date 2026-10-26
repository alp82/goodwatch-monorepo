# Episode tracking browser checks

`drive.mjs` mounts the real title-page and episode-tracking components on
`/prototype/episode-tracking-real`. The route supplies a stand-in member, fixture
episodes and an in-browser fake server running the real tracking state machine.
No member account or database is needed. Each scenario gets a fresh browser
context. Checks include stored state and watches, dates, exact Undo restoration,
serialized requests, optimistic rollback, accessibility, and navigation.

The driver follows the status/score split control, the score dialog's **How far
are you?** choices (including the Watching episode picker), and the ratings
grid's **Grid / Consistency** switch. Season labels and episode tiles open the
inline season. The removed rate prompt, matrix, finder and Seen-press summary
are no longer expected; their tracking operations are covered through the current
status menu, grid, score dialog and date dialog.

## Run

Install the webapp with `npm ci --include=dev` inside `goodwatch-webapp`.
On machines with global libvips, `SHARP_IGNORE_GLOBAL_LIBVIPS=1` avoids sharp's
attempt to compile against it. Install `playwright-core` in a scratch directory,
and install a matching Chromium, or use an existing pair:

```bash
export TMPDIR="$HOME/.cache/gw-work/771"
mkdir -p "$TMPDIR"
export HARNESS=http://127.0.0.1:3771
export SHOTS="$TMPDIR/shots"
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs
export CHROMIUM=/absolute/path/to/chrome
node docs/implementation/tracking/episode-tracking/drive.mjs
```

`PLAYWRIGHT_MODULE` defaults to `playwright-core`; omitting `CHROMIUM` uses
Playwright's installed browser. Optional arguments: `phone`, `desktop` or
`phone,desktop` (default). `DESKTOP` overrides the desktop width (default 1280).
`SCENARIO` filters scenario names for debugging; omit it for the full proof.
Phone checks run at 390 × 844, desktop at 1280 × 900.

Start the local webapp separately. **Keep production `.env` files out of the
server directory and start with `env -i` plus an explicit allowlist.** Use
loopback database/cache endpoints, empty service credentials, and a server
preload refusing outbound non-loopback connections. A browser harness alone
does not isolate server startup jobs. The driver itself refuses non-loopback
`HARNESS` URLs, stubs remote browser resources and poster-impression telemetry,
and blocks real browser POSTs; the fake server handles tracking writes in memory.
An unexpected API write still fails the run.

The fixture route is development-only in normal builds. To check a compiled
build, use a **private scratch copy** of this worktree's webapp, with no `.env`:

- Include `prototype.episode-tracking*` in the private Vite build's routes.
- Permit those prototype modules and their Tailwind sources in that private
  copy's `leanStylesheet` build hook.
- Remove the production-only 404 guard in the private fixture route.
- Build with `npm run build`, then serve the result with the same isolated
  environment. These harness-enabling changes must stay outside shipped code.

## Issue #771 validation

Baseline: `59f9b35ba` (2026-10-26). The original driver, with the updated local
browser launcher, fails at line 92 waiting for `[data-rate-prompt]`.

The compiled proof uses a `git archive HEAD goodwatch-webapp` copy under
`~/.cache/gw-work/771/build-copy`, the worktree's installed dependencies, and
only the private harness-enabling changes above. Server: `127.0.0.1:3772`;
throwaway one-node Valkey cluster: `127.0.0.1:6771`; Crate points to unused
`127.0.0.1:1`. Better Auth is enabled with no session; the fixture supplies its
own member. There are no production credentials, `.env` files or database
connections. A `net.Socket.connect` preload refuses non-loopback egress.
Remote artwork and telemetry are stubbed, so screenshots verify local UI and
interaction rather than remote image delivery.

Run logs and screenshots are under `~/.cache/gw-work/771/`. Relevant commands:

```bash
# From goodwatch-webapp:
node --test 'app/domain/tracking/*.test.ts' 'app/ui/tracking/*.test.ts'
npx tsc --noEmit
npm test
# From goodwatch-flows (isolated Python 3.14 environment with wmill/crate):
PYTHONPATH=.:windmill python -m pytest tests/test_watch_migration.py
pytest
```

Checks on the unchanged application source at the baseline above:

| Check | Result |
| --- | --- |
| Tracking domain/UI unit suites | 153 passed, 0 failed |
| Tracking migration pytest suite (Python 3.14) | 27 passed |
| Webapp type check | 192 existing TypeScript errors |
| Full webapp unit suite | 5,232 passed, 9 failed, 8 skipped, 1 todo |
| Full default `pytest` invocation | Stopped at collection: 87 errors, including missing dependencies and Python import-path setup |

The full-suite failures are outside this driver-only change. Their complete
output is retained in `tsc.log`, `unit.log` and `pytest.log` in the scratch folder.
The focused Python run uses its own environment and `PYTHONPATH=.:windmill`;
the owner checkout and its dependencies were not changed.

Final compiled browser proof (`proof.log`): **46 scenarios completed;
392 of 392 checks passed** — 196 at 390 px and 196 at 1280 px. Build and
precompression passed; both scripts passed `node --check`, and `git diff --check`
passed. The initial complete run also passed 380/380 before the extra Seen-season
restoration scenario was added (that scenario separately passed 12/12 across
both widths). Screenshots are in `proof-shots/` in the scratch folder.

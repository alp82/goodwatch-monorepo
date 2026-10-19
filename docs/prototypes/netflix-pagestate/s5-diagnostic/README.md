# Netflix S5 diagnostic v1 — owner-only experiment

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730), [reviewed S5 design](../DESIGN-S5.md). Owner decision Q30 (2026-10-19) permits capture experiments on the owner's **own account only**. This is **not a member feature**. Any member release waits on terms research [#732](https://github.com/alp82/goodwatch-monorepo/issues/732). Astra implementation review must finish before the owner loads this package.

The popup explicitly starts S5. It does not click, install a fetch/XHR wrapper, start S4, export membership or read cookies/tokens/storage. It issues same-origin `CarouselPage` calls using browser-managed credentials. The Git adapter configuration is disabled; an offline packager installs exactly one saved-build desktop adapter in the private package. Unknown builds, headers, transport modes and shapes fail closed.

For a positive reference total `N`, the first call uses `P = min(N, 200)` from the start. A full whole-row reply gets one confirming full read after a one-second gap. If the server validly clamps, continue one bounded paged traversal using returned cursors; it remains paged evidence, with no additional confirming pass unless the initial reply supplied the whole row. No retry, header negotiation, document negotiation, page-size search or silent S4 fallback. A whole-row reply is the strongest available consistency evidence, and agreeing replies add repeatability, but neither proves a snapshot: the verdict stays `partial` / `snapshot_unproven`.

The bounds are **S5-issued calls**: at most 60 starts, one active call, a one-second gap after completion, eight seconds per call through validation, and a 90-second read deadline. Wrappers/service workers/browser transport can add requests or ignore abort; network behavior remains `unproven`. Identifiable wrappers and controlling service workers are refused; fetch replacement/controller changes terminate the run. No transport cessation, authenticated-server provenance or risk-free access is claimed.

Success, Stop, Cancel, error and timeout automatically finalize/release private state. Only an immutable counts report survives; reopening/copying it never reissues calls. The report includes requested/returned sizes, bytes, timings, issued/abandoned calls, passes/coverage/cursor progression, whole-row versus paged outcomes, agreement and fixed codes. There is no membership Save.

## Files and review seams

| File | Role |
| --- | --- |
| `extension/provenance.js` | S4 v3's DOM/inline-state profile, row, freshness and card checks, without arrow/observer code; safe integer IDs enforced. |
| `extension/adapter.js` | Pinned endpoint/build/desktop selection, 23-variable constructor, header allowlist and strict response validation. |
| `extension/runtime.js` | Counts-only commands, fetch integrity, bounded scheduling, atomic page acceptance, repeat comparison, card downgrade and private-state release. |
| `extension/adapter-config.js` | Disabled in Git; actual saved-build/document constants exist only in the private package. |
| `extension/popup.*`, `manifest.json` | Owner-only popup and `activeTab`/`scripting`; no persistent host grant, background worker, storage or download permission. |
| `scripts/package.mjs` | Offline restricted AST/literal parser. Refuses non-query/ambiguous operations and non-reviewed filename/signature; never executes the saved client. |
| `test/s5.browser.mjs` | Request/report, failure/bounds/lifecycle and actual-value release seams in Chromium with a fake GraphQL server. |
| `test/popup.browser.mjs` | Real unpacked extension and popup, synthetic Netflix page, fixture adapter. |
| `test/worker.browser.mjs` | Real Chromium worker and loopback server demonstrate one page call producing two server requests. |
| `test/package.test.mjs` | Offline query/literal/packaging constraints with invented identifiers. |

The test-only holder hook requires `fixture: true` in the adapter. The private package has `fixture: false`; it installs no hook. Tests inspect actual maps, request/config/reference/card fields and late callbacks, not a release flag. The runtime keeps all per-run private values in revocable holders; the bridge to the popup returns only counts. There is no private DOM-event bridge to retain or forge.

## Run offline verification

```sh
cd docs/prototypes/netflix-pagestate/s5-diagnostic
mkdir -p "$HOME/.cache/gw730-s5"
TMPDIR="$HOME/.cache/gw730-s5" \
GOODWATCH_PLAYWRIGHT_MODULE="$HOME/.cache/gw-pw/node_modules/playwright-core/index.mjs" \
GOODWATCH_CHROMIUM_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" \
npm test
```

Use the installed Playwright/Chromium paths for the environment. No dependency installation or Netflix access is necessary. Chromium's resolver blocks non-fixture hosts, Netflix-looking URLs are fulfilled locally, and the worker test uses only a loopback server. Some bound tests accelerate the external clock; the whole-row test checks the real one-second gap. Temporary profiles stay under `TMPDIR`, outside `/tmp`.

The red/green sequence began with whole-row request/report behavior, then actual retained-map release, wrapper refusal, P4 rejection, card downgrade, abort-ignoring bodies, memory limits, Stop release, cleanup failure, the real popup, restricted packaging and interruption during validation. Each failure was observed before its corresponding implementation/fix. Broader fault cases exercise those same reviewed seams.

## Build the private owner package offline

```sh
node scripts/package.mjs \
  /path/to/private/Netflix.html \
  /path/to/private/Netflix_files/akiraClient.63cd947e0f9055ee9c23.js \
  "$HOME/goodwatch-private/706/s5-diagnostic-v1"
```

The destination must be new. The packager never overwrites another package. It copies extension assets plus this README, `CHECKLIST.md` and `results.md`; it writes static build/document constants and an audit of the single query/fragment inventory locally. It does not copy the HTML, client bundle, member titles/IDs or profile/token values. Keep the generated configuration and audit outside Git. Review the code and the private adapter audit before loading; packaging is not an implementation-review approval.

## Owner run after Astra approval

Allow **4–6 minutes**, including loading, one run, copying the counts and unloading. Follow `CHECKLIST.md`. A supported 77-entry whole-row read should need only two S5-issued calls and a gap; actual latency/header/server-size compatibility remains unmeasured. A paged/slow run can take up to 90 seconds, plus bounded finalization. Do not rerun automatically on an error. Share only the counts report, never Network-tab payloads, screenshots with titles, cookies or the private adapter audit.

Netflix's terms risk applies to both S4 and S5; same-origin, read-only intent and a low rate do not establish permission. Q30 authorizes this private owner experiment, not member deployment or a claim about enforcement likelihood. The implementation review and the owner live run remain outstanding; all current API results are synthetic.

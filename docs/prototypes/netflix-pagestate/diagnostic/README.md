# GoodWatch capture diagnostic, version 3 (experiment)

A counts-only diagnostic for ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730), built to `../DESIGN.md` revision 3 with the two follow-up changes from the review of `54bfb420`. It isn't a GoodWatch feature and writes no file.

On Netflix's My List page it:

1. Checks the page state with the 0.0.7 provenance rules.
2. Installs a bounded, pass-through observer of the page's own `CarouselPage` responses.
3. Clicks the reviewed My List arrow so the page fetches each page.
4. When the member chooses **Finish and show report**, finalizes and shows a report of counts and fixed codes.

The verdict stays `partial` with `snapshot_unproven` when every position was observed, because owner question Q26 is open.

## Files

| Path | What it is |
| --- | --- |
| `extension/core.js` | Shared core: session states, traversal bounds, membership, finalize, report |
| `extension/netflix.js` | Netflix module: provenance, row, arrow, card evidence, verdict |
| `extension/observer.js` | Page-world observer (pass-through `fetch` and XHR wrappers) |
| `extension/content.js` | Isolated-world entry and the event-channel bridge |
| `extension/popup.*`, `extension/manifest.json` | Popup; permissions `activeTab` and `scripting` only |
| `test/core.test.mjs` | 21 Node tests: traversal bounds, guards before each click, lifecycle, evidence release (actual map values), report |
| `test/observer.browser.mjs` | 31 Chromium tests against native `fetch` and XHR (P8, P9, both implementation reviews) |
| `test/e2e.browser.mjs` | 8 Chromium tests with the real unpacked extension and popup |
| `test/fixture.mjs` | Synthetic Netflix page and fake GraphQL server |

## Run the tests

```sh
cd docs/prototypes/netflix-pagestate/diagnostic
npm test                                   # Node tests
TMPDIR=$HOME/.cache/gw706 \
GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
GOODWATCH_CHROMIUM_PATH=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
npm run test:browser                       # Chromium tests, about 3 minutes
```

Every netflix.com request in the browser tests is fulfilled locally. A short `TMPDIR` avoids Chromium's socket-path limit.

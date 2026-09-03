# Playwright 1.45.1 to 1.62.0 upgrade review

## Recommendation

Upgrade the Windmill scripts and their worker image to Playwright 1.62.0 together. No Playwright API changes are required in the five current scripts. The upgrade fixes the immediate container-build problem because Playwright added Debian 13 (Trixie) support in 1.55; 1.45.1 predates it. The main validation target is behavior under the much newer bundled browser, not source compatibility.

## Repository usage reviewed

Five Windmill Python scripts declare `playwright==1.45.1`, each with a generated `.script.lock` containing the same version:

- `goodwatch-flows/windmill/f/tvtropes_web/tv_tropes_crawl_tags/fetch.py`
- `goodwatch-flows/windmill/f/rotten_web/rotten_tomatoes_crawl_ratings/fetch.py`
- `goodwatch-flows/windmill/f/utils/visit_goodwatch_and_populate_cache.py`
- `goodwatch-flows/windmill/f/other/screenshot.py`
- `goodwatch-flows/windmill/f/stress/load_testing.py`

They use the async API, default bundled Chromium, `browser.new_context()`, navigation, standard CSS/text locators, DOM evaluation, and screenshots. A targeted search found none of the APIs and selectors removed or behaviorally tightened in 1.46–1.62: routing globs or cookie-header overrides, `page.accessibility`, React/Vue/`:light` selectors, background pages, `devtools=`, `expose_binding(handle=...)`, or editable assertions.

The project-level dependency is separate and currently inconsistent: `goodwatch-flows/pyproject.toml` says `playwright>=1.38.0`, while `goodwatch-flows/pdm.lock` resolves 1.38.0. If that PDM environment is still used for development or validation, pin it to 1.62.0 and regenerate `pdm.lock` as part of the same upgrade; otherwise local checks would exercise a different Playwright release than Windmill.

## Changes that matter here

| Version | Upstream change | Impact on Goodwatch |
| --- | --- | --- |
| 1.49 | Python 3.8 support was removed. Explicit Chrome/Edge channels switched to the newer headless mode. ([official notes](https://playwright.dev/python/docs/release-notes#version-149)) | No explicit channel is used. The flows already require Python >=3.10. |
| 1.52 | Route URL globs no longer interpret `?` or `[]`, and `route.continue_()` can no longer override `Cookie`. ([official notes](https://playwright.dev/python/docs/release-notes#version-152)) | No routing APIs are used. |
| 1.55 | Debian 13/Trixie support was added; Chromium Manifest V2 extension support was dropped. ([official notes](https://playwright.dev/python/docs/release-notes#version-155)) | This is the direct fix for `playwright install --with-deps chromium` in the current Debian 13 Windmill base. No extensions are used. |
| 1.56 | Chromium background-page events/properties stopped working. ([official notes](https://playwright.dev/python/docs/release-notes#version-156)) | Not used. |
| 1.57 | The bundled Chromium download switched to Chrome for Testing. Headed mode uses `chrome`; headless mode uses `chrome-headless-shell`; Linux arm64 remains on Chromium. The deprecated `page.accessibility` API was removed. Chromium service-worker requests and console messages became observable through context/worker APIs. ([official notes](https://playwright.dev/python/docs/release-notes#version-157)) | All five scripts launch the default browser headlessly, so x86-64 production will run Chrome Headless Shell rather than the older Chromium bundle. Upstream expected existing tests to continue passing, but the two crawlers and screenshot flow should be smoke-tested against real sites. No removed API is used. |
| 1.58 | `_react`, `_vue`, and `:light` selectors and `browser_type.launch(devtools=...)` were removed. ([official notes](https://playwright.dev/python/docs/release-notes#version-158)) | Not used; current CSS and `:text-matches()` locators remain supported. |
| 1.60 | The deprecated `handle` option on `expose_binding` was removed. ([official notes](https://playwright.dev/python/docs/release-notes#version-160)) | Not used. |
| 1.61 | The Python package minimum changed from Python >=3.9 to >=3.10. ([1.60 package metadata](https://github.com/microsoft/playwright-python/blob/v1.60.0/pyproject.toml), [1.61 package metadata](https://github.com/microsoft/playwright-python/blob/v1.61.0/pyproject.toml)) | Compatible with the repo's `requires-python = ">=3.10"` and the Windmill lockfiles' Python 3.11 target. |
| 1.62 | Debian 11 support was removed. In headless mode, `navigator.clipboard` is now isolated from the host OS. ([official notes](https://playwright.dev/python/docs/release-notes#version-162)) | The worker base is Debian 13 and the flows do not use the clipboard, so neither change requires code work. |

Other listed releases (1.46–1.48, 1.50–1.51, 1.53–1.54, and 1.59) introduce features or changes outside the APIs/platforms used by these flows. The complete first-party history is in the [Playwright Python release notes](https://playwright.dev/python/docs/release-notes).

## Runtime risks and validation

Playwright 1.45 bundled Chromium 127, while 1.62 bundles Chrome for Testing 151 ([1.45 browser versions](https://playwright.dev/python/docs/release-notes#version-145), [1.62 browser versions](https://playwright.dev/python/docs/release-notes#version-162)). That 24-major browser jump can change rendering, site JavaScript behavior, network behavior, anti-bot signals, and screenshots even though the called Playwright APIs remain compatible.

Run these checks after rebuilding the image:

1. Confirm `playwright --version` reports 1.62.0 and a minimal `p.chromium.launch()` succeeds inside the built worker.
2. Smoke-test both production crawlers against representative successful, 404/alternate-title, and 403/rate-limit paths.
3. Run the screenshot flow and visually compare its PNG output.
4. Run the cache-population flow and a short, low-concurrency load test.
5. Watch for blocking/challenge pages and changed status codes. The upgrade aligns the load-test script's custom user-agent major version with Chrome 151 to avoid advertising Chrome 123 while running Chrome 151.

## Required upgrade edits

- Change all five `# playwright==1.45.1` Windmill dependency declarations to 1.62.0.
- Regenerate all five `.script.lock` files so Playwright and its transitive dependencies are resolved together; do not only substitute the Playwright line by hand.
- Simplify both worker Dockerfiles to install and run the same release, for example `uv tool install playwright==1.62.0` followed by `playwright install --with-deps chromium`.
- Align the load-test script's custom user-agent major version with the bundled Chrome 151 release.
- If the project-level PDM environment remains supported, pin `goodwatch-flows/pyproject.toml` to 1.62.0 and regenerate `goodwatch-flows/pdm.lock`.

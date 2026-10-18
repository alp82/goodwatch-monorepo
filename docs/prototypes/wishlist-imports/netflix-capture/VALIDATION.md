# Capture validation

## Version 0.0.4: supplied saved-page evidence

The owner supplied a complete local HTML save after version 0.0.3 also returned `boundary_missing`. Inert inspection found no legacy grid, row or card classes. The actual saved structure uses `section.carousel-row`, a semantic My List heading, and `a[data-uia="standard-card"]` with the title on the anchor’s `aria-label` and one numeric `jbv` query parameter on a Netflix `/browse` link. The original saved HTML, account details, title names, IDs and assets are not published. The regression fixture preserves the relevant structure with invented data.

The private offline replay compares exact IDs and titles: version 0.0.3 returns `boundary_missing`; version 0.0.4 captures exactly the five loaded My List cards among sixteen card occurrences across five rows. Eleven other-row occurrences are excluded. Some titles occur in several rows, so this is an exact comparison with the intended row rather than an assumption that every row has disjoint IDs. Page scripts were disabled, resource requests blocked, and no provider requests sent. This establishes compatibility with the saved snapshot, not whole-list completeness or live carousel loading.

Modern cards retain their exact observed native `sourceId`; `sourceUrl` is omitted because the shared importer strips query parameters, and the saved `/browse?jbv=…` link does not itself establish an alternative route. No movie/show type or catalog identity is inferred. The active-profile marker now uses the exact unique profile-menu trigger/avatar structure found in the saved page; names and avatar URLs stay in memory and never enter the file. Private replay reports the marker present. Synthetic marker-change/disappearance tests discard capture; real profile switching remains unverified.

Final version 0.0.4 validation: 26 command tests pass, and actual unpacked MV3 popup/collector/download runs pass for modern carousel, legacy row and grid fixtures. The new default browser fixture is `modern`; use `GOODWATCH_CAPTURE_FIXTURE=hub` or `grid` for the previous layouts. The permissions remain activeTab and scripting.


## First live attempt and version 0.0.3

The owner supplied a screenshot of `/browse/my-list` showing the German Mein Netflix hub with a horizontal Meine Liste row among other sections, and reported `boundary_missing` after Start. The exact installed version was not confirmed; 0.0.1 and 0.0.2 share the same grid-only collector. This establishes a real layout incompatibility, not a successful capture. No account DOM, source HTML, capture file or credentials were supplied. The private screenshot is not included in this artifact.

Version 0.0.3 adds a conservative exact-heading row detector for My List and Meine Liste, alongside the existing grid detector. The new fixture models the screenshot's section arrangement with invented titles and IDs. Its HTML classes and heading structure are hypotheses, not a copy of the user's DOM. A successful live capture remains unverified.

## Synthetic browser validation

Version 0.0.3 is validated with the command seam and actual unpacked MV3 Chromium runs against both the screenshot-inspired hub fixture and the earlier grid fixture. These results do not establish compatibility with the actual account DOM.

Validated 2026-10-18. **No live Netflix account or provider page was used.** This report describes a real unpacked MV3 extension running in Chromium against the local invented fixture served at a routed Netflix origin. It does not establish current Netflix selectors, accurate provider IDs, whole-list coverage, or successful GoodWatch matching.

## Results

- `npm test`: 20 core tests pass.
- `scripts/browser-integration.mjs`: passes with cached Chromium revision 1248.
- Nested semantic rows are excluded even before their heading mounts; heading-free structural row containers remain allowed. The hub fixture contains separately labelled Continue Watching, trailers, rewatch and recommendation sections; only the exact My List/Meine Liste row is captured. Exact-label changes terminate capture with a partial receipt.
- The actual manifest loads enabled with only `activeTab` and `scripting`, without persistent host access.
- The real extension action opens its actual popup and grants `activeTab`. Opening the popup probes status without starting capture. Popup Start injects the collector into the extension's isolated world; its command global is absent from the page's main world.
- Initial capture observes two synthetic My List cards and excludes a recommendation. Replacing the rendered cards preserves earlier observations; once-encoded tracking JSON is accepted. Contradictory title evidence permanently removes the affected identity for that capture.
- Popup Stop produces a real browser download containing two synthetic items. The JSON carries `goodwatch-wishlist` version 1, source `netflix`, unknown media type and completeness, native source IDs, and canonical URLs without query strings or fragments. It contains no invented TMDB/IMDb identity or profile marker.
- Profile-marker change and SPA navigation away discard the capture and clear the popup's downloadable envelope. No popup runtime exceptions occurred.

The browser harness fulfilled three Netflix-origin fixture/avatar requests locally. It allows extension-resource loads and aborts other page-context requests. It never fetches Netflix or uses a provider session; browser-internal background services are outside this page-routing observation. Source review found no collector network calls, cookie APIs, provider mutations or broad host permissions.

## Reproduce

The browser harness is optional development tooling. It adds no extension runtime dependency. Use an installed `playwright-core` and a local Chromium build supporting the experimental CDP `Extensions.triggerAction` command:

```sh
npm ci
npm test
GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
GOODWATCH_CHROMIUM_PATH=/path/to/chromium/chrome \
node scripts/browser-integration.mjs
# Repeat with GOODWATCH_CAPTURE_FIXTURE=grid to check the earlier grid layout.
```

If `playwright-core` is already installed as a local optional development dependency, omit `GOODWATCH_PLAYWRIGHT_MODULE`. If its default installed Chromium is available, omit `GOODWATCH_CHROMIUM_PATH`. For an optional popup screenshot, set `GOODWATCH_CAPTURE_SCREENSHOT=/path/to/output.png`.

The harness creates and removes a temporary Chromium profile, loads the original extension directory, and uses `--enable-unsafe-extension-debugging` solely to trigger the real extension action through CDP. This test flag must not be used for ordinary browsing and is not an extension permission. No manifest permissions are broadened for testing. The popup is a genuine Chrome action-popup target; because Playwright omits it from `context.pages()`, the harness attaches to that target through CDP. Download assertions inspect the completed browser download, then remove temporary download files.

## Review boundaries

The collector now quarantines contradictory IDs/titles for the capture lifetime, preserves an earlier valid source URL when a later recycled card has tracking-only identity, accepts bounded raw or once-encoded tracking JSON, and rejects hostile raw link forms. Its new row selectors and profile-marker heuristic remain unvalidated against the actual Netflix DOM. A profile with the same visible avatar/name may not be distinguishable; unknown capture completeness remains mandatory.

Popup `accept()` and request-error paths were independently inspected after the final UX pass: unknown/idle/error/discarded states clear the stored envelope rather than allowing stale download. The browser harness exercises actual profile/navigation discard; it does not exhaustively simulate every browser API failure.

Next required live test: after installing version 0.0.3 and refreshing the Netflix tab, an authorized owner compares a known current My List across movies, shows, duplicate titles, scrolling, unavailable titles and two profiles. Catalog native-ID resolution remains separate. This artifact is an extraction experiment, not working Netflix-to-GoodWatch migration support.

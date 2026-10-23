# Instant navigation: primary-source facts

Research date: 2026-10-23. Scope: how client-side navigations work in Remix 2.17 (no future flags), what browsers do with the prefetches Remix inserts, and which tools exist to make page changes feel instant.

GoodWatch runs `@remix-run/react` 2.17.2, `react-router-dom` 6.30.0 and `@remix-run/router` 1.23.0 (checked in `goodwatch-webapp/node_modules`). Source links below point at those exact versions:

- Remix: tag `remix@2.17.2`, commit [`39203495`](https://github.com/remix-run/remix/tree/39203495c6a18f5421d022697906fb2cb9d1d3b8).
- React Router 6: tag `@remix-run/router@1.23.0`, commit [`e4ba5224`](https://github.com/remix-run/react-router/tree/e4ba5224c911e070b1eabd12cff2aa581270dfb3).
- React Router 7: tag `react-router@7.18.4`, commit [`1b1e0b0e`](https://github.com/remix-run/react-router/tree/1b1e0b0e79b21692ce907933475233babdd16e3e).
- Chromium: `main` at [`4788da50`](https://github.com/chromium/chromium/tree/4788da50c5db8b6e651d725c0650722f247d7d13), plus release tags where noted.

Statements marked **(inference)** are my reading of the code, not something a source states. Statements marked **(unverified)** could not be confirmed against a primary source.

## Summary

1. Remix 2 `<Link prefetch>` inserts `<link rel="prefetch" as="fetch" href="/path?_data=routeId">` per loader, `<link rel="modulepreload">` per route chunk, and `<link rel="prefetch" as="style">` for route CSS. The later navigation calls plain `fetch()` with the same URL. Remix keeps no in-memory copy. Reuse depends only on the browser HTTP cache.
2. Chrome removed the "five-minute rule" in Chrome 133. A prefetched response is now reused only if normal HTTP caching allows it. `no-store`, `no-cache` and `max-age=0` responses are fetched twice: once by the prefetch, once by the click. Firefox already behaved this way. Safari does not ship `rel=prefetch` at all (behind a flag), so iOS gets no data prefetch.
3. Speculation Rules only help full document navigations. They do nothing for Remix client-side navigations.
4. View Transitions start after loaders finish. They cannot make data arrive sooner and add animation time.
5. The official tools for "instant" are: cacheable data responses plus prefetch, `defer`/`<Await>` so the shell commits before slow data, a global pending indicator from `useNavigation`, optimistic UI, and `clientLoader` caches.

## 1. Remix 2 `<Link prefetch>`

### Trigger modes

All four modes live in `usePrefetchBehavior` ([components.tsx L133-L199](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L133-L199)). The default is `"none"` ([L219](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L219), [L258](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L258)).

| Mode | When the prefetch tags render | Source |
| --- | --- | --- |
| `render` | In a `useEffect` after the link mounts. | [L145-L147](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L145-L147) |
| `viewport` | When an `IntersectionObserver` with `threshold: 0.5` reports the link as intersecting. Leaving the viewport sets it back to false, which removes the tags. | [L149-L161](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L149-L161) |
| `intent` | 100 ms after `mouseenter`, `focus` or `touchstart`. `mouseleave` or `blur` cancels the timer and removes the tags. | [L164-L197](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L164-L197) |
| `none` | Never. | |

On touch screens, `intent` starts its 100 ms timer on `touchstart`. A tap usually fires `click` before or near that point, so the prefetch often starts at the same moment as the navigation, or not at all **(inference)**. The docs call `viewport` "very useful for mobile" ([link.md](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/components/link.md#prefetch)).

Absolute URLs are never prefetched ([L276-L282](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L280-L282)).

### What is inserted

`PrefetchPageLinksImpl` ([L443-L568](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L443-L568)) renders three kinds of tags right after the `<a>`:

1. **Data.** `<link rel="prefetch" as="fetch" href="/path?…&_data=routes%2Fx">`, one per route loader ([L556-L558](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L556-L558)). Without Single Fetch the hrefs come from `getDataLinkHrefs` ([links.ts L428-L447](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L428-L447)), which copies the target's search params and sets `_data` to the route id.
2. **Modules.** `<link rel="modulepreload">` for each new route's module and its `imports` ([L559-L561](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L559-L561), [links.ts L449-L466](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L450-L466)).
3. **Styles.** It loads each route module, calls its `links()`, and turns `stylesheet` links into `rel="prefetch" as="style"` and `preload` links into `rel="prefetch"` ([links.ts L321-L348](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L321-L348)). This step imports the route module itself, so the JavaScript is fetched and evaluated too.

### Which routes' data are prefetched

`getNewMatchesForLinks` decides ([links.ts L350-L426](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L350-L426)). Without Single Fetch:

- **Same search string** as the current URL: only routes that are new at that position, or whose pathname or splat changed, and that have a loader. `shouldRevalidate` is not called ([L410-L417](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L417-L423)).
- **Different search string**: all matched routes with a loader, except that each reused route's `shouldRevalidate` is called with `defaultShouldRevalidate: true` and its answer is respected ([L379-L409](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L379-L409)).
- **Routes with a `clientLoader` are never data-prefetched** ([links.ts L436-L440](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L436-L440)). Their modules and styles still are.

This mirrors the router's own rule for which loaders a GET navigation calls ([router.ts L4422-L4469](https://github.com/remix-run/react-router/blob/e4ba5224c911e070b1eabd12cff2aa581270dfb3/packages/router/router.ts#L4422-L4469)): new route instances always load; reused ones revalidate when the search changes or when `shouldRevalidate` says so. GoodWatch's root opts out, so a same-search prefetch never includes root data, and the click does not refetch it either **(inference)**.

### Whether the navigation reuses the prefetch

On click, each loader runs `fetchData`, which builds `request.url` plus `_data=routeId` and calls `fetch(url.href, { signal })` ([data.ts L68-L108](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/data.ts#L68-L108), [L113-L116](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/data.ts#L113-L116)). There is no `cache` option, so the default `"default"` cache mode applies. Remix keeps no map of prefetched responses. The URL matches the prefetch href because both serialize the query through `URLSearchParams.set("_data", …)` **(inference)**.

So reuse happens only if the browser HTTP cache returns the prefetched entry. The Remix docs say this directly: "Remix calls your loaders via `fetch` in the browser on client-side transitions. By returning good cache headers here, … the browser won't make another request for the data" ([cache-control.md](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/cache-control.md#loader-cache-control)).

The headers on a `_data` response are the loader's own `Response` headers plus anything `handleDataRequest` in `entry.server` adds ([server.ts L354-L393](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-server-runtime/server.ts#L354-L393), [entry.server docs](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/file-conventions/entry.server.md#handledatarequest)). The route `headers` export applies to data requests only with Single Fetch ([single-fetch.md, Headers](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/single-fetch.md#headers)).

What decides HTTP cache reuse in Chrome (section 2 has the sources):

| Response header | Reused by the click? |
| --- | --- |
| `no-store` | No. Never stored. |
| `no-cache`, or `max-age=0` | No, unless it has `ETag`/`Last-Modified`; then the click sends a conditional request (a round trip, but a 304 body). |
| `private, max-age=N` (N > 0) | Yes, within N seconds. `private` only forbids shared caches ([RFC 9111 §5.2.2.7](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.7)). |
| `s-maxage=N` only | Applies to shared caches only ([RFC 9111 §5.2.2.10](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.10)). The browser falls back to `max-age` or heuristic freshness ([§4.2.2](https://www.rfc-editor.org/rfc/rfc9111#section-4.2.2)). |
| `Vary: X` | Reused only if the click's request has the same `X` value ([RequiresValidation](https://github.com/chromium/chromium/blob/4788da50c5db8b6e651d725c0650722f247d7d13/net/http/http_cache_transaction.cc#L3232-L3242)). The prefetch carries `Sec-Purpose: prefetch` and `fetch()` does not ([Fetch §4.6](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch)), so never `Vary` on `Sec-Purpose`. `Vary: Cookie` is fine when the cookie did not change in between **(inference)**. |
| `Set-Cookie` | No primary source found on whether Chrome's HTTP cache stores responses with `Set-Cookie`. RFC 9111 allows it for private caches **(unverified for Chrome)**. Avoid setting cookies on data responses you want reused. |

If the user clicks while the prefetch is still in flight, the click is a second request. With a cacheable response, Chrome's cache can let the second transaction wait for and read the entry being written; with `no-store` it cannot **(inference from the HttpCache design, not verified line by line)**.

### Route modules and CSS on click

For a route whose module is not loaded yet, the router calls the server loader in parallel with `route.lazy` ([routes.tsx L415-L440](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L415-L440)). `route.lazy` imports the module and then waits for its CSS `<link rel="preload" as="style">` to load before the route can render ([L442-L447](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L442-L447), [L559-L562](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L559-L562), [links.ts L229-L290](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/links.ts#L229-L290)). Module prefetch helps even when data prefetch is wasted, because the module map keeps the evaluated module **(inference)**. Hashed assets are normally long-cached, so their prefetches are reused.

## 2. Browser handling of `rel=prefetch`

### Chrome: the five-minute rule is gone

- Until Chrome 132, the HTTP cache skipped validation for the first use of a prefetched entry within 5 minutes, whatever `max-age` or `no-cache` said. The check lived in `RequiresValidation` behind `!kPrefetchFollowsNormalCacheSemantics` ([Chromium 130 source, L2985-L2999](https://github.com/chromium/chromium/blob/130.0.6723.0/net/http/http_cache_transaction.cc#L2985-L2999)).
- `no-store` responses were never covered. They are not written to the cache at all ([UpdateAndReportCacheability](https://github.com/chromium/chromium/blob/4788da50c5db8b6e651d725c0650722f247d7d13/net/http/http_cache_transaction.cc#L4390-L4403)).
- Commit "Ship PrefetchFollowsNormalCacheSemantics" (2024-12-02) turned the feature on by default ([commit 2fd4b6ef](https://chromium.googlesource.com/chromium/src/+/2fd4b6efce9465948fadc2fcf5b110d4bd4f4035)). It is disabled in [132.0.6834.0](https://github.com/chromium/chromium/blob/132.0.6834.0/net/base/features.cc#L311-L313) and enabled in [133.0.6943.0](https://github.com/chromium/chromium/blob/133.0.6943.0/net/base/features.cc#L301-L303). Chrome Platform Status lists the change for Chrome 133 desktop and Android: "web developers need to include appropriate caching headers (i.e. Cache-Control or Expires) to see benefits from `<link rel=prefetch>`" ([chromestatus 5087526916718592](https://chromestatus.com/feature/5087526916718592)). The intent to ship is on [blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/Zdo71C0k9C0/m/NC98nOQZAQAJ).
- The old code path is deleted by 138.0.7204.0 (no `kPrefetchReuseMins` use in [that file](https://github.com/chromium/chromium/blob/138.0.7204.0/net/http/http_cache_transaction.cc)). The constant and the comment describing cases 13 and 14 are still in `main` but unused ([http_cache.h L223](https://github.com/chromium/chromium/blob/4788da50c5db8b6e651d725c0650722f247d7d13/net/http/http_cache.h#L223), [transaction comment L788-L802](https://github.com/chromium/chromium/blob/4788da50c5db8b6e651d725c0650722f247d7d13/net/http/http_cache_transaction.cc#L788-L802)).
- The web platform test `preload/prefetch-cache.html` asserts this: with `max-age=604800` the resource is fetched once; with `no-cache`, `no-store` or `max-age=0` it is fetched twice ([WPT source](https://chromium.googlesource.com/external/w3c/web-platform-tests.git/+/HEAD/preload/prefetch-cache.html)).

Result for GoodWatch-style headers: `private, no-store` and `private, max-age=0` data responses are fetched by the prefetch and then fetched again by the click. The prefetch only costs server work and bandwidth **(inference from the above)**.

### Spec and other browsers

- HTML defines prefetch as "preemptively fetching and caching the specified resource" with request initiator `"prefetch"` ([HTML §4.6.8.19](https://html.spec.whatwg.org/multipage/links.html#link-type-prefetch)). Fetch then adds `Sec-Purpose: prefetch` ([Fetch §3.8](https://fetch.spec.whatwg.org/#sec-purpose-header), [§4.6](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch)). There is no special reuse rule in the spec.
- MDN: "The result is kept in the HTTP cache … certain Cache-Control headers could block prefetching (for example no-cache or no-store)." Prefetch runs at lower priority than `fetch({priority: "low"})` ([MDN rel=prefetch](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/prefetch)).
- Firefox: Chrome Platform Status marks Firefox as already following normal cache semantics ("Shipped/Shipping") ([chromestatus](https://chromestatus.com/feature/5087526916718592)).
- Safari: `rel=prefetch` exists only behind the `LinkPrefetch` preference since 13.1. `rel=modulepreload` ships since Safari 17 ([MDN browser-compat-data, link.json](https://github.com/mdn/browser-compat-data/blob/main/html/elements/link.json)). All iOS browsers use WebKit, so iPhone users get module prefetch but no data or CSS prefetch **(inference for non-Safari iOS browsers)**.

## 3. `clientLoader`, `clientLoader.hydrate`, `HydrateFallback`

- By default `clientLoader` does not run on hydration. It runs on later client navigations, and `serverLoader()` fetches `?_data` ([client-loader.md, Hydration Behavior](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/route/client-loader.md#hydration-behavior), [routes.tsx L339-L372](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L339-L372)).
- `clientLoader.hydrate = true` runs it on hydration. On that first call `serverLoader()` returns the SSR data without a request ([routes.tsx L355-L365](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L355-L365)). Without a `HydrateFallback`, the component is SSR'd with server data and updated in place, so `loader` and `clientLoader` must return the same data on first load ([client-data.md, Client Cache](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/client-data.md#client-cache)).
- `HydrateFallback` renders during SSR instead of the component, until the `clientLoader` finishes on hydration ([client-loader.md, HydrateFallback](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/route/client-loader.md#hydratefallback)). It hurts first paint and SEO for content pages **(inference)**.
- The official cache pattern: load from the server `loader` on the document request, set `clientLoader.hydrate = true` to prime a cache, answer later navigations from the cache in `clientLoader`, and invalidate in `clientAction` ([client-data.md, Client Cache](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/client-data.md#client-cache)). The docs warn that once you own the cache, Remix "can no longer guarantee your UI remains in sync".
- Stale-while-revalidate is not in the official example. A `clientLoader` can return cached data at once and start a background `serverLoader()` that updates the cache, but the route will only show fresh data on the next navigation or a `useRevalidator().revalidate()` **(inference)**. Returning a promise inside `defer()` from a `clientLoader` is another way to render cached data while fresh data streams **(unverified: not in the 2.17 docs)**.
- Interaction with prefetch: `<Link prefetch>` does not prefetch data for `clientLoader` routes (section 1), so the cache must be warmed by the app, for example on `mouseenter` **(inference)**. `shouldRevalidate` still controls whether the `clientLoader` is called at all on a navigation ([router.ts L4422-L4469](https://github.com/remix-run/react-router/blob/e4ba5224c911e070b1eabd12cff2aa581270dfb3/packages/router/router.ts#L4422-L4469)).

## 4. Speculation Rules

- Chrome: "Speculation rules are only supported for full page navigations managed by the browser." SPA "soft navigations" are not covered. "The data needed for these so called soft navigations can be prefetched by the app outside of speculation rules" ([Chrome prerender guide](https://developer.chrome.com/docs/web-platform/prerender-pages)). Remix intercepts same-origin link clicks, so speculation rules do not help those clicks **(inference)**. They can help links that do full document loads, for example `reloadDocument` links or entry from other sites.
- Eagerness, per the same guide: `immediate` (as soon as seen), `eager` (10 ms hover on desktop, 50 ms in viewport on mobile, since Chrome 143), `moderate` (200 ms hover or pointerdown on desktop, viewport heuristics on mobile), `conservative` (pointer or touch down). List rules default to `immediate`, document rules to `conservative`. Non-immediate speculations are capped at 2 (FIFO) for both prefetch and prerender.
- Document rules use `where` with `href_matches`, `selector_matches`, `and`, `not`.
- Speculation prefetches are held in memory, so documents that are not HTTP-cacheable can still be prefetched, unlike `rel=prefetch` ([same guide](https://developer.chrome.com/docs/web-platform/prerender-pages)). The Chromium commit that removed the five-minute rule keeps this in-memory path ([2fd4b6ef](https://chromium.googlesource.com/chromium/src/+/2fd4b6efce9465948fadc2fcf5b110d4bd4f4035)).
- Support ([MDN BCD, script.json](https://github.com/mdn/browser-compat-data/blob/main/html/elements/script.json)): Chrome 109+ (prefetch 110+, prerender 105+, document rules 121+). Firefox: prefetch of URL lists in preview only. Safari 26.2: prefetch behind a preference, no prerender.

## 5. bfcache

- Blockers listed by the Chrome team ([web.dev bfcache](https://web.dev/articles/bfcache)): `Cache-Control: no-store` on the document (historically), `unload` listeners (Firefox desktop; Chrome no longer fires `unload`), in-progress `fetch()`/XHR, open IndexedDB connections, WebSocket/WebRTC in some browsers ("Chrome (as of 149) and Safari do no block on open WebSockets"), and a non-null `window.opener`. Test in DevTools under Application > Back-forward Cache. The `NotRestoredReasons` API reports reasons in the field.
- `no-store` documents: Chrome now admits them when safe. Experiments began in Chrome 116, and the final rollout to 100% ran over March and April 2025 ([Chrome bfcache-ccns](https://developer.chrome.com/docs/web-platform/bfcache-ccns)). Such pages are evicted on any cookie change, kept for 3 minutes instead of 10, and evicted if "a Cache-control: no-store page makes a fetch or XHR request and that returns Cache-control: no-store on its response" (same page).
- Relevance: bfcache restores whole documents. Back and forward inside a Remix session are client-side `popstate` navigations that run loaders again, so bfcache only matters when the user leaves the site and comes back **(inference)**. A member document served `no-store` that then fetches `no-store` `_data` is evicted (rule above).

## 6. View Transitions

- `<Link viewTransition>` is the prop name in react-router-dom 6.30 and Remix 2.17 docs ([link.md, viewTransition](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/components/link.md#viewtransition), [index.tsx L946](https://github.com/remix-run/react-router/blob/e4ba5224c911e070b1eabd12cff2aa581270dfb3/packages/react-router-dom/index.tsx#L946)). It wraps the final state update in `document.startViewTransition()`.
- The router sets `viewTransitionOpts` in `completeNavigation`, which runs after loaders resolve ([router.ts L1270-L1312](https://github.com/remix-run/react-router/blob/e4ba5224c911e070b1eabd12cff2aa581270dfb3/packages/router/router.ts#L1270-L1312)). `RouterProvider` then calls `startViewTransition` with the state update and waits for the render ([index.tsx L620-L633](https://github.com/remix-run/react-router/blob/e4ba5224c911e070b1eabd12cff2aa581270dfb3/packages/react-router-dom/index.tsx#L620-L633)). The old page stays as is while loaders run.
- Chrome: during the update callback "the page is frozen, so delays here should be kept to a minimum", and "network fetches should be done before calling `.startViewTransition()`" ([Chrome same-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)). Same-document transitions ship in Chrome 111+.
- Net effect: no change to data latency; time to final paint grows by the animation length. Perceived speed may improve only if the animation hides a short wait **(inference)**.

## 7. React Router 7 and Single Fetch

- Prefetch works the same way: same 100 ms intent timer and 0.5 viewport threshold ([RR7 components.tsx L105-L160](https://github.com/remix-run/react-router/blob/1b1e0b0e79b21692ce907933475233babdd16e3e/packages/react-router/lib/dom/ssr/components.tsx#L105-L160)). It renders one `<link rel="prefetch" as="fetch">` for a `.data` URL ([L579](https://github.com/remix-run/react-router/blob/1b1e0b0e79b21692ce907933475233babdd16e3e/packages/react-router/lib/dom/ssr/components.tsx#L579), [single-fetch.tsx L612-L649](https://github.com/remix-run/react-router/blob/1b1e0b0e79b21692ce907933475233babdd16e3e/packages/react-router/lib/dom/ssr/single-fetch.tsx#L612-L649)). The click again calls plain `fetch()` ([L666](https://github.com/remix-run/react-router/blob/1b1e0b0e79b21692ce907933475233babdd16e3e/packages/react-router/lib/dom/ssr/single-fetch.tsx#L666)), so reuse still depends on the HTTP cache.
- Single Fetch makes one request per navigation, encoded with turbo-stream. The route `headers` export applies to data requests too, and "your `headers` function needs to return the proper headers/caching behavior for all routes" ([single-fetch.md, Headers](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/single-fetch.md#headers)).
- Default revalidation flips to opt-out: reused ancestor loaders re-run on every GET navigation. A `shouldRevalidate` or `clientLoader` on any active route adds a `_routes` param that lists the loaders to run, which fragments the cache key ([single-fetch.md, Revalidations](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/single-fetch.md#revalidations)). Routes with `clientLoader` or an opting-out `shouldRevalidate` are excluded from the prefetched `.data` URL ([components.tsx L473-L519](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/components.tsx#L473-L519)).
- Migration from Remix 2: adopt all v2 future flags first (`v3_fetcherPersist`, `v3_relativeSplatPath`, `v3_throwAbortReason`, `v3_lazyRouteDiscovery`, `v3_singleFetch`, `v3_routeConfig`); then the upgrade "mainly involves updating dependencies", with a community codemod for most steps ([RR7 upgrading/remix.md](https://github.com/remix-run/react-router/blob/1b1e0b0e79b21692ce907933475233babdd16e3e/docs/upgrading/remix.md), [Remix future flags](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/start/future-flags.md)). `json` and `defer` are deprecated in favor of naked object returns ([future-flags.md, Deprecations](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/start/future-flags.md#deprecations)). The cost for GoodWatch is mostly `v3_singleFetch` (headers, serialization, revalidation default) and `v3_routeConfig` **(inference)**.

## 8. Pending UI (official guidance)

From [Pending and Optimistic UI](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/discussion/pending-ui.md):

- Page navigation: show a busy indicator from `useNavigation()` when `navigation.state === "loading"`. `<NavLink>` exposes `isPending` for the clicked link.
- Optimistic UI when the next state is predictable and the URL does not change. Busy indicators when the URL changes.
- Skeletons via `defer` + `<Suspense>` + `<Await>`: "This allows the UI to render without waiting for the data to load". Keep critical, SEO-relevant data out of the deferred part. Match skeleton size to avoid layout shift.
- "Using `<Link prefetch="intent">` can often skip the fallbacks completely."
- Streaming: start deferred promises before awaiting anything else, or you lose the benefit ([streaming.md, Avoid Inefficient Streaming](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/streaming.md#avoid-inefficient-streaming)). In Remix 2 without Single Fetch, deferred data uses a `text/remix-deferred` stream on `_data` requests ([server.ts L373-L387](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-server-runtime/server.ts#L373-L387), [routes.tsx L593-L595](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/packages/remix-react/routes.tsx#L595-L597)), so a client navigation commits once the non-deferred keys arrive **(inference from code)**.

## 9. Other first-party guidance

- Remix [Cache-Control guide](https://github.com/remix-run/remix/blob/39203495c6a18f5421d022697906fb2cb9d1d3b8/docs/guides/cache-control.md): loader cache headers make client transitions and back/forward reuse data; "A lot of React apps rely on a JavaScript cache, but browser caches already work great!"
- Ryan Florence, ["Remixing React Router"](https://remix.run/blog/remixing-react-router) (2022-03-23): fetch at route boundaries in parallel instead of in components, and show pending state at once on click.
- I found no official "instant navigation" guide beyond these. **(unverified: absence)**

## Implications for GoodWatch

All of this section is **inference**, ranked by expected impact.

1. **Make anonymous `_data` responses briefly cacheable in the browser.** Today `private, max-age=0` (or `s-maxage` only) means every Chrome 133+ and Firefox prefetch is thrown away and the click fetches again. Adding `max-age` of 30 to 60 seconds (or `stale-while-revalidate`) to anonymous data responses via `handleDataRequest` turns hover prefetch into a real head start. Keep `Vary` to request headers that match between prefetch and `fetch()`, never `Sec-Purpose`.
2. **Decide member data policy separately.** Member responses are `no-store`, so prefetch for members is pure waste today and doubles server load per hover. Options: `private, max-age=10` on read-only member loaders (prefetch then reuses; brief staleness after a write unless a write also busts the URL), or keep `no-store` and drop `prefetch="intent"` on member-heavy links. The first gives speed, the second saves load.
3. **Commit the shell before slow data.** Use `defer` for slow, non-critical loader parts, so the navigation commits as soon as the fast keys arrive. Pair it with a global `useNavigation` progress bar so every click gets feedback within one frame.
4. **Keep module prefetch, consider `viewport` on mobile.** Module and CSS prefetches are reused (hashed, long-cached) and iOS supports `modulepreload`. `intent` barely fires before a tap. `viewport` on key lists gets JS ready on phones, but data prefetch on iOS still does nothing.
5. **`clientLoader` cache for hot routes.** An in-memory cache (or the existing TanStack Query client) makes repeat visits and back navigations instant. It opts the route out of Remix data prefetch, so warm it yourself on hover.
6. **Single Fetch / React Router 7.** One request per click and route `headers` on data responses, but no different prefetch reuse rules. Worth it for other reasons, not as the first speed lever.
7. **Low or no impact.** Speculation Rules (client navigations are not covered). View Transitions (they add time after loaders). bfcache (only for leaving and returning to the site; already allowed for `no-store` documents in Chrome, but a `no-store` fetch evicts them).

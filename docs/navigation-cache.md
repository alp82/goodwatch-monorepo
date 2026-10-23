# Navigation cache

The browser keeps the loader data of catalog pages, and the site prefetches that data before a click, so a page change can show the next page without waiting for the server. This is ticket 2 of [#753](https://github.com/alp82/goodwatch-monorepo/issues/753). The measurements that led to it are in [navigation-speed.md](benchmarks/navigation-speed.md).

Code: `goodwatch-webapp/app/navigation/`.

## The first load stays complete

- No route sets `clientLoader.hydrate` or exports `HydrateFallback`, and no document request uses `defer`. A `clientLoader` without `hydrate` doesn't run on hydration, so every document, for crawlers and browsers alike, is rendered on the server from the server loader, as before.
- The document HTML is unchanged apart from build file hashes. Checked on a local build against its base for 15 URLs as a browser and as Googlebot (see [Verification](#verification)).
- `cached-routes.test.ts` fails if any route file mentions `clientLoader.hydrate` or `HydrateFallback`.

## Which routes

Only catalog pages, listed in `cached-routes.ts`: title pages, person pages, the type and category listings, the best lists, Discover, `/people`, `/hot-on-socials`, and the blog. Each exports one line:

```ts
export const clientLoader = cachedClientLoader("routes/movie.$movieKey")
```

Pages that show a member's own data (library, taste, settings, watch next, wishlist, lists, profiles, auth) aren't cached. Pure redirect routes (`tv.$showKey`, `tv-shows.*`, `explore.*`) have nothing to keep.

## Cache rules

An entry is the loader data of one route at one URL (path and query, without `_data`), for one identity. The identity is the signed-in member's id or "visitor", plus the country and language from the root loader's data. At most 100 entries, least recently used first out.

| Navigation | Uses |
| --- | --- |
| Forward (a link, `navigate()`) | An entry up to 60 seconds old, or a prefetch of the same URL that is still loading. Otherwise it loads from the server and keeps the answer. |
| History (Back, Forward) | An entry up to 10 minutes old, at once. An entry older than 60 seconds is refreshed in the background, so the next visit gets newer data. The page on screen doesn't change. |
| Revalidation (after an action or fetcher submission, `useRevalidator`, the root's rerun after sign-in or sign-out) | Never the cache. The answer is kept. |

- Only plain `200` JSON from the Remix server is kept. A redirect, an error, a thrown response, deferred data, or an answer from something in between (a proxy error page) goes to Remix's own `serverLoader`, as without the cache.
- An incomplete page (a loader answered with `no-store` because a data source ran out of time or failed) carries `X-Incomplete-Page: 1` on its data response (`handleDataRequest` in `entry.server.tsx`). A navigation shows it, but the cache doesn't keep it. A prefetch's incomplete answer waits only for the one forward navigation it was loaded for, and Back and Forward never use it.

## Clearing

Everything is dropped, and loads under way don't store their answers, when:

- the identity changes: sign-in, sign-out, another country or language in the root's data;
- a form or fetcher submission that isn't a GET runs;
- a TanStack Query mutation settles (scores, wishlist, Seen, lists, settings, the watch log; `MutationCache` in `root.tsx`);
- a non-GET request to a member write path settles (`WRITE_PATHS` in `loader-cache.ts`: `/api/update-*`, imports, media preferences, settings, tracking, the watch log, auth, profile). This covers writes that call `fetch` directly;
- the auth provider is about to rerun the root after a sign-in or sign-out;
- the tab comes back after more than 5 seconds hidden (`useInvalidateOnVisibility`).

## Prefetch

Remix doesn't prefetch data for routes with a `clientLoader`, so the site does it, for every internal `a[href]` (also the related map, the search palette, breadcrumbs, and plain anchors), through listeners on the document (`link-intent.ts`):

- Mouse: a hover that rests 60 ms. Leaving the link first cancels it.
- Keyboard: focus.
- Press: `pointerdown` of a mouse, touch, or pen starts at once. On a phone this is the first sign of a tap.
- Phones (`(hover: none)`): when scrolling stops for 300 ms, and once after load, the four title and person links fully on screen nearest its center.

The prefetch resolves the URL with the router's routes, and fetches `?_data=<route id>` for each cached route the navigation would load, as Remix decides it (a route that stays loads again only when the query changes and its `shouldRevalidate` agrees). Press, hover, and focus also add `modulepreload` links for the route's code.

Limits (`prefetch-queue.ts`): at most 2 prefetches at a time and 40 a minute. Hover and focus wait in front of viewport prefetches. A press skips both limits, because its click asks for the same data anyway. Nothing is prefetched while the tab is hidden, and only presses are prefetched with Data Saver or on a 2G connection.

When a title page's data arrives through a press, hover, or focus prefetch, its hero backdrop starts loading with the hero's own `srcset` and `sizes` (`hero-backdrop.ts`), so the browser picks the same file the hero will.

After `load`, at least 2 seconds later and in an idle moment, the code of the main page types (title, person, listings, best lists, Discover) is preloaded once.

`window.__gwNavCache` counts prefetches, navigations answered per trigger, and misses.

## Verification

See the report of ticket 2 in [navigation-speed.md](benchmarks/navigation-speed.md#changes).

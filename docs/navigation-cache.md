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
| History (Back, Forward) | An entry up to 10 minutes old, at once. An entry older than 60 seconds is refreshed in the background, so the next visit gets newer data. The page on screen doesn't change. The first page's own data serves Back for 60 seconds only, because nothing tells whether it was complete. |
| Revalidation (after an action or fetcher submission, `useRevalidator`, the root's rerun after sign-in or sign-out, also one started while a navigation waits) | Never the cache. The answer is kept. |

- Only the newest load of a URL stores its answer. A background refresh that ends after a revalidation of the same URL doesn't overwrite it.

- Only plain `200` JSON from the Remix server is kept. A redirect, an error, a thrown response, deferred data, or an answer from something in between (a proxy error page) goes to Remix's own `serverLoader`, as without the cache.
- An incomplete page (a loader answered with `no-store` because a data source ran out of time or failed) carries `X-Incomplete-Page: 1` on its data response (`handleDataRequest` in `entry.server.tsx`). A navigation shows it, but the cache doesn't keep it. A prefetch's incomplete answer waits only for the one forward navigation it was loaded for, also when that navigation joined the prefetch while it was loading, and Back and Forward never use it.

## Clearing

Everything is dropped, and so are prefetches that wait for their turn. A load under way when the cache is cleared is obsolete: it doesn't store its answer, and a navigation that waited for it loads again with the identity of that moment, so it never shows data from before a write or of another person. This happens when:

- the identity changes: sign-in, sign-out, another country or language in the root's data;
- a form or fetcher submission that isn't a GET runs;
- a TanStack Query mutation settles (scores, wishlist, Seen, lists, settings, the watch log; `MutationCache` in `root.tsx`);
- a non-GET request to the site's `/api/` settles, unless it is a known read (`READ_ONLY_POSTS` in `loader-cache.ts`: searches, listings, the explorer, poster impressions, error reports). This covers writes that call `fetch` directly, and new write endpoints count without a change here;
- the tab comes back after more than 5 seconds hidden (`useInvalidateOnVisibility`).

### Sign-in, sign-out, and account switches

The cookie names the new person before the root's data does, so in between the cache would answer under the old identity. The cache is therefore held: cleared, and off (every navigation asks the server, no prefetch starts) until the root has new data from the server.

- The hold ends only with a fresh root answer (`releaseOnFreshRoot` in `loader-cache.ts`). An idle router is not enough: when the root's request fails twice, the retry wrapper keeps the old member's data, and a root that threw keeps its old data too. The hold then stays, and the next navigation asks for the root again. The cache comes back once the server has answered.
- Better Auth: from the moment a non-GET request to `/api/auth/` starts. After its answer, `refreshUser` (after sign-in, sign-out, a password change) reruns the root. When no revalidation starts within 3 seconds (a sign-up, a confirmation email), the cache reruns the root itself.
- Supabase: the auth client's change event clears the cache at once. The auth provider then holds it from the moment the member changed, through the media session check (up to 5 seconds), until its rerun of the root is done.

### Other tabs

All tabs share the session cookie, but each keeps its own cache. Better Auth doesn't tell other tabs, so the site does (`auth-sync.ts`). A note goes out on the BroadcastChannel `gw-auth-sync`, and is written to `localStorage` under the same key:

- when a non-GET request to `/api/auth/` is answered (the member is unknown then);
- when the Supabase client reports another member;
- when a tab's root names another member than before, and when a page loads as another member than the last note names (a sign-in that ended in a full page load, such as an OAuth callback).

A tab that hears a note holds its cache and reruns its root, unless the note names the member it already shows. The hold ends with the root's fresh answer, as above. Where BroadcastChannel is missing, the `localStorage` write reaches other tabs as a `storage` event. A tab that couldn't hear (hidden and throttled, or in the back/forward cache) compares the stored note with the last one it handled when it becomes visible again and on `pageshow` from the back/forward cache: one `localStorage` read. Storage that is blocked is skipped, and the channel still works.

## Prefetch

Remix doesn't prefetch data for routes with a `clientLoader`, so the site does it, for every internal `a[href]` (also the related map, the search palette, breadcrumbs, and plain anchors), through listeners on the document (`link-intent.ts`):

- Mouse: a hover that rests 60 ms. Leaving the link first cancels it.
- Keyboard: focus.
- Press: `pointerdown` of a mouse, touch, or pen starts at once. On a phone this is the first sign of a tap.
- Phones (`(hover: none)`): when scrolling stops for 300 ms, and once after load, the four title and person links fully on screen nearest its center.

The prefetch resolves the URL with the router's routes, and fetches `?_data=<route id>` for each cached route the navigation would load, as Remix decides it (a route that stays loads again only when the query changes and its `shouldRevalidate` agrees). Press, hover, and focus also add `modulepreload` links for the route's code.

Limits (`prefetch-queue.ts`): at most 2 prefetches at a time and 40 a minute, presses included: a swipe on a phone that starts on a poster presses the link without opening it. A press goes first, hover and focus wait in front of viewport prefetches. Only the navigation itself loads outside these limits. Nothing is prefetched while the tab is hidden, with Data Saver, or on a 2G connection. Waiting prefetches are dropped when the tab is hidden or the cache is cleared, and each checks again when its turn comes that the tab is visible and the identity is the same.

When a title page's data arrives through a press, hover, or focus prefetch, its hero backdrop starts loading with the hero's own `srcset` and `sizes` (`hero-backdrop.ts`), so the browser picks the same file the hero will.

After `load`, at least 2 seconds later and in an idle moment, the code of the main page types (title, person, listings, best lists, Discover) is preloaded once.

`window.__gwNavCache` counts prefetches, navigations answered per trigger, and misses.

## Verification

See the report of ticket 2 in [navigation-speed.md](benchmarks/navigation-speed.md#changes).

After the review fixes (holds, obsolete loads, press limits, the `/api/` default), the functional checks were run again on a local production build on the bench data: hover then click commits with no request after the click, a phone tap starts its prefetch on touch, Back to the listing commits from the cache, a POST to `/api/update-scores` makes the next Back load again, and during a POST to `/api/auth/sign-out` a hover starts no prefetch. Title pages on the bench data are incomplete (no TMDB key), so Back to them loads from the server, as the rules say. Sign-in itself isn't possible locally; the hold rules are covered by `loader-cache.test.ts`.

Other tabs (two tabs of one browser context, same build and data): after a note on the channel from tab 1, tab 2 requested its root and page data at once, and its next Back and Forward each loaded from the server (before the note: 0 requests). A real `POST /api/auth/sign-out` from tab 1 did the same, also with BroadcastChannel removed (storage event). A note naming the member tab 2 already showed changed nothing. A note written while tab 2 couldn't hear was handled on `visibilitychange`, and a `pageshow` with nothing new sent no request. The cross-tab rules are covered by `auth-sync.test.ts`.

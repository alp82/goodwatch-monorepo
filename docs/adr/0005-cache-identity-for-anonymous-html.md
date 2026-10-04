---
status: accepted
---

# Use one cache identity for anonymous HTML

A stored page belongs to a URL and a cache identity: the audience (anonymous or member), the country, and the
language. One module, `goodwatch-webapp/app/server/cache-identity.server.ts`, maps a request to that identity and
sets the response headers. The in-process page cache and a later cache in front of the app both use it. Decided on
October 4, 2026, as part of the map "Serve a viral traffic spike". The rule in full is in
[cache-identity.md](../cache-identity.md).

Anonymous HTML answered with `Vary: Cookie, Accept-Language`. Every visitor carries analytics cookies and the
`gw_browser` cookie, so a cache that honors `Vary` never had a hit. Error pages inherited the public policy of the
page, and two modules resolved the country with different fallbacks (`US` and `DE`).

## Choices

- **Audience, country, and language are the key.** The owner decided that cached pages are keyed by country and
  language, because titles and descriptions will be shown in the country's language later. A request with the auth
  cookie is a member, whatever the cookie's value, and never touches a shared cache.
- **The key travels in `GW-Cache-Identity`, not in `Vary: Cookie`.** The value is `anon;<COUNTRY>;<language>`. A front
  cache computes it and sends it with the request. The app renders for it and answers with `Vary: GW-Cache-Identity`.
  Plain `Vary` can't express "depends on whether one cookie exists" or a country from a geo lookup. A header that the
  cache sets can.
- **The app answers `private` when no cache named the key.** Without the header, the app can't know that a cache on
  the way tells members from anonymous visitors. `private, max-age=0` keeps every standards-following cache correct
  without `Vary: Cookie`. The in-process page cache doesn't need headers: it asks the module.
- **One country fallback, `US`.** Google crawls from the US without `Accept-Language`, and title pages already used
  it. Discover and the home page used `DE`.
- **Errors are never shared-cacheable, and there is no negative caching.** A missing title can appear with the next
  import. A short lifetime for not-found pages can be added when a cache exists and a measurement asks for it.
- **`max-age=0` for HTML.** A browser asks the server on every navigation, so it doesn't reuse an anonymous page
  after sign-in. Member pages are `no-store`.

## Consequences

- Until a front cache sends the header, no HTML response is shared-cacheable. The `cache_control` metric label has a
  new value `keyed` for anonymous pages that a cache with the key may store.
- A front cache must compute the key the way the module reads it, or choose its own country and language values:
  the app renders for any valid value. A cache that can't set a request header can't cache HTML.
- Visitors without a region in `Accept-Language` now get US streaming offers on Discover and the home page, where
  they got German ones.
- Back and Forward can show a browser's own anonymous copy after sign-in, until the client reloads the loader data.
  With `Vary: Cookie` the browser fetched the page again.
- A feature flag change needs a restart and a purge of any page cache.

# The related map

The related titles section of a title page (`/movie/...`, `/show/...`) is a map: the page's title in the middle, the
related titles on rings around it by similarity, trait chips that change who is on the map, and a walk from poster to
poster that never leaves the page. This page says where the code is, what a page view costs, how to turn it off, and
what happens when its data isn't there.

## What a visitor gets

- **Rings:** nearer means more alike. A phone shows 8 titles, a wide screen about 48, and the zoom shows more.
- **Chips:** up to six traits of the title in the middle, each filled to its level. A tap on a strong one shows titles
  without that trait, a tap on a weak one shows titles with it. Up to three can be on.
- **A step:** a tap on a poster moves that title into the middle. The map pans in place. The URL, the scroll
  position, and the section's height don't change. Posters are buttons, never links.
- **A look before a step:** pointing at a poster, or holding a finger on it, shows that title in the card and its
  levels on the chips. The hold lasts until the finger lifts.
- **One bar:** the trail of the walk as small posters with "Back", and the details of the title in the middle with
  "Open", which is a link to that title's page.

## Where the code is

| Part | File |
| --- | --- |
| The section (React) | `goodwatch-webapp/app/ui/related-map/RelatedMap.tsx` |
| The engine: packs, steps, pointers, retries | `app/ui/related-map/engine.ts` |
| The rings, the pan, the zoom | `app/ui/related-map/rings.ts` |
| The chips | `app/ui/related-map/level-chips.ts` |
| The trail, the card, and what chips and posters show of each other | `app/ui/related-map/trail.ts` |
| The traits, the filter grammar, and which chips a title has | `app/ui/related-map/traits.ts` |
| The style | `app/ui/related-map/styles.ts` |
| The setting, the packs, the section's markup | `app/server/related-map.server.ts` |
| How a pack is shaped | `app/server/related-map-pack.ts` |
| The endpoint | `app/routes/api.related-map.ts` |

## Three layers

1. **The server's HTML.** The engine draws the first picture on the server, for a phone. The markup also holds 64
   plain `<a href>` links to the most alike titles. They are out of sight and out of the tab order, for crawlers and
   screen readers.
2. **An inline script and an inline style**, after the section. Taps work before hydration, and the script lays the
   picture out for the real width before the first paint. The build bundles `inline.ts` into
   `build/server/related-map.inline.js` (see `vite.config.js`), and the server reads that file once. The development
   server has no such file and bundles it at its first title page.
3. **A lazy chunk** (`client.ts`) for a title page that is opened by a navigation inside the app: such a page has no
   inline script, so the section loads the engine and the style when it mounts.

Nothing in the section depends on the visitor: the HTML is the same for everyone, and the page cache stores it.

## Packs and requests

A pack is one title's neighborhood: the title and the titles around it, each with its name, year, poster, similarity,
and its levels on twenty traits as one character each. The browser keeps one pack per title and draws every step from
memory.

| What | Who asks | Requests to Qdrant when not cached | Cache name |
| --- | --- | --- | --- |
| The nearest 80 titles | The title page's loader, for the first picture | 2 | `related-map-nearest-v1` |
| The pack: the nearest titles plus the list of each chip (72 titles in all) | The browser, `/api/related-map?key=m603` | Up to 6 more | `related-map-pack-v1` |
| A further page of one filter | The browser, `/api/related-map?key=m603&f=tension%3E6&d=0` | 1 | `related-map-page-v1` |

- **Lifetime:** each is kept in Valkey for a day, like the related titles carousel's panels, and served stale for up
  to an hour while it is rebuilt. A changed shape gets a new name.
- **The endpoint** answers with the public data policy (`public, max-age=3600, ...`, see
  [cache-identity.md](../cache-identity.md#data-endpoints)): the answer is the same for every visitor.
- **A filter** is at most three tokens of the form `trait>6` or `trait<4`, one per trait. Any other filter is 404.

### Requests

- The page title's pack is asked for when the section comes within 600 px of the viewport, or on the first touch.
- Once a person uses the page (a pointer, a key, a touch, the wheel), the packs of the first 8 titles on the map are
  asked for on idle, again after every step. At most 80 packs per page visit are asked for ahead.
- The pack of a poster that is pressed or pointed at is asked for at once.
- A step onto a title without a pack shows that title at once, with what is known around the title before it or with
  empty places, and fills in when the pack arrives.
- A pack that failed is asked for again while someone stands on its title: after 1.2, 2.4, 3.6, and 4.8 seconds, then
  every 15 seconds, and when the browser comes back online.
- Posters come from the TMDB image host, one request per poster that wasn't shown before.

No rate limit of the app applies to these requests. The app has two: 60 poster impression posts per minute and
address, and the bound on error reports in flight. The map sends neither.

## When the data isn't there

| Case | The page shows | Stored by a cache |
| --- | --- | --- |
| The nearest titles came within the budget (150 ms, 1,000 ms for a declared crawler) | The map | Yes |
| They came late, or the lookup failed | The related titles carousel, which asks for its panel from the browser. The lookup keeps running, so the next render has the map | No (`private, no-store`) |
| The title has no fingerprint | No related section, as before | Yes |
| `REC_RELATED_MAP=off` | The related titles carousel with its first panel in the HTML | Yes |

The counter `goodwatch_related_map_total` counts these outcomes per media type: `map`, `none`, `budget`, `error`.

## How to turn it off

Set `REC_RELATED_MAP=off` in the webapp's environment and restart the containers. No build is needed. Title pages
then show the related titles carousel (`DetailsRelated`), and `/api/related-map` answers 404. Any other value, or no
value, means on. A restart also empties the page cache, so no stored page keeps the map.

## Page weight

Measured on October 10, 2026 on `/movie/603-the-matrix`, as the page cache stores it (Brotli, quality 5):

| | Map off | Map on |
| --- | --- | --- |
| HTML, uncompressed | 377,782 bytes | 351,621 bytes |
| HTML, compressed | 48,401 bytes | 71,279 bytes |

Of the 22,900 compressed bytes the map adds, the inline script is 15,700, the inline style 5,200, and the section's
markup 6,200 (it is in the document twice: as markup and in the loader's data). The carousel's markup and panel data,
about 4,200 bytes, are gone. The render path budget for the title pages (`html_bytes` in
`goodwatch-benchmark/urls/budget.json`) is 55,808 bytes for the movie page, below the new size. The limit wasn't
raised with this change, and `./bench.sh budget` wasn't run against it.

## Accessibility

- Posters, chips, the zoom, "Back", and the trail are buttons with names. "Open" is a link.
- Focus is visible on each of them. A focused poster shows in the card like a pointed-at one.
- The list of earlier steps is a `<details>`: Enter opens it, Escape closes it.
- With `prefers-reduced-motion`, a step changes the picture without the pan and the fades.

## Checks

- Unit tests: `app/ui/related-map/*.test.ts` and `app/server/related-map-pack.test.ts`.
- The tap test has the control `related_step` (see `goodwatch-benchmark/README.md`).

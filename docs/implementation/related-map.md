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
| The style | `app/ui/related-map/related-map.css` |
| The script's entry | `app/ui/related-map/inline.ts` |
| The setting, the packs, the section's markup | `app/server/related-map.server.ts` |
| How a pack is shaped | `app/server/related-map-pack.ts` |
| The endpoint | `app/routes/api.related-map.ts` |

## What a title page carries

1. **The server's HTML.** The engine draws the first picture on the server, for a phone. The markup also holds 64
   plain `<a href>` links to the most alike titles. They are out of sight and out of the tab order, for crawlers and
   screen readers. The markup is in the document once: a document's loader data doesn't repeat it, and the browser
   keeps what the document holds. The data of a navigation inside the app carries it.
2. **Two files of the build**, with a content hash in their names, `immutable` for a year, and on the same host as
   the page's other files (`assetUrl`, see [static-assets.md](../static-assets.md)):
   - **The engine,** `/assets/related-map-<hash>.js`: `inline.ts` bundled into one classic script by the build
     (`vite.config.js`). The page names it in a `<script async>` after the section, so it neither blocks the paint nor
     waits for hydration.
   - **The style,** `/assets/related-map-<hash>.css`: a few lines of inline script after the section add its link
     while the document is parsed. A link that a script adds doesn't block the paint.
3. **No flash and no shift.** The section has its height from the app's stylesheet (602 px, and 576 px from 1,024 px
   up) and hides its content until the map's style is there. The style's first rule shows it.
4. **A tap before the engine.** The inline script remembers the last tap on a poster or a chip, and the engine does
   it when it arrives. Until then nothing changes on the page.

A page that is opened by a navigation inside the app asks for both files when the section mounts, once per document.

Nothing in the section depends on the visitor: the HTML is the same for everyone, and the page cache stores it.

**After a deploy.** A stored or open page of the old build names the old files. They keep resolving: every process
writes its build's hashed files to the shared store, where they stay for a day after its last process has gone
(see [webapp-deploys.md](../webapp-deploys.md)). If the script fails to load anyway, the section loads the engine as
a lazy chunk of the app. If the style fails on the static hostname, the section asks the site's own host. Without
any style the section stays an empty box of its height.

**The development server** has no built script: there the section starts the engine from a lazy chunk after
hydration.

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

Measured on October 10, 2026 on a production build, as the page cache stores a page (Brotli, quality 5) and as the
build compresses a file (Brotli, quality 11):

| | Map off | Map on | Budget (`html_bytes`) |
| --- | --- | --- | --- |
| `/movie/603-the-matrix`, HTML compressed | 48,401 bytes | 47,452 bytes | 55,808 |
| `/show/1396-breaking-bad`, HTML compressed | 51,182 bytes | 49,902 bytes | 58,880 |

| File | Uncompressed | Compressed |
| --- | --- | --- |
| The engine | 41,570 bytes | 15,197 bytes |
| The style | 21,002 bytes | 4,619 bytes |

A title page with the map sends two more requests to the site or the static host than one without it: one script and
one style sheet. In the render path budget (`goodwatch-benchmark/urls/budget.json`) they count against
`host_requests`, `script_count`, `script_bytes`, and `total_bytes`. `./bench.sh budget` wasn't run against this
change.

## Accessibility

- Posters, chips, the zoom, "Back", and the trail are buttons with names. "Open" is a link.
- Focus is visible on each of them. A focused poster shows in the card like a pointed-at one.
- The list of earlier steps is a `<details>`: Enter opens it, Escape closes it.
- With `prefers-reduced-motion`, a step changes the picture without the pan and the fades.

## Checks

- Unit tests: `app/ui/related-map/*.test.ts` and `app/server/related-map-pack.test.ts`.
- The tap test has the control `related_step` (see `goodwatch-benchmark/README.md`).

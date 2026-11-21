# Explore lab (rounds 1 to 12)

The prototype behind the rethought `/movies`, `/shows`, and `/all` pages. Its last round became the real Browse
pages in November 2026. The production code lives under `goodwatch-webapp/app/{domain,server,ui}/browse/`, and the
spec that ported it is [`docs/implementation/explore-rethink/spec.md`](../../implementation/explore-rethink/spec.md).

The lab ran on the local branch `prototype/explore-r12` at `/prototype/explore/lab/movies`. That branch never went to
main. A reference copy of its source is in [`source/`](source/) (see [The source copy](#the-source-copy)).

## The question

`/movies` and `/shows` were the oldest pages on the site, from before the redesign. Three mood vocabularies were live
at once, streaming pages depended on the viewer's country at a fixed address, Best sat inside `/movies` and also as
its own Explore tab, and Discover canonicalized every facet away, so no facet page was indexable.

The owner asked for a rethink of both pages and every subpage: their value, how they fit with the other Explore pages
(Discover, New, Best, Map, Hot, Awards, People), structure, navigation, and UX. It had to be great for discovery and
for search engines.

## Rounds and verdicts

### Rounds 1 to 3: vocabulary and navigation paths

- **Round 1** ran two prototypes. Mood vocabulary: the owner kept the existing 16 moods, because the new candidates
  (nostalgic, atmospheric) gave inaccurate results. Navigation: variant A's address tree (`/movies/moods/cozy`,
  `/movies/moods/cozy/comedy`, extra parts as `?with=`) won, with D's hub as the first nav item. Walls of categories
  and several clicks before any title were rejected.
- **Round 2** tried five layouts on A's addresses (poster rails, grid with chips, a sentence builder, a side rail,
  editorial doors). Verdict: every page type looked alike. The owner wanted character, distinct page types, and
  visuals with meaning.
- **Round 3** ran five parallel paths (signatures, spatial instruments, a video store and a cinema programme, an
  editorial magazine, interaction tokens). Verdict: "tons of flaws", but the magazine direction was the best:
  colored attribute words, the kinds inside a genre as navigation, what made a decade special, and Best with source
  scores. This round set the quality bar used from then on: every builder reviews its own screenshots at 1440 and
  390 before reporting.

### Round 4: one route, four concepts

A complete reimagination on one route, `/prototype/explore/<concept>/...`, with four concepts behind one switcher:
Rooms, Dials, Blend, and Guide. It was the first clearly positive round. The owner loved:

- the Rooms subnav row (Movies | Shows on the left, the family tabs on the right),
- the Dials tune panel, its jump to a neighboring mood, and the "Keep going" highlight at a dial's end,
- the mood lattice ("where Thrilling sits among the moods"),
- the Rooms hub, mood page, era page, and country page (zoomed map and curated copy), and the Dials Best page.

Open problems: movies and shows together, place cards with posters as the main element, the mood page's grid too far
down, and the genres and eras index pages, which each needed something unique.

### Round 5: the lab

The owner asked for "a lab of some sort where we can adjust multiple parts separately". Every part of a page became a
slot with variants, chosen in a floating panel (see [The lab contract](#the-lab-contract)). Kind `all` and the
`/all/...` addresses were added for movies and shows together, with a non-checkbox control ("Movies & Shows").

### Rounds 6 to 9: settling each page

Each round the owner went page by page, the losing variants were removed, and new variants were built only where he
was unsure.

- **Round 6:** lattice, Grid first, Scrub, Year dial, Dials on the map, and Rooms streaming picked. Rebuilt: the hub
  ("miniatures of each subpage"), the genres index, and Trait, which became Tropes, designed from scratch.
- **Round 7:** Miniatures hub "great". Settled rules: an unused dial must not look set (raised "numerous times"),
  countries always show their flag-filled shape, blends land on the grid view, no slop text, and Best moved into the
  main Explore nav between Hot and Awards.
- **Round 8:** places and country pages "great", Best "super". Flags at rest became hinted instead of full intensity,
  the genre shelf moved from books to cinema references, and a site-wide motion bug was found: the shared transition
  classes never animated Tailwind 4's separate `translate`, `rotate`, and `scale` properties.
- **Round 9:** Faint still + type mood cards "great", the Directory streaming page liked, dials rest between their
  named stops, the About this selection header, and Discover's compact counts everywhere.

### Rounds 10 to 12: polish

Fixed widths and heights wherever something shifted, the Top switcher on the hub, eased map zoom, one-motion
re-sorts, a dial that settles exactly on the previewed stop, and Telegram-like spoilers that keep the text's space and
can be hidden again. After round 11 the owner wrote: "everything else is great now. we are ready to implement and ship
it."

## What shipped

The owner's decisions on November 22, 2026: one release, only the lab defaults, every old Explore and category address
redirects permanently to its new address, Mixer and the theme and style pages stay out, and Best is renamed Top.

| Page                         | Shipped design                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hub (`/movies`)              | Miniatures: a live small version of each family page, a Top switcher, a zoomable flag map, nights      |
| Moods                        | The lattice with Faint still + type cards and a fit strip that follows the dials                        |
| Mood, genre, and every blend | Grid first with steer rows, About this selection, a blend title with swap, remove, and Add, Prev / Next |
| Genres                       | List beside (chip row on phones), the opened genre, and "Beyond the obvious" picks                      |
| Eras and an era              | Scrub (a decade ribbon you drag) and the Year dial page                                                 |
| Places and a country         | Dials on the map with every country and region chips; Next door plus Where to go from here              |
| Streaming and a service      | Directory with a country picker, sorts (Most popular first), new and gone this month                   |
| Tropes and a trope           | Trope cards with In the spotlight; Casebook with spoilers that keep their space                         |
| Top                          | Poster ranking with dial pills; the all-time list leaves out this year's and last year's titles         |

## Screenshots

The production port, taken from the build branch before release (the hub's Top tile still read "Best" then):

![The Browse hub for movies: the mood lattice tile, the decade ribbon, and the Top tile](shots/hub-desktop.webp)
![The Browse hub on a phone](shots/hub-phone.webp)
![The moods index: the lattice of 16 mood cards under three dials](shots/moods-desktop.webp)
![The Cozy mood page: steer rows beside a grid that fills one screen](shots/mood-cozy-desktop.webp)
![The Cozy mood page with a dial set](shots/mood-dial-set-desktop.webp)
![A four-part blend: cozy Korean comedies with a butt-monkey](shots/blend-four-parts-desktop.webp)
![The four-part blend on a phone](shots/blend-four-parts-phone.webp)
![The genres index: a genre list beside the opened genre](shots/genres-desktop.webp)
![The genres index on a phone, with the chip row](shots/genres-phone.webp)
![The eras index: a ribbon of decades to drag](shots/eras-desktop.webp)
![The 1990s page with the year dial](shots/era-1990s-desktop.webp)
![The places index: the world map with its dials](shots/places-desktop.webp)
![The Japan page with its zoomed map and Next door band](shots/country-japan-desktop.webp)
![The streaming directory for the United States](shots/streaming-us-desktop.webp)
![The Netflix page for the United States](shots/service-netflix-desktop.webp)
![The tropes index with In the spotlight and trope cards](shots/tropes-desktop.webp)
![The Final Girl trope page with Casebook examples](shots/trope-final-girl-desktop.webp)
![The Final Girl trope page on a phone](shots/trope-final-girl-phone.webp)
![The Top movies page: three leads and a ranked poster grid](shots/top-movies-desktop.webp)

Earlier rounds, for contrast (the fuchsia panel is the lab panel):

![Round 5: the Front page hub](shots/r5-hub-front-page-desktop.webp)
![Round 6: the first Miniatures hub](shots/r6-hub-miniatures-desktop.webp)
![Round 8: the Video store genres index, rejected as too artsy](shots/r8-genres-video-store-desktop.webp)
![Round 8: Swatch mood cards, replaced by Faint still + type](shots/r8-moods-swatch-desktop.webp)

## The lab contract

One route served everything: `/prototype/explore/<concept>/<address>`, with the concept `lab`. The Rooms row carried
navigation. Every other part of a page was a **slot** with **variants**, and the floating lab panel picked them.

- **Picks** lived in the cookie `gw-lab` (`slot:variant,slot:variant`), so the server rendered them and they survived
  navigation. `?lab=slot:variant,...` overrode them for one request. **Copy picks** put every pick on the clipboard.
- **Page slots** rendered a whole page body: `hub`, `moods`, `mood`, `genres`, `genre`, `eras`, `era`, `places`,
  `country`, `streaming`, `service`, `best`, `blend`, `other`, `tropes`, and `trope`. Exactly one applied to an
  address.
- **Part slots** cut across pages: the kind control, cards, the blend entry, and sub-slots of a page, such as the mood
  page's steering or the trope page's body, spoilers, and sections below.
- Files were found by name, so builders worked in parallel without touching shared files:

  ```
  concepts/lab/slots/<slot>/slot.ts               export const slot: SlotMeta
  concepts/lab/slots/<slot>/<variant>.tsx         export const variant: SlotVariant<Data>
  concepts/lab/slots/<slot>/<variant>.server.ts   export const load: SlotLoader<Data>
  ```

- Each slot had a `fallback`, the recommended variant, which was what the owner saw first. **Recommended** reset every
  slot to its fallback, and **All round 4** set every slot to its round 4 baseline for comparison.

The full contract, with examples, is in [`source/README.md`](source/README.md).

## The source copy

`source/` is a copy of `goodwatch-webapp/app/prototype/explore` from branch `prototype/explore-r12`, kept as a
reference. It isn't built, imported, type-checked, linted, or tested: the webapp's TypeScript, Vite, test, and
`scripts/code-quality.mjs` globs cover only `goodwatch-webapp/`, and `docs/` sits outside all of them. Its imports
point at webapp modules as they were on that branch, so it doesn't run from here.

To run the lab again, check out `prototype/explore-r12` (local to the machine it was built on), start the webapp
through the read-only preview harness, and open `/prototype/explore/lab/movies`. The screenshot tool is
`source/scripts/shoot.mjs`; run it from `goodwatch-webapp/`. Paths under `~/.cache/gw-explore-r4/` in the copied
README refer to the builders' briefs on that machine and aren't part of the repository.

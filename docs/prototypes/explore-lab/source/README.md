# Explore prototype, round 5: the lab and how to add a variant

PROTOTYPE - throwaway (branch `prototype/explore-r5`, never merge). Read `~/.cache/gw-explore-r4/BRIEF-R5.md` first (the owner's round 4 verdict and this round's rules), then `BRIEF.md` (the flaw list).

One route serves everything: `/prototype/explore/<concept>/<address>`. The concept the owner opens is **`lab`**: `/prototype/explore/lab/movies`. Its structure is settled (the rooms row carries navigation). Everything else is a **slot** with **variants**, picked separately in the floating lab panel. The round 4 concepts (`rooms`, `dials`, `blend`, `guide`) still run under their own ids, for comparison; don't change how they look. `/prototype/explore/_kit` shows every shared part on real data.

## Slots

A slot is a folder. Files are found by name, so **you only write inside your own slot folders** and never edit a shared file:

```
concepts/lab/slots/<slot>/slot.ts               export const slot: SlotMeta
concepts/lab/slots/<slot>/<variant>.tsx         export const variant: SlotVariant<Data>
concepts/lab/slots/<slot>/<variant>.server.ts   export const load: SlotLoader<Data>     (optional)
```

Other files in the folder are yours (helpers, pieces); a `.tsx` without `export const variant` and a `.server.ts` without `export const load` are ignored. Types: `concepts/lab/contract.ts`. After you **add** a variant file, run `touch app/prototype/explore/concepts/lab/registry.ts app/prototype/explore/concepts/lab/registry.server.ts` if the panel doesn't list it (the dev server's file list can lag).

Two kinds of slot:

- **Page slots** (`group: "page"`). Exactly one renders an address; its picked variant's `View` is the whole page body under the rooms row. They exist already, each with the round 4 pick as variant `r4`:

  | Slot        | Renders                                                              | `r4` comes from           |
  | ----------- | -------------------------------------------------------------------- | ------------------------- |
  | `hub`       | `/movies`                                                            | Rooms                     |
  | `moods`     | `/movies/moods`                                                      | Dials                     |
  | `mood`      | `/movies/moods/cozy`                                                 | Rooms                     |
  | `genres`    | `/movies/genres`                                                     | Rooms                     |
  | `genre`     | `/movies/genres/comedy`                                              | Rooms                     |
  | `eras`      | `/movies/decades`                                                    | Rooms                     |
  | `era`       | `/movies/decades/1990s`                                              | Rooms                     |
  | `places`    | `/movies/countries`                                                  | Dials (`r4-rooms`: Rooms) |
  | `country`   | `/movies/countries/japan`                                            | Rooms                     |
  | `streaming` | `/movies/streaming/us`                                               | Rooms                     |
  | `service`   | `/movies/streaming/us/netflix`                                       | Rooms                     |
  | `best`      | `/movies/best`, with or without `?with=` and `year=`                 | Dials                     |
  | `blend`     | any place with two or more ingredients (`/movies/moods/cozy/comedy`) | Rooms (`r4-blend`: Blend) |
  | `other`     | themes, styles, traits: their index pages and their places           | Rooms, Dials for traits   |

  The same for `/shows/...` and `/all/...`. The mapping is `pageSlotOf(address)` in `concepts/lab/pages.ts`.

- **Part slots** (`group: "part"`). A piece that cuts across pages. Two exist: `kind` (the Movies | Shows | both control in the rooms row) and `card` (a place as a card). A page builder adds its own **sub-slots** the same way (see "Add a sub-slot").

### Add a page variant

```tsx
// concepts/lab/slots/genres/shelves.server.ts
import type { SlotLoader } from "../../contract"
import { cardData } from "../../cards.server"
import type { CardData } from "../../../../kit/types"

export interface ShelvesData {
	genres: CardData[]
}

export const load: SlotLoader<ShelvesData> = async ({ kit, address, url, request, lab }) => ({
	genres: await cardData(kit, "genre", { n: 12, titles: 5 }),
})
```

```tsx
// concepts/lab/slots/genres/shelves.tsx
import { ing, place } from "../../../../kit/address"
import { PlaceLede, WRAP } from "../../../../kit/ui"
import type { PageViewProps, SlotVariant } from "../../contract"
import { Part } from "../../lab"
import type { ShelvesData } from "./shelves.server"

function View({ data, address, to }: PageViewProps<ShelvesData>) {
	const kind = address.kind
	return (
		<>
			<PlaceLede kicker="Movies" title="Movies by genre" />
			<div className={`${WRAP} grid gap-4 lg:grid-cols-3`}>
				{data.genres.map((g) => {
					const at = place(kind, [ing("genre", g.place.slug)])
					return (
						<Part
							key={g.place.slug}
							slot="card"
							{...g}
							href={to(at)}
							kindHref={(id: string) => `${to({ ...at, kind_: id })}#all`}
						/>
					)
				})}
			</div>
		</>
	)
}

export const variant: SlotVariant<ShelvesData> = {
	id: "shelves", // the file's name
	name: "Shelves", // the panel's pill: what it tries, in two or three words. Never "A/B/C".
	what: "Every genre as a shelf you can pull out: its kinds are the dividers.", // one line for the panel
	order: 1, // among the slot's variants (r4 is always first)
	View,
	notes: (props) => [{ term: "Divider", means: "A kind of the genre; a link.", isNew: true }],
}
```

`PageViewProps<Data>` is the concept page props (`concept`, `address`, `data`, `viewer`, `to(address, extra?)`) plus `lab` (`lab.pick("card")`). The rooms row and the site chrome are already drawn above your `View`. Build every link with `to(...)` so it stays inside the lab. `kit.kind` and `address.kind` are `"movie" | "show" | "all"`: use `kindLabel(kind)`, `kindNoun(kind)`, `kindOne(kind)` for words, never `kind === "show" ? ... : ...`.

To reuse a round 4 page inside a variant, import from `concepts/lab/baselines.tsx` (`RoomsView`, `DialsView`, `BlendView`) and `baselines.server.ts` (`roomsLoad`, `dialsLoad`, `blendLoad`), or import the pieces from `concepts/{rooms,dials,blend}/...` directly (export what you need there; don't change how they look).

### Add a part variant

A part's `View` gets the props the slot documents in its `slot.ts`, plus `data` when the variant has a loader.

```tsx
// concepts/lab/slots/card/identity.tsx
import { Link } from "@remix-run/react"
import type { CardProps } from "../../../../kit/types"
import type { SlotVariant } from "../../contract"

function View({
	place,
	href,
	copy,
	titles,
	traits,
	kinds,
	kindHref,
	rose,
	goodAt,
	weight,
	size = "m",
}: CardProps) {
	return <Link to={href}>...</Link>
}

export const variant: SlotVariant<never, CardProps> = {
	id: "identity",
	name: "Identity first",
	what: "The place's own mark fills the card; posters are a footnote.",
	View,
}
```

- **`card`** props are `CardProps` (`kit/types.ts`): `place` (`PlaceRef`: family, slug, label, `hue` for moods/themes/styles, `code` for countries, `logo` for services), `href`, `copy: { short, lede } | null`, `titles` (up to four, poster and name only), `traits` (`TraitWord[]`, up to three), and per family `kinds` + `kindHref(id)` (genres), `rose` (decades), `goodAt` (services), `weight` (countries, 0-1), `size: "s" | "m" | "l"`. A variant reads what its design needs. `<CountryShape code size />` (`kit/world-map/CountryShape.tsx`) draws one country's outline in the text color. Every `PlaceCard` of the kit and the Rooms genre panel, era card and service card hand over to the picked `card` variant, so **a card pick changes the round 4 baseline pages too** (hub, moods, streaming, themes). Inside a card variant use `PlaceCardPlain`, never `PlaceCard` (it would call you again).
- **`kind`** props are `KindProps` (`slots/kind/slot.ts`): `address`, `to`, and `kinds: { kind, label, href, on }[]` for movie, show and all. It renders twice: in the sticky rooms row (44 px tall, from `lg`) and in the phone's row.
- A part variant may have a loader (`<variant>.server.ts`); it runs after the page's loader on every address the slot `applies` to, and its result arrives as the `data` prop (or `useLab().partData("slot")`).

### Load cards the same way everywhere

```ts
import { cardData, cardOf } from "../../cards.server"
const moods = await cardData(kit, "mood") // every mood, 3 titles each
const genres = await cardData(kit, "genre", { n: 8, titles: 5 }) // kinds come with genres
const eras = (await cardData(kit, "decade", { titles: 4 })).reverse() // members are oldest first
const some = await cardData(kit, "country", { only: ["japan", "france"] }) // these, in this order
// options: n, titles (0 for none), by ("fit" | "popular" | "best"), traits, kinds (true: load kinds for any family), only
const one = await cardOf(kit, kit.ref(ing("mood", "cozy")))
```

Each is a `CardData` (`CardProps` without `href`, `kindHref`, `size`), so `<Part slot="card" {...card} href={...} />` works for every family. Call it in the order the page shows its modules: an earlier call takes the best-known titles, a later one avoids them.

### Add a sub-slot

When your page has a part worth switching on its own (the head collapsed or open, where the dials sit), make it a slot:

```ts
// concepts/lab/slots/mood-head/slot.ts
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"
export const slot: SlotMeta = {
	id: "mood-head",
	label: "Mood head",
	order: 10,
	group: "part",
	applies: (address) => pageSlotOf(address) === "mood", // where the panel offers it
	fallback: "open",
}
```

Then either give it variants with a `View` and render `<Part slot="mood-head" {...yourProps} />`, or give it variants that are only names (a `View` that returns null) and branch in your page: `const { pick } = useLab(); if (pick("mood-head") === "collapsed") ...`. In a loader the pick is `lab.pick("mood-head")`. Name the sub-slot after your page (`mood-...`, `hub-...`) so two builders never collide.

## Picks

- The cookie `gw-lab` holds `slot:variant,slot:variant`. The panel writes it and reloads the page's data in place: no full reload, scroll stays.
- `?lab=slot:variant,...` overrides for one request and writes nothing: for screenshots and links you send. A pick made in the panel removes that slot from the address.
- An unknown or missing pick falls back to the slot's `fallback`, silently.
- In a page: `useLab()` gives `pick(slot)`, `picks`, `set(slot, variant)`, `variantsOf(slot)`, `partData(slot)`. In a `View`'s props and in a loader: `lab.pick(slot)`.
- The panel: one row per slot that applies to the page, `[` and `]` step through the page slot's variants, **Notes** lists every pick with its `what` line and the page variant's `notes`, **Round 4** opens the same address in a round 4 concept, **×** collapses it to a corner tab.

## Movies, shows, both

`Kind` is `"movie" | "show" | "all"`; `/all/...` is movies and shows together (`KINDS`, `kindSeg`, `kindLabel` "Movies and shows", `kindNoun` "movies and shows", `kindOne` "title", `withKind(address, kind)`). The kit serves `"all"` from the same snapshot without the kind filter: "well-known" order takes turns between movies and shows, Best merges both published rankings by GoodWatch score, people and awards come from both, copy and hand-written kind names fall back to the movie text. Genres keep their own slugs (`science-fiction` has only movies, `sci-fi-fantasy` only shows).

## Addresses (`kit/address.ts`)

An `Address` is `{ view: "hub" | "family" | "place" | "best", kind, parts, country, ...list state }`. Its real path is A's tree; a blend's first known pair goes into the path, further ingredients into `?with=`.

```ts
hub(kind)                                         // /movies
familyPage(kind, "mood")                          // /movies/moods        (streaming: /movies/streaming/us)
place(kind, [ing("mood", "cozy")])                // /movies/moods/cozy
place(kind, [ing("mood", "cozy"), ing("genre", "comedy"), ing("decade", "1990s")])
                                                  // /movies/moods/cozy/comedy?with=decade:1990s
best(kind, [ing("mood", "cozy")], 2026)           // /movies/best?with=mood:cozy&year=2026
add(address, ing(...)) / remove(address, ing(...)) / swap(address, from, to) / withKind(address, "all")
to(address, { sort: "top" })                      // the `to` of your View: the link under the lab
```

List state travels as query: `sort` (popular | top | newest), `page`, `mine` (on my services), `unseen`, `level` (touch | plenty | full), `venn` (a | both | b), `kind_` (a kind's id, `?k=`), `year`. Families: mood, genre, theme, style, decade, country, service, trait (the fingerprint traits, slugs like `wholesome`, `slow-burn`).

## Data kit (`kit/data.server.ts`)

`kit` arrives opened for the request, kind and streaming country. Everything is real data; nothing writes.

| Call                                                                                   | Returns                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kit.members(family)`                                                                  | The family's places with a full page: `PlaceRef[]` (label, mood hue, service logo, country code).                                                                                                                                                                               |
| `kit.ref(ing)`, `kit.name(parts, { best, year })`, `kit.count(parts)`                  | A place's reference; how a person says a blend ("Dark Korean thrillers"); its size (for decisions, not for display).                                                                                                                                                            |
| `await kit.showcase(parts, n, { by, lines, rows, used })`                              | Representative titles: released, well-known, fitting, one per series, and never one this page already showed (`kit.used`). `by`: `"fit"` (default), `"popular"`, `"best"`. `lines: true` adds a sentence of the title analysis. Ask for 8 to fill a desktop rail, 3 for a card. |
| `await kit.popular(n)`                                                                 | What people watch now. Place it once per page.                                                                                                                                                                                                                                  |
| `await kit.list(parts, { sort, page, mine, unseen, level, venn, kindId, year, size })` | The full list: `TitleList` (titles, total, pages, `discoverHref`).                                                                                                                                                                                                              |
| `kit.traits(parts, { n, less, against })`                                              | `{ more, less }` of `TraitWord`: adjective, family color, and the numbers for disclosure only.                                                                                                                                                                                  |
| `kit.print(parts)`                                                                     | All 74 fingerprint bars against the usual (for an interactive form).                                                                                                                                                                                                            |
| `await kit.kinds(parts, titles)`                                                       | Three or four kinds inside a place, named, each with titles. A kind's list: `list(parts, { kindId })`.                                                                                                                                                                          |
| `await kit.neighbors(ing, { n, within, titles })`                                      | Next door, with the word that differs ("warmer") and a poster trio. `within: "all"` crosses families.                                                                                                                                                                           |
| `await kit.intensity(parts, titles)`                                                   | The lead trait and three bands (a touch, plenty, all the way) with titles. A band's list: `list(parts, { level })`.                                                                                                                                                             |
| `kit.dials(ing)`                                                                       | Four named directions, the place's position on each, and the nearest place further each way.                                                                                                                                                                                    |
| `kit.scores(titles, keys)`                                                             | Fingerprint scores (or axis values: tone, pace, world, mind) per title, to re-sort in the browser.                                                                                                                                                                              |
| `await kit.era(decadeSlug, perYear)`                                                   | A decade: trait words, what rose and fell, each year's standouts. Call it before other showcases.                                                                                                                                                                               |
| `kit.serviceProfile(slug, country)`                                                    | What a service is good at and thin on, and the country's other services.                                                                                                                                                                                                        |
| `await kit.best({ parts, year, limit, offset })`                                       | Without filters the published Best list; with filters a ranking that trusts many ratings over few. Rows carry every source's score.                                                                                                                                             |
| `await kit.people(parts, n)`, `await kit.awards(parts, n)`                             | Directors or creators and actors with their `/person` links; winners at the Oscars, Emmys, Globes, BAFTA with the `/awards` link.                                                                                                                                               |
| `await kit.blend(parts, { suggestions, titles })`                                      | Any number of ingredients: name, Venn counts for two, what only the blend has, "goes well with" suggestions with posters, and swaps per part.                                                                                                                                   |
| `await kit.famousBlends(n, titles)`                                                    | A data-driven starting set of blends for a hub. Curate by hand on top.                                                                                                                                                                                                          |

Call the page's most important showcase first: later ones avoid what it took. `kit.streamingReady` is false while a country's availability loads (service places are empty until then).

## UI kit (`kit/ui`)

See the gallery for each part on real data. `PlaceLede`, `Crumbs`, `TraitWord`, `TraitSentence`, `PlaceCard` (hands over to the picked `card` variant; `PlaceCardPlain` is the round 4 card itself; `PLACE_GRID`, `PLACE_STRIP`), `PlaceMark`, `PosterRail`, `TitleGrid`, `Pager`, `PosterTrio`, `Thumb`, `BigStats`, `BestTable`, `SourceScores`, `ListControls` (the real sort, services and Not seen controls), `VennSwitch`, `IntensityScale`, `PeopleStrip`, `AwardStrip`, motion helpers (`Reveal`, `FlipItem`, `EASE`, `SPRING`, `LIFT`, `FOCUS`), `WRAP`, `PANEL`, `wash(hue)`.

The copy deck and the world map: `copyFor(kind, family, slug)` and `WorldMap` from `kit/optional` (`<WorldMap countries active? variant="page" | "hero" list? fade? initialView? onHotChange? />`), `CountryShape` from `kit/world-map/CountryShape`. The Rooms pieces the owner liked are exported from `concepts/rooms/parts.tsx` and `rooms.tsx` (`EraTimeline` with its draggable span, `KindLinks`, `ModuleHead`, `CardRail`, `GenreBlock`, ...), the dials from `concepts/dials/` (`Dial`, `TunerPanel`, `TunerRow`, `useTuner`, `Field`, `PrintBars`).

## Look at your work

```
node app/prototype/explore/scripts/shoot.mjs /prototype/explore/lab/movies/moods/cozy cozy --lab mood:grid-first,card:identity [--port 3270] [--member] [--viewport] [--hover css] [--click css] [--motion]
```

`--lab slot:variant,...` picks variants for that shot only (it adds `?lab=` to the path; a path that already has a query works too).

It writes `cozy-desktop.png`, `cozy-phone.png` and readable pieces (`cozy-desktop-1.png`, ...) to `~/.cache/gw-explore-r4/shots/`, and prints console errors and sideways scroll. Open the pieces and check them against the flaw list in BRIEF.md.

## Round 5 polish notes

- Each slot's `fallback` is the recommended variant. The panel's **Recommended** clears the cookie; **All round 4** sets every slot to its baseline (`baselineOf(slot)`: `r4`, else `none`, else `auto`).
- The panel shows the page's main slot as pills; every other slot that applies is one "Label: pick" pill with a menu. The `mood-*` sub-slots are hidden while the page variant is a round 4 one.
- A container whose cards must keep their own cells under the Spines card variant says `data-cards="cells"` (ranked moods, Tonight's four moods). A row that runs right to left (the hub's decades) says `data-cards="reverse"`.
- A lead card (`size="l"`) that is wide enough (`@2xl` container) shows a real row of posters at its foot instead of the fan.

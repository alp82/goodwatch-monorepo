# Grouped search panel

The header search panel (command palette: `SearchPanel.tsx` → `CommandPalette.tsx`) shows every kind of match in groups,
not only titles and pages. The design was settled in a prototype (branch `prototype/grouped-search`, final variant `F`,
commits 7899138cb..4cb523381, local only). This spec is the production version of F. The prototype code is a reference for
the look and the layout rules. It is not to be copied: it skips privacy, caching and error handling, and several of its
names (`F`, `R1`, `prototype-*`) must not appear in production.

## Owner decisions (2026-11-05)

- Groups, in this order: **Movies, Shows, People, Tropes, Moods, Genres, Sequels, Streaming services, Lists, Pages,
  Members, Blog**. Keywords are left out. "Sequels" is a movie collection (TMDB `movie_series`), called "Sequels" in this panel.
- All data is real. Each group shows a few items, and its header row carries the count and "All N ›".
- Layout (prototype R1/F):
  - **Search Discover** is a button at the right end of the search field labelled **"Search ↵"**. It is amber while it is the active option, and Enter with nothing else active runs it (Discover search for the text). There are no "tab ⇥ groups" or "esc" hint labels.
  - The **left rail** of group tabs (label + count) shows only when results come from 2+ groups. The "All" tab comes first. The active rail item gets a **straight amber bar** (3 px, square ends, nearly full height), not a border that follows the rounded corners.
  - **All tab:** under 5 groups, one column of sections in the fixed order. 5+ groups put Movies and Shows on top as poster rows, and the other groups in **two balanced columns**. Movies/Shows poster rows use the site's usual poster card (`MovieTvCard`, as Discover uses it), 6 per row. Other groups get 3 rows each.
  - **One group only:** no rail; that group alone (posters in a grid for movies or shows, one column of rows otherwise).
  - **Group header rows** ("MOVIES ……… 57 · All ›") are clickable across their full width, are options in the Up/Down order, and are the only place "See all" lives (no "See all" rows under the items). In All, a header opens the group's tab. Inside a tab, it opens the group's full page (Discover filtered, or the group's own page).
  - **No results:** the query, Enter still searches Discover, mood chips, trending posters.
  - Phones: the panel stays a drawer. The rail becomes a row of chips, everything is one column, and the Search ↵ button stays in the field.
- **Second lines:**
  - **Tropes:** the start of the trope's description, about 110 characters, plain text, with "…".
  - **Sequels:** "9 films, 1977–2019: Star Wars, The Empire Strikes Back, …".
  - **Genres:** "Movies only", "Shows only" or "Movies and shows".
  - **Streaming services and Members:** no line that just repeats the group name.
- **Before typing:**
  - No recent searches.
  - The rail shows **For you** first: the member's "From your taste" recipe tiles from the For You page (up to 3 taste groups, `domain/for-you-page/rail.ts`). Each tile is a header row "Group name ……… All ›" linking to `/watch/for-you?recipe=side-N`, with 6 of its top picks as poster cards. Guests and members without taste data get the page's own one-line call to action, then Trending.
  - After For you: **Trending** (poster cards), **Moods**, **Tropes**, **Go to** (pages).
- Ship to everyone, no feature switch.

## Architecture

- **The text lookup stays on `/api/command-palette`.** Traefik sends exactly `/api/combined-search`, `/api/command-palette` and `/mcp` to the search roles, and that list must not grow (`goodwatch-proxy/acceptance/README.md`). `GET /api/command-palette?q=` keeps answering `{ titles, more }` the old way for any client already loaded (deploys are rolling, and open tabs keep the old code), and also returns `groups`: the new grouped answer. The old fields can go in a later cleanup.
  - Titles come from the search index, as today, split into movies and shows. Counts are exact where the index allows; otherwise they are estimated from the candidates and marked as estimated.
  - People: the in-memory people matcher (`server/search-people/`, popularity ≥ 1, no adult).
  - Tropes: `trope_catalog` names + description excerpts + title counts.
  - Moods/themes/styles: the code lists Discover uses.
  - Genres: `genre`.
  - Sequels: `movie_series` + member films from `movie.movie_series_id`.
  - Streaming services: the brands file + `streaming_service`, with logos.
  - Lists: best-of pages and explore menu pages.
  - Members: `user_profile`, **only members whose privacy settings make their profile public** (find the "Who sees what" setting and follow exactly what `/u/:handle` shows a signed-out visitor).
  - Blog: published posts only (no drafts).
  - Pages stay matched in the browser (`palette-pages.ts`), as today.
  - Each index loads in the background once and refreshes on a schedule. The first lookups after a start answer with whatever has loaded; there are no blocking multi-second waits. Answers are cached in Redis per normalized prefix, like the current title answers (bump the cache key version).
  - The search roles run this code, so they need it deployed too (`deploy.sh <sha>` per role, see goodwatch-search docs).
- **Before typing** data (For you tiles for the session's member, trending) comes from a separate endpoint on the page instances, for example `GET /api/command-palette-start`. It must not match the Traefik search router's exact paths. It reuses the For You page's loader and ranking (`loadForYouPage`, recipe ranking) instead of re-deriving picks; the prototype copied a small "fits a recipe" count from a page hook, and production should move that into a shared function instead. Cache it per member in Redis for a short time.
- Poster cards keep their normal behaviour (impressions, quick view, card actions) as everywhere else on the site.
- **Performance:**
  - A warm lookup stays well under 300 ms on the search roles.
  - The panel's code still loads lazily with the dialog (`LazyDialogs.tsx`).
  - Requests are debounced, and an older response never replaces a newer one.

## Not in this change

Episodes, keywords, member search ranking beyond name prefix/word matches.

## Contract (shared types in `app/utils/command-palette.ts`)

```ts
export type PaletteGroupKey = "movies" | "shows" | "people" | "tropes" | "moods" | "genres" | "sequels"
	| "services" | "lists" | "members" | "blog"   // "pages" is matched in the browser
export interface PaletteItem {
	key: string            // unique within the answer, e.g. "person-287"
	label: string
	sub?: string           // second line (see decisions); omitted when it would only repeat the group
	href: string
	image?: { kind: "poster" | "portrait" | "logo" | "avatar" | "hue"; path?: string; hue?: string }
	title?: PaletteTitle   // movies/shows: everything MovieTvCard needs (poster, score, year, presentation)
	match: number          // 0..1 match strength (exact name 1, prefix of name, word prefix, …) for ordering inside the group
}
export interface PaletteGroup {
	key: PaletteGroupKey
	label: string          // "Movies", "Sequels", …
	total: number
	estimated?: boolean    // total is an estimate
	items: PaletteItem[]   // up to 12, best first; the panel decides how many it shows
	href?: string          // the group's full page ("All ›"); absent when there is none
}
// GET /api/command-palette?q=  →  { titles, more, groups: PaletteGroup[] }  (groups in the fixed order, empty groups left out)
// GET /api/command-palette-start  →  { forYou: { state: "picks"; tiles: { label: string; href: string; titles: PaletteTitle[] }[] }
//                                         | { state: "rate" | "warming"; message: string; cta: { label: string; href: string } },
//                                      trending: PaletteTitle[] }
```

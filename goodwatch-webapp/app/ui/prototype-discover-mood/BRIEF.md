# PROTOTYPE brief: Discover around mood searches and combinable tags

Owner request (2026-10-28): "Discover redesign to put more emphasis on mood etc. searches, combining tags explorer
style, etc. - with the most intuitive simplest UX, without losing the ability to deep dive into complex filters."

Route: `/prototype/discover-mood?variant=0|A|B|C|D` (worktree `/home/alp/dev/projects/goodwatch/proto-discover-mood`,
branch `prototype/discover-mood`). Variant 0 is today's layout as a baseline. A-D are the new ideas.

## Data (already working, don't change kit.tsx)

`kit.tsx` → `useProtoDiscover()` returns `d`:
- `d.q`, `d.setQ(text|null)`: the free-text mood search (real combined search, streamed). `d.reading`: how the search
  read the query (`ReadingChip[]`: want / avoid / attribute / phrase). `d.searchBusy`, `d.searchError`.
- `d.filters`: the real URL-bound `FilterStateBinding` (same as live Discover). Pass it to the real `<FilterBar
  filters={d.filters} counts={d.counts} />` for the deep-dive filters sheet, or call `d.filters.set/update`.
- Tags: `TAGS` (moods, themes = "About", styles; with name, color, description for moods), `d.picked`, `d.isOn(t)`,
  `d.toggle(t)`, `d.clearTags()`, `d.countFor(t)` (titles that option would leave, everything else unchanged; for a
  group with picks it's the "any of" count). Rule: within a group a title fits any pick, across groups it must fit
  each group, at most 3 per group. Tags and text combine: with a query, results are the search's top 100 filtered by
  the tags and filters.
- `d.cards`, `d.total`, `d.loading`, `d.hasMore`, `d.loadMore()`; `<ProtoGrid d={d} />` renders the real Discover grid.
- `EXAMPLE_PROMPTS`, `GROUP_LABEL`, `short(n)`.
- All `/api/` reads go to the live site as a guest. Writes (Want to see etc.) are refused with 403; that's expected.

Useful real pieces: `~/ui/discover/DiscoverHeading` (today's search heading), `~/ui/discover/ReadAsChips`,
`~/ui/filter-bar` (FilterBar, FiltersSheet, SLAB_CLEARANCE), `~/ui/filter-bar/FilterCards.tsx` and `controls.tsx` (how
mood/theme/style chips look today), `~/ui/explorer/combination-words.ts` (how the explorer names a combination),
`~/ui/title-card/TitlePosterCard`, `~/ui/discover/DiscoverGrid`.

## Rules

1. Reuse existing components and look: the current dark site, its chip, button and heading styles, mood hues, poster
   cards. Vary layout, hierarchy, grouping, and disclosure, not the visual language.
2. Simplest UX: the first screen must make "describe a mood" and "combine a few tags" obvious without reading any
   instructions. No instruction prose or tutorial text; labels only. No ambient motion. Animate only transform and
   opacity.
3. Deep filters stay one tap away (the real FilterBar or its sheet), and active deep filters stay visible somewhere.
4. Phone (390 px) and desktop (1440 px) both matter. On phones the first screen should show the mood entry and the
   first results.
5. Copy: sentence case, short, no em dashes, no exclamation marks.
6. Write only your own variant file `variants/<X>.tsx` (and optional siblings named `variants/<X>-*.tsx`). Export
   `NAME` (2-4 words) and `Variant<X>({ d })`. Don't edit kit.tsx, the route, or other variants. Create any sibling
   module before importing it: one missing import breaks the shared dev server for everyone.
7. No new third-party packages. Don't start, restart, or kill servers. The dev server runs on 127.0.0.1:3163 (Vite,
   hot reload). If it breaks, report instead of patching around it.
8. Done = `npx tsc --noEmit -p .` shows no errors in your files, and
   `curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3163/prototype/discover-mood?variant=<X>'` returns 200.
   No screenshot passes: the owner tests the feel himself.

## Round 2 (2026-10-28)

Owner verdict on round 1: "nothing really clicks". A not too bad, but extra filters too disconnected and hard to reach,
and today's essentials (own streaming services, Not seen yet) must stay. B "just a wall of tags". C "very hard to use
and understand". D "has some benefits, but more filters again are so disconnected: instead of using the same sidebar,
it opens another one on the opposite side". "Go deeper, think hard, make the design really really good. We have great
elements already in the original page, mix and match and repurpose."

Round 2 principles (all variants):
- One home for everything that narrows the list: mood text, tags, essentials and deep filters are reachable from the
  same place, never a second disconnected surface.
- Essentials stay one glance away: the real `ServicesControl` and `NotSeenSwitch` (props from `useFilterPieces(d)`),
  For you / sort where today has it.
- Reuse today's pieces as they look: `DiscoverHeading` (the search), `ReadAsChips`, the count line `FilterInsight`
  (today's "62,776 showing · Try + On Netflix …" line, exported from `~/ui/filter-bar/ActiveFilters`), the filter
  cards (`<FilterGroups data={pieces.groups} query="" />` renders the whole card stack with popular tiles and "Add a
  filter"; with a non-empty `query` it lists matching options of every filter, like the sheet's "Find a filter"
  search), `FilterSearchField`, `PopularInline`, `PhoneFilterRow`, `SnapSheet`, `FiltersButton`, mood chips with hue
  dots and counts like the sheet's Mood card (`SheetControls` Chip/ChipList).
- No walls of tags: show a few, the rest on demand. No layout shift: rows that change content keep a fixed height.
- Combine suggestions must be honest: `d.countFor(t)` is what that tag would leave with everything else as is. For a
  tag in a group with no picks yet that's the intersection with all current picks; for another tag in an already
  picked group it's the "or" widening. Suggest combinations from other groups, or label widening clearly.
- Phone 390 px: first screen shows the mood entry, essentials access, and first results. Suggestion rows scroll
  sideways, never wrap. Keep a single phone entry point to filters (today's slab or one sheet), with the same content
  as desktop.
- `useFilterPieces(d)` (kit.tsx) gives: groups (FilterGroupsData), chips (all active filters), secondaryCount,
  servicesProps, notSeenProps, onChange. Taste is the guest state ("signUp").

## Round 3 (2026-10-28)

Owner verdict on round 2: "L and M have lots of potential, let's go deeper those routes."
- E rail: unorganized, hierarchy unclear, don't know where to look for what. F, H, K: too many rows. G: row
  unorganized. I: too complicated. J: bad design, hard to understand.
- L: "has potential. I like the filter palette, we can improve it though."
- M: "nice mood filter. The expanding bar is cool too, but it needs to be organized more clearly. We could use tabs
  or some other nice way of organizing. Recognize in the design that there are more common and more niche filters."
- All: "weird that the search query and the title merge together, that is quite confusing. Let's find a way where the
  search is a filter like the others, but still very prominent."

Round 3 rules (on top of round 2):
- The page title "Discover movies and TV shows" stays as a static title (today's heading look, may be smaller). Don't use
  DiscoverHeading's merging behavior. The mood search is its own control: the most prominent one in the bar/palette
  (largest, first, with the "What's the mood?" style placeholder), and once set it reads like any other filter value
  (the query text + its Read as chips, removable), never as the page heading.
- At most three rows above the grid: title, one control bar, one status line (count, active values, Clear all).
- Filter tiers. Common (one tap away, shown first): Mood search, Mood, Streaming (my services / everywhere / pick),
  Not seen yet, Movies or shows, Genre, Score, Released. Niche (grouped, behind one clear step): About (themes), Style,
  Length, Taste match, Scores by source, Critics vs audiences, Similar to, Cast and crew, Production country, Age and
  content, Loved / Disliked. The design should make the difference visible (size, placement, grouping).
- Build on what the owner liked: L's palette (variants/L.tsx) and M's mood filter and expanding bar (variants/M.tsx,
  M-vibe.tsx). Read both before you start, and lift their parts freely (copy into your own files).
- `FilterGroups` renders all cards; to show only some cards (for tiers or tabs), either hide cards via CSS by their
  `#filter-card-<key>` ids (see E/H for the pattern; use `<style dangerouslySetInnerHTML>`, a plain `<style>{css}</style>`
  breaks hydration), or build controls yourself from `pieces.groups` state + `d.filters.set`.

## Round 4 (2026-10-28)

Owner verdict on round 3: "V + R are by FAR the best." Everything else is dropped. Notes:
- The search isn't only for moods (that's what we highlight), but it must be obvious it also finds a title or
  "something similar to X".
- V: the More tab doesn't work well: a long list to scroll, and only a few filters at a time in the main content.
- R: the full scroll of the palette is weird and confusing. R's More layout is a bit better.
- More could have sub-tabs (like P and T, but more) and/or tiers like Q, with less clutter.
- U has a nice layout too; maybe use it only for More.
- Missing: the search for filters ("Find a filter: horror, a title, a name") from earlier rounds and today's sheet.

Round 4 base (every variant, unless its own idea says otherwise):
- Start from V (`variants/V.tsx` + `variants/R-parts.tsx`): static title, the segmented bar (Search, Mood, Streaming,
  Watched, More), one status line, the panel under the bar that morphs between segments at a fixed height. Copy the
  parts you need into your own files (`variants/<key>-*.tsx`); don't import from another variant's files and don't
  edit R/V.
- Search segment: label "Search", placeholder like "A mood, a title, or like Severance". Its panel shows what it
  can do with one example of each kind (a mood phrase, a title, "like <title>"). While typing: "Search: <text>"
  (runs d.setQ; the combined search also finds titles by name), plus up to 4 title matches (the title picker's fast
  `/api/search` used in `~/ui/filter-bar/FilterPickers.tsx`), each with "Like this" that sets the Similar to filter
  (`d.filters.set({ similarTo: [...] })`). Keep it calm: no explanation prose, the examples teach.
- "Find a filter" (the real `FilterSearchField` + `<FilterGroups data={pieces.groups} query={text} />` results) is
  reachable from the panel. Typing there replaces the panel content with matches from every filter.
- The panel never scrolls a long list. More must show the niche filters in a way that needs at most a short scroll.
- Variant keys are numbers: `variants/R4-<n>.tsx` exporting `NAME` and `VariantR4_<n>`, route keys "1".."10".

## Round 5 (2026-10-28): hierarchy and structure

Owner verdict on round 4: "8 is nice." Everything else is dropped. Request: "base on that and ditch the More from the
main filter bar and instead incorporate them into the 4 others. We can: have tabs for the 4 categories; have subtabs per
selection (without getting messy UX); have the search bar across all tabs; make each tab's content unique to the needs,
unlocks and filters it contains; rearrange More categories into the other ones; change the composition of main and sub
categories. This round is more about the hierarchy and structure and less about the design."

Base (every variant): variant 8 (`variants/R4-8.tsx`, `R4-8-parts.tsx`, `R4-8-lanes.tsx`). Copy what you need into your
own files `variants/R5-<n>-*.tsx`; never import from another variant's files. Keep 8's look, Search lanes (Describe a
mood / Find a title / Similar to), status line, fixed-height panel, and phone sheet. Rules from earlier rounds still
hold (static title, max 3 rows above the grid, no long scrolling lists, labels not prose, no layout shift, phone 390 px
and desktop 1440 px).

Round 5 rules:
- No More segment. Every filter lives in a main tab or one of its sub-tabs. The full list to place: search text (q),
  Similar to, Cast and crew (people), Loved, Disliked, Mood, About (themes), Style, Genre, Movies or shows (type),
  Streaming services (+ country line), Production country, Age and content (ageLimit, only when `pieces.groups.ladder`),
  Length (runtime), Not seen yet, Score (minScore), Scores by source, Critics vs audiences (scoreGap), Taste match
  (minMatch), Released. Nothing may be dropped.
- Sub-tabs: at most one row of sub-tabs inside a tab, short labels, the first sub-tab holds that tab's most used
  controls. A sub-tab with active values shows a small count. The bar segment's value line still summarizes all its
  sub-tabs' values.
- Search across all tabs: the search field is reachable from every tab (how exactly is part of each variant's idea).
  "Find a filter" must still exist, either merged into that field or as its own entry.
- Each tab's content is shaped for its job (a tag mixer for moods, logos for streaming, sliders for scores), not a
  generic stack of the same cards.
- Focus on structure: label each tab and sub-tab clearly, so the owner judges where things live. Polish is secondary.
- Files: `variants/R5-<n>.tsx` (already a placeholder; replace it) exporting `NAME` (2-4 words) and `VariantR5_<n>`,
  route keys "11".."20". Done = tsc clean for your files + `curl` 200 for `?variant=<n>`.

| Key | Structure idea |
|---|---|
| 11 | Same four tabs, More spread by topic. Search: Describe a mood, Find a title, Similar to, Cast and crew. Mood: Mood, About, Style, Genre (with Movies or shows). Streaming: Services, Length, Age and content, Production country. Watched: Seen (Not seen yet, Loved, Disliked), Scores (score, by source, critics vs audiences, taste match), Released. |
| 12 | Renamed for the questions people ask: Search, Mood, Where, Quality. Mood = mood, about, style, genre, type. Where = services, production country, age and content, length ("what fits tonight"). Quality = score, by source, critics vs audiences, taste match, released. Not seen yet, Loved, Disliked live under Search as "Your history". |
| 13 | Same four tabs, sub-tabs as a short vertical list on the left of the panel (not a row on top); each tab's right side is unique. Phones: the list becomes a sideways row. |
| 14 | Tiers inside tabs: each tab opens on an "Essentials" view with its common controls laid out big, and its niche filters as a quiet labeled list at the bottom that swaps the view in place (with a back link). No sub-tab row at all. |
| 15 | One field across everything: the search field sits above the tabs and stays put on every tab. Typing filters every tab at once: Search shows titles and "Search: text", Mood shows matching moods/themes/styles, Streaming matching services and countries, Watched matching filters; tab labels show match counts. This merges Find a filter into the main field. |
| 16 | Three tabs, deeper sub-tabs: Search (mood, title, similar, cast and crew, loved and disliked), Mood (mood, about, style, genre and type, length), Watch (services, seen, scores, released, production country, age and content). Bar gets the space back. |
| 17 | Sub-tabs in the bar: when a tab opens, its segment in the bar widens and shows its sub-tabs inline, the other segments shrink to labels. The panel shows only the selected sub-tab. Same four tabs, More spread like 11. |
| 18 | Mood as the deep tab: Mood becomes a mixer with sub-tabs Feel, About, Style, Genre, Length, each showing combination counts and the picked recipe as one line on top. Streaming adds Age and content and Production country. Watched becomes "Taste" with Seen, Loved and disliked, Taste match, Scores, Released. Search keeps its three lanes plus Cast and crew. |
| 19 | Personal vs title split: Search, Mood, Streaming, For you. For you holds everything about the viewer (Not seen yet, Taste match, Loved, Disliked, Similar to). Mood holds what the title is (mood, about, style, genre, type, length, released). Streaming holds where and for whom (services, production country, age and content). Scores live as a sub-tab of Mood ("How good"). |
| 20 | Drill-down with a path: each tab opens on a grid of its sub-categories as tiles (with live values on them); tapping one replaces the panel with that sub-category and shows a path "Watched › Scores" with a back step. No visible second row of tabs. Same four tabs, More spread like 11. |

## Round 6 (2026-10-28): the Discover lab

Owner verdict on round 5: "16 is really strong. Most others are either hard to navigate or complex or bad looking."
From now on 16 plus the fixes below is the baseline, and anything that needs exploring gets separate variations per
section, like the start page lab. Route: `/prototype/discover-mood?variant=lab` (default), lab bar at the bottom
(← → variant, ↑ ↓ section, ☰ all sections). URL: `&titles=b&mood=c&sec=mood`.

Owner notes on 16 (all must be addressed):
1. Search › Moods and titles: "what's the difference between + Like this and Similar to? Sounds like the same thing.
   Ideally it shows relevant dynamic results in here. Each found title can also be added in different ways: like
   this, loved, disliked, etc."
2. Search › Cast and crew: typing "james" in the bar, then opening Cast and crew, shows nothing until you type james
   again in the card's own field. "Not intuitive." People must follow the bar's text.
3. Mood: "the selection of moods/themes/etc. needs to be refined, see the better choices in explorer" (the explorer's
   mood islands: Tense, Sad, Romantic, Cozy, Dark, Deep, Thrilling, Magical, Funny, Scary, Trippy, Quirky, each with
   "N titles, X% your taste"; code in `~/ui/explorer/`, data via `/api/explorer/*` which the proxy allows). "Also check
   the way better display design and choosing UX in My movies" (`~/ui/watch-next/MoodPicker.tsx`, `TasteShelf.tsx`:
   "Pick up to three. Mix moods, themes, styles, and your taste." Large image cards for taste groups with "N on your
   services", then "Everything else" accordions: Moods 11 · kinds of evening, Themes 13 · what it's about, Styles 10 ·
   how it's told, each with hue dots). "Maybe not everything needs sub-tabs."
4. Length moves to Watch.
5. Streaming must have feature parity with today's Discover Streaming card (Anywhere / My services / Streaming in… with a
   country select and search, Any service, service logos, "+224 more") and use the filter bar's "On my services" pill
   design (green pill with stacked service logos, next to "Everywhere") across the whole filter UI.
6. Scores need icons and color hints for the different sources (IMDb, Rotten Tomatoes, Metacritic, GoodWatch). Scores by
   source more compact than the overall score filter.
7. Taste match does not belong under Scores. "Overall design and layout needs to be improved in this and many other
   tabs."
8. Released can have many more useful controls; there's space.
9. Origin (production country) is its own sub-tab next to Services (semantic closeness). Age and content is separate
   from Origin, so both get generous controls and design.
10. Placeholders must not mention horror (not mainstream enough). This includes Find a filter's placeholder: the real
    `FilterSearchField` hardcodes it, so the lab uses its own field.

Baseline structure (the shell owns it, `lab/shell-parts.tsx` TABS):
- Search: Moods and titles [section `titles`] · Cast and crew [`people`] · Your taste [`taste`: Loved, Disliked,
  Taste match]
- Mood: the whole tab is section `mood` (moods, themes, styles, genre, movies or shows). The section decides its own
  inner structure; it may have no sub-tabs.
- Watch: Services [`services`: streaming + Not seen yet] · Made in [`origin`] · Length [`length`] · Scores [`scores`:
  score, by source, critics vs audiences] · Released [`released`] · Age and content [`age`, only with a rating ladder]

Lab code (`lab/`): `types.ts` (SectionProps, SectionVariant), `choice.ts`, `registry.ts`, `LabBar.tsx`, `shell*.tsx`
(copied from R5-16), `sections/<id>/index.ts` exporting `VARIANTS: SectionVariant[]`, one file per variant
`sections/<id>/<key>.tsx`. Variant `a` is the baseline (the fixed version of what 16 had); `b`, `c`, … explore. Each
variant gets a 2-4 word name that says what's different. Sections may import shared helpers from `lab/shell-parts.tsx`
read-only (copy into the section folder to change them). A section renders only its content area: no tabs, no
sub-tab row, no outer panel chrome. It gets `{ d, pieces, phone, text, setText, runSearch, open }`; desktop content
area is about 1400 × 400 px (fixed height, no long scrolling), phone is a stacked sheet at 390 px.

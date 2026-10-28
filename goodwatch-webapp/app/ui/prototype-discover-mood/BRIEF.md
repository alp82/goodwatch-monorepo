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

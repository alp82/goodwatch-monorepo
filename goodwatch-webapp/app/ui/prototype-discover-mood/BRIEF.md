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

## Round 7 (2026-10-28): lab round 2

Owner verdict on round 6, per section (the picks are now DEFAULTS in `lab/choice.ts`):
- Titles (was "Moods and titles"): a is better than the others, "but there are still lots of confusions":
  - The search is shown twice: the bar field says "funny" and the panel's card says "Search: funny" again.
  - "It says moods, but it does not show moods, and there is a second main tab for that anyway." The shell label is
    now "Titles"; a variant may set its own `label` (SectionVariant.label).
  - The Loved / Disliked thumbs (green up, red down) are nice, "but it should be clear to the user that these are not
    permanent votes (love the colored thumbs, hopefully we can make it clear without prose)". They steer this list;
    they're not ratings saved to the profile.
  - "Maybe we need to separate keyword/title search from the rest somehow, but I prefer we could get this working in
    an intuitive way." "Still a lot to do, probably needs more variations next round that go broad."
- Cast and crew: "all too complicated. I like split by role though. More exploration needed."
- Your taste: a is directionally good.
- Mood: c looks nicest; d is very interesting and nice with the progress bars. "Let's explore more in both directions."
- Services: b is nice. The lab bar now has a Guest / Member toggle (`?as=member`, `viewer` prop).
- Made in: a is best, plus support Hollywood, Bollywood, rest of the world, etc.
- Length: a, but two sliders, so movie length and episode length can be set separately at the same time.
- Scores: moved between Services and Made in. a, plus Metacritic's audience (user) score, and all on the same scale
  (6/60, 7/70, 8/80).
- Released: moved between Made in and Length. c, but with a's range control and input fields.
- Age: needs a country switcher and a free-form age control. a is a bit better, but the owner also kind of likes the
  original (the real Age and content card).

Watch order is now: Services · Scores · Made in · Released · Length · Age and content.

Lab changes: `SectionProps.viewer` ("guest" | "member", from the lab bar toggle; member data is simulated, label it
nowhere in the UI but keep it plausible: e.g. a member with Netflix, Prime Video and Disney Plus, a few loved titles).
Sections that had their own preview toggle should use `viewer` instead. `SectionVariant.label` overrides the sub-tab
label. New variants get the next free letters; keep the old ones (the owner compares).

## Round 8 (2026-10-29): titles d and g

Owner on round 7: d "really good" but the search lacked a clear action on its right, "Show 100 titles" was unclear,
and empty steer boxes should not show; g "even stronger than d", but an example search should land in the bar's pill
and close the panel.

- Shell: `SectionProps.close?()` closes the panel (phones: the sheet). `SectionVariant.searchButton` puts a Search
  button at the right of the bar's field (desktop bar and phone sheet field); it runs the text and closes, like Enter.
  On for titles d and g only.
- d: the action is "Show results" (runs the search and closes). The 100 was the search's cap (it ranks at most 100
  titles, filters can leave fewer), so the count beside it reads "Top 100 matches" or "N matches". The pick tray
  shows under the titles only once something is picked; no dashed slots.
- g: the run row, a Try row and Enter all run the search, put it in the pill and close the panel. No dashed slots in
  This list; picks show there as chips whenever the panel opens (phones: the block hides until something is picked).

## Round 8 mood (2026-10-29)

Owner on round 7: "mood: e is very good", but "1 of 3 moods" after Funny, Crime, Graphic read as a wrong count, and
after picks e's left side was mostly empty. "g is nice too, but it might be better to AND every choice", and its
headings could be calmer.

- Counter (parts.tsx `PickCount`, used by e, d, g, h, i): "3 picked"; the mood limit shows only at three moods, in
  amber ("4 picked · 3 of 3 moods"), nudged when a fourth is refused. f keeps "k of 3 moods" next to its Moods heading.
- e: no empty half. Narrowing cards ("+ Talky") while at least eight exist; otherwise one row of steps (narrowing, then
  "Without Crime" with what comes back, then "or Thrilling", a second pick in a picked group) and a row of the list's
  top posters. At a dead end both rows are ways back (then ready mixes).
- g: the picture headers are now the filter sheet's group heading (accent bar, name, count badge, "any of" on the
  right, hairline). Shared with i in `columns.tsx`.
- i "Columns, all of each": g with every choice ANDed, also within a group. Discover matches any of a group's picks, so
  i counts the AND exactly from Discover's own results endpoint by inclusion-exclusion over the subsets of the picks
  (2^N queries, five picks at most; `and.ts`), with every other filter as it is, also a running search. The recipe
  line, rows, bars and Movies or shows counts are AND counts. A "Top titles" column shows the AND list's top posters
  (each group cut to its rarest pick, its top 400 checked against the other picks through `ranked`); at zero it lists
  "Without X" with what each drop brings back. The grid under the panel and the bar's Show button still show Discover's
  any-of list. Explorer endpoints were not used: their pool (~12k) and mood rules differ from Discover's.

## Round 8 taste (2026-10-29)

Owner on Your taste: "duplicates the titles, we probably dont need them here anymore ... maybe we can expand on the
contents to add more taste related filters here?" Titles (variant g) now steers by titles, so d, e, f drop the Loved /
Disliked boxes and make the tab a home for taste filters. Shared code: `sections/taste/def-parts.tsx`.

| Key | Name | Idea |
|---|---|---|
| d | Taste board | Four labeled blocks: Close to your taste (taste groups as picture tiles, 2x2) with Your strongest (top words as chips) under it, Taste match (with Outside your usual) + Order (Best match, For you), Your lists (Everything / Not seen yet / Your Wishlist / Seen before). |
| e | Taste shelf, one row | Watch next's taste picker on Discover: one shelf of picture tiles mixing taste groups and strongest words, up to 3 picks; one row under it with Taste match, Your lists (segmented) and Best match. |
| f | Taste in this list | Bars: taste groups as rows with loved posters and how much of this list sits in each (plus "In none of them"), Taste match as rows 90%+ down to Outside your usual with shares, Order and Your lists as switches. |

Real (production filter or data exists): Taste match (`match=`, minMatch), Best match (`sort=match`), For you
(`foryou=0|1`), Not seen yet (`unseen=1`), the strongest words as the real mood/theme/style tags (counts live), taste
groups as a concept (Taste page groups, Discover's Sides of you `side=<id>` / `side=none`, Watch next's picker
`taste=<key>`). Simulated: the member's four groups, their names, pictures and counts, which words are strongest, every
member count (shares of the list), Outside your usual (no max-match filter exists), Wishlist and Seen before as Discover
list scopes (Watch next / My movies read the Wishlist; Discover has no such scope). Group picks, Outside and the list
scope live in a page store, so the grid doesn't follow them. Guests see the same blocks faint with a lock and one
"Sign up for your taste" chip; Your lists stays usable for guests.

## Round 9 mood (2026-10-29)

Owner on round 8: "i is great", but move Find a filter to where the type switch was (no Movies or shows switch), drop
Top titles, and the CTA count was wrong (it showed Discover's any-of 1,098, not i's 34). "e is cool too because of the
easy mix selections": one view, two tabs or two steps, open to push back.

- i: Find a filter sits on the recipe line's row (`SectionVariant.ownFind`: the shell drops its 48 px row, the
  content area gets it, and the section places `props.find.field`; Find's results replace the columns). No type
  switch, no Top titles column.
- Grid, status line and Show N titles are the AND list for i, j and k (`SectionVariant.useResults` = and.ts
  `useAndResults`, run by `lab/results-view.tsx` in a host that stays mounted with the panel closed). The count is
  and.ts's exact AND count. The list reads the cut (each group's rarest pick) 400 titles at a time and keeps the
  titles every other pick also has, in Discover's order; it reads on by itself while fewer than 40 show, and Load more
  reads the next 400. Checked against a full intersection: Funny + Cozy + Romantic, about history = 82, same order;
  Funny + Cozy = 3,090, same order. Only while a group holds two picks; otherwise Discover's own list is already it.
- j "Mix row over columns": one short row of e's cards (ready mixes; after a pick "+ X" with AND counts and a share
  bar, then "Without X" when few are left) over i's columns.
- k "Mixes, then choose": a Mixes | Choose switch on the recipe row. Mixes is e's big cards with AND counts; a ready
  mix sets its picks and moves to Choose (i's columns). Starts on Mixes when nothing is picked.

## Round 9 search (2026-10-29)

Owner on round 8, with "cozy rainy day mystery" running: "once i have something in the search i find it difficult to
combine that with other stuff": This list in g made no sense, Cast and crew was empty until the search was removed,
and empty dashed pills don't make sense without content. "taste: f is best" (now the default).

- Titles g: one full-width list, no This list column. What steers the list sits in the search row ("Showing <query>")
  as removable chips: "more like Marple", "less like …", "like …", "with <person>" (phones: a line under the row);
  nothing when none. The row's count reads "Top 100 matches" or "N matches", as in d. When no title has the text's
  name, Titles becomes "In these results" (the running results' top 4, or the preview's for text not yet run), each
  with the thumbs and Like this, so a search combines with More like right there. People becomes "Most in these
  results" (the top actor and the top person behind the camera, with counts) when no person has the text's name.
- Cast and crew c: its own Find a person field (the bar's text still finds names while typed but not run). While a
  search runs, the columns list who is in its results, most titles first, split as before ("12 titles",
  "Writer · 20"); without a search, the well-known people. Picks sit top right. d and e also show the results' people
  instead of the well-known ones while a search runs, and no longer search names with the running search's text.
- How the people are counted (real counts, simulated pool): no endpoint returns the credits of a list of titles
  (cards, the combined search's rows, title-cast, media-title and tv-title carry none). So `people/pool.ts` holds 294
  well-known people (actors, directors, writers, composers and DPs, ids resolved through /api/cast), counted against
  the grid's own query through `/api/discover/results` (`people/in-results.ts`): the pool in chunks of 20 (filter-state
  keeps 20 people), where the people option count of a picked person is what the list holds without them, so
  total minus it is a floor; then the top ten per side in pairs, where each answer is the other's exact count.
  About 15 + 10 requests per search and filter set, cached for the session; people outside the pool, or who only
  share titles with others of their chunk, are missed. Production would want one server query (count
  person_appeared_in / person_worked_on over the list's keys).
- Empty states, no empty slots anywhere in titles, people, taste: Your taste a and b, titles b, c, e, f, h show a few
  titles of this list (a member in taste a/b: their high scores for More like, low scores for Less like) as quiet
  chips or faint posters with that place's thumb; one tap puts the title there (h's zones stay drop targets). Titles
  d, g and people a-e show nothing until something is picked.
- Footer: with a search the Show button reads "Show top 100 matches" or "Show N matches" (`lab/show-button.tsx`);
  without one it is the real Show N titles.

## Round 10 (2026-10-29)

Owner on round 9, with titles g, people c, taste f, mood e, scores a, origin a open:

- Taste f: Your lists is locked for guests like Order (lock on the heading, switches inert).
- Badges: a segment's badge (bar and phone tabs) is the sum of its sub-tabs' badges, on Search, Mood and Watch. Before,
  Search's badge counted only what wasn't the query (Cast and crew's picked person showed 1, the query 0), and Mood and
  Watch had none. Each sub-tab counts its own slots (TABS).
- Mood: no poster strips (posters.tsx deleted). e's cards always fill both rows: narrowing steps, then "Without X" and
  "or X", then ready mixes. e uses `ownFind`: the picks, the count and Clear sit on the top row left of Find a filter.
- Movies or shows left every mood variant (a-h; i, j, k had none). It sits on the right of the Search tab's sub-tab row
  (phones: under the search field), still the whole Discover state's `type`, and counts with Titles (slot `type`).
- Scores a: a "User score" row (Metacritic audience, 6.0+ to 9.0+ on the shared scale, audience marker). Lab only
  (`sections/scores/mc-users.ts`): Discover's sourceScores has no key for it (the data is metacritic_user_score_* in
  discover.server.ts), so it shows in the Watch summary and the Scores badge but doesn't narrow the list.
- Made in a: Popular | Film industries | Regions.

## Round 10 released (2026-10-29)

Owner on d: "usable, but lets make this look nicer, with some sort of variety and nice design we have in other
sections". d's function stays in both (New presets, decades, older, slider + From / To); shared looks in
`released/art.tsx`, one read per tile through `parts.tsx` `useRangeReads` (count + the top title's backdrop and poster
from page 1 of `/api/discover/results`, same query key for c, d, e, f) plus one any-year read for share bars.

| Key | Name | Idea |
|---|---|---|
| e | Era wall, pictures | Three sizes: New as four big picture tiles (2x2), decades as six picture tiles (mood's ArtTile), older as small picture chips. Each era has its own tint, its top title's backdrop and "Like <title>", count and a share bar of all years. A slider range no tile matches fades the tiles outside it. Slider and fields on the right. |
| f | Timeline with posters | Every decade since the 1920s as one column, as wide as its years, so the slider under it lines up. Each column: the decade's top poster, a tinted bar (square-root scaled, real count on top), tap = b's pick / widen / narrow. New as tinted tiles with share bars, Before 2000 / 1950 as picture chips, From / To at the right. |

Known lab bug: the lab's `released=<variant>` URL param is also the real filter's `released` param, so any year pick
rewrites it and the lab falls back to the default variant (d). Needs a different lab param name in `choice.ts`.

## Round 10 length (2026-10-29)

Owner on d: "these should be 2 different params, otherwise they cancel each other". Movies and Episodes are now two
values: the real `runtime` holds the movie range, a lab-only `eruntime` the episode range (`any` for none; without it
the one runtime holds for both, as Length a, b, c still write it). Code in `sections/length/two.ts`, wired in
`kit.tsx` (`useLabFilters`, the results query, the Length chips), so it holds with the panel closed and any section
open. No more "Not used" tags; the block of a kind that's out of the list (Movies only / Shows only) dims.

- Movies only sends the movie range, Shows only the episode range. Movies and shows with two different ranges asks
  twice (type=movie + movie range, type=show + episode range) and adds them up.
- Exact: the count, the status line and Show N titles (two exact totals summed), hidden (catalog less that sum), option
  counts and recoveries other than type (the two lists are disjoint).
- Approximate: the merged order. Top rated, Best match and Newest merge by the card's score, match or year (Newest by
  year only); Popular alternates movie, show (cards carry no popularity); while searching it keeps the ranked order.
  Other sections' own counts (and mood i's AND list) still use the movie range for both kinds in that case.
- Status line: "Movies under 2 h" and "Episodes under 35 min" as two chips; the Watch summary joins them with " · ";
  the Length badge, the Watch badge and Clear all count each range that applies.
- Production would need a second field (e.g. episodeRuntime) so one request can hold both.

## Round 11 mood (2026-10-29)

Owner on e's cards with a search and a person that leave nothing ("Without Cozy", "or Funny", every card "0 titles",
faded): "these look disabled", and "the without filters should only appear once we have 3 selected".

- e, j, k: no card leads to nothing. The grid holds only cards with titles: "+ X", then "Without X", then "or X" (e
  only; j and k AND every pick), then ready mixes. Ready mixes fill what's left without a count, so the grid stays
  full (8 desktop, 6 phone, j's row 6 or 4). When nothing in Mood can bring titles back (a search, people or Watch
  filters already leave 0), the grid is the ready mixes at full strength, no counts. A count that can't be known (a
  running search) stays in only while the list has titles.
- "Without X" only from three picks (moods, About, Style, Genre and search moods together; `DROP_FROM` in e.tsx).
- No dimmed cards in e, j, k (ArtTile's `dim` stays for the mood tiles and Released e). In j and k the mix that is on
  fills last, ticked, so a full grid never runs short.

## Round 11 search/footer (2026-10-29)

Owner on titles g with "cozy rainy day mystery" running: the Filters row duplicated the Mood tab; move Movies or
shows in there with the original site's anime switch; the Showing bar belongs in the footer, on every tab; "main
title should be shows instead tv shows".

- Page title: "Discover movies and shows" (`shell-parts.tsx` PageTitle; the real TYPE_LABELS already say "Shows").
- Titles g: no Filters row, no Showing row. Movies or shows with the anime switch under it (the real sheet's type
  card: Both / Movies / Shows, With anime / Anime only / Hide anime, live counts; `shell-tabs.tsx` TypeBlock) sits
  where Filters was. The "Search <text>" row shows only while the text isn't the running search. Running, Titles get
  three rows; people stay one row. `SectionVariant.ownType` (g only) drops the switch from the Search sub-tab row
  (phones: from under the field) on every Search sub-tab; the other titles variants keep the row switch as before.
- Footer (`lab/shell-footer.tsx`, every tab and sub-tab, desktop panel and phone sheet): the count ("N titles",
  "N matches", "Top 100 matches"), then the search state as removable chips: the query, steering picks ("more like
  X", "less like X", "like X" with poster), people ("with <name>" with face), Not seen yet, every other active filter
  (moods, services, scores, length, type, anime, ...) and the lab-only user score; one row, scrolls sideways under a
  fade. Then Clear all N and the Show button. Fixed height (desktop 68 px; phones: chips row over Clear all + Show).
  The hidden meter left the footer. Chips open their place in the panel, as in the status line.
- No chip twice on screen: g's pick chips and d's pick tray are gone (the footer has them). The status line under the
  bar stays as it was; the open panel (phones: the sheet) covers it.

## Round 11 age/released (2026-10-29)

Owner on age a: the native country select was broken (blank dropdown over the ladder); "use a shared component for
country selection", flags on the quick picks. On released f: keep it (now the default), drag across the graph to pick a
range, "Last year" becomes Last 2 years from 2024, and the two Before chips switch places.

- One country component for Made in and Age (`sections/origin/country-find.tsx`): CountryChip (the sheet's Chip with
  the flag) and CountryMatches ("Find a country" matches as flag chips). Flags now come from Settings' own
  `countryFlagUrl` (public/flags, as Watching from shows them) instead of flagcdn. Settings' CountryGrid wasn't reused
  as is: its 4-column cards, "All countries" growth and every-country list don't fit the fixed panel.
- Age a: Ratings in US GB DE FR IN JP as flag chips (phones: 4; a picked other country takes the first place so the
  row keeps its length) and a Find a country field. Its matches (the 48 ladder countries) show in place of the ladder
  and age slider, same box, nothing moves; a pick sets the country and ends the search.
- Released f: pointer drag over the decade columns picks the spanned decades (capture starts after sideways movement
  or a column change, `touch-action: pan-y`, so phones still scroll; a press without a drag stays b's tap rule). The
  dragged span shows as a column wash and the bars' and posters' opacity.
- Presets (c, d, e, f share `eras()`): This year, Last 2 years (now - 2, so 2024-now, `years=2024-`), Last 3 years
  (now - 3, the real `recent` preset), Last 5 years. "Last N years" is always "since now - N". Older: Before 2000, then
  Before 1950.

## Round 11b (2026-10-29): titles g idle, counts, audit fixes

Owner on titles g with an empty search: only a Try list, the rest empty; "this should also show some popular very
diverse picks of titles ... similar to cast and crew". And the type switch read "Movies 0 / Shows 0".

- Titles g, no text: Try on the left (with Movies or shows and anime above it), "Popular titles" on the right, 12 in
  two columns (phones: 6 under Try), each with the thumbs and Like this; ↑ ↓ Enter reach them too. The list is
  hand-picked for spread (Parasite, Breaking Bad, Money Heist, Spirited Away, The Godfather, Arcane, Squid Game,
  Amélie, RRR, Planet Earth II, Dark, Some Like It Hot), names, years and posters read live (/api/similar-media
  through useTitleNames). Production would want a server pick (top title per far-apart bucket).
- Type counts: kit keeps the previous answer while the next loads (placeholderData), so after a state that matched
  nothing the switch showed that state's zeros until the new counts came. `d.countsFresh` is false while the counts
  are placeholders or the search hasn't ranked; the type and anime switches (a lab copy of the sheet's Segmented)
  then hide each count in place (opacity, no shift). The search preview's results query had the grid's cache key with
  a different data shape; it has its own key now.
- Footer: under the count, the hidden meter and "N hidden" (one fixed row, always there). While the list is 40 or
  fewer (or empty), production's two biggest recoveries follow in amber ("+ 49 below 80"; phones: the biggest), one
  tap drops that filter (Length drops both ranges). An "On my services" chip in the footer and the status line; the
  status line now also keeps the picked services chip ("Netflix").
- Empty grid: production's HiddenTitles (what each one-tap drop brings back, Clear filters; "No results for this
  search" when nothing is hidden).
- Mood names: the status line, footer, Mood summary and Find matches use the lab's names (Cozy, Sad, Thrilling,
  Trippy, Romantic; `tagName` in mood/parts.tsx). The real FilterGroups (Find a filter's full results) still say
  Feel-good etc.
- Not seen yet: one home, Watch > Services. Taste f's Your lists keeps Only your Wishlist and Seen before (same
  filter and label before, so nothing else changed).
- Services b on phones: Any service sits beside Not seen yet while picking services.
- Phone overflow (708 px with a search): ReadAsChips' sr-only "not " (absolute) inside the status line's sideways
  scroller had no positioned ancestor, so it escaped the clip. The scroller is `relative` now (the footer's too).
  Lab only: production renders ReadAsChips in TasteExplanation, not in a scroller.
- TabPanel calls useLabChoice() unconditionally.

## Round 12 (2026-10-29): removal tiles, the You tab

Owner on mood e's "Without X" cards and Not seen yet in Services: "the remove tiles need a better design so that it is
obvious that it's about removing them. can be less tall too. they should only be added at the end and if only at least
one row is missing. the not seen yet is not well placed in services. maybe we can put it back into your taste and
rename that tab to "You"?"

- Mood e, j, k: "Without X" is a slim removal tile (`WithoutTile`, `WithoutRow` in mood/parts.tsx), production's
  recovery look: a minus in the pick's color, the pick's name struck through, a muted outline in its color, no
  picture, and in amber what it brings back ("+ 1,882"; phones "+ 1.9k"). They come last, in one slim row at the
  bottom of the grid, most brought back first, stretching to fill the row (more than a row's worth scroll sideways
  under a fade).
- When: three picks or more (DROP_FROM) and the "+ X" cards leave at least one full row free (`showDrops`; e 4 of 8,
  phones 4 of 6; k the same; j's one row only with no "+ X" card, phones 2 of 4). "or X" cards don't count: they
  widen like the drops and give way to them. In e only a group's one pick can be a drop (picks within a group are
  "any of", so dropping one of two narrows); in j and k every pick ANDs, so each can. Drops that bring nothing back go.
- No layout shift: the grid keeps its height. With removal tiles the last card row splits into compact cards (name
  and count; phones name only) over the slim row (desktop 10.75 + 7.5 + 2.75 rem = two rows of 10.75; phones 5.5 +
  5.5 + 2.5 + 2.5 = three of 5.5). j's tiles are already slim, so there the removal tiles take its last row at the
  same height.
- Search > "You" (was Your taste; TABS, the lab menu "Search: You"). Taste f's Your lists: Not seen yet (the real
  filter, one state), Only your Wishlist, Seen before. Not seen yet works for guests (production keeps guest
  interactions and applies them, `discoverFilterDefaults`); Wishlist and Seen before are locked for guests (lock in
  place of their icon, the heading no longer locked).
- Not seen yet left Services a and b (b's Any service sits in the head row on phones too). The slot `notSeenYet`
  moved to the You sub-tab, so the You and Search badges count it, the footer and status chips open You, the Search
  summary lists it, and Watch's summary and badge no longer do (Watch's placeholder is "Everywhere").

## Round 13 (2026-10-29): k is the mood pick, "all of" / "any of", You lists

Owner: "lets pick k from now on" (DEFAULTS mood: k). On k: the "all of" over each list becomes a toggle so any group can
be "any of"; e's removal style is better, with a more visible strike. On You: Not seen yet locked for guests too, a
60%+ step, "On your wishlist", several lists at once, and each one counted in the You and Search badges.

- k (also i, j, which share andview): each column heading has a small "all of" / "any of" switch (default all of),
  kept in the URL as `anyof=moods,themes,styles,genres` (`useAnyOf` in and.ts). An "any of" group goes to Discover as
  is (its own OR); inclusion-exclusion runs only over the "all of" groups, across groups always AND. Counts, bars, the
  "+ X" cards, "Without X", the grid list and Show N titles follow; with no "all of" group of two picks the list is
  Discover's own. The five-pick cap counts only "all of" picks. The recipe line says "Funny or Cozy" for an "any of"
  group and "and" for "all of". Checked: Funny + Cozy about family, all of 1,304 (2,232 + 3,739 - 4,667), any of
  4,667; Funny or Cozy about growing up and family 942 (4,671 + 2,204 - 5,933); the CTA matches each.
- Removal tiles (`WithoutTile`, e, j, k): the strike is 2.5 px, the pick's color mixed 60% with white, unbroken
  through the letters. k's Mixes showed them almost never (AND leaves many "+ X" cards, so no row was free); they now
  also show once the list is 40 or fewer (the footer's recovery threshold), e's layout: compact last card row over
  one slim row. Choose has no removal tiles (picked rows keep their ×).
- You (taste f): Your lists are three independent switches, all locked for guests (lock in place of the icon): Not
  seen yet (the real filter), On your wishlist, Seen before. Not seen yet and Seen before exclude each other (turning
  one on turns the other off; together they'd leave nothing). Taste match: Any, 60, 70, 80, 90%+, Outside your usual.
  The real `match` filter takes only 0, 70, 80, 90 (MIN_MATCHES, also the MCP schema and option counts), so 60 is
  lab-only (production would add it to MIN_MATCHES).
- Lab-only You choices (taste groups, Outside your usual, Match 60%+, On your wishlist, Seen before) moved to
  `sections/taste/you-extras.ts`, so the shell reads them: each counts in the You badge and the Search total, shows in
  the Search summary, as a removable chip in the footer and the status line (opens You), and in Clear all. Order (For
  you, Best match first) doesn't count: it orders, filters nothing, like the sort elsewhere. f has no strongest words;
  where d and e show them they are Mood tags and count in Mood.

## Round 14 (2026-10-29): k without removal tiles, You lists as Not seen yet pills

Owner: "just remove the removal tiles on the mixes tab of mood, we dont need that anymore"; "wishlist should be on the
bottom of these"; on production's Not seen yet switch: "this somehow looks nicer on the orig discover".

- k's Mixes has no "Without X" tiles (`useCards(..., withDrops = false)`), and the round 13 "list of 40 or fewer"
  rule is gone. The grid always holds its 8 cards (phones 6) at the plain row heights. e and j keep their tiles.
- You (taste f), Your lists order: Not seen yet, Seen before, On your wishlist.
- Each is `ListPill` (f.tsx): production's `NotSeenSwitch` look at its small size (SHELL pill, h-9, icon, label,
  `hiddenShort` count, blue Knob) plus an amber inset outline when on (opacity fade). Production's component is
  hard-wired to its label and eye icons and has no lock, so the pill copies its classes. The count is what the switch
  hides from this list: Not seen yet from Discover's counts (FilterBar's `notSeenHides`, off minus on; the simulated
  share when that is 0), Wishlist and Seen before the list minus the member's simulated 38 / 214; guests none. Muted
  gray when off, blue when on. Guests: lock in place of the icon, faint, no count.
- f's third column has a 17.5rem floor so "On your wishlist" and its count fit at 1280 px.

## Round 15 (2026-10-29): You as its own main tab

Owner: "please give me another variation where we move You out of the search into its own main tab so that we have 4
instead 3. few variations".

- New lab choice "Main tabs" (`v-layout`, first in the lab bar's section list; `lab/layouts.ts`). Only the tab
  structure changes; every panel still renders the chosen section variants. The shell reads the layout for the bar
  order and widths, the phone bar and sheet tabs, badges, summaries, where a chip opens and the panel slide direction.
- a: three tabs, You in Search (today, the default, unchanged).
- b: You beside Search. Search | You | Mood | Watch. You is a peer segment with taste f as one page (no sub-tab row,
  Find a filter on the row like Mood). Summary "Any match · Not seen yet": the match step leads ("Match 80%+",
  "Outside your usual", else "Any match"), the other choices follow. Members get the fingerprint, guests a lock and
  "Sign up" (amber, the segment still opens to f's locked look).
- c: You at the end. Search | Mood | Watch | You, a narrower end cap (flex 0.85, phones 0.8 of a tile) with the same
  lead and a shorter summary ("Match 80%+ · Not seen yet +1").
- d: You hub, Taste and Lists. Search | You | Mood | Watch, You has sub-tabs: Taste (f's groups, match, order) and
  Lists (Not seen yet, Seen before, On your wishlist, and Your services: On my services as the same pill with the
  member's logos, their services with counts, All services opens Watch > Services). Watch > Services keeps the full
  picker; when the choice is On my services (a member's comes in as their explicit list) it counts and shows under
  You (badge, summary "My services", logos as the lead), and its chips open You > Lists. Watch then says Everywhere.
- e: You first for members. Members: You | Search | Mood | Watch (You narrow, phones: first tile under Search);
  guests keep Search first with You as c's locked end cap.
- In b-e Search keeps Titles · Cast and crew with the sub-tab row and the type/anime control; the thumbs (loved,
  disliked) count with Titles, so the Search badge and summary hold only search choices and You's only its own.
  Segment badges are still the sum of their sub-tabs.
- Phones: Search stays full width; the other three share the row under it. The sheet's four tabs use 13 px labels.
- "/" opens Search in every layout. Find a filter applies in place (it never jumped); its picks badge the tab that
  owns them.
- Script: `~/.cache/ptshot/dm-layouts.mjs` (L=abcde SIZES=1440,390 SHOTS=dir) opens each layout as guest and member,
  clicks every main tab and sub-tab, checks "/" and counts page errors.

## Round 16 (2026-10-29): popularity, money and show filters

Owner: "c is best, lets pick this" (layout c is the default now), plus a screenshot of another site's vote count, rank,
budget, box office and drop rate sliders: "do we have the possibility to add filters like these with our current
data? for those we can, add them to appropriate locations with good design and ux. few variations if feasible".

Feasibility, read from code: the ratings count (snapshot `votes`) and popularity rank (snapshot `popularity`, the
cached Popular order) are cheap snapshot filters. Budget, box office, seasons, episodes, time to finish and show status
are Crate columns, so each is a SQL set like `runtime`. Budget and box office are sparse on TMDB. Drop rate needs a
per-show aggregate over members' `dropped` states, and there are far too few members for it; not built. Awards need
an ingest. Live Discover accepts none of these, so everything below is lab-only.

New lab section "Watch: popularity, money, shows" (`v-more`, `sections/more/`). The values live in `store.ts` (like
mc-users and you-extras). The grid doesn't follow them. The Watch summary, the sub-tab and Watch badges, the status and
footer chips (they open the sub-tab) and Clear all do. Counts are simulated: a share table per filter times the
list's movie or show count (type option counts), with the other lab-only choices multiplied in.

- Choices: How many ratings (Hidden gems under 10K, Known to fans 10K to 100K, Well known 100K+, Everyone's seen it
  1M+), Popularity (Popular now top 1,000, Under the radar #1K to #10K, Deep cuts past #10K), Budget (Indie under $5M,
  Mid budget, Big, Blockbuster $100M+), Box office ($100M+, $500M+, $1B+, Hit 3x budget, Flop), Seasons (One season, 2
  to 3, 4 to 7, 8+), Status (Still running, Ended, Canceled), Time to finish (A weekend under 10 h to Years of it 100
  h+). Every range also has a stepped slider (uneven stops, the span read as one label, "Under 10K").
- a: own Watch sub-tabs, Services · Scores · Popularity · Made in · Released · Length · Budget · Shows · Age and
  content. Preset tiles with counts over the slider (length d's look). Budget shows with movies in the list, Shows
  with shows (or while one of their choices is set); a block of the other kind dims.
- b: a's sub-tabs, each range as a histogram (one bar per stop gap, square-root heights, amber inside the range) right
  over its slider; presets as chips under it.
- c: one More sub-tab at the end of Watch: three columns How known | Movies | Shows, chips only, no sliders.
- Layout: `layouts.ts` `withMore` adds the sub-tabs to any main tabs layout; `layoutFor(choice)` is what the shell
  reads. Sub-tabs carry `part` (renders the more section at that part) and `kind` (shown with that type).
- Production would need: a FilterState field and URL param per filter, a FILTER_NAMES bit, a snapshot range check
  (votes, rank) or a SQL set (the rest), option counts per preset, and the MCP discover schema.

## Round 17 (2026-10-29): more a, with livelier tiles

Owner: "i like A the most. but we can make some of those selectable tiles visually a bit more engaging. not everything
needs to be as vibrant as the moods tiles, but still some variations needed." Shows now sits after Popularity.

- b and c are gone (files, the More sub-tab, `part: "all"`, `Histogram`). `withMore(L)` always adds Popularity and
  Shows after Scores, Budget after Length. a is unchanged; its layout is now `MoreView` with a skin (preset tiles,
  Hit and Flop, Status chips), so d, e and f are a's structure with a different look.
- Shared: `tiles.tsx` `RichTile` (a's tile plus a top row for a picture and the count; one label weight in both
  states and the count stays visible when picked, so nothing moves) and `MarkChip`; `glyphs.tsx` draws the glyphs.
- d, glyphs and ramps: quiet gray tiles, each with a glyph drawing the whole scale filled up to its step: a crowd of
  1 to 4 figures (ratings), signal bars 4/2/1 (Popular now strongest), $ to $$$$ (budget), 1 to 3 coin stacks (box
  office), a tower of 1 to 4 slabs (seasons), a clock a quarter to full (time to finish). Hit and Flop get an up or
  down trend line, Status chips a live dot, a stop square, a cut circle. Gray at rest, amber when picked.
- e, muted color: a hue per group, low saturation and alpha, stronger for bigger presets, and a different wash per
  group: ratings blue diagonal wash, popularity rose glow from the top right corner, budget sage and box office gold
  filling up from the bottom (taller fill for bigger), seasons a faint flat violet. Picked tiles fade in a light fill
  of their hue (opacity only). Hit warm orange, Flop cool steel, both with d's trend line in the hue. Status and Time
  to finish stay a's plain gray on purpose.
- f, example posters: three posters fanned per preset (Hit and Flop two), opening out when picked (transform only);
  boxes are there before the posters fade in; dead tiles go gray and faint. Time to finish uses d's clocks, Status
  d's marked chips. Examples (`examples.ts`, checked 2026-10-29 through the proxy):
  - Ratings (GoodWatch overall voting count): Hidden gems Kaili Blues, Saint Frances, Cameraperson (4K to 6K);
    Known to fans Columbus, Petite Maman, Shiva Baby (22K to 45K); Well known Past Lives, Aftersun, Paddington 2
    (126K to 187K); Everyone's seen it The Dark Knight, Forrest Gump, Breaking Bad (2.7M to 3.8M).
  - Popularity (Discover's default order): Popular now The Odyssey #50, Spider-Man: Brand New Day #29, Slow Horses
    #49; Under the radar Amélie #3,185, Shaun of the Dead #4,773, 12 Years a Slave #6,399; Deep cuts Wendy and Lucy,
    Tangerines, Leave No Trace.
  - Budget: Indie Moonlight, Whiplash, Paranormal Activity; Mid Parasite, La La Land, Knives Out; Big The Matrix,
    Inglourious Basterds, Gone Girl; Blockbuster Avatar, Avengers: Endgame, Titanic.
  - Box office: $100M+ Get Out, Arrival, The Grand Budapest Hotel; $500M+ Inception, Interstellar, Deadpool; $1B+
    Barbie, Frozen, Jurassic World. Hit Joker, The Blair Witch Project; Flop Babylon, Mortal Engines.
  - Seasons: One Firefly, Chernobyl, The Queen's Gambit; 2 to 3 Fleabag, Arcane, Mindhunter; 4 to 7 The Wire, The
    Sopranos, Mad Men; 8+ The Simpsons, Grey's Anatomy, Friends.
- Rough: Popular now drifts daily (two of its three are 2026 releases). Discover's results stop at #10,000, so Deep
  cuts are picked by TMDB popularity (2.3 to 4.3, the #10,000 title is 7.9), not a read rank. Examples are fixed:
  they don't follow the list's other filters (a movies-only list still shows Breaking Bad under Everyone's seen it).
  Hit's "3x" is the label's rule; Joker and Blair Witch clear it by far.

## Round 18 (2026-10-29): g, d's glyphs in e's color; Seasons as an episode grid

Owner on round 17: "d drawings are awesome! but for seasons we need something better. maybe something like a smaller
or bigger episode grid. combine that with e for perfection. not f, thats too much"

- f is gone (`f.tsx`, `examples.ts`: the example posters, their loading and the fan). a, d and e stay for comparison.
- Seasons glyph (`glyphs.tsx` `EpisodeGrid`, in d and g): a miniature of the title page's season by episode ratings
  grid, rows are seasons and cells episodes, last row a bit short. One season is one row of 7 cells, 2 to 3 three
  rows, 4 to 7 a five row block, 8+ eight rows of small cells. Same 40 by 24 box for all four (the Seasons tiles' top
  row is 24 px, the other groups keep 16 px), whole pixel cells (4, 3, 3, 2 px) so they stay crisp. Three fixed shade
  steps per cell, mostly the best one: in d currentColor at three opacities (gray shades at rest, amber shades
  picked), in g three lightness steps of the group's violet (deep shades on the picked fill).
- g (`g.tsx`, the default now): every group keeps d's glyph, drawn in e's per-group hue (ratings blue, popularity
  rose, budget sage, box office gold, seasons violet, Hit warm, Flop steel). Behind it only one quiet wash for every
  group: a glow from the glyph's top left corner at about two thirds of e's strength, stronger for bigger presets
  (Popular now strongest), plus a faint hue edge. Count and sub line take the soft hue. Picked: the tile fades in a
  light fill of its hue (opacity only) and the glyph turns a deep shade of it. Dead tiles: gray glyph, wash at 20%.
- g's quiet groups: Time to finish keeps a's gray tile with d's clock, picked is a's white with the clock in a muted
  teal; Status keeps d's marked chips, gray, picked is white with the mark in its state's hue (running green, ended
  steel, canceled muted red).
- e exports its `HUES` and `hsla` for g; nothing else in e changed.

## Round 19

- Owner: the season grids were too many dots; show growth, not real season counts. Seasons glyph is now 1 to 4 rows of 2 to 5 cells (2, 6, 12, 20 cells), same 3 px cells, in the same 16 px row as the other glyphs, so Seasons tiles match the other tiles' height (d and g).
- Time to finish: "Years of it" renamed "A real binge".

## Round 20 (2026-10-29): locked

Owner: "lock all of the defaults and selections in and remove the rest of the options and rounds from the picker".

Locked picks, one variant per section (`lab/choice.ts` DEFAULTS, each `sections/<id>/index.ts` lists only its pick):
layout c (four tabs, You at the end), titles g, people c, taste f, mood k, services b, origin a, length d, scores a,
released f, age a, more g.

Deleted:

- Rounds 1 to 5 (`variants/`, about 100 files) and the route's `?variant=` switch and `PrototypeSwitcher`. The route
  always renders the lab; `?variant=` is ignored, so old `variant=lab` links still work. `~/ui/prototype/PrototypeSwitcher`
  itself stays (other prototypes use it).
- Every non-picked section variant, `titles/def-steer.tsx`, `taste/member.tsx`, `sections/placeholder.tsx`, layouts
  a, b, d, e and `layout-d.tsx` (layout d's Taste/Lists pages, its "myServices" slot and `splitsMine`), the `liveGrid`
  variant option (titles f only), the lab bar's R5 link.
- Pieces a pick took from a sibling moved next to it: mood e's member mixes and DROP_FROM and g's COLUMNS into
  `mood/andview.tsx`; released a's YearField and c's eras into `released/art.tsx`, b's decade helpers into
  `released/parts.tsx`; length a's picks into `length/parts.ts`; more a's MoreView/Skin and e's hues into
  `more/parts.tsx`; taste `def-parts.tsx` is now `taste/parts.tsx`.
- Exports and helpers nothing uses any more (kit, shell and section parts), found by an export-usage scan plus tsc
  `noUnusedLocals`.

Kept for the next round: the lab bar machinery. It lists only sections with more than one variant (`PICKABLE` in
`lab/registry.ts`), with ← → / ↑ ↓, ☰, H, the guest/member toggle and `v-<id>` / `sec=` in the URL; with none it shows
only guest/member and hide. A URL key naming a removed variant falls back to the pick (`pick` in `registry.ts`). The
`layout` pseudo-section stays: `layoutFor` reads `v-layout`, else DEFAULTS (c); before this round a bare URL showed
layout a's three tabs despite the c default.

Earlier rounds live in git history: the last commit before this cleanup is 4a2592c87 on `prototype/discover-mood`.

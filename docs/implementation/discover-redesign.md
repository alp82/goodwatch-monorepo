# Discover redesign: production build

Owner decision (2026-10-29), after 23 prototype rounds: "lock all changes in, ship to main". This spec describes what
ships, what production is missing for it, and the order of small steps that build it on main.

The prototype is reference only. Production gets its own build that follows the existing code (filter state, title
filter, results endpoint, filter bar pieces); no prototype file is promoted.

Sources:

- Final prototype: branch `prototype/discover-mood` at `e69766262`, worktree `proto-discover-mood`. Code under
  `goodwatch-webapp/app/ui/prototype-discover-mood/` (`kit.tsx`, `lab/`). `BRIEF.md` there records every round and
  verdict; rounds 20 to 23 are the locked state.
- Feasibility of the popularity, money and show filters: read from code on 2026-10-29 (summarized in
  [Server design](#server-design)).
- Production at `origin/main` `714e14e84`.

Terms follow `CONTEXT.md`. New terms in this spec:

- **Discover bar**: the row of main tabs (Search, Mood, Watch, You) that replaces today's filter bar on Discover.
- **Panel**: what opens under the Discover bar (desktop) or as the phone sheet. It has a tab header row, the open
  sub-tab's content, and the panel footer.
- **Find**: the one search field in the tab header row. It finds filters, values, titles and people across all four
  tabs. It is different from the Discover search (`q`), which ranks titles.
- **All of / any of**: how the picks inside one tag group (moods, themes, styles, genres) combine.
- **Facts sidecar**: a new optional part of the title snapshot with the facts the new filters read (release year,
  length, budget, box office, seasons, episodes, show status, production countries).

## Decisions at a glance

- Build everything the prototype shows with real data. Two things are cut from the first release: taste groups in the
  MCP tools, and "In none of them" as a pick. [Cuts](#cuts) gives the reasons.
- New filters (popularity, budget, box office, shows) run in memory over the title snapshot and the new facts sidecar,
  like moods and scores today. They don't run as per-request SQL sets, so every preset tile, slider span and decade
  bar gets a real count from the one results response.
- Release year and length move to the facts sidecar too, so Released and Length get counts and filter in memory.
  Made in keeps today's SQL set for pass/fail and reads the sidecar's countries only for its counts (see [Facts
  sidecar](#facts-sidecar)). The SQL sets stay as the fallback when a snapshot has no facts sidecar.
- Fail-mask budget: 28 of 32 filter groups after this build. Related filters share a group (see
  [Fail-mask budget](#fail-mask-budget)).
- Tag groups get an all-of mode (`all=moods,themes`). URLs without `all` keep today's any-of meaning, so old links,
  Watch next links and MCP page URLs don't change. The UI writes `all=<group>` only for a group with two or more
  picks whose switch is on all of (see [Filter state additions](#filter-state-additions)).
- Moods take the names the owner tested in the lab (Cozy, Romantic, Thrilling, Sad, Trippy) everywhere: Discover,
  Watch next, TV, the start page, MCP and Discord, with the old names as aliases (B2a). Five new moods, Tense, Dark,
  Deep, Magical and Quirky, become real mood filters on every surface that lists moods (B2b). Owner decision,
  2026-10-29: "everywhere plus five new moods as filters ... it makes sense to stay consistent across all pages".
- The new UI is assembled behind a development-only harness route (as `dev.filter-bar.tsx` was for today's bar), then
  swapped onto `/discover` in one step. Live Discover never shows a half-built bar, and there is no feature switch.

## What ships

### Page

- A static page title, "Discover movies and shows", in today's heading look (smaller). The Discover search no longer
  merges into the heading (`DiscoverHeading` leaves Discover).
- Under it, the Discover bar, then the status line, then the grid. While the panel is closed, at most these three rows
  sit above the grid.
- Unchanged from production: the grid (`DiscoverGrid`, glide, moved marks, 40 per page, `NextPageLink`), Sides of you
  rows for members while For you is on (`SideRows`, `SideBanner`, `side=`), the empty state (`HiddenTitles`), For you
  states (`ForYouSignUp`, `ForYouNeedsTaste`), `SignUpKey`, search mode with `q` (combined search, streamed reading,
  top 100 ranked, `noindex`), server rendering of the first pages, legacy redirects, and the person-lookup redirect.

### Discover bar

- Four main tabs in this order: Search, Mood, Watch, You. Desktop widths (flex shares): Search 2.5, Mood 1.2, Watch
  1.2, You 0.85. You is a narrow end cap.
- Each segment shows its label, a value line and a badge:

| Tab | Value line | Empty value | Badge counts |
|---|---|---|---|
| Search | The query in large type with a clear button (panel closed), else Like this, people, More like, Less like, type | "A mood, a title, or like Severance" | Query, Like this, loved, disliked, type, anime, people |
| Mood | Mood hue dots, then the moods, About and Style, then Genre; "A, B +N" | "Any mood, any genre" | Every pick in the four tag groups |
| Watch | Service logos lead; "My services", the service names or "Any service"; then Made in, length, score, sources, gap, years, age, popularity, budget, shows | "Everywhere" | Every active choice on the Watch sub-tabs |
| You | The match step first ("Match 80%+", "Outside your usual", else "Any match"), then the first other choice "+N" | Members "Any match" with the fingerprint mark; guests "Sign up" in amber with a lock | Taste groups, match, Not seen yet, Seen before, On your wishlist |

- A segment's badge is the sum of its sub-tabs' badges. Order choices (For you, Best match first) don't count: they
  order, they don't filter.
- Guests can open You. It shows the locked look (see [You](#you)).
- "/" opens Search from anywhere except inside a text field.

### Panel and tab header row

- Desktop: the panel opens under the bar (opacity, a short 8 px rise, scale 0.97 to 1, 0.2 s). Switching tabs slides
  the content 28 px in tab order. The content area has a fixed height of 400 px and scrolls inside, so the page never
  shifts. The grid dims while the panel is open. Escape, or a pointer down outside the bar and panel (not inside a
  dialog, menu or listbox), closes it.
- Every tab has the same 48 px header row: sub-tabs on the left, Find on the right (320 px or 34%, whichever is
  smaller). A sub-tab with active choices shows a small count.
- Sub-tabs:
  - Search: Titles, Cast and crew.
  - Mood: Combos, Everything. Mood opens on Everything when anything is picked, else on Combos. The pick count sits
    on Everything.
  - Watch: Services, Scores, Popularity, Shows, Made in, Released, Length, Budget, Age and content. Budget shows
    while the list holds movies (type is Both or Movies) or a budget choice is set. Shows shows while the list holds
    shows or a show choice is set. Age and content shows only when the results carry a rating ladder.
  - You: Taste and lists.
- Default sub-tabs: Titles, Combos (or Everything), Services, Taste and lists.
- While the panel is open, the Search segment becomes a live text field on every tab. Typing or focusing it on
  another tab moves to Search, Titles. Enter or the amber Search button at the field's right runs the search and
  closes the panel.

### Find

One field that finds everything that can be set in any tab. Placeholder "Find: Netflix, cozy, a name" (no horror
examples anywhere). Results replace the content area in place, as columns in tab order (empty tabs hidden; phones
stack them). Each column has the tab name and quiet sub-tab labels. Choices show as the sheet's option chips with a
count or a tick; titles and people show as rows. A pick toggles the choice with the same setter the tab uses, so the
tab, badges, status line and footer agree. The text stays after a pick. The sub-tabs dim; tapping one ends Find and
opens it.

What it finds:

- Search: Movies, Shows, Anime only, Hide anime; titles from the title name search (pick = Like this); people from
  the person search (pick = Cast and crew).
- Mood: ready mixes (the member's own for members), the Feel moods by their names (old names still find them:
  Feel-good, Romance, Action, Heavy, Mind-bending), About, Style, Genre.
- Watch: On my services, Any service, every service of the country, GoodWatch score steps, each source's steps, the
  Metacritic user score, Critics vs audiences, popularity presets, budget and box office presets, Hit, Flop, seasons,
  time to finish, show status, film industries, regions, countries, release eras, movie and episode lengths, the
  age ladder.
- You: taste groups (members; guests get one "Your taste groups" row), match steps, For you, Best match first, Not
  seen yet, Seen before, On your wishlist. Locked for guests: faint, a lock, inert.

Matching order: whole name, name start, a word's start, every typed word starts a word ("hidden gems"), inside the
name (3+ letters), extra words ("box office", "watchlist", old mood names). Names need two letters; values count from
one character. Results of a hidden sub-tab (Budget with shows only, Age without a ladder) are dropped.

Values: Find reads numbers and short phrases as settings, at most 4 value results, likeliest first. A value result and
a name match of the same setting share a key and only the better one shows.

| Input | Readings |
|---|---|
| `1999` | Released in 1999, From 1999, Up to 1999, The 1990s. With a word: from/since, after, before, until/up to, in/released give that one (`in` adds the decade). |
| `1990s`, `90s`, `'90s`, `the 90s`, `early 90s` | The decade (00s to 20s are 2000s to 2020s, 30s to 90s are 1900s); early, mid, late give a third of it. |
| `1990-1999`, `1990 to 99` | That range, "The 1990s" when it is one decade, else "Released 1990 to 2005". |
| `90 min`, `2h`, `2h30`, `over 2 hours`, `under 90`, `about 45 min` | Movies (60 min and up) and Episodes (60 min and down): under N, N or more, about N (10 either side); at most 240. Bare round numbers (45, 60, 90, 105, 120, 150, 180, multiples of 10 from 100 to 240) also offer "Movies under N", ranked lower. |
| `100h`, `under 30 hours` (past 4 h) | Time to finish, snapped to its stops. |
| `$100m`, `budget 50m`, `$1b box office`, `under $5m`, `300m` (minutes past 240 read as millions) | Budget and Box office, snapped to their stops. A money word picks one, else both (box office first past $300M). |
| `12`, `12+`, `fsk 16`, `usk 12`, `ab 12`, `pegi 16`, bare numbers up to 21 | The nearest step of the list's rating ladder (ties to the lower, at most 3 years off), labeled in the ladder's words ("Up to PG-13 · TV-14"). |
| `pg-13`, `r`, `tv-ma`, `nc-17`, `12a`, `u` | The local ladder's own label first, else the US age the name stands for on the local ladder. One letter only matches a local label. |
| `8 seasons`, `3+ seasons`, `up to 3 seasons`, bare 1 to 15 on the seasons scale | "N+ seasons" ("One season" for 1); bare numbers rank below the age reading. |
| `80`, `over 80`, `80%`, `7.5` | Exact steps of the shared score scale only, no snapping: GoodWatch and every source. `%` gives only the Rotten Tomatoes rows; `7.5` gives only IMDb and the Metacritic user score. |

More: under the title and people groups, "More titles" or "More people" with "4 of 13" ("20+" at a full title page,
"100+" at the person search's cap) grows the group in place: 4, then 12, then 12 more per tap, inside the content
area. Quiet at the line's right, "In Titles" and "In Cast and crew" end Find and open that sub-tab with the text in
its field (Titles: the bar's search field, typed and not run; Cast and crew: Find a person). New text starts at 4.

Keyboard: arrow keys move through results; Enter picks the highlighted result, else the best-scoring one (so `1999`
picks Released in 1999, not a title named 1999). Escape clears the field (taken before the panel or sheet sees it);
Escape on an empty field closes the panel. The text stays while switching main tabs; closing the panel clears it.

### Search tab

**Titles**

- Idle (no text): on the left, the type block (Both, Movies, Shows; With anime, Anime only, Hide anime, with live
  counts on the options not chosen) and "Try" with example prompts; on the right, "Popular titles": 12 in two
  columns (phones: 6 under Try), each with the steering controls. Arrow keys and Enter reach them.
- Typing (text not yet run): a first row "Search <text>" with the preview count ("Top 100 matches" or "N matches")
  and 5 preview posters (desktop), then the type block, then "Titles" (4 name matches; with none, the preview's top
  titles under "In this search"; else "No title called "x"" or "Looking…"), then "People" (up to 2 matches).
- Running (text is the running search): no run row; 6 titles (phones 3). With no name match, the grid's top titles
  under "In these results". With no person match, the top actor and the top person behind the camera in these
  results under "Most in these results" ("Director · 12 titles").
- Steering per title row: More like (thumb up, emerald, `loved`), Less like (thumb down, red, `disliked`), Like this
  (rose, `similar`). Tapping the row toggles Like this. More like and Less like exclude each other. They steer this
  list and are never saved as ratings.
- The type and anime counts hide in place (opacity, no shift) while counts are stale: the previous answer is still
  showing or the search hasn't ranked.

**Cast and crew**

- "Find a person" field (300 px). Its own text wins; otherwise it follows the bar's text while that isn't the running
  search.
- Two columns, "Actors" and "Behind the camera", up to 10 each on desktop (two across), 5 on phones.
- Three modes: found (name matches, behind the camera by popularity); in these results (a search is running: who is
  in its results, most titles first, "12 titles", "Director · 20"; empty "None in these results"); featured (no
  text, no search: well-known people, 8 actors, and 4 directors, 4 writers and 2 other crew behind the camera).
- Picks show as face chips joined by "or" ("With A or B"): the people filter is any of them. Rows use a plus that
  turns into a tick.

### Mood tab

**Combos**

- A grid of cards that always fills: desktop 4 by 2 (8 cards), phones 2 by 3 (6 cards). No removal tiles.
- A ready mix is two tags from different groups. Applying one replaces the mood, theme and style picks (genres stay)
  and moves to Everything. A mix is on when the picks are exactly its tags.
- Guest mixes: Cozy + Animated, Funny + Crime, Scary + Slow burn, Romantic + History, Thrilling + Future, Sad + True
  stories, Trippy + Stylized, Funny + Family. Members get mixes from their taste groups first (see
  [Mixes](#mixes)), filled up with guest mixes.
- A card: the two tag hues as split art, the backdrop of the mix's top title, "Like <title>", "N titles", a tick when
  on.
- With picks, the cards are, in order: "+ X" cards (every unpicked mood, theme or style whose all-of count is above 0
  and below the total, by count, "N left" with a share bar), then ready mixes with counts, then ready mixes without
  counts (the one that is on last, ticked). No card leads to nothing. When nothing in Mood can bring titles back, the
  grid is the ready mixes, without counts.
- While a text search runs, cards show no counts and no "Like" line unless the count is known.

**Everything**

- Four columns: Feel, About, Style, Genre (phones: stacked, rows two across). Each column head has the sheet's accent
  bar, the label, a pick count and an "all of" / "any of" switch (all of by default).
- Feel: Funny, Cozy, Romantic, Thrilling, Scary, Sad, Trippy (B2a), plus Tense, Dark, Deep, Magical and Quirky as
  real moods (B2b; the prototype added these as words to `q`, which production doesn't do). About: the 14
  themes. Style: the 10 styles. Genre: every genre with titles, with the five folded pairs counted as one (Action
  also matches Action & Adventure, and the same for Adventure, Sci-Fi, Fantasy, War).
- Rows: 26 px, a color dot, a share bar, the count, a cross when picked. Order: picks, then live rows, then by count,
  then by name. Dead rows (count 0, or the group is at its cap) are gray and inert.
- Caps: 3 per group, refused beyond (the counter turns amber: "4 picked · 3 of 3 moods"). Production refuses a fourth
  theme or style too; the prototype's drop-the-oldest behavior is a prototype bug.
- Counts and bars follow each group's mode: all of counts what adding a row leaves with every pick; any of counts the
  widening.

### Watch tab

**Services** (today's Streaming card at parity, in a new layout)

- Desktop: a 280 px rail with a vertical mode pill ("On my services" with stacked logos in the green pill, then
  "Everywhere", then "Streaming in…"), each with its count, and "Streaming in <Country>" at the bottom. On the right
  a head row (country select, "Find a service in <Country>", "Any service" in pick mode) over a 6 column logo wall:
  18 tiles, "+N more" opens up to 120.
- Phones: a horizontal pill, two columns, 9 tiles; Any service sits in the head row.
- Guests without services see "Add my services" (phones "Add mine"), linking to Settings.
- The first tap from mine, everywhere or Any service means just this one; later taps add or remove; removing the last
  returns to Any service. A picked tile has an emerald ring and tick; others dim.

**Scores**

- GoodWatch score: Any, 60+, 70+, 80+ as tall tiles with the score word and count; the pick and every tile above it
  lit.
- Critics vs audiences: Any, Both agree, Critics liked it more, Audiences liked it more, with a two-bar glyph.
- Scores by source, compact rows on one shared scale, shown in each source's notation: IMDb (6.0+ to 9.0+),
  Tomatometer (60%+ to 90%+), Popcornmeter (60%+ to 90%+), Metascore (60+ to 90+), Metacritic user score (6.0+ to
  9.0+). Each must pass. Source icons and colors per source.

**Popularity**

- How many ratings: Hidden gems (under 10K), Known to fans (10K to 100K), Well known (100K+), Everyone's seen it (1M+).
  Stepped slider stops: Any (the 1K eligibility floor), 2K, 5K, 10K, 20K, 50K, 100K, 200K, 500K, 1M, 2M+.
- Popularity: Popular now (top 1,000), Under the radar (#1K to #10K), Deep cuts (past #10K). Stops: #1, #100, #250,
  #500, #1K, #2.5K, #5K, #10K, #20K, #40K+.
- Preset tiles with counts over each slider; the slider reads its span as one label ("Under 10K") and commits after
  350 ms.

**Shows** (the block dims while type is Movies)

- Seasons: One season, 2 to 3, 4 to 7, 8+. Stops 1 to 8, 10, 15+.
- Status chips: Still running, Ended, Canceled.
- Time to finish: A weekend (under 10 h), A few weeks (10 to 30 h), A long haul (30 to 100 h), A real binge (100 h+).
  Stops 0, 5, 10, 20, 30, 50, 100, 200+.

**Budget** (the block dims while type is Shows)

- Budget: Indie (under $5M), Mid budget ($5M to $50M), Big ($50M to $100M), Blockbuster ($100M+). Stops: Any, $1M,
  $5M, $10M, $25M, $50M, $100M, $200M, $300M+.
- Box office: $100M+, $500M+, $1B+. Stops: Any, $1M, $10M, $50M, $100M, $250M, $500M, $1B, $2B+.
- Hit (made 3 times its budget) and Flop (made less than it cost).
- Each block's heading count says how many titles in the list have the fact known (see [No-data
  rule](#no-data-rule-for-budget-and-box-office)).

Look for Popularity, Shows and Budget: each group draws a glyph of its whole scale filled up to its step (a crowd of 1
to 4 figures, signal bars, $ to $$$$, coin stacks, an episode grid of 2/6/12/20 cells, a clock) in its own muted hue
(ratings blue, popularity rose, budget sage, box office gold, seasons violet, Hit warm, Flop steel) over one quiet
corner glow, stronger for bigger presets. Picked tiles fade in a light fill of their hue. Time to finish stays gray
(teal clock when picked); status chips stay gray with a colored mark when picked. Opacity and transform only.

**Made in**

- "Find a country" and "Any country" with its count; then three columns: Popular (US, GB, FR, JP, KR, DE, IT, ES, IN,
  CA, AU, SE, DK, MX, BR, CN), Film industries (Hollywood, Bollywood, Korean, Japanese, British, French, Nollywood,
  Hong Kong, Chinese, Spanish, Italian, Turkish, Nordic, Rest of the world), Regions (North America, Europe, Asia,
  Latin America, Middle East and Africa, Oceania).
- A set reads on when all its countries are picked; a partly picked region shows "N picked".
- Flags come from Settings' `countryFlagUrl`. One shared country chip and country finder serve Made in and Age.

**Released**

- New: This year, Last 2 years, Last 3 years (today's `recent` preset), Last 5 years, as tinted tiles with a count,
  "Since <year>" and a share bar. "Last N years" is always "since now minus N".
- After 2000 and After 1950 as picture chips with the top title's backdrop.
- A decade timeline from the 1920s to now: one column per decade as wide as its years, so the range slider under it
  lines up. Each column has the decade's top poster, a tinted bar (square root scale) with the real count. Tap picks
  a decade, a neighbor widens, an end narrows, the lone pick clears. Dragging across columns picks the span
  (capture after sideways movement, `touch-action: pan-y`, so phones still scroll).
- From and To fields, "Any year".

**Length**

- Two blocks, Movies and Episodes, each with its count, "Any", 4 tiles and a slider (0 to 240 min, step 5).
- Movies: Under 90 min, Under 2 h, Over 2 h, 3 h or more. Episodes: Under 25 min, Under 35 min, About 45 min (35 to
  55), An hour or more.
- The two ranges are independent: a movie range never limits episodes. A block dims when type excludes its kind.

**Age and content**

- "Ratings in" country chips (US, GB, DE, FR, IN, JP; phones 4; a picked other country takes the first place) and a
  "Find a country" field over the countries that have a ladder. Matches show in place of the ladder, nothing moves.
- The ladder: Off ("Every rating"), then one tile per step ("Up to", rating label, show rating, count).
- A free age: "Watching with a [−] 12 [+] year old" with a 0 to 18 slider marked at the steps, and the step it maps
  to on the right.
- OK to show: violence, sex, disturbing, language, drugs, each shown or hidden with "N hidden" and a changed mark,
  with Reset.

### You

One sub-tab, "Taste and lists", three columns (phones stacked):

- Your taste groups: rows with a fanned stack of the group's loved posters, its name, its word dots, a share bar of
  this list and a count; up to 3 picks (then other rows dim), "Clear". The last row, "In none of them", shows the
  titles that fit no group (a count, not a pick). Members with fewer than two groups see no rows.
- Taste match: 90%+, 80%+, 70%+, 60%+, Any, Outside your usual. Rows from the pick up are tinted amber; Outside your
  usual uses sky blue. Each row has a count and a share bar.
- Order: For you (`foryou`) and Best match first (`sort=match`).
- Your lists, in this order: Not seen yet, Seen before, On your wishlist. Each is a pill in `NotSeenSwitch`'s look at
  its small size, with a lock slot and a count of what the switch hides. Not seen yet and Seen before exclude each
  other; the wishlist combines with either.
- Guests: four skeleton group rows with "Sign up for your taste"; match rows disabled without counts; Order and Your
  lists locked (a lock in place of the icon, faint, no counts). Guest defaults keep applying on the server (Not seen
  yet for a guest with progress, For you on), and their chips stay removable in the footer and status line.

### Status line and panel footer

- Status line (40 px, under the bar, covered by the open panel): the count ("N titles", "N matches", "Counting…"),
  then removable chips that open the place that owns them (the query chip in amber with `ReadAsChips` inline, On my
  services and the picked services, Not seen yet, You choices, every other active filter), then "Clear all", and
  today's `SortControl` on the right ("Relevance joins once you search."). Chips scroll sideways under a fade.
- Panel footer (every tab and sub-tab, desktop 68 px; phones: chips over Clear all and Show):
  - The count: "N titles", "N matches", "Top 100 matches", "Counting…"; under it, always reserved, the hidden meter
    and "N hidden".
  - While the list has 40 titles or fewer, the two biggest recoveries in amber ("+ 49 below 80"; phones: the
    biggest); one tap drops that filter (Length drops both ranges).
  - Chips in order: query, steering ("more like X", "less like X", "like X" with a small poster), people ("with
    <name>" with a face), On my services, Not seen yet, You choices, every other filter, popularity, budget and show
    choices. One row, sideways scroll under a fade.
  - "Clear all N" (disabled "Clear all" at 0). It clears the query first, then every filter except On my services
    and Not seen yet, which stay as they do with today's sheet (`clearSecondaryFilters`). This is what the owner
    tested: the prototype footer calls `clearSecondary()`. Their chips stay and remove one at a time. For you and the
    sort stay too (they order, they don't filter).
  - The Show button: without a query today's `ShowTitlesButton` ("Show titles", "Show N titles", "No titles match");
    with one "Show matches", "Show top 100 matches", "Show N matches". It closes the panel.
- No chip shows twice on screen.

### Phone (390 px)

- Bar: Search on its own full-width row (62 px), then Mood, Watch, You on a 52 px row (columns 1fr 1fr 0.8fr).
- The panel is a `SnapSheet` at 0.94, labeled "Filters", with the four tabs (13 px labels). The tab header row sits in
  the sheet header under them: sub-tabs scroll sideways (the open one scrolled into view); a magnifier at the right
  opens Find over the sub-tabs (opacity and a 24 px slide, 0.16 s) with Cancel; Cancel or Escape on an empty field
  closes Find, not the sheet.
- On the Search tab, a 56 px search field with an amber outline heads the sheet body.
- The first screen shows the search entry and the first results.

### Production names

No "lab", "kit", "proto", variant letters or round numbers in code, URLs, cache keys, telemetry or copy.

| Prototype | Production |
|---|---|
| `lab/shell*.tsx`, `LabShell` | `app/ui/discover-bar/` (`DiscoverBar`, `DiscoverPanel`, `TabHeader`, `PanelFooter`, `StatusLine`) |
| `lab/layouts.ts` TABS, slots | `app/ui/discover-bar/tabs.ts` (tab model: sub-tabs, which state each counts, visibility) |
| `lab/header/*` | `app/ui/discover-bar/find/` and the pure parser `app/domain/discover-find.ts` |
| `sections/titles/g`, `people/c`, `taste/f`, `mood/k`, ... | `app/ui/discover-bar/search/TitlesTab.tsx`, `PeopleTab.tsx`, `mood/CombosTab.tsx`, `EverythingTab.tsx`, `watch/ServicesTab.tsx`, `ScoresTab.tsx`, `PopularityTab.tsx`, `ShowsTab.tsx`, `MadeInTab.tsx`, `ReleasedTab.tsx`, `LengthTab.tsx`, `BudgetTab.tsx`, `AgeTab.tsx`, `you/YouTab.tsx` |
| `more/store.ts` scales, `length/parts.ts`, `released/art.tsx` eras | `app/domain/title-scales.ts` (stops, presets, labels; shared by server, UI, Find and MCP) |
| `origin/parts.tsx` lists | `app/domain/film-industries.ts` |
| `mood/parts.tsx` MIXES | `app/domain/mood-mixes.ts` |
| "more" slots `reach`, `money`, `shows` | Filter groups `popularity`, `budget`, `shows` |
| `eruntime`, `anyof=`, `v-*`, `sec=`, `as=member` | `episodeRuntime=`, `all=`; the rest is not ported |

## Filter state additions

Every new choice is a `FilterState` field with a URL parameter. Defaults are omitted from URLs, as today. All
parameters are additive: a URL without them means what it means today.

| Choice | `FilterState` field | URL | Filter group (fail-mask bit) | Server source |
|---|---|---|---|---|
| All of / any of per tag group | `allOf?: TagGroup[]` | `all=moods,themes,styles,genres` | moods, themes, styles, genres (existing) | Snapshot masks |
| Five new moods (B2b) | `moods` (new keys) | `moods=tense,dark,deep,magical,quirky` | moods | Snapshot mask (computed at load) |
| Seen before | `seenBefore?: boolean` | `seen=1` | notSeenYet (shared, they exclude each other) | `ctx.seen` |
| On your wishlist | `onWishlist?: boolean` | `wishlist=1` | wishlist (new) | `ctx.wishlist` |
| Match 60%+ | `minMatch: 60` | `match=60` | minMatch | Taste matches |
| Outside your usual | `outsideUsual?: boolean` | `match=outside` | minMatch | Taste matches |
| Taste groups | `tasteGroups?: string[]` (group keys, at most 3) | `taste=movie-603,show-1399` | tasteGroups (new) | `memberSides` |
| Metacritic user score | `sourceScores.metacriticUsers` | `sources=metacriticUsers:70` | sourceScores | SQL set (`metacritic_user_score_normalized_percent`) |
| Rating country | `ratingCountry?: string` | `ratingCountry=DE` | none (changes the ladder) | Snapshot ratings |
| Episode length | `episodeRuntime?: FilterRange \| null` (null: no episode limit) | `episodeRuntime=20-45`, `episodeRuntime=any` | runtime (shared) | Facts, SQL fallback |
| Rest of the world | `restOfWorld?: boolean` | `restOfWorld=1` | productionCountries (any of, with the listed countries) | Facts, SQL fallback |
| Ratings count | `votes?: FilterRange` | `votes=10000-100000` | popularity (new) | Snapshot `votes` |
| Popularity rank | `popularityRank?: FilterRange` | `rank=1-1000` | popularity | Rank per snapshot version |
| Budget | `budget?: FilterRange` (USD millions) | `budget=-5`, `budget=100-` | budget (new) | Facts |
| Box office | `boxOffice?: FilterRange` (USD millions) | `boxOffice=1000-` | budget | Facts |
| Hit or flop | `returns?: "hit" \| "flop"` | `returns=hit` | budget | Facts |
| Seasons | `seasons?: FilterRange` | `seasons=4-7` | shows (new) | Facts |
| Show status | `showStatus?: ShowStatus[]` (`running`, `ended`, `canceled`) | `showStatus=running,ended` | shows | Facts |
| Time to finish | `hours?: FilterRange` | `hours=10-30` | shows | Facts (episodes × episode length) |

Parsing rules: ranges use today's `rangeFromParams` (empty, negative, reversed ranges ignored). `seen=1` turns Not
seen yet off; `unseen=1` with `seen=1` keeps `seen=1` (the later, more specific choice) and writes no `unseen`.
`match=outside` sets `outsideUsual` and `minMatch` 0. `taste` keeps at most 3 known-format keys (and the legacy size
numbers Watch next accepts). `all` keeps only known group names; a group in `all` with one pick behaves like any of.
`episodeRuntime` absent means `runtime` holds for both kinds, as today (old URLs and MCP keep their meaning).

When the UI writes `all`: each Everything column's switch is view state, on all of by default. The UI writes
`all=<group>` only once that group has two or more picks and its switch is on all of; it drops the group from `all`
when the picks fall below two or the switch goes to any of. A group with two or more picks and no `all` entry always
means any of, and its switch opens on any of. So links written elsewhere, such as Watch next's `moods=a,b` and MCP's
`page_url`, keep their any-of meaning; only picks made on Discover add `all`. A ready mix holds one tag from each of
two groups, so it writes no `all` (separate groups always combine as all of).

Every new field also goes into: `dropFilter` (per group), `clearSecondaryFilters`, `secondaryFilterCount`,
`stateAsApplied` where relevant, `discoverFilterKey` (the compiler enforces it), `activeChips` and `recoveryLabel`
(labels.ts), `FILTER_ACCENTS`, and `filter-state.test.ts` round trips.

## Gap table

"Today" is production at `origin/main`. Columns name what is missing; "Step" refers to [Step plan](#step-plan).

### Structure and UI

| Behavior | Today | Missing | Decision | Step |
|---|---|---|---|---|
| Four main tabs, value lines, badges, You end cap, guest lock | Filter bar with services, Not seen yet, For you, sort and a Filters sheet | All UI | Build | F1, F2, F8 |
| Shared tab header row, sub-tabs left, Find right | Sheet "Find a filter" (`FilterSearchField`, horror placeholder) | All UI | Build; new placeholder | F2 |
| Find across tabs with value parsing, More titles and people, handoffs | Sheet search lists matching options of every card | Parser, results UI | Build; parser in `domain/discover-find.ts` with a table test | F1, F7 |
| Static page title, search as a bar segment | `DiscoverHeading` merges the search into the heading | UI | Build | F8 |
| Status line with chips and sort | `FilterInsight` count line, chips in the bar | UI | Build on `activeChips`, `ReadAsChips`, `SortControl` | F2 |
| Panel footer: count, hidden meter, recoveries at 40 or fewer, chips, Clear all, Show | `CountLine`, `HiddenMeter`, `RecoveryList` (SubBar), `ShowTitlesButton` | UI composition | Build on those pieces | F2 |
| Clear all keeps On my services and Not seen yet (as tested) | `clearSecondaryFilters` keeps them | Every new field in `clearSecondaryFilters` | Keep today's rule | F2 |
| Phone: two-row bar, 0.94 sheet, header row in the sheet, magnifier Find | Slab, `PhoneFilterRow`, `SnapSheet` | UI | Build on `SnapSheet` | F2 |
| "/" opens Search; Escape rules | None | UI | Build | F2 |
| Titles: idle Try and Popular titles; typing preview; running "In these results"; steering thumbs and Like this | `TitlePicker` in the sheet (Similar to, Loved, Disliked) | Popular titles (server), UI | Build | B9a, F3 |
| Type block with anime and live counts, hidden while stale | Type card in the sheet | `countsFresh` flag in the UI | Build | F3 |
| Cast and crew: Find a person, Actors and Behind the camera columns, featured, in these results | `PeoplePicker` (8 matches) | Featured people and people in results (server), UI | Build | B9b, F3 |
| Mood Combos: ready mixes with counts and top title, "+ X" cards | Popular filter tiles | Mix definitions, mix counts and top titles (server), all-of counts, UI | Build | B1, B9a, F4 |
| Mood Everything: four columns, all of / any of switch per group | Mood, About, Style, Genre cards (any of) | All-of mode (state, URL, passes, counts), UI | Build | B1, F4 |
| Mood names (Cozy, Sad, Thrilling, Trippy, Romantic) on Discover | Feel-good, Heavy, Action, Mind-bending, Romance | New names everywhere, old names as aliases; keys and rules unchanged | Build (owner, 2026-10-29) | B2a |
| Mood names on other surfaces (Watch next, TV, start page, MCP, Discord) | Today's names | The new names everywhere, old names as aliases | Build (owner, 2026-10-29) | B2a |
| Tense, Dark, Deep, Magical, Quirky | Not filters; the prototype appended the word to `q` | Five `MOOD_KEYS` with fixed fingerprint rules | Build (owner, 2026-10-29) | B2b |
| Topic moods (Crime & mystery, Other worlds, History, Coming of age) | Moods | Not in the Feel column; still parsed and shown as chips | Hide in Feel only; themes cover them | B2a, F4 |
| Services rail and wall, 18 tiles, "+N more" to 120 | Streaming card; counts for the top 60 services | `MAX_SERVICE_OPTIONS` 60 to 120 | Build | B5, F5 |
| Scores: shared scale, source icons, Metacritic user score | Score, sources (any 0 to 100), gap | `metacriticUsers` source key, shared step constants | Build | B5, F5 |
| Source and gap steps without counts | No counts for SQL sets | None | Keep without counts (as the prototype) | none |
| Popularity: ratings count and rank presets and sliders with counts | None | Fields, URL, group bit, rank per version, per-stop counts, recoveries, MCP, UI | Build | B8, F9 |
| Budget: budget, box office, Hit, Flop with counts | None | Facts sidecar, fields, URL, group bit, counts, no-data rule, MCP, UI | Build | B10, B11, B13, F10 |
| Shows: seasons, status, time to finish with counts | None | Facts sidecar, fields, URL, group bit, counts, MCP, UI | Build | B10, B11, B14, F10 |
| Made in: Popular, industries, regions, Rest of the world, counts on every option | Production countries (any of), counts only for chosen ones | `restOfWorld`, domain lists, per-country and per-set counts (facts) | Build | B7, B12, F5 |
| Released: New tiles, After chips, decade timeline with counts and posters, drag, fields | Released presets with counts, `years` (SQL, no counts) | Per-year counts and per-decade top titles (facts) | Build | B12, F5 |
| Length: two independent ranges, tile counts | One `runtime` for both kinds (SQL, no counts) | `episodeRuntime`, per-bucket counts per kind (facts) | Build | B7, B12, F5 |
| Age: ratings country switcher, free age, OK to show | Ladder follows the viewing country (`streamingCountry` overrides it) | `ratingCountry`, ladder countries in the response | Build | B6, F5 |
| You: taste groups with posters, share and counts | `side=<id>` (one side, only while For you is on, browse only) | `taste=` keys on Discover (any of, up to 3), group descriptors and counts | Build | B4, F6 |
| You: match 60%+, Outside your usual | `match` 0, 70, 80, 90 | 60 in `MIN_MATCHES`, `outside` | Build | B3, F6 |
| You: Seen before, On your wishlist | Not seen yet only | Fields, URL, group bit (wishlist), counts, guest cache key (wishlist size) | Build | B3, F6 |
| Your lists' hide counts | `notSeenYet` on/off counts | `seen` and `wishlist` counts | Build | B3 |
| Sides of you rows | Live | Unchanged; `side=` stays | Keep | none |

### Prototype shortcuts

| Shortcut | Production approach | Decision | Step |
|---|---|---|---|
| Simulated counts for popularity, budget and shows (share tables × type counts, zero requests) | Per-stop counts from the same pass that filters, in `optionCounts` | Build | B8, B13, B14 |
| Client-side AND by inclusion-exclusion (2^N results calls, up to 128) and the AND list read 400 at a time | All-of mode in the fail mask, option counts under AND, the list straight from the filter | Build | B1 |
| `eruntime` and two requests per page merged by score or year | `episodeRuntime` in the same runtime group; one request, exact order | Build | B7 |
| Metacritic user score in a memory store that doesn't narrow | `metacriticUsers` source key over `metacritic_user_score_normalized_percent` | Build | B5 |
| 294-person hardcoded pool counted with about 25 results calls per search | One server read: credits of the list's first 100 titles grouped by person and role | Build | B9b |
| Hand-picked featured people (`FEATURED_IDS`) | The people list cohort (`getListPeople`, sitemap order, departments) | Build | B9b |
| Hand-picked Popular titles (Parasite, Breaking Bad, ...) | Server pick per snapshot version: the most popular well-rated title per far-apart bucket (see [Starter titles](#starter-titles)) | Build | B9a |
| `MATCH_SHARE`, 60% as a lab flag, Outside your usual simulated | Real match filter steps and counts | Build | B3 |
| Wishlist and Seen before as lab flags, counts total minus 38 or 214 | In-memory sets from `ctx.wishlist` and `ctx.seen` | Build | B3 |
| Four simulated taste groups with fixed posters and shares | The member's groups from `memberSides`, stable `taste=` keys, real counts | Build | B4 |
| Several taste groups (`side=` takes one) | `taste=` list, any of | Build | B4 |
| Rest of the world as a long include list of every other code | `restOfWorld=1`: at least one production country outside the eight big industries | Build | B7 |
| Age switcher writes `streamingCountry` (moves services too) | `ratingCountry`, independent of the streaming country | Build | B6 |
| 48 ladder countries hardcoded | `ratings.countries` from the snapshot, sent with the ladder | Build | B6 |
| Per-tile and per-group results calls (Released 26, Made in 37, Length 10, mixes 8) | One results response carries every count; one panel request carries pictures | Build | B9a, B12 |
| Member services hardcoded (Netflix, Prime Video, Disney Plus) | The viewer's saved services | Build | F5 |
| Member mixes written by hand | Mixes from the member's taste groups' carried words | Build | B9a |
| Mood names relabeled only in the lab (`tagName`) | New `name`s in `domain/moods.ts` (keys unchanged) | Build | B2a |
| Search moods appended to `q` | Real moods | Build | B2b |
| Explorer pictures for tag art (`/api/explorer/world` as a guest) | The same endpoint, as the viewer, cached as today | Keep | F4 |
| Five-pick AND cap (query cost) | Not needed; per-group caps of 3 stay | Drop the cap | B1 |
| Find's score steps from today's sheet (IMDb 6.5, ...) disagree with the Scores tab | One scale constant for both | Build | F1 |
| Eligibility hardcoded to US in previews | The viewer's country and services | Build | F3 |
| Everything goes through a guest proxy; writes refused | Real viewer, real writes where they exist | n/a | n/a |
| Batched counts kept by `placeholderData` | Same hook behavior, plus `countsFresh` | Build | F2 |

### Cuts

Two cuts, both small:

- **Taste groups in MCP.** Group keys are not exposed through any MCP tool today, and a group's name and members are
  private taste data that `get_taste` would have to describe first. The web filter ships; an MCP argument can follow
  once `get_taste` returns group keys.
- **"In none of them" as a pick.** The prototype shows it as a count row, not a pick. It stays a count. `side=none`
  keeps working for Sides of you.

Everything else in the prototype ships with real data.

### No-data rule for budget and box office

TMDB stores 0 for an unknown budget or box office, and some entries are typos (a budget of 1 meaning $1M). Coverage is
sparse outside US studio films.

- A budget or box office under $10,000 is unknown. The publisher writes 0 for unknown.
- Any budget, box office or Hit/Flop choice keeps only movies whose fact is known. A movie without it fails that
  choice, as a title without a score fails a score choice today. Hit and Flop need both facts.
- These are movie facts: a show fails every budget choice. Seasons, status and time to finish are show facts: a movie
  fails every show choice. So a budget choice narrows the list to movies, and the type block's Shows count reads 0.
- Each block's heading shows its base: "N of M movies here have a budget" (and the same for box office), so a sparse
  fact never looks like a broken filter. The recovery chip ("+ 1,882") says what the choice hides.
- Amounts are nominal US dollars as TMDB reports them, with no inflation adjustment. Hit means box office at least
  three times the budget; Flop means box office below the budget.
- The same rule applies to time to finish (unknown without both the episode count and the episode length) and to
  show status (unknown without a TMDB status).

## Server design

### Fail-mask budget

Each filter group is one bit of a 32-bit fail mask (`passes.server.ts`, throws above 32; `passes.test.ts` pins the
list). Today there are 23. Related choices share a group, the way they share a sub-tab and a recovery:

| New group | Holds | Recovery drops |
|---|---|---|
| `popularity` | `votes`, `popularityRank` | Both |
| `budget` | `budget`, `boxOffice`, `returns` | All three |
| `shows` | `seasons`, `showStatus`, `hours` | All three |
| `wishlist` | `onWishlist` | It |
| `tasteGroups` | `tasteGroups` | It |

Shared without a new bit: `seenBefore` (notSeenYet), `episodeRuntime` (runtime), `restOfWorld` (productionCountries),
`outsideUsual` and 60 (minMatch), `metacriticUsers` (sourceScores).

That makes 28 groups, leaving 4. Appending keeps existing bit positions. In a shared group, each sub-choice's option
counts are taken over the titles every other group lets through and that pass the group's other sub-choices, tested
directly in the counting loop.

### All of and any of

- `allOf` lists the tag groups whose picks must all match: `(mask[row] & chosen) === chosen` instead of `!== 0`.
- Option counts for an all-of group, from the existing combination table (moods 11 bits today, themes 14, styles 10:
  one array of titles per bit combination over the titles every other group lets through): an unpicked option counts the
  combinations that hold every pick and that option; a picked option counts the combinations that hold every other
  pick. Genres (more than 16) use the per-title loop: a title with every pick adds to each other option it has; a
  title missing exactly one pick adds to that pick's removal count.
- Recoveries are unchanged (the group as a whole).
- B2a adds no moods, so the mood mask and table stay as they are. If B2b adds the five moods, the mask reaches 16
  bits: widen `moods` (and `moodMasks`) from `Uint16Array` to `Uint32Array` in `snapshot.server.ts` in the same
  change, so a seventeenth mood can't overflow silently (`bitGroup` already takes `Uint16Array | Uint32Array`). The
  combination table in `passes.server.ts` (`new Uint32Array(1 << names.length)`) is used while a group has 16 options
  or fewer: 16 moods make it 65,536 entries (256 KB) per request, reused per call. Past 16 options the group takes the
  per-title loop that genres use today. Measure both in B2b.

### Facts sidecar

A second optional sidecar next to the ratings sidecar, same pattern: `manifest.facts` (format, chunk count, SHA-256,
the country table) and chunks at `title-snapshot:<version>:facts:<n>`. A webapp that predates it ignores it; a
snapshot without it (or with a refused one) loads without facts, and the filters that need facts fall back (years
and runtime use today's SQL sets, Made in loses its counts) or hide (Budget and Shows sub-tabs, like Age without a
ladder).

Columns, one value per title in the snapshot's row order:

| Column | Type | Value |
|---|---|---|
| release year | uint16 | `release_year` (the column today's `years` SQL set reads); 0 unknown |
| length | uint16 | minutes: `runtime` (movie), `episode_runtime[1]` (show); 0 unknown |
| budget | uint32 | USD thousands; 0 unknown (under $10,000 written as 0) |
| box office | uint32 | `revenue`, USD thousands; 0 unknown |
| seasons | uint8 | `number_of_seasons`, capped at 254; 0 unknown |
| episodes | uint16 | `number_of_episodes`; 0 unknown |
| show status | uint8 | 0 unknown, 1 running (Returning Series, In Production), 2 ended, 3 canceled |
| production countries | uint8 × 4 | indexes into `facts.countries` (sorted), 255 none; the first four listed |

Format 1 is exactly 20 bytes per title, little-endian, with no padding between columns. For N titles, the
column byte offsets are: release year 0, length 2N, budget 4N, box office 8N, seasons 12N, episodes 13N,
status 15N, then country slots 0 to 3 at 16N, 17N, 18N and 19N. Each slot is a full column, not four
interleaved bytes per title. Decoders must account for unaligned multi-byte columns when N is odd.
Money is floored to whole USD thousands after applying the $10,000 threshold. Other numeric facts use 0
for missing, nonpositive or nonfinite values and saturate at their type's maximum (seasons at 254).
Movies have zero seasons, episodes and status; shows have zero budget and box office. Country codes are
normalized to uppercase two-letter codes and deduplicated in source order before taking the first four.
The sorted country table includes all valid countries of snapshot titles, including countries beyond the
four slots; at most 255 entries, with index 255 reserved for no country.

The publisher's change mark (`source_mark`) stores, per table, count and sum of `dna_updated_at` followed
by count and sum of `tmdb_details_updated_at`, plus the ratings and facts format versions. The previous
analysis-only mark did not cover season or status changes. The TMDB details copy writes the details timestamp
alongside seasons, episodes, status and the other facts, so its aggregate triggers a nightly publish even
without a new analysis. Direct edits that bypass that copy must also update the details timestamp.

Release year is stored although the snapshot already has `release day`: for shows, `release day` is the last air
date (the publisher reads `last_air_date`, so Newest orders by it), while Released filters by `release_year`, the
first air year. A show that ran from 2008 to 2019 belongs to 2008 in Released, so the facts path must read the same
year as the SQL path.

Production countries: one rule. The `productionCountries` filter (and `restOfWorld`) keeps today's SQL set for
pass/fail, with or without facts; the sidecar's country slots feed only Made in's counts. Reasons: the SQL set is
exact for every title and already cached, while the slots hold only the first four countries; a per-title bitset
over every country would cost about 32 bytes per title, more than the rest of the sidecar together, for a filter
that already works. The cost is that a title with more than four countries is missing from the counts of its fifth
and later countries. Measure how many titles that affects in B10 and record it; if it is above 1% of the catalog,
widen the slots to six in B10 before B12 ships. The publisher logs the affected count, catalog size and
percentage on each facts build. B10 unit tests verify this log; the production measurement and 1% decision
remain a deployment check (no database or Windmill access during implementation).

### Counts

Every count comes from the one `/api/discover/results` response in `optionCounts`, computed in the same pass:

| Group | Keys |
|---|---|
| `popularity` | `votes:<stop index>` and `rank:<stop index>`: titles per bucket between neighboring stops (`title-scales.ts`) |
| `budget` | `budget:<i>`, `boxOffice:<i>` per bucket; `returns:hit`, `returns:flop`; `known:budget`, `known:boxOffice` |
| `shows` | `seasons:<i>`, `hours:<i>` per bucket; `status:running`, `status:ended`, `status:canceled` |
| `years` | `<year>`: titles per release year (facts) |
| `runtime` | `movie:<5 min bucket>` and `episode:<5 min bucket>` up to 240, plus `movie:unknown`, `episode:unknown` |
| `productionCountries` | `<code>` per country with titles, `set:<industry or region id>` per set (distinct titles), `world`; from the facts slots (first four countries per title) |
| `notSeenYet` | `on`, `off`, `seen` |
| `wishlist` | `on`, `off` |
| `minMatch` | `0`, `60`, `70`, `80`, `90`, `outside` |
| `tasteGroups` | `<group key>` per group, `none` |
| moods, themes, styles, genres | As today, following each group's mode |

The UI sums buckets for any span of a stepped slider, so presets, slider labels and Find values all count from the same
numbers. Released's decade bars and New tiles sum years; Length's tiles sum buckets.

### Panel endpoint

`GET|POST /api/discover/panel?<filter query>&part=<part>` (`app/routes/api.discover_.panel.ts`, same viewer handling
as the results route, guests POST their progress). It runs the same `filterTitles` (guest results come from the
shared filter cache) and returns pictures and lists the counts can't carry. One request when a sub-tab that needs it
opens. Whichever of B9a, B9b, B9c and B12 merges first adds the route and `app/server/discover-panel.server.ts`; the
others add their part, so none of them waits on another.

| Part | Returns | Cache | Step |
|---|---|---|---|
| `mixes` | The viewer's ready mixes (id, tags, all-of count with every non-tag filter as set, top title card) | Per request; title cards as today | B9a |
| `released` | Top title card per decade and per New and After preset, in the list's order | Per request | B12 |
| `people` | Featured people (no search) or people in these results (search running): actors and behind the camera, with counts | People in results: Redis 30 min per sorted key list hash, `discover-people:v1:<hash>`; featured: per deploy | B9b |
| `titles` | Starter titles (no text) | Per snapshot version, in process | B9a |
| `taste` | The member's taste groups: key, name, number (hue), word dots, loved posters | `memberSides` cache (10 min) | B9c |

### People in these results

Two Crate reads over the list's first 100 titles (the whole list while searching), per kind:
`SELECT person_tmdb_id, COUNT(*) FROM person_appeared_in WHERE media_type = ? AND media_tmdb_id IN (...) AND
order_default < 15 GROUP BY person_tmdb_id ORDER BY 2 DESC LIMIT 30`, and the same over `person_worked_on` grouped by
person and job for Director, Writer (Screenplay, Writer, Novel), Original Music Composer and Director of Photography.
Then one `person` read for names and faces (`adult = false`). Ids are parsed positive integers (safe literals, as in
`legacyTitles`). The two in-results notes ("12 titles", "Director · 20") come from these counts.

### Starter titles

Twelve titles per snapshot version: walk the catalog's Popular order over titles with a GoodWatch score of 75 or more
and 100,000 votes or more, and take a title when its bucket (kind, first production region, first mood) is not taken
yet, alternating movies and shows; stop at 12. Not personal, so it is the same for every viewer (seen titles can show,
like the start page's shelf).

### Mixes

- Guest mixes: a constant list in `domain/mood-mixes.ts` (the eight above).
- Member mixes: for each taste group (largest first), the mood and the theme or style it carries most
  (`taste-picker-counts.ts`, the same rule that colors the group on Watch next). Mixes that repeat a tag pair are
  dropped. Filled up with guest mixes to 8.
- Count: titles passing every group but moods, themes and styles, with both tags (a mix replaces those picks; genres
  stay).

### Taste groups on Discover

- `taste=<key>` uses Watch next's stable keys (`domain/taste-picker.ts`: the loved title closest to the group's
  center) through `tasteGroupsFor`, so a link keeps its group when groups change size or order.
- Narrowing works in browse and search, with any sort and For you on or off, for members with two groups or more.
  For guests and members without groups the parameter doesn't narrow (like `match` without taste).
- Counts per group need each title's group: `sideOf` fills the member's per-row cache lazily. Compute it for the
  passing titles only, and only when the request asks for taste counts (`counts=taste`, sent while You is open) or
  `taste` is set.
- `side=` keeps working as today for the Sides rows' "More like this".

### Rating country

`ratingCountry` picks the ladder (`ladderFor`) and the ages the age filter reads. Default: `streamingCountry`, else
the viewer's country (today's behavior). The response's `ladder` gains `countries` (the snapshot ratings' countries)
for the country finder. Title cards' rating badges follow the same ladder.

### Popularity rank

The rank is the title's place in the catalog's Popular order (eligible titles, both kinds), 1 first, computed once per
snapshot version next to `catalogRows` (an Int32 per row). It is the same for every viewer and filter. It drifts daily
with TMDB popularity.

## Step plan

Each step merges to main on its own and leaves Discover working. Backend steps add parameters that live Discover
already shows as chips and recoveries (labels and `activeChips` land with each one), so a link from MCP or a shared URL
with a new parameter reads correctly before the new UI exists. Frontend steps F2 to F7 build on the development
harness route; F8 swaps the page. Per the orchestration notes, backend steps run through Codex and UI steps through
Opus.

Critical path: F1, then F2; then F3, F4 and F6 in parallel, each as soon as its backend steps land (F3 on B9a and
B9b, F4 on B1, B2a and B9a, F6 on B3, B4 and B9c), with F5 alongside; then F7, then F8. B10, B11 and B12 run from day
one in parallel with everything else, because F8 waits on B12. F9 and F10 follow F8. B16 and the other backend steps
without dependencies can merge at any time; B2b follows B2a.

Checks every step runs, from `goodwatch-webapp`: `npm test`, `npm run typecheck` (no new diagnostics over the
baseline), Biome. Page checks use an isolated local setup (no production `.env`, see
[Risks and checks](#risks-and-checks)), at 1440 px and 390 px, as a guest and as a member.

### Backend

**B1. Tag groups: all of and any of**

- Files: `app/domain/filter-state.ts`, `app/server/title-filter/passes.server.ts`, `index.server.ts`,
  `app/server/discover-filter-cache.server.ts`, `app/ui/filter-bar/labels.ts` (chips read "Funny and Cozy" for all
  of), `app/server/mcp/discover-filters.ts` (`match_all`: array of `moods`, `themes`, `styles`, `genres`),
  `tools.server.ts` descriptions, `docs/implementation/mcp-discover-tools.md`.
- Tests: `filter-state.test.ts` (round trip, old URLs stay any of, unknown groups dropped); `passes.test.ts` (all-of
  masks and option counts against a brute-force count over a generated universe, genres path included);
  `discover-filters.test.ts` (codec and cache key cover `match_all`).
- Acceptance: `/discover?moods=funny,feelgood&all=moods` shows fewer titles than without `all`; the count equals the
  brute-force intersection on the sample snapshot. `/discover?moods=funny,feelgood` (no `all`, as Watch next and MCP
  `page_url` write it) returns exactly today's titles. A unit test of the URL writer covers the write rule in [Filter
  state additions](#filter-state-additions): one pick writes no `all`; a second pick with the switch on all of writes
  `all=moods`; switching to any of, or removing a pick down to one, drops it.
- Depends on: nothing.

**B2a. Mood names everywhere**

- Files: `app/domain/moods.ts`: `name` becomes Cozy (`feelgood`), Romantic (`romance`), Thrilling (`action`), Sad
  (`heavy`) and Trippy (`mind`), with the old names as `aliases` (Feel-good, Romance, Action, Heavy, Mind-bending) for
  search and Find; a `feel` flag leaves `crime`, `worlds`, `history` and `growing` out of Discover's Feel column. Every
  surface that shows mood names follows: Discover chips (`labels.ts`), Watch next's taste picker, TV `tv-discover`,
  the start page, MCP tool descriptions, Discord copy, OG cards or share images that print mood names. Check cache
  keys or version strings that embed mood names and bump them where a stale name could show.
- No key or rule changes: keys stay, so every existing URL keeps working. Thrilling keeps Action's rule (adrenaline 8
  or more and spectacle 7 or more), not the explorer's Thrilling island (`islands.server.ts` around line 91); the two
  Thrilling counts differ, which is accepted.
- Tests: `labels.test.ts`; surface tests that assert mood names (`tv-discover.test.ts`, Discord
  `guest-commands.test.ts`, Watch next picker tests); Find alias cases in `discover-find.test.ts` (F1) once both
  exist.
- Acceptance: every surface reads the new names; old-name searches still find the moods; `moods=feelgood` URLs work.
- Depends on: nothing. Update `CONTEXT.md`'s Mood entry in the same change.

**B2b. Five new moods**

- New moods: keys `tense`, `dark`, `deep`, `magical`, `quirky` appended with fixed rules taken from
  `islands.server.ts`, so bit positions of the existing 11 stay; widen `moods` and `moodMasks` in
  `snapshot.server.ts` from `Uint16Array` to `Uint32Array` (see [All of and any of](#all-of-and-any-of) for the
  combination-table cutoff); MCP enum (automatic). They appear on every surface that lists moods as filters
  (Discover, Watch next's picker, MCP, search mood words). Fixed visual grids (TV `tv-discover`, start page
  `FirstSteps`, Discord deck) add them where the layout scrolls or wraps; where a grid has a fixed slot count, keep its
  set through an explicit list and record which ones in this section.
- Tests: moods rules on fingerprint fixtures; `tv-discover.test.ts`, Discord `guest-commands.test.ts`; Watch next
  picker counts test; a `passes.test.ts` bench for the 65,536-entry table.
- Acceptance: `/discover?moods=quirky` narrows; Server-Timing `results` stays within the budget in [Risks and
  checks](#risks-and-checks).
- Depends on: B2a. Owner approved 2026-10-29.

**B3. Your lists and taste match steps**

- Files: `filter-state.ts` (`seenBefore`, `onWishlist`, `outsideUsual`, 60 in `MIN_MATCHES`), `passes.server.ts`
  (wishlist group, seen-before rule on the notSeenYet bit, outside rule: a match from 50 to 59), `index.server.ts`,
  `discover-filter-cache.server.ts` (no shared key when `wishlist.size` > 0), `labels.ts` (`MATCH_LABELS` 60, chips),
  MCP (`seen_only`, `wishlist_only`, `minimum_match: 60`, `outside_usual`).
- Tests: `filter-state.test.ts` (`MIN_MATCHES` assertion, exclusivity of `seen` and `unseen`), `labels.test.ts`,
  `passes.test.ts` (counts `seen`, wishlist on/off, outside), `discover-filters.test.ts`.
- Acceptance: a member's `/discover?wishlist=1` lists exactly their Wishlist titles that Discover holds;
  `seen=1&wishlist=1` lists rewatch picks.
- Depends on: nothing.

**B4. Taste groups on Discover**

- Files: `filter-state.ts` (`tasteGroups`, `taste=`), `discover-results.server.ts` (resolve keys through
  `tasteGroupsFor`; counts on request), `passes.server.ts` (a per-row group array for the universe, any-of over the
  picks, counts per group and `none`), `labels.ts` (chip with the group's name; the name comes with the response).
- Tests: a pure test with a stub `sideOf` in `passes.test.ts`; key parsing in `filter-state.test.ts`; a member
  integration check against `side=` for one group (same titles).
- Acceptance: `/discover?taste=<key>` with For you off narrows to that group; a guest URL with `taste=` doesn't narrow.
  Measure the first uncached request for the largest member history (`Server-Timing`).
- Depends on: nothing.

**B5. Scores: Metacritic user score and the shared scale**

- Files: `filter-state.ts` (`metacriticUsers` in `SOURCE_KEYS`), `range-score-conditions.server.ts`
  (`metacritic_user_score_normalized_percent`), `app/domain/title-scales.ts` (new: `SCORE_STEPS = [60, 70, 80, 90]`
  and how each source writes them), `labels.ts`, `passes.server.ts` (`MAX_SERVICE_OPTIONS` 120), MCP (automatic
  through `SOURCE_KEYS`; update the description and doc table).
- Tests: `range-score-conditions.test.ts`, `filter-state.test.ts`, `discover-filters.test.ts`.
- Acceptance: measure the service count loop at 60 and at 120 services (bench over the sample snapshot, then
  Server-Timing `results` for a member on the full catalog) and record both; the step to 120 fits within the budget in
  [Risks and checks](#risks-and-checks), else counts past the top 60 come only while "+N more" is open.
- Depends on: nothing.

**B6. Rating country**

- Files: `filter-state.ts` (`ratingCountry`), `title-filter/index.server.ts` (ladder by `ratingCountry`, then
  `streamingCountry`, then the viewer), `viewerLadder` callers, `discover-results.server.ts` (cards' ladder),
  `FilterResult.ladder` (`countries`), MCP (`rating_country`).
- Tests: `passes.test.ts` (ages by the chosen country), `filter-state.test.ts`.
- Acceptance: `/discover?age=12&ratingCountry=DE` uses the FSK ladder while services stay in the viewer's country.
- Depends on: nothing.

**B7. Episode length and Rest of the world**

- Files: `filter-state.ts` (`episodeRuntime`, `restOfWorld`), `range-score-conditions.server.ts` (show predicate uses
  `episodeRuntime` when present, `null` means none), `id-sets.server.ts` (a cached set of titles with a production
  country outside the big eight: one read of `tmdb_id, production_country_codes` per kind, filtered in process),
  `app/domain/film-industries.ts` (new: Popular, industries, regions, the big eight), `passes.server.ts`
  (`restOfWorld` joins the productionCountries any-of), `labels.ts` ("Movies under 2 h", "Episodes under 35 min",
  "Rest of the world"), MCP (`min_episode_runtime`, `max_episode_runtime`, `rest_of_world`).
- Tests: `range-score-conditions.test.ts` (old `runtime` alone still covers both kinds), `filter-state.test.ts`,
  `discover-filters.test.ts`.
- Depends on: nothing.

**B8. Popularity group**

- Files: `filter-state.ts` (`votes`, `popularityRank`, group `popularity` appended to `FILTER_NAMES`),
  `order.server.ts` (rank per snapshot version), `passes.server.ts` (range checks on `votes` and rank, per-stop
  counts), `title-scales.ts` (votes and rank stops and presets), `labels.ts` (chips "Under 10K ratings", "Top 1,000";
  recovery; accent), `filter-cards.ts` (exclude the new name from `CardKey`, the old sheet doesn't offer it), MCP
  (`min_votes`, `max_votes`, `max_popularity_rank`, `min_popularity_rank`; `validDiscoverRanges`).
- Tests: `passes.test.ts` (update the pinned list, counts against brute force), `labels.test.ts`,
  `discover-filters.test.ts`, `scripts/mcp-discover/local.integration.ts` cases.
- Depends on: nothing (snapshot columns exist).

The panel endpoint comes in three steps, one per tab that needs it. The first to merge adds the route (see [Panel
endpoint](#panel-endpoint)). Each part answers with p95 under 150 ms warm (Server-Timing).

**B9a. Panel: mixes and starter titles (for F3 and F4)**

- Files: `app/routes/api.discover_.panel.ts`, `app/server/discover-panel.server.ts` (`mixes`, `titles`),
  `app/domain/mood-mixes.ts`, `app/server/watch-next-taste-picker.server.ts` (export what member mixes need).
- Tests: mix counts against `/api/discover/results` for the same picks (unit over a stub snapshot); starter titles
  deterministic per version; no two starter titles share a bucket (kind, first region, first mood), and kinds
  alternate.
- Acceptance: on a production-sized snapshot, record the 12 starter titles with their kind, region and first mood;
  they are 6 movies and 6 shows and span at least three regions and four moods. If not, adjust the bucket rule before
  F3 ships.
- Depends on: B1 (mix counts under all of).

**B9b. Panel: people in these results (for F3 Cast and crew)**

- Files: `app/server/discover-people.server.ts`, the `people` part in `discover-panel.server.ts`.
- Tests: people in results SQL built with literal ids only (unit), grouped counts on a fixture, featured people from
  `getListPeople`.
- Acceptance: `people` while searching "heist" returns counts; a second identical request hits
  `discover-people:v1:<hash>`.
- Depends on: nothing.

**B9c. Panel: taste-group pictures (for F6)**

- Files: the `taste` part in `discover-panel.server.ts` (key, name, number, word dots, loved posters from
  `memberSides`).
- Tests: a stub `memberSides` with two and with one group (no rows for fewer than two); a guest gets an empty part.
- Depends on: B4 (taste keys and counts).

**B10. Facts sidecar in the snapshot publisher**

- Files: `goodwatch-flows/windmill/f/sync/copy/title_snapshot.py` (read, encode, write, prune, mark),
  `goodwatch-flows/tests/test_title_snapshot.py`.
- Tests: encoding against the webapp decoder (the existing byte test pattern), the no-data rules (budget under
  $10,000 is 0), country table, mark changes when a season count changes, a failed facts read still publishes the
  snapshot without `facts`.
- Acceptance: deploy the script through Windmill, force one publish, check the manifest has `facts` and the chunk
  count; record how many titles list more than four production countries (see [Facts sidecar](#facts-sidecar) for
  the 1% rule).
- Depends on: nothing. Start it on day one: B10, B11 and B12 are the longest backend chain, and F8 waits on B12.

- Measured 2026-10-29 (read-only preview job): 721 of 171,484 analysed movies (0.42%) and 144 of 89,046 analysed
  shows (0.16%) list more than four production countries, so four slots stay. Show statuses: Ended 61,074, Returning
  Series 23,446, Canceled 4,071, In Production 340, Pilot 70, Planned 45 (Pilot and Planned store 0, unknown).

**B11. Facts decoder in the webapp**

- Files: `app/server/title-snapshot/format.server.ts` (decode and verify), `snapshot.server.ts` (`TitleFactColumns | null`
  with views), `prepare.server.ts`, `scripts/write-title-snapshot.ts` (sample facts), `prepare.test.ts`.
- Tests: decode, checksum refusal, a snapshot without facts loads with `facts: null`.
- Acceptance: no behavior change; memory after load grows by about 20 bytes per title.
- Depends on: B10 (format agreed; can merge before the publisher deploys, since facts are optional).

**B12. Years, length and Made in from facts, with counts**

- Files: `title-filter/index.server.ts` (with facts, years and runtime test the facts; without, today's SQL sets;
  production countries keep the SQL set for pass/fail either way), `passes.server.ts` (per-year and
  per-length-bucket counts, and per-country and per-set counts from the facts slots and `film-industries.ts`),
  `discover-panel.server.ts` (`released` part).
- Tests: parity between the facts path and the SQL path for years and runtime over the sample snapshot (same keys
  for a set of states); counts against brute force.
- Acceptance: `/api/discover/results` carries `optionCounts.years`, `runtime` and `productionCountries` buckets;
  Server-Timing `results` stays within the budget in [Risks and checks](#risks-and-checks).
- Depends on: B7, B11. F8 depends on it: the owner picked Released, Length and Made in for their counts and decade
  bars, so the swap doesn't ship them without numbers.

**B13. Budget group**

- Files: `filter-state.ts` (`budget`, `boxOffice`, `returns`, group `budget`), `passes.server.ts` (no-data rule,
  per-stop counts, known counts), `title-scales.ts`, `labels.ts`, `filter-cards.ts`, MCP (`min_budget_musd`,
  `max_budget_musd`, `min_box_office_musd`, `max_box_office_musd`, `returns`; descriptions say these keep movies with a
  known amount only).
- Tests: `passes.test.ts` (unknown fails, shows fail, Hit and Flop need both), `discover-filters.test.ts`.
- Depends on: B11. Without facts the parameters don't narrow and the response says `facts: false`.

**B14. Shows group**

- Files: `filter-state.ts` (`seasons`, `showStatus`, `hours`, group `shows`), `passes.server.ts`, `title-scales.ts`,
  `labels.ts`, `filter-cards.ts`, MCP (`min_seasons`, `max_seasons`, `show_status`, `min_hours`, `max_hours`).
- Tests: as B13.
- Depends on: B11.

**B15. MCP discovery metadata**

- Files: `app/server/mcp/discover.server.ts` (`get_discover_filters` adds the scales and presets from
  `title-scales.ts`, the film industries and regions, and the mood names), `tools.server.ts`,
  `docs/implementation/mcp-discover-tools.md`, `scripts/mcp-discover/local.integration.ts`.
- Tests: `bash scripts/mcp-discover/run.sh`, `npm run test:auth:mcp`.
- Depends on: B1 to B14 (or run after each, as their MCP arguments land). Mood names in MCP change with B2a; B2b adds keys.

**B16. Discover type paths**

- Files: `app/routes/discover.($type).tsx`: map `movies`, `movie`, `shows` and `show` to their type.
  `/discover/shows` and `/discover/movie` lose their type today and land on plain `/discover`.
- Tests: a loader test per path (the four map to their type, unknown paths keep today's redirect).
- Acceptance: `/discover/shows` opens with Shows set and its canonical is unchanged.
- Depends on: nothing. It fixes a crawlable page, so it ships on its own, ahead of the redesign.

### Frontend

**F1. Tab model and Find parser**

- Files: `app/ui/discover-bar/tabs.ts` (main tabs, sub-tabs, the state each counts, visibility rules, value lines,
  badge sums, what Clear all counts), `app/domain/discover-find.ts` (value readings and name scoring),
  `title-scales.ts` (labels for presets). Clear all uses `clearSecondaryFilters`; each backend step adds its fields
  there.
- Tests: `discover-find.test.ts` with a table of the inputs in [Find](#find) and their readings; `tabs.test.ts` for
  badges, summaries and visibility.
- Depends on: nothing (reads only current and planned field names; fields not merged yet are added with their step).

**F2. Discover bar, panel, header row, status line, footer**

- Files: `app/ui/discover-bar/DiscoverBar.tsx`, `DiscoverPanel.tsx`, `TabHeader.tsx`, `StatusLine.tsx`,
  `PanelFooter.tsx`, `ShowButton.tsx`, `find/FindField.tsx`; `app/routes/dev.discover-bar.tsx` (development only, 404
  in production, like `dev.filter-bar.tsx`). Reuses `SnapSheet`, `activeChips`, `HiddenMeter`, `recoveryLabel`,
  `ShowTitlesButton`, `SortControl`, `ReadAsChips`, `useDiscoverResults`.
- Checks: keyboard ("/", Escape, outside click), fixed heights (no layout shift between tabs), phone sheet and Find
  slide, 60 fps rule (transform and opacity only, no backdrop blur over motion).
- Depends on: F1.

**F3. Search tab**

- Files: `app/ui/discover-bar/search/TitlesTab.tsx`, `PeopleTab.tsx`, `TypeBlock.tsx`, shared title and person rows.
- Depends on: F2, B9a (starter titles), B9b (Cast and crew).

**F4. Mood tab**

- Files: `app/ui/discover-bar/mood/CombosTab.tsx`, `EverythingTab.tsx`, mix cards (`ArtTile` style), columns.
- Depends on: F2, B1, B2a, B9a. B2b adds the five new moods to the Feel column when it lands.

**F5. Watch tab: Services, Scores, Made in, Released, Length, Age and content**

- Files: `app/ui/discover-bar/watch/ServicesTab.tsx`, `ScoresTab.tsx`, `MadeInTab.tsx`, `ReleasedTab.tsx`,
  `LengthTab.tsx`, `AgeTab.tsx`, `CountryChip.tsx` (shared country chip and finder). Counts render when the response
  has them, so F5 can merge on the harness before B12; F8 waits for B12.
- May split into two reviews: Services, Scores and Age; then Made in, Released and Length.
- Depends on: F2, B5, B6, B7.

**F6. You tab**

- Files: `app/ui/discover-bar/you/YouTab.tsx`, `ListPill.tsx`, group rows.
- Depends on: F2, B3, B4, B9c.

**F7. Find results across tabs**

- Files: `app/ui/discover-bar/find/FindResults.tsx`, `useFind.ts` (titles from `/api/search`, people from `/api/cast`,
  More, handoffs, Enter rules).
- Depends on: F1 to F6.

**F8. Discover on the new bar**

- Files: `app/ui/discover/DiscoverPage.tsx` (static title; the Discover bar, status line and panel in place of
  `DiscoverHeading` and `FilterBar`; grid, Sides rows, empty state and For you states unchanged),
  `app/routes/discover.($type).tsx`.
- Checks: old URLs (legacy params, `side=`, `layout=grid`, `q`, every filter parameter) open with the same results and
  show their choices; first screen on a phone shows the search entry and first results; `goodwatch-benchmark` pages
  for `/discover` (`pages.json`, `budget.json`) pass; Lighthouse on `/discover`.
- Depends on: F2 to F7, B12 (Released, Length and Made in counts and decade bars).

**F9. Popularity sub-tab**

- Files: `app/ui/discover-bar/watch/PopularityTab.tsx`, glyph tiles and the stepped slider.
- Depends on: F8, B8.

**F10. Shows and Budget sub-tabs**

- Files: `app/ui/discover-bar/watch/ShowsTab.tsx`, `BudgetTab.tsx`.
- Depends on: F9, B13, B14.

**F11. Cleanup**

- Delete Discover-only pieces nothing imports any more: `FilterBar`, `Slab`, `PhoneFilterRow`, `FilterCards`,
  `filter-cards.ts`, `PopularFilters`, `FilterPickers`, `SignUpPanel`, the sheet parts of `FilterGroups` and
  `FiltersSheet` (keep `FilterSearchField` and `ShowTitlesButton`, used by My movies), `dev.filter-bar.tsx`, and
  `DiscoverHeading` if only Discover used it. Move `dev.for-you.tsx` onto the new bar. Keep `controls.tsx`,
  `SnapSheet`, `motion.tsx`, `useModalDialog`, `labels.ts`, `SubBar` pieces used by `HiddenTitles`.
- Update `app/ui/filter-bar/index.ts`'s comment (it says Watch next and Explorer share the bar; they don't), benchmark
  budgets if the page weight changed, and `CONTEXT.md` (Discover bar, Find).
- Depends on: F10.

## Risks and checks

### Performance

- Budget: Discover's uncached filter pass costs about 27 ms of main-thread time today. Hold the results route's
  `results` Server-Timing to at most 5 ms more at p50 for a member on the full catalog after B8, B12, B13 and B14
  together. Each new count is one loop over the titles every other group lets through, with typed arrays; measure each
  step with a bench test over the sample snapshot and once against a production-sized snapshot locally.
- Members aren't cached: every page of a member's scroll reruns the pass. The extended counts (taste groups) run only
  when asked (`counts=taste`). If the budget is exceeded, compute bucket counts on page 1 only (later pages never read
  them).
- Only with B2b: the mood combination table grows from 2,048 to 65,536 entries per request with 16 moods. Reuse one
  buffer.
- Crate: B12 removes per-request SQL sets for years and runtime (and their Redis JSON parses) when facts are
  present, which is a net saving. Production countries keep their SQL set. Rest of the world adds one cached read per 30 minutes. People in
  results is two `GROUP BY` reads over at most 100 ids per kind, cached 30 minutes per list.
- Facts sidecar memory: about 20 bytes per title per webapp process; the publisher keeps chunks at 1 MB.
- Taste groups: `sideOf` per title costs a fingerprint distance; the first request after the 10-minute cache fills
  the member's row cache. Measure with the largest history (B4).
- Cache keys: `discover-filters:v3` for the guest cache once `FilterResult` gains new count keys (in-process, but the
  bump states the shape change); `title-filter:v2` keys already include parameters, so the new set kinds need no
  bump. New keys: `discover-people:v1:<hash>`. No prototype names in any key.

### Local checks without production writes

`goodwatch-webapp/.env` points at production. Page checks for these steps use the isolated setup (a one-node local
Valkey for the snapshot and caches, a read-only Crate user, background jobs off, the egress allowlist), never the
repo's `.env`. Reads of production data for counts go through a read-only user only.

### SEO

- `robots.txt` disallows `/discover?` and `/discover/*?`, and the canonical is always `/discover`, so new parameters
  create no crawlable variants.
- The visible heading changes to "Discover movies and shows". Keep the meta title and description as they are in
  this build (no ranking churn); align the copy later if wanted.
- Fix the `/discover/shows` and `/discover/movie` redirect map in B16, on its own and early (they land on plain
  `/discover` today).
- The first server render must keep the grid's posters (LCP element is a TMDB w342 poster): the bar renders on the
  server in its closed state, with no layout shift when it hydrates.

### MCP compatibility

- Every change is additive: new optional arguments, enums that gain values (`minimum_match` +60, `source_scores` +
  `metacriticUsers`, and `moods` +5 only with B2b). Old calls return what they return today, because URLs without
  `all` stay any of and `runtime` alone still covers both kinds.
- B2a changes MCP mood names with the rest of the site; B2b adds moods. Existing keys never change.
- `page_url` from MCP keeps opening Discover with the same view (`filterQuery`), and the new parameters show as
  chips there.
- Discord reads `discoverFilters` through its strict schema: it accepts the new fields automatically; slash command
  choices don't change (no re-registration in this build).
- There is no per-tool schema version; record the additions in `mcp-discover-tools.md`.

### Mobile

- 390 px with no horizontal page scroll; sideways scrollers for sub-tabs and chips have a positioned ancestor (the
  prototype's sr-only "not " overflow).
- The sheet and Find animate transform and opacity only; no blur over motion; measure with trace work counts.
- The released timeline drag must not block vertical scroll (`touch-action: pan-y`, capture after sideways movement).
- Tap targets of the 26 px Everything rows reach 40 px with padding.

### Data quality

- Budget and box office coverage is low; the no-data rule and the "N of M here have a budget" line make it visible.
- Popularity rank drifts daily; "Popular now" changes with the snapshot.
- Show status depends on TMDB's field; unknown fails a status choice.

## Open questions for the owner

None open. Answered 2026-10-29: mood names change everywhere and the five new moods become real filters on every
surface that lists moods (B2a, B2b).

Decisions taken, each with its reason:

- You stays locked for guests, including Not seen yet: that is the tested design; guest defaults still apply and
  their chips stay removable.
- Budget and box office are nominal dollars: TMDB stores nominal amounts, and an adjustment would need a source.
- Rest of the world is fixed as outside the eight big industries (US, IN, KR, JP, GB, FR, CN, HK), the prototype's
  rule, so a co-production with one of them still counts when another country is outside them.
- Scores by source use one scale (60 to 90) in the tab and in Find; old URLs with other values (`imdb:65`) keep working
  and show as their own chip.

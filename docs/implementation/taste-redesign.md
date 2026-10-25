# Taste redesign: /taste, profile Stats, profile Tropes, For you link

The owner called /taste "the weakest part on the whole site" on October 25, 2026. It duplicated the profile's Taste
tab, showed recommendation grids that For you does better, and had no fingerprint drawing. The owner settled
every design through prototype rounds on the local branch `prototype/taste-page` (worktree
`/home/alp/dev/projects/goodwatch/proto-taste-page`, not pushed because its fixtures hold the owner's taste). This
document records the locked decisions and how they ship.

## Decisions

### 1. /taste is one page around the fingerprint drawing (locked as round 7 "D6")

Prototype: `/prototype/taste?variant=D6`, composed in `app/ui/prototype-taste-page/taste/Page.tsx`:
`VariantD3` with `explorer6/ExplorerD5` and `defining`.

- **Hero:** the `Whorl` drawing once, beside the viewer type (`MostYou`). The hero drawing and the explorer
  list share one state, so picking on either marks the other.
- **Taste groups:** B's group rows, bigger and roomier, each linking to For you.
- **Explorer:**
  - The attribute list flows down columns of seven rows beside the detail's name, meaning and numbers, with "vs everyone".
  - "Your best with it" runs full width underneath.
  - A family switch never moves the page, and there are no "You seek it" or "You lean away" tags.
  - Picking under Strongest keeps the Strongest tab.
- **Defining titles per attribute:** rank by distinctiveness, the title's attribute score minus that title's mean
  over all 74 attributes, among titles scored 7 or more, with at most 2 picks per family. This took Fight Club's
  repeats from 43 to 2. Never show lowest-scored carriers.
- **You vs everyone:**
  - Use the original /taste design, with a descriptive title and a small eyebrow but no prose.
  - Gaps are split into **Genres** and **Traits** lists with equal row counts.
  - The gaps use the corrected per-kind offsets (decision 5).
- **Tropes:** a short section that links to the profile's new Tropes tab. No "Hallmarks": the owner rejected that
  name and the essence tags with it.
- **Share:** behind a visible Share control, never a second copy of the drawing.
- **Copy and controls:** plain copy, no "your big yes" style labels, no Anime toggle, and no layout shift when a
  filter empties a list.
- **Starting members:** the existing onboarding stays for a member who is starting their taste.

### 2. The profile's Taste tab becomes Stats (locked as round 7 "S8")

Prototype: `/prototype/profile-stats?variant=S8&as=owner|member|guest`, `stats/S8.tsx`. Real-component edits are
already on the prototype branch (`git diff 328259270 prototype/taste-page -- goodwatch-webapp/app/ui/profile
goodwatch-webapp/app/domain/genre-colors.ts`).

- **Print:** the print runs at full header height on the right. "Your full taste" is centered over it and shown on
  hover or focus, or after a first tap on touch screens, where the second tap navigates. Its background is solid
  `bg-gray-900/95`.
- **You vs everyone:** rows read "9 vs 50", with the member's own score on the right.
- **Genre colors:** fixed, from shared code (`app/domain/genre-colors.ts`, TV genre pairs folded). Genre bars get
  tooltips.
- **Decades:** selectable decade bars drive the titles panel and preselect the decade with the most titles.
- **Favorite directors:** best rated by default, with no shift between sorts.
- **Era bars:** neutral, with no prose.
- **Removed:** "How you score", Anime toggles, and "your big X" labels.
- **Share:** the profile share images move into a **Share** button with a dropdown of card previews in the
  profile header row.
- **Tab name and links:** the tab is called **Stats**. The owner bar's link to /taste is labeled as the member's
  taste, not "Recommendations for your taste".

### 3. The profile gets a Tropes tab (locked as round 10 "B3", with B1's filter bar)

Prototype: `/prototype/profile-tropes?variant=B3`, `r11/B3Preview.tsx`, with the filter bar from
`r11/FacetStrip.tsx` (B1).

- **Bands:** full-width bands in ranked order, stepping down in size.
  - Ranks 1 to 3 are hero bands. Each already shows "In <Title>" for its top title: the poster and the first lines
    of the excerpt, covered when the viewer hasn't seen the title.
  - Ranks 4 to 10 are medium bands. The rest are compact rows.
- **Opening a band:**
  - **What it is:** the TV Tropes description, with the numbers on one line (titles, scored 8 or more, average
    vs the member's usual).
  - Then the 12 defining titles as a poster grid, side by side at the same height with the reader. The reader
    shows the selected title's backdrop, "In <Title>", previous and next, and the excerpt. On phones, a poster
    row sits above the reader.
  - Then "Read about it on TV Tropes (opens in a new tab)" and the credit line "Excerpts from TV Tropes, CC
    BY-NC-SA 3.0" linking to the license.
- **Motion:**
  - The tapped band holds still. Other bands slide with FLIP, transform only. The detail fades in, and switching
    titles crossfades.
  - Respect reduced motion. 60 fps, transform and opacity only, no backdrop blur over motion.
- **Filter bar (B1's):**
  - **Desktop:** the My movies strip with Movies or shows, genre chips, a genre dropdown of picture tiles, era and
    score selects, the real `SortControl` (Loved most, Most titles, Highest average), and a live count.
  - **Phones:** the four-button bar with a drawer for each filter.
  - **Empty results:** the controls stay in place and the list shows "No tropes in these titles." with **Clear
    filters**.
- **Ranking:**
  - A trope's score is the binomial z-score of its share of titles scored 8 or more against the member's overall
    8+ share.
  - Only tropes present in at least 10 titles qualify; `leastTitles` scales that floor for small libraries.
  - Ties break on loved count, then name.
- **Defining titles:**
  - Definingness is `ln(1 + len/100) / ln(10 + the title's trope count)`, where `len` is the length of the
    title's excerpt for that trope.
  - Titles scored 7 or more come first, and the member's score breaks ties.
- **Viewers:** the owner, members and guests see the tab. Excerpts are covered for titles the viewer hasn't seen.
- **Touch targets:** at least 44 px on phones.

### 4. For you links back with a "Your taste" button (round 3 "D")

Prototype: `/dev/for-you-page?tasteLink=D`, `ui/for-you/TasteLinkProto.tsx`. Put the button at the right end of
the For you header row, and drop the results' duplicated plain "For you" title with a smaller gap.

### 5. Genre gaps use per-kind generosity offsets

`app/server/taste-portrait/everyone.server.ts` applies one generosity offset across movies and shows. GoodWatch
scores shows about 9 points higher, so TV-only genres read negative: Sci-Fi & Fantasy read -5 while Science Fiction
read +3. The fix:

- Compute the offset per kind. The owner's offsets were movies +1.5 and shows -4.3 GoodWatch points, and every
  genre gap fell within ±0.5.
- Fold TV genre pairs into movie genres.
- Keep genres and traits apart.

## Data in production

- **Trope names per title:** the Crate `movie.tropes` and `show.tropes` columns hold the full lists.
- **Per-title excerpts:** the Crate `trope` table (`media_tmdb_id`, `media_type`, `name`, `url`, `content` HTML),
  copied from Mongo `tv_tropes_*_tags` by `f/sync/copy/tvtropes`. Excerpt length is the length of the stripped text.
- **General descriptions:** nothing in production stores them. The prototype fetched 100 once, in
  `r6/descriptions-tvtropes.json`.
  - Ship those 100 as a server data file. Show **What it is** only when a description exists.
  - A wider description source is a follow-up: production crawls are blocked by Cloudflare, see
    [[tvtropes-access-decisions]] in the team notes.
- **License:** TV Tropes text is CC BY-NC-SA 3.0. Every view that shows excerpts or descriptions carries the
  credit line and the license link.

## Shipping rules

- No prototype names (D6, S8, B3, r11) in production code, file names, or comments.
- Ship to everyone. No feature switches.
- No new third-party dependencies.

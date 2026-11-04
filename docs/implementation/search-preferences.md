# Search preferences on Discover

Discover's search reads genres, themes, moods, and styles from the words as preferences: under Relevance, titles that fit them rank higher, and none are hidden. The tested policy is "V7" from [issue #726](https://github.com/alp82/goodwatch-monorepo/issues/726). The read strip under the search field shows what the search read, and each part can be switched off. The owner chose design A, "Read strip", in the prototype (`prototype/discover-preferences-20261104`, a713b1978).

## What the words become

The rules live in `app/domain/search-preferences.ts` (`readPlan`):

| The words | What the search does |
| --- | --- |
| A genre, theme, mood, or style ("Historical Action", "funny") | A preference. Under Relevance, titles that fit rank higher. Nothing is hidden. |
| True stories, the Animated form, the Documentary form | Stay filters: they describe what a title is. |
| Years, type, runtime, country, services, scores, people | Stay filters. |
| A filter the person chose themself | Stays a filter and wins over the words (the interpreter's "existing wins"). |
| A search that leaves something out ("without warfare") | Every read filter stays strict, as before. |
| Words that name a well-known title ("The Big Short") | Only the person's own filters apply: the words are the title. |
| Words that all became filters ("90s movies") | No search: Discover's list for those filters, every one strict. |

## The URL

The URL keeps the words as typed (`q`) and the phrases switched off (`off=<phrase>`, repeated). What the words read is never written as the person's own filters, so a reload, Back, or a shared link reads them again. An older link's `asked` parameter is read as the typed words, and the filters it wrote stay the person's own.

## How a search runs

1. The page asks `/api/discover/interpret` for the whole query (for the strip) and for the words switched on (for the search). With nothing switched off, these are one request.
2. The search role gets the words, the eligibility of the person's own filters plus the hard read filters, and, when a single genre read as a preference widened the search, `originalGenres`. It returns:
   - The wider pool (`searchSet`). With `originalGenres`, it also returns the original reading's pool (`originalSet`) and the pairs of keys that are one title in the two pools (`identitySet`). The original pool is ranked beside the wider one, so it adds no wait of its own.
   - `namedTitle` when the words name a title that Discover shows: well known, not adult, scored. The page then reads the words again with only the person's own filters.
   - After the batch, a `counts` line: what each read filter the search applies itself (years, type, anime) keeps out. Each count is one more ranking with the same reading (no model call). The counts give way when every place in line is taken, and a failed count is left out.
3. The results endpoint (`/api/discover/results` with `prefer`, `originalSet`, `identitySet`, `scope=1`) composes the list (`app/server/discover-preference-order.server.ts`):
   - Both pools pass every hard rule the list applies: the filters, the taste match floor, taste groups, and the search's Not interested rule.
   - A title the pools hold under two keys folds to the original key only where that key passes.
   - **Relevance:** the wider pool in the search's order, each title's cost `log1p(position) / log(5001) + 0.25 × (1 − fit)`, then the original matches that the wider pool lacks.
   - **Top rated:** the original matches (every read preference) by rating, then the rest by rating.
   - Past 5,000 titles the preferences filter, as before.
   - The pools' titles that fail a filter follow the composed order, so the filter bar still counts them.
   - One title snapshot serves the pools, the fit, and the rating order; a refresh during the work is read again once.

## Counts and what they mean

| Count | Where it comes from | Shown as |
| --- | --- | --- |
| A read filter the search applies itself (years, type, anime) | The same reading ranked without that filter, minus what passes with it | An estimate, `~` |
| A read filter the results apply (runtime, scores, country) | The results' own count of what that filter alone hides | `~`, as for the person's own filters; exact on the catalog when no words are left |
| The search's scope, on the first plain words switched on (else the first preference) | The catalog under every hard rule the list applies, minus the results | Exact |

Hide numbers read in floor buckets (`app/ui/discover-bar/hide-count.ts`): 0–9 as they are, tens, hundreds, then whole thousands as "k". `~` marks an estimate or a bucket that lost precision. Sorting, the meter, and the totals use the raw numbers.

## Deploys

The page image and the search roles deploy separately ([ADR 0011](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md)). The API is backward compatible both ways:

- A search role without this change ignores `originalGenres`, `counted`, and `named`. The page then composes the wider pool alone, without counts or the named-title check.
- A page without this change never sends them.

The full feature needs the search roles deployed with the same commit as the page image.

## Measurements

On a synthetic 200,000-title snapshot with a 5,000-title search (`getDiscoverResults`, median of 12):

| Request | Median |
| --- | --- |
| Plain search, page 1 | 3.5 ms |
| Plain search with the scope count | 18.0 ms |
| With preferences and the scope count, Relevance | 21.5 ms |
| With preferences and the scope count, Top rated | 18.3 ms |
| With preferences, page 2 (no scope count) | 5.4 ms |

On the search role, the original pool's ranking runs beside the wider one. Each read-filter count is one more ranking after the batch.

The read strip and the Matches popout's read parts load only while searching. `./bench.sh budget` with Lighthouse on the host network (the fix in `bench.sh`) against isolated local production builds of the base (f39b30605) and this change, on the bench fixture catalog, Discover surface, median of 3:

| Line | Base | This change | Limit |
| --- | --- | --- | --- |
| Script bytes | 407.3 KB | 411.9 KB | 464.0 KB |
| Scripts | 36 | 36 | 45 |
| Total bytes | 890.7 KB | 895.5 KB | 860.0 KB |
| LCP | 5,283 ms | 5,431 ms | 5,650 ms |
| TBT | 12 ms | 12 ms | 200 ms |
| Score | 72 | 71 | 65 |

Total bytes fails on the base too, on this local fixture setup. The budget is unchanged. Home and show measure the same on both builds (home passes on both; show's script and image bytes fail on both). The fixture can't serve the movie, person, and share list surfaces.

## Tests

- `app/domain/search-preferences.test.ts`: the rules, with the real interpreter.
- `app/ui/discover/search-reading/read-items.test.ts`: the strip's items, `off`, the person's own choice set aside, and the mood cap.
- `app/server/discover-preference-order.test.ts`: the composition, the fold, and the fallback.
- `app/server/discover-preference-list.test.ts`: the results on a fixture snapshot, including folding under the filters, taste groups, the Not interested rule, and the scope count.
- `app/server/combined-search/preference-pools.test.ts`: identity pairs, kept-out counts, and the named-title guard.
- `app/ui/search/search-request.test.ts`: the counts line after the batch.
- `app/ui/discover-bar/hide-count.test.ts`: the formatter.

## Known limits

- The named title is known only after the first search, so a search that names a title runs twice.
- The read-filter counts are estimates: switching a filter changes what the search finds.
- The search role's new paths (`originalGenres`, the counts loop) aren't run end to end locally: a local search role needs the production vector store. The page side ran on an isolated local build with a fixture search answer.

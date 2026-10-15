# Media language: plan for search by localized names

Written 2026-10-15 for item 6 of #592. This is a plan only. No code changes with it, and nothing below has been
measured against production. Display localization (variant F) already ships. This plan covers the other half: a
visitor who types a localized name, such as "Chihiros Reise ins Zauberland" or "千と千尋の神隠し", finds the title.

Background: the research inventory flagged this as separate work
([localization research](../research/media-language-localization.md), finding 5 and open question 6), and the
[surface matrix](media-language-surface-matrix.md) records it as deferred. The settled scope still holds. Only
media names are in play, page prose stays English, and nothing is translated for money.

## How names are found today

| Path | What it matches | Where |
|---|---|---|
| Search-role title table | `title` (English TMDB title) and `original_title` for about 50,000 eligible titles (at least 2,000 votes, not adult) | `goodwatch-flows/windmill/f/search/build_indexes.py`, `index_builders.py:728` (`title_table`); loaded by `app/server/search-ranking/search-index.server.ts` (`TitleTable`) |
| Command palette | Prefix tiers on folded title and original title | `app/server/command-palette.server.ts` (`foldedNames`, `matchingRows`), Redis `command-palette-titles-v4`, keyed by prefix only |
| Combined search, local | Exact, phrase and word match plus a fuzzy fallback over `titleNames`, and "like X" through `referenceTitles` | `search-ranking/search-index-build.server.ts` (`derivedTitles`), `title-blend.server.ts`, `references.server.ts` |
| Combined search, remote | TMDB `/3/search/multi?language=en-US` | `combined-search/search.server.ts` (`lookupTitles`) |
| Catalog exact title | Crate `MATCH((title, original_title), ?)`, then exact equality | `combined-search/catalog.server.ts` |
| Legacy search, share-title search | TMDB `search/multi` | `routes/api.search.tsx`, `server/share-lists/titles.server.ts` |
| My library filter | Substring of the one canonical title | `domain/my-library.ts` |

TMDB's own search is the only path that can find a localized name today, because TMDB matches its aliases on its
side. It covers well-known titles, but it is remote, has a 200 ms budget on later pages, and returns the English
title.

Normalization is `normalized()` and `fold()` in `search-ranking/text-rules.server.ts`. A CJK run without spaces is
one word, so CJK names only match from the start of the run.

## Where localized names live

- **`translation`** (Crate): `title` for each `(media_tmdb_id, media_type, language_code, country_code)`. Show
  names are copied into `title` at fetch time (`tmdb_fetch_details_from_api/fetch.py:273`). The overlay already
  reads this table for display (`app/utils/media-overlay-core.ts`).
- **`alternative_title`** (Crate): one `title` per `(media_tmdb_id, media_type, country_code)`. It has no language,
  and the sync keeps only the first alias per country (`sync/copy/tmdb_details.py:539`). TMDB often lists working
  titles, transliterations and promo titles here.

Row counts are unknown. The research avoided aggregate scans on purpose, and the cloud can't reach Crate.

## Contract

1. **Matching never depends on the display language.** Every approved alias is searchable for everyone. A German
   visitor who types the Japanese name still finds it, and a Japanese visitor who types the English name still
   does. The display language only picks the label shown afterwards, through the existing overlay.
2. **Aliases add recall. They never take away a canonical hit.** For the same query, canonical and original title
   matches keep their tier and rank. An alias match sits one step below a canonical match of the same kind
   (exact, prefix, word), and votes break ties as they do now.
3. **One title, one result.** Aliases resolve to the stable title row. A name shared by several titles (remakes,
   generic words) resolves by the existing vote order, never by the viewer's language.
4. **Ranking, taste and the paid reading stay the same.** Aliases feed name recognition only: palette, exact and
   prefix lookup, fuzzy fallback and "like X". No vectors are re-embedded, and BM25F terms don't change. Adding
   translated text to the retrieval corpus would be a new contract under
   [ADR 0002](../adr/0002-local-text-embeddings-for-search.md), and it is out of scope here.
5. **A result remembers how it matched.** It carries `matchedAlias` (the text and its language). The displayed label
   still comes from the overlay. A future UI can show "Also known as …", but this plan adds no UI copy.
6. **Old and new processes mix safely.** Search roles can run another commit than page instances
   ([ADR 0011](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md)). A missing alias file means "no aliases",
   and an old role ignores the new file.

## Which aliases

**Phase 1: `translation.title` only, for the base languages of the 14 launch locales (owner decision 1).** These are en, de, fr, es,
it, pt, ja, ko, zh, pl, ru and ar. They have a language, they're what the overlay already shows, and a visitor who
sees a localized title can type it back and find it.

- Skip an alias when its fold equals the fold of the title or the original title.
- Skip empty values and values shorter than 2 characters (after folding) for Latin script. CJK keeps single
  characters only for exact matches.
- Keep at most one copy of each folded alias for each title, whatever the region. For example, pt-BR and pt-PT
  often agree.

**Phase 2, after an evaluation: `alternative_title`.** Its quality varies, it has no language, and the sync drops
all but one alias per country. The sync keeps every alias per country (owner decision 3). That changes the primary
key to `(media_tmdb_id, media_type, country_code, title)` and removes the first-per-country filter in
`sync/copy/tmdb_details.py`. The table has to be migrated, because Crate can't change a primary key in place. The
owner runs that migration, because the cloud can't reach Crate and must not delete data. `f/social/matcher.py` and `f/social/deterministic.py` already read this table for name
matching, so check that a schema change works for them too.

## Build: a new `alias_table` file

In `goodwatch-flows/windmill/f/search/build_indexes.py`, after the eligible titles are known:

1. Read `translation` for the eligible `(media_tmdb_id, media_type)` pairs and the phase 1 languages, in batches,
   with only `media_tmdb_id, media_type, language_code, title`.
2. Fold and filter as above. Write `alias_table` next to `title_table`, as columns:
   `rows: int[]` (title row), `names: string[]`, `languages: string[]`. Add `alias_version` to the build manifest
   (`search_index_builds`).
3. Log the counts: aliases read, kept, dropped as duplicates, and kept per language. These are the memory inputs
   below.

Python tests cover folding, dedupe against title and original, the region merge and the empty-table case, using
`goodwatch-flows/tests/test_build_indexes.py`.

## Webapp: loading and matching

- `search-index.server.ts`: load `alias_table` when the manifest lists it. Otherwise use an empty table. No other
  file changes shape.
- `search-index-build.server.ts::derivedTitles`: add alias entries to `titleNames` (fuzzy) and `referenceTitles`
  ("like X"), marked as alias so the tier rule in point 2 of the contract holds.
- `command-palette.server.ts::foldedNames`/`matchingRows`: add aliases as a lower tier after title and original
  title. Change the Redis name to `command-palette-titles-v5` and add `alias_version` to the key, so cached
  prefixes don't hide new aliases.
- `combined-search/search.server.ts`: the local title lookup returns `matchedAlias`. Add `alias_version` to the
  10-minute lookup cache key.
- `catalog.server.ts`: leave it alone. Its job is exact canonical titles under a 200 ms budget, and the alias table
  in memory already covers the exact alias case.

### Paid translation

There is no paid translation in this work (owner decision 2). Paid query translation sits behind
`SEARCH_TRANSLATION_ENABLED`, which is off by default (`search-runtime/runtime.server.ts`). Alias matching must not
depend on that flag, read it or add another paid step. The `exact-native-title-v1` skip rule in `search.server.ts`
stays unchanged. With the flag off, it never runs.

### CJK

Prefix matching only from the start of a run is fine for titles typed from the start, which is the usual case. Add
no n-gram index in phase 1. If the evaluation shows misses on CJK names typed from the middle, add a bounded
substring scan for queries of at least 2 CJK characters over CJK aliases only.

## Memory: measure first

The title table is 1.6 MB gzipped and 6 MB as JSON for 50,371 titles
([search-ranking README](search-ranking/README.md)). A rough upper bound for aliases is 50,000 titles × 12
languages ≈ 600,000 names. After dedupe against the English title and across regions, a few aliases per title is
more likely. As JS strings plus the palette fold and fuzzy entries, that is roughly 20–60 MB on each search role,
which has 4 GB. Two steps before code:

1. **Count (owner, read-only).** `SELECT language_code, count(*) FROM translation WHERE title IS NOT NULL AND
   title <> '' AND language_code IN (…) GROUP BY language_code`, restricted to the eligible titles if practical.
2. **Dry build.** Run the new builder step with the count log and without uploading, and record the gzipped file
   size and the resident memory of the role after loading in a test run.

The ceiling is +100 MB per search role (owner decision 4). If the role grows by more than that, drop the fuzzy
entries for aliases first, and keep exact, prefix and "like X".

## Evaluation

A fixed query set, checked into the repo as a test fixture, with the expected title ID for each query:

- 5 queries per launch language, using names that differ from the English title. Examples: "Chihiros Reise ins
  Zauberland", "Le Voyage de Chihiro", "Il favoloso mondo di Amélie", "千と千尋の神隠し", "Бойцовский клуб", "蝙蝠侠：黑暗骑士",
  "Gwiezdne wojny".
- The same queries as prefixes: the first word, then the first 3 characters.
- 20 canonical English queries that must not change rank. This is the regression guard for point 2 of the
  contract.
- 10 ambiguous names, such as remakes and generic words, to check the vote tie-break.

Measure top-1 and top-5 hit rate before and after. Run the measurement with the index loaded in a test process, not with POST searches
against production, because those write history and can spend money
([rollout](media-language-rollout.md)).

## Rollout

1. Flows: add the builder step and tests, merge, and wait for the nightly build. The new file is additive.
2. Webapp: add the loader, tiers and cache keys, merge. Page instances deploy and do nothing new.
3. The owner deploys the search roles to that commit, one role at a time, with the existing `deploy.sh`.
4. Check `GET /api/command-palette?q=chihiros` on a role. This is a GET, so it has no side effects.

Rollback: deploy the earlier search commit. The alias file stays in place and is ignored.

## Out of scope

- My library stays canonical, as decided ([decisions](media-language-decisions.md)).
- Legacy search and share-title search keep TMDB `en-US`.
- No localized names in vectors or BM25F.
- No UI copy for "Also known as".
- Person names and collection names.

## Phase 1 results (2026-10-15)

Phase 1 is built: `alias_table` in `build_indexes.py` and `index_builders.py` (`alias_table`), and in the webapp
`search-ranking/aliases.server.ts` (the decoded table), `name-prefix.server.ts` (the palette's tiers),
`title-blend.server.ts` (lexical score and fuzzy match), `references.server.ts` ("like X") and
`combined-search/search.server.ts` (lookup cache key, `matchedAlias` on the rows). Measured against production,
read-only, on build `20261015T041503Z`:

- **Rows.** 43,133 eligible titles; 512,016 `translation` rows in the 12 languages, 103,950 of them without a title.
  Kept 319,960 aliases for 41,379 titles (46,555 equal the title or original title, 41,498 duplicates across regions
  and languages, 53 too short). Per language: zh 75,260, pt 36,391, ru 36,042, es 33,966, ko 30,125, fr 23,713,
  pl 21,933, de 19,289, ja 18,224, it 18,162, ar 6,812, en 43. More than the "few per title" guessed above: about 7.7.
- **File.** 4.2 MB gzipped, 11.3 MB JSON. The builder step takes 3 seconds for the rows.
- **Memory per search role.** +34.5 MB heap and +29.3 MB typed arrays, about 64 MB, under the +100 MB ceiling. The
  process RSS grew 47 MB in the measurement, which also parsed the file on the main thread; a role parses it in its
  load worker. Fuzzy entries for aliases stay in: their character counts are 20 MB of the typed arrays.
- **Lookup time with aliases** (p50 / p90, ms): palette 3.5 / 5.5 before, 3.9 / 6.3 after; title blend with the
  fuzzy match 0.6 / 2.6 before, 0.7 / 4.4 after. A two-character index of word starts keeps the palette from scanning
  every alias.

Two choices made while building, both on the side of the canonical names:

- **The palette puts every title tier before every alias tier**: title start, title word, alias start, alias word.
  Interleaving them (an alias start above a title's later word) pushed title matches out of the 20 rows the search's
  title lookup takes from the palette, and changed the first result for "Pul". With the titles first, aliases only
  fill the places the titles leave.
- **In the title blend, a row found only by an alias ranks after the titles of the same score.** An alias match
  scores `ALIAS_STEP` (0.01) below a title match of the same kind: an exact alias is 1.99, below an exact title (2)
  and above a phrase match (1.05).

One owner decision after the first evaluation: **"like X" takes a 2-character key when it is Chinese, Japanese or
Korean** ("like 教父", "like 대부" find The Godfather). Every other key still needs 3 characters, so "like up" and
"like pa" resolve nothing.

**Evaluation**, `scripts/search-alias-eval.ts` with `app/server/search-ranking/alias-eval.fixture.json`, top-1 / top-5
before → after, rerun with the 2-character CJK keys. The palette is its 8 rows; the title lookup + blend is the palette's 20 rows through
`title-blend.server.ts`, without TMDB and without the ranked list.

| queries | n | palette | title lookup + blend | "like X" top-1 |
|---|---|---|---|---|
| localized, full name | 60 | 0% / 0% → 98% / 100% | 0% / 0% → 100% / 100% | 0% → 92% |
| localized, first word | 52 | 0% / 2% → 37% / 56% | 0% / 2% → 21% / 56% | |
| localized, first 3 characters | 51 | 0% / 0% → 20% / 35% | 0% / 2% → 10% / 37% | |
| canonical, full name | 20 | 95% / 100% → 95% / 100% | 95% / 100% → 95% / 100% | 90% → 90% |
| canonical, first word | 12 | 67% / 92% → 67% / 92% | 17% / 67% → 17% / 67% | |
| canonical, first 3 characters | 19 | 74% / 95% → 74% / 95% | 32% / 74% → 32% / 74% | |
| ambiguous names | 10 | 80% / 90% → 90% / 100% | 60% / 90% → 70% / 100% | |

Every canonical hit rate is unchanged. Canonical top-5 lists change only where aliases fill places after the titles,
and in the blend for "Dune", where exact aliases (1.99) pass canonical rows the blend scores 0. The canonical and
ambiguous misses are the same before and after (the palette orders by votes, the blend by TMDB popularity). The
shared German name "Das Ding aus einer anderen Welt" resolves to The Thing (1982) by votes. With the 2-character CJK
keys, "like X" finds every Chinese and Korean name (80% → 100% each; 88% → 92% over the localized set). The 7
remaining "like X" misses come from existing rules: two titles below 10,000 votes ("Cranberry Sorbet", "The Blood
Lands"), the 2-letter Latin key "up", and names that resolve to a person or team first: "Krieg der Sterne" (Jim
Krieg), "Der Pate" (Jonas and Josh Pate), "Il Trono di Spade" (David Spade) and, before aliases too, "Forrest Gump"
(Frederic Forrest). Prefixes of localized names miss mostly on their first word
("Le", "El", "Der", "Il"), which many titles share. The set types names from their start; its CJK names
and their prefixes all hit their titles in the top 5, so phase 1 adds no substring scan.

## Owner decisions (2026-10-15)

1. Phase 1 languages: only the 12 launch base languages for now.
2. Paid translation: none. Alias matching adds no paid step, and the proposed `exact-native-title-v2` is dropped.
3. `alternative_title`: keep every alias per country. This is phase 2, and the owner runs the table migration.
4. Memory: up to +100 MB per search role is fine.

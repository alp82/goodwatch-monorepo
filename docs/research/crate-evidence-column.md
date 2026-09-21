# Crate evidence column: analyzers, indexes, and rollout facts

Research for [issue #103](https://github.com/alp82/goodwatch-monorepo/issues/103), a child of the map [issue #100](https://github.com/alp82/goodwatch-monorepo/issues/100). Researched on 2026-09-20.

## Scope and sources

The production cluster runs CrateDB 5.10.9 on three nodes. The `movie` and `show` tables have 12 shards each and `0-1` replicas. A read-only query against `sys.nodes` and `information_schema.tables` confirmed this.

This note uses three kinds of source, in this order of trust:

1. **Docs.** The CrateDB 5.10 reference at `https://cratedb.com/docs/crate/reference/en/5.10/`.
2. **Source.** The CrateDB source at tag [`5.10.9`](https://github.com/crate/crate/tree/5.10.9), which bundles Lucene 9.12.0, and the Lucene 9.12.0 source. The note uses the source where the docs are silent.
3. **Measured.** Read-only `SELECT` statements against the production cluster from a dev machine. Each query ran four times. No statement wrote to the database.

Each fact names its kind of source. Where the docs don't settle a question, the note says so.

## Summary

- The `english` analyzer removes possessives, lowercases, removes 33 stop words, and applies the Porter stemmer. The docs don't describe this chain. The source does.
- A custom analyzer with `kstem` or `minimal_english` is one `CREATE ANALYZER` statement.
- A `synonym` token filter exists in 5.10. The docs list only a file-based configuration, `synonyms_path`. The source also accepts an inline `synonyms` list, but no CrateDB test covers it.
- `ARRAY(TEXT)` can carry a full-text index, both as a column index and as a source of a named index. The docs don't say so. The CrateDB test suite proves it.
- A composite index has no weights for its parts. It's one index with one boost. Separate indexed columns accept one boost each in `match`.
- `ALTER TABLE ... ADD COLUMN ... INDEX USING FULLTEXT WITH (analyzer = ...)` works on an existing table, including with a custom analyzer since 5.10.3. `ALTER TABLE` can't add a named or composite index.
- An analyzer can't change without a rebuild. The way to change it is a new column and a new backfill.
- The 0.5 to 1.0 s latency isn't caused by `match`. The `fingerprint_scores IS NOT NULL` filter causes it. `match` for "dialogue" alone takes 11 to 15 ms on the server.

## The english analyzer and custom stemming analyzers

### What the built-in english analyzer does

**The docs don't settle this.** The [language analyzer section](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/analyzers.html#language) lists `english` as a supported type and lists three parameters: `stopwords`, `stopwords_path`, and `stem_exclusion`. It doesn't describe the token chain.

**Source.** CrateDB's [`EnglishAnalyzerProvider`](https://github.com/crate/crate/blob/5.10.9/plugins/es-analysis-common/src/main/java/org/elasticsearch/analysis/common/EnglishAnalyzerProvider.java) wraps Lucene's `EnglishAnalyzer`. Lucene 9.12.0 builds this chain in [`EnglishAnalyzer.createComponents`](https://github.com/apache/lucene/blob/releases/lucene/9.12.0/lucene/analysis/common/src/java/org/apache/lucene/analysis/en/EnglishAnalyzer.java):

1. `StandardTokenizer`: Unicode word segmentation.
2. `EnglishPossessiveFilter`: removes a trailing `'s`.
3. `LowerCaseFilter`.
4. `StopFilter` with 33 words: a, an, and, are, as, at, be, but, by, for, if, in, into, is, it, no, not, of, on, or, such, that, the, their, then, there, these, they, this, to, was, will, with.
5. `SetKeywordMarkerFilter`, only when `stem_exclusion` is set.
6. `PorterStemFilter`.

Consequences for the evidence column:

- Porter stemming makes plurals match without the hand-written plural forms that the prototype uses today.
- Porter is aggressive. It conflates words such as "university" and "universe". The stop list removes "no" and "not".

**Contrast with today's columns.** `essence_text` and `synopsis` use `INDEX USING FULLTEXT` without an analyzer, so they use `standard`. The [standard analyzer](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/analyzers.html#standard) lowercases, uses no stop words, and doesn't stem.

### How to define a lighter analyzer

**Docs.** [`CREATE ANALYZER`](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-analyzer.html) defines a tokenizer, token filters, and char filters. The [fulltext indices page](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/fulltext-indices.html#creating-a-custom-analyzer) shows an analyzer that uses `lowercase` and `kstem`.

The available stemming filters, from the [token filter list](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/analyzers.html#built-in-token-filters):

| Filter | Fact from the docs |
| --- | --- |
| `kstem` | "High performance filter for english." The tokens must already be lowercase. |
| `porter_stem` | Porter algorithm. The tokens must already be lowercase. |
| `stemmer` | Takes a `language` or `name` parameter. The values include `english`, `porter`, `kstem`, `minimal_english`, `possessive_english`, and `lovins`. |
| `snowball` | Takes a `language` parameter. |
| `keyword_marker` | Protects listed words from stemming. It must come before the stemmer. |
| `stemmer_override` | Maps words to fixed stems with `rules` such as `"foo=>bar"`. It accepts an inline list. |

A sketch of an analyzer that mirrors `english` with a lighter stemmer. The scratch-table prototype must run it, because this exact statement is untested:

```sql
CREATE ANALYZER evidence_en (
  TOKENIZER standard,
  TOKEN_FILTERS (
    possessive WITH (type = 'stemmer', language = 'possessive_english'),
    lowercase,
    stop,
    kstem
  )
);
```

To use the plural-only stemmer instead, replace `kstem` with `light WITH (type = 'stemmer', language = 'minimal_english')`.

The docs don't compare the strength of `kstem`, `minimal_english`, and Porter. That comparison belongs to the prototype.

## The synonym token filter

**Docs.** A `synonym` filter exists. The [synonym section](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/analyzers.html#synonym) says: "Synonyms are configured using a file in the Solr/WordNet synonym format." It lists three parameters:

- `synonyms_path`: a path relative to the configuration directory.
- `ignore_case`: defaults to `false`.
- `expand`: defaults to `true`.

The docs list no inline option. A file-based configuration means that the file must exist on every node of the cluster.

**Source.** [`AnalysisRegistry`](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/org/elasticsearch/index/analysis/AnalysisRegistry.java) registers both `synonym` and `synonym_graph`. [`SynonymTokenFilterFactory`](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/org/elasticsearch/index/analysis/SynonymTokenFilterFactory.java) reads an inline `synonyms` list first, then `synonyms_path`. It also reads `format` (`wordnet` or Solr), `expand`, and `lenient`. It throws "synonym requires either `synonyms` or `synonyms_path` to be configured" when both are absent.

**Not settled.** No CrateDB test configures a synonym filter. The test suite only checks that `synonym` appears in the [list of built-in token filters](https://github.com/crate/crate/blob/5.10.9/plugins/es-analysis-common/src/test/java/io/crate/integrationtests/FulltextAnalyzerResolverTest.java). `synonym_graph` isn't in that list, so `CREATE ANALYZER` probably rejects it. Whether `CREATE ANALYZER` accepts an inline `synonyms = [...]` array is a question for the scratch-table prototype.

Three constraints apply to any synonym design:

- **One analyzer for index and query.** The `analyzer` option of `match` accepts only the analyzer that indexed the column ([match options](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html#options)). Since 5.10.4, a different analyzer raises an error ([5.10.4 release notes](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.4.html)). Synonyms can't apply at query time only.
- **Synonyms are frozen into the index.** A change to the synonym list needs a new analyzer name, a new column, and a new backfill. See [Changing an analyzer later](#changing-an-analyzer-later).
- **Fuzziness skips synonyms.** The docs note that "the fuzzy match query does not apply fuzziness to stacked synonym tokens" ([phonetic section](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/analyzers.html#phonetic)).

The cheaper alternative needs no analyzer support: expand the query in code. `match` combines the tokens of the query term with `OR` by default, so `match(evidence, 'rich wealthy affluent')` already works as a synonym search. The synonym list then lives in the webapp and changes without a reindex.

## Full-text indexes on ARRAY(TEXT) and composite indexes

### ARRAY(TEXT) with a full-text index

**The docs don't settle this.** The [fulltext indices page](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/fulltext-indices.html) only shows `text` columns.

**Source.** The CrateDB integration tests in [`FulltextIntegrationTest`](https://github.com/crate/crate/blob/5.10.9/server/src/test/java/io/crate/integrationtests/FulltextIntegrationTest.java) cover three cases:

- `testCopyValuesFromStringArrayToIndex` creates `keywords ARRAY(STRING) INDEX USING FULLTEXT` plus `INDEX keywords_ft USING FULLTEXT(keywords)`. It inserts `['foo bar']`, and `match(keywords_ft, 'foo')` finds the row.
- `test_can_add_text_array_column` runs `alter table t add column keywords ARRAY(STRING) INDEX USING FULLTEXT` and then inserts into the column.
- `test_can_use_nested_string_array_in_fulltext_index` builds a named index over a text array inside an object array.

So `essence_tags` and `keywords` can feed a full-text index in three ways: as an indexed array column, as a source of a named index, or flattened into one text column by the sync flow.

**Not settled.** The docs and tests don't say how `phrase` and `slop` behave across array elements. A phrase might match across the boundary between two tags. The prototype must test this if it indexes arrays directly.

### Composite index compared with separate columns

**Docs.** A [composite index](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/fulltext-indices.html#defining-a-composite-index) is `INDEX name USING FULLTEXT(col_a, col_b) WITH (analyzer = ...)`. The docs define no weights for its parts. In `match`, a [boost attaches to each `column_or_idx_ident`](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html#arguments), so a composite index gets one boost as a whole.

| | Composite index | Separate indexed columns |
| --- | --- | --- |
| Weight per part | None. One boost for the whole index. | One boost per column: `match((a 2.0, b), ?)`. |
| Score | One score over the combined text. Term statistics cover the combined text. | Per-column scores, combined by the match type. |
| Analyzer | One for the whole index. | One per column, but one `match` can't mix index types. |
| Add to an existing table | Not possible with `ALTER TABLE`. See [ADD COLUMN](#add-column-with-a-full-text-index-on-a-populated-table). | Possible with `ADD COLUMN`. |
| Source text | Stays in the source columns. Nothing is stored twice. | A flattened evidence column stores the text again. |

How the [match types](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html#match-types) combine separate columns:

- `best_fields`, the default, uses the score of the best column. `tie_breaker` adds a fraction of the other columns' scores. It defaults to 0.0.
- `most_fields` averages the scores of all matching columns.
- `cross_fields` searches all columns as one. The columns need the same analyzer. Every token must appear in at least one column.

**Conclusion.** If tags, tropes, and essence text need different weights, use separate indexed columns with boosts. A composite index fits only when one weight for everything is acceptable, and it requires a new table.

## Match options with a stemming analyzer

**Docs.** `match` analyzes the query term "with the analyzer configured on `column_or_idx_ident`" ([MATCH predicate](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html#match-predicate)). Every option therefore works on stems, on both sides.

| Option | Behavior from the docs | With a stemming analyzer |
| --- | --- | --- |
| `best_fields` | Default. Tokens combine with `OR`. The best column's score wins. | "heists" and "heist" produce the same token. The hand-written plural forms become unnecessary. |
| `operator` | `or` (default) or `and`. With `and`, every token must match. | Stop words vanish from the query, so `and` doesn't require them. |
| `minimum_should_match` | The number of tokens that must match under `or`. Defaults to 1. | Counts stems. |
| `phrase` | Tokens must appear in the same order with no tokens between them. | Matches stemmed phrases: "rich people" also matches "richer person" only if the stems agree. Porter doesn't stem "richer" to "rich". |
| `phrase_prefix` | Like `phrase`, with a prefix match on the last token. `max_expansions` limits the expansion. | See the caveat after this table. |
| `slop` | For `phrase` and `phrase_prefix` only. Defaults to 0. Two transposed terms need a slop of 2. | Works on token positions. |
| `fuzziness` | Maximum Levenshtein edit distance. Tune it with `prefix_length`, `max_expansions`, and `fuzzy_rewrite`. | The distance applies to stems, not to the typed words. |
| `cutoff_frequency` | Tokens above the frequency count toward the score only when a rarer token also matches. | Useful for requests that mix a common and a rare word. |
| `tie_breaker` | Adds a fraction of the other columns' scores. | Independent of stemming. |

**Not settled by the docs, and important for the prototype:**

- **`phrase_prefix` with stems.** The docs don't say whether the last token is stemmed before the prefix expansion. If it is, a stem such as "comedi" (Porter's stem of "comedy" and "comedies") is a useful prefix, but a partially typed word can be stemmed into a prefix that matches nothing. The prototype uses `phrase_prefix with (slop=1)` today as a plural workaround. With a stemming analyzer, plain `phrase` with `slop` is the documented, predictable choice.
- **Stop words inside phrases.** The docs don't say whether a removed stop word leaves a position gap. If it does, "end of the galaxy" needs slop to match as a phrase. The docs' own example uses `slop=4` with the `english` analyzer for exactly that phrase, which suggests gaps exist.
- **`fuzziness` on stems.** The docs don't describe the interaction. A typo can change the stem by more than the typo's own edit distance. Title search, not evidence search, is the natural place for fuzziness. Keep a non-stemmed column for it.

## ADD COLUMN with a full-text index on a populated table

**Docs.** The `ALTER TABLE` synopsis allows `ADD [COLUMN] column_name data_type [column_constraint ...]`, and the column constraints include `INDEX USING FULLTEXT [WITH (analyzer = analyzer_name)]` ([ALTER TABLE](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html)). The [ADD COLUMN section](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html#add-column) says "columns can be added at any time". Only two cases need an empty table or fail: a generated column, and a base column with a `DEFAULT` clause. The [fulltext search page](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html) confirms that a full-text index is defined "either with CREATE TABLE or ALTER TABLE ADD COLUMN".

**A docs contradiction, resolved.** The [fulltext indices page](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/fulltext-indices.html#index-definition) warns: "Creating an index after a table was already created is currently not supported." That warning covers two real limits:

- An existing column can't gain or change an index.
- `ALTER TABLE` can't add a named or composite index. The grammar's [`addColumnDefinition`](https://github.com/crate/crate/blob/5.10.9/libs/sql-parser/src/main/antlr/io/crate/sql/parser/antlr/SqlBaseParser.g4) accepts only column constraints. `INDEX name USING FULLTEXT (...)` is a table element and exists only in `CREATE TABLE`.

A new column with its own column-level index isn't covered by the warning.

**Custom analyzers need 5.10.3 or later.** The [5.10.3 release notes](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.3.html) record a fix for "an issue that would prevent usage of a column with a custom ANALYZER which has been added to a table with ADD COLUMN". The cluster runs 5.10.9, so the fix applies. [`CommonAnalyzerITest`](https://github.com/crate/crate/blob/5.10.9/plugins/es-analysis-common/src/test/java/io/crate/analysis/common/CommonAnalyzerITest.java) tests the case on a plain table and on a partitioned table that already holds rows.

**Sharding.** The docs place no shard-count condition on `ADD COLUMN`. It's a metadata change. Existing rows read `NULL` until a write fills them.

**Not settled by the docs: the statement's duration on a 12-shard table of this size.** Nothing suggests that it rewrites data, but the docs don't state it. The scratch-table prototype should time it on a copy.

### What the backfill costs

**The docs give no cost figures.** These facts bound it:

- **Measured.** Table `movie` holds 1,343,056 rows and 88.7 GB of primary data, about 66 KB per row. Table `show` holds 246,579 rows and 4.2 GB. 127,059 movie rows have `essence_text`, which matches the ticket's figure of about 126,000 titles.
- **Inference from Lucene's design.** Lucene has no in-place update. An `UPDATE` that sets the new column rewrites the whole row: CrateDB reads the row, marks the old document as deleted, and indexes a new one with all columns analyzed again. A backfill of 127,000 rows at about 66 KB each therefore rewrites on the order of 8 GB, plus the replica copy, plus later segment merges. Rows with fingerprints are probably larger than the average row, so treat 8 GB as a lower bound.
- **Docs.** Deleted documents keep their disk space until merges discard them ([soft deletes](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-table.html#soft-deletes-enabled)).

The new column itself is small next to that: a few hundred bytes of evidence text per title. The cost is the row rewrite, not the new index. The sync flow should backfill in batches, and the scratch-table prototype should measure rows per second on a sample before anyone writes to production.

### Changing an analyzer later

An analyzer can't change without a rebuild. Three doc statements settle it:

- "Altering analyzers is not supported yet" ([fulltext indices](https://cratedb.com/docs/crate/reference/en/5.10/general/ddl/fulltext-indices.html#creating-a-custom-analyzer)).
- "If `analyzer_name` already exists, its definition is updated, but existing tables will continue to use the old definition" ([CREATE ANALYZER](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-analyzer.html)).
- `ALTER TABLE` has no clause that alters an existing column's index ([ALTER TABLE synopsis](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html#synopsis)).

The rebuild doesn't have to cover the table. The unit of rebuild is the column:

1. Create the new analyzer under a new name, for example `evidence_en_v2`.
2. Add a second column with that analyzer.
3. Backfill the second column.
4. Switch the query to it.
5. Drop the old column. `DROP COLUMN` needs a table created on 5.5 or later and doesn't work for a column that a named index uses ([DROP COLUMN](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html#drop-column)).

Each analyzer change costs one more full backfill. That argues for settling the analyzer on a scratch table first, and for versioned analyzer names from the start. It also argues against synonyms inside the analyzer.

## What dominates match latency

**The docs don't settle this.** The reference has no performance guidance for `match`. The measurements below answer the question for this cluster.

### The match predicate is fast

**Measured** on `movie`, four runs each, server-side duration as reported by CrateDB:

| Query | Matches | Server time |
| --- | --- | --- |
| `count(*) where match((essence_text 2.0, synopsis), 'dialogue dialogues')` | 12,284 | 11 to 15 ms |
| Same, top 200 by `_score`, `tmdb_id` only | 200 | 14 to 17 ms |
| Same for 'heist heists' | | 7 to 14 ms |

A common word isn't slow to match or to score.

### The object null check is the slow part

**Measured**, same table, each filter combined with the same "dialogue" match:

| Filter added to the match | Server time |
| --- | --- |
| None | 11 ms |
| `goodwatch_overall_score_voting_count >= 2000` | 12 ms |
| `essence_text IS NOT NULL` | 14 ms |
| `fingerprint_scores['<one key>'] IS NOT NULL` | 12 ms |
| `fingerprint_scores IS NOT NULL` | 201 to 377 ms |
| `fingerprint_scores IS NOT NULL` alone, without a match | 4,300 to 7,000 ms |

The prototype's full pool query, with `essence_tags`, 12 fingerprint subcolumns, and `LIMIT 300`:

| Request | With `fingerprint_scores IS NOT NULL` | With `essence_text IS NOT NULL` |
| --- | --- | --- |
| "dialogue dialogues" | 460 to 1,120 ms server | 76 ms server |
| "love loves" | 985 ms server | 94 ms server |

Both filters select the same 127,059 rows.

**Source.** [`IsNullPredicate`](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/io/crate/expression/predicate/IsNullPredicate.java) explains the cost. For an object column, it builds a Boolean query with one exists-clause per child column, and it adds a generic per-row function check for empty objects. `fingerprint_scores` has 74 child columns. A common word yields more candidate rows, so the per-row check runs more often. That's why "dialogue" was slow and a rare word wasn't.

### Settings and changes that reduce latency

In order of effect:

1. **Replace the object null check.** Use `essence_text IS NOT NULL`, or later `evidence IS NOT NULL`. The match predicate already implies a non-null text column, so the filter can often go away. This is a webapp change and needs no schema change.
2. **Fetch few, narrow columns for the pool.** Measured: adding `title` and `essence_text` to a top-200 query raised client time from about 50 ms to about 100 ms. The whole `fingerprint_scores` object raised it to 700 to 1,300 ms. The prototype already fetches display columns only for the final 20. Keep that.
3. **Keep the pool `LIMIT` small.** Rows are about 66 KB on average, and each fetched row costs a stored-document read.
4. **`cutoff_frequency`** limits the scoring influence of very common tokens ([match options](https://cratedb.com/docs/crate/reference/en/5.10/general/dql/fulltext.html#options)). The measurements show no need for it yet.
5. **Segment count.** Measured: `movie` has 272 segments across 12 primary shards. [`OPTIMIZE TABLE`](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/optimize.html) merges segments. With match at about 12 ms, it isn't needed for search. It can reclaim space after the backfill.

The measurements ran from a dev machine, so client times include the network. Server times are the comparable figures.

## Open questions for the scratch-table prototype (#104)

1. Does `CREATE ANALYZER` accept an inline `synonyms = [...]` list on 5.10.9?
2. Does the `evidence_en` sketch run as written, including the `possessive_english` stemmer?
3. Which stemmer gives the best results on real requests: Porter (`english`), `kstem`, or `minimal_english`?
4. Do `phrase` and `slop` match across array elements, if the prototype indexes arrays directly?
5. Does a removed stop word leave a position gap in phrases?
6. How long does `ADD COLUMN` take on a 12-shard copy, and how many rows per second does the backfill reach?

## What this means for literal matching (#107)

- Stemming closes the plural gap but not the synonym gap. "rich" and "wealthy" share no stem.
- Index-time synonyms are possible in principle but frozen into the index, file-based per the docs, and untested inline.
- Query-side expansion works today. `match` joins tokens with `OR`, and boosts and `cutoff_frequency` control how much an expanded word counts.

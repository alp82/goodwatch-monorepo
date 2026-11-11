# Exact trope and title searches

A complete, unambiguous trope or title name resolves before the combined search starts translation, paid admission, JEV or semantic ranking. Exact tropes use canonical membership; exact titles use the existing Like candidates. Queries outside those two namespaces retain the semantic search path. Essence tags are deliberately excluded because they are not deduplicated.

## Matching

`server/search-resolution.server.ts` reads the existing palette trope catalogue and loaded title-name index. A per-build map includes titles, original titles and indexed localized aliases. Trope names deduplicate by their canonical URL. Names normalize Unicode, case and whitespace; they do not use fuzzy or prefix matches.

Only presentable, non-adult titles with a score and at least 1,000 votes can become similarity references. Cited years and explicit `like`/`similar to` references narrow a match. Multiple candidates, ambiguous remakes and bare names that also fully describe structured filters retain ordinary search behavior. No arbitrary title or trope is selected. Quoted titles and cited years can make the intent explicit. A cold catalogue also retains the existing path instead of inventing a match.

The title map is built once per loaded index, and the trope map refreshes with the existing palette snapshot. No additional title index or essence-tag lookup is introduced. Initial catalogue warming starts with the search role.

## Execution and filters

`combined-search/resolved.server.ts` uses the existing Like candidate set or the trope-membership set, then applies eligibility, adult policy, genres, years, streaming, people and title scopes through parameterized catalogue reads. Empty membership or zero eligible results stays empty. A failed resolved retrieval fails the request; it never falls through to a paid interpretation.

The new `trope` Discover parameter holds a canonical `https://tvtropes.org/pmwiki/pmwiki.php/Main/...` URL. The title-filter engine gives it its own fail bit, hidden/recovery counts, removable chip, independent clearing and cache identity. Membership includes known redirected references and HTTP/www variants. The existing `similar` parameter continues to hold numeric title keys.

Known trope links from title pages and the command palette go directly to `?trope=...`, without a text search. Typed exact searches return resolution metadata. Discover converts that response into an ordinary shareable filter URL and clears the semantic query. Start retains the reading, browses the full catalogue with the resolved filter, and carries it into See all. It discards the temporary search candidates, so accidental constraints read from a title name cannot narrow its final results. Manually chosen filters win. A whole-title/trope match drops accidental filters inferred from words inside its name; a residual match preserves the query's other parsed constraints.

The shared combined-search entry point serves web, TV, MCP, Discord and YepWatch. Existing clients can ignore the extra response field. No request-body field, provider question contract or paid-reading cache key changes. Page and search images can roll separately; complete behavior needs both updated.

## Observability

Resolved combined searches record `outcome=resolved`, zero charged nanodollars, the existing invocation attribution and `ranker_version=exact-trope-v1` or `exact-title-v1`. No spending reservation or ledger row is created. Existing columns already support these values; no database migration is required. Failed/undelivered resolved results do not invent completed history.

Direct filter links browse without invoking combined search, so they create no combined-search history row. History request volume must not be interpreted as all discovery activity.

## Verification

Tests cover exact names and aliases, years/remakes, vocabulary collisions, unresolved/negated phrases, URL round-trips, chips and clearing, strict empty membership, filter-cache identity and start-page parameter propagation. A composition test makes language, JEV and semantic ranking fail if reached by a resolved search. An opt-in local CrateDB integration runs the real membership, alias and retrieval SQL and verifies eligibility and filter intersections.

The recorded 1,238-query sample from November 11 was replayed with the current public trope catalogue and canonical/original title names: 27 trope matches and 36 title matches (63, 5.1%). This replay excludes localized title aliases, which the production resolver also recognizes. No provider calls were made. This first release intentionally leaves most of that sample on the existing semantic path.

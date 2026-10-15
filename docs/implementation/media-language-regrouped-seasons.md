# Media language: regrouped display seasons

Design note for item 4 of issue #592, written 2026-10-15. It covers docs only and adds no code, table or
migration. The release policy stays as it is: a regrouped display season is labelled by its number and
never borrows canonical season text.

## Where things stand

- A reviewed `EpisodeMapping` (`app/domain/tracking/episode-mappings.server.ts`) gives selected shows a
  display numbering. MF GHOST (show 154526) is the only active one. TMDB has one regular season of 37
  episodes. The mapping shows three display seasons of 12, 12 and 13 episodes, matching IMDb.
- `buildEpisodePresentation` groups episodes into `seasons[]` by `displaySeason` alone. A display
  season has no identity beyond that number, and `-1` stands for "Additional episodes".
- Season translations (`doc.season_translation`) are keyed by `(show_id, tmdb_id, language, country)`,
  where `tmdb_id` is a canonical TMDB season. No page reads season names or overviews today. The grid
  and the episode list show "Season N" labels only (surface matrix, details row).
- Episode text is unaffected: it attaches through the episode's TMDB ID, which a regrouped episode
  keeps.

So nothing is wrong today. The risk only appears once someone adds a visible season-name reader. The
easy join, "display season N reads canonical season N", would label MF GHOST display season 1 with the
text of TMDB season 1, which describes all 37 episodes. Display seasons 2 and 3 would get no text, or
the wrong text.

## Identity

A display season, called a bucket below, is identified by `(show_id, alignment_namespace, bucket_key)`.

| Part | Meaning | Rule |
|---|---|---|
| `show_id` | TMDB show ID | Same as every other media key. |
| `alignment_namespace` | Which grouping the buckets come from, for example `imdb` | Stable for the life of the mapping. It is **not** `mapping.version`: a reviewed fix to one entry bumps the version and must not orphan text. |
| `bucket_key` | A short string the reviewed mapping owns, for example `part-1` | Written by the reviewer next to the entries. Independent of the display ordinal, so renumbering or inserting a bucket keeps the keys. Never derived from membership. |

Membership is kept separate, as a **source revision**. It is a hash of the sorted member TMDB episode
IDs. Text stored for a bucket records the revision it was written for. When the membership changes,
for example an episode joins the bucket or moves out of it, the identity stays the same but the stored
text no longer matches. The reader then falls back to the number label until the text is reviewed
again. This is the same split as the presentation's `version()`, which already hashes the catalog
shape for stale-action checks.

`-1` ("Additional episodes") never gets a bucket key. It holds the trailing unreviewed episodes, and
it keeps its English interface label.

## Reading rule

For each display season, in this order:

1. **Proved equivalence.** If the bucket's member episode IDs are exactly the regular episodes of one
   canonical TMDB season, read `season_translation` for that canonical season. For a mapping that only
   renumbers, this covers every bucket with no new data. For MF GHOST it covers none.
2. **Bucket text.** If bucket text exists for `(show_id, alignment_namespace, bucket_key)` in the
   language, and its stored source revision equals the current membership hash, use it.
3. **Fallback.** Otherwise use the existing "Season N" label, marked as English, as today.

The rule never matches by display number or by episode count.

## When to build it

Build it only when both of these hold:

- A visible season-name or season-overview reader exists. It is deferred today (surface matrix).
- There is a source of bucket text that the settled scope allows. Paid translation is out. The only
  candidate is TMDB episode groups. A bucket derived from a reviewed episode group could store that
  group's ID as its `bucket_key`. Whether TMDB serves translated group names at all is unverified.
  Check that against the API before any design work, and it needs TMDB credentials, which cloud
  sessions don't have.

Until then, step 1 is the only part worth having. It needs no table, but it also has no consumer, so
it is not added now.

## Shape when it is built

- Mapping: an optional `buckets: { key: string; display: number }[]` on `EpisodeMapping`, next to
  `entries`, plus `alignmentNamespace`. The presentation's `seasons[]` gains `bucketKey` and
  `membershipRevision`.
- Table (additive, same shape as the existing two):
  `doc.display_season_translation (show_id, alignment_namespace, bucket_key, language_code,
  country_code, name, overview, source_revision)`, with the primary key on the first five columns
  and clustered by `show_id`.
- Cache: a new namespace for the bucket read. `episode-presentation-v2` is already keyed by mapping
  version.
- Tests (`node --test`):
  - A renumber-only mapping reads canonical text through equivalence.
  - MF GHOST reads no canonical text for any display season.
  - A stale `source_revision` falls back to the label.
  - `-1` never reads text.
  - Changing the display ordinal of a bucket keeps its text.

## Not in scope

Page prose, generated text and the "Season N" and "Additional episodes" interface labels stay English,
as settled. Watched history, imports and Mark or Unmark keep canonical TMDB episode IDs (ADR 0012).
Nothing here changes them.

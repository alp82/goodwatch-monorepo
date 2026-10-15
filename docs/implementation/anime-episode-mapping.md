# Anime entry placement for imports

Built for [#646](https://github.com/alp82/goodwatch-monorepo/issues/646), under map #365.
Episode placement is courtesy of [Anime-Lists/anime-lists](https://github.com/Anime-Lists/anime-lists).
Tracker identities are courtesy of [Fribb/anime-lists](https://github.com/Fribb/anime-lists).
Anime-Lists and Fribb have no license. The owner approved server-side use on
2026-10-15. User-visible credit for both datasets appears on the MyAnimeList / Kitsu receipt
([#647](https://github.com/alp82/goodwatch-monorepo/issues/647)). The research is
`docs/research/imports/episode-numbering.md` on `research/episode-numbering` (#610).
These mappings select canonical TMDB episodes; they never alter catalog numbering,
episode presentation (ADR 0012), or stored watch identities.

## Storage and refresh

`anime_mapping_snapshot` is a Crate reference table defined in
`goodwatch-flows/windmill/f/sync/models/crate_schemas.py`, using the existing
schema initializer and `CrateConnector`. Like other reference ingests, Windmill
owns the download and refresh; the webapp only reads the published data.

One row (`id = 'current'`) holds a JSON payload, its SHA-256 version and refresh
time. On 2026-10-15 the full sources normalized to 7,093 entries and approximately
916 KB. One atomic upsert is simpler than per-entry rows with staging tables or
version-pointer joins. It prevents partial crosswalk/offset refreshes in Crate,
which has no multi-statement transactions. No Mongo copy, web request to GitHub,
process-global cache, or bundled production dataset is needed. The webapp indexes
the snapshot once per preview and reuses each entry's validated progress mapping.

The refresh downloads Anime-Lists' **master XML**, preserving `tmdbtv`,
`tmdbseason`, `tmdboffset`, and regular AniDB episode ranges with an explicit
`tmdbseason`. It uses Fribb only for `anidb_id`, `mal_id`, `anilist_id` and
`kitsu_id`; its TMDB/TVDB placements do not override the master. Source SHA-256s
are recorded in the payload. TVDB-only ranges and AniDB special-episode ranges
are not interpreted as regular tracker progress. Entries with explicit individual
TMDB mapping lists are retained as unsupported, not approximated by an offset.

Both downloads must parse before publication. Download sizes and durations are
bounded. Empty/malformed inputs and a greater-than-10% decline in entry or tracker
identity counts fail the run and preserve the previous row. The script and flow
serialize executions. The weekly flow defaults to `dry_run: false` (including
omitted arguments); the script keeps `dry_run: true` for direct invocation.
Every run checks the published row: if it remains older than eight days, the
refresh fails so monitoring cannot report a successful stale dry run. A publishing
run verifies the stored refresh time after the atomic write and can repair a stale
snapshot. An initial dry run before any row exists is allowed. Replacing the whole
payload removes withdrawn mappings.
A failed download never starts publication; a failed publish leaves the previous
row or the complete replacement, never half a dataset. The weekly schedule is
visible to the existing schedule-based monitoring. After three weeks without a
successful refresh, the webapp leaves anime rows unmatched with a retry reason.

## Adapter contract

`ImportObservation.animeEntry` and `EpisodeEvidence.animeEntry` contain:

```ts
{ source: "myanimelist", id: 50602, progress: 13, completed: true, episodeCount: 13 }
```

Sources are `anidb`, `myanimelist`, `anilist`, or `kitsu`. Unknown totals must be
omitted, not sent as zero. Adapters set `completed: true` for a completed entry;
anime placement rejects that entry unless `episodeCount` is provided. For reported
progress `n`, an adapter emits `n` watch
observations with `episode: 1` through `n`, repeating the full `progress` and
known `episodeCount` on **every** row. The observation key must be stable per
tracker entry, episode and explicit pass. `tmdbId` may be null; preview finds the
parent through the same pinned crosswalk used by the episode resolver.
`resolveAnimeParent(entry, animeMappings, showId?)` owns uniqueness and parent
validation for both paths. The lookup dependency is required by both resolver
constructors, so each preview explicitly supplies its one pinned snapshot.
Conflicting or ambiguous identities are unmatched. Explicit parent IDs must agree when anime
placement is used.

File adapters still use `previewImport`; trusted server adapters may use
`previewParsedImport(userId, fileName, parsed)` with normalized observations. Both
share classification, journal, confirm, receipt and undo. Ordinary file uploads
consume their freshly parsed observations without cloning; the normalized adapter
entry point alone copies caller-owned input. This is a server module
boundary, not a new client endpoint. MyAnimeList and Kitsu XML uploads use this boundary through `previewImport`;
AniList file parsing remains a separate build.

Resolution uses TMDB episode ID, then TVDB episode ID, then anime placement.
Once anime placement is attempted, failure is final: the resolver does not guess
from a group, episode name or the source's season coordinates.

- Numeric placement adds the entry offset to its regular source number.
- TMDB ranges override the default season/offset for their inclusive source range.
- `tmdbseason="a"` uses continuous regular catalog episode numbers only when they
  are globally unique. Existing range season boundaries must agree. This handles
  One Piece's continuous TMDB numbering despite the master's relative offsets.
  If TMDB numbers restart per season, explicit ranges must cover the requested
  progress; missing ranges are not inferred by summing season lengths.
- Every number from 1 through the larger of progress and known total must resolve
  uniquely to a different live catalog episode of the same show. Missing seasons,
  short seasons, holes, overlapping ranges and many-to-one results reject **every**
  row of the entry. This validates current catalog data, rather than caching a
  `fits` flag that could become stale. If only an individual episode number is
  known, validation covers 1 through that number.
- The resolver returns `datePolicy: "unknown"` for anime progress, even when an
  authoritative episode ID wins or the source gives only a cour finish date.
  Issue #647 adds optional `startedAt` and `finishedAt` date evidence: only a
  completed entry with progress equal to its known total and identical valid
  calendar dates establishes one viewing day for all its episodes. That case
  returns `datePolicy: "day"` and `watchedAt`; spans, partial dates and missing
  dates remain unknown. Preview applies the result without making an
  anime-specific date decision, and the member can still discard all dates.
  The file adapter strips Kitsu click-time dates before resolving; all Kitsu
  episode watches remain undated.
  Specials mapped explicitly by the entry are flagged by the existing receipt and
  never count as regular progress.

A cour's completion must never be emitted as a whole-show Seen operation. A watch
observation with `animeEntry` but no episode is unmatched. Only mapped episode
watches reach the existing tracking writer, which derives Watching/Seen using its
settled rules and preserves explicit member states. Want to See and genuine
show-level observations remain independent of a failed episode placement. Any
`rating` or `review` observation carrying `animeEntry` is retained as unsupported,
even if it already has a TMDB show ID. There is no adapter override to apply a
cour score as a whole-show rating.

MyAnimeList/Kitsu scores are unsupported observations with their numeric `score`
and source entry evidence retained. The shared resolver’s `animeEntryPlacement`
uses the same snapshot and catalog validation as watch placement to resolve the
full entry, independent of watched progress. Preview persists the mapping and
concrete season/episode ranges in `animeScorePlacement` in the existing durable
import-item payload (the container also used for unapplied Trakt ratings). A
missing total or unresolved placement retains the available evidence, null ranges
and a reason. Receipt evidence survives apply and Undo without a `user_score`
write. No DDL is needed. See [native imports](native-imports.md#myanimelist-and-kitsu)
for the owner’s 2026-10-16 entry-score decision.

## Rollout (not performed on this branch)

1. Review and create only `anime_mapping_snapshot` using its `SCHEMAS` definition.
   The shared `f/sync/init/cratedb` supports `dry_run: true`, but its apply scans all
   schemas: review all proposed changes or use just this table's generated DDL.
2. Deploy `f/anime_mapping` (folder, refresh script/metadata/lock, weekly flow) and
   the updated schema module through the normal Windmill deployment. The refresh
   lock reuses the existing `f/db/cratedb` dependency versions. No new credentials
   are required: the two datasets are public and Crate uses the existing variables.
3. Run the refresh with `dry_run: true`. Review counts, unsupported entries, source
   versions and payload size. Then run once with `dry_run: false` and verify the
   current row's version and refresh time. Do not enable consumers before seeding.
4. Create an enabled weekly schedule for `f/anime_mapping/weekly`, Mondays at
   03:20 UTC, with arguments `{ "dry_run": false }`. The checked-in flow defaults
   to publishing; the script defaults to dry run. Neither creates or enables a
   schedule. Confirm the first scheduled job succeeds and appears in the existing scheduled-workflow health checks.
5. Deploy the webapp with the shared resolver changes. Run an anime adapter preview,
   confirm, receipt, re-upload and undo in staging when that adapter is available.
   Verify a completed Spy x Family Part 2 creates only episodes 13–25 and does not
   mark the whole show Seen. Verify stale mappings remain unmatched with reasons.

Rollback: stop the refresh schedule and revert the consumer if needed; the new
reference table can remain. Existing import receipts retain their resolved canonical
identities, and apply/undo do not re-resolve against a later dataset snapshot.

## Verification and remaining work

Fixtures cover Frieren, Spy x Family, Attack on Titan, Bleach and One Piece from
the measured research shapes; catalog episode IDs are synthetic. Raw fixture
extracts and their normalized snapshot are in
`goodwatch-flows/tests/fixtures/anime_mapping`. Python tests cover parsing,
publishing, failed refresh and crosswalk shrink; resolver tests cover placement,
precedence, ambiguity and stale snapshots. The import service test proves preview,
apply, receipt and undo with the real tracking writer and fake database boundaries.

No production database, Windmill deployment, live schedule or real member import
was exercised. Individual episode mapping lists (including split/merged episodes)
remain unsupported. Upstream corrections for structurally stale placements remain
upstream work; matching counts alone cannot establish editorial correctness.

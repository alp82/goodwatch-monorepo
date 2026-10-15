# Sources that number episodes differently from TMDB

Research date: 2026-10-15. Status: research and a proposal for [issue #610](https://github.com/alp82/goodwatch-monorepo/issues/610), not an approved implementation plan. It builds on [the import sources inventory](../import-sources-inventory.md) and takes the rule from [the map, issue #365](https://github.com/alp82/goodwatch-monorepo/issues/365) as given: episodes come from TMDB in TMDB's numbering, and that stays.

Method: official API references and contribution guides, live read-only TMDB API calls, the three mapping datasets downloaded and parsed in full, first-party and open-source importer code read on GitHub, and read-only `SELECT` queries against production Crate (`episode`, `season`, `show`, `user_import_item`). No account was signed in to, nobody was contacted, nothing was written, and nothing here is legal advice.

Labels: **confirmed** means read from a first-party source (official docs, the owner's own code or data, a live API response, or our own measurement). **Secondary** means read in a third-party importer, forum or search excerpt of a page that refused automated fetches. **Unconfirmed** means not established.

## Summary

1. **Trakt already speaks TMDB.** Every Trakt episode carries a TMDB episode id ([schema](https://github.com/trakt/trakt-api/blob/f4d56611c7/projects/api/src/contracts/_internal/response/episodeIdsResponseSchema.ts), confirmed). The one production Trakt import has 2,834 episode watch rows, and all 2,834 matched a TMDB episode (Crate, confirmed). Trakt moved its TV data to TMDB in 2021 (secondary).
2. **Simkl numbers TV shows like TVDB, and anime like Japanese cours.** Simkl's docs say TVDB is its primary TV source and that each anime cour is its own title with episodes restarting at 1. Simkl has no TMDB or IMDb episode ids; it offers TVDB episode ids on request (confirmed, [Simkl docs](https://api.simkl.org/conventions/standard-media-objects)).
3. **TVDB's aired order often differs from TMDB's.** In a hand-picked sample of 18 popular non-anime shows, 8 have at least one season whose episode count differs between TVDB and TMDB, and 4 of 5 popular anime differ (measured, confirmed). TMDB exposes alternative orders as user-contributed episode groups, and its `find` endpoint resolves a TVDB episode id to a TMDB episode (confirmed, live API).
4. **Anime trackers need a dataset.** A MyAnimeList, AniList or Kitsu entry is one cour; TMDB keeps one show with seasons and often merges cours (Jujutsu Kaisen is one TMDB season of 59 episodes). Only [Anime-Lists/anime-lists](https://github.com/Anime-Lists/anime-lists) records the TMDB season and episode offset per entry. [Fribb/anime-lists](https://github.com/Fribb/anime-lists) republishes it with MyAnimeList, AniList, Kitsu and Simkl ids. [Kometa Anime-IDs](https://github.com/Kometa-Team/Anime-IDs) currently ships no TMDB ids at all (confirmed).
5. **The dataset is mostly right but stale where TMDB restructured.** Of 4,414 finished TV entries checked against our catalog, 4,201 (95.2%) fit their TMDB season and offset, and 213 point at a season TMDB no longer has or that is too short, including Jujutsu Kaisen season 2 and Solo Leveling season 2 (measured, confirmed).
6. **License is the main risk.** Anime-Lists and Fribb have no license file; an open issue asks for one ([#613](https://github.com/Anime-Lists/anime-lists/issues/613)). Kometa is MIT but drops the data we need. The id crosswalk from anime-offline-database is ODbL (confirmed).
7. **Netflix needs a parser plus TMDB episode groups.** Netflix rows are title strings with labels such as "Part 3", "Volume 4", "Limited Series" or a season name, and are localized (secondary). For Money Heist, Netflix's Parts 1 and 2 are TMDB specials, and TMDB's Netflix episode group maps each part to TMDB episode ids (confirmed, live API).

**Proposal in brief:** resolve each episode row by the strongest evidence it carries, in this order: TMDB episode id, TVDB episode id through TMDB `find`, a validated dataset offset (anime), a TMDB episode group (Netflix parts and volumes), and season and number only for sources numbered by TMDB. Accept a match only when it is unique and belongs to the matched show. When the show matches but the episode does not, apply only what is show-level by nature (status, Want to See, a title-level rating) and list the episode row on the receipt as unmatched with a reason. Never turn a per-cour or per-part completion into Seen for the whole TMDB show. [Proposal](#proposal) has the details.

## How GoodWatch matches episode rows today

- The shared import contract already carries `episodeTmdbId`, `season` and `episode` on each observation ([imports.ts](../../../goodwatch-webapp/app/domain/imports.ts), confirmed).
- The preview accepts an episode only when it belongs to the matched show. The TMDB episode id wins; season and number are a fallback only when they identify exactly one current catalog episode ([preview.server.ts:109](../../../goodwatch-webapp/app/server/imports/preview.server.ts), confirmed).
- The `episode` table has `imdb_id` and `tvdb_id` columns, documented as "NULL until an import or backfill resolves them; the copy never writes them" ([crate_schemas.py:376](../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py), confirmed). On 2026-10-15 both are NULL on all 6,774,335 live rows (Crate, confirmed).
- The show-level TVDB id is in TMDB's `external_ids`, which the details model stores in Mongo ([models.py:569](../../../goodwatch-flows/windmill/f/tmdb_api/models.py), confirmed). The Crate `show` table has `imdb_id` and `wikidata_id` but no `tvdb_id` (Crate, confirmed).
- In TMDB's season payload, episodes carry no external ids; only the season's own TVDB id comes back with `append_to_response=external_ids` (live call on Jujutsu Kaisen season 1, confirmed). Per-episode TVDB ids need one `/tv/{id}/season/{n}/episode/{e}/external_ids` call each (live call, confirmed).

## Anime trackers

This covers MyAnimeList, AniList, Kitsu, and anime in Simkl.

### One entry per cour against one TMDB show

- **Trackers split by cour.** MyAnimeList has separate entries for Attack on Titan season 3 and season 3 part 2 (ids 35760 and 38524), and for Spy x Family part 1 and part 2 (50265 and 50602). AniList and Kitsu ids line up one to one with these entries in the mapping data (Fribb `anime-list-full.json`, confirmed). Simkl says it "uses the anime-native model (each cour is its own title, episodes restart at 1)" ([Simkl](https://api.simkl.org/conventions/standard-media-objects), confirmed).
- **TMDB merges.** TMDB's anime rules: "Episodes airing in a split cour format (e.g. Episodes 1-13, break, Episodes 14-26) are added in a single season", "When the episode count is restarted (i.e. the first episode is Episode 1), the new episodes are added as a new season", and "International broadcast should not be used as templates for anime" ([TMDB episodes bible](https://www.themoviedb.org/bible/tv/59f743289251416e71000037?language=en-US), confirmed). A February 2026 Talk thread quotes a former moderator: "back to one season for nearly all anime series", and users are asking for TVDB-style splits; the rules are unchanged so far ([TMDB Talk](https://www.themoviedb.org/talk/6996a5a14fbedd07461b0bdb), secondary).
- **Trackers report progress, not episode rows.** MyAnimeList's list status has `num_episodes_watched`, `start_date` and `finish_date`; AniList's media list has `progress`, `startedAt`, `completedAt` and `repeat`, and its media carries `idMal` (read in [Yamtrack's MAL](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c244/src/integrations/imports/mal.py) and [AniList](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c244/src/integrations/imports/anilist.py) importers, secondary; field names match the [inventory](../import-sources-inventory.md)). So an anime row becomes "episodes 1 to n of this entry", and the entry has to be placed inside a TMDB season.

TMDB structure in our catalog for well-known anime (Crate `season` and `episode`, 2026-10-15, confirmed):

| Show (TMDB id) | TMDB regular seasons, episodes each | What trackers have |
| --- | --- | --- |
| Jujutsu Kaisen (95479) | 1 season, 59 | Three TV entries: 24, 23 and 12 episodes |
| Frieren (209867) | 1 season, 38 | Two entries; the 2026 entry maps to season 1 at offset 28 |
| Solo Leveling (127532) | 1 season, 25 | Two entries of 12 and 13 |
| Spy x Family (120089) | 3 seasons: 25, 12, 13 | Part 2 maps to season 1 at offset 12 |
| Attack on Titan (1429) | 4 seasons: 25, 12, 22, 28 | Season 3 part 2 at offset 12; Final Season part 2 at offset 16; the Final Chapters special at offset 28 of season 4, which TMDB keeps as specials 36 and 37 |
| Bleach (30984) | 2 seasons: 366, 50 | Thousand-Year Blood War has three entries at offsets 0, 13 and 26 of season 2 |
| Demon Slayer (85937) | 5 seasons by arc: 26, 7, 11, 11, 8 | One entry per arc, offset 0 |
| One Piece (37854) | 23 seasons, episode numbers continue across seasons (season 2 starts at 62) | One entry of 1,100+ episodes |
| Naruto Shippuden (31910) | 20 seasons, numbers continue (season 2 starts at 33, season 20 ends at 500) | One entry of 500 |

Breadth: of the 100 most popular Japanese animated shows in the catalog, 43 have a single TMDB season and 28 of those have more than 26 episodes, which usually means several tracker entries in one TMDB season (Crate, confirmed). Across the catalog, 5,564 shows are Japanese animation; 829 have one season with more than 26 episodes (Crate, confirmed).

### Absolute episode numbers

- Some TMDB shows number episodes continuously across seasons. Of 41,752 shows with a season 2, 555 start season 2 above episode 1; among Japanese animation it is 14 of 826 (Crate, confirmed). One Piece and Naruto Shippuden are examples.
- For such a show, a tracker's episode n is the TMDB episode whose `episode_number` is n in any regular season. Anime-Lists marks these entries with `tmdbseason="a"` (70 entries) and may add per-range mappings: One Piece maps AniDB episodes 62 to 77 to TMDB season 2 with offset -61 ([anime-list-master.xml](https://github.com/Anime-Lists/anime-lists/blob/996d6a8b98/anime-list-master.xml), confirmed). Only 10 entries carry such TMDB ranges, against 1,426 with TVDB ranges (parsed, confirmed).
- Trakt also keeps an absolute number, `number_abs`, on episodes and accepts check-ins by it ([episode schema](https://github.com/trakt/trakt-api/blob/f4d56611c7/projects/api/src/contracts/_internal/response/episodeResponseSchema.ts), [check-in schema](https://github.com/trakt/trakt-api/blob/f4d56611c7/projects/api/src/contracts/checkin/schema/request/showCheckinRequestSchema.ts), confirmed).

### Simkl anime

- Simkl anime ids include `anidb`, `mal`, `anilist` and `kitsu`. "For episode-ID lookups in scrobble / sync writes, Simkl accepts only `tvdb` and `anidb` at the episode level", and "Episode-level `imdb` and `tmdb` IDs do not exist on Simkl" ([Simkl](https://api.simkl.org/conventions/standard-media-objects), confirmed).
- `extended=full_anime_seasons` on `/sync/all-items` "adds `mapped_tvdb_seasons`" at show level and "a `tvdb: { season, episode }` block on every anime episode"; `episode_tvdb_id=yes` adds TVDB episode ids ([Simkl sync guide](https://api.simkl.org/guides/sync), confirmed). So a Simkl connection can deliver TVDB coordinates and ids, never TMDB ones.
- Whether the Simkl JSON backup file contains these blocks is unconfirmed; the inventory already lists the backup schema as unknown.

## TVDB-ordered sources

This covers TV Time, Simkl TV, and Kodi, Plex, Jellyfin and Emby libraries scraped with TVDB.

### How TVDB orders episodes

- TVDB's v4 API returns a series' episodes per season type: `official` (aired), `dvd`, `absolute`, `alternate` and `regional`, and each episode has `absoluteNumber`, `airsBeforeSeason` and `airsAfterSeason` fields ([TVDB OpenAPI 4.7.10](https://thetvdb.github.io/v4-api/swagger.yml), confirmed).
- TVDB staff rule: "we follow the original dates and orders from the country of origin", and "Aired Orders are precisely that, the order episodes actually aired in" ([TVDB support FAQ](https://support.thetvdb.com/kb/faq.php?id=5), confirmed).
- TMDB's general rule is the same intent: "reproduce the seasons exactly as they first aired on the original network", with anime as the exception ([TMDB seasons bible](https://www.themoviedb.org/bible/tv/59f73eb49251416e71000026?language=en-US), confirmed). Same intent, different editors: the two still diverge.

### How often TVDB's aired order differs from TMDB's

Per-season regular episode counts from TMDB's API and TVDB's public series pages, 2026-10-15. The sample is popular shows plus Paw Patrol and Miami Vice, chosen because users reported them when Trakt switched sources. It is not random. Equal counts do not prove equal order.

| Show | TMDB vs TVDB | Same? |
| --- | --- | --- |
| Game of Thrones, Breaking Bad, Doctor Who (2005), Rick and Morty, NCIS, Supernatural, Futurama, Stranger Things, Money Heist | Identical season counts | Yes |
| The Simpsons | Identical except the airing season 38 (6 vs 7) | Yes, apart from refresh lag |
| The Office (US) | Seasons 4, 6, 7: 14/19, 24/26, 24/26 | No |
| Friends | Seasons 4 to 10 differ by one or two (for example 23/24, 23/25) | No |
| Grey's Anatomy | Seasons 3, 4, 6, 8, 11 differ by one or two | No |
| Family Guy | Season 8: 20/21 | No |
| Miami Vice | Season 5: 20/21 | No |
| Bluey | Season 3: 49/50 | No |
| SpongeBob SquarePants | Seasons 3 onward differ (for example 40/36, 47/34) | No |
| PAW Patrol | Every season differs (47/48, 50/48 and so on) | No |
| Attack on Titan | Season 4: 28/30; TVDB counts the two Final Chapters specials as regular | No |
| Jujutsu Kaisen | TMDB 1 season of 59; TVDB 24, 23, 12, plus a fourth season | No |
| One Piece | Both 23 seasons, split differently (season 1: 61/8) | No |
| Naruto Shippuden | TMDB 20 seasons with continuous numbers; TVDB 22 seasons restarting at 1 | No |
| Pokémon | TMDB 25 seasons, TVDB 20; diverge from season 8 | No |
| Demon Slayer | Identical | Yes |

So 8 of 18 non-anime shows and 4 of 5 anime differ in at least one season, and Pokémon differs too (measured from [TMDB](https://developer.themoviedb.org/reference/tv-series-details) and pages such as [TVDB Friends](https://thetvdb.com/dereferrer/series/79168), confirmed). The pattern points at two-part episodes and 11-minute segments counted differently (unconfirmed). The earlier [IMDb alignment audit](../season-episode-scores/episode-alignment-audit.md) found the same phenomenon against IMDb: 47.6% of 40,216 shows differ in per-season shape.

A wider measurement needs a TVDB API key, which GoodWatch does not hold; the [inventory](../import-sources-inventory.md) notes TVDB's paid licensing.

### TMDB episode groups

- `GET /3/tv/{series_id}/episode_groups` lists a show's groups with `type`, `name`, `group_count`, `episode_count` and `network` ([reference](https://developer.themoviedb.org/reference/tv-series-episode-groups), confirmed). `GET /3/tv/episode_group/{id}` returns groups in `order`, each with episodes carrying TMDB `id`, `season_number`, `episode_number` and an `order` within the group ([reference](https://developer.themoviedb.org/reference/tv-episode-group-details), confirmed).
- Types: 1 Original air date, 2 Absolute, 3 DVD, 4 Digital, 5 Story arc, 6 Production, 7 TV (same reference, confirmed).
- `append_to_response=episode_groups` works on TV details, so the group list comes with the details call GoodWatch already makes (live call on Attack on Titan, confirmed).
- TMDB's anime guide: "Any alternative order including but not limited to the TV cours, the US seasons ... can be created with episode groups" ([TMDB episodes bible](https://www.themoviedb.org/bible/tv/59f743289251416e71000037?language=en-US), confirmed).
- **Groups are community edits, not a TVDB mirror.** Attack on Titan has 12 groups, none named after TVDB. Jujutsu Kaisen has 6, including "Seasons" twice with different episode totals (64 and 69). Money Heist has a type 2 test group named "TMDB助手E2E-可删除" with 0 episodes (live calls, confirmed). A group is usable only after it is checked against the source's structure.
- **TVDB ids resolve directly.** `GET /3/find/{id}?external_source=tvdb_id` supports TV episodes ([reference](https://developer.themoviedb.org/reference/find-by-id), confirmed). TVDB episode 9000784 returns Jujutsu Kaisen season 1 episode 25 (TMDB episode 4562708). TVDB reuses numbers across types: `find` for 267440 returns both the Attack on Titan series and an unrelated episode, so the caller must read only `tv_episode_results` for episode ids (live calls, confirmed).
- TMDB's rate limit is "somewhere in the 40 requests per second range" ([rate limiting](https://developer.themoviedb.org/docs/rate-limiting), confirmed).

### TV Time

- Trakt's own TV Time parser reads `episode_id` from the native export as a TVDB episode id, and the newer export's `series-episodes` file has `series_tvdb_id` and `tvdb_id` columns ([TvTimeNativeParser.ts](https://github.com/trakt/trakt-web/blob/0e301c1496/projects/client/src/lib/sections/settings/import/parsers/TvTimeNativeParser.ts), [TvTimeCsvParser.ts](https://github.com/trakt/trakt-web/blob/0e301c1496/projects/client/src/lib/sections/settings/import/parsers/TvTimeCsvParser.ts), secondary: Trakt's code, TV Time's format). Trakt handles five TV Time export variants (same file).
- TV Time shut down on 2026-07-15 ([inventory](../import-sources-inventory.md), secondary).

### Media servers

- **Kodi:** the default TV scraper is `metadata.tvshows.themoviedb.org.python` ([Kodi settings.xml](https://github.com/xbmc/xbmc/blob/master/system/settings/settings.xml), confirmed). That scraper reads a TMDB episode group from the show's NFO URL and renumbers episodes by the group's order ([scraper.py](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/blob/69f4e19301/lib/scraper.py), confirmed). Kodi's XML export writes `season`, `episode` and `uniqueid` elements with a `type` ([VideoInfoTag.cpp](https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoInfoTag.cpp), confirmed). Which uniqueid types an episode gets depends on the scraper (unconfirmed).
- **Plex:** search excerpts of Plex's support pages say the TV Series agent defaults to TMDB aired order, offers TheTVDB aired, DVD and absolute orders per library, and per show since Plex Media Server 1.40.4 ([advanced settings](https://support.plex.tv/articles/advanced-setting-plex-tv-series-agent/), [naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/), secondary: the pages refused fetches).
- **Jellyfin:** the built-in TMDB provider reads a per-series or per-season `TmdbEpisodeGroup` provider id and fetches episodes through that group ([TmdbEpisodeProvider.cs](https://github.com/jellyfin/jellyfin/blob/aec42b345e/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbEpisodeProvider.cs), [TmdbEpisodeGroupId.cs](https://github.com/jellyfin/jellyfin/blob/aec42b345e/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbEpisodeGroupId.cs), confirmed). TVDB is a separate plugin ([jellyfin-plugin-tvdb](https://github.com/jellyfin/jellyfin-plugin-tvdb), confirmed).
- **Emby:** not checked (unconfirmed).
- **Consequence:** a media server's season and episode numbers are in whatever order that library or show was set to. Only the episode's provider ids are order-independent.

## Netflix

- **No ids, only strings.** Rows read `Show: Season label: Episode`. Real examples from Ryot's tests: `Stranger Things: Stranger Things 4: Chapter Nine: The Piggyback`, `The OA: Part II: Chapter 8: Overview`, `Dear White People: Volume 4: Chapter VIII`, `Zero Day: Limited Series: Episode 6`, `3 Body Problem: Season 1: Countdown`, `Money Heist: Part 3: A Quick Vacation` ([netflix_formats.rs](https://github.com/IgnisDa/ryot/blob/a96986e025/crates/services/miscellaneous/lookup/src/tests/netflix_formats.rs), secondary).
- **Many rows carry no episode number.** Ryot's tests assert that `3 Body Problem: Season 1: Countdown` and `Money Heist: Part 3: A Quick Vacation` yield no episode, and it treats "Part 3" as no season (same file, lines 149 and 161, secondary). Those rows can only match by episode name.
- **Labels are localized.** Ryot supports English exports only ([Ryot docs](https://github.com/IgnisDa/ryot/blob/a96986e025/apps/docs/src/importing/netflix.md), secondary). [Netflix-to-Trakt-Import](https://github.com/jensb89/Netflix-to-Trakt-Import/blob/1299f5068d/NetflixTvShow.py) parses German rows such as `Staffel 2 – Teil B`, matches episode names against TMDB names in the profile's language via episode translations, and clamps a season number above TMDB's season count to the last season "(example: Lupin)" ([netflix2trakt.py](https://github.com/jensb89/Netflix-to-Trakt-Import/blob/1299f5068d/netflix2trakt.py), secondary). Movary skips show rows entirely ([converter](https://github.com/leepeuker/movary/blob/main/src/Service/Netflix/NetflixActivityItemsConverter.php), secondary).
- **Parts and volumes vs TMDB seasons.** Simkl: "Netflix refers to each drop as a new Part, but SIMKL and TVDB catalog them as Seasons" ([Simkl docs](https://docs.simkl.org/how-to-use-simkl/getting-started-with-simkl/basic-navigation/tv-shows-tracking/parts-vs-seasons-tv-show-formats), confirmed for Simkl's statement). TMDB examples (live calls and Crate, confirmed):
  - **Money Heist (71446):** TMDB seasons 1 to 3 have 15, 16 and 10 episodes, following Antena 3; TVDB's aired order is the same. Netflix's re-edited Parts 1 and 2 (13 and 9 episodes) are TMDB specials 1 to 22. The Netflix type 4 group "Parts (edited version)" maps Part 1 to specials 1-13, Part 2 to specials 14-22, Parts 3 and 4 to season 2 episodes 1-8 and 9-16, and Part 5 to season 3.
  - **Stranger Things (66732):** TMDB season names are "Stranger Things 2" to "Stranger Things 5", the same label Netflix uses. Volumes are not separate seasons; the "Release Volumes" group splits seasons 4 and 5, and `episode_type` marks `mid_season` at season 4 episode 7 and season 5 episode 4.
  - **Lupin (96677):** TMDB season 1 holds Parts 1 and 2; seasons 2 and 3 are named "Part 3" and "Part 4". A Netflix type 4 "Parts" group exists.
- **Coverage of groups.** Of 38 popular Netflix shows, 9 have any episode group, 6 have a group about parts or volumes, and 4 have a group tied to Netflix (live calls, confirmed). The rest (Squid Game, The Crown, Ozark and others) have plain seasons, where a "Season N" label maps directly.
- **Matching names needs translations.** The catalog stores one episode name per episode (Crate `episode.name`). Matching a German or Spanish export by name needs TMDB episode translations, one call per episode (as in Netflix-to-Trakt-Import, secondary).

## Trakt and Simkl TV

- **Trakt:** episodes carry `trakt`, `tvdb`, `imdb` and `tmdb` ids ([episodeIdsResponseSchema.ts](https://github.com/trakt/trakt-api/blob/f4d56611c7/projects/api/src/contracts/_internal/response/episodeIdsResponseSchema.ts), confirmed). Trakt announced "We're switching to TMDB as the primary data source for TV shows" in January 2021 ([quoted on the Sonarr forum](https://forums.sonarr.tv/t/trakt-is-switching-to-tmdb-as-the-primary-data-source-for-tv-shows/27524), secondary: the Trakt blog did not resolve). Measured: the one production Trakt import has 2,834 show watch rows, all with a TMDB episode id, all `new`, none unmatched (Crate `user_import_item`, aggregate only, confirmed). One member's history is a small sample, and Trakt can lag a TMDB renumbering; the TMDB id survives a renumbering, season and number do not.
- **Simkl TV:** "SIMKL relies on TVDB (TheTVDB.com) as its primary metadata provider for TV shows" ([Simkl docs](https://docs.simkl.org/how-to-use-simkl/getting-started-with-simkl/basic-navigation/tv-shows-tracking/parts-vs-seasons-tv-show-formats), confirmed) and syncs TVDB changes "within 24 to 48 hours" ([TVDB for TV shows](https://docs.simkl.org/how-to-use-simkl/faq/how-to-add-new-shows-missing-episodes-and-movies-to-simkl/tvdb-for-tv-shows), confirmed). Simkl's season and number are therefore TVDB's. Yamtrack's Simkl importer uses them as TMDB season and number unchanged ([simkl.py](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c244/src/integrations/imports/simkl.py), secondary), which breaks on every show in the "No" rows above.

## Mapping datasets compared

Snapshots parsed on 2026-10-15: Anime-Lists `996d6a8b98`, Fribb `e25609f8ee`, Kometa `5d10523a8a`, anime-offline-database release `2026-42` (confirmed).

| | [Anime-Lists/anime-lists](https://github.com/Anime-Lists/anime-lists) | [Fribb/anime-lists](https://github.com/Fribb/anime-lists) | [Kometa-Team/Anime-IDs](https://github.com/Kometa-Team/Anime-IDs) | [anime-offline-database](https://github.com/cedya77/anime-offline-database) |
| --- | --- | --- | --- | --- |
| Keyed by | AniDB id | AniDB id where known; 39,638 entries | AniDB id; 17,050 entries | One entry per anime; 38,137 entries per its README |
| Tracker ids | AniDB only | MAL 30,877; AniList 20,874; Kitsu 22,366; Simkl 14,680; AniDB 16,012 | MAL 14,051; AniList 13,449 | Source URLs for MAL, AniList, Kitsu, AniDB and others |
| TMDB show id | 7,093 entries | 7,135 TV, 1,393 movie entries | None in the data | None |
| TMDB season | 7,093, including 70 `a` (absolute) | 7,021; absolute entries carry no season (One Piece) | None | None |
| TMDB episode offset | 522 `tmdboffset`; 10 entries with TMDB ranges | 520; ranges dropped | None | None |
| TVDB season and offset | 7,514 series ids; 645 offsets; 1,426 with ranges | 7,438 seasons, 643 offsets | 7,514 `tvdb_season`; `tvdb_epoffset` on every entry, 0 by default | None |
| Episode counts | No | No | No | Yes |
| Freshness | Community PRs; list regeneration several times a week, last 2026-10-14 | Automated weekly, last 2026-10-13 | Daily at 00:00 UTC, last 2026-10-14 | Weekly releases, last 2026-10-12 |
| License | None in repo | None in repo | MIT | ODbL 1.0 plus DbCL 1.0 |
| Built from | Hand-edited master XML | Anime-Lists plus anime-offline-database, gaps filled by TMDB search | Anime-Lists plus anime-offline-database | Its own crawler, continuing manami-project |

Sources: counts parsed from [anime-list-master.xml](https://github.com/Anime-Lists/anime-lists/blob/996d6a8b98/anime-list-master.xml), [anime-list-full.json](https://github.com/Fribb/anime-lists/blob/e25609f8ee/anime-list-full.json) and [anime_ids.json](https://github.com/Kometa-Team/Anime-IDs/blob/5d10523a8a/anime_ids.json); format and cadence from each README ([Anime-Lists](https://github.com/Anime-Lists/anime-lists/blob/996d6a8b98/README.md), [Fribb](https://github.com/Fribb/anime-lists/blob/e25609f8ee/README.md), [Kometa](https://github.com/Kometa-Team/Anime-IDs/blob/5d10523a8a/README.md), [anime-offline-database](https://github.com/cedya77/anime-offline-database/blob/main/README.md)) and commit history; all confirmed.

Notes:

- **Kometa's README promises `tmdb_show_id`, but the data has none.** The block that read TMDB ids from AnimeAggregations is commented out in [update_anime_ids.py](https://github.com/Kometa-Team/Anime-IDs/blob/5d10523a8a/update_anime_ids.py) (lines 120 to 138), and `anime_ids.json` contains no `tmdb` key (confirmed). Kometa now serves TVDB-based tools only.
- **Fribb flattens.** For One Piece, Anime-Lists has `tmdbseason="a"` plus TMDB ranges; Fribb's entry has no season and no offset (confirmed). Fribb is the easiest id crosswalk, not the best offset source.
- **Anime-Lists offsets mean:** "Number to add to each regular AniDB.net episode number to get the corresponding" episode in the given season; `tmdboffset` is "Same as `episodeoffset`, but for TheMovieDB" ([README](https://github.com/Anime-Lists/anime-lists/blob/996d6a8b98/README.md), confirmed).

### Accuracy against the catalog

Each Anime-Lists entry with a TMDB show, a numeric regular season and no TMDB ranges was checked against Crate's `season` table, using the episode count from anime-offline-database for entries that are finished TV series (measured 2026-10-15, confirmed):

| Result | Entries |
| --- | ---: |
| Entries checked (finished TV, show in catalog) | 4,414 |
| Season exists and holds offset plus all episodes | 4,201 (95.2%) |
| TMDB season does not exist | 125 |
| TMDB season too short | 88 |
| Of the 213 failures, started 2020 or later | 55 |

Failures include Jujutsu Kaisen (2023) mapped to TMDB season 2 (TMDB has one season), Solo Leveling season 2, Dan Da Dan (2025), Blue Lock vs. U-20 Japan, and Rurouni Kenshin Kyoto Disturbance. The check only catches mappings that point outside TMDB's seasons. A mapping that fits but lands on the wrong episodes passes, so 95.2% is an upper bound. The dataset's TMDB fields also look derived from TVDB placement in many entries: of 5,460 regular entries with both, only 57 place TVDB and TMDB differently, although Jujutsu Kaisen alone shows they differ more (parsed, confirmed; the cause is unconfirmed).

Coverage for GoodWatch: of the 100 most popular Japanese animated shows in the catalog, 95 have a Fribb TMDB TV mapping, and 87 of them a MAL id on it; for the top 500 it is 466 and 449. The misses in the top 100 are Sazae-san and a few recent or borderline titles (measured, confirmed).

### License

- Anime-Lists and Fribb have no license file (GitHub API reports `license: null`, confirmed). An open issue asks the maintainers to add CC0, and another user asks whether server-side use in a commercial app is allowed; there is no maintainer answer ([#613](https://github.com/Anime-Lists/anime-lists/issues/613), confirmed). A 2022 thread got only a community reply that use "should be fine ... as long as its credited" ([#143](https://github.com/Anime-Lists/anime-lists/issues/143), secondary: not a maintainer).
- Kometa is MIT ([LICENSE](https://github.com/Kometa-Team/Anime-IDs/blob/5d10523a8a/LICENSE), confirmed) but holds no TMDB data, and its MAL and AniList ids come from anime-offline-database.
- anime-offline-database is "made available under the Open Database License v1.0 ... free to share and adapt it, including commercially, provided you attribute it, keep any redistributed database under the same licence" ([README](https://github.com/cedya77/anime-offline-database/blob/main/README.md), confirmed). Using it server-side with an attribution notice fits; publishing a derived crosswalk would carry ODbL.
- The season and offset data GoodWatch needs exists only in Anime-Lists. Using it is a license decision for the owner, not a technical one.

## Proposal

### Resolution order for an episode row

Apply the first rule the row supports. Each rule must yield exactly one live TMDB episode of the show the row's title already matched; otherwise fall through.

1. **TMDB episode id** (Trakt; media servers whose episode carries one). This is today's rule.
2. **TVDB episode id** (TV Time, Simkl with `episode_tvdb_id=yes`, media servers scraped with TVDB). Look up `episode.tvdb_id` first; on a miss call TMDB `find` with `external_source=tvdb_id`, read only `tv_episode_results`, and require `show_id` to equal the matched show. Write the result into `episode.tvdb_id`, the column reserved for this. Cost is one request per distinct unseen TVDB episode id: a 5,000-episode TV Time history is about two minutes at TMDB's rate limit, then cached for everyone.
3. **Anime entry offset** (MyAnimeList, AniList, Kitsu, Simkl anime). Map the entry's id through the crosswalk to an AniDB id, then to TMDB show, season and offset. Accept the range only if the season exists and holds offset plus progress episodes. For `a` entries, use TMDB ranges if present, or match `episode_number` across regular seasons when the show numbers continuously. The entry's progress n becomes TMDB episodes offset+1 to offset+n.
4. **TMDB episode group** (Netflix "Part N" and "Volume N", and media servers set to a group). Pick a group only by an explicit rule: type 4 with network Netflix, or a name containing "Part" or "Volume" with as many groups as the source has parts. The label's number is the group's `order`; the episode number is the position within the group. A group yields TMDB episode ids directly.
5. **Season and episode number** only for sources numbered by TMDB: Trakt, and media server libraries in TMDB aired order with no group. Never for TVDB-numbered sources, where 8 of 18 popular shows differ.
6. **Episode name** (Netflix rows without a number). Exact, case-insensitive match within the resolved season or group, English names first. Other languages only if TMDB translations are fetched for that show.

### Per source

| Source | Episode rows mapped by | Applied at show level only | To the receipt as unmatched |
| --- | --- | --- | --- |
| Trakt | Rules 1, 2, 5 | Show rating, Want to See, favorites (as today) | Episode not in the catalog by id or unique season and number |
| Simkl TV | Rule 2 (API with `episode_tvdb_id=yes`); backup file only if it carries TVDB ids | Status (watching, hold, dropped, plantowatch), title rating | Rows without a TVDB episode id, or ids `find` can't resolve: "Simkl numbers episodes like TVDB" |
| Simkl anime, MyAnimeList, AniList, Kitsu | Rule 3; Simkl also rule 2 | Status; the entry's score only when it is the member's only entry for that TMDB show; otherwise kept unapplied like a season rating | The episodes of an entry with no mapping or a mapping that doesn't fit: "This anime season isn't mapped to TMDB yet" |
| TV Time (saved exports) | Rule 2 | Want to See from followed shows | Unresolved TVDB ids |
| Kodi, Plex, Jellyfin, Emby | Rules 1, 2; rule 4 if the show names a TMDB group; rule 5 only for TMDB aired order | Rating, play count | Rows with only season and number from a TVDB-ordered library |
| Netflix | Rules 4, 5 (label "Season N", "Limited Series" as season 1, or a label equal to a TMDB season name), 6 | Thumbs rating on the title | Rows whose label or episode can't be resolved: "Netflix lists this as Part 3 without an episode number" and similar |

### What applies at show level only

- Status, Want to See and a title-level rating apply when the show matches, whatever happens to its episodes. These carry no episode position.
- A completed per-cour, per-part or per-season source entry never becomes Seen on the TMDB show. It marks its mapped episodes as watched, and the tracking rules derive Watching or Seen from the log.
- A per-cour score on a show with several entries is a season rating. Season ratings are out of scope and stay unapplied ([#365](https://github.com/alp82/goodwatch-monorepo/issues/365)).
- Anime progress has no per-episode dates. Mapped episodes are bulk watches with "don't know when", following the rule that a bulk mark is never dated by guess.

### What goes to the receipt as unmatched

- The row's show didn't match (as today).
- The show matched, but no rule produced exactly one episode. The reason names the rule that came closest: no mapping, mapping outside TMDB's seasons, season label not understood, episode name not found, more than one candidate.
- Rows that resolve to TMDB specials (season 0) are applied, because specials can be watched and never count. The receipt says so, since Money Heist's Netflix Parts 1 and 2 land there.

### Data to keep

- A small `anime_mapping` table refreshed weekly: tracker ids from anime-offline-database (or Fribb), TMDB show, season, offset and ranges from Anime-Lists, the snapshot version, and a `fits` flag from the catalog check above. Rows that don't fit are never used.
- `episode.tvdb_id`, filled by rule 2 as imports resolve ids.
- No stored copy of TMDB episode groups; fetch them per show at preview time with the details call.

## Open questions

1. **License for Anime-Lists.** Use it server-side with attribution, ask the maintainers (issue #613 is open), or skip anime episode rows and apply anime at show level only.
2. **Money Heist-like cases.** Netflix Parts 1 and 2 map to TMDB specials, which never count, so the show stays unstarted. Accept that, or map such parts to the regular season when the episode count matches.
3. **Localized Netflix exports.** Fetch TMDB episode translations per show (one call per episode), or support English labels and names only, as Ryot does.
4. **Simkl backup contents.** Whether the JSON backup carries TVDB episode ids or the anime TVDB block decides whether file uploads can map Simkl episodes at all. It needs a real backup file.
5. **Media server inputs.** Which uniqueid types Kodi's TMDB scraper writes per episode, and whether Plex history exposes episode guids for TMDB and TVDB, need a real export.
6. **Wider TVDB divergence.** The 18-show sample is not random. A TVDB API key would allow a catalog-wide count, but rule 2 makes the number matter less.
7. **Dataset repair.** Report the 213 failing mappings upstream, or keep a local override file as Kometa does with `anime_id_edits.json`.
8. **Finish dates.** Whether an anime entry's finish date may date its last mapped episode, or every episode stays "don't know when".

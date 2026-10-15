# Kodi and Tautulli export files

Research date: 2026-10-15. Issue: [#612](https://github.com/alp82/goodwatch-monorepo/issues/612), part of [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Background: [Import sources inventory](../import-sources-inventory.md) and the `ImportObservation` contract in `goodwatch-webapp/app/domain/imports.ts`.

This note answers two questions. What do Kodi's library export and Tautulli's exporter produce? Can a normal member make those files without scripts?

## How to read this note

Each claim carries one of three labels:

- **Confirmed** means read in a first-party source: the product's own code at a pinned commit, or its own wiki.
- **Secondary** means read in a third-party source, such as a forum post or a library's docstring about another product.
- **Unconfirmed** means not established.

No Kodi installation or Tautulli server was run, and no real export file was opened. Every file structure below is derived from the code that writes it. [What still needs a real file](#what-still-needs-a-real-file) lists what to check before building.

Sources are pinned to these commits:

- Kodi `master` at [`ca2ccdc`](https://github.com/xbmc/xbmc/tree/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d), the code that becomes Kodi 22. Kodi 22 "Piers" was at [release candidate 1 on 2026-09-27](https://github.com/xbmc/xbmc/releases/tag/22.0rc1-Piers). Key lines were also checked on the `Omega` branch (Kodi 21, the current stable) at [`f8815ee`](https://github.com/xbmc/xbmc/tree/f8815ee40f49a700c047982d752be4b2a61420e2).
- Tautulli `master` at [`9484667`](https://github.com/Tautulli/Tautulli/tree/9484667bc1f2d159368a999320b8f495bbfbd00a).
- The Kodi wiki blocks automated fetches (HTTP 403 behind a bot challenge). Wiki pages were read from Internet Archive snapshots, linked where cited.

## Summary

1. **Kodi can write the whole video library into one file, `videodb.xml`, from its settings screen.** No script is needed. The button is hidden at Kodi's default settings level, so a member must first switch the settings level to Advanced or Expert. **Confirmed.**
2. **Kodi stores no play history.** Each file has one play count and one last-played value. The export writes `lastplayed` as a date without a time. **Confirmed.**
3. **Kodi's `uniqueid` elements carry TMDB and IMDb ids, plus TVDB for shows and episodes,** when the library was scraped with Kodi's default TMDB scrapers. Episodes get their own TMDB episode id. **Confirmed** for the scrapers, **unconfirmed** for libraries scraped any other way.
4. **Kodi's `userrating` is a whole number from 0 to 10, where 0 means unset.** It maps to GoodWatch's 1 to 10 score unchanged. **Confirmed.**
5. **Tautulli's exporter is a button on each library page's Export tab.** It writes CSV, JSON, XML or M3U. Only a Tautulli admin can run it. **Confirmed.**
6. **Tautulli's default export level leaves out everything an import needs except the rating.** External ids (`guids.id`) start at level 2. `viewCount` and `lastViewedAt` start at level 3. **Confirmed.**
7. **The exporter holds library metadata only, not play history.** Its view counts and ratings belong to the Plex account whose token Tautulli uses, normally the server owner. Tautulli's per-play history has no CSV download in the UI. It is reachable only through the API or by downloading the whole SQLite database. **Confirmed.**

## Kodi

### Menu route

The export is a settings action. It sits at **Settings > Media > Library > Video library > Export library**:

- The `videolibrary.export` setting is in section `media` ("Media"), category `library` ("Library"), group 2 ("Video Library") ([settings.xml L1006-L1065](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/system/settings/settings.xml#L1006-L1065); labels in [strings.po L8627-L8629, L8672-L8674, L8782-L8784, L8834-L8836](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L8834-L8836)). **Confirmed.**
- The setting has `<level>2</level>` ([settings.xml L1062-L1065](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/system/settings/settings.xml#L1062-L1065)). Level 2 is `Advanced` ([SettingLevel.h L20-L23](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/settings/lib/SettingLevel.h#L20-L23)). Kodi's default settings level is `Standard` ([ViewStateSettings.cpp L200-L203](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/view/ViewStateSettings.cpp#L200-L203)). So the button is hidden until the member raises the settings level. **Confirmed.** Where the level switch sits on screen depends on the skin. **Unconfirmed.**
- Pressing the button runs the built-in `exportlibrary(video)` ([MediaSettings.cpp L347-L348](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/settings/MediaSettings.cpp#L347-L348)). **Confirmed.**

The dialog flow is in [LibraryBuiltins.cpp L126-L227](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/interfaces/builtins/LibraryBuiltins.cpp#L126-L227). **Confirmed:**

1. A dialog titled "Export video library" asks "Export to a single file or separate files per entry?" with the buttons **Single file** and **Separate** (L144-L148; strings [#647](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L3079-L3081), [#20426, #20428, #20429](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L14230-L14247)). Single file is the "No" button and Separate is the "Yes" button ([DialogHelper.h L64](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/messaging/helpers/DialogHelper.h#L64)).
2. **Single file:** Kodi asks nothing else. A folder browser titled "Choose export folder" opens on local, network and removable drives (L131-L135, L212-L217; string [#661](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L3151-L3153)).
3. **Separate:** Kodi asks "Export thumbnails and fanart?", then "Export actor thumbs?" if thumbnails were chosen, then "Overwrite old files?" (L152-L208; strings [#20430, #20431](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L14250-L14256), [#20436](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po#L14280-L14282)). No folder is asked for.

The wiki describes the same flow and warns that single file "is not the recommended export method" for backups ([Import-export library/Video, archived 2026-04-04](https://web.archive.org/web/20260404042627/https://kodi.wiki/view/Import-export_library/Video)). That warning is about re-importing into Kodi. It does not matter for reading the file. **Confirmed.**

### Single file versus separate files

**Single file** writes one folder named `kodi_videodb_YYYY-MM-DD` in the chosen location. The folder holds `videodb.xml` and the subfolders `actors`, `movies`, `moviesets`, `musicvideos` and `tvshows` ([VideoDatabase.cpp L11169-L11188](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11169-L11188)). Single file always exports artwork and actor thumbnails (L11177-L11181). The Kodi 21 code uses the same folder name ([Omega VideoDatabase.cpp L10560](https://github.com/xbmc/xbmc/blob/f8815ee40f49a700c047982d752be4b2a61420e2/xbmc/video/VideoDatabase.cpp#L10560)). **Confirmed.** The wiki still says `xbmc_videodb_yyyy-mm-dd`, which is out of date.

For GoodWatch only `videodb.xml` matters. The artwork folders can be large, so the upload screen should ask for that one file. Whether the file is easy to find on Android TV or Fire TV devices is **unconfirmed**; the member can pick a network share or USB drive in the folder browser.

**Separate** writes one `.nfo` file next to each video file, in the media folders themselves ([VideoDatabase.cpp L11360-L11440](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11360-L11440) for movies, [L11800-L11845](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11800-L11845) for episodes). Each `.nfo` uses the same element writer as `videodb.xml`, but without file paths. Collecting hundreds of scattered `.nfo` files is not something to ask of a member. GoodWatch should accept the single file only. **Confirmed** for the structure; the recommendation is this note's.

### File structure

`videodb.xml` has this shape. It is derived from the code, not copied from a real file:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<videodb>
  <version>1</version>
  <movie version="0">...</movie>
  <movie version="0">...</movie>
  <set>...</set>
  <musicvideo version="0">...</musicvideo>
  <tvshow version="0">
    ...
    <episodedetails version="0">...</episodedetails>
    <episodedetails version="0">...</episodedetails>
  </tvshow>
  <paths>
    <path><url>...</url><scanrecursive>...</scanrecursive>...</path>
  </paths>
</videodb>
```

- The XML declaration and the `<videodb>` root with `<version>` come from [VideoDatabase.cpp L11233-L11247](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11233-L11247). The export version is `1` ([VideoDatabase.h L1332](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.h#L1332)). **Confirmed.**
- Movies come first, one `<movie>` per row of `movie_view` ([L11298-L11331](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11298-L11331)). Since Kodi 21 a movie can have several video versions. The query reads every version, so one film can appear more than once. **Confirmed** from the query; how often this happens in a real file is **unconfirmed**. The parser must deduplicate by id.
- Each `<tvshow>` is written at the top level ([L11658-L11674](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11658-L11674)). Its episodes are written inside it with `pMain->LastChild()` ([L11853-L11866](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11853-L11866)). So episodes are nested, and the show's ids are on the parent element. **Confirmed.** Kodi 21 does the same ([Omega L10984-L10987](https://github.com/xbmc/xbmc/blob/f8815ee40f49a700c047982d752be4b2a61420e2/xbmc/video/VideoDatabase.cpp#L10984-L10987)).
- `<paths>` lists scraper settings per source folder ([L11894-L11920](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11894-L11920)). It is not needed.

Every `<movie>`, `<tvshow>` and `<episodedetails>` element is written by the same function, `CVideoInfoTag::Save` ([VideoInfoTag.cpp L133-L387](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L133-L387)). The elements that matter for an import:

| Element | Written as | Source line | Label |
| --- | --- | --- | --- |
| `title` | Text | [L145](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L145) | Confirmed |
| `userrating` | Integer, always written, `0` when unset | [L168](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L168) | Confirmed |
| `season`, `episode` | Integers, on `episodedetails` and `tvshow` only | [L186-L192](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L186-L192) | Confirmed |
| `playcount` | Integer, always written | [L224](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L224) | Confirmed |
| `lastplayed` | `YYYY-MM-DD`, empty when never played | [L225](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L225), [XMLUtils.cpp L577-L580](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/utils/XMLUtils.cpp#L577-L580) | Confirmed |
| `file`, `path`, `filenameandpath`, `basepath` | Text, single-file export only | [L226-L232](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L226-L232) | Confirmed |
| `id` | The default unique id's value | [L249](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L249) | Confirmed |
| `uniqueid` | One per id, `type` attribute, `default="true"` on one | [L250-L259](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L250-L259) | Confirmed |
| `premiered`, `year` | Date, integer, when known | [L280-L283](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L280-L283) | Confirmed |
| `resume` | `position` and `total` in seconds | [L361-L372](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L361-L372) | Confirmed |
| `dateadded` | `YYYY-MM-DD HH:MM:SS`, when added to the library | [L374](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L374), [XMLUtils.cpp L587-L590](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/utils/XMLUtils.cpp#L587-L590) | Confirmed |
| `ratings/rating` | Scraped site ratings with `name` and `max="10"` | [L152-L167](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L152-L167) | Confirmed; not the member's rating |

The export has no element for a watchlist, favorites or reviews. `Save` writes none ([L133-L387](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L133-L387)). **Confirmed.** Kodi 21 writes `userrating`, `playcount`, `lastplayed` and `uniqueid` the same way ([Omega VideoInfoTag.cpp L137, L189-L190, L208-L217](https://github.com/xbmc/xbmc/blob/f8815ee40f49a700c047982d752be4b2a61420e2/xbmc/video/VideoInfoTag.cpp#L189-L190)). **Confirmed.**

### `uniqueid` types

Kodi writes whatever id types the scraper stored. It does not fix a list ([VideoInfoTag.cpp L250-L259](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L250-L259)). What the default scrapers store:

| Item | Types | Source | Label |
| --- | --- | --- | --- |
| Movie | `tmdb` (default), `imdb` when TMDB has one | [metadata.themoviedb.org.python tmdb.py L169-L173](https://github.com/xbmc/metadata.themoviedb.org.python/blob/26846ba84632f9b0dc3f0957c83e8049a384ddd1/python/lib/tmdbscraper/tmdb.py#L169-L173), [scraper.py L143](https://github.com/xbmc/metadata.themoviedb.org.python/blob/26846ba84632f9b0dc3f0957c83e8049a384ddd1/python/scraper.py#L143) | Confirmed |
| TV show | `tmdb` (default), `imdb`, `tvdb` | [metadata.tvshows.themoviedb.org.python `nexus` data_utils.py L70, L129-L143](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/blob/92dfe5e627da2445f7b68efee8d82236d1835e09/libs/data_utils.py#L129-L143); `piers` branch [scraper.py L688-L695](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/blob/69f4e193013767b09bc4600c9c23f04e9712b1a9/lib/scraper.py#L688-L695) | Confirmed |
| Episode | `tmdb` is the TMDB **episode** id (default), plus `imdb` and `tvdb` episode ids | `nexus` [data_utils.py L347-L349](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/blob/92dfe5e627da2445f7b68efee8d82236d1835e09/libs/data_utils.py#L347-L349); `piers` [scraper.py L810-L820](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/blob/69f4e193013767b09bc4600c9c23f04e9712b1a9/lib/scraper.py#L810-L820) | Confirmed |

The wiki lists `imdb`, `tvdb` and `tmdb` as examples. It says hand-made entries may use any value, such as `home001` ([NFO files/Movies, archived 2025-11-26](https://web.archive.org/web/20251126125230/https://kodi.wiki/view/NFO_files/Movies)). Libraries scraped with older or third-party scrapers, or built from hand-written `.nfo` files, may have only `tvdb`, only `imdb`, or nothing useful. **Unconfirmed** how common that is.

When a file has no `uniqueid` at all, older files put the id in `<id>` alone, and Kodi's own reader falls back to it ([VideoInfoTag.cpp L1343-L1348](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L1343-L1348)). Its type is then unknown. A parser can still recognize `tt` followed by digits as an IMDb id.

### `userrating` scale

- Kodi clamps the member's rating to 0 through 10, and "0 will unset the userrating" ([VideoInfoTag.cpp L2067-L2074](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L2067-L2074)). It is an integer (`m_iUserRating`, written with `SetInt` at [L168](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L168)). **Confirmed.**
- The export writes no `max` attribute on `userrating`. Kodi's reader accepts one on hand-made files and normalizes to 10 ([L1298-L1302](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L1298-L1302)). A GoodWatch parser should do the same if it ever sees one. **Confirmed.**
- Movies, shows and episodes each have their own `userrating` (the show's comes from the `tvshow` row, [VideoDatabase.cpp L5222](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L5222)). **Confirmed.**
- No rating date exists anywhere in the file. **Confirmed.**

This resolves the inventory's open row on the Kodi `userrating` scale, which was only believed to be 0 to 10. It is 0 to 10, whole numbers, 0 meaning no rating.

### `playcount`, `lastplayed` and watched state

Kodi keeps one `playCount` and one `lastPlayed` per file in its `files` table ([VideoDatabaseDDL.cpp L106-L108](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabaseDDL.cpp#L106-L108)). There is no play-history table. **Confirmed.** What changes them:

- **Finishing playback** calls `IncrementPlayCount`. That adds 1 and sets `lastPlayed` to now ([SaveFileStateJob.cpp L114-L131](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/utils/SaveFileStateJob.cpp#L114-L131); [VideoDatabase.cpp L6675-L6678](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L6675-L6678)). **Confirmed.**
- **Stopping before the end** calls `UpdateLastPlayed`. That sets `lastPlayed` to now and leaves the count alone ([SaveFileStateJob.cpp L149-L153](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/utils/SaveFileStateJob.cpp#L149-L153); [VideoDatabase.cpp L6680-L6683](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L6680-L6683), [L6643-L6647](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L6643-L6647)). So an unwatched item can have a `lastplayed` date. **Confirmed.**
- **Mark as watched** also calls `IncrementPlayCount`, so `lastplayed` becomes the day the member clicked, not the day they watched. **Mark as unwatched** clears both ([VideoLibraryMarkWatchedJob.cpp L78-L82](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/jobs/VideoLibraryMarkWatchedJob.cpp#L78-L82); [VideoDatabase.cpp L6641-L6645](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L6641-L6645)). **Confirmed.**

Consequences for the import:

- **Watched means `playcount` greater than 0.** A `lastplayed` date alone does not mean watched.
- **`lastplayed` is a calendar date.** The database holds a full timestamp, but `Save` writes it with `SetDate`, which drops the time ([VideoInfoTag.cpp L225](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp#L225); [XMLUtils.cpp L577-L580](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/utils/XMLUtils.cpp#L577-L580)). The wiki agrees: "Date last played as yyyy-mm-dd" ([NFO files/Movies](https://web.archive.org/web/20251126125230/https://kodi.wiki/view/NFO_files/Movies)). **Confirmed.**
- **`lastplayed` is the latest play only, and may be a "mark as watched" click.** It is never the first viewing. A play count of 3 gives one dated play and two undated ones.
- **A show's `playcount` is 1 only when every episode is watched,** and 0 otherwise ([VideoDatabase.cpp L5220, L5262](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L5258-L5262)). A show's `lastplayed` is the latest episode play ([VideoDatabaseDDL.cpp L432-L449](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabaseDDL.cpp#L432-L449)). The wiki says the same: "Will only ever show 0 or 1. Episodes track playcounts" ([NFO files/TV shows, archived 2026-04-04](https://web.archive.org/web/20260404042616/https://kodi.wiki/view/NFO_files/TV_shows)). **Confirmed.** Episodes are the real source of watches.
- **`resume/position` greater than 0 with `playcount` 0 means in progress.** It is not a watch.
- **`dateadded` is when the file joined the library.** It is not a watch date and not a Want to See date.

### Can a member make it without scripts

Yes, on any Kodi 21 or 22 device, with three hurdles:

1. Raise the settings level to Advanced so the button appears.
2. Pick a folder they can later reach from the browser they upload with.
3. Find `videodb.xml` inside the dated folder, next to artwork folders that may be large.

The data belongs to one Kodi profile on one device. Members who sync several devices through a shared MySQL database export the shared library. **Unconfirmed**, since that setup was not tested.

## Tautulli

Tautulli watches a Plex Media Server. It keeps its own play history and can export Plex library metadata.

### Menu route

The [Exporter Guide](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide#introduction) lists three entry points. **Confirmed:**

1. A library page's **Export** tab, which exports "all items for any library". The same page's Collections and Playlists tabs export those instead.
2. A user page's **Playlists** tab, for that user's playlists.
3. A media info page's **Export** tab, for one item.

For an import, the route is **Libraries > (pick the Movies or TV library) > Export tab > Export metadata**. The button sits in the library template with `data-export_type="all"` ([library.html L421-L443](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/data/interfaces/default/library.html#L421-L443)). **Confirmed.** It opens a dialog. The export runs in the background, then appears in the "Metadata Exports" table on the same tab with a download link ([Exporter Guide](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide#introduction)). **Confirmed.**

Movies and TV are separate Plex libraries, so a member with both makes two exports. **Confirmed** from the per-library route; a library can also be of another type.

Only a Tautulli admin can export or download ([webserve.py L7250-L7255, L7366-L7372](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py#L7250-L7255)). People a Plex owner shares with cannot use it. **Confirmed.**

### Formats

`FILE_FORMATS = ('csv', 'json', 'xml', 'm3u')` ([exporter.py L94](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L91-L95)). The writer for each is in [`_save_file`, L2141-L2175](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2141-L2175). **Confirmed:**

- **JSON** is a pretty-printed array with one object per top-level item. A show object holds a `seasons` array, and each season holds an `episodes` array ([L528](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L528), [L598](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L598)). This is the format to accept.
- **CSV** flattens nested fields to dotted headers like `guids.id`. Every list becomes extra rows, zipped side by side ([helpers.py L1340-L1381](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/helpers.py#L1340-L1381)). The guide warns that "a single movie may have multiple rows" ([Exporter Guide](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide#file-format)). Reading the flattening code, the continuation rows do not repeat the item's `ratingKey` or `title`. Rebuilding items from CSV is therefore fragile. **Confirmed** from code; a real file should prove it.
- **XML** wraps the same data in an `<export>` root ([L2333-L2342](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2333-L2342)). The guide notes it "is not the same as the Plex XML data". **Confirmed.**
- **M3U** is a playlist of file paths with no metadata. **Confirmed.** Not useful.

File and folder names follow `Library - {library title} - All [{section id}].{format}` inside a folder with a timestamp suffix ([L2195-L2225](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2195-L2225), [L2702-L2716](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2702-L2716)). The download is the single data file, unless images or "Export Individual Files" were chosen; then it is a ZIP ([webserve.py L7372-L7405](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py#L7372-L7405)). **Confirmed.**

### Levels

The dialog has a metadata level, a media info level, and five image or audio levels ([export_modal.html](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/data/interfaces/default/export_modal.html#L70-L190)). Metadata levels are 0 (none or custom), 1 basic, 2 extended, 3 advanced and 9 all. "Higher levels include all fields from the lower levels." The dialog preselects metadata level 1 and media info level 1 (L76, L100). **Confirmed.**

The fields an import needs and the lowest level that includes them:

| Field | Movie | Show | Season | Episode | Source |
| --- | --- | --- | --- | --- | --- |
| `ratingKey`, `title`, `year`, `guid`, `userRating` | 1 | 1 | 1 | 1 | [exporter.py L1446-L1449, L1511-L1515, L1534-L1538, L1557-L1563](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L1441-L1577) |
| `seasonNumber`, `episodeNumber`, `grandparentGuid` | | | 1 | 1 | same |
| `guids.id` (external ids) | 2 | 2 | 2 | 2 | same |
| `viewCount`, `lastViewedAt`, `lastRatedAt` | 3 | 3 | 3 | 3 | same |

The [Exporter Guide field tables](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide#movie) agree. **Confirmed.**

So the member must pick **metadata level 3** (or level 1 plus the custom fields `guids.id`, `viewCount`, `lastViewedAt`, `lastRatedAt`). At the default level 1 the file has ratings but no external ids and no watch data. The media info level adds file and codec details GoodWatch does not need; level 0 keeps the file smaller.

### External ids

- `guid` is Plex's own id. With Plex's current agents it looks like `plex://movie/5d776b59ad5437001f79c6f8` ([Tautulli's bundled python-plexapi, video.py L21](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/lib/plexapi/video.py#L21)). It carries no TMDB or IMDb id. **Secondary**, since this is a library docstring about Plex.
- `guids.id` holds the external ids. The bundled library describes them as "the guid for external metadata sources (e.g. IMDB, TMDB, TVDB, MBID)" ([python-plexapi media.py L941-L952](https://github.com/pushingkarmaorg/python-plexapi/blob/dea7cad9227ec976fa93c363c43c01b3cee305af/plexapi/media.py#L941-L952)). The values use the prefixes `imdb://`, `tmdb://` and `tvdb://` ([Plex forum, includeGuids feature request](https://forums.plex.tv/t/add-includeguids-url-parameter-to-return-external-guids/735620)). **Secondary.**
- The exporter reloads every partial item before reading it ([exporter.py L2400-L2408](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2400-L2408)), which fetches the full item with its `Guid` tags. **Confirmed** for the reload; that the reload includes `Guid` tags is **secondary**.
- Items matched with Plex's legacy agents have a `guid` such as `com.plexapp.agents.imdb://tt…` and may have no `guids` list. Tautulli's own API docs show such a legacy guid, `com.plexapp.agents.thetvdb://121361/6/1?lang=en` ([webserve.py L1934](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py#L1930-L1936)). **Secondary.** The parser should read ids from `guids.id` first and fall back to a legacy `guid`.
- For episodes, the `tmdb://` value should be the TMDB episode id. **Unconfirmed.**

### Whose data, and is it history

- The exporter connects to Plex with `plexpy.CONFIG.PMS_TOKEN` for library exports. Only playlist exports use another user's token ([exporter.py L1904-L1920](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L1904-L1920)). **Confirmed.** Plex returns `viewCount`, `lastViewedAt` and `userRating` for the account that owns the token. That account is normally the server owner. **Secondary**: this is Plex behavior, not Tautulli's.
- So a library export describes the owner's own watching and rating. A household member who watches under a separate Plex account is not in it.
- `viewCount` is "count of times the item was played", `lastViewedAt` is "datetime the item was last played", and `userRating` is "rating of the item (0.0 - 10.0) equaling (0 stars - 5 stars)" ([bundled video.py L25, L38-L39](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/lib/plexapi/video.py#L21-L39)). **Secondary.** Plex rates in half stars, so `userRating` should be a whole number from 1 to 10. **Unconfirmed** until a real file shows it.
- Dates are written with `datetime_to_iso` ([exporter.py L212](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L212); [helpers.py L255-L260](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/helpers.py#L255-L260)). The bundled library turns Plex's epoch seconds into a naive local datetime unless a timezone is configured, and the default is none ([bundled utils.py L333-L349, L372-L382](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/lib/plexapi/utils.py#L333-L382); [bundled `__init__.py` L21](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/lib/plexapi/__init__.py#L21)). So `lastViewedAt` looks like `2026-10-12T21:43:05`, in the Tautulli host's local time, with no offset. **Confirmed** from code.
- **The exporter holds no per-play history.** It exports one object per library item, each with one count and one last-viewed date ([exporter.py L2080-L2105](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py#L2080-L2105)). The guide says "the exporter only exports metadata" ([Exporter Guide](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide#introduction)). **Confirmed.**
- Items deleted from Plex are not in the export, even if they were watched. **Confirmed** from the code path, which lists the library as it is now.

### Tautulli's play history

Tautulli records one row per playback session for every Plex user, in `session_history` and `session_history_metadata` ([`__init__.py` L655-L703](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/__init__.py#L655-L703)). The history row's only content id is Plex's `guid`; there is no IMDb or TMDB column. **Confirmed.**

There is no history download in the UI. The History page has edit, filter, refresh and column buttons only ([history.html L26-L68](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/data/interfaces/default/history.html#L26-L68)). **Confirmed.** Two routes exist:

- **The API.** `get_history` returns JSON rows with `date`, `started`, `stopped` (epoch seconds), `user_id`, `rating_key`, `parent_rating_key`, `grandparent_rating_key`, `media_index`, `parent_media_index`, `guid`, `percent_complete` and `watched_status`. It supports `user_id`, `media_type`, `start` and `length` ([webserve.py L1890-L1980](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py#L1890-L1980)). The API is on by default ([config.py L75](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/config.py#L75)), and the key is under Settings > Web Interface ([settings.html L761-L768](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/data/interfaces/default/settings.html#L761-L768)). A member could paste a `/api/v2?apikey=…&cmd=get_history&length=…` URL into a browser and save the JSON. That is not a script, but it is not friendly either. **Confirmed** for the endpoint; the browser route is this note's suggestion.
- **The database file.** Settings > Help & Info shows a "Database File" link to `download_database` ([configuration_table.html L37-L40](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/data/interfaces/default/configuration_table.html#L37-L40); [webserve.py L4985-L4990](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py#L4985-L4990)). It is the whole SQLite database, for admins only. GoodWatch should not ask for it: it contains every user's IP addresses and devices. **Confirmed.**

`watched_status` is 1 when the play passed the watched threshold, otherwise 0.75, 0.5, 0.25 or 0 by quarters of it ([datafactory.py L269-L316](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/datafactory.py#L269-L316)). The threshold defaults to 85 percent ([config.py L150, L192](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/config.py#L150)). **Confirmed.**

History rows and the library export share Plex's `rating_key` (`ratingKey` in the export). An importer could join `get_history` JSON to a level 2 library export to give each play its TMDB and IMDb ids. Items deleted from Plex would stay unmatched. **Confirmed** that both carry the key; the join is a proposal.

### Can a member make it without scripts

The library export, yes, if the member is the Tautulli admin. They choose JSON and metadata level 3 (or level 1 plus four custom fields), run one export per library, and download one file each. The default settings produce a file with no ids and no watches, so the upload screen must say which settings to pick.

Per-play history, not really. It needs an API URL or the full database.

## Observations each would produce

These map onto `ImportObservation` in `goodwatch-webapp/app/domain/imports.ts`. Keys must be "stable within the source, independent of upload/archive and mutable watch dates". The existing Letterboxd and Trakt parsers use `pass: 1` for every watch and `precision` of `day`, `moment` or `unknown` (`goodwatch-webapp/app/server/imports/files.server.ts`).

### Kodi `videodb.xml`

Shared fields for an item: `title` from `<title>`, `year` from `<year>` or the year of `<premiered>`, `tmdbId` from `<uniqueid type="tmdb">`, `imdbId` from `<uniqueid type="imdb">`. `<id>` is a fallback when it matches `tt\d+`. Let `ref` be `tmdb:<id>`, else `imdb:<id>`, else `tvdb:<id>`, else the normalized title and year.

| Kodi element | Condition | `kind` | Fields | `key` |
| --- | --- | --- | --- | --- |
| `<movie>` | `userrating` 1 to 10 | `rating` | `mediaType: "movie"`, `score: userrating`, `addedAt: null` | `kodi:rating:movie:<ref>` |
| `<movie>` | `playcount` > 0 | `watch` | `watchedAt: lastplayed` or null, `precision: "day"` or `"unknown"`, `pass: 1` | `kodi:watch:movie:<ref>` |
| `<tvshow>` | `userrating` 1 to 10 | `rating` | `mediaType: "show"`, `score: userrating` | `kodi:rating:show:<ref>` |
| `<episodedetails>` in a `<tvshow>` | `playcount` > 0 | `watch` | `mediaType: "show"`, show's `tmdbId` and `imdbId`, `episodeTmdbId` from the episode's `tmdb` uniqueid, `season`, `episode`, `watchedAt: lastplayed`, `precision: "day"`, `pass: 1` | `kodi:watch:show:<ref>:<season>:<episode>` |
| `<episodedetails>` | `userrating` 1 to 10 | `unsupported` | reason: "GoodWatch doesn't import season or episode ratings yet." (as the Trakt parser says) | `kodi:unsupported-rating:<ref>:<season>:<episode>` |
| `<musicvideo>` | any | `unsupported` | reason: music videos | `kodi:unsupported:musicvideo:<n>` |

Not mapped:

- `userrating` 0, which means no rating.
- A show's own `playcount` and `lastplayed`, which are summaries of its episodes.
- `lastplayed` with `playcount` 0, and `resume`, which mean partly watched.
- `dateadded`, which is a library date.

Kodi produces no `want`, `favorite` or `review` observations.

Open choices for the build ticket:

- **Play counts above 1.** Emit one dated watch, or one dated watch plus `playcount - 1` undated ones? Mark-as-watched clicks inflate counts, so one watch is the safer default.
- **Duplicate `<movie>` elements** from video versions: collapse by `ref` and keep the highest `playcount` and the latest `lastplayed`.
- **Trust in `lastplayed`.** It may be the day the member clicked "mark as watched" during library setup. The existing `watchDates: "unknown"` option covers that, and the same-date cluster warning from the Trakt importer applies.

### Tautulli library export, JSON, level 3

Shared fields: `title`, `year`, `tmdbId` from the `tmdb://` entry in `guids`, `imdbId` from the `imdb://` entry. Fall back to a legacy `guid`. Key on Plex's `ratingKey`, which is stable within one Plex server.

| Item | Condition | `kind` | Fields | `key` |
| --- | --- | --- | --- | --- |
| movie | `userRating` > 0 | `rating` | `score: round(userRating)`, `addedAt: lastRatedAt` | `tautulli:rating:<ratingKey>` |
| movie | `viewCount` > 0 | `watch` | `watchedAt: lastViewedAt`, `precision: "day"` (see below), `pass: 1` | `tautulli:watch:<ratingKey>` |
| show | `userRating` > 0 | `rating` | `mediaType: "show"`, `score` as above | `tautulli:rating:<ratingKey>` |
| `seasons[].episodes[]` | `viewCount` > 0 | `watch` | `mediaType: "show"`, show ids from the parent, `episodeTmdbId` from the episode's `tmdb://` guid, `season: seasonNumber`, `episode: episodeNumber`, `watchedAt: lastViewedAt` | `tautulli:watch:<episode ratingKey>` |
| season or episode | `userRating` > 0 | `unsupported` | reason: season or episode ratings | `tautulli:unsupported-rating:<ratingKey>` |

`lastViewedAt` has no timezone offset. Treating it as UTC can move a late-evening watch to the wrong day. Use `precision: "day"` on the local date, or ask the member for their timezone and use `moment`.

The parser should reject a file with no `guids` and no `viewCount` fields. It should tell the member to re-export at level 3.

### Tautulli `get_history` JSON

If GoodWatch later accepts it, each row with `watched_status` 1 becomes one `watch`:

- `key: tautulli:history:<row_id>`
- `watchedAt` from `stopped`, epoch seconds in UTC, with `precision: "moment"`
- `pass: 1`
- For episodes, `season` from `parent_media_index` and `episode` from `media_index`

Ids come from joining `rating_key` (or `grandparent_rating_key` for episodes) to a library export. Rows for other Plex users must be filtered by `user_id`, which means asking the member which user they are. This is the only Kodi or Tautulli route that yields real rewatch dates.

## What still needs a real file

Kodi `videodb.xml` from Kodi 21 and from Kodi 22:

- Do `<episodedetails>` elements carry `<uniqueid>`? The export loads episodes with `VideoDbDetailsAll` ([VideoDatabase.cpp L11794](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp#L11794)), so they should.
- How empty values appear: `<lastplayed />` or `<lastplayed></lastplayed>`.
- How often movies repeat because of video versions.
- What a library scraped with the older TVDB scraper or with hand-made `.nfo` files looks like.
- File size for a large library, against the 20 MB upload limit (`IMPORT_MAX_BYTES`).
- The on-screen route to the settings level switch in the default Estuary skin.

Tautulli JSON export at level 3, for a movie library and a TV library:

- The exact `guids` shape, such as `[{"id": "imdb://tt…"}, …]`, and the prefixes present.
- Whether `userRating` is a whole number or has decimals.
- The `lastViewedAt` string format.
- Whether the episode `tmdb://` id is the TMDB episode id.
- Whether `viewCount` includes plays by other Plex users. The secondary reading says it does not.
- The CSV row layout, to confirm that continuation rows lack `ratingKey`.
- File size for a large TV library with nested episodes.

A `get_history` JSON response, to confirm the field list in the docstring.

## Sources

- Kodi source at [`ca2ccdc`](https://github.com/xbmc/xbmc/tree/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d) and [Omega `f8815ee`](https://github.com/xbmc/xbmc/tree/f8815ee40f49a700c047982d752be4b2a61420e2): [VideoInfoTag.cpp](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoInfoTag.cpp), [VideoDatabase.cpp](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabase.cpp), [VideoDatabaseDDL.cpp](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/video/VideoDatabaseDDL.cpp), [LibraryBuiltins.cpp](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/xbmc/interfaces/builtins/LibraryBuiltins.cpp), [settings.xml](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/system/settings/settings.xml), [strings.po](https://github.com/xbmc/xbmc/blob/ca2ccdc855ba2b9024c95e0a03d17b2841ae8f4d/addons/resource.language.en_gb/resources/strings.po).
- Kodi scrapers: [metadata.themoviedb.org.python](https://github.com/xbmc/metadata.themoviedb.org.python/tree/26846ba84632f9b0dc3f0957c83e8049a384ddd1), [metadata.tvshows.themoviedb.org.python `nexus`](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/tree/92dfe5e627da2445f7b68efee8d82236d1835e09) and [`piers`](https://github.com/xbmc/metadata.tvshows.themoviedb.org.python/tree/69f4e193013767b09bc4600c9c23f04e9712b1a9).
- Kodi wiki, archived: [Import-export library/Video](https://web.archive.org/web/20260404042627/https://kodi.wiki/view/Import-export_library/Video), [NFO files/Movies](https://web.archive.org/web/20251126125230/https://kodi.wiki/view/NFO_files/Movies), [NFO files/TV shows](https://web.archive.org/web/20260404042616/https://kodi.wiki/view/NFO_files/TV_shows), [NFO files/Episodes](https://web.archive.org/web/20260109055623/https://kodi.wiki/view/NFO_files/Episodes).
- Tautulli source at [`9484667`](https://github.com/Tautulli/Tautulli/tree/9484667bc1f2d159368a999320b8f495bbfbd00a): [exporter.py](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/exporter.py), [webserve.py](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/webserve.py), [helpers.py](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/helpers.py), [datafactory.py](https://github.com/Tautulli/Tautulli/blob/9484667bc1f2d159368a999320b8f495bbfbd00a/plexpy/datafactory.py), bundled [lib/plexapi](https://github.com/Tautulli/Tautulli/tree/9484667bc1f2d159368a999320b8f495bbfbd00a/lib/plexapi).
- Tautulli wiki: [Exporter Guide](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide).
- Plex: [python-plexapi `Guid`](https://github.com/pushingkarmaorg/python-plexapi/blob/dea7cad9227ec976fa93c363c43c01b3cee305af/plexapi/media.py#L941-L952) and the [Plex forum thread on `includeGuids`](https://forums.plex.tv/t/add-includeguids-url-parameter-to-return-external-guids/735620). Both are secondary.

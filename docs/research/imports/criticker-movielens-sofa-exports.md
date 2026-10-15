# Criticker, MovieLens and Sofa export files

Research date: 2026-10-15. Answers [#615](https://github.com/alp82/goodwatch-monorepo/issues/615), part of [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). This note follows the [import sources inventory](../import-sources-inventory.md) and checks its Criticker, MovieLens and Sofa rows against primary sources.

No account was signed in to and no export was generated. The facts come from public help pages, MovieLens's own web app bundle, archived copies of pages that refuse automated fetches, and the source code and test fixtures of open-source importers.

Labels:

- **Confirmed**: read from a first-party source (the service's own page, app code or an archived copy of it).
- **Secondary**: read only in a third-party importer, its fixtures or a forum post.
- **Unconfirmed**: not established.

## Summary

1. **None of the three exports is a Letterboxd import file.** Criticker and MovieLens are close enough that header aliases plus two value rules would make them work. Sofa is a different shape and needs its own parser.
2. **Criticker** gives a free CSV (also XML, HTML, TXT) of film and TV ratings on a 0–100 scale, with the IMDb id, the date rated and the mini review. It has no TMDB id, and no watch date or watchlist is known to be in it (secondary). Its header has leading spaces and its date format changed in 2024.
3. **MovieLens** gives four free CSVs: ratings, tags, wishlist and activity logs (confirmed). Ratings carry the TMDB id, a bare IMDb number and a 0.5–5 star rating (secondary). The ratings file has no dates. Rating dates live only in the activity log.
4. **Sofa** (Apple platforms only) gives a free zip with `items.csv` that carries `api_id` and `api_source` (TMDB, iTunes or IGDB) and ISO 8601 dates (confirmed). Sofa has no built-in rating: ratings are user-defined "Ingredients", so their column name and scale differ per person (confirmed). The exact columns are only documented in a `README.md` inside the zip.
5. **Real files.** MovieLens ratings and wishlist can be built from published fixtures. Criticker needs one current export before building. Sofa needs a real export before any design work.

## Comparison

| | Criticker | MovieLens | Sofa |
|---|---|---|---|
| Menu route | Resources > Feeds & exports > All Your Ratings (confirmed) | Settings > import or export (confirmed) | Lists tab > ••• > Settings > Data Management > Export All Data (confirmed) |
| Cost | Free for registered members (confirmed) | Free, non-commercial (confirmed) | Free tier (confirmed) |
| Format | CSV, XML, HTML, TXT (confirmed) | Four CSV files (confirmed) | Zip of CSV files plus `README.md` (confirmed) |
| Ids | IMDb `tt` id, Criticker URL (secondary) | MovieLens, TMDB, bare IMDb number (secondary) | `api_id` + `api_source` (confirmed) |
| Scale | 0–100 integer (confirmed) | 0.5–5 in half stars (confirmed) | None built in; user-defined (confirmed) |
| Dates | Date rated, with time (secondary) | None in ratings; activity log timestamps (secondary) | ISO 8601 with time zone (confirmed) |
| Watch history | Not in export (secondary) | No; only rating events (secondary) | Logbook completion, rewatch copies (confirmed in app, columns unconfirmed) |
| Want / lists | No watchlist in export (secondary) | Wishlist file (confirmed) | List name, section, list type (confirmed in part) |
| TV | Yes, by `/tv/` URL (secondary) | Movies only | Yes, by category |
| Fits generic CSV | No, close | No, close | No |
| Real file needed | Yes, one current export | Only for the activity log | Yes |

## Criticker

### Route and cost

- Criticker's "Feeds & exports" page says: "As a registered member of the site, you'll be able to view your ratings in a number of different export formats, such as XML, HTML, TXT, and CSV!" (**confirmed**, [criticker.com/resources](https://www.criticker.com/resources/)). The same page reserves only the PSI download for paying Sponsors, so the ratings export is free.
- The direct CSV link is `https://www.criticker.com/resource/ratings/conv.php?type=csv` and requires being signed in (**secondary**, [Simkl's Criticker guide](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/importing-to-simkl/supported-platforms/criticker)). RatS fetches `conv.php?type=xml` the same way (**secondary**, [RatS `criticker_ratings_parser.py`](https://github.com/StegSchreck/RatS/blob/master/RatS/criticker/criticker_ratings_parser.py)). TraktRater describes the same export as the CSV icon in the "Export" box of the Full Rankings list (**secondary**, [TraktRater README](https://github.com/damienhaynes/TraktRater)).
- Criticker's FAQ, help and import pages return HTTP 403 to automated clients. The FAQ was read from the [Wayback Machine copy of 2026-05-03](http://web.archive.org/web/20260503110838/https://www.criticker.com/faq/).

### Columns

The CSV header is (**secondary**, two independent sources agree: the sample file in [mnzeric/criticker-to-letterboxd](https://github.com/mnzeric/criticker-to-letterboxd/blob/master/ratings.csv) and the column map in [TraktRater `CritickerItem.cs`](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/Criticker/CritickerItem.cs)):

```text
Score, Film Name, Year, Date Rated, Mini Review, URL, IMDB ID
```

- Every name after `Score` starts with a space. TraktRater maps `" Film Name"`, `" IMDB ID"` and so on literally, and the Letterboxd converter strips the spaces before renaming.
- Values are wrapped in double quotes where needed, and an empty mini review is `""`. How a quote inside a mini review is escaped is **unconfirmed**.
- Example row from the 2021 sample: `10,"12 Angry Men",1957,"Jun 21 2014, 22:06","",https://www.criticker.com/film/12-Angry-Men/,tt0050083`.
- The XML export has `filmid`, `filmname` ("Title (Year)"), `filmlink`, `imdbid`, `img`, `rating`, `summary`, `quote`, `reviewdate` and `tier` per `<film>` (**secondary**, [RatS fixture `my_ratings.xml`](https://github.com/StegSchreck/RatS/blob/master/tests/assets/criticker/my_ratings.xml), 2017–2018). Only the XML carries Criticker's numeric film id.

### Ids

- `IMDB ID` is a full `tt` id. All 1,918 rows of the 2021 sample have one (**secondary**). Whether every title in Criticker's catalog has an IMDb id is **unconfirmed**.
- There is no TMDB id (**secondary**).
- `URL` is the Criticker title page, which is a stable per-title key (**secondary**).

### Rating scale

- Criticker uses a "100-point rating scale" and normalizes each user's scores into percentiles and ten tiers for display (**confirmed**, [FAQ](http://web.archive.org/web/20260503110838/https://www.criticker.com/faq/)).
- The export carries the raw score the user typed, not the tier. RatS's fixture has scores from 10 to 100 and a separate `tier` from 1 to 10 (**secondary**). The 2021 CSV sample has only scores 0–10, because its author rated "0-10" on Criticker's 100-point scale, as the first version of the converter says (**secondary**, [converter at 5781bba3](https://github.com/mnzeric/criticker-to-letterboxd/blob/5781bba3/converter.py)).
- So the scale is 0–100, and a single user's file can use any part of it. A file whose maximum score is 10 most likely uses a personal 0–10 habit, but nothing in the file says so.
- Importers disagree on the conversion. TraktRater rounds `Score / 10` half away from zero and skips scores of 0 ([TraktRater `Criticker.cs`](https://github.com/damienhaynes/TraktRater/blob/master/Sites/Criticker.cs)). RatS rounds `rating / 10`. The current Letterboxd converter uses `max(1, ceil(Score / 10))` ([converter.py](https://github.com/mnzeric/criticker-to-letterboxd/blob/master/converter.py)).

### Dates

- `Date Rated` is the only date column (**secondary**). It includes a time of day with no time zone.
- Its format changed. The 2021 sample uses `Jun 21 2014, 22:06`. A May 2024 commit "changed date format to match criticker's new export format" to `%Y-%m-%d %H:%M` (**secondary**, [commit 8217268a](https://github.com/mnzeric/criticker-to-letterboxd/commit/8217268a)).
- A September 2025 Criticker update reportedly fixed the export "showing the improper data in the 'date rated' field" (**unconfirmed**: seen only in a search summary; the [games.criticker.com post](https://games.criticker.com/news/export-collections-and-more-updates-for-15-september-2025/) returns 403 and has no archived copy).
- Criticker lets members record a watch date separately from the rating date (**confirmed**, [FAQ](http://web.archive.org/web/20260503110838/https://www.criticker.com/faq/)). No source shows that date in the export (**unconfirmed**).

### Lists, statuses and TV

- Criticker has built-in Watchlist and Ignored collections plus user collections (**confirmed**, [FAQ](http://web.archive.org/web/20260503110838/https://www.criticker.com/faq/)). The ratings export does not include them (**secondary**: the column list has no such field, and a community [Criticker Watchlist Exporter userscript](https://greasyfork.org/en/scripts/521339-criticker-watchlist-exporter) exists to fill the gap with `Title`, `Year` and `Probable Score`).
- TV ratings are in the same file. TraktRater tells them apart by `/tv/` in the URL (**secondary**, [`CritickerItem.cs`](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/Criticker/CritickerItem.cs)). Whether TV rows are per show or per season is **unconfirmed**.
- Games live on a separate site, games.criticker.com, and are out of scope.

### Fit with the generic CSV import

Not as exported. Each gap is small:

| Generic import expects | Criticker has | Gap |
|---|---|---|
| `Title` | `Film Name` | Alias, plus trimming header spaces |
| `imdbID` | `IMDB ID` | Alias |
| `Rating10` (1–10) | `Score` (0–100) | Scale rule; 0 is valid on Criticker |
| `WatchedDate` (YYYY-MM-DD) | `Date Rated` (two formats, with time) | Not a watch date; see below |
| `Review` | `Mini Review` | Alias |

The [Criticker→Letterboxd converter](https://github.com/mnzeric/criticker-to-letterboxd/blob/master/converter.py) maps `Date Rated` to `WatchedDate`. That would turn every rating into a dated watch on the day it was rated. GoodWatch's Letterboxd import already refuses this for Letterboxd's own `Date` column, because only a diary's watched date describes a viewing ([files.server.ts](https://github.com/alp82/goodwatch-monorepo/blob/main/goodwatch-webapp/app/server/imports/files.server.ts)). A converted Criticker file run through #620 would therefore produce misleading watch dates. Issue [#620](https://github.com/alp82/goodwatch-monorepo/issues/620) lists Criticker among exporters that "produce" the Letterboxd format. Criticker does not. A third-party converter does.

### Real file

Needed before building: one current CSV export. It settles the header after the 2024 and 2025 changes, the date format, quote escaping, encoding, whether TV rows carry a season, and whether a watch-date column now exists. A free Criticker account with a handful of film and TV ratings is enough.

## MovieLens

### Route and cost

- MovieLens's privacy text says members "may download these data by logging in and navigating to 'settings > import or export'" at `/profile/settings/import-export` (**confirmed**, MovieLens web app bundle `app.b3b6e1a247f5e606bbb4.js`, version 4.5.11.4, served by [movielens.org](https://movielens.org/profile/settings/import-export)).
- The page's "export your data" section has four buttons (**confirmed**, same bundle):

  | Button | Endpoint | File |
  |---|---|---|
  | export ratings | `/api/users/me/movielens-ratings.csv` | `movielens-ratings.csv` |
  | export tags | `/api/users/me/movielens-tags.csv` | `movielens-tags.csv` |
  | export wishlist | `/api/users/me/movielens-wishlist.csv` | `movielens-wishlist.csv` |
  | export activity logs | `/api/users/me/movielens-logs.csv` | `movielens-logs.csv` |

- MovieLens is run by GroupLens at the University of Minnesota and is "non-commercial, and free of advertisements" (**confirmed**, [movielens.org](https://movielens.org/)). There is no paid tier.
- The GroupLens research datasets (`ratings.csv` with `userId,movieId,rating,timestamp`) are a different, anonymized format and are not a user export (**confirmed**, [ml-latest-small README](https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html)).

### Columns

| File | Header | Source |
|---|---|---|
| Ratings | `movie_id,imdb_id,tmdb_id,rating,average_rating,title` | **Secondary**: [RatS fixture](https://github.com/StegSchreck/RatS/blob/master/tests/assets/movielens/my_ratings.csv), [TraktRater map](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/MovieLens/MovieLensRatingItem.cs), [Letterboxd converter](https://gist.github.com/DenverCoder1/f218260e3f5cfc6551fab88e7b07d9f0), [Plex forum post](https://forums.plex.tv/t/import-movie-ratings-from-csv/794232) |
| Wishlist | `movie_id,imdb_id,tmdb_id,average_rating,title` | **Secondary**: [TraktRater map](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/MovieLens/MovieLensWishlistItem.cs), Letterboxd converter |
| Activity logs | `datetime,login_id,action_type,log_json` | **Secondary**: [TraktRater map](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/MovieLens/MovieLensActivityItem.cs), Letterboxd converter |
| Tags | Unknown | **Unconfirmed** |

Example rows from the RatS fixture (2017):

```text
movie_id,imdb_id,tmdb_id,rating,average_rating,title
1,0114709,862,4.0,3.88912,Toy Story (1995)
1305,0087884,655,2.5,3.87974,"Paris, Texas (1984)"
```

- `title` includes the year in parentheses. There is no separate year column (**secondary**).
- Titles with commas are double-quoted in standard CSV style (**secondary**, fixture).
- `average_rating` is the community average, not the user's score.

### Ids

- `tmdb_id` is a TMDB movie id. All 1,063 fixture rows have one (**secondary**).
- `imdb_id` is the number without `tt`, zero-padded to 7 digits in the fixture. The Plex post shows `114709` without the leading zero, likely after a spreadsheet round trip. TraktRater builds `"tt" + id.PadLeft(7, '0')`, which handles both. RatS only prepends `tt`, which breaks unpadded ids (**secondary**, [RatS parser](https://github.com/StegSchreck/RatS/blob/master/RatS/movielens/movielens_ratings_parser.py)).
- `movie_id` is MovieLens's own id and a stable per-title key.

### Rating scale

The rating widget offers `.5, 1, 1.5, … 5` with tooltips from "Awful" to "Must Watch" (**confirmed**, MovieLens app bundle). Doubling gives GoodWatch's 1–10 scale without loss, as TraktRater and RatS do.

### Dates

- The ratings and wishlist files have no dates (**secondary**).
- The activity log has one row per action. `datetime` is `yyyy-MM-dd HH:mm:ss.f` (**secondary**, TraktRater comment; the converters parse `%Y-%m-%d %H:%M:%S.%f`). Its time zone is **unconfirmed**.
- For `action_type` `rating`, `log_json` has `movieId`, `action` (`ADD` is used), `rating` and `pred`. List actions have `movieId`, `action` and `listId` (**secondary**, [TraktRater](https://github.com/damienhaynes/TraktRater/blob/master/Sites/API/MovieLens/MovieLensActivityItem.cs)). Other action types are **unconfirmed**.
- These are rating times, not watch times. Commenters on the Letterboxd converter report that many rated movies have no log entry at all (**secondary**, [gist comments](https://gist.github.com/DenverCoder1/f218260e3f5cfc6551fab88e7b07d9f0)). Ratings made before activity logging began are a likely cause (**unconfirmed**).

### Lists and statuses

- Wishlist is MovieLens's "want to watch" list (**confirmed** as an export; columns **secondary**).
- Tags are free-text labels a member applies to movies (**confirmed**, privacy text). They have no GoodWatch equivalent.
- MovieLens has no watch history, reviews or TV.

### Fit with the generic CSV import

Close, for ratings only:

| Generic import expects | MovieLens has | Gap |
|---|---|---|
| `tmdbID` | `tmdb_id` | Alias, or case- and underscore-insensitive headers |
| `imdbID` (`tt…`) | `imdb_id` (bare number) | Alias plus `tt` prefix and 7-digit padding |
| `Rating` (0.5–5) | `rating` (0.5–5) | Same scale; header case differs |
| `Title`, `Year` | `title` with "(Year)" | Not needed when `tmdb_id` matches |
| `WatchedDate` | None | Correct as is: rows become ratings only |

Because #620 matches `tmdbID` first, the aliases alone would match nearly every row. The wishlist, tags and activity log are outside the Letterboxd format. Want to See from the wishlist needs either a native MovieLens parser or a want kind in the generic import.

### Real file

Not needed for ratings and wishlist: the endpoints are confirmed, and three independent importers (RatS, TraktRater, DenverCoder1's gists), a fixture and a forum post agree on the columns. A real activity log is needed before using rating dates, to check the time zone, the `log_json` shapes and how far back the log goes.

## Sofa

### Route and cost

- Lists tab > ••• > Settings > Data Management > Export All Data > Export > Save Export (**confirmed**, [Exporting Sofa Data](https://sofahq.com/support/data-management/exporting-sofa-data), 2026-05-28).
- Sofa runs on iPhone, iPad, Mac and Vision Pro. Save Export opens the share sheet on iOS and a Finder panel on Mac (**confirmed**, same page).
- "Backups & Export" is listed in the free tier (**confirmed**, [Pricing](https://www.sofahq.com/pricing)).
- Sofa 5.1 (released 2026-05-28) replaced the old Plain Text and Spreadsheet exports with Export All Data (**confirmed**, [Version 5.1](https://www.sofahq.com/releases/5-1)). The older CSV had no item ids and left out "date started/abandoned" (**confirmed**, [archived page of 2026-05-14](http://web.archive.org/web/20260514005546/https://www.sofahq.com/support/data-management/exporting-sofa-data)). Only files from 5.1 or later are worth supporting.
- The `.sofa4bk` backup is a full database copy for restoring in Sofa. Its format is not documented (**confirmed** that it exists; format **unconfirmed**).

### Format and columns

The zip contains (**confirmed**, [Exporting Sofa Data](https://sofahq.com/support/data-management/exporting-sofa-data)):

- `items.csv`: "every item in your library as one row, including which list and section it lives in, its category, all dates, your notes, tags, links, custom properties", plus podcast playback settings.
- `categories.csv`: Movies, TV Shows, Books and custom categories.
- Planner, travel and money files, `attachments.csv`, `images.csv` and their folders.
- `README.md`: "a guide to what's in the zip and how the columns are laid out."

Dates are "ISO 8601 format with timezones" (**confirmed**). Empty lists and list-level tags are left out (**confirmed**). The exact column names in `items.csv` are not published anywhere outside the zip (**unconfirmed**).

### Ids

The `api_id` and `api_source` columns are "kept on every item row", with TMDB, iTunes or IGDB as the source (**confirmed**). TMDB movie and TV ids share number ranges, so the media type must come from the category column. Whether `api_source` itself separates TMDB movies from TMDB shows is **unconfirmed**. Imported rows that Sofa could not match become custom items ([Sofa blog, 2026-05-28](https://www.sofahq.com/blog/import-your-library-take-it-with-you)), so they most likely have no `api_id` (**unconfirmed**).

### Ratings

Sofa has no built-in rating. Ratings are "Ingredients", custom fields of type Text, Number, Date, Link, Toggle, Single Select or Multi-Select, with templates for "star ratings, thumbs up/down, and status trackers" (**confirmed**, [What are Ingredients](https://www.sofahq.com/support/ingredients/what-are-ingredients), [Organize](https://www.sofahq.com/organize)). Custom Ingredients are a Super Sofa feature (**confirmed**, [Pricing](https://www.sofahq.com/pricing)). A person's rating column therefore has a name and scale they chose, and it may differ per category. An importer would have to ask which column holds the rating and what its range is.

### Dates, statuses and lists

- Marking an item complete flags it as logged in the Logbook. "Watch Again" creates a fresh copy with its own completion date, so a rewatch is a second row (**confirmed**, [What happens when you add something to Logbook](https://www.sofahq.com/support/logbook/what-happens-when-you-add-something-to-logbook)). Completion dates can be edited to the real date (**confirmed**, [Pricing](https://www.sofahq.com/pricing)).
- Sofa 5.1 made "Started and Finished dates for tracked TV shows" reflect actual watching (**confirmed**, [Version 5.1](https://www.sofahq.com/releases/5-1)). Episode tracking with backdated episodes exists (**confirmed**, [Tracking TV Shows](https://www.sofahq.com/support/progress-tracking/tracking-tv-shows)). Whether episodes appear in the export is **unconfirmed**.
- Lists are user-named, of type Todo (a backlog) or Collection (a reference list) (**confirmed**, [List types](https://www.sofahq.com/support/groups-and-lists/list-types-todo-vs-collection)). There is no fixed watchlist, so "want" can only be inferred, for example from an uncompleted item in a Todo list. Whether the list type is in `items.csv` is **unconfirmed**.

### Fit with the generic CSV import

No. `items.csv` mixes books, games, podcasts and custom items, keys titles by `api_source` and `api_id`, has no fixed rating column, and stores completion as a flag plus timestamp. It needs its own parser and a short column-mapping step in the preview.

### Real file

Needed before any design. The `README.md` and header of a real 5.1+ export, from a library with a few movies, a tracked show, a rewatch, a rating Ingredient and two list types, would settle the column names, the completion fields, the TMDB movie/TV split and whether episodes are exported. Sofa is Apple-only, so someone with an iPhone or Mac has to produce it.

## Observations

These map each export onto `ImportObservation` in [`imports.ts`](https://github.com/alp82/goodwatch-monorepo/blob/main/goodwatch-webapp/app/domain/imports.ts). GoodWatch scores are integers from 1 to 10, as in the Letterboxd and Trakt parsers. Rules marked "owner decision" are proposals, not findings.

### Criticker (one row of the ratings CSV)

| Field | Value |
|---|---|
| `key` | `criticker:rating:<URL path>` (and `criticker:review:<URL path>`) |
| `kind` | `rating`; plus `review` when `Mini Review` is not empty |
| `mediaType` | `show` when the URL contains `/tv/`, else `movie` |
| `title`, `year` | `Film Name`, `Year` |
| `imdbId` | `IMDB ID` |
| `tmdbId` | `null` |
| `score` | Owner decision. For example `max(1, round(Score / 10))`, with 0 kept as 1 or marked `invalid`. Warn when the file's highest score is 10 or less. |
| `review` | `Mini Review` (review observation only) |
| `addedAt` | `Date Rated`, as a day; accept both known formats |
| `watchedAt`, `precision`, `pass` | Not set. No watch observation: `Date Rated` is not a viewing date. |

### MovieLens

| Field | Ratings file | Wishlist file |
|---|---|---|
| `key` | `movielens:rating:<movie_id>` | `movielens:want:<movie_id>` |
| `kind` | `rating` | `want` |
| `mediaType` | `movie` | `movie` |
| `title`, `year` | `title` without "(Year)"; year from the last "(YYYY)" | Same |
| `tmdbId` | `tmdb_id` | `tmdb_id` |
| `imdbId` | `"tt" + imdb_id` padded to 7 digits | Same |
| `score` | `rating × 2` | Not set |
| `addedAt` | Latest `rating`/`ADD` log time for that `movieId`, if the log is uploaded; else `null` | List-add log time, if identifiable (**unconfirmed**); else `null` |
| `watchedAt` | Not set: no watch observation | Not set |

Tags become nothing, or one `unsupported` observation per file with a reason. The activity log produces no observations of its own; it only supplies `addedAt`.

### Sofa (one row of `items.csv`, pending a real file)

| Field | Value |
|---|---|
| `key` | `sofa:<kind>:<api_source>:<api_id>:<occurrence>`, or Sofa's own item id if the export has one (**unconfirmed**) |
| `kind` | `watch` for a completed item with a completion date. `want` for an uncompleted item in a Todo list (owner decision). `rating` only if the person maps an Ingredient column. Non-movie, non-TV categories and rows without a TMDB id become `unsupported`. |
| `mediaType` | From the category: Movies → `movie`, TV Shows → `show` |
| `title`, `year` | Title and release year columns (**unconfirmed** names) |
| `tmdbId` | `api_id` when `api_source` is TMDB |
| `imdbId` | `null` |
| `score` | From a mapped Ingredient, converted from its declared range (owner decision) |
| `watchedAt`, `precision` | Completion timestamp. `day` until a real file shows whether the time part is meaningful, because Sofa lets people backdate by date. |
| `pass` | `1`; each Watch Again copy is its own row and its own watch |
| `addedAt` | Date added |

## What this changes in the inventory

- The [inventory](../import-sources-inventory.md) row for MovieLens said watches come "via activity logs". The logs hold rating events, not watches, so MovieLens yields ratings and Want to See only.
- The Sofa row's "Ratings: unconfirmed" is now settled: Sofa has no built-in rating, only user-defined Ingredients.
- The Criticker row is right about the 0–100 scale and the IMDb id. Add: TV ratings are in the same file, the date format changed in 2024, and converted files misuse the rating date as a watch date.
- #620's list of formats that already "produce" the Letterboxd CSV should drop Criticker, or say "through a third-party converter".

## Sources

First-party:

- Criticker: [Feeds & exports](https://www.criticker.com/resources/), [FAQ (Wayback copy, 2026-05-03)](http://web.archive.org/web/20260503110838/https://www.criticker.com/faq/)
- MovieLens: [movielens.org](https://movielens.org/), web app bundle `app.b3b6e1a247f5e606bbb4.js` (import-export page, privacy text, rating widget), [ml-latest-small README](https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html)
- Sofa: [Exporting Sofa Data](https://sofahq.com/support/data-management/exporting-sofa-data), [archived version of 2026-05-14](http://web.archive.org/web/20260514005546/https://www.sofahq.com/support/data-management/exporting-sofa-data), [Version 5.1](https://www.sofahq.com/releases/5-1), [blog post of 2026-05-28](https://www.sofahq.com/blog/import-your-library-take-it-with-you), [Pricing](https://www.sofahq.com/pricing), [Organize](https://www.sofahq.com/organize), [What are Ingredients](https://www.sofahq.com/support/ingredients/what-are-ingredients), [Logbook](https://www.sofahq.com/support/logbook/what-happens-when-you-add-something-to-logbook), [List types](https://www.sofahq.com/support/groups-and-lists/list-types-todo-vs-collection), [Tracking TV Shows](https://www.sofahq.com/support/progress-tracking/tracking-tv-shows)
- Letterboxd: [Importing your data](https://letterboxd.com/about/importing-data/)

Third-party:

- [mnzeric/criticker-to-letterboxd](https://github.com/mnzeric/criticker-to-letterboxd): converter history and 2021 sample CSV
- [StegSchreck/RatS](https://github.com/StegSchreck/RatS): Criticker XML and MovieLens CSV parsers and fixtures
- [damienhaynes/TraktRater](https://github.com/damienhaynes/TraktRater): Criticker and MovieLens column maps and conversions
- [DenverCoder1 MovieLens→Letterboxd gist](https://gist.github.com/DenverCoder1/f218260e3f5cfc6551fab88e7b07d9f0) and [MovieLens→Trakt gist](https://gist.github.com/DenverCoder1/4a180d7edff18eb0077af31c6d338b36)
- [Simkl Criticker import guide](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/importing-to-simkl/supported-platforms/criticker)
- [Plex forum: Import Movie ratings from csv?](https://forums.plex.tv/t/import-movie-ratings-from-csv/794232)
- [Criticker Watchlist Exporter userscript](https://greasyfork.org/en/scripts/521339-criticker-watchlist-exporter)
- [Ryot importing overview](https://docs.ryot.io/importing/overview): supports none of the three. A code search of [Yamtrack](https://github.com/FuzzyGrim/Yamtrack) found no Criticker, MovieLens or Sofa importer either.

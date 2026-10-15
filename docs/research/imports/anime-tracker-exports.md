# Exports from MyAnimeList, AniList and Kitsu

Research date: 2026-10-15. Answers [#614](https://github.com/alp82/goodwatch-monorepo/issues/614), part of [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). It extends the anime rows of the [import sources inventory](../import-sources-inventory.md).

How an anime entry maps onto a TMDB show, season and episode is [#610](https://github.com/alp82/goodwatch-monorepo/issues/610). This note does not repeat it.

## Method and labels

No account was signed in to. Sources were the platforms' own pages, terms, API references and front-end code, their public APIs, and open-source importers. Code links are pinned to the commit that was read.

- **Confirmed**: read in a first-party source (the platform's own page, terms, API schema, server or front-end code) or observed in a live public API response.
- **Secondary**: read in a third-party importer, parser or help page, not in the platform's own material.
- **Unconfirmed**: plausible, but not verified. Needs a real file or a signed-in check.

MyAnimeList's export page and AniList's data download need a signed-in account, so nothing here is read from a real export file.

## Summary

| | MyAnimeList | AniList | Kitsu |
| --- | --- | --- | --- |
| Built-in export | Yes. Gzipped XML, one file per list type | Yes. "GDPR Data Download", JSON | Code exists for a MyAnimeList-format XML download, behind a feature flag |
| Route | `myanimelist.net/panel.php?go=export` → Export my: Anime List → Export My List | Settings → Account → GDPR Data Download → Download | Settings → Export → Download Anime Library, if the flag is on |
| Titles in the file | Yes | No, AniList ids only | Yes, as MyAnimeList ids |
| Score | Integer 0–10, 0 is no score | Scale unconfirmed in the file; the API offers five formats | 2–20, shown as 1–10 in half steps |
| Statuses | Watching, Completed, On-Hold, Dropped, Plan to Watch | Six codes: in progress, planning, completed, dropped, paused, repeating | current, planned, completed, on_hold, dropped |
| Dates | Start and finish date, day precision | Start and finish date, plus a timestamped activity log | Timestamps that the server often sets itself |
| Rewatches | Count | Count | Count |
| Public library by username | API with a client ID | GraphQL, no key | JSON:API, no key |
| Terms for reading by username | Not without written permission | Prohibited for competing list or tracker services | Separate API terms "available upon request" |
| Verdict | Build a file upload | Build a file upload once a real file confirms the score scale | Ask Kitsu, or use the XML if a member can download it |

Key findings:

1. **One MyAnimeList XML parser reaches more than one source.** Kitsu's own XML generator writes MyAnimeList's format, and Simkl's importer accepts MyAnimeList-style XML from other sites too. **Confirmed** for Kitsu ([generator](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/services/list_sync/my_anime_list/xml_generator/row.rb)); **secondary** for the others ([Simkl](https://simkl.com/apps/import/mal-xml/)).
2. **AniList's file has ids but no titles, and its score scale is unknown.** Matching must go by AniList id. **Secondary** ([NovelCompass](https://github.com/cbangera2/NovelCompass/blob/a36f12b1866e46c37527a4b5bdcb398ce3123611/web/src/profile/anilistGdpr.ts#L1-L7)).
3. **AniList's file is richer than the inventory says.** It carries start and finish dates per entry and an activity log with a timestamp per progress update. **Secondary** ([Anilyzer list type](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/list.ts), [activity type](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/activity.ts)). The inventory's line "Ryot's importer shows no start or finish dates" describes what Ryot reads, not what the file holds.
4. **Kitsu's terms are not clear of risk.** The inventory says "None found". Kitsu's terms say API use is subject to "a separate set of terms available upon request" and forbid data mining without written consent. **Confirmed** ([terms](https://github.com/hummingbird-me/kitsu-web/blob/df0f97cca3bc579002b50660922a81421ec6c3a1/markdown/terms.md#L103-L106)).
5. **Today's import contract cannot carry On hold, Dropped or Watching without watches.** `ImportKind` is `rating`, `watch`, `want`, `favorite`, `review` ([imports.ts](https://github.com/alp82/goodwatch-monorepo/blob/511e4be329d9b381e2b824dd52cea161537cabd5/goodwatch-webapp/app/domain/imports.ts#L4-L11)). Anime trackers make the show status their main signal, so they need a new observation kind. **Confirmed**.

## How a member gets the data out

### MyAnimeList

- **Route.** Sign in, open `https://myanimelist.net/panel.php?go=export`, select Anime List under "Export my", and choose Export My List. The download is named like `animelist_****.gz`. **Secondary** ([Simkl's instructions](https://simkl.com/apps/import/mal-xml/), [Ryot's docs](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/apps/docs/src/importing/myanimelist.md)). The page answers "You must first login to see this page" without a session. **Confirmed** ([page](https://myanimelist.net/panel.php?go=export)). Which site menu links to it is **unconfirmed**.
- **Format.** Gzipped XML. AniList's own import page tells members "Make sure to unzip the .xml.gz file first!" before uploading a MyAnimeList list. **Confirmed** in AniList's front-end bundle (`https://anilist.co/js/settings.b304a387.js`, fetched 2026-10-15). Ryot gunzips the file before parsing ([code](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/myanimelist/src/lib.rs#L44-L53)). The name pattern `{media_type}list_{epoch}_{user_id}.xml.gz` is **secondary** ([bokusu spec](https://github.com/bokusu/bokusu/blob/2673394800da62c64779592c32711e31e3cb6f2f/docs/malxml-spec.md#export-format)).
- **One file per list.** A file holds either `<anime>` or `<manga>` elements, never both; `<user_export_type>` is `1` for anime and `2` for manga. **Secondary** ([bokusu spec](https://github.com/bokusu/bokusu/blob/2673394800da62c64779592c32711e31e3cb6f2f/docs/malxml-spec.md#xml-root-element), [malexport parser](https://github.com/purarue/malexport/blob/42af2cd795dab7ce106a7058e3c85d40981a7e61/malexport/parse/xml.py#L152-L167)).
- **Members may have unzipped it.** Because AniList asks for the plain `.xml`, a member who moved to AniList may hold an unzipped file. Simkl accepts `.gz`, `.zip` and `.xml`. **Secondary** ([Simkl](https://simkl.com/apps/import/mal-xml/)).

### AniList

- **Route.** Sign in, open Settings → Account (`https://anilist.co/settings/account`), find "GDPR Data Download", and choose Download. The page says "Download all your data stored by AniList.co" and "Note: This data is only an export, it cannot be imported into another AniList account." The button links to `/gdpr/download`. **Confirmed** in AniList's front-end bundle (`settings.b304a387.js`, fetched 2026-10-15).
- **Format.** A JSON file. **Secondary** ([Ryot's docs](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/apps/docs/src/importing/anilist.md), [NovelCompass](https://github.com/cbangera2/NovelCompass/blob/a36f12b1866e46c37527a4b5bdcb398ce3123611/web/src/profile/anilistGdpr.ts#L150-L156)). The file name and size for a large account are **unconfirmed**.
- **No list export in MyAnimeList format.** AniList's settings import a MyAnimeList XML (through the `ImportList` mutation with `service:"myanimelist"`) but offer no XML export. **Confirmed** in the same bundle. Simkl points AniList members to a third-party converter when AniList's API is down ([Simkl](https://simkl.com/apps/import/anilist/)); that is a manual conversion and out of bounds for GoodWatch.

### Kitsu

- **Route, if enabled.** Settings → Export (`/settings/exports`) shows "Download Anime Library" and "Download Manga Library" links when the `xml_download` feature is on for the member. **Confirmed** in the web client ([template](https://github.com/hummingbird-me/kitsu-web/blob/df0f97cca3bc579002b50660922a81421ec6c3a1/app/templates/settings/exports.hbs), [controller](https://github.com/hummingbird-me/kitsu-web/blob/df0f97cca3bc579002b50660922a81421ec6c3a1/app/controllers/settings/exports.js)) and the server, which returns 404 unless the flag is enabled ([controller](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/controllers/library_entries_controller.rb#L50-L59), [route](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/config/routes.rb#L53)). Whether the flag is on for ordinary members today is **unconfirmed**. No public mention of the feature was found.
- **Format, if enabled.** Plain XML in MyAnimeList's format, named `kitsu-<slug>-anime.xml`. **Confirmed** ([controller](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/controllers/library_entries_controller.rb#L57-L58)).
- **Public library by username.** `GET https://kitsu.app/api/edge/library-entries?filter[user_id]=<id>` works without a key, up to 500 entries a page; a username resolves through `/users?filter[name]=`. Private entries are left out unless the owner is signed in. **Confirmed** ([API blueprint](https://github.com/hummingbird-me/api-docs/blob/f8a412cd2e8f3b5ebac0e562031386718c9cefa6/apiary.apib#L2755-L2791), live calls on 2026-10-15 for user 1). The old `kitsu.io/api/edge` host still answers. **Confirmed** (live).

## What each file holds

### MyAnimeList XML

Root `<myanimelist>`, then `<myinfo>` (`user_id`, `user_name`, `user_export_type`, totals per status), then one `<anime>` per entry. **Secondary** ([bokusu spec](https://github.com/bokusu/bokusu/blob/2673394800da62c64779592c32711e31e3cb6f2f/docs/malxml-spec.md#anime), cross-checked against the [malexport](https://github.com/purarue/malexport/blob/42af2cd795dab7ce106a7058e3c85d40981a7e61/malexport/parse/xml.py#L18-L73) and [Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/myanimelist/src/lib.rs#L100-L119) parsers).

| Element | Meaning | Use for GoodWatch |
| --- | --- | --- |
| `series_animedb_id` | MyAnimeList anime id | The key and the mapping input |
| `series_title` (CDATA) | Title | Preview label |
| `series_type` | `TV`, `Movie`, `OVA`, `ONA`, `Special`, `TV Special`, `Music`, `CM`, `PV`, `Unknown` | Movie or show; music, CM and PV are unsupported |
| `series_episodes` | Episode count, `0` if unknown | Detect Completed without full progress |
| `my_watched_episodes` | Episodes watched | Episode progress |
| `my_start_date`, `my_finish_date` | `YYYY-MM-DD`; `0000-00-00` when unset | Dates, day precision |
| `my_score` | Integer score; `0` means none | Rating |
| `my_status` | `Watching`, `Completed`, `On-Hold`, `Dropped`, `Plan to Watch` | Status |
| `my_times_watched` | Number of rewatches | Extra passes or watches |
| `my_rewatching` | `1` while a rewatch is in progress | Current pass |
| `my_comments` (CDATA), `my_tags` (CDATA, comma-separated) | Private notes and tags | Not imported |
| `my_priority`, `my_rewatch_value`, `my_storage`, `my_storage_value`, `my_sns`, `my_discuss`, `my_id`, `my_rated`, `my_rewatching_ep`, `update_on_import` | Settings and legacy fields | Ignored |

Points to know:

- **Score range.** MyAnimeList's API documents the list score as an integer 0–10. **Confirmed** ([API reference](https://myanimelist.net/apiconfig/references/api/v2), "Update my anime list status"). That `0` in the XML means "no score" is **secondary** ([Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/myanimelist/src/lib.rs#L81-L87)).
- **Rewatch count.** `my_times_watched` counts rewatches, not total viewings: the API names the same value `num_times_rewatched`. **Confirmed** for the API field ([API reference](https://myanimelist.net/apiconfig/references/api/v2)); **secondary** for the XML element ([bokusu spec](https://github.com/bokusu/bokusu/blob/2673394800da62c64779592c32711e31e3cb6f2f/docs/malxml-spec.md#anime)).
- **Partial dates.** The API returns partial dates as `2017-10` or `2017`. **Confirmed** ([API reference](https://myanimelist.net/apiconfig/references/api/v2), "Date / Time format"). How the XML writes them (for example `2017-00-00`) is **unconfirmed**. Parsers disagree: malexport drops anything that is not a full date, Yamtrack's API importer pads to the first of the month ([malexport](https://github.com/purarue/malexport/blob/42af2cd795dab7ce106a7058e3c85d40981a7e61/malexport/parse/common.py), [Yamtrack](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c24465d782dc9f19bd606ef63e23c041f7/src/integrations/imports/mal.py#L212-L235)).
- **No added date, no favorites, no reviews.** Nothing in the element list records when an entry was added, and favorites and reviews are not in the file. **Secondary** (absent from every parser above).
- **Booleans differ by type.** Anime uses `1`/`0`; manga uses `YES`/`NO`. **Secondary** ([bokusu spec](https://github.com/bokusu/bokusu/blob/2673394800da62c64779592c32711e31e3cb6f2f/docs/malxml-spec.md#boolean)).

### Kitsu's XML variant

Kitsu's generator writes a subset of the same elements, with differences a parser must accept. **Confirmed** ([row.rb](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/services/list_sync/my_anime_list/xml_generator/row.rb), [generator](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/services/list_sync/my_anime_list/xml_generator.rb)):

- `<myinfo>` holds only `user_export_type`.
- Entries without a MyAnimeList mapping are left out silently.
- On hold is written `On Hold`, not `On-Hold`.
- `my_score` is the stored 2–20 rating divided by 2 in integer arithmetic, so a rating shown as 7.5 (stored as 15) becomes 7.
- Dates are the server's timestamps cut to `YYYY-MM-DD` (see Kitsu dates below).
- `my_times_watched` is the rewatch count; `update_on_import` is `1`; no `series_title`, `series_type` or `my_rewatching`.

Without `series_type`, a Kitsu XML row cannot tell a movie from a show on its own; the type must come from the mapping.

### AniList GDPR JSON

Three top-level keys are documented by importers: `user`, `lists` and `activity`; Ryot also reads `reviews` and `favourites`. **Secondary** ([Anilyzer data exporter types](https://github.com/whoswhip/anilyzer-data-exporter/blob/50816ab56c4855b2bfa58a1c70fce257db03ae78/src/types.ts#L36-L93), [Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L20-L60)).

```json
{
  "user": {
    "display_name": "…",
    "custom_lists": { "anime": ["…"], "manga": ["…"] },
    "advanced_scores": { "active": false, "names": [] }
  },
  "lists": [{
    "id": 123, "user_id": 1, "series_id": 21, "series_type": 0,
    "status": 2, "score": 85, "progress": 12, "progress_volume": 0,
    "repeat": 1, "priority": 0, "private": 0, "hidden_default": 0,
    "notes": null, "custom_lists": "[0]", "advanced_scores": "[]",
    "started_on": 20210103, "finished_on": 20210320,
    "created_at": "2021-01-03 18:20:11", "updated_at": "2021-03-20 22:01:45"
  }],
  "activity": [{
    "id": 456, "action_type": 3, "object_id": 21, "object_type": 1,
    "object_value": "5", "created_at": "2021-01-10 21:14:02", "private": 0
  }],
  "reviews": [{ "series_id": 21, "series_type": 0, "score": 80, "summary": "…", "text": "…", "private": 0, "updated_at": "…" }],
  "favourites": [{ "favourite_id": 21, "favourite_type": 1 }]
}
```

The values are illustrative; the keys come from the cited importers.

| Field | Meaning | Confidence |
| --- | --- | --- |
| `series_id` | AniList media id. The file has no title and no MyAnimeList id | Secondary ([NovelCompass](https://github.com/cbangera2/NovelCompass/blob/a36f12b1866e46c37527a4b5bdcb398ce3123611/web/src/profile/anilistGdpr.ts#L1-L7)) |
| `series_type` | `0` anime, `1` manga | Secondary ([Anilyzer enums](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/enums.ts#L26-L30), [Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L200-L205)) |
| `status` | `0` in progress, `1` planning, `2` completed, `3` dropped, `4` paused, `5` repeating | Secondary ([Anilyzer enums](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/enums.ts#L10-L17)) |
| `score` | Number; the scale is unknown (below) | Unconfirmed |
| `progress` | Episodes watched | Secondary; the API field means "The amount of episodes/chapters consumed by the user" (**confirmed**, schema) |
| `repeat` | Rewatch count | Secondary; the API field means "The amount of times the user has rewatched/read the media" (**confirmed**, schema) |
| `started_on`, `finished_on` | Number `YYYYMMDD`, `0` when unset | Secondary ([Anilyzer list type](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/list.ts#L19-L20), [NovelCompass](https://github.com/cbangera2/NovelCompass/blob/a36f12b1866e46c37527a4b5bdcb398ce3123611/web/src/profile/anilistGdpr.ts#L82-L92)). Partial dates are unconfirmed |
| `created_at`, `updated_at` | `YYYY-MM-DD HH:MM:SS`, time zone unstated | Secondary ([Ryot parse format](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L196-L198)) |
| `private` | `1` for entries hidden from others | Secondary |
| `custom_lists` | JSON-encoded indexes into `user.custom_lists` | Secondary ([Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L110-L113)) |
| `activity[].action_type` | `1` completed, `2` planned, `3` consumed, `4` paused, `5` dropped, `6` repeat | Secondary ([Anilyzer enums](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/enums.ts#L1-L8)) |
| `activity[].object_value` | Progress text for the update, for example an episode or a range | Unconfirmed format |
| `activity[].object_type` | Media type, numbered differently from `series_type` (`1` anime) | Secondary ([data exporter](https://github.com/whoswhip/anilyzer-data-exporter/blob/50816ab56c4855b2bfa58a1c70fce257db03ae78/src/index.ts#L181-L198)) |
| `favourites[].favourite_type` | `1` anime | Secondary ([Ryot](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L207-L212)) |

Points to know:

- **Score scale.** AniList's API offers `POINT_100` (integer 0–100), `POINT_10_DECIMAL` (0–10, one decimal), `POINT_10` (integer 0–10), `POINT_5` (stars) and `POINT_3` (smileys: 1 sad, 2 neutral, 3 happy), with 0 meaning no score. **Confirmed** (schema introspection of `ScoreFormat` at `https://graphql.anilist.co`, 2026-10-15). Which scale the GDPR file uses is **unconfirmed**. Ryot passes it through unchanged while it multiplies MyAnimeList scores by 10, so it treats the file as 100-point ([code](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L136-L139)); NovelCompass assumes the member's format and reads it from a `user.score_type` key that Anilyzer's user type does not list ([NovelCompass](https://github.com/cbangera2/NovelCompass/blob/a36f12b1866e46c37527a4b5bdcb398ce3123611/web/src/profile/anilistGdpr.ts#L28-L35), [Anilyzer user type](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/src/lib/types/gdpr/user.ts)). A real file decides this.
- **The activity log is the only dated per-episode history among the three.** A "consumed" activity with its `created_at` is a watch with a moment. Activity merging, a member setting, folds consecutive updates into one, so one activity may cover several episodes ([Anilyzer README](https://github.com/whoswhip/anilyzer/blob/014418dbccf67c2a80e5502834a5404533582fe6/README.md)). **Secondary**. Deleted activities are gone. **Unconfirmed**.
- **Ryot does not use the dates it is given.** It stamps every episode with the entry's `updated_at` ([code](https://github.com/IgnisDa/ryot/blob/a96986e0250f1159c571464dc462aeffac91ab31/crates/services/importer/anilist/src/lib.rs#L90-L96)). GoodWatch should not copy that.

### Kitsu library entries

From the API blueprint and a live response for user 1 on 2026-10-15. **Confirmed** ([blueprint](https://github.com/hummingbird-me/api-docs/blob/f8a412cd2e8f3b5ebac0e562031386718c9cefa6/apiary.apib#L9195-L9217), [resource](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/resources/library_entry_resource.rb)).

| Attribute | Meaning |
| --- | --- |
| `status` | `current`, `planned`, `completed`, `on_hold`, `dropped` |
| `progress` | Current episode |
| `reconsuming`, `reconsumeCount` | Rewatch in progress; rewatch count, at most 50 ([model](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/models/library_entry.rb#L62-L65)) |
| `ratingTwenty` | "2,3..20 rating scale, displayed as 1,1.5..10"; `null` when unrated. `rating` is deprecated |
| `startedAt`, `finishedAt`, `progressedAt` | ISO 8601 timestamps |
| `createdAt`, `updatedAt` | ISO 8601 timestamps |
| `notes`, `private`, `reactionSkipped`, `volumesOwned` | Not imported |

Included `anime` resources carry `canonicalTitle`, `subtype` (`TV`, `movie` and so on), `episodeCount` and `startDate`. Included `mappings` carry `externalSite` and `externalId`. The live sample had `myanimelist/anime`, `anilist/anime`, `anidb`, `thetvdb/series`, `thetvdb/season`, `thetvdb` (as `series/season`), `trakt`, `hulu` and `aozora`. No TMDB or IMDb mapping appeared. **Confirmed** (live).

Points to know:

- **Kitsu dates are often the time of the click, not of the viewing.** The server sets `startedAt` and `finishedAt` to the current time when an entry becomes current or completed, unless the entry came from an import ([model](https://github.com/hummingbird-me/kitsu-server/blob/e6575ed9fd73ba8cccb920fe2e3f1ef873a71333/app/models/library_entry.rb#L146-L166)). In the live sample, `createdAt`, `startedAt`, `finishedAt` and `progressedAt` were equal for completed entries. **Confirmed**.
- **A dated change log is public.** `GET /api/edge/library-events?filter[userId]=<id>` returned `changedData` (old and new status and progress) with `createdAt` for each change, without a key. **Confirmed** (live, 2026-10-15). It has the same click-time caveat.

## Comparison of the fields

| Field | MyAnimeList XML | AniList GDPR JSON | Kitsu |
| --- | --- | --- | --- |
| Id | MyAnimeList id | AniList id | Kitsu id, with MyAnimeList, AniList, AniDB, TheTVDB and Trakt mappings |
| Title, year | Title only | Neither | Title and start date |
| Movie or show | `series_type` | Not in the file | `subtype` (API only) |
| Score | 1–10 integer | Unknown scale | 2–20, so 1–10 in half steps |
| Progress | Episodes watched | Episodes watched | Episodes watched |
| Dates | Start, finish (day) | Start, finish (day); activity (moment) | Start, finish, progress (moment, often click time) |
| Added date | None | `created_at` | `createdAt` |
| Rewatches | Count | Count | Count, max 50 |
| Favorites, reviews | None | Both | Not read |

Mapping these ids to TMDB is [#610](https://github.com/alp82/goodwatch-monorepo/issues/610). One observation for it: the Kometa Anime-IDs file read on 2026-10-15 had no `tmdb_movie_id` or `tmdb_show_id` keys at all, although its README documents them ([README](https://github.com/Kometa-Team/Anime-IDs/blob/5d10523a8a33d4e9f91d913994775c30712873be/README.md); key count of `anime_ids.json` at that commit). **Confirmed**.

## What the terms allow

| | Upload of a member's own export file | Reading a public library by username |
| --- | --- | --- |
| MyAnimeList | No clause found against it. The export is MyAnimeList's own feature; the member hands GoodWatch a file, and GoodWatch never contacts MyAnimeList. The API agreement governs the API, not this file | Technically open: the user list endpoint accepts a client ID header ("client_auth") and a user name ([API reference](https://myanimelist.net/apiconfig/references/api/v2)). The [API agreement](https://myanimelist.net/static/apiagreement.html) (last modified 2019-08-08) counts "end user information and posts" as MyAnimeList Content (§1(f)), forbids keeping user-generated content server side (§3(c)), and forbids revenue from commercial apps without written authorization (§3(a)(xiv)). The [terms of use](https://myanimelist.net/about/terms_of_use) (updated 2025-12-16) forbid automated systems and collating content "for use elsewhere" (§4(E)). Not usable without written permission |
| AniList | No clause found against it. The page labels it "only an export" | The [API terms](https://docs.anilist.co/guide/terms-of-use) prohibit "Use of the AniList API within competing, non-complementary services of the same nature … anime and manga list or tracker services", applying to "both user data and media data". They also prohibit use "as a backup or data storage service" and require a license above $150 a month in revenue. GoodWatch tracks shows, so treat this as prohibited unless AniList agrees |
| Kitsu | No clause found against it | Library entries are public to anonymous GET ([blueprint](https://github.com/hummingbird-me/api-docs/blob/f8a412cd2e8f3b5ebac0e562031386718c9cefa6/apiary.apib#L2757-L2768)). The [terms](https://github.com/hummingbird-me/kitsu-web/blob/df0f97cca3bc579002b50660922a81421ec6c3a1/markdown/terms.md#L103-L108) say API use is subject to "a separate set of terms available upon request" and forbid "data mining, robots, screen scraping" without written consent. Kitsu "does not claim ownership" of members' User Content (§1.8.1); titles and mappings are Kitsu Content, which may not be used commercially (§1.3). Ask Kitsu before shipping |

All three readings are GoodWatch's interpretation of the quoted text, not legal advice. The texts themselves are **confirmed**. Kitsu's terms were read from the web client's source; the live page renders it with JavaScript.

## What other importers do

| Importer | MyAnimeList | AniList | Kitsu |
| --- | --- | --- | --- |
| Simkl | Connect a MyAnimeList account, or upload MyAnimeList-style XML (`.gz`, `.zip`, `.xml`) ([MAL](https://simkl.com/apps/import/mal/), [MAL-XML](https://simkl.com/apps/import/mal-xml/)) | Username; "make sure your profile is public" ([page](https://simkl.com/apps/import/anilist/)) | Username or profile URL ([page](https://simkl.com/apps/import/kitsu/)) |
| Ryot | XML files, gunzipped | GDPR JSON | None |
| Yamtrack | Username through the API with a client ID ([code](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c24465d782dc9f19bd606ef63e23c041f7/src/integrations/imports/mal.py#L73-L125)) | Username through GraphQL, OAuth for private lists; entries without a MyAnimeList id are skipped ([code](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c24465d782dc9f19bd606ef63e23c041f7/src/integrations/imports/anilist.py#L261-L266)) | Username or id through JSON:API, mapped to MyAnimeList ids ([code](https://github.com/FuzzyGrim/Yamtrack/blob/bf67b8c24465d782dc9f19bd606ef63e23c041f7/src/integrations/imports/kitsu.py#L136-L168)) |
| MAL-Sync | Reads each service through its API; its only file import is its own sync data ([code](https://github.com/MALSync/MALSync/blob/ff16f7f9457d8854c23ad7ffdc548cc2f5bd917e/src/_provider/Local/import.ts)) | Same | Same |

All rows are **secondary** (third-party behavior), except that each link shows the code or page it describes.

Shared habits worth copying: Yamtrack, Ryot and Simkl all treat a rewatch count as extra completed runs, never as dated viewings, and all skip an entry they cannot map rather than guess.

## Observations for `ImportObservation`

These follow today's contract in [`imports.ts`](https://github.com/alp82/goodwatch-monorepo/blob/511e4be329d9b381e2b824dd52cea161537cabd5/goodwatch-webapp/app/domain/imports.ts), the glossary in `CONTEXT.md`, and the rules on [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Where the contract has no place for a signal, the gap is named.

### Status mapping

GoodWatch has Want to See for any title, and a show status (Not started, Watching, On hold, Dropped, Seen) for shows only. Films get no status. An import sets a show status only on a show that is Not started or Watching ([CONTEXT.md](https://github.com/alp82/goodwatch-monorepo/blob/511e4be329d9b381e2b824dd52cea161537cabd5/CONTEXT.md), "Show status").

| Source status | MyAnimeList | AniList | Kitsu | Show | Movie |
| --- | --- | --- | --- | --- | --- |
| Planning | `Plan to Watch` | `1` | `planned` | `want` | `want` |
| In progress | `Watching` | `0` | `current` | Watching, through `watch` rows for the episodes watched | Nothing; films have no status |
| Completed | `Completed` | `2` | `completed` | Seen, through `watch` rows for every episode | One `watch` |
| On hold | `On-Hold` (Kitsu XML: `On Hold`) | `4` | `on_hold` | On hold. Needs a new kind | Nothing |
| Dropped | `Dropped` | `3` | `dropped` | Dropped, allowed with nothing watched. Needs a new kind | Nothing |
| Rewatching | `my_rewatching` = `1` | `5` | `reconsuming` = true | Seen, plus a current pass in progress | One `watch` per finished viewing |

Today's `ImportKind` has no status. Watching and Seen can be reached through watches, as the Trakt import does. On hold and Dropped cannot. The proposal is a `status` kind carrying `"on_hold" | "dropped"` on a show observation, with the existing rule that it never overrides On hold, Dropped or Seen. An entry that is Watching with zero episodes watched would also need it, or would stay Not started.

An anime season or cour is a separate entry, and several entries can land on one TMDB show with different statuses (season 1 Completed, season 2 Dropped). How to combine them is a product decision, listed under open questions; how to find the show and season is [#610](https://github.com/alp82/goodwatch-monorepo/issues/610).

### MyAnimeList XML

| Observation | When | Fields |
| --- | --- | --- |
| `want` | `my_status` is `Plan to Watch` | `key: myanimelist:want:<id>`, `addedAt: null` (the file has no added date) |
| `rating` | `my_score` 1–10 | `score` unchanged; `0` produces nothing |
| `watch` | `my_watched_episodes` > 0 on a show | One row per episode 1…N of the entry, mapped to `episodeTmdbId`, `season`, `episode` by #610. `pass: 1`. `key: myanimelist:watch:<id>:1:<n>` |
| `watch` | Completed movie | One row, `key: myanimelist:watch:<id>:1` |
| `watch` | `my_times_watched` = k > 0 | Passes 2…k+1, every episode, `watchedAt: null`, `precision: "unknown"`. Offer this as an option; it can be large |
| `status` (new) | On-Hold, Dropped on a show | As above |
| `unsupported` | `series_type` is `Music`, `CM` or `PV`; status on a movie other than Completed or Plan to Watch; a manga file | `problem.reason` says why |

Dates: never invent one. A proposal for the owner: give episode 1 `my_start_date` and the last episode of a Completed entry `my_finish_date`, both with `precision: "day"`, and leave every other episode undated. For a Completed movie, use `my_finish_date`. `0000-00-00` is no date. `title` comes from `series_title`; `year`, `tmdbId` and `imdbId` are `null` until the mapping fills them.

### AniList GDPR JSON

Only `series_type` 0 rows. The key uses `series_id`, which is stable; the row `id` is the list entry's id.

| Observation | When | Fields |
| --- | --- | --- |
| `want` | `status` 1 | `addedAt` from `created_at` |
| `rating` | `score` > 0 | Converted once the scale is known; the rounding rule is shown in the preview |
| `watch` | `progress` > 0 | Episodes 1…N, as for MyAnimeList, with `started_on` and `finished_on` under the same proposal |
| `watch` (dated) | Activity rows with `action_type` 3 | One watch per episode named in `object_value`, `watchedAt` from `created_at`, `precision: "moment"`. Preferred over the bulk rows when present; needs a real file |
| `watch` | `repeat` = k > 0 | Extra passes, undated, as for MyAnimeList |
| `favorite` | `favourites` rows of type 1 | Mapped by AniList id |
| `review` | `reviews` rows of type 0 | `summary` and `text`; the review's own score is not a rating |
| `status` (new) | `status` 3 or 4 on a show | As above |
| `unsupported` | Custom lists, advanced scores, notes | Counted in the receipt |

`title` is required by the contract but absent from the file. Use the matched catalog title, and for an unmatched row a label such as "AniList #21". `year` is `null`.

### Kitsu

The XML variant, if a member can download it, goes through the MyAnimeList parser with the differences listed above. A username route, if Kitsu allows it, gives:

| Observation | When | Fields |
| --- | --- | --- |
| `want` | `planned` | `addedAt` from `createdAt` |
| `rating` | `ratingTwenty` set | Half of it, 1–10 in half steps; round to GoodWatch's integer scale by a stated rule |
| `watch` | `progress` > 0 | As for MyAnimeList. Dates only when they differ from `createdAt`; equal timestamps are treated as unknown, in the spirit of Trakt's cluster warning |
| `watch` | `reconsumeCount` = k > 0 | Extra passes, undated |
| `status` (new) | `on_hold`, `dropped` on a show | As above |

Ids come from the `myanimelist/anime` mapping first, then `anilist/anime`, so Kitsu shares the MyAnimeList path of #610.

### Contract changes this implies

- `ImportSource` gains `myanimelist`, `anilist` and, if allowed, `kitsu`.
- A `status` kind for On hold and Dropped, and possibly Watching with no episode.
- A way to carry the source id for matching (MyAnimeList or AniList id) when `tmdbId` and `imdbId` are both `null`. Today's observation has no such field.
- The upload must accept `.xml.gz` as well as `.xml`, inside the existing 20 MB limit.

## What needs a real file

[Collect real export files](https://github.com/alp82/goodwatch-monorepo/issues/372) is the place to track these.

1. **MyAnimeList anime export** (`animelist_*.xml.gz`): confirm the file name, the element set, the status words, how partial dates are written, and an anime film's `series_type`.
2. **AniList GDPR download**: confirm the score scale and whether the member's format is in the file, the date encoding including partial dates, the `activity` format (`object_value`, merging), whether private entries and reviews are included, and the file size for a heavy account against the 20 MB limit.
3. **Kitsu Settings → Export**: check, signed in, whether "Download Anime Library" is shown. If it is, collect the XML.

## Open questions for the owner

1. Does an import set dates on the first and last episode from start and finish dates, or leave every episode undated?
2. Should rewatch counts create extra undated passes, off by default?
3. When several anime entries land on one TMDB show with different statuses, which wins? One candidate: the entry for the latest season the member touched.
4. Write to Kitsu for API permission, or wait for its XML?
5. Write to AniList, given its no-competing-tracker rule, or stay with the file?

## Answer to #614

The ticket's three questions are answered, with one gap each:

- **Menu routes and formats**: MyAnimeList and AniList are answered (MyAnimeList's from third-party instructions plus AniList's own page, since the export page needs sign-in). Kitsu has a coded XML download whose availability needs a signed-in look.
- **Fields**: answered for all three, except AniList's score scale and both trackers' partial-date encoding, which need real files.
- **Terms**: answered. Uploading a member's own file meets no clause in any of the three. Reading by username is barred on MyAnimeList without written permission, prohibited on AniList for trackers, and needs Kitsu's separate API terms.

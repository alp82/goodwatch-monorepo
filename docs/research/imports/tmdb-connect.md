# What TMDB connect takes and returns

Research date: 2026-10-15. Status: research for [#609](https://github.com/alp82/goodwatch-monorepo/issues/609), part of [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). It is not an approved implementation plan.

Sources are TMDB's developer documentation (v3 and v4 guides and references), TMDB's API terms, site terms and privacy policy, and TMDB staff posts on themoviedb.org/talk. The reference pages were read through their Markdown versions (append `.md` to a page URL), which carry the OpenAPI definitions and example responses. No TMDB account was used, no authenticated endpoint was called, and no API key was used. Nothing here is legal advice.

Labels: **confirmed** means read in a first-party source (TMDB docs, terms or a staff post). **Secondary** means inferred from first-party examples or read in community posts. **Unconfirmed** means not established.

This note answers the TMDB rows of [the import sources inventory](../import-sources-inventory.md) that were marked "recalled, not sourced", and adds the endpoints, limits and terms detail a build needs.

## Summary

1. **The member approves once on themoviedb.org.** GoodWatch creates a v4 request token with a `redirect_to` URL, sends the member to `https://www.themoviedb.org/auth/access?request_token=…`, and exchanges the approved token for a v4 user access token. **Confirmed** ([user authentication](https://developer.themoviedb.org/v4/docs/authentication-user), [create request token](https://developer.themoviedb.org/v4/reference/auth-create-request-token), [create access token](https://developer.themoviedb.org/v4/reference/auth-create-access-token)).
2. **v4 covers everything except episode ratings.** Rated movies, rated TV, both watchlists and both favorites lists are v4 endpoints. Rated episodes exist only in v3, which needs a session converted from the v4 token with `POST /3/authentication/session/convert/4`. **Confirmed** ([v4 index](https://developer.themoviedb.org/v4/llms.txt), [rated TV episodes](https://developer.themoviedb.org/reference/account-rated-tv-episodes), [create session from v4 token](https://developer.themoviedb.org/reference/authentication-create-session-from-v4-token)).
3. **Only movie and TV ratings carry a date.** The v4 rated lists return `account_rating.created_at` as an ISO timestamp. Episode ratings, watchlists and favorites have no date at all; they only sort by `created_at`. TMDB has no watch history. **Confirmed** ([v4 rated movies](https://developer.themoviedb.org/v4/reference/account-rated-movies), [v4 movie watchlist](https://developer.themoviedb.org/v4/reference/account-movie-watchlist)).
4. **Ratings run from 0.5 to 10 in half steps.** GoodWatch stores whole numbers from 1 to 10, so half steps need a rounding rule. **Secondary**: TMDB's own examples show 7.5, 8.5 and 9.5, and staff state the website minimum is 0.5, but no page states the increment ([v4 rated TV](https://developer.themoviedb.org/v4/reference/account-rated-tv), [staff, 2012](https://www.themoviedb.org/talk/50851962760ee30fdf000d0a)).
5. **The import is cheap.** Pages hold 20 items (**secondary**, from the documented totals). A member with 2,000 ratings and modest lists needs about 130 requests, under 5 seconds at TMDB's limit of roughly 40 requests per second (**confirmed** limit, [rate limiting](https://developer.themoviedb.org/docs/rate-limiting)).
6. **Ending the connection is two DELETE calls.** `DELETE /3/authentication/session` for the v3 session and `DELETE /4/auth/access_token` for the v4 token. **Confirmed** that both endpoints exist ([delete session](https://developer.themoviedb.org/reference/authentication-delete-session), [logout](https://developer.themoviedb.org/v4/reference/auth-logout)). Whether one revokes the other is **unconfirmed**, so call both.
7. **The terms are the open risk, not the API.** TMDB's API terms define "TMDB Content" as any information available through the API, cap caching at 6 months, forbid use "in connection with" a machine learning or AI based application, and list recommending content for revenue as commercial use. Whether a member's own imported ratings fall under these clauses is an interpretation question for the owner or TMDB. **Confirmed** text, **unconfirmed** application ([API terms](https://www.themoviedb.org/api-terms-of-use)).

## Approval flow

### Steps

| Step | Call or URL | Authenticated with | What comes back | Label |
| --- | --- | --- | --- | --- |
| 1. Create a request token | `POST https://api.themoviedb.org/4/auth/request_token`, JSON body `{"redirect_to": "<GoodWatch callback>"}` | GoodWatch's API read access token as `Authorization: Bearer` | `request_token` (a JWT), `success`, `status_code` | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/auth-create-request-token)) |
| 2. Send the member to TMDB | `https://www.themoviedb.org/auth/access?request_token={request_token}` | The member's TMDB login | Member approves on TMDB | **Confirmed** ([guide](https://developer.themoviedb.org/v4/docs/authentication-user)) |
| 3. Redirect back | TMDB redirects to the `redirect_to` URL, or shows `/auth/access/approve` on TMDB if none was set | n/a | The member lands on GoodWatch | **Confirmed** ([guide](https://developer.themoviedb.org/v4/docs/authentication-user)) |
| 4. Create the access token | `POST https://api.themoviedb.org/4/auth/access_token`, JSON body `{"request_token": "…"}` | GoodWatch's API read access token | `access_token` (a JWT) and `account_id` (a string object id) | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/auth-create-access-token)) |
| 5. Read v4 lists | `GET /4/account/{account_id}/…` | The member's `access_token` as `Authorization: Bearer` | Paged lists | **Secondary**: the guide says user and application auth differ only in "the token you're passing around" ([guide](https://developer.themoviedb.org/v4/docs/authentication-user)) |
| 6. Convert to a v3 session (only for episode ratings) | `POST https://api.themoviedb.org/3/authentication/session/convert/4`, JSON body `{"access_token": "…"}` | GoodWatch's API read access token | `session_id` | **Confirmed** ([reference](https://developer.themoviedb.org/reference/authentication-create-session-from-v4-token)) |
| 7. Find the v3 account id | `GET /3/account/{account_id}?session_id=…` | GoodWatch's API read access token | `id` (integer), `username` | **Confirmed** that the endpoint and integer `id` exist ([reference](https://developer.themoviedb.org/reference/account-details)). How to call it before the id is known is **unconfirmed** (see open questions) |

### Details

- **The request token expires after 15 minutes if unused.** **Confirmed**: "Unused request tokens will automatically expire after 15 minutes" ([guide](https://developer.themoviedb.org/v4/docs/authentication-user)). The example token's `exp` is 900 seconds after `nbf` ([reference](https://developer.themoviedb.org/v4/reference/auth-create-request-token)).
- **The redirect URL is set when the token is created**, not on the approval URL. This differs from the older v3 flow, where `redirect_to` is a query parameter on `https://www.themoviedb.org/authenticate/{REQUEST_TOKEN}` and the token lasts 60 minutes. **Confirmed** ([v4 reference](https://developer.themoviedb.org/v4/reference/auth-create-request-token), [v3 guide](https://developer.themoviedb.org/reference/authentication-how-do-i-generate-a-session-id)).
- **The redirect carries no documented parameters.** The docs do not say whether TMDB appends the token, an approval flag or a denial flag to the redirect. GoodWatch should keep the request token in its own short-lived server state, keyed to the member, and simply try step 4. A denied or expired token should make step 4 fail. **Unconfirmed**.
- **The access token grants read and write.** The documented example access token decodes to `"scopes":["api_read","api_write"]` and has no `exp` claim. No read-only scope is documented. **Secondary** (decoded from the first-party example in [create access token](https://developer.themoviedb.org/v4/reference/auth-create-access-token)). Treat the token as long-lived until deleted, and never call a write endpoint.
- **The two account ids differ.** v4 uses a string object id such as `4bc8892a017a3c0f92000002`. v3 uses an integer such as `548`. **Confirmed** from the examples in [create access token](https://developer.themoviedb.org/v4/reference/auth-create-access-token) and [account details](https://developer.themoviedb.org/reference/account-details).
- **The v3 conversion needs the member's token.** "The v4 token needs to be authenticated by the user. Your standard 'read token' will not validate to create a session ID." **Confirmed** ([reference](https://developer.themoviedb.org/reference/authentication-create-session-from-v4-token)).
- **GoodWatch's existing key is enough to start the flow.** Steps 1, 4 and 6 authenticate with the application's API read access token, which also works for v3 calls as a bearer token. **Confirmed** ([application authentication](https://developer.themoviedb.org/docs/authentication-application), [create access token](https://developer.themoviedb.org/v4/reference/auth-create-access-token), [staff, 2020](https://www.themoviedb.org/talk/5f12c3fa78570e0033550ad5): "v3 supports using the v4 bearer tokens"). No separate approval for user authentication is documented. **Unconfirmed** that none exists. Whether GoodWatch's use is commercial is a separate question (see [terms](#terms)).
- **v3 user calls take `session_id` as a query parameter.** "User authentication is controlled with a `session_id` query parameter." **Confirmed** ([v3 user authentication](https://developer.themoviedb.org/docs/authentication-user)).

## Endpoints

All list endpoints are `GET`, take `page` (default 1), `language` (default `en-US`) and `sort_by` (`created_at.asc` or `created_at.desc`, default `created_at.asc`), and return `page`, `results`, `total_pages` and `total_results`. **Confirmed** from each reference page below.

| List | Endpoint | Item fields that matter | Date per item | Score field | Label |
| --- | --- | --- | --- | --- | --- |
| Rated movies | `/4/account/{account_object_id}/movie/rated` | `id`, `title`, `original_title`, `release_date` | `account_rating.created_at`, for example `2012-02-15T15:18:04.000Z` | `account_rating.value` | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-rated-movies)) |
| Rated TV | `/4/account/{account_object_id}/tv/rated` | `id`, `name`, `original_name`, `first_air_date` | `account_rating.created_at`, for example `2013-10-10T21:41:25.073Z` | `account_rating.value` | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-rated-tv)) |
| Rated episodes | `/3/account/{account_id}/rated/tv/episodes?session_id=…` | `id` (episode), `show_id`, `season_number`, `episode_number`, `name` (episode), `air_date` | None | `rating` | **Confirmed** ([reference](https://developer.themoviedb.org/reference/account-rated-tv-episodes)) |
| Movie watchlist | `/4/account/{account_object_id}/movie/watchlist` | `id`, `title`, `release_date`, `media_type` | None | n/a | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-movie-watchlist)) |
| TV watchlist | `/4/account/{account_object_id}/tv/watchlist` | `id`, `name`, `first_air_date`, `media_type` | None | n/a | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-tv-watchlist)) |
| Favorite movies | `/4/account/{account_object_id}/movie/favorites` | `id`, `title`, `release_date` | None | n/a | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-favorite-movies)) |
| Favorite TV | `/4/account/{account_object_id}/tv/favorites` | `id`, `name`, `first_air_date` | None | n/a | **Confirmed** ([reference](https://developer.themoviedb.org/v4/reference/account-favorite-tv)) |

Notes on the table:

- **No list returns an IMDb id.** Every `id` is a TMDB id, which is GoodWatch's own key, so no catalog matching is needed. **Confirmed** from the item schemas above.
- **Episode items do not include the show's name.** Only `show_id` is returned, so the show title must come from GoodWatch's catalog. **Confirmed** ([reference](https://developer.themoviedb.org/reference/account-rated-tv-episodes)).
- **Season ratings do not exist.** The v3 account reference lists rated movies, rated TV and rated TV episodes, and the v4 account reference lists rated movies and rated TV only. **Confirmed** ([v3 index](https://developer.themoviedb.org/llms.txt), [v4 index](https://developer.themoviedb.org/v4/llms.txt)).
- **v3 equivalents exist but are worse.** v3 has rated movies, rated TV, watchlists and favorites too ([rated movies](https://developer.themoviedb.org/reference/account-rated-movies), [watchlist movies](https://developer.themoviedb.org/reference/account-watchlist-movies), [watchlist TV](https://developer.themoviedb.org/reference/account-watchlist-tv), [favorite movies](https://developer.themoviedb.org/reference/account-get-favorites), [favorite TV](https://developer.themoviedb.org/reference/account-favorite-tv)). Its rated items carry a bare `rating` and no date. **Confirmed**. Use v4 wherever it exists.
- **A rating removes the title from the watchlist by default.** "By default, we will remove a rated item from your watchlist if it's present." Members can change this in their sharing settings. So want and rating rarely overlap for the same title. **Confirmed** ([add rating](https://developer.themoviedb.org/reference/movie-add-rating)).
- **`created_at` may not be the time the member rated.** In the documented rated-movies example, all 17 items share one of two timestamps a second apart, which looks like a bulk import or migration rather than real rating times. Whether `created_at` changes when a member changes a rating is not documented. **Unconfirmed** ([example](https://developer.themoviedb.org/v4/reference/account-rated-movies)). The existing importers already warn on repeated timestamps; TMDB needs the same.
- **Not covered:** v4 also has custom lists ([lists](https://developer.themoviedb.org/v4/reference/account-lists)) and TMDB's own recommendations ([recommended movies](https://developer.themoviedb.org/v4/reference/account-movie-recommendations)). Neither is part of the ticket.

### Rating increments

- The schemas type the score as `integer`, but every example uses decimals: `8.0`, `8.5`, `7.5`, `9.5`, `10.0`. **Confirmed** that the schema and examples disagree ([v4 rated TV](https://developer.themoviedb.org/v4/reference/account-rated-tv), [v3 rated episodes](https://developer.themoviedb.org/reference/account-rated-tv-episodes)). Parse the value as a number.
- The website's minimum vote is 0.5. Through the API, a value of 0 was once possible. **Confirmed** (staff, 2012: "on the website it's impossible to vote a movie with a 0 and only 0.5", [thread](https://www.themoviedb.org/talk/50851962760ee30fdf000d0a)). Whether 0 is still accepted today is **unconfirmed**; treat it as invalid.
- The range 0.5 to 10 in steps of 0.5 is **secondary**: it is consistent with every first-party example and the staff statement, but no current page states it. The add-rating references give only the example `{"value": 8.5}` ([movie](https://developer.themoviedb.org/reference/movie-add-rating), [TV](https://developer.themoviedb.org/reference/tv-series-add-rating), [episode](https://developer.themoviedb.org/reference/tv-episode-add-rating)).

## Limits

- **Rate limit:** the legacy limit of 40 requests per 10 seconds was disabled on December 16, 2019. Upper limits "sit somewhere in the 40 requests per second range" and may change; respect HTTP `429`. **Confirmed** ([rate limiting](https://developer.themoviedb.org/docs/rate-limiting)). Whether the limit is counted per IP or per key, and so whether it is shared with GoodWatch's catalog sync, is **unconfirmed**.
- **Page size:** 20 items. **Secondary**: no page states it, but every documented total fits 20 per page (940 results in 47 pages, 291 in 15, 186 in 10, 80 in 4) ([v4 rated movies](https://developer.themoviedb.org/v4/reference/account-rated-movies), [v4 rated TV](https://developer.themoviedb.org/v4/reference/account-rated-tv), [v3 rated episodes](https://developer.themoviedb.org/reference/account-rated-tv-episodes), [v4 movie watchlist](https://developer.themoviedb.org/v4/reference/account-movie-watchlist)).
- **Maximum page:** not documented for account lists. **Unconfirmed**. If TMDB caps account lists the way it caps some public lists, an account with more than 10,000 items in one list would be cut off. Check `total_results` against the items read and warn on a shortfall.

### Request count

Requests = 6 fixed calls + one call per page of each list, with at least one call per list.

- Fixed calls: request token, access token, session conversion, v3 account details, delete session, delete access token.
- Pages per list: `max(1, ceil(items / 20))`.

Worked example for a member with 2,000 ratings: 1,500 movies, 400 shows and 100 episodes, plus 300 movies and 60 shows on the watchlist and 40 movies and 15 shows as favorites.

| Part | Items | Requests |
| --- | --- | --- |
| Fixed calls | n/a | 6 |
| Rated movies | 1,500 | 75 |
| Rated TV | 400 | 20 |
| Rated episodes | 100 | 5 |
| Movie watchlist | 300 | 15 |
| TV watchlist | 60 | 3 |
| Favorite movies | 40 | 2 |
| Favorite TV | 15 | 1 |
| **Total** | | **127** |

- If all 2,000 ratings are movies and the other lists are empty: 6 + 100 + 6 = 112 requests.
- Without episode ratings, the v3 calls drop out (conversion, account details, episode pages, delete session): 127 − 8 = 119 requests.
- At 40 requests per second this is about 3 seconds. Fetched one at a time it takes longer; at an assumed 200 ms per call, about 25 seconds. After the first page of a list, `total_pages` is known, so the remaining pages can be fetched in parallel within the limit.

## Ending the connection

The goal is that GoodWatch keeps nothing that grants access once the import has read its lists.

| Step | Call | Body | Label |
| --- | --- | --- | --- |
| 1. Delete the v3 session, if one was created | `DELETE https://api.themoviedb.org/3/authentication/session` | `{"session_id": "…"}` | **Confirmed** that the endpoint exists and the example body carries `session_id` ([reference](https://developer.themoviedb.org/reference/authentication-delete-session)) |
| 2. Delete the v4 access token | `DELETE https://api.themoviedb.org/4/auth/access_token` | `{"access_token": "…"}` | **Confirmed**: "Log out of a session." The success response is `status_code` 13, "The item/record was deleted successfully." ([reference](https://developer.themoviedb.org/v4/reference/auth-logout)) |

- Both endpoints authenticate with a bearer token in `Authorization`. The docs do not say whether it should be the application's read access token or the member's token. **Unconfirmed**; the application token is the likely choice because the member's token is in the body.
- Whether deleting the v4 token also ends a v3 session converted from it is **unconfirmed**. Delete the session first, then the token.
- Hold the access token and session only in memory or short-lived server state for the duration of the import. Do not write them to the import journal, logs or error reports. If a delete fails, retry; if it still fails, tell the member how to end the connection on TMDB.
- Whether TMDB offers members a page to see and revoke connected apps is **unconfirmed**. TMDB's privacy policy says that to stop sharing with an authorized third-party application, the member must "disable the feature, cancel your applicable subscription, or manage your Third-Party Application account" ([privacy policy](https://www.themoviedb.org/privacy-policy), effective August 24, 2026). That puts the burden on GoodWatch to end the connection itself.

## Terms

All quotes are from the [API terms of use](https://www.themoviedb.org/api-terms-of-use) (last updated October 20, 2023) unless stated otherwise. They are **confirmed** as text. How they apply to a member's own ratings is **unconfirmed** interpretation.

- **Scope of "TMDB Content."** §1.A defines it as "any content (including audio or visual content) or other information available through, on, or from the TMDB APIs or TMDB." A member's ratings, watchlist and favorites are available through the API, so a literal reading includes them.
- **Six-month cache limit.** §1.C forbids caching "for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs." Read literally, this would cover imported ratings kept as GoodWatch data. A narrower reading is that once a member brings their own ratings into GoodWatch, they are the member's GoodWatch ratings, not a cache of TMDB. The terms do not settle this.
- **Machine learning.** §1.C forbids using "the TMDB APIs or TMDB Content in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application." §2.A lists "training or validating a machine learning or artificial intelligence system … using TMDB content" as commercial use, and §1.A reserves ML use to TMDB. If imported ratings feed a recommender that uses embeddings or a learned ranker, this clause is the one to clear first.
- **Recommendations are named as commercial use.** §2.A lists "operating a website that generates revenue through charging users for access to content, or through recommend content, such as movies, television shows and music, in connection with, or due, to Your use of TMDB." Commercial use "is only permitted under a separate written agreement." This applies to GoodWatch's catalog use already; it is an existing owner question recorded in [the TMDB episode catalog note](../season-episode-scores/tmdb-episode-catalog.md), not a new one.
- **Termination purge.** §1.D: on termination, "you must promptly delete or otherwise purge all TMDB Content, including any cached content."
- **Attribution.** §3 requires the TMDB logo and the notice "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." The connect screen is a natural place for it.
- **Members keep rights in what they contribute.** The site [terms of use](https://www.themoviedb.org/terms-of-use) (last updated May 10, 2024) say "We do not claim any ownership right in Your Contributions" (§2.D). The site restrictions on building a business, recommending content or training ML (§3.B) are written about "other users' Contributions," not a member's own. Whether a rating is a "Contribution" is not defined. **Unconfirmed** interpretation.
- **TMDB expects to share with authorized apps.** "If you connect your TMDB account to a Third-Party Application, TMDB may automatically share your activity and actions … with that Third-Party Application" ([privacy policy](https://www.themoviedb.org/privacy-policy)). **Confirmed**.
- **There is a file alternative.** Members can export their rated, watchlist and favorites lists as CSV from the website. **Confirmed** (staff, 2018: "You can now export your 3 main account lists (rated, watchlist and favourites)", [thread](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec)). A file the member uploads avoids holding any TMDB credential, but carries the same content-scope question.

## Mapping to observations

The import produces `ImportObservation` records as defined in `goodwatch-webapp/app/domain/imports.ts`. The keys follow the existing Trakt pattern (`trakt:rating:${mediaType}:${id}`). TMDB ids are stable, so keys do not depend on dates or list positions.

| TMDB item | `key` | `kind` | `mediaType` | `title`, `year` | `tmdbId` | Episode fields | `score` | Dates | `problem` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v4 rated movie | `tmdb:rating:movie:{id}` | `rating` | `movie` | `title`, year of `release_date` | `id` | n/a | `account_rating.value` after rounding; `null` if outside 0.5 to 10 | `addedAt` = `account_rating.created_at` | `invalid` if the score is `null` |
| v4 rated TV | `tmdb:rating:show:{id}` | `rating` | `show` | `name`, year of `first_air_date` | `id` | n/a | as above | `addedAt` = `account_rating.created_at` | as above |
| v3 rated episode | `tmdb:unsupported-rating:episode:{id}` | `unsupported` | `show` | show title from GoodWatch's catalog, or the episode `name`; year of `air_date` | `show_id` | `episodeTmdbId` = `id`, `season` = `season_number`, `episode` = `episode_number` | not applied | none | `unsupported`: "GoodWatch doesn't import season or episode ratings yet." (the Trakt wording) |
| v4 movie watchlist | `tmdb:want:movie:{id}` | `want` | `movie` | `title`, year of `release_date` | `id` | n/a | n/a | `addedAt` = `null` | none |
| v4 TV watchlist | `tmdb:want:show:{id}` | `want` | `show` | `name`, year of `first_air_date` | `id` | n/a | n/a | `addedAt` = `null` | none |
| v4 favorite movie | `tmdb:favorite:movie:{id}` | `favorite` | `movie` | `title`, year of `release_date` | `id` | n/a | n/a | `addedAt` = `null` | none |
| v4 favorite TV | `tmdb:favorite:show:{id}` | `favorite` | `show` | `name`, year of `first_air_date` | `id` | n/a | n/a | `addedAt` = `null` | none |

Fields the import never sets:

- `imdbId` is always `null`; no list returns it.
- `watchedAt`, `precision` and `pass` stay unset. TMDB has no watch history, so the import produces no `watch` observations, and `ImportOptions.watchDates` does not apply.
- `review` stays unset. TMDB reviews are not part of the account lists.

What the contract would need:

- `IMPORT_SOURCES` lists only `letterboxd` and `trakt`, so `tmdb` must be added.
- `ImportSummary.fileName` assumes an upload. A connect import needs a display value such as "TMDB account".
- The preview should warn when many ratings share one `created_at`, as the existing importers do for repeated timestamps, and should state the rounding rule for half-step scores.
- Fetching rated episodes only to show them as unsupported costs the whole v3 path (8 extra requests in the example and a second credential to delete). Skipping them and adding a single warning ("Episode ratings on TMDB were not read") is simpler. This is a product decision.

## Open questions

1. **Commercial standing.** Does GoodWatch's use count as commercial under §2.A, and does it need a written agreement? This predates TMDB connect. Owner question.
2. **Are imported ratings TMDB Content?** If yes, the 6-month cache limit and the ML clause would cover them once imported. Ask TMDB in the API support forum or through sales before shipping.
3. **Rounding rule.** How should 0.5 steps map onto GoodWatch's whole numbers: round half up (7.5 to 8), round half down, or keep the half? `Math.round` in the existing importers rounds half up.
4. **Episode ratings.** Read them and show them as unsupported, or skip the v3 path?
5. **v3 account id.** `/3/account/{account_id}` needs the integer id that only this call returns. Community walkthroughs describe calling it with the `session_id` ([thread](https://www.themoviedb.org/talk/605cbdda8f26bc002a612929), **secondary**). Whether the path id is ignored when `session_id` is present is **unconfirmed**. Only matters if episode ratings are read.
6. **Meaning of `created_at`.** Does it change when a member edits a rating? Do older ratings carry a migration timestamp?
7. **Token lifetime and revocation.** Does the v4 access token expire? Does deleting it end a converted v3 session? Which bearer token do the DELETE calls expect?
8. **Redirect behavior.** What does TMDB append to `redirect_to`, what happens when the member denies, and must the URL match anything registered with the API key?
9. **What the member sees.** Does the approval page name the app and say it can write? No read-only scope is documented.
10. **Page cap and rate-limit scope** for very large accounts and for sharing with catalog sync.

Questions 6 to 10 can be settled with one test run against a TMDB account the owner controls: approve, read each list, edit a rating and re-read it, deny once, and delete the token and session, then confirm each credential returns an error.

# Importing streaming-service watchlists into GoodWatch

Research checked **2026-10-18**. Scope: the titles people explicitly intend to watch, including provider My List, Watchlist and Merkliste collections. This is a research proposal, not an implemented integration or a promise of current provider compatibility.

Follow-up: [deeper wishlist exploration](wishlist-exploration/README.md) expands the tracker, browser and alternative routes, checks newer API restrictions, and refines the shared-format direction. Read it alongside this initial survey, particularly before choosing an intermediary service or copying an extension.

## Finding and recommendation

**This is feasible, but there is no universal streaming-account API.** The most useful next investment is a small, user-triggered browser exporter feeding GoodWatch's existing import preview, backed by a provider-neutral wishlist file format and better identity resolution. Pilot Netflix and Prime Video, then Disney+ and Crunchyroll. Keep official exports and existing public integrations as parallel routes. Do not spend the first iteration building a server-side streaming password/cookie vault.

There is actual code for reading these lists, not merely speculative scraping advice. However, code existence establishes a technical lead, not current authenticated success, complete pagination, permission from a provider, or compatibility with GoodWatch's catalog. The inspected multi-provider extension even has concrete completeness defects. Each provider needs a small live-account validation before it is advertised as supported.

A particularly useful new discovery is [Simkl's JustWatch importer](https://simkl.com/apps/import/justwatch/): its publisher supplies a bookmarklet that downloads watchlist/history JSON through the user's JustWatch session, reportedly including IMDb/TMDB identifiers. That changes the older inventory's blanket conclusion that JustWatch is impossible. It does **not** turn JustWatch's commercial availability API into a personal-list API.

## Evidence and limits

Evidence levels used below:

- **Official**: provider documentation confirms the feature, export, or API contract.
- **Code**: actual source implements list retrieval. This is primary evidence for what that implementation does, not provider endorsement or a successful live test.
- **Publisher claim**: the tool's own documentation advertises the behavior, but its implementation or output was not fully inspectable.
- **Unverified**: a plausible path for which this research did not establish a wishlist schema or working extraction.

No streaming account was signed in to, no private list fetched, no real privacy archive generated, no third party contacted, and no API application registered. Public documentation, repository source and published packages were inspected. No secrets, cookies or account data were used. Search results alone were not treated as evidence that an integration works. Generic privacy-access rights do not prove that an archive contains a current wishlist, its deleted entries, provider IDs or added dates. “No public API found” means none established in this investigation, not proof that no partner interface exists.

The older [import inventory](import-sources-inventory.md) predates much of the current implementation. This report uses today's code and [native import contract](../implementation/native-imports.md) for the baseline, plus [ADR 0008](../adr/0008-one-row-per-watch.md), [ADR 0009](../adr/0009-tracking-is-a-state-machine.md) and [CONTEXT.md](../../CONTEXT.md) for meaning. No new domain decision is made here.

## What already exists in GoodWatch

The live source catalog includes IMDb, Letterboxd, Trakt files, TMDB connect, Plex connect, MyAnimeList/Kitsu, Kodi, MovieLens and generic CSV. Sources: [ImportSources.ts](../../goodwatch-webapp/app/ui/imports/ImportSources.ts), [import contract](../implementation/native-imports.md).

- TMDB account watchlists already arrive through the connection. This is a useful existing bridge, not a new streaming-service importer.
- Plex already combines a PIN-authorized connection for owned-server history with an optional personal Watchlist RSS URL. The contract explicitly acknowledges that RSS may be incomplete and avoids private Discover APIs. Plex officially requires Plex Pass to generate that RSS URL. [Implementation](../../goodwatch-webapp/app/server/imports/plex-connect.server.ts), [Plex documentation](https://support.plex.tv/articles/universal-watchlist/).
- Generic CSV currently follows the Letterboxd interchange semantics for ratings, watches and reviews. An arbitrary title list must **not** be presented as already supported for Wishlist. Add a distinct wishlist mode/format or parser.
- The shared preview boundary already accepts parsed/fetched observations. New extraction can use this pipeline instead of inventing a second importer. [Service](../../goodwatch-webapp/app/server/imports/service.server.ts).
- Matching is not automatically available to every new provider: the title/year fallback is restricted to Letterboxd and CSV. A new provider name plus title strings would need explicit matching changes. [Preview](../../goodwatch-webapp/app/server/imports/preview.server.ts).
- Import application currently skips Wishlist additions when a title already has a watch log row. Interactive GoodWatch supports Want to rewatch on Seen titles, but import does not simply inherit that behavior. Decide and test this policy before promising that an exported rewatch wish survives. Separately, the `plan_to_watch` show-status guard protects established show states. [Apply](../../goodwatch-webapp/app/server/imports/apply.server.ts), [ADR 0009](../adr/0009-tracking-is-a-state-machine.md).

## Service feasibility matrix

“Browser pilot” means develop and validate extraction under a user-selected profile; it does not mean production support has been established.

| Service | Official export / supported account API established | Browser / source evidence | Suggested treatment |
| --- | --- | --- | --- |
| Netflix | Personal-data request confirmed; historical mirrored MyList field definitions found, but current archive schema **not verified**. Quick viewing-activity CSV is history, not My List. | MIT Netflix-specific extension extracts provider IDs and titles; multi-service DOM extension also exists. | First browser pilot; collect a redacted privacy export in parallel. |
| Prime Video | Profile-specific Watchlist confirmed. No Prime Watchlist OAuth scope established; Amazon shopping lists and portability subscription data are different. | Multi-service browser adapter; dedicated Kodi source is a useful private-interface lead. | First browser pilot, explicitly test amazon.de and primevideo.com, movie/series tabs and profiles. |
| Disney+ | Official Watchlist is explicit additions, distinct from Continue Watching. No wishlist export schema or public account-list API established. | Kodi private authenticated Watchlist implementation; multi-service DOM adapter. | Second browser pilot after Netflix/Prime, or promote if consented test accounts are easier to obtain. |
| Apple TV | App privacy document describes Watchlist and play history, not a public export schema. Apple Account Data Transfer API covers App Store data, not this list. | Private Kodi implementation; generic extension calls its extraction best-effort Up Next. | Defer until explicit wishes can be separated from continuation rows and cross-app content. |
| Max / HBO Max | Official My List and privacy-access process documented; schema unverified. | Private Kodi list endpoint; generic DOM extension has mixed-media omission risk. | Pilot after core providers; validate current branding/domain/region and unavailable-title behavior. |
| Hulu | Official My Stuff is broader than a simple movie/show wishlist. | Private Kodi source and DOM adapter exist. | Separate movie/show selection from channels, episodes and continuation before importing. |
| Paramount+ | My List feature, but no verified wishlist export/API contract established. | Multi-provider DOM selector code only. | Demand-driven browser spike; not a ready connector. |
| Peacock | My Stuff feature, but no verified wishlist export/API contract established. | Multi-provider DOM selector code only. | Same; profile, pagination and titles require live proof. |
| Crunchyroll | Official Watchlist/Crunchylists exist; no public third-party account API contract established. | Actual Apps Script calls private watchlist and custom-list endpoints; a hard 500-item request is not full pagination. | Strong second-wave candidate; keep custom lists opt-in and handle anime mapping. |
| WOW / Sky | No verified portable Merkliste schema or third-party account-list API established. | Regional list functionality established; no production extraction proven here. | Demand/sample-driven research, rather than a speculative “Connect Sky” button. |
| RTL+ | No verified wishlist export/schema/API established. | Personal watchlist functionality and privacy pages offer a future test surface. | Browser feasibility spike with a real profile. |
| Joyn | No verified wishlist export/schema/API established. | Merkliste functionality offers a browser surface; public playback/catalog scraping is not account-list access. | Browser feasibility spike, profile/login test first. |
| ARD / ZDF | Merkliste functionality established, not a supported third-party export API. | Account transition makes a new connector particularly time-sensitive. | Recheck after announced late-October 2026 ARD/ZDF account transition. |
| Plex | Official personal Watchlist RSS, Plex Pass required; already supported in GoodWatch. | Python-PlexAPI/private Discover routes can read more than RSS but are a different dependency/risk. | Improve current UX/completeness disclosure first; private API is a separate proposal. |
| JustWatch | Commercial partner API is catalog/availability, not personal-list OAuth. | Simkl-published local JSON bookmarklet; independent OSS extraction exists. | High-value sample-file pilot; validate actual output before recommending a bridge through another account. |
| Google TV / Google Saved | Official Saved collections CSV schema and portability OAuth scope exist; exact Google TV wishlist inclusion unverified. | Google TV points browser users to Interests. | Test Takeout/Saved exports first; add OAuth only after proving coverage. |

Provider-level sources and code details follow. The international row order is a suggested engineering order based on evidence and reusable work, not a measured ranking of GoodWatch users' subscriptions.

## Official paths: what they do and do not give us

### Netflix

Netflix documents an account-owner export request at `netflix.com/account/getmyinfo`, with up to 30 days after verification; a profile user with an attached email can request their information separately, with the owner notified. The public page does not specify a My List file or its columns. Consequently, names such as `CONTENT_INTERACTION/MyList.csv` remain **unverified** here and must not become a parser contract without a sample. [Netflix personal information](https://help.netflix.com/en/node/100624).

There is stronger **historical schema evidence**, with a provenance caveat: a third-party mirror of a Netflix-authored “Member Information Request Response” cover sheet describes a `MyList` table with `Profile Name`, `Title Name`, `Country` and `Utc Title Add Date`. The original document was not authenticated against a current Netflix archive; the mirror is not a current first-party API contract. A separate Consumer Reports-hosted 2021 dictionary URL returned HTTP 403 and was not read. This strengthens the case for obtaining a current Netflix archive before committing to browser-only extraction. It still does not establish the ZIP path, current membership versus historical additions, unavailable-title completeness or an immutable Netflix title ID. [Readable cover-sheet mirror](https://www.scribd.com/document/829444924/Cover-Sheet), [unread 2021 dictionary lead](https://innovation.consumerreports.org/wp-content/uploads/2022/03/Netflix-data-dictionary-2021.pdf).

Netflix also documents profile-specific My List and a profile-transfer feature that includes those titles. Profile transfer is between Netflix accounts, not an API GoodWatch can consume. The easily downloaded Viewing activity CSV is a watched-history input; importing it into Wishlist would invert its meaning. [My List](https://help.netflix.com/en/node/10523), [profile transfer](https://help.netflix.com/en/node/122698), [viewing activity](https://help.netflix.com/en/node/101917).

### Prime Video and Amazon API keys

Prime Video profiles have separate Watchlists and season progress. An importer must record which profile and regional storefront it read. [Amazon profile documentation](https://digprjsurvey.amazon.co.uk/csad/help/node/GEM24ZP4GX39MKU4).

Amazon does publish an extensive Data Portability API with Login with Amazon scopes. Inspection did **not** establish a Prime Video Watchlist scope. The documented gift lists, grocery lists, digital subscriptions, Fire TV telemetry and public shopping-wishlist visibility are not substitutes. A `Prime Video` enum in subscription data only identifies the subscription service. Buying an Amazon API product, registering Login with Amazon or acquiring an AWS key does not itself grant the desired access. [Complete official scope/schema catalog](https://developer.amazon.com/docs/amazon-data-portability/available-scopes.html).

Alexa Video Skills references to `WATCHLIST` describe requests sent **to a content provider's skill** to display that provider's content. They are not a general endpoint for downloading a customer's Prime Video list. [Alexa GetPlayableItems](https://developer.amazon.com/docs/video-skills-multimodal-devices/getplayableitems-channels.html).

### Disney+, Max and Apple

Disney explicitly says its Watchlist contains manually added shows/movies, and does not automatically include unfinished or previously watched content. It can contain rewatch wishes. This is close to GoodWatch's Want to See semantics. [Disney Watchlist](https://help.disneyplus.com/en-GB/article/disneyplus-en-nl-managing-watchlist).

Max documents My List separately from Continue Watching, per profile, and says titles can disappear when they are no longer available. That makes an exported list a snapshot of what the provider returns, not proof that absent wishes were intentionally removed. Its privacy page provides an access-request route but no machine-readable wishlist schema. [Max list behavior](https://help.max.com/vc-en/Answer/Detail/000002505), [HBO Max privacy/access requests](https://help.hbomax.com/tv-en/Answer/Detail/000002542).

Apple's TV privacy document covers Watchlist, play history, connected third-party apps and profiles. It does not promise GoodWatch an API to read them. The EU Account Data Transfer API is specifically for App Store account data and is not an Apple TV wishlist API. Apple data-download requests are a sample-validation lead, not a verified parser. [TV app privacy](https://www.apple.com/legal/privacy/data/en/apple-tv-app/), [Account Data Transfer API](https://developer.apple.com/support/account-data-transfer-api-eu/), [request a copy of Apple data](https://support.apple.com/en-us/102208).

### Google TV / Saved: a more credible official lead

Google TV says its Watchlist follows the Google account across devices and that browser users can find it on the Interests page. It warns that some services' content cannot be added. That is already a reason not to promise it is a complete proxy for every provider's wishlist. [Google TV Watchlist](https://support.google.com/googletv/answer/10059391?hl=en).

Google's Saved schema really does specify CSV: `title`, `item_content_url`, `note`, `tags`, `comment`, with an optional collection description before the header. It provides no guaranteed movie year, media type, TMDB/IMDb ID or added timestamp. The corresponding scope is `https://www.googleapis.com/auth/dataportability.saved.collections`. This is a concrete export/API lead; the documentation does **not** explicitly guarantee that all current Google TV Watchlist items are included. Test a representative Takeout archive, including older and recently added items, before making that claim. Do not confuse it with `search_ugc.media.watched`, thumbs, streaming-provider preferences or YouTube Watch Later. [Saved schema](https://developers.google.com/data-portability/schema-reference/save), [scope list](https://developers.google.com/data-portability/user-guide/scopes).

An API integration adds OAuth, app verification, region/age availability and potentially restricted-scope security review. Google's overview excludes under-18 accounts and requires availability checks. A file parser is a cheaper first experiment. [Portability overview](https://developers.google.com/data-portability/user-guide/overview).

### Tracker bridges

Trakt and TMDB lists help only when users have actually stored their intentions there. A playback scrobbler sending Netflix/Disney watches to Trakt does not automatically bring their unplayed My List titles. GoodWatch already consumes Trakt files and TMDB account watchlists. Continuous Trakt sync is a separate policy/authorization question; the earlier inventory records the API policy changes and should not be treated as standing approval. [Existing research](import-sources-inventory.md#trakt), [Trakt API policy source](https://github.com/trakt/trakt-api/blob/HEAD/projects/developer/src/lib/guides/api-use-policy.md).

Simkl's Netflix importer and enhancer explicitly describe **watch history** synchronization. The import page title uses “watchlists”, but the actual instructions are history-only. Its maintenance log documents repeated Netflix layout/history repairs, including February and July 2026: good evidence that browser integration creates an ongoing maintenance obligation. [Netflix importer](https://simkl.com/apps/import/netflix/), [enhancer changes](https://simkl.com/apps/chrome/enhancer/updated/).

Simkl itself has `plantowatch` statuses and export/API routes. Its API rules require a tracker already syncing another tracker to offer Simkl login/sync, attribution, secret handling and commercial licensing at the stated revenue threshold. Treat this as an optional tracker integration, not an invisible free identity lookup backend. [API rules](https://api.simkl.org/api-rules), [list statuses](https://api.simkl.org/conventions/list-statuses), [export formats](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-data-formats).

JustWatch is different: Simkl's **current own importer** specifically promises watchlist **and** history extraction to a local JSON file with IMDb/TMDB IDs, using the existing JustWatch login. The public description was verified, but the bookmarklet script could not be obtained through the raw HTTP request (Cloudflare challenge), and no sample JSON was examined. Do not assert its precise schema, completeness or code license. It is a strong candidate to test and to offer compatible file import for, without forcing users to upload their data to Simkl first. [Publisher instructions](https://simkl.com/apps/import/justwatch/).

## Keys, identity and catalog mapping

There are three different things commonly called “an API key”:

| Credential | What it can establish | What it does not establish |
| --- | --- | --- |
| A catalog/availability vendor key | Authorized access to that vendor's title/offer database; possibly provider IDs or deep links useful for matching | Access to a user's private Netflix/Prime/Disney list |
| An app registration plus user OAuth/PIN approval | Authorized user data within the actual endpoint/scopes, such as TMDB or Plex | Permission for unrelated providers or an undocumented endpoint |
| A streaming cookie, bearer token, CSRF value or embedded app key | Technical ability to make some requests as a browser/app | A public integration contract, enduring validity or safe redistribution |

JustWatch's partner API/data exports and Watchmode can aid catalog mapping, subject to their agreements. They do not provide streaming-account wishlists. TMDB's `/find` supports documented external IDs; Netflix, Amazon and Disney IDs are not among its listed sources. [JustWatch API](https://apis.justwatch.com/docs/api/), [JustWatch exports](https://apis.justwatch.com/docs/data_export/), [Watchmode API](https://api.watchmode.com/docs/), [TMDB find](https://developer.themoviedb.org/reference/find-by-id).

GoodWatch already extracts provider `stream_url` links next to TMDB IDs, country and provider in its availability pipeline. A reverse index from canonical provider IDs/URLs to TMDB titles could reuse this evidence. This is a **design inference**, not an evaluated matching solution: establish coverage, redirect formats, country dependence and whether the URL denotes a movie, show, season or episode. Never resolve an arbitrary URL from an uploaded file on the server without a restricted resolver. [Provider model](../../goodwatch-flows/windmill/f/tmdb_web/models.py), [link extraction](../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/fetch.py), [streaming sync](../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py).

Matching order proposed: verified TMDB/IMDb identity; unique provider-ID/URL crosswalk; explicit title/year/type candidates for user review. Preserve original provider ID, localized title and source URL. Never silently treat a season as a whole show, or merge remakes on title text alone. Provider availability is independent from the person's intention: a removed streaming offer should not erase their GoodWatch Wishlist entry.

## Actual implementation evidence and reuse assessment

Repository dates below identify inspected commits, not a claim that every provider adapter was tested on that date. No authenticated request was executed. A code license governs copying code; it does not grant the provider's permission for private API access.

| Project and inspected source | What the code actually does | Maintenance / reuse assessment |
| --- | --- | --- |
| [Netflix Watchlist Manager](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/background.js), [DOM extractor](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/content_script.js) | Exports an array of `{title, videoId, trackId?}`; extracts IDs from tracking-context attributes and `/watch/` links, scrolls the page. | MIT; inspected May 6, 2026 commit. Good concrete initial file format. No year or established TMDB mapping; test complete capture and current Netflix layout. Its restore functionality is unnecessary for GoodWatch. |
| [MediaShelf clipper readers](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/readers.js), [site adapters](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/sites.js) | DOM adapters for Netflix, Prime, Disney, Hulu, Max, Paramount, Peacock, Tubi, Crunchyroll and Apple. Captures title strings. | MIT; August 22, 2026 commit. Useful architecture/selector reference, not a turnkey connector. At most 25 scrolls; stopping on stable document height can stop before reaching the end. First nonempty selector wins: Max's separate show/movie selectors can omit one type. No provider IDs, year, profile or completeness proof. Apple extraction is explicitly best-effort Up Next. |
| [Prime Video Kodi implementation](https://github.com/Sandmann79/xbmc/blob/bfb3940ec796166f50b0c2beca9a8ee779689e5e/plugin.video.amazon-test/resources/lib/android_api.py) | Uses regional ATV base URLs and authenticated Android requests to `/cdp/mobile/getDataByTransform/v1/dv-android/watchlist/watchlistInitial/v3.js`; changes Initial to Next for later `startIndex`. Handles movie/TV filters and provider ASINs. | GPLv3; July 9, 2026 commit. Substantial protocol research, not a public Amazon SDK. Do not port its password/session management into GoodWatch by default. Adapt ideas independently or assess GPL obligations if reusing code. |
| [SlyGuy Disney+ source package](https://github.com/matthuisman/slyguy.addons/blob/7b571875f09ea4b33ae5d536b9d45337bef88b1c/slyguy.disney.plus/slyguy.disney.plus-0.20.33.zip) | Extracted Python source resolves `deeplink(ref_id='watchlist')`, gets page/set content through configured Explore endpoints, with limit/offset and per-profile bearer tokens. | Actual list path proven in source. Package `addon.xml` has a blank license, so do not assume permission to copy. October 18 repository snapshot is a package-mirror commit, not a verified add-on release date. |
| [SlyGuy Hulu package](https://github.com/matthuisman/slyguy.addons/blob/7b571875f09ea4b33ae5d536b9d45337bef88b1c/slyguy.hulu/slyguy.hulu-0.5.1.zip) | Reads `https://discover.hulu.com/content/v5/hubs/watch-later` with limit/offset, authenticated user token and device-token refresh; content uses EAB identifiers. | Private API; unspecified license in package. Useful read-path evidence, but entity kinds and profile semantics need verification. |
| [SlyGuy Max package](https://github.com/matthuisman/slyguy.addons/blob/7b571875f09ea4b33ae5d536b9d45337bef88b1c/slyguy.max/slyguy.max-0.2.9.zip) | Bootstraps service configuration, calls `/cms/routes/my-stuff`, selects `my-stuff-page-rail-my-list`; bearer token and page size 50. | Private API; unspecified license. Watchlist route does not itself demonstrate pagination, so completeness is unproven. |
| [Apple TV Kodi API](https://github.com/Breezyslasher/Kodi-Addons/blob/6e6ded1976aa1df07098851464630f0eab163e0f/plugin.video.appletv/lib/api.py) | Reads UTS canvases/shelves at `https://tv.apple.com/api/uts/v3`, with web-bootstrap developer bearer plus media-user-token. Carries server context and `nextToken`, caps traversal at 20 pages, deduplicates IDs. Recognizes `AddedToUpNext` context alongside in-progress content. | GPLv3; October 16, 2026 commit. Stronger protocol lead than DOM names, but not an Apple public account-data SDK. Explicit watchlist classification, 2FA/session handling, pagination cap and current service behavior need tests. |
| [Crunchyroll Apps Script](https://github.com/Vryntel/Crunchyroll-Export-Import-List/blob/main/Code.gs), [field mapping](https://github.com/Vryntel/Crunchyroll-Export-Import-List/blob/main/Global_var.gs) | Gets account ID from `/accounts/v1/me`; reads `/content/v2/discover/{account_id}/watchlist?order=desc&n=500`; reads `/content/v2/{account_id}/custom-lists` and individual lists. Extracts provider IDs/titles and watched/favorite flags. | No license found. README asks for a bearer token copied from the browser and reports short expiry. One watchlist request, no pagination loop. Isolate read-only extraction: project also contains account-mutating imports. |
| [JustWatch exporter](https://github.com/DHDS-2811/JustWatch_watch_list_importer_exporter/blob/7c91a009d678760e9c03a8edc56fcebab1a54963/export_watchlist.py) | Posts captured `GetTitleListV2` GraphQL payload to `https://apis.justwatch.com/graphql` with browser bearer token; advances `titleListAfterCursor` using `endCursor`/`hasNextPage`. | October 10, 2025 commit; no license found. Requires manually captured request data, and generic recursive extraction/title normalization loses useful identity context. Good protocol lead; retain original nodes in a new implementation. |
| [Python-PlexAPI account watchlist](https://github.com/pkkid/python-plexapi/blob/dea7cad9227ec976fa93c363c43c01b3cee305af/plexapi/myplex.py) | `watchlist()` reads `https://discover.provider.plex.tv/library/sections/watchlist/all?includeCollections=1&includeExternalMedia=1` using X-Plex-Token, with `fetchItems` pagination; online metadata can carry external GUIDs and watchlisted dates. | BSD-3-Clause; October 14, 2026 commit. Strong library candidate if replacing/augmenting RSS is explicitly chosen; community code, not proof of an official Discover API support contract. |

Sources deliberately not counted as working solutions:

- [kashifumar/netflix-my-list-exporter](https://github.com/kashifumar/netflix-my-list-exporter) describes a rich Excel exporter but the inspected repository only exposes documentation/license, not the promised implementation. Do not base feasibility on its feature list.
- [crunchyroll-go](https://github.com/crunchy-labs/crunchyroll-go/blob/master/watchlist.go) contains watchlist code but was archived in 2023. It is historical protocol evidence, not a maintained dependency.
- [ARDundZDF Kodi add-on](https://github.com/rols1/Kodi-Addon-ARDundZDF) has an internal add-on watchlist. That is not proof it reads ARD/ZDF account lists.
- [Peacock MCP project](https://github.com/markswendsen-code/mcp-peacock) advertises browser read/write automation, but was not validated as a dependency. Broad automation and login handling add more exposure than a one-shot list exporter.
- Playback/download tools, DRM keys, decryption libraries and video-download features do not solve list access. This project only needs title metadata and explicit user intentions.

## Regional and mixed-content details

| Service | Primary evidence | Consequence for import |
| --- | --- | --- |
| WOW | [Official help](https://www.wowtv.de/hilfe/artikel/watchlist-und-downloads) describes films, shows and on-demand sports in Merkliste, unavailable entries grayed out, and separate Continue Watching. | Preserve unavailable saved titles if returned; report sports/unsupported entities separately. Do not apply Continue Watching expiry to wishes. No Sky-wide account export or API was established from this WOW-specific evidence. |
| Joyn | [Joyn team's FAQ](https://community.joyn.de/dein-joyn-account-30/was-ist-joyn-ueberhaupt-207) confirms an on-demand Merkliste. | Real signed-in list structure remains to be inspected; no schema or maintained library verified. |
| RTL+ | [Publisher app listing](https://play.google.com/store/apps/details?hl=de&id=de.rtli.tvnow) confirms favorites-based personalization. | Evidence is weaker: verify actual list kinds and account access before designing a connector. No export/schema confirmed. |
| ARD | [Account help](https://hilfe.ard.de/mediathek/login-meins-und-konto-mt/ard-konto/) describes synchronized lists, historically not shared with ZDF. | Keep source identity; shared login alone does not imply a shared list. |
| ZDF | [FAQ](https://www.zdf.de/fragen-und-antworten-zdf-streaming-100), [account help](https://www.zdf.de/hilfe-anmeldung-registrierung-102) describe saved videos and whole formats, with device-local lists when signed out. | Distinguish series/formats from episodes and account lists from device-local storage. “Import ZDF” may need a browser-device scope even without login. |
| ARD/ZDF migration | [Official announcement](https://hilfe.ard.de/mediathek/login-meins-und-konto-mt/ard-zdf-konto/) announces a shared account from late October 2026. | Recheck after rollout; the announcement does not establish third-party list export. |
| Hulu | [My Stuff](https://help.hulu.com/article/hulu-my-stuff) includes shows, movies, episodes, networks, sports/teams and DVR-related items. [Disney/Hulu update](https://help.hulu.com/article/hulu-is-hulu-going-away) describes eligible profile-linked content. | Filter explicitly and disclose exclusions. Linking to Disney is not a universal export mechanism. |
| Paramount+ | [Provider support](https://cbsi.my.salesforce-sites.com/CBSi/articles/en_US/Knowledge/PD-How-do-I-add-shows-and-movies-to-My-List?data=&popup=false&template=ottShoTemplate) describes My List and a 50-item limit. | Treat the documented limit as something to verify on current regional accounts, not a reason to silently cap extraction. |
| Peacock | [Official help](https://www.peacocktv.com/help/article/can-i-create-a-watchlist) includes movies, shows and selected live events. | Do not turn live events into movie/show matches. |
| Crunchyroll | [Official help](https://help.crunchyroll.com/hc/en-us/articles/18184740052628-How-do-I-add-shows-to-my-Watchlist-Crunchylist) distinguishes Watchlist from named Crunchylists and describes Premium limits. | Preserve list identity and allow selection. Anime cours/parts, dub variants and seasons need careful mapping; never convert saved-list membership into watched history. |

## Proposed extraction and import contract

This is a design proposal, not a new accepted ADR.

1. The person opens the provider's own list, signs in there and selects a profile.
2. They click “Export Wishlist” in a browser extension. Start with an explicit action using `activeTab` and `scripting`; Chrome grants temporary access to the current origin on that action. A different API origin may require a separately explained optional host permission. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
3. The exporter reads only the selected list. Prefer a structured first-party response when available in the browser session; use DOM extraction where that is simpler and reliable. Keep cookies/session tokens in the provider browser, not in the exported file or GoodWatch servers. Do not collect browsing across unrelated tabs. [Chrome user-data policy](https://developer.chrome.com/docs/webstore/user_data).
4. Export a small local JSON/CSV file; the user uploads it to GoodWatch. This gives a reviewable artifact and decouples provider authentication from GoodWatch. A direct extension-to-GoodWatch handoff can follow after this format is stable.
5. GoodWatch validates, resolves identity and shows a preview of additions, existing titles, unsupported types and unresolved items. Only confirmed intentions become Want to See observations. Keep added dates only when the source actually supplies them.
6. Apply additions through the existing import pipeline and expose its receipt/undo behavior. A partial export must never delete existing Wishlist entries. Continuous reconciliation, removals and two-way sync are separate later features requiring provenance and conflict rules.

Suggested versioned envelope:

```json
{
  "format": "goodwatch-wishlist",
  "version": 1,
  "source": "netflix",
  "profileLabel": "Selected profile",
  "country": "DE",
  "exportedAt": "2026-10-18T12:00:00Z",
  "completeness": "unknown",
  "items": [
    {
      "sourceId": "provider-id",
      "sourceUrl": "https://provider.example/title/provider-id",
      "title": "Original displayed title",
      "mediaType": "unknown",
      "year": null,
      "addedAt": null,
      "list": "My List"
    }
  ]
}
```

Optional known IMDb/TMDB IDs and source list ID belong in this format too. `exportedAt` is not `addedAt`. `unknown` is intentional: browsers often expose too little to know type, year or completion. Do not include source account email, cookies, authorization headers, device identifiers or a raw network archive. Retain enough provenance to explain a match without retaining unrelated private response fields.

Completeness must be observable: report captured count, provider-reported total when available, exhausted pagination or lack thereof, selected movie/show filters, profile, and any cap/error. A stable DOM height alone is not proof of complete capture; virtualized lists recycle cards. Capture IDs incrementally while scrolling and reconcile unique counts. A session expiry should produce a partial result/error, not a deceptively empty success.

## Recommended sequence and acceptance gates

### First: shared wishlist ingestion and two provider experiments

Build the versioned wishlist parser and identity review on the existing preview/apply boundary, then validate Netflix and Prime against consented accounts. Reuse the Netflix JSON export shape as a compatibility target. Start user-triggered and one-way. Do not require a tracker account between the streaming service and GoodWatch.

In parallel request representative redacted Netflix and Amazon privacy exports through the account owners, checking whether they contain **current** list membership, removed-item events or both. If official archives prove rich and reliable, prioritize their parsers over maintaining an equivalent browser adapter for users willing to wait. No archive parser should be built from an assumed filename.

Acceptance: two profiles cannot leak into each other; movies and shows both survive; a list larger than the visible page is complete or explicitly marked partial; provider IDs survive; ambiguous matches require review; an unavailable title is retained if the source still returns it; repeated import adds nothing twice; watched/rewatch wishes follow an explicit policy rather than disappearing without explanation.

### Second: high-value reuse and structured sources

- Test Simkl's JustWatch bookmarklet output. If it contains stable IMDb/TMDB identities as advertised, support that local file directly; obtain its actual schema and reuse permission before borrowing code.
- Test Google Saved/Takeout with a representative Google TV Watchlist. Include old/recent saves and multiple collection origins. Only add a Google OAuth connection after coverage and matching are demonstrated.
- Validate Disney+ and Crunchyroll using their documented list meanings and the inspected protocol leads. Keep Crunchylists opt-in and preserve unsupported entries for review.
- Improve discovery of existing Plex/TMDB support. Evaluate Python-PlexAPI only if measured user demand for complete/free-account Plex list retrieval justifies a private-interface connector.

### Later: remaining providers and ongoing sync

Add Max, Apple TV, Hulu, Paramount+, Peacock and regional services according to actual user demand and test-account availability. Apple and Hulu require semantic work beyond DOM extraction. Recheck ARD/ZDF after their account migration. Add scheduled synchronization only when source identity, deletion behavior, incomplete snapshots, session expiry and conflicts with GoodWatch edits have explicit rules.

### Concrete validation checklist

| Test | Why it is necessary |
| --- | --- |
| Empty, one-title and large lists, including more than one page | Detect empty-auth failures, pagination caps and virtualized DOM loss. |
| Adult, secondary and protected profiles | Verify correct ownership and an understandable unsupported case. |
| Movie/show mixture; season/episode rows; live events | Prevent scope and media-type corruption. |
| German/English titles, same-name remakes, different release years | Measure identity quality, not just extraction count. |
| Unavailable/gray titles and canceled subscription access | Establish how much intention the provider still exposes. |
| Already Seen title explicitly saved for rewatch | Resolve the current import/application mismatch with interactive rewatch semantics. |
| Re-import same file, changed list, changed GoodWatch state since preview | Preserve idempotence and newer user choices; do not infer deletions. |
| Token expiry midway, rate limit, interrupted scroll, provider UI variation | Require a partial/error receipt instead of silent data loss. |
| Inspect exported file and network destinations | Confirm credentials and unrelated history never leave the provider context. |
| Real-account output compared with manual list count | Distinguish code inspection from a working complete integration. |

## Open questions worth answering before implementation

1. Are one-time imports sufficient initially, or is ongoing background sync a product requirement? The recommendation here is one-time import first; the evidence does not justify promising reliable background sync across providers.
2. Should imported explicit rewatch wishes be preserved for Seen titles? Interactive GoodWatch supports them, while the current import writer skips watched titles.
3. Which source profiles and countries represent the actual users? This affects authentication, provider domains, localized matching and test coverage.
4. What measured fraction of provider IDs can the existing streaming-link catalog resolve unambiguously? This may determine whether identity work or extraction is the bigger cost.
5. Can a redacted official archive replace browser extraction for any high-demand provider? Netflix is the first archive to obtain, not an assumed solved schema.

The practical opportunity is strong: browser-accessible saved lists and several real implementations exist. The missing work is a reliable boundary between extraction, title identity and GoodWatch's intention semantics—not finding a single master API key.

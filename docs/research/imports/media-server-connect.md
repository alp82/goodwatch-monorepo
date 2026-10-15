# Connecting Plex, Jellyfin and Emby without API keys or scripts

Research date: 2026-10-15. Status: findings and a recommendation for [issue #613](https://github.com/alp82/goodwatch-monorepo/issues/613), part of #365. This is not an approved implementation plan.

This note follows the media server rows in the [import sources inventory](../import-sources-inventory.md). It asks whether a member can bring Plex, Jellyfin or Emby history to GoodWatch with a sign-in or a built-in file, and no API keys, scripts or manual conversion.

Labels:

- **Confirmed** means read in a first-party source: official documentation, the vendor's source code, or a direct request made for this note.
- **Secondary** means read only in third-party code, a forum post or a blog.
- **Unconfirmed** means not established.

No account was signed in to, no server was queried with credentials, and nobody was contacted. Jellyfin source was read at tag [`v12.2`](https://github.com/jellyfin/jellyfin/tree/v12.2) (commit `ca0f16eb`), the latest release on 2026-10-15. Nothing here is legal advice.

## Summary

- **Plex has two separate stores.** Your own server keeps one dated row per play. plex.tv keeps an account-wide watch history, ratings and the watchlist, but only for members who turned on **Sync My Watch State and Ratings**. **Confirmed.** ([PMS API](https://developer.plex.tv/pms/), [Plex support](https://support.plex.tv/articles/sync-watch-state-and-ratings/))
- **Sign in with Plex needs no API key or password entry on GoodWatch.** The documented PIN flow sends the member to `app.plex.tv` and returns a token. **Confirmed.** ([PMS API, "Authenticating with Plex"](https://developer.plex.tv/pms/))
- **The plex.tv side needs no reachability, but its read APIs are undocumented.** Only the server API is published. Third-party tools read history, ratings and the watchlist from `community.plex.tv` and `discover.provider.plex.tv`. **Secondary.**
- **Jellyfin and Emby store state, not history.** Each item has a play count, a last played date, a played flag and a favorite flag. There is no per-play log without an admin-only plugin. **Confirmed.**
- **Jellyfin allows any origin by default.** The default CORS setting is `*`. **Confirmed** in source. Emby's current CORS behavior is **unconfirmed**.
- **The browser can reach a home server only in some cases.** An HTTPS page cannot call `http://` on a LAN in Safari. Chrome 142 and later allow it for private IP literals and `.local` names after the member grants a Local Network Access prompt. **Confirmed** for Chrome, **unconfirmed** for Safari and partly for Firefox.
- **No server offers a per-member export file.** Plex has an admin "Download Database" zip. Jellyfin and Emby have admin backups. None is a file a normal member can upload. **Confirmed.**

Recommendation in short: build **Plex from GoodWatch's server** using the plex.tv account data, with a server fallback. Build **Jellyfin from the browser** with Quick Connect sign-in. **Leave Emby out** for now. Details are in [Recommendation per server](#recommendation-per-server).

## Plex

### Sign in with Plex

The PMS API documentation describes a PIN flow for apps that need a member's Plex token. **Confirmed.** ([PMS API, "Authenticating with Plex"](https://developer.plex.tv/pms/))

1. GoodWatch creates a PIN with `POST https://plex.tv/api/v2/pins?strong=true`, sending `X-Plex-Product` and `X-Plex-Client-Identifier`. The response has `id` and `code`.
2. GoodWatch sends the member to `https://app.plex.tv/auth#?clientID=…&code=…&forwardUrl=…&context[device][product]=GoodWatch`. The docs call this the **Forwarding** flow for web apps.
3. The member signs in on plex.tv, not on GoodWatch.
4. Plex returns the member to `forwardUrl`. GoodWatch reads `GET https://plex.tv/api/v2/pins/<id>`. When claimed, `authToken` holds the token.

The docs also describe a newer JWT variant. It needs an Ed25519 key pair per device, and tokens expire after 7 days. **Confirmed.** A one-time import can use the legacy flow. The docs list the legacy flow and do not mark it as removed.

The token is broad. The docs say a JWT "can be used to access any Plex.tv endpoint or your Plex Media Server instance". The JWT scopes only control which profile fields appear in the token. **Confirmed.** ([PMS API](https://developer.plex.tv/pms/)) GoodWatch should use the token for the import and then discard it.

The app name appears in the member's **Authorized Devices** list. **Confirmed.** ([PMS API](https://developer.plex.tv/pms/))

### Data on the member's own server

`GET /status/sessions/history/all` lists playback history. The docs say to page it, and responses carry `X-Plex-Container-Start` and `X-Plex-Container-Total-Size`. Filters include `accountID`, `viewedAt>=…`, `librarySectionID` and `metadataItemID`. The docs say "Admin can see all users, others can only see their own". **Confirmed.** ([PMS API, Status](https://developer.plex.tv/pms/))

Fields per history row in the published schema: **Confirmed.**

| Field | Meaning |
| --- | --- |
| `historyKey` | Key for this history row, for example `/status/sessions/history/12` |
| `ratingKey`, `key` | The played item on this server |
| `title`, `type` | Title and type, for example `movie` or `episode` |
| `viewedAt` | When the item was played, as an integer. The example value is in epoch seconds |
| `accountID` | Plex account of the viewer |
| `deviceID` | Device that played it |
| `librarySectionID`, `originallyAvailableAt`, `thumb` | Library, air or release date, image |

The history schema has no external ids and no show title or season and episode numbers. Real responses likely include `grandparentTitle`, `parentIndex` and `index` for episodes. **Unconfirmed.** GoodWatch must look up each `ratingKey` with `GET /library/metadata/{ratingKey}`. Metadata items carry a `Guid` array with values like `imdb://tt0088763`, `tmdb://105` and `tvdb://…`. **Confirmed.** ([PMS API](https://developer.plex.tv/pms/)) A history row whose item was later removed from the library may have no metadata left to look up. **Unconfirmed.**

Metadata items also carry the member's state: `userRating` (0 to 10), `viewCount` and `lastViewedAt` (epoch seconds). **Confirmed.** ([PMS API](https://developer.plex.tv/pms/)) Ratings on the server have no documented rating date in the item schema. The rate endpoint accepts a `ratedAt` parameter, so the server may store one. **Unconfirmed.**

### Reaching the member's server

After sign-in, `GET https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1` lists the member's servers. Each server has an `accessToken` and a list of connection URLs marked `local` or `relay`. The docs say relay "should only be used as a last resort". **Confirmed.** ([PMS API, "Talking to PMS"](https://developer.plex.tv/pms/))

- Server URLs use `https://<ip>.<id>.plex.direct:<port>`, so they are HTTPS. **Confirmed.** ([PMS API servers block](https://developer.plex.tv/pms/))
- Relay is on by default. The member's server opens a connection to a Plex relay, and apps connect to the same relay. **Confirmed.** ([Plex support, Relay](https://support.plex.tv/articles/216766168-accessing-a-server-through-relay/)) Whether a third-party server such as GoodWatch can use a relay connection for API calls is **unconfirmed**.
- If neither a public connection nor relay works, GoodWatch's server cannot reach the member's server.

### Data on plex.tv

With **Sync My Watch State and Ratings** on, Plex stores watch state, watch history and ratings on the account. **Confirmed.** ([Plex support](https://support.plex.tv/articles/sync-watch-state-and-ratings/))

- The setting is opt in, under **Settings > Account**. It requires Plex Media Server 1.27.2 or later and the Plex Movie and Plex TV Series agents.
- Each watch event sends the Plex account id, the title's GUID, the date and time, and the watched or unwatched state. Each rating sends the GUID, the date and time, and the rating.
- On opt-in, Plex uploads "a single watch state record for each title … with the time of your most recent viewing". Every later watch adds a record. Earlier plays are not uploaded.
- Records do not say whether the play happened on a server, on Discover or on Plex's streaming service.
- Watches on other people's servers count too, because the setting belongs to the account.
- In-progress plays are not synced.

The member's profile shows Watch History, Watchlist and Ratings, with per-area privacy settings. A profile set to public is at `watch.plex.tv/<username>`. **Confirmed.** ([Plex support, Profile](https://support.plex.tv/articles/profile/))

Plex publishes no API for these. [developer.plex.tv](https://developer.plex.tv/) documents only the Plex Media Server API. **Confirmed.** Third-party code shows these endpoints. All are **secondary**:

| Data | Endpoint | Fields | Source |
| --- | --- | --- | --- |
| Watch history | `POST https://community.plex.tv/api`, GraphQL `user { watchHistory(first, after) }` | Entry `id`, `date` (ISO 8601), `metadataItem` with `id`, `type`, `title`, `year`, `index`, `parent`, `grandparent` | [plexterbox](https://github.com/hlamhuy/plexterbox/blob/73941065f16a79c610e1448bbd08a352b003e102/plex/account_history.go), [Maintainerr](https://github.com/Maintainerr/Maintainerr/blob/2bd82e8dd09a84ffed4e5bf233ae49158bf757a9/apps/server/src/modules/api/lib/plexCommunityApi.ts) |
| Ratings | Same endpoint, GraphQL `user { reviews }` with `ActivityRating` and `ActivityWatchRating` | `metadataItem.id`, `rating` (1 to 10) | [plexterbox](https://github.com/hlamhuy/plexterbox/blob/73941065f16a79c610e1448bbd08a352b003e102/plex/account_history.go) |
| Watchlist | `GET https://discover.provider.plex.tv/library/sections/watchlist/all` | Items, sortable by `watchlistedAt` | [python-plexapi](https://github.com/pkkid/python-plexapi/blob/dea7cad9227ec976fa93c363c43c01b3cee305af/plexapi/myplex.py) |
| Watch state per item | `GET https://metadata.provider.plex.tv/library/metadata/{id}/userState` | `viewCount`, `lastViewedAt`, `viewState`, `watchlistedAt` | [python-plexapi](https://github.com/pkkid/python-plexapi/blob/dea7cad9227ec976fa93c363c43c01b3cee305af/plexapi/myplex.py) |
| External ids | `GET https://discover.provider.plex.tv/library/metadata/{id}` | `Guid` values | [Pulsarr](https://github.com/jamcalli/Pulsarr/blob/2d4d662da9ff67df68fa176f02ccef836c600666/src/services/plex-watchlist/enrichment/single-item.ts) |

The items on plex.tv use Plex's own metadata ids, not the member's server `ratingKey`. Mapping to TMDB or IMDb needs one metadata lookup per distinct title. **Secondary.**

A documented alternative exists for the watchlist only. Plex Pass members can generate a watchlist RSS feed URL in the web app's Watchlist settings. **Confirmed.** ([Plex support, Universal Watchlist](https://support.plex.tv/articles/universal-watchlist/)) A forum report says the feed is capped at 25 items. **Secondary.** ([Plex forum](https://forums.plex.tv/t/watchlist-rss-feed-capped-at-25-items/933961))

Plex's Terms of Service forbid reverse-engineering "to attempt to discover any source code, algorithms, trade secrets, or applications underlying the Plex Solution". They also forbid circumventing "any Plex security or authentication measures". **Confirmed.** ([Plex Terms of Service](https://www.plex.tv/about/privacy-legal/plex-terms-of-service/)) Calling plex.tv endpoints with the member's own token and consent is how Plex's own web app works, but whether it is allowed for a third party is **unconfirmed**. The owner should decide.

### Plex files

- **No self-service account export.** The privacy policy offers "a copy of Personal Data associated with your account" after identity verification, through a request form at [preferences.plex.tv/privacy](https://preferences.plex.tv/privacy) or by email. **Confirmed.** ([Plex privacy policy](https://www.plex.tv/about/privacy-legal/)) The form is a DataGrail privacy request center. **Confirmed** by fetching its page shell. The contents, format and turnaround of that copy are **unconfirmed**. No settings page was found that downloads the data directly.
- **Download Database.** Under **Settings > Troubleshooting**, "your Plex Media Server will zip up the current server database for your browser to download". The zip "could be many megabytes in size". **Confirmed.** ([Plex support, Troubleshooting](https://support.plex.tv/articles/226836308-help/)) It is a SQLite database for the whole server and every user on it. Watch history lives in the tables `metadata_item_views` and `metadata_item_settings`. **Secondary.** ([PlexDBRepair](https://github.com/ChuckPa/PlexDBRepair/blob/d32a0635932247421d76fcac1ac4c3c8f4e07978/DBRepair.sh)) The schema is undocumented. Only server admins see this setting, and large libraries exceed GoodWatch's current 20 MB upload limit ([`imports.ts`](../../../goodwatch-webapp/app/domain/imports.ts)).

## Jellyfin

### Sign-in

`POST /Users/AuthenticateByName` takes `Username` and `Pw` and returns an `AuthenticationResult` with the access token and user. **Confirmed.** ([UserController.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Api/Controllers/UserController.cs))

Requests carry `Authorization: MediaBrowser Client="…", Device="…", DeviceId="…", Version="…", Token="…"`. The older `X-Emby-Token` and `X-Emby-Authorization` headers work only when `EnableLegacyAuthorization` is on, which defaults to off. **Confirmed.** ([AuthorizationContext.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Server.Implementations/Security/AuthorizationContext.cs), [ServerConfiguration.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Configuration/ServerConfiguration.cs))

**Quick Connect** avoids typing a password into GoodWatch. It is on by default. **Confirmed.** ([Jellyfin docs, Quick Connect](https://jellyfin.org/docs/general/server/quick-connect), [ServerConfiguration.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Configuration/ServerConfiguration.cs))

1. GoodWatch calls `POST /QuickConnect/Initiate` and gets a code and a secret.
2. The member opens a signed-in Jellyfin app, goes to **Settings > Quick Connect**, and enters the 6-character code. The web, Android and iOS apps can approve codes.
3. GoodWatch polls `GET /QuickConnect/Connect?secret=…` until approved.
4. GoodWatch calls `POST /Users/AuthenticateWithQuickConnect` with the secret and gets a token.

Sources: [QuickConnectController.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Api/Controllers/QuickConnectController.cs), [UserController.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Api/Controllers/UserController.cs). **Confirmed.** The member still has to type their server address into GoodWatch. Jellyfin has no central account or server directory.

### Played items, user data and favorites

`GET /Items?userId=…` lists items. The older `GET /Users/{userId}/Items` still exists and is marked obsolete. Useful parameters: `recursive=true`, `includeItemTypes=Movie,Episode`, `isPlayed=true`, `isFavorite=true`, `filters=IsPlayed,IsFavorite,Likes,Dislikes`, `fields=ProviderIds`, `enableUserData=true`. **Confirmed.** ([ItemsController.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Api/Controllers/ItemsController.cs))

Each item can carry `Name`, `ProductionYear`, `PremiereDate`, `Type`, `ProviderIds`, `SeriesName`, `SeriesId`, `ParentIndexNumber` (season), `IndexNumber` (episode) and `UserData`. **Confirmed.** ([BaseItemDto.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Dto/BaseItemDto.cs)) `ProviderIds` keys include `Imdb`, `Tmdb` and `Tvdb`. **Confirmed.** ([MetadataProvider.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Entities/MetadataProvider.cs))

`UserData` holds: **Confirmed.** ([UserItemDataDto.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Dto/UserItemDataDto.cs))

| Field | Meaning |
| --- | --- |
| `Played` | Played flag |
| `PlayCount` | Number of plays |
| `LastPlayedDate` | Last play only |
| `IsFavorite` | Favorite flag |
| `Rating` | 0 to 10, see below |
| `Likes` | Derived from `Rating` |
| `PlaybackPositionTicks`, `PlayedPercentage`, `UnplayedItemCount` | Progress |

Caveats from source: **Confirmed.** ([BaseItem.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Controller/Entities/BaseItem.cs), [UserItemData.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Controller/Entities/UserItemData.cs))

- Marking an item played without a date sets `LastPlayedDate` to the existing value, or else to the current time. A bulk "mark played" therefore stamps many items with the same moment.
- Setting a like stores `Rating` as 10, and a dislike stores 1. So `Rating` is usually a thumb, not a score. Whether any official client sets other values is **unconfirmed**.
- `UserData` has no watchlist or want-to-watch flag, so there is nothing to map to `want`.

Per-play history exists only in the official Playback Reporting plugin. Its API requires admin rights (`RequiresElevation`). **Confirmed.** ([PlaybackReportingActivityController.cs](https://github.com/jellyfin/jellyfin-plugin-playbackreporting/blob/814e507d06bf2f8186fabc182401333ae24d5394/Jellyfin.Plugin.PlaybackReporting/Api/PlaybackReportingActivityController.cs))

### CORS

`CorsHosts` defaults to `["*"]`. With that default, the CORS policy calls `AllowAnyOrigin()`, and the server applies `UseCors()` to every request. **Confirmed.** ([ServerConfiguration.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/MediaBrowser.Model/Configuration/ServerConfiguration.cs), [CorsPolicyProvider.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Server/Configuration/CorsPolicyProvider.cs), [Startup.cs](https://github.com/jellyfin/jellyfin/blob/v12.2/Jellyfin.Server/Startup.cs)) A reverse proxy in front of Jellyfin can still change these headers.

### Jellyfin files

Jellyfin 10.11 added a built-in backup in the dashboard. It writes a zip of the whole server database. **Confirmed.** ([Jellyfin docs, Backup and restore](https://jellyfin.org/docs/general/administration/backup-and-restore)) It is for admins and covers every user. There is no per-member export. **Confirmed** by absence in the docs.

## Emby

The public Emby repository's server code was last changed in 2018 ([commit history](https://github.com/MediaBrowser/Emby/commits/master/Emby.Server.Implementations/HttpServer/HttpListenerHost.cs)), so current behavior comes from the docs only.

### Sign-in

`POST /Users/AuthenticateByName` with the password in `pw`. The response has `AccessToken`. Later requests send `X-Emby-Token`. **Confirmed.** ([Emby docs, User Authentication](https://dev.emby.media/doc/restapi/User-Authentication.html))

**Emby Connect** links a local server to an emby.media account. An app posts `nameOrEmail` and `rawpw` to `https://connect.emby.media/service/user/authenticate`. It then lists servers with their remote `Url` and `LocalAddress`, and exchanges an `AccessKey` on the server through `GET /Connect/Exchange`. **Confirmed.** ([Emby docs, Emby Connect](https://dev.emby.media/doc/restapi/Emby-Connect.html)) This saves the member typing a server address, but the member still types their emby.media password into GoodWatch. Emby has no redirect sign-in like Plex and no Quick Connect equivalent in the docs. **Unconfirmed** beyond the pages read.

### Played items, user data and favorites

`GET /Users/{UserId}/Items` supports `IsPlayed`, `IsFavorite`, `Filters` (IsPlayed, IsFavorite, Likes, Dislikes and more), `Recursive`, `IncludeItemTypes`, `Fields=ProviderIds`, `EnableUserData`, and `SortBy=DatePlayed`. **Confirmed.** ([Emby API reference](https://dev.emby.media/reference/RestAPI/ItemsService/getUsersByUseridItems.html))

`UserItemDataDto` has `Played`, `PlayCount`, `LastPlayedDate`, `IsFavorite`, `Rating`, `PlayedPercentage`, `PlaybackPositionTicks` and `UnplayedItemCount`. **Confirmed.** ([Emby plugin API reference](https://dev.emby.media/reference/pluginapi/MediaBrowser.Model.Dto.UserItemDataDto.html)) As with Jellyfin, there is one last played date and no per-play log. Whether Emby's `Rating` is also a thumb stored as 1 or 10 is **unconfirmed**.

### CORS

The last open-source Emby code (2018) answered `OPTIONS` with `Access-Control-Allow-Origin: *`. **Confirmed** for that code. ([HttpListenerHost.cs](https://github.com/MediaBrowser/Emby/blob/c9391bd062945c331d4852714826aa776fae3d7b/Emby.Server.Implementations/HttpServer/HttpListenerHost.cs#L538-L547)) Current behavior is **unconfirmed**. Emby's hosted web app connects to member servers from another origin, so current servers must allow at least that origin. **Secondary** inference.

A request made for this note on 2026-10-15 showed `http://app.emby.media/` answering 200 over plain HTTP without redirecting to HTTPS. **Confirmed.** A plausible reason is to avoid mixed content blocking when the app calls `http://` servers on a LAN. **Unconfirmed.** A 2022 forum thread shows Chrome blocking that app's requests to a local server with "The request client is not a secure context". **Secondary.** ([Emby forum](https://emby.media/community/topic/105486-cant-connect-through-online-web-app))

### Emby files

The Backup & Restore plugin saves "User data: play-states & favorites" among other things. It requires Emby Premiere and is run by the admin from the server dashboard. **Confirmed.** ([Emby support, Backing up](https://emby.media/support/articles/Backup-Using-Plugin.html), [Emby support, copying play states](https://emby.media/support/articles/Backup-Restore-Playbacks-And-Favorites.html)) Its file format is undocumented. **Unconfirmed.**

## Browser access to a home server

GoodWatch is served over HTTPS. A typical home Jellyfin or Emby server listens on `http://192.168.x.x:8096` or similar. Jellyfin's HTTPS port is off by default, and its docs recommend HTTPS through a reverse proxy. **Confirmed.** ([Jellyfin docs, Networking](https://jellyfin.org/docs/general/post-install/networking/)) Plex servers are reached through `https://…plex.direct` names.

Three browser rules apply.

1. **Mixed content.** Browsers block `fetch()` and `XMLHttpRequest` from an HTTPS page to an `http://` URL. Loopback (`localhost`, `127.0.0.1`) is treated as secure. **Confirmed.** ([MDN, Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content))
2. **Local Network Access (LNA).** This replaced Private Network Access preflights, which Chrome put on hold. Sites must get the member's permission through a prompt before they can send requests to local or loopback addresses. **Confirmed.** ([Chrome blog](https://developer.chrome.com/blog/local-network-access), [MDN, Local network access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access))
   - Chrome ships the prompt from Chrome 142. When permission is granted, requests to private IP literals and `.local` names are exempt from mixed content blocking. Other hostnames need `fetch(url, { targetAddressSpace: "local" })`. **Confirmed.** ([Chrome blog](https://developer.chrome.com/blog/local-network-access))
   - Firefox began rolling the permission prompt out to all users in 2026. **Confirmed.** ([Firefox 150 beta notes](https://www.firefox.com/firefox/150.0beta/releasenotes/)) Whether Firefox also relaxes mixed content for local targets is **unconfirmed**. MDN describes the relaxation without listing browsers.
   - WebKit marked LNA as "position: support" in 2023. **Confirmed.** ([WebKit standards positions #163](https://github.com/WebKit/standards-positions/issues/163)) Whether Safari ships it, or any mixed content exemption, is **unconfirmed**. Assume Safari blocks HTTPS-to-LAN-HTTP calls.
3. **CORS still applies.** LNA gates the request with a permission. The server must still answer with CORS headers that allow GoodWatch's origin. Jellyfin does by default. Plex is unclear:
   - Tenable reported in 2020 that PMS sent `Access-Control-Allow-Origin: *`. Plex said its fix was "server side". **Confirmed** for the advisory. ([Tenable TRA-2020-35](https://www.tenable.com/security/research/tra-2020-35))
   - Forum reports from 2024 show PMS answering with `https://app.plex.tv` for some origins, `*` to curl, and a combined value in another case. **Secondary.** ([Plex forum](https://forums.plex.tv/t/bug-cors-error-on-htpc-player-on-linux/886531), [Plex forum](https://forums.plex.tv/t/plex-web-local-ip-pms-cors-issues/900023))

A browser route works when all of these hold: the member uses Chrome 142 or later (or a Firefox with the equivalent relaxation), the server address is a private IP or `.local` name or HTTPS, the member grants the prompt, and the server allows GoodWatch's origin. Members whose server is already on public HTTPS (a reverse proxy or Plex remote access) need none of this, and GoodWatch's own server can reach them too.

## Observations per route

Each route maps to [`ImportObservation`](../../../goodwatch-webapp/app/domain/imports.ts). Scores in the existing importers are integers from 1 to 10, and keys follow `source:kind:id`. Adding these sources also needs `plex`, `jellyfin` and `emby` in `IMPORT_SOURCES`, and a source label in place of `fileName`. That is not researched here.

### Plex, plex.tv account

| Source record | `kind` | Fields |
| --- | --- | --- |
| `watchHistory` node | `watch` | `key: plex:watch:<node id>`. `mediaType: movie` or `show`. For episodes: `season` from `parent.index`, `episode` from `index`. `watchedAt` from `date`, `precision: moment`. Ids from the metadata `Guid` lookup. `pass` from the order of plays per title. The first record per title made at opt-in stands for the latest earlier viewing, so earlier passes are missing |
| `reviews` node | `rating` | `key: plex:rating:<metadata id>`. `score` from `rating` (1 to 10, used as is). `addedAt` is unknown from the fields seen |
| Watchlist item | `want` | `key: plex:want:<metadata id>`. `addedAt` from `watchlistedAt` |

### Plex, member's server

| Source record | `kind` | Fields |
| --- | --- | --- |
| History row | `watch` | `key: plex:watch:<machineIdentifier>:<historyKey>`. `watchedAt` from `viewedAt` (epoch seconds), `precision: moment`. Filter to the member's `accountID`. Ids, title, year, season and episode from `/library/metadata/{ratingKey}` |
| Item with `userRating` | `rating` | `key: plex:rating:<machineIdentifier>:<ratingKey>`. `score` from `userRating` (0 to 10), rounded, with 0 treated as no rating. How Plex apps map stars to this scale is **unconfirmed** |
| Item with `viewCount` but no history rows | `watch` | `watchedAt` from `lastViewedAt`, else `precision: unknown`. Covers plays from before history was kept, which is **unconfirmed** |

### Jellyfin and Emby

| Source record | `kind` | Fields |
| --- | --- | --- |
| Item with `Played: true` | `watch` | `key: jellyfin:watch:<server id>:<item id>`. `watchedAt` from `LastPlayedDate`, `precision: moment`, but offer the existing `watchDates: unknown` choice because bulk marks share one timestamp. One observation per item, `pass: 1`. Report `PlayCount` above 1 as a warning, not as invented rewatches |
| Item with `IsFavorite: true` | `favorite` | `key: jellyfin:favorite:<server id>:<item id>`. No `addedAt` |
| Item with `Rating` | `unsupported` | Thumbs are not scores, per the inventory's rule. A value other than 1 or 10 could be a real score but is **unconfirmed** |
| Episodes | `watch` | `mediaType: show`. `season` from `ParentIndexNumber`, `episode` from `IndexNumber`. Show ids from the series item's `ProviderIds`, fetched by `SeriesId`. `episodeTmdbId` from the episode's `ProviderIds.Tmdb` |

Ids come from `ProviderIds.Tmdb` and `ProviderIds.Imdb`. Emby uses the same field names. Emby items get `emby:` keys.

## Recommendation per server

| Server | Route | Why |
| --- | --- | --- |
| Plex | **Connect from GoodWatch's server** | Sign in with Plex needs no key or password entry on GoodWatch. plex.tv holds watch history, ratings and the watchlist with no reachability problem. Fallback to the member's server when it is reachable through a public or relay connection, which covers members without sync |
| Jellyfin | **Connect from the member's browser** | CORS allows any origin by default. Quick Connect avoids a password. Use GoodWatch's server instead when the address is public HTTPS |
| Emby | **Leave out for now** | Same data as Jellyfin, plus a password typed into GoodWatch or a server address, and unknown CORS. Revisit with a live server test |

Notes on each:

- **Plex.** The plex.tv path relies on undocumented endpoints, so it can break without notice, and its terms need an owner decision. If the owner rejects that path, the server route still works for members whose server is reachable, and the watchlist RSS feed covers Plex Pass members' watchlists. Members who never turned on sync lose all history from before they turn it on. The member's own server is the only source for those older plays.
- **Jellyfin.** The browser fetches items and sends the JSON to GoodWatch, so the existing preview pipeline needs a JSON body instead of a file. Plan for three failure cases, each with a message: Safari, a server address the browser cannot reach, and a declined permission prompt. The data is thin: one date per title and no ratings. Jellyfin may be worth less effort than Plex.
- **Files.** None of the three servers offers a per-member export file, so a file route is not recommended for any of them. Plex's "Download Database" zip is admin-only, whole-server, undocumented SQLite, often over 20 MB. Tautulli's exporter, already listed in the inventory, remains the file route for Plex self-hosters.

## What to verify with a real server

1. The plex.tv `watchHistory` and `reviews` queries with a test account: fields, paging, rate limits, and whether a rating date is present.
2. Whether Discover metadata always includes TMDB and IMDb `Guid` values.
3. Whether PMS sends a CORS header for an arbitrary HTTPS origin, and whether a GoodWatch server can call a relay connection.
4. A PMS history response for episodes, and for items deleted from the library.
5. Jellyfin from an HTTPS page in Chrome 142 or later, Firefox and Safari, against `http://<private ip>:8096`, with the prompt granted and declined.
6. Emby CORS and `Rating` behavior on a current server.

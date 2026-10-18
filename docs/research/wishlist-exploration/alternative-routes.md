# Wishlist imports: alternative routes and native file producers

Checked **2026-10-18**. This extends [streaming-watchlist-imports.md](../streaming-watchlist-imports.md), with particular attention to routes that avoid a new streaming-provider connector. It is research, not an implementation commitment. The shared wishlist file direction is assumed accepted; these are candidate producers and compatibility adapters.

Read against the root `CONTEXT.md`, [ADR 0008](../../adr/0008-one-row-per-watch.md) and [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md). Only explicit intentions should become Want to See. A favorite, collection, followed show, requested download or calendar subscription is not automatically a wish. A source custom list needs explicit user selection. A title already Seen may still carry a rewatch wish; importing membership must not synthesize a watch or change the member's show status.

## Conclusions

The strongest overlooked expansion is **more producers of the same local file**, particularly existing tracker exports with TMDB IDs, not another login integration. Watcharr provides a particularly clear example: its export includes a real `PLANNED` status and original TMDB identifiers. Seerr and Serializd have concrete structured read paths with qualifications below. These are valuable for people who already use those tools; none reads every streaming provider's private Wishlist.

Netflix privacy exports deserve a higher evidence rating than the earlier report could establish: an actual historical importer specifies a path and columns. However, there is still no inspected current archive proving membership semantics or completeness. Google Saved has a documented CSV schema, and a real browser exporter offers another route; its guessed metadata and title-based deduplication need correcting. No comparable actual current wishlist archive schema was established for Amazon, Apple TV or Disney+.

| Route | What exists | Identity quality | Next decision |
| --- | --- | --- | --- |
| Watcharr native export | JSON exporter and importer, explicit `PLANNED` | Original `content.tmdbId` plus movie/TV type | Strong small compatibility adapter once representative export is checked |
| Netflix official archive | Historical actual parser for `Content_Interaction/MyList.csv` | Titles, profile, country, added date; no title ID in parser | Obtain current redacted archive; establish current-membership semantics |
| Google Saved CSV | Official export fields and portability scope | Title and source URL, no guaranteed film ID/year/type | Test complete coverage of Google TV versus Search and older lists |
| Google collection browser capture | CineHarvest code, public link or local session | Mostly source titles/URLs; enrichment guesses | Extraction architecture reference; independently implement ID-preserving capture |
| Serializd structured export | Actual `context.watchlist` extraction | Source show ID treated as TMDB by exporter; verify against known titles | Keep source IDs, avoid unnecessary Trakt conversion |
| Seerr watchlist read | Paged `/user/:id/watchlist`, TMDB fields | Explicit TMDB/type in local entries and Plex mapping | Useful for existing users; explain local-versus-Plex fallback |
| Sofa / Listy | Official export UX; backup/import bridge documented | Actual file schema not inspected | Acquire synthetic sample before promising support |
| MDBList | Official personal-watchlist API and external-list documentation | Structured IDs possible; exact response sample not inspected | Optional existing-user source; not a streaming-account master bridge |

## Evidence discipline

**Official** means provider-owned documentation. **Code** means the inspected source actually implements the operation; it does not mean a live authenticated test passed. **Publisher claim** means an advertised export without inspected sample/code. **Hypothesis** marks a proposed experiment. No accounts were created or used, no real personal archive opened, no messages sent, and no external app state changed. Repositories were cloned into `/tmp` solely for reading. Any schema examples below are either field descriptions from code or explicitly synthetic, never claimed account exports.

## 1. Netflix: an actual privacy-archive parser exists

Bionic's `imports/netflix/netflix.go` imports **`Content_Interaction/MyList.csv`**. Its `my_list.go` defines `Profile Name`, `Title Name`, `Country`, and `Utc Title Add Date`; the parser deduplicates by profile name and title name. This is materially stronger than an unauthenticated mirrored cover sheet: an executable consumer was written around this data. [Archive dispatch](https://github.com/bionic-dev/bionic/blob/598834bfecb9cc6e84add77b4fe79a40b802b4e8/imports/netflix/netflix.go), [My List parser](https://github.com/bionic-dev/bionic/blob/598834bfecb9cc6e84add77b4fe79a40b802b4e8/imports/netflix/my_list.go).

The inspected repository HEAD is `598834bfecb9cc6e84add77b4fe79a40b802b4e8`, dated **2023-04-27**; that is the snapshot date, not a claim that Netflix still exports the same schema. Bionic is MIT-licensed. No Netflix My List fixture was found in its inspected tree. [License](https://github.com/bionic-dev/bionic/blob/598834bfecb9cc6e84add77b4fe79a40b802b4e8/LICENSE), [snapshot](https://github.com/bionic-dev/bionic/commit/598834bfecb9cc6e84add77b4fe79a40b802b4e8).

Synthetic illustration of the parser's expected header only:

```csv
Profile Name,Title Name,Country,Utc Title Add Date
Example profile,Example movie,DE,2026-10-01T12:00:00Z
```

The parser supplies no Netflix ID, IMDb/TMDB ID, year or movie/show distinction. Its existence does not establish whether rows are current wishes, additions ever made, or current members with their latest add date. That distinction must be checked by adding, removing and re-adding synthetic test titles, then comparing the official archive with the live list. Preserve per-profile scope and source dates; never interpret archive creation time as the date a title was added. The existing Netflix access-request route remains the official user journey. [Netflix information requests](https://help.netflix.com/en/node/100624).

**Practical experiment:** obtain one owner-generated, redacted file with two profiles, a removed item, a re-added item, an unavailable item and same-title works. If the file is a current snapshot, native CSV ingestion could avoid extension installation for users willing to wait. If it is an event log, reconstruct only when removal events and ordering are proven; otherwise label the output partial/ambiguous.

## 2. Amazon, Apple TV and Disney+: do not invent archive schemas

Amazon's Data Portability API scope catalog does not establish Prime Video Watchlist access. Gift/shopping lists, Fire TV events and digital subscriptions are different records. No current first-party or inspected open-source archive parser establishing Prime Video wishlist filenames/fields was found in this pass. This is a limited negative finding, not proof the data cannot be requested. [Amazon scope catalog](https://developer.amazon.com/docs/amazon-data-portability/available-scopes.html).

Apple provides a data-copy request route and describes account-associated TV Watchlist data. Neither establishes a published Wishlist CSV contract. Its App Store Account Data Transfer API covers a different product. Ask for the specific TV-app category in a sample-gathering experiment; do not present purchases, playback or an App Store transfer as a wishlist export. [Apple data request](https://support.apple.com/en-us/102208), [TV privacy](https://www.apple.com/legal/privacy/data/en/apple-tv-app/), [App Store transfer API](https://developer.apple.com/support/account-data-transfer-api-eu/).

Disney's Watchlist itself has the right intention meaning, but an actual privacy-archive watchlist schema was not verified. Its browser/API extraction leads in the original report remain stronger than a guessed archive parser. [Disney Watchlist](https://help.disneyplus.com/en-GB/article/disneyplus-en-lc-managing-watchlist).

For all three, the falsifiable test is a selected-profile archive compared against known added/removed/unavailable wishes. Until then, record format, IDs, list scope and completeness as unknown. An access right alone is not evidence of a self-service machine-readable field.

## 3. Google Saved, Takeout and shareable collections

Google's official Saved schema is CSV with `title`, `item_content_url`, `note`, `tags`, `comment`; a collection description may precede the header with a blank line. The scope is `dataportability.saved.collections`. No guaranteed year, media type, added date or IMDb/TMDB identifier is specified. This is an actual schema to parse tolerantly, not a complete-film-catalog promise. [Saved schema](https://developers.google.com/data-portability/schema-reference/save).

Google TV says its Watchlist is associated with the Google account and browser access goes through Interests. That does not prove every Google TV/legacy/Search save lands in the same exported collection. The next test must include old and new items from both surfaces and compare exact counts and identities. Do not reinterpret Google Search watched/thumbs files as Want to See just because they contain titles. [Google TV Watchlist](https://support.google.com/googletv/answer/10059391?hl=en).

### Actual alternative extractor: CineHarvest

Inspected `evile92/cineharvest` at `1adedf33da0ae1cd92f1fce9cd5b3988b9374024`. Its extraction code uses Playwright, observes network data and DOM variants, scrolls each page and follows pagination. The CLI writes JSON, CSV and other formats. It supports a public collection URL or a locally saved browser session. [Extractor](https://github.com/evile92/cineharvest/blob/1adedf33da0ae1cd92f1fce9cd5b3988b9374024/extractor.py), [CLI](https://github.com/evile92/cineharvest/blob/1adedf33da0ae1cd92f1fce9cd5b3988b9374024/main.py).

There are concrete limits: 120 scrolls by default, five unchanged rounds, up to 30 pages, and title-text deduplication. The last can collapse remakes. Optional TMDB enrichment chooses the first multi-search result and returns guessed year/type but **does not retain the TMDB ID** in that function. Enriched metadata therefore must not acquire the authority of a source identity. [Configuration](https://github.com/evile92/cineharvest/blob/1adedf33da0ae1cd92f1fce9cd5b3988b9374024/config.py), [TMDB enrichment](https://github.com/evile92/cineharvest/blob/1adedf33da0ae1cd92f1fce9cd5b3988b9374024/tmdb.py).

No LICENSE was present in the inspected tree. Its wider app includes unrelated download-link enrichment; only list extraction is relevant. Treat the implementation as a protocol/design reference, not code approved to copy or a dependency to install wholesale. Use local capture for private collections. Public sharing is a user-visible disclosure change, not a prerequisite GoodWatch should demand. [Repository](https://github.com/evile92/cineharvest/tree/1adedf33da0ae1cd92f1fce9cd5b3988b9374024), [publisher's public/private instructions](https://github.com/evile92/cineharvest/blob/1adedf33da0ae1cd92f1fce9cd5b3988b9374024/README.md).

**Experiment:** feed the shared file producer one selected Google collection while retaining source URL/identifier separately from match candidates. Compare browser capture, Saved CSV and actual visible collection count. Include two same-name works and more than one page. Success means equal source membership, not plausible-looking posters.

## 4. Native tracking apps as producers

### Watcharr: strongest concrete native file lead

Inspected `sbondCo/Watcharr` at `ab7041fd6deb0b34e342b1f8967f821b76eab99b`, snapshot dated **2026-10-17**. The settings exporter re-fetches `/watched`, serializes the result array and downloads `watcharr-export.json`. Despite the endpoint/UI name, entries include explicit `PLANNED`, `WATCHING`, `FINISHED`, `HOLD`, `DROPPED` statuses. [Export UI](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/routes/(app)/settings/ExportListModal.svelte), [status model](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/watched.go).

Its own import parser reads `content.tmdbId`, `content.title`, `content.type`, `content.release_date` and row `status`. Games use a separate `game` object. A GoodWatch wishlist-only adapter should select movie/TV `PLANNED` rows; tags, pinned titles and all other statuses are not automatically wishes. Preserve invalid/unmapped rows in the receipt. Code is GPLv3; reading JSON and independently implementing a small adapter is distinct from copying code. [Native parser](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/routes/(app)/import/+page.svelte), [license](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/LICENSE).

The server explicitly keeps an unpaginated `/watched` response for downloading the whole list; the content model also retains `imdb_id`. This is stronger completeness evidence than a visible-page exporter, though a large real export remains untested. Preserve both external ID namespaces when present. [Read handler](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/feature/watched/router.go), [content model](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/content.go).

**End-to-end:** existing user → settings Export → local JSON → `PLANNED` movie/TV projection → shared wishlist file/preview. No new tracker account, streaming credentials or server connector. Output completeness still needs a sample with many rows; code inspection establishes the exporter, not a real count comparison.

### Serializd: preserve its own intentions before converting to Trakt

`mwsmws22/serializd_to_trakt`, inspected at `c34102e55e514ee841123f638596cce64dd8ed88` (snapshot **2025-10-27**), authenticates to Serializd, reads `/api/user_information?shouldGetUserContext=true`, and takes `context.watchlist` entries with `showId` and `dateAdded`. It groups season-like entries by show and keeps the earliest add date. It then treats the show ID as a TMDB ID for Trakt's `/search/tmdb/{id}?type=show` and emits `{trakt_id, watchlisted_at, type:"show"}`. This is MIT code, actual Wishlist extraction, and a reason to avoid unnecessary Trakt conversion: retain the source `showId` and validate its TMDB meaning directly. [Code](https://github.com/mwsmws22/serializd_to_trakt/blob/c34102e55e514ee841123f638596cce64dd8ed88/serializd_to_trakt.py), [license](https://github.com/mwsmws22/serializd_to_trakt/blob/c34102e55e514ee841123f638596cce64dd8ed88/LICENSE).

The current code requires email/password locally and does not prove a public stable API or complete large-list behavior. A GoodWatch server credential integration is unnecessary; local extraction into the shared file is the better experiment. Verify season-to-show collapse is intentional and explain it in preview. The repository's worked JSON is documentation, not an inspected real account sample. [Publisher README](https://github.com/mwsmws22/serializd_to_trakt/blob/c34102e55e514ee841123f638596cce64dd8ed88/README.md).

A second path, **Listizd**, reads public Serializd lists through Playwright with See more/page navigation. However, it matches titles to the first TMDB search hit; its CSV writer omits that TMDB ID and outputs title/year/metadata/Serializd URL. It is useful evidence for accountless list extraction, not authoritative title identity. Custom lists and watched/likes lists require explicit intent selection. No LICENSE found at inspected `de736c0f59ef5f1b24a516bd442d3edc6d0fec82`. [Scraper](https://github.com/EleonoraGiangrandi/Listizd/blob/de736c0f59ef5f1b24a516bd442d3edc6d0fec82/scraper.py), [CSV writer](https://github.com/EleonoraGiangrandi/Listizd/blob/de736c0f59ef5f1b24a516bd442d3edc6d0fec82/index.html).

### Sofa and Listy: genuine local export UX, unknown contracts

Sofa's publisher has explicitly offered data export since 2019; the current pricing page includes backups and export. Its CSV references elsewhere can concern trip budgets, so do not assume those are movie-list CSVs. Listy's own Sofa importer documents `.sofa3bk` backups containing lists, items, notes, completed items and Pile. Listy itself officially exports all lists as `.listy` files. [Sofa export announcement](https://www.sofahq.com/blog/making-it-easy-to-leave-sofa), [current feature table](https://www.sofahq.com/pricing), [Listy's Sofa adapter instructions](https://listy.is/import/sofa/), [Listy export](https://listy.is/help/how-to-export-lists/).

Neither actual backup schema nor synthetic file was inspected. Preserve the distinction between **Sofa (Astrio/Shawn Hickman)** and **Sofa Time/TVSofa**; similar names are not evidence of compatible backups. A practical sample request is a movie, a show, completed items, a custom collection, a note and a Pile entry. Inspect stable IDs and completion flags before deciding which selected lists are intentions. Do not force a migration through Listy just to re-export: a native adapter removes another account/app hop. Price claims are omitted because the needed export's entitlement was not unambiguously established.

### Queue and Reelgood: weak export leads, clear naming traps

The relevant **Queue** is Watch Queue, Inc., Android package `co.queue.app`; publisher text confirms personal watch intentions and custom collaborative lists, and an incoming copy/paste feature. That is not evidence of outgoing export. Several unrelated Queue CRM/travel/agency apps advertise export; those claims must not be attributed to this movie tracker. No actual schema/API was verified. [Publisher app listing](https://play.google.com/store/apps/details?id=co.queue.app).

Reelgood's business S3 product is a metadata/availability catalog export, not the consumer's saved titles. Its actual consumer Watch List also tracks shows for new episodes, which is broader than never-started wishes. No current consumer export schema was established. [Business export](https://data.reelgood.com/s3-export-documentation/), [consumer tracking explanation](https://blog.reelgood.com/managing-your-reelgood-watch-list-for-tv-shows).

## 5. Self-hosted and ecosystem bridges

### Seerr: real watchlist API, with a subtle completeness limit

Seerr at `63705622eac5dd4e1006775e9fc43215c3ea0c88` has a separate Watchlist entity with `tmdbId`, `mediaType`, `title`, `ratingKey`, user and creation/update timestamps. Its own-user or permitted read route is `GET /api/v1/user/:id/watchlist?page=N`, **20 items per page**. Crucially, it returns the user's local database Watchlist when any rows exist; only an empty local list falls back to the linked Plex Watchlist. It does **not** union local and Plex entries. [Entity](https://github.com/seerr-team/seerr/blob/63705622eac5dd4e1006775e9fc43215c3ea0c88/server/entity/Watchlist.ts), [read route](https://github.com/seerr-team/seerr/blob/63705622eac5dd4e1006775e9fc43215c3ea0c88/server/routes/user/index.ts).

The API describes cookie and `X-Api-Key` authentication; the source is MIT. For existing users a local paginated reader can project real intentions with TMDB IDs. Content acquisition requests, including approved/completed ones, are separate and should not all become wishes. Treat Seerr's stored `createdAt` as its own record timestamp, not necessarily the original Plex add date. [API contract](https://github.com/seerr-team/seerr/blob/63705622eac5dd4e1006775e9fc43215c3ea0c88/seerr-api.yml), [license](https://github.com/seerr-team/seerr/blob/63705622eac5dd4e1006775e9fc43215c3ea0c88/LICENSE).

### Watchlistarr/Plex: useful extraction reference, unnecessary full dependency

Watchlistarr `bce86ec684f995d9d17a4745c21675553dce1840` reads the own Plex list with X-Plex-Token, container offsets and **300-row pages**, recursively comparing `totalSize`. It separately queries per-item metadata for GUIDs. Its RSS route requests JSON. This is a concrete way to improve large-list validation beyond a visible RSS prefix. However, enrichment failures are logged and omitted from output; a GoodWatch exporter must retain unresolved source entries instead. [Plex reader](https://github.com/nylonee/watchlistarr/blob/bce86ec684f995d9d17a4745c21675553dce1840/src/main/scala/plex/PlexUtils.scala).

The project also reads friends' lists and automates Radarr/Sonarr changes; those are outside one person's Wishlist import. GPLv3 applies to copying this implementation. Do not deploy the full automation tool solely to export a file. Plex's official RSS route/current GoodWatch support remains a separate existing option. [License](https://github.com/nylonee/watchlistarr/blob/bce86ec684f995d9d17a4745c21675553dce1840/LICENSE.md), [Plex Watchlist RSS](https://support.plex.tv/articles/universal-watchlist/).

### MDBList: real personal-list endpoints, not a universal streaming bridge

MDBList documents personal Watchlist API operations with pagination and a read OAuth scope covering lists/watchlist/ratings/profile. The official API table currently gives free accounts **1,000 requests/day**, plus shared short-window limits. This makes an existing-user integration plausible; no API key was obtained and no response sample fetched. [API reference](https://mdblist.docs.apiary.io/), [current API quotas](https://docs.mdblist.com/docs/api).

Its external-source table is especially informative: “JustWatch” means **provider catalogs and charts**, not a signed-in JustWatch user's wishlist; Plex Watchlist is an RSS URL. Static hand-curated lists can be intentions when explicitly selected; dynamic/AI-generated/feed lists can be recommendations and must not all become personal wishes. [External list definitions](https://docs.mdblist.com/docs/external_lists), [list types](https://docs.mdblist.com/docs/list_types).

There is also a live contradiction worth respecting: the sign-in page currently says **Trakt disabled MDBList's API access**. Do not promise a working Trakt bridge from an older feature/pricing table. The tracker-focused companion report covers broader Trakt migration tools. [Current sign-in notice](https://mdblist.com/signin).

### Data Transfer Project: infrastructure reference, not the missing provider connector

The inspected Data Transfer Project at `9e3b6c03a804386bea0682c912fe7f2b6d8ce241` has a `VideoModel` representing a downloadable media object with content URL, encoding, upload time and album membership. Its Apple/Amazon video adapters concern photo/video transfer. A video type and those provider names do not establish streaming-account list access. No watchlist model or Netflix/Disney wishlist adapter was found in the inspected tree. Apache-2.0 code may be useful for general portability concepts; adopting this platform would not remove the extraction work. [Video model](https://github.com/dtinit/data-transfer-project/blob/9e3b6c03a804386bea0682c912fe7f2b6d8ce241/portability-types-common/src/main/java/org/datatransferproject/types/common/models/videos/VideoModel.java), [Amazon video importer](https://github.com/dtinit/data-transfer-project/blob/9e3b6c03a804386bea0682c912fe7f2b6d8ce241/extensions/data-transfer/portability-data-transfer-amazon/src/main/java/org/datatransferproject/transfer/amazon/photos/AmazonVideosImporter.java).

## 6. Regional DE providers and public/feed routes

No new authenticated-list parser/export schema was established for **ARD, ZDF, Joyn, RTL+ or WOW** beyond the original report. Avoid counting Kodi-local favorites as provider account lists. The useful implementation experiment remains ZDF's explicitly documented device-local saved list: inspect the active browser's local storage and current UI with consent; do not infer that a new login is needed for data that exists only on that device. [ZDF app privacy](https://www.zdf.de/mt2025-datenschutz-apps-100).

A public/shareable list can remove provider authentication from extraction, but only when the user already chooses to expose that actual list. Select the list explicitly and preserve ownership/provenance; “top films,” likes and availability catalogs are not personal intentions. RSS can be a truncated recent-additions feed. Calendars usually describe future episodes, leaving out movies, undated titles and never-started series. Thus a calendar alone cannot establish full Wishlist membership. This is a semantic completeness argument; it is not a claim that every site's calendar behaves identically.

## 7. Suggested experiments in order

1. **Native-ID adapter:** create a synthetic Watcharr account dataset locally, export and compare all PLANNED movie/show rows with the file. Include games and other statuses to prove filtering. Success: every intended title reaches preview with original TMDB/type, zero favorites/completed titles inferred as wishes.
2. **Netflix archive:** confirm the historical header/path against a current owner-generated redacted export, and test remove/re-add semantics. Success: explain precisely whether it is snapshot or events, with selected profile and no invented identity fields.
3. **Google three-way comparison:** compare current collection UI, official Saved CSV and ID-preserving local capture. Success: equal membership across old/new saves and pages, with discrepancies shown rather than hidden by title deduplication.
4. **Serializd direct local producer:** project `context.watchlist` to source ID/date plus validated TMDB ID; skip the Trakt hop. Success: known series IDs agree and season-level selection is explained before whole-show Want to See.
5. **Seerr existing-user reader:** export local list and separately selected Plex list, paging each. Success: no silent source mixing/fallback, no acquisition-request import, visible source counts.
6. **Sofa/Listy sample inspection:** identify archive container, item ID namespaces, status flags and list membership before estimating implementation. Success: selected pending movie/show list becomes a shared wishlist file without dragging in completed items or unrelated books/tasks.

All producers should report source count, captured unique IDs, selected list/profile, pages exhausted, unsupported types, unresolved matches and explicit caps. A partial snapshot must never imply removals. Keep extracted facts separate from guessed match candidates. A clean shared file contract enables these routes independently; requiring every user to install an extension before accepting their existing native export would miss several of the easiest paths.

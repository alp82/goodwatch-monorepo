# Video platforms: embedding and discovering movie/TV clips, Shorts, TikToks and Reels in GoodWatch

Research date: 2026-10-14. Method note: direct fetches of developer docs (developers.google.com, developers.tiktok.com, developers.facebook.com, dev.twitch.tv, tiktok.com/oembed, youtube.com/oembed) were **blocked by the sandbox egress proxy and DNS**. Every finding below therefore comes from web-search result snippets and summaries of the cited pages, not from reading the full pages. Before implementing, re-verify exact parameter names and numbers against the primary URLs cited. Items marked "(unverified)" come from background knowledge and were not confirmed by a source in this session.

## Embed mechanics (oEmbed, iframe formats, autoplay/mute, JS APIs, privacy, thumbnails)

### Takeaway
YouTube (including Shorts, using `/embed/{id}` in a 9:16 box), TikTok (`/player/v1/{id}` with a postMessage API), Twitch clips (`clips.twitch.tv/embed?clip=…&parent=…`), Vimeo, Dailymotion, Bilibili, Niconico and Rumble can all be embedded with a plain iframe and no API key. Meta (Instagram and Facebook) is the exception. Its oEmbed has required an app token plus App Review since Oct 2020, and it stopped returning thumbnail and author fields on 3 Nov 2025. For Meta, embed.js and blockquote embeds are the practical no-token route. Snapchat Spotlight embeds work only through a copy-paste blockquote plus `embed.js` snippet. Thumbnails from TikTok and Instagram expire, so they must be cached rather than hotlinked.

### Cited Findings

**YouTube / YouTube Shorts**
- Shorts have no official vertical embed. The standard `https://www.youtube.com/embed/VIDEO_ID` player loads a Short in the landscape player. Putting a `/shorts/` URL directly in an iframe can fail, so the URL has to be rewritten to `/embed/{id}` and placed in a 9:16 container (`padding-bottom:177.78%` or `aspect-ratio: 9/16`, max-width about 320px). — [Flockler, Feb 2026](https://flockler.com/blog/embed-youtube-shorts); [Smash Balloon](https://smashballoon.com/youtube-shorts-embed-not-working/); [StreamWeasels](https://www.streamweasels.com/?p=10774)
- Generators commonly add `playsinline=1&loop=1&playlist=VIDEO_ID` (looping a single video needs the `playlist` parameter). A fixed 315×560 iframe clips on mobile, so a responsive wrapper is preferred. — [Elfsight generator](https://elfsight.com/tools/youtube-shorts-embed-generator/); [Poper guide](https://www.poper.ai/guides/youtube-shorts-embed)
- **Minimum player size:** the embedded player viewport must be at least 200×200px. Google recommends at least 480×270 for 16:9. — [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality); [Player parameters](https://developers.google.com/youtube/player_parameters.html)
- **Error 153 (late 2025):** YouTube now requires API clients using the embedded player, including the IFrame Player API, to identify themselves through the HTTP `Referer` header. Pages sending `Referrer-Policy: no-referrer` get Error 153 ("embedder.identity.missing.referrer"). The recommended policy is `strict-origin-when-cross-origin`, which can be set on the iframe with the `referrerpolicy` attribute or site-wide. — [Simon Willison, 1 Dec 2025](https://simonwillison.net/2025/Dec/1/youtube-embed-153-error/); [UMich KB](https://teamdynamix.umich.edu/TDClient/30/Portal/KB/Article/14491/Fixing-YouTube-Player-Error-153-with-Referrer-Policy-Settings); [Google AI dev forum](https://discuss.ai.google.dev/t/youtube-embed-153-error/111539)

**TikTok**
- The official Embed Player URL is `https://www.tiktok.com/player/v1/{post_id}`, customized with query parameters. `autoplay` defaults to 0 and applies to video posts, `music_info` and `description` default to 0, and `rel` defaults to 1. A `controls` parameter hides the controls. — [TikTok Embed Player docs](https://developers.tiktok.com/doc/embed-player)
- **postMessage API:** messages are objects carrying an `'x-tiktok-player'` flag, a `type` and a `value`. Host-to-player commands include `play` and `seekTo`. Player-to-host events include `onPlayerReady`, `onStateChange` (playing, paused, buffering), `onCurrentTime` and `onMute`. — [TikTok Embed Player docs](https://developers.tiktok.com/docs/en/embed-player?enter_method=left_navigation)
- The Video.js TikTok wrapper passes parameters as 0 or 1 and notes that the embed silently drops commands until something starts playback. — [Video.js tiktok-video](https://videojs.org/docs/framework/html/reference/tiktok-video)
- Older community claims that TikTok embeds lack autoplay and postMessage support (lite-tiktok, written about 4 years ago) are outdated. lite-tiktok is still useful as a lazy-load "facade" pattern. A 2026 PR shows a "click-to-load official Player v1" approach and the CSP allowance it needs. — [lite-tiktok](https://github.com/justinribeiro/lite-tiktok); [vid-review-site PR #78](https://github.com/Gamagek/vid-review-site/pull/78)
- **oEmbed:** the documented endpoint takes a single `url` parameter. The docs do not explicitly say "no key", but none is listed. The response includes `thumbnail_url` and embed HTML (the legacy `blockquote.tiktok-embed` plus `embed.js` → `embed/v2`). — [TikTok Embed Videos docs](https://developers.tiktok.com/doc/embed-videos)
- TikTok and Instagram thumbnail URLs carry expiration signatures and commonly stop working within a few days. Iframely recommends fetching and storing them at ingest, because the platforms block hotlinking or let the URLs expire. — [Iframely help](https://iframely.com/help/015914-how-to-deal-with-expiring-images-of-tik-tok-and-instagram)
- AMP has a dedicated `<amp-tiktok>` component, which shows TikTok supports embeds. — [amp.dev](https://amp.dev/documentation/components/amp-tiktok)

**Instagram (Reels) and Facebook video/Reels: Meta**
- **Oct 2020:** Meta announced on 14 Oct 2020 that from 10:00 PDT on 23 Oct 2020 (some sources say 24 Oct), the Facebook and Instagram oEmbed endpoints require token-based access. Unmigrated calls fail. — [Meta dev blog 2020-10-14](https://developers.facebook.com/blog/post/2020/10/14/required-migration-token-based-access-user-picture-oEmbed-endpoints/); [Prismic community](https://community.prismic.io/t/oembed-for-instagram-facebook-broken-from-facebook-api-changes/2449)
- Instagram oEmbed requires an App Access Token (recommended, server-side only) or a Client Access Token (for browser or mobile), and the app must pass App Review for the oEmbed Read feature. It supports photo, video, Reel and Guide posts. — [Meta Instagram oEmbed docs](https://developers.facebook.com/docs/instagram/oembed)
- **Apr 2025:** "Meta oEmbed Read" replaced the old oEmbed Read feature on 8 Apr 2025, and existing apps were auto-migrated. The `author_name`, `author_url`, `thumbnail_url`, `thumbnail_width` and `thumbnail_height` fields were removed for Facebook posts, Facebook videos and Instagram posts. The deadline was extended on 8 Oct 2025, and full deprecation took effect on **3 Nov 2025**. Meta also deprecated the oEmbed endpoint for Facebook *page posts*, and it tells developers to generate their own thumbnails from the post's HTML metadata. — [Meta 2025 non-versioned changes](https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-2025); [Meta blog 2025-04-08](https://developers.facebook.com/blog/post/2025/04/08/oembed-updates/); [Iframely update](https://iframely.com/updates/193071-facebook-and-instagram-oembed-thumbnail-deprecation); [API Evangelist commentary](https://apievangelist.com/2025/04/09/why-would-meta-remove-oembed-author-fields/index.md)
- **No-token route:** the blockquote `instagram-media` markup plus Instagram's `embed.js` builds the iframe client-side. react-ig-embed (now deprecated in favor of react-social-media-embed) and XenForo re-implemented Instagram embeds, including Reels, "without a reliance on the oEmbed endpoints". Discourse oneboxes support only `/p/` and `/tv/`, not `/reel/`. embed.js builds the iframe `src` itself, so extra URL parameters can break it. Remixes and collab posts often have embedding disabled. I found no official documentation for a direct `instagram.com/reel/{id}/embed` iframe. — [react-ig-embed](https://github.com/justinmahar/react-ig-embed); [XenForo thread](https://xenforo.com/community/threads/203995); [Discourse app-token guide](https://meta.discourse.org/t/configure-an-app-token-for-instagram-oneboxes/223548?tl=nl); [WP Trac #44688](https://core.trac.wordpress.org/ticket/44688); [Shopify community](https://community.shopify.com/t/instagram-reel-embed-issue/398544)
- **Facebook Embedded Video Player:** you add it with `data-href` (video URL) and `data-width`. Its `autoplay` setting starts playback muted and does not apply on mobile. The iframe form `https://www.facebook.com/plugins/video.php?href=…` works (community-confirmed). Embedded video has had an oEmbed API since Dec 2015. — [Meta Embedded Video Player docs](https://developers.facebook.com/docs/plugins/embedded-video-player/); [Discourse thread](https://meta.discourse.org/t/play-videos-facebook-by-link/106751?tl=en); [Meta blog 2015-12-14](https://developers.facebook.com/blog/post/2015/12/14/embedded-video-api-oembed/)
- I found no official confirmation that Facebook **Reels** URLs embed through `plugins/video.php`. Treat this as unverified.

**Twitch clips**
- `parent` is a required parameter, and you need one `parent` per domain that embeds the player. The JS embed library handles live channels and VODs but not clips, so clips use a raw iframe: `https://clips.twitch.tv/embed?clip={slug}&parent={hostname}`. The most common failure is a `parent` that does not exactly match the serving hostname. — [Twitch Embedding Video and Clips](https://dev.twitch.tv/docs/embed/video-and-clips/); [Twitch dev forum](https://discuss.dev.twitch.com/t/solved-tell-me-what-im-doing-wrong-please/28640); [Discourse bug](https://meta.discourse.org/t/twitch-clips-embed-problem/344678)
- (Unverified, from background knowledge: Twitch embeds require HTTPS. They take `autoplay` and `muted` parameters, autoplay usually needs `muted=true`, and the docs list a minimum player size, about 400×300. Check the dev.twitch.tv page.)

**Snapchat Spotlight**
- Snap launched web embeds for Spotlight videos, Lenses, public Stories and public Profiles on 16 Oct 2023. You get the code from the embed icon in the share sheet ("Copy code"). — [Snap Newsroom](https://newsroom.snap.com/how-to-embed-snapchat-content); [Snap developer docs](https://developers.snap.com/api/snapchat-for-web/social-plugins/embedding-web-content); [Lindsey Gamble](https://www.lindseygamble.com/blog/snapchat-launches-web-embeds-for-lenses-spotlight-videos-stories-and-profiles)
- The snippet is a `<blockquote>` with a `data-snapchat-embed-url` attribute plus a loader script at `snapchat.com/embed.js`. There is no simple documented iframe. A strict CSP or blocked script leaves a blank space, and only public content embeds. (Secondary source.) — [Poper troubleshooting](https://www.poper.ai/blog/snapchat-spotlight-feed-not-loading-website/)

**Vimeo**
- The oEmbed endpoint (`vimeo.com/api/oembed.json?url=…`) needs no token. For domain-restricted videos, it returns a truncated response (no title or description) unless the request carries a `Referer` from a whitelisted domain. Unlisted videos 404 unless the URL includes the unlisted hash. — [Vimeo Help: oEmbed with private videos](https://help.vimeo.com/hc/en-us/articles/12427906892689-Use-oEmbed-with-private-videos); [Drupal issue](https://www.drupal.org/node/3023798); [php-embed #377](https://github.com/php-embed/Embed/issues/377)

**Dailymotion**
- Legacy `/embed/video/` and `/embed/playlist/` URLs now redirect to `geo.dailymotion.com/player.html`. Most query parameters stopped working; `mute`, `startTime`, `loop` and `ads_params` still work. From **1 Sep 2025**, legacy embeds use a default Player unless a Player ID is specified. Custom configurations go through `geo.dailymotion.com/player/{playerId}.js`. — [Dailymotion migration guide](https://developers.dailymotion.com/migration-guide-new-embed-endpoint)
- The oEmbed endpoint is `/services/oembed?url=…`, with `maxwidth`, `maxheight`, `format`, `callback` and `player` parameters. The examples show no authentication. — [Dailymotion oEmbed docs](https://developers.dailymotion.com/docs/embed-with-oembed)
- In May 2024 a community report said Dailymotion had sunset its "player API v2 functional interface" and that the new default integration seemed to need an account and a custom player ID. — [calzoneman/sync PR #983](https://github-redirect.dependabot.com/calzoneman/sync/pull/983)

**Kick, Rumble, Bilibili, Niconico**
- **Bilibili:** `player.bilibili.com/player.html?bvid=BV…`. Embeds autoplay inside iframes, and some CMSs require the domain to be allowlisted. — [Discourse Bilibili embed](https://meta.discourse.org/t/discourse-embed-bilibili/282491); [Discourse iframe issue](https://meta.discourse.org/t/iframe-bilibili/404906?tl=ko)
- **Niconico:** `embed.nicovideo.jp/watch/{id}`. An unofficial postMessage API exists. Private and paid videos cannot be embedded. I found no official documentation. — [Zenn article](https://zenn.dev/xpadev/articles/8f742c8f8ce3d0); [Pale Moon forum](https://forum.palemoon.org/viewtopic.php?p=256136); [Iframely Niconico](https://iframely.com/domains/niconico)
- WordPress Trac ticket #55331 (2022) asked core to support Bilibili and Nicovideo embeds. — [wp-trac](https://lists.wordpress.org/pipermail/wp-trac/2022-June/473476.html)
- **Rumble:** `https://rumble.com/embed/{embedId}/?pub=…`. The embed ID differs from the watch-page slug, so you get it from the video's "⋯ → Embed" menu. — [deepakness](https://deepakness.com/raw/rumble-embed-option/); [lite-rumble-embed](https://npmjs.org/package/lite-rumble-embed)
- **Kick:** an iframe works for live channels. According to a third-party guide, there is no official support for VOD or clip embeds (unverified). — [Kick embed generator](https://gamingwithdaopa.ellatha.com/kick-embed-generator/)

### Inferences
- For a "Talked about now" row, the realistic all-official, keyless set is YouTube (including Shorts in a 9:16 wrapper), TikTok player/v1, Twitch clips, Vimeo and Dailymotion. Instagram and Facebook would mean either a Meta app through App Review or the embed.js blockquote route, which is fragile.
- Use click-to-load facades on every platform, showing a cached thumbnail plus a play button. This avoids loading third-party JS and cookies before interaction, which matters for GDPR (GoodWatch is EU-facing), and it avoids Error 153 and TikTok's command-dropping problems. YouTube's privacy-enhanced domain `youtube-nocookie.com` (unverified in this session) reduces cookies but does not remove them.
- Because Meta's oEmbed no longer returns thumbnails (Nov 2025), and TikTok and Instagram thumbnails expire, cards for Meta and TikTok content need thumbnails cached at ingest time. Whether caching them is allowed is a separate policy question (see Policy).
- Set `Referrer-Policy: strict-origin-when-cross-origin` site-wide. The YouTube player now requires it, and Vimeo's domain-restricted oEmbed relies on the Referer.

### Gaps
- Exact current TikTok player/v1 parameter list (for example `loop`, `mute`, `progress_bar`, `play_button`, `volume_control`, `fullscreen_button`, `timestamp`, `closed_caption`). The parameter names are in the docs, but the docs page was not fetchable.
- Whether the `i.ytimg.com/vi/{id}/hqdefault.jpg` (or `maxresdefault`, `oardefault`) thumbnail pattern is still valid in 2026, and whether YouTube's terms allow hotlinking it outside the player. Not verified in this session; widely used in practice.
- Twitch embed minimum size, autoplay and muted parameters, and the HTTPS requirement (not confirmed this session).
- Whether YouTube's oEmbed (`youtube.com/oembed?url=`) accepts `/shorts/` URLs in 2026. The test fetch was blocked.

## Discovery for a given title (official APIs and quotas, unofficial endpoints, yt-dlp, breakage)

### Takeaway
Of the official APIs, only YouTube Data API v3 offers open, keyword-searchable discovery. Its default is 10,000 units/day, with `search.list` costing 100 units, so only about 100 searches a day. More quota needs a compliance audit. TikTok's search and trend data is locked behind the Research API (academics and non-profits only) or comes from unofficial Creative Center endpoints. Instagram has no hashtag or keyword discovery for non-business apps. Twitch Helix Get Clips works with an app token, filtered by `game_id` or broadcaster and a date range. Gray-area tools (InnerTube, RSS, yt-dlp, web JSON) break often: YouTube PO tokens and SABR in 2025, TikTok extractor failures in early 2026, and Instagram web JSON schema drift.

### Cited Findings

**YouTube official**
- The default quota is 10,000 units/day, and getting more requires an audit for compliance with the YouTube API Services Terms. Google's page describes the default as 100 `search.list` calls, 100 `videos.insert` calls and 10,000 units for everything else. — [Google: Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits?authuser=6)
- A `search.list` call costs 100 units, against 1 unit for a basic read. — [Zernio 2026](https://zernio.com/blog/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota); [ChannelCrawler, Mar 2026](https://channelcrawler.com/insights/youtube-api-daily-limit-quotas-costs-and-how-to-scale-beyond-10000-units-channelcrawler)
- **Conflicting:** ppc.land reports separate buckets (10,000 units + 100 searches + 100 uploads), citing documentation for a third-party library dated Aug 2026. I could not confirm this with Google. — [ppc.land](https://ppc.land/youtube-data-api/)
- `videos.list` with `chart=mostPopular` and `regionCode` plus `videoCategoryId` (for example 1 Film & Animation, 30 Movies, 44 Trailers; IDs from `videoCategories.list`) returns the "most popular" chart. Google's guide says it covers music, movies and gaming. — [Google implementation guide: videos](https://developers.google.com/youtube/v3/guides/implementation/videos?hl=en)
- I found no source on whether the July 2025 Trending page removal changed `chart=mostPopular`. See History.

**YouTube unofficial**
- **RSS:** `youtube.com/feeds/videos.xml?channel_id=UC…` returns about the latest 15 uploads. The `?user=` variant fails for many channels. Intermittent 404s and failures are reported, including a stretch from Dec 2025 (single vendor source). Replacing `UC` with `UULF` in `playlist_id=` reportedly gives a feed without Shorts (anecdotal HN tip). — [WP RSS Aggregator](https://finder.wprssaggregator.com/rss-feeds/platform/youtube); [NewsBlur forum](https://forum.newsblur.com/t/youtube-feeds-broken/13227); [Techlore](https://discuss.techlore.tech/t/suddenly-lost-access-to-youtube-rss-feeds/6963); [Vivaldi forum](https://forum.vivaldi.net/post/636036); [HN mirror](https://hn.nuxt.dev/item/48030964)
- **InnerTube and yt-dlp:** YouTube enforces "Proof of Origin" (PO) tokens for GVS (video streaming) and subtitles on some clients. The web client is forced to SABR-only formats. yt-dlp cannot generate PO tokens itself and needs external providers (BgUtils, getpot-wpc). Using a logged-in account risks a ban. For metadata only (`--skip-download --dump-json`), the player and InnerTube requests are less affected than streaming, but the guide says enforcement keeps changing. — [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide); [yt-dlp-get-pot](https://pypi.org/project/yt-dlp-get-pot)

**TikTok**
- **Research API:** open only to researchers at non-profit academic institutions in the US, EEA, UK or Switzerland, and to not-for-profit research bodies in the EU. A European research institute (KInIT) was rejected in 2024 as "not a US/EEA university". DSA Art. 40 vetted-researcher access is a separate route. A Dec 2025 civil-society paper urged the Commission to extend API access to CSOs. — [TikTok About Research API](https://developers.tiktok.com/docs/en/about-research-api); [KInIT](https://kinit.sk/when-research-apis-close-the-door/); [DRI paper Dec 2025](https://digitalmonitor.democracy-reporting.org/wp-content/uploads/2025/12/20251209_Outreach_Commission_Data-Access.pdf); [Tech Policy Press](https://techpolicy.press/unpacking-tiktoks-data-access-illusion)
- The **Display API** is scoped to an authenticated user's own videos, so it is no use for discovery. — [TikTok for Developers](https://developers.tiktok.com); [Scrapfly guide](https://scrapfly.io/blog/guide-to-tiktok-api)
- **Creative Center:** the trending-hashtag pages (`ads.tiktok.com/creative/creativeCenter/trends/hashtag`, with region and period) are backed by internal JSON endpoints. Unauthenticated calls reportedly return only 3 hashtags per request. A redesign removed the public Videos, Creators and Songs trend feeds, and IP blocks occur. — [Apify actors (various)](https://apify.com/crawlerbros/tiktok-hashtag-trends-scraper); [Apify ayen-data](https://apify.com/ayen-data/tiktok-trending-hashtags-scraper.md)
- **yt-dlp TikTok:** in Jan 2026 the extractor failed with "Unable to extract universal data for rehydration", and gallery-dl broke at the same time. A Mar 2026 release fixed challenge solving (#16223). Release 2026.08.19 included "Fix extractor (#17452)", "Fix formats extraction (#17460)" and "Support share URLs (#17459)". Run `--update-to nightly` when it breaks. — [yt-dlp #15506](https://github.com/yt-dlp/yt-dlp/issues/15506); [yt-dlp #16199](https://github.com/yt-dlp/yt-dlp/issues/16199); [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases); [gallery-dl #9180](https://github.com/mikf/gallery-dl/issues/9180); [yt-dlp-TTUser plugin](https://github.com/bashonly/yt-dlp-TTUser)

**Instagram**
- Basic Display API: deprecation announced 4 Sep 2024, and every request has errored since **4 Dec 2024**. The successor, "Instagram API with Instagram Login", serves business and creator accounts. Sources conflict on whether personal accounts are supported. — [Meta Basic Display docs](https://developers.secure.facebook.com/docs/instagram-basic-display-api); [Smash Balloon](https://smashballoon.com/instagram-is-shutting-down-basic-display-api-continue-displaying-instagram-feeds-on-your-site/); [Zapier](https://help.zapier.com/hc/en-us/articles/32429170578317-Instagram-app-deprecation-on-Dec-4-2024)
- **Gray area:** `i.instagram.com/api/v1/users/web_profile_info/?username=` with an `x-ig-app-id` header (the ID rarely changes). The older `?__a=1` pattern works in a browser but fails from servers. Schema drift is a common failure mode, and Instagram's ToS prohibits automated scraping. — [Scrapfly](https://scrapfly.io/blog/how-to-scrape-instagram/); [Bubble forum](https://forum.bubble.io/t/instagram-api-get-simple-profile-info-api-connector-broken/109311); [instagrab docs](https://docs.rs/crate/instagrab/0.2.0)

**Twitch**
- Helix Get Clips accepts any valid OAuth token, including an app access token. It looks up clips by `game_id`, `broadcaster_id` or clip `id`, filtered by `started_at` and `ended_at`. The rate limit is reportedly 800 points per minute per app token, with a separate 800 per user token (forum, not official docs). — [Twitch API: Clips](https://dev.twitch.tv/docs/api/clips/); [Twitch forum rate limits](https://discuss.dev.twitch.com/t/rate-limit-bucket-app-vs-user-access-token/37904)

### Inferences
- For title pages on YouTube, run one `search.list` per title per refresh (100 units), cached for days. That fits about 100 titles a day on the default quota. Scaling needs either an audit or cheaper channel-scoped retrieval: `playlistItems.list` on studio channels' upload playlists costs 1 unit (unverified cost), or RSS feeds of an allowlist of official trailer channels, then match titles locally.
- For TikTok, a legitimate, non-academic app is effectively limited to *embedding known URLs*. The URLs have to come from manual curation, from the title's official studio and streamer accounts, or from gray-area scraping. TMDB `videos` also lists YouTube trailers only.
- Twitch is mostly relevant for watch-along, reaction or premiere streams. Its `game_id` concept is for games, so movie and TV discovery would be by broadcaster.

### Gaps
- Official current Helix rate limits and the YouTube quota cost table were not fetched directly.
- TikTok's web search endpoints (`/api/search/general/full/`, `/api/challenge/item_list/`) and their signing requirements (`X-Bogus`, `msToken`) were not confirmed this session.
- I did not research whether Instagram has any public hashtag search for non-business apps. Background knowledge says the Graph API Hashtag Search requires a business account and limits each account to 30 unique hashtags per 7 days (unverified).

## Lore and history (policy changes with dates, developer controversies)

### Takeaway
Discovery paths have narrowed steadily. Meta locked oEmbed behind tokens in Oct 2020, killed Basic Display in Dec 2024 and stripped oEmbed thumbnails in Nov 2025. YouTube moved to audited quotas (formalized July 2021), retired its Trending page in July 2025 and started requiring Referer identification for embeds in late 2025. Twitch shut down Kraken v5 in Feb 2022. TikTok's Research API is criticized as an "illusion" of access.

### Cited Findings
- **YouTube ToS revision:** effective 10 Feb 2017, users got warning emails. I found no evidence of a 2016 quota controversy. — [Ametys INLINEMEDIA-52](https://issues.ametys.org/browse/INLINEMEDIA-52); [TubePress 2017](https://tubepress.com/blog/2017/02/dont-stress-about-the-updated-youtube-api-terms-of-service/)
- **YouTube, 1 Jul 2021:** all developers must complete an API Compliance Audit to get more than 10,000 units, with new forms for audited-developer requests, appeals and change of control. — [YouTube terms revision history](https://developers.google.com/youtube/terms/revision-history)
- **YouTube Shorts:** the 3-minute maximum was announced 3 Oct 2024 and took effect 15 Oct 2024 for square or taller videos, with no change to earlier uploads. — [9to5Google](https://9to5google.com/2024/10/03/youtube-shorts-3-minutes/); [ppc.land](https://ppc.land/youtube-expands-shorts-duration-to-3-minutes/)
- **YouTube Trending removal:** announced 10 Jul 2025, with the page and the "Trending Now" list available until about 21 Jul 2025. They were replaced by category charts on YouTube Charts: Trending Music Videos, Weekly Top Podcast Shows and **Trending Movie Trailers**. YouTube said Trending visits had declined significantly over the previous five years. — [TechCrunch](https://techcrunch.com/2025/07/10/youtube-is-getting-rid-of-its-trending-page-and-trending-now-list); [9to5Google](https://9to5google.com/2025/07/10/youtube-trending-page-removal/); [Social Media Today](https://www.socialmediatoday.com/news/youtube-removes-trending-content-displays-in-stream/752762/)
- **YouTube embed Error 153:** late 2025; the Referer requirement is described in Embed and Player above. — [Simon Willison](https://simonwillison.net/2025/Dec/1/youtube-embed-153-error/)
- **YouTube PO tokens and SABR:** 2025 enforcement against scrapers. — [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- **Meta:** oEmbed has required tokens since 23–24 Oct 2020. Basic Display was announced dead 4 Sep 2024 and ended 4 Dec 2024. oEmbed fields were removed starting 8 Apr 2025, the deadline was extended 8 Oct 2025, and the change was final on 3 Nov 2025. — sources as above ([2020](https://developers.facebook.com/blog/post/2020/10/14/required-migration-token-based-access-user-picture-oEmbed-endpoints/), [2025](https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-2025))
- **Twitch:** Kraken v5 was closed to new developers after 15 Jul 2021, with phased brownouts from 7 Feb 2022 and shutdown on 28 Feb 2022. The `parent` requirement for embeds is longstanding. Background knowledge dates it to 2020 (unverified). — [Barry Carlyon "Death to Kraken"](https://barrycarlyon.co.uk/wordpress/2022/02/); [Twitch forum](https://discuss.dev.twitch.tv/t/change-in-access-to-deprecated-kraken-twitch-apis/22241)
- **Dailymotion:** player API v2 functional interface sunset (reported May 2024). The legacy embed default switched on 1 Sep 2025. — [Dailymotion migration guide](https://developers.dailymotion.com/migration-guide-new-embed-endpoint)
- **Snapchat:** web embeds launched 16 Oct 2023. — [Snap Newsroom](https://newsroom.snap.com/how-to-embed-snapchat-content)
- **TikTok controversies:** researchers criticize the Research API's eligibility gatekeeping and its data quality ("TikTok's Research API: Problems Without Explanations"). — [Tech Policy Press](https://techpolicy.press/unpacking-tiktoks-data-access-illusion); [Moonlight review of paper](https://www.themoonlight.io/en/review/tiktoks-research-api-problems-without-explanations)
- **Meta's removal of oEmbed author fields:** criticized as hostile to attribution. — [API Evangelist](https://apievangelist.com/2025/04/09/why-would-meta-remove-oembed-author-fields/index.md)

### Inferences
- Plan for further narrowing. Any gray-area scraper will need a maintenance budget, and official embeds with click-to-load facades are the durable layer.

### Gaps
- The "YouTube 2016 quota changes" premise could not be verified. Background knowledge says the default dropped from 50M to 1M units in 2016 and later to 10k (around 2019), but I found no source this session.
- TikTok Research API changes dated 2025–2026, and the 2025 US divestiture's effect on developer APIs, were not found.
- Twitch API changes after 2022 (for example clip-creation endpoint changes and the 2024 clip-download policy) were not researched.

## Trend signals (per platform, and how others detect "trending about X")

### Takeaway
YouTube offers view, like and comment counts per video, plus charts (`mostPopular`, YouTube Charts "Trending Movie Trailers"). TikTok signals (views, hashtag volume, sounds) come only from the Research API or Creative Center scraping. Twitch offers clip `view_count` and `created_at` by game or broadcaster. "Trending about X" is usually computed by tracking view velocity, meaning the delta between snapshots, which conflicts with YouTube's 30-day storage limit unless derived-metrics approval is granted.

### Cited Findings
- YouTube Charts now has "Trending Movie Trailers", a curated movie-relevant trend signal, from July 2025. — [TechCrunch](https://techcrunch.com/2025/07/10/youtube-is-getting-rid-of-its-trending-page-and-trending-now-list)
- `chart=mostPopular` by region and category. — [Google guide](https://developers.google.com/youtube/v3/guides/implementation/videos?hl=en)
- YouTube statistics retrieved as non-authorized data must not be stored for more than 30 days. Developers whose derived-metrics use case is accepted may keep views, likes and subscriber counts for up to 36 months. Titles, creator names and comment text stay under the 30-day rule. — [Google derived metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy); [DEV Community](https://dev.to/daniel_pertu/the-youtube-api-terms-give-you-30-days-so-our-database-is-built-to-forget-4i16)
- TikTok Creative Center lists trending hashtags by country and period. Third parties sell "breakout radar" scrapers built on it. — [Apify webdata_labs](https://apify.com/webdata_labs/tiktok-hashtag-trends-scraper.md)
- Twitch clips can be pulled by date window (`started_at`/`ended_at`) to find recent hot clips. — [Twitch API](https://dev.twitch.tv/docs/api/clips/)

### Inferences
- A practical "Talked about now" signal for GoodWatch: per title, YouTube views in the last 24–72h on recent uploads (`publishedAfter` plus sorting by `viewCount`), combined with TMDB/JustWatch popularity. Compute velocity from two snapshots within the 30-day window.

### Gaps
- No sourced information on Instagram or Facebook public trend signals for third parties. Researchers' academic methods (for example CrowdTangle, shut down in Aug 2024, and the Meta Content Library) were not researched this session.

## Movie/TV-specific creators and channels, piracy risk, filtering to official uploaders

### Takeaway
Edit and recap accounts routinely post copyrighted film clips. They are cropped, sped up or mirrored to evade detection, and survive mainly through selective enforcement and DMCA takedowns. Embedding them risks surfacing infringing content. No platform offers a clean "official studio" filter via API. Use an allowlist of verified studio, distributor and streamer channel IDs.

### Cited Findings
- Posting copyrighted clips without a license is infringement. Studios often tolerate it as free marketing but keep their takedown rights. TikTok removes content on DMCA notice and suspends repeat infringers. Edit accounts crop, speed up or mirror clips to evade matching. — [Syracuse Law Review](https://lawreview.syr.edu/scene-stealers-the-legal-risks-of-posting-movies-on-tiktok); [Columbia JLA](https://journals.library.columbia.edu/index.php/lawandarts/announcement/view/659); [Jeff Bullas thread](https://www.jeffbullas.com/thread/is-it-legal-to-post-movie-clips-on-tiktok/)
- In 2023 Paramount posted *Mean Girls* in parts on TikTok as marketing, which drew guild criticism over residuals loopholes. — [Syracuse Law Review](https://lawreview.syr.edu/scene-stealers-the-legal-risks-of-posting-movies-on-tiktok)
- Full-film-in-parts uploads ("pirated movies one bite at a time") are a known TikTok phenomenon. — [Italy Meets Hollywood](https://italymeetshollywood.com/?p=3503)
- YouTube Charts' "Trending Movie Trailers" chart is an implicitly official-trailer signal. — [9to5Google](https://9to5google.com/2025/07/10/youtube-trending-page-removal/)

### Inferences
- Tiered trust: tier 1 is an allowlist of official channels (studios, distributors, streamers, and TMDB-listed trailer channels). Tier 2 is verified creators with commentary formats (reviews, recaps, interviews). Tier 3 (edit, "movie explained" and full-scene accounts) should be excluded, or shown only with a strong duration heuristic and community reporting.
- YouTube's `channelId` filter on `search.list`, plus RSS, makes allowlisting cheap. On TikTok, verified status is visible on the profile but not exposed in oEmbed (unverified), so the allowlist has to be maintained by hand.

### Gaps
- No sourced list of official studio TikTok, Instagram or YouTube handles. Hashtag culture (#filmtok, #movietok, #tvtok, #booktok analogs) was not quantified. No API-level "verified" flag was confirmed for TikTok or Instagram oEmbed.

## Policy (developer terms on embeds, caching, branding; non-commercial status)

### Takeaway
Each platform allows embedding through its official player, provided you don't alter, overlay or strip branding. YouTube additionally limits API data storage to 30 days (or up to 36 months for approved derived metrics) and a 200×200 minimum player. Scraping is prohibited by Instagram's and YouTube's terms. I found no evidence that non-commercial status relaxes any of these terms. The terms apply regardless, and quota audits ask about use case, not revenue.

### Cited Findings
- YouTube: data retention is limited to 30 days for non-authorized statistics and must be refreshed or deleted. Data must be deleted within about 30 days of revocation. The derived-metrics exception allows 36 months. — [Google derived-metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy); [Developer policies guide](https://developers.google.com/youtube/terms/developer-policies-guide)
- YouTube: the embedded player viewport must be at least 200×200, and controls must not shrink it below that. Embedding clients must send Referer identification. — [RMF](https://developers.google.com/youtube/terms/required-minimum-functionality); [Simon Willison](https://simonwillison.net/2025/Dec/1/youtube-embed-153-error/)
- YouTube: a periodic compliance audit can happen without a quota request, and access can be revoked for violations. A change of control triggers review. — [Google audits page](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits?authuser=6); [singhamandeep](https://singhamandeep.com/?p=1396)
- I found no non-commercial carve-out in the YouTube results. — [search summary of developer policies](https://youtubehelp.fandom.com/wiki/YouTube_API_Services_-_Developer_Policies)
- Meta: oEmbed use requires App Review. App tokens must never be used client-side. — [Meta Instagram oEmbed](https://developers.facebook.com/docs/instagram/oembed)
- Instagram's ToS prohibits automated scraping. — [instagrab docs](https://docs.rs/crate/instagrab/0.1.0)
- TikTok: official embeds show the creator and link back to TikTok. TikTok's terms prohibit content that infringes copyright. — [TikTok Embed Videos](https://developers.tiktok.com/docs/en/embed-videos); [Syracuse Law Review](https://lawreview.syr.edu/scene-stealers-the-legal-risks-of-posting-movies-on-tiktok)
- Vimeo: owners can restrict embeds to specific domains, so some Vimeo videos will refuse to play on GoodWatch. — [Vimeo help](https://help.vimeo.com/hc/en-us/articles/12427906892689-Use-oEmbed-with-private-videos)

### Inferences
- Cached thumbnails for TikTok and Instagram are a gray zone. They are needed because the URLs expire, but storing platform images may conflict with the terms. Mitigation: show them only as a click-to-load poster for the official embed, with attribution and a link back, and expire them along with the video record (for example within 30 days).
- Embedding through the official player (rather than re-hosting) shifts most of the copyright exposure to the platform, but curation choices (featuring edit accounts) are still reputationally risky.

### Gaps
- I did not read the full text of the TikTok Developer Terms, the Twitch Developer Agreement, Meta Platform Terms, Snap embed terms, or Dailymotion and Vimeo API terms; the fetches were blocked. Specific caching, branding and "no overlay" clauses for those platforms are unverified.
- Whether non-commercial status affects YouTube audit outcomes or Meta App Review approval was not found in any source.

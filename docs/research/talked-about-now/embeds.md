# Short answer

Checked **14 October 2026** for [research ticket 538](https://github.com/alp82/goodwatch-monorepo/issues/538), under [map 537](https://github.com/alp82/goodwatch-monorepo/issues/537). Source identifiers below link directly to primary sources; their check dates are recorded in the evidence register.

- **What works without a key:** Meta officially restored tokenless Instagram, Facebook and Threads oEmbed on **15 June 2026**; all four tested endpoints returned embed HTML. YouTube oEmbed accepted an actual Shorts URL. Bluesky oEmbed and public `getPostThread`, Reddit oEmbed/widget, Mastodon.social oEmbed, and Vimeo public oEmbed returned successful responses. TikTok Player v1 returned player HTML; Twitch documents a keyless clips iframe. These are HTTP/documentation findings, not browser playback certification. [M1][M1] [M2][M2] [L1][L1] [L2][L2] [L3][L3] [L4][L4] [Y1][Y1] [B2][B2] [B3][B3] [R3][R3] [R4][R4] [A2][A2] [V2][V2] [T2][T2] [W1][W1]
- **What does not follow:** keyless does not mean unrestricted reuse. Instagram/Threads oEmbed is for front-end embedding; persisting post data for analytics or other non-embedding purposes is prohibited. TikTok oEmbed returned **429** here; its documented keyless interface is not a guaranteed operational dependency. Dailymotion's current integration requires a **valid Player ID**; the legacy/default player returned **403**, even though no-ID oEmbed still returned JSON. [M3][M3] [M4][M4] [T1][T1] [T3][T3] [D1][D1] [D2][D2] [D3][D3] [D4][D4]
- **Thumbnails:** YouTube's `i.ytimg.com` URLs work, and YouTube policies explicitly contemplate thumbnails that initiate playback. A thumbnail facade is supported in principle under YouTube's attribution/player rules; this is not blanket permission to copy or rehost images. A browser hotlink before consent still contacts Google, so it does not meet the map's zero-third-party-request facade assumption. [Y1][Y1] [Y2][Y2] [Y3][Y3] [Y4][Y4] [Y5][Y5]
- **Reddit after 13 November:** **unverifiable today**, because that date is in the future. Reddit's published shutdown concerns RSS and public Data API access, not embeds; its embed endpoints work today. Keep a link fallback and schedule a real browser check on/after **13 November 2026**. Continued embed availability is an inference, not a promise. [R1][R1] [R2][R2] [R3][R3] [R4][R4] [R5][R5]
- **What this means for the map (recommendation):** retain the official-embed, click-to-load architecture, keep discovery/scoring separate from rendering, and use curated public Meta/TikTok/Reddit URLs where selected by the prototypes. Use text/GoodWatch-owned artwork before consent, respect Bluesky's author opt-out, size the players correctly, and treat Dailymotion as requiring player configuration. A platform's denial or withdrawn post should become a link/unavailable card, not a reason to bypass restrictions. This recommendation follows the evidence above and the official opt-out/player rules below. [B4][B4] [B5][B5] [Y4][Y4] [W1][W1] [D1][D1]

## Scope and method

The earlier report and notes were read using `git show origin/ccr-327ca25f-xd6xns:<path>`, without switching or changing that branch. The baseline is `docs/research/reports/Social content embeds deep dive.md`, particularly its “Open verification items” table, and the relevant video, text-network, thumbnail-policy and facade notes under `docs/research/research_notes/Social content embeds deep dive/`. The reconciliation table below marks every baseline claim used by this report **confirmed**, **corrected** or **unverifiable**; unrelated discovery, pricing and legal-history claims are outside ticket 538.

Only official documentation, first-party source code/posts and ordinary public HTTP requests were used as evidence. Requests used no API key, token, login session or challenge-solving. A rate-limit or denial was recorded without bypassing it. Where the web reader failed to retrieve a documentation page, an ordinary direct public GET was used; that fetched text is distinguished from endpoint responses.

**Verification limit:** no browser executed the returned widgets or played the media. A `200` containing a player shell or oEmbed HTML does not prove playback, current post availability, cookie behavior, regional access or successful loading of all subresources. Quotas were read, not exhausted. Private/age-restricted examples, removed posts and an opted-out Bluesky author were not tested live. All checks below occurred on **2026-10-14**.

## Meta: documented tokenless access, with a narrow purpose

Meta's announcement and Graph references explicitly lift the token requirement for **Threads oEmbed, Instagram oEmbed, Facebook oEmbed Post and Facebook oEmbed Video** from **15 June 2026**. App Review is no longer required to embed public content. The published anonymous limit is **1,000 requests per endpoint per hour**; an approved Meta/Threads oEmbed Read feature plus an access token allows **5 million per endpoint per day**. The reviewed text does not identify whether tokenless quota accounting is by IP, site or another identifier; do not invent that scope. [M1][M1] [M2][M2]

### Live checks

Each URL below was called without an `access_token` or authentication header on **2026-10-14**. Samples come from Meta's official documentation, plugin README and tests. [M3][M3] [M9][M9] [M10][M10]

| Endpoint / public sample | Result | Meaning |
|---|---|---|
| [Instagram `/v25.0/instagram_oembed`, `p/fA9uwTtkSN`][L1] | 200 JSON, `type: rich` | Tokenless public post markup returned. |
| [Threads `/oembed`, `@threads/post/DWjTI0cgH5O`][L2] | 200 JSON, `type: rich` | Tokenless Threads markup returned. |
| [Facebook `/v25.0/oembed_post`, Kevin Love public post][L3] | 200 JSON, `type: rich` | Tokenless Facebook post markup returned. |
| [Facebook `/v25.0/oembed_video`, Reel `3305054673010377`][L4] | 200 JSON, `type: video`, `fb-video` markup | This Reel returned official oEmbed video markup; the earlier direct `plugins/video.php` Reel assumption was not tested. |

All four responses contained `html`, `provider_name`, `provider_url`, `type`, `version` and `width`, and none contained `thumbnail_url`, `author_name` or `author_url`. The Graph references also document removal of author/thumbnail fields in November 2025. Returned HTML references the respective Meta scripts/SDK; the response is not a source of free thumbnail/author metadata. [L1][L1] [L2][L2] [L3][L3] [L4][L4] [M1][M1]

### Terms and limits relevant to GoodWatch

- **Instagram:** photo/video/Reel/feed embeds are documented, with public supported URL forms. Private, inactive and age-restricted accounts, accounts with embeds disabled, Stories and Shadow DOM are unsupported. oEmbed metadata/content and derivatives may be used only to provide the front-end view; extraction, persistence or analytics for another purpose is expressly prohibited. [M3][M3]
- **Threads:** text, image, video and carousel posts are supported; private, inactive, age-restricted and geo-gated posts are unsupported. The same front-end-only restriction excludes derived analytics and other reuse. [M4][M4]
- **Facebook:** Embedded Posts are for public Page/profile posts. The June announcement subjects tokenless access to Platform Terms, Developer Policies, Community Standards and other applicable terms. [M6][M6] [M2][M2]
- **Platform-wide:** Platform Terms §1(c), §2(c), §3(a)(viii) and §3(d) cover documented purposes, third-party rights/notice handling, and updates/deletion. Developer Policies §12 prohibits obscuring plugin elements, selling plugin placement, and pairing Social Plugins with non-Meta ads; §6 requires respect for content-owner restrictions on Instagram. [M7][M7] [M8][M8]

**Map implication (inference):** use Meta oEmbed as the renderer for known public URLs. Its restoration removes the assumed App Review prerequisite for that rendering path, but does not open Instagram/Threads discovery or allow deriving the buzz score from their oEmbed payloads. Keep GoodWatch's own title matching/editorial labels separate from copied post metadata. [M1][M1] [M3][M3] [M4][M4]

## TikTok: Player v1 is documented; oEmbed was rate-limited here

The official iframe is `https://www.tiktok.com/player/v1/{post_id}`. These are the complete query parameters in the reviewed **Embed Player** documentation, last updated **4 August 2026**. All use `0`/`1`; `muted` is the URL parameter, while `mute` is a message command. [T4][T4]

| Parameter | Default | Effect of `1` / qualification |
|---|---:|---|
| `controls` | 1 | Show all controls. |
| `progress_bar` | 1 | Show progress. |
| `play_button` | 1 | Show play button. |
| `volume_control` | 1 | Show volume control. |
| `fullscreen_button` | 1 | Show fullscreen control. |
| `timestamp` | 1 | Show time/duration. |
| `loop` | 0 | Repeat video. |
| `autoplay` | 0 | Start automatically; browser policy can prevent it. |
| `music_info` | 0 | Show music information. |
| `description` | 0 | Show description. |
| `rel` | 1 | Recommended videos; `0` selects the current author's videos, not “no related videos.” |
| `native_context_menu` | 1 | Show native context menu. |
| `closed_caption` | 1 | Show caption icon. |
| `muted` | 0 | Zero volume and prevent user volume changes. |

The documentation also exposes `postMessage` commands `play`, `pause`, `seekTo`, `mute`, `unMute`, `navigateTo`, and readiness/state/time/volume/image/error events. Some parameters/commands apply only to videos or image posts; consult the source rather than assuming every control works for both. [T4][T4]

The [documented Player v1 sample with controls/description/music parameters][T2] returned **200 HTML**. The [documented oEmbed sample][T3] returned **429 Too Many Requests**, with a short gateway error page. No attempt was made to evade that result. The oEmbed documentation lists only a `url` request parameter and illustrates `type: video`, author/title/thumbnail fields, and `blockquote.tiktok-embed` plus `embed.js`; its output is the legacy widget, not a Player v1 URL. A numeric public oEmbed quota was not established from the reviewed embed docs. [T1][T1]

The embed guide describes creator attribution and links back to TikTok; content removed from TikTok becomes unavailable in its embed. Developer Terms II permit use according to the documentation; III.3 restricts unauthorized/commercial purposes, excessive requests, building profiles/databases, circumvention, and removing notices/attribution. VI requires cessation/deletion on termination. The reviewed docs/terms did not establish an oEmbed thumbnail-cache permission or fixed retention window. The earlier advice that expiring thumbnails “must be cached” is therefore not a supported implementation requirement. No separate embed-specific contract was established; the embed documentation links to the Developer Terms, and the public embed landing page returned 503 here. [T1][T1] [T5][T5] [T6][T6]

**Recommendation:** prefer the official Player v1 for curated IDs, preserve attribution, handle player errors, and give the facade a text fallback that does not depend on an oEmbed thumbnail. This is an implementation recommendation, not a promise that every public post will play. [T1][T1] [T2][T2] [T4][T4]

## YouTube: Shorts oEmbed works; thumbnail facades are conditional

An actual Short was selected from the public [YouTube-owned Shorts page][Y0]. Calling [YouTube oEmbed with `/shorts/Q_BC8ZhiZoU`][Y1] returned **200 JSON**, `type: video`, title/author, a `thumbnail_url` at `i.ytimg.com/vi/Q_BC8ZhiZoU/hq2.jpg`, and an iframe using `/embed/Q_BC8ZhiZoU?feature=oembed`. The [returned thumbnail][Y2] returned **200 image/jpeg**. A separate [known public-video thumbnail at `/vi/jNQXAC9IVRw/hqdefault.jpg`][Y3] also returned **200 image/jpeg**. Use the URL returned by oEmbed/API metadata rather than assuming a particular thumbnail filename or resolution is available for every video.

The Shorts response's suggested iframe dimensions were **113×200**. Those dimensions are below the official **200×200 minimum viewport**: resize the embed rather than blindly inserting its suggested dimensions. The official requirements recommend at least 480×270 for 16:9 players and require a `Referer` identity, recommending `strict-origin-when-cross-origin`. The oEmbed HTML already included that referrer policy. [Y1][Y1] [Y4][Y4]

**May `i.ytimg.com` be used in a click-to-load facade?** The vendor-policy answer is a **qualified yes**: YouTube's minimum functionality rules explicitly contemplate thumbnails that initiate playback (minimum **120×70**), and Google's own performance guide demonstrates replacing a facade with a YouTube player on interaction. This supports the pattern; it does not individually approve every thumbnail-copying/privacy design. [Y4][Y4] [Y6][Y6]

YouTube Developer Policies III.F require clear YouTube attribution, including for thumbnails, and prohibit obscuring player attribution; minimum functionality rules prohibit overlays in front of an instantiated player. Non-authorized API metadata temporarily stored under III.E.4 must be refreshed/deleted within **30 days** and kept current. That metadata rule is not blanket permission to download/rehost audiovisual content or images indefinitely. [Y5][Y5] [Y4][Y4]

**Map implication (inference):** remove the facade when mounting the real player, preserve YouTube branding and `Referer`, and keep the configured minimum size. A browser `<img src="https://i.ytimg.com/...">` makes a Google request before the player loads; it cannot satisfy the map's “nothing from a third party before click” assumption. Use text/owned artwork until consent, or make thumbnail loading itself subject to consent. Whether to proxy/rehost thumbnails remains outside this endpoint/vendor-policy check; the map already places that legal question after launch. [Y2][Y2] [Y3][Y3] [Y4][Y4] [Y5][Y5]

## Bluesky: official widget, public thread API, author opt-out

The [live oEmbed sample][B2] returned **200 JSON** with `type: rich`, `version: 1.0`, author/provider fields, `cache_age: 86400`, `width: 600`, `height: null`, and `blockquote.bluesky-embed` with `data-bluesky-uri`/`data-bluesky-cid` plus `https://embed.bsky.app/static/embed.js`. Official docs say the script replaces the blockquote with an iframe, `maxwidth` is clamped to **220–600**, and `maxheight` is ignored. A second request with `maxwidth=180&maxheight=100` returned width **220**, height **null**. [B1][B1] [B2a][B2a]

[Public `app.bsky.feed.getPostThread`][B3] returned **200 JSON** with a `threadViewPost`, without authentication, using `depth=0&parentHeight=0`. The official lexicon says authentication is not required, and defines thread/not-found/blocked response variants. Public fetching is not equivalent to authorization to ignore presentation restrictions. [B6][B6]

The official oEmbed server checks the author's self-issued **`!no-unauthenticated`** label (`src == author.did`) and returns **403** for a non-public post. The official widget also checks author labels and presents an opt-out message/link rather than the post on external sites. This is confirmed from first-party implementation, not a live opted-out-author test. The documentation additionally describes redacting deleted/adult content. Preserve the official widget and honor the label if any custom rendering is later considered; a publicly obtainable API record does not override that preference. [B4][B4] [B5][B5] [B1][B1]

## Reddit: works now; the requested future test is impossible today

Official help documents **Share → Embed**, `publish.reddit.com`, and oEmbed-enabled CMS use. Edited/deleted posts get a notice and link to the current Reddit version. Reddit's first-party embed documentation identifies **`https://embed.reddit.com/widgets.js`** and `https://www.reddit.com/oembed?url=...`; `embed.reddit.com` is a real embed host, not an unverified guess. [R6][R6] [R7][R7]

On **2026-10-14**, [oEmbed for Reddit's own infrastructure announcement][R3] returned **200 JSON**, with `reddit-embed-bq` and the official widget script; [the widget script][R4] and [that announcement's embed page][R8] both returned **200**, the latter HTML with the embed theme. This establishes current endpoint/markup availability, not visually verified rendering.

The official **8 October 2026** changelog and linked announcement say RSS ends **13 November 2026**, new public API access requests stop **31 October 2026**, removal begins **12 January 2027** for unregistered/unresponsive apps/users, and remaining public Data API access ends by **March 2027**. Neither reviewed shutdown source announces an embed shutdown. RSS, public Data API and the official embed surface must not be treated as the same interface. [R1][R1] [R2][R2]

Embeds Terms §1 grants a revocable embed license; §2 restricts use beyond displaying content, paid access without approval, modifying/obscuring embed elements, implied affiliation, and advertising/endorsement without rightsholder permission. §3 allows change, suspension or termination. Therefore **“still renders after 13 November 2026” is unverifiable on 14 October**, and the absence of an embed shutdown announcement is only evidence for a tentative continuation assumption. Keep Reddit optional/linkable and recheck a real browser after the date. [R5][R5]

## Other platforms: one line each

All sources and requests in this table were checked **2026-10-14**; none was playback-tested in a browser.

| Platform | Finding and constraint |
|---|---|
| **Mastodon** | Public `/api/oembed` is documented without OAuth; [mastodon.social sample][A2] returned 200 `type: rich`, but current markup is **blockquote + `embed.js`** creating an iframe, not the docs' older direct-iframe example; [source][A3] confirms it, and the [post embed target][A4] returned 200—check each instance/version. [A1][A1] |
| **Twitch clips** | Documented keyless raw iframe `https://clips.twitch.tv/embed?clip={slug}&parent={hostname}`, repeated `parent` for each serving domain, **HTTPS**, minimum **400×300**, clip defaults `autoplay=false`, `muted=false`; do not apply stream/VOD defaults or interactive JS support to clips. [W1][W1] [W2][W2] |
| **Vimeo** | [Public oEmbed sample][V2] returned 200 with a `player.vimeo.com` iframe and thumbnail; owners can domain-restrict embeds, oEmbed metadata can be truncated without an allowed-domain request header, and unlisted URLs require the privacy hash—these private restrictions were documented, not tested. [V1][V1] |
| **Dailymotion** | Current [oEmbed docs][D1] require `url` **and `player`** (your valid Studio Player ID); [no-ID oEmbed][D2] still returned 200 but supplied the [default player][D3] that returned 403, while [the migration guide's Player-ID example][D4] returned 200 HTML; keyless iframe loading is distinct from obtaining/configuring a Player ID. [D5][D5] |

## Reconciliation with the prior research

“Confirmed” means supported at the stated evidence level; it does not silently upgrade an HTTP or documentation check to browser playback. Every evidence identifier below links to a URL checked **2026-10-14**, listed in the register.

| Prior claim touched (report / relevant notes) | Status | Finding / evidence |
|---|---|---|
| Meta tokenless access returned around 15 June 2026. | **Confirmed** | Official announcement/references give the exact date; four live tokenless responses. [M1][M1] [M2][M2] [L1][L1] [L2][L2] [L3][L3] [L4][L4] |
| Meta's change is undocumented; limits are unknown. | **Corrected** | Documented: 1,000/endpoint/hour anonymous; 5m/endpoint/day approved-token route. Anonymous accounting identity remains **unverifiable**. [M1][M1] |
| Video notes: Meta public oEmbed still requires a token/App Review. | **Corrected** | Removed for public embeds. [M1][M1] [M2][M2] |
| Meta author/thumbnail fields were removed in November 2025. | **Confirmed** | Official reference plus absence in all four current samples. [M1][M1] [L1][L1] [L2][L2] [L3][L3] [L4][L4] |
| Instagram Reels use the official script; no documented direct iframe was established. | **Confirmed / unverifiable** | Script and Reel URL support confirmed; a direct `/reel/{id}/embed` contract was not established. [M3][M3] |
| Facebook Reels through direct `plugins/video.php` are unconfirmed. | **Unverifiable** | Direct route not tested; official oEmbed video route **confirmed** for one Reel. [L4][L4] |
| TikTok Player v1, controls and postMessage exist. | **Confirmed** | Complete current parameter names/defaults documented; player sample returned HTML. [T4][T4] [T2][T2] |
| TikTok oEmbed is a keyless URL-to-widget/thumbnail interface. | **Confirmed / unverifiable** | Documented request/response confirmed; successful live retrieval here unverifiable because of 429. [T1][T1] [T3][T3] |
| TikTok thumbnails expire in days and therefore must be cached. | **Unverifiable / corrected** | No primary expiry duration or cache permission established; do not make mandatory caching a facade dependency. [T1][T1] [T5][T5] |
| YouTube Shorts use `/embed/{id}`; oEmbed `/shorts/` support untested. | **Confirmed** | Actual Short returned `/embed/{id}` and thumbnail metadata. [Y1][Y1] |
| `i.ytimg.com/.../hqdefault.jpg` validity/thumbnail facade permission unknown. | **Confirmed, qualified** | Live images work; policies explicitly contemplate playback thumbnails and attribution, not unrestricted rehosting. [Y2][Y2] [Y3][Y3] [Y4][Y4] [Y5][Y5] |
| YouTube needs minimum 200×200 and a Referer. | **Confirmed** | Current primary requirements; returned Shorts sizing needs adjustment. [Y4][Y4] [Y1][Y1] |
| Bluesky oEmbed format and public thread API were background knowledge. | **Confirmed** | Live rich JSON/widget and unauthenticated thread response, plus official docs/lexicon. [B1][B1] [B2][B2] [B3][B3] [B6][B6] |
| Hide Bluesky `!no-unauthenticated` content. | **Confirmed** | Official oEmbed/widget enforce author opt-out; not live-tested with that label. [B4][B4] [B5][B5] |
| Reddit supports Share→Embed and edit/delete notices. | **Confirmed** | Official support plus live official widget/HTML availability. [R6][R6] [R3][R3] [R4][R4] [R8][R8] |
| `embed.reddit.com` existence was unverified. | **Corrected** | First-party documentation and working script/post endpoint. [R7][R7] [R4][R4] [R8][R8] |
| Reddit 31 October / 13 November / March 2027 shutdown dates. | **Confirmed** | Official changelog; these concern API requests, RSS and public API respectively. [R1][R1] |
| Reddit embeds survive 13 November. | **Unverifiable** | Future date; shutdown sources do not name embeds, but terms reserve withdrawal. [R1][R1] [R2][R2] [R5][R5] |
| Mastodon `/api/oembed` returns an iframe directly. | **Corrected** | Endpoint exists; current mastodon.social returns blockquote/script; older documented iframe format can coexist. [A1][A1] [A2][A2] [A3][A3] |
| Twitch raw clips iframe requires `parent`, with unknown size/HTTPS/defaults. | **Confirmed** | Official docs give HTTPS, 400×300, per-domain parent and clip-specific defaults. [W1][W1] [W2][W2] |
| Vimeo keyless oEmbed and owner domain/unlisted restrictions. | **Confirmed** | Public sample live; private restrictions documented. [V1][V1] [V2][V2] |
| Dailymotion uses a default player without configuration; Player ID optional in oEmbed. | **Corrected** | Current docs require Player ID; no-ID JSON supplied a failing player URL. [D1][D1] [D2][D2] [D3][D3] [D4][D4] |
| Dailymotion's default-player transition happened 1 September 2025. | **Unverifiable** | Current migration guide mixes October 2024/February 2026 dates and stale default-player FAQ text; no reliable exact transition date established. [D5][D5] |
| A facade can use a cached thumbnail while loading nothing third-party before click. | **Corrected, scoped** | Direct hotlinks contact the image host; cache/rehost rights were not established here. Text/owned-artwork facades meet the map's request boundary without relying on that claim. [Y2][Y2] [Y3][Y3] [Y5][Y5] [T5][T5] |

## Evidence register

Every entry was **checked 2026-10-14**. “Live” means our own public HTTP request; “docs” means the actual official page text was read; “source” means first-party implementation, not a third-party description. Endpoint links preserve the exact tested requests for reproduction. No content URL is a recommended GoodWatch editorial selection.

| ID | Primary URL / evidence | Checked | Kind |
|---|---|---|---|
| M1 | [Meta oEmbed Post reference][M1] | 2026-10-14 | Docs: tokenless date, quotas, field removal |
| M2 | [Meta tokenless announcement][M2] | 2026-10-14 | First-party announcement |
| M3 | [Instagram oEmbed guide][M3] | 2026-10-14 | Docs: supported content, purpose, restrictions |
| M4 | [Threads embed guide][M4] | 2026-10-14 | Docs: supported content, purpose, restrictions |
| M5 | [Meta-owned WordPress provider implementation][M5] | 2026-10-14 | Source / official example provenance |
| M6 | [Facebook Embedded Posts][M6] | 2026-10-14 | Docs |
| M7 | [Meta Platform Terms][M7] | 2026-10-14 | Terms |
| M8 | [Meta Developer Policies][M8] | 2026-10-14 | Policies |
| M9–M10 | [Meta plugin README][M9], [Meta plugin tests][M10] | 2026-10-14 | Source: exact sample provenance |
| L1–L4 | [Instagram][L1], [Threads][L2], [Facebook post][L3], [Facebook Reel/video][L4] | 2026-10-14 | Live: all 200 JSON |
| T1 | [TikTok Embed Videos][T1] | 2026-10-14 | Docs: oEmbed, attribution, removal |
| T2 | [TikTok Player v1 sample][T2] | 2026-10-14 | Live: 200 HTML |
| T3 | [TikTok oEmbed sample][T3] | 2026-10-14 | Live: 429 |
| T4 | [TikTok Embed Player][T4] | 2026-10-14 | Docs: parameters/messages |
| T5 | [TikTok Developer Terms][T5] | 2026-10-14 | Terms; direct GET successful |
| T6 | [TikTok embed landing page][T6] | 2026-10-14 | Live: 503 |
| Y0 | [YouTube-owned Shorts page][Y0] | 2026-10-14 | Live: public sample provenance |
| Y1 | [YouTube Shorts oEmbed][Y1] | 2026-10-14 | Live: 200 JSON |
| Y2–Y3 | [Returned Shorts image][Y2], [hqdefault image][Y3] | 2026-10-14 | Live: both 200 JPEG |
| Y4 | [YouTube Required Minimum Functionality][Y4] | 2026-10-14 | Docs: thumbnails, size, identity, overlays |
| Y5 | [YouTube Developer Policies][Y5] | 2026-10-14 | Policies: attribution, stored API data |
| Y6 | [Google: facades for third-party resources][Y6] | 2026-10-14 | First-party performance guidance, not license |
| B1 | [Bluesky official oEmbed documentation source][B1] | 2026-10-14 | Docs source |
| B2/B2a | [Bluesky oEmbed][B2], [width/height variant][B2a] | 2026-10-14 | Live: 200 rich JSON |
| B3 | [Bluesky public getPostThread][B3] | 2026-10-14 | Live: 200 JSON |
| B4–B5 | [Bluesky oEmbed handler][B4], [widget post screen][B5] | 2026-10-14 | Source: opt-out enforcement |
| B6 | [Bluesky getPostThread lexicon][B6] | 2026-10-14 | Source: authentication and response contract |
| R1 | [Reddit changelog, 8 October 2026][R1] | 2026-10-14 | Official shutdown dates |
| R2 | [Reddit's infrastructure announcement][R2] | 2026-10-14 | First-party post |
| R3/R4/R8 | [Reddit oEmbed][R3], [widget script][R4], [post embed page][R8] | 2026-10-14 | Live: all 200 |
| R5 | [Reddit Embeds Terms][R5] | 2026-10-14 | Terms |
| R6–R7 | [Reddit embedding help][R6], [Reddit embed documentation PDF][R7] | 2026-10-14 | Docs; PDF dated 2023-03-31 |
| A1 | [Mastodon oEmbed method][A1] | 2026-10-14 | Docs; older iframe example |
| A2/A4 | [mastodon.social oEmbed][A2], [post embed page][A4] | 2026-10-14 | Live: both 200 |
| A3 | [Mastodon oEmbed serializer][A3] | 2026-10-14 | Source: blockquote/script markup |
| W1–W2 | [Twitch video/clip embeds][W1], [general embed requirements][W2] | 2026-10-14 | Docs |
| V1/V2 | [Vimeo private-video oEmbed guide][V1], [public oEmbed sample][V2] | 2026-10-14 | Docs / live 200 JSON |
| D1 | [Dailymotion oEmbed guide][D1] | 2026-10-14 | Docs: required Player ID |
| D2–D4 | [No-ID oEmbed][D2], [no-ID player][D3], [Player-ID player][D4] | 2026-10-14 | Live: 200 JSON / 403 / 200 HTML |
| D5 | [Dailymotion migration guide][D5] | 2026-10-14 | Docs with conflicting historical dates |

[M1]: https://developers.facebook.com/docs/graph-api/reference/oembed-post/
[M2]: https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/
[M3]: https://developers.facebook.com/docs/instagram-platform/oembed/
[M4]: https://developers.facebook.com/docs/threads/tools-and-resources/embed-a-threads-post
[M5]: https://github.com/facebook/meta-embeds-for-wordpress/blob/main/includes/class-meta-embeds.php
[M6]: https://developers.facebook.com/docs/plugins/embedded-posts/
[M7]: https://developers.facebook.com/terms/
[M8]: https://developers.facebook.com/devpolicy/
[M9]: https://github.com/facebook/meta-embeds-for-wordpress/blob/main/README.md
[M10]: https://github.com/facebook/meta-embeds-for-wordpress/blob/main/tests/MetaEmbedsTest.php
[L1]: https://graph.facebook.com/v25.0/instagram_oembed?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FfA9uwTtkSN%2F
[L2]: https://graph.threads.com/oembed?url=https%3A%2F%2Fwww.threads.com%2F%40threads%2Fpost%2FDWjTI0cgH5O%2F
[L3]: https://graph.facebook.com/v25.0/oembed_post?url=https%3A%2F%2Fwww.facebook.com%2Fkevinloveofficial%2Fposts%2Fpfbid0nWhZeiMVjzLHVjzR6QngXeVug8Nw4YxncbbZrquMu72r3HM8a73k55keRWiaWNLTl%2F
[L4]: https://graph.facebook.com/v25.0/oembed_video?url=https%3A%2F%2Fwww.facebook.com%2Freel%2F3305054673010377
[T1]: https://developers.tiktok.com/docs/en/embed-videos
[T2]: https://www.tiktok.com/player/v1/6718335390845095173?autoplay=0&controls=1&description=1&music_info=1
[T3]: https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40scout2015%2Fvideo%2F6718335390845095173
[T4]: https://developers.tiktok.com/docs/en/embed-player
[T5]: https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en
[T6]: https://www.tiktok.com/embed
[Y0]: https://www.youtube.com/@YouTube/shorts
[Y1]: https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fshorts%2FQ_BC8ZhiZoU&format=json
[Y2]: https://i.ytimg.com/vi/Q_BC8ZhiZoU/hq2.jpg
[Y3]: https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg
[Y4]: https://developers.google.com/youtube/terms/required-minimum-functionality
[Y5]: https://developers.google.com/youtube/terms/developer-policies
[Y6]: https://developer.chrome.com/docs/lighthouse/performance/third-party-facades
[B1]: https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/oembed.md
[B2]: https://embed.bsky.app/oembed?url=https%3A%2F%2Fbsky.app%2Fprofile%2Fradosh.bsky.social%2Fpost%2F3mxoxnkgri22k
[B2a]: https://embed.bsky.app/oembed?url=https%3A%2F%2Fbsky.app%2Fprofile%2Fradosh.bsky.social%2Fpost%2F3mxoxnkgri22k&maxwidth=180&maxheight=100
[B3]: https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at%3A%2F%2Fdid%3Aplc%3Acurdc4nsriafv2j7y7ucgoub%2Fapp.bsky.feed.post%2F3mxoxnkgri22k&depth=0&parentHeight=0
[B4]: https://github.com/bluesky-social/social-app/blob/main/bskyweb/cmd/embedr/handlers.go
[B5]: https://github.com/bluesky-social/social-app/blob/main/bskyembed/src/screens/post.tsx
[B6]: https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/getPostThread.json
[R1]: https://support.reddithelp.com/hc/en-us/articles/54353370049684-Changelog-October-8-2026
[R2]: https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/
[R3]: https://www.reddit.com/oembed?url=https%3A%2F%2Fwww.reddit.com%2Fr%2Fmodnews%2Fcomments%2F1wubgvt%2Fcontinuing_our_infrastructure_updates_whats%2F
[R4]: https://embed.reddit.com/widgets.js
[R5]: https://redditinc.com/policies/embeds-terms
[R6]: https://support.reddithelp.com/hc/en-us/articles/360043033532-How-do-I-embed-a-Reddit-post-or-comment-in-an-article-or-other-publication
[R7]: https://publish.reddit.com/assets/Reddit_Embed_Documentation.pdf
[R8]: https://embed.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/
[A1]: https://docs.joinmastodon.org/methods/oembed/
[A2]: https://mastodon.social/api/oembed?url=https%3A%2F%2Fmastodon.social%2F%40trwnh%2F99664077509711321
[A3]: https://github.com/mastodon/mastodon/blob/main/app/serializers/oembed_serializer.rb
[A4]: https://mastodon.social/@trwnh/99664077509711321/embed
[W1]: https://dev.twitch.tv/docs/embed/video-and-clips/
[W2]: https://dev.twitch.tv/docs/embed/
[V1]: https://help.vimeo.com/hc/en-us/articles/12427906892689-Use-oEmbed-with-private-videos
[V2]: https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F22439234
[D1]: https://developers.dailymotion.com/docs/embed-with-oembed
[D2]: https://www.dailymotion.com/services/oembed?url=https%3A%2F%2Fwww.dailymotion.com%2Fvideo%2Fx84sh87&format=json
[D3]: https://geo.dailymotion.com/player.html?video=x84sh87
[D4]: https://geo.dailymotion.com/player/x8lr5.html?video=x84sh87
[D5]: https://developers.dailymotion.com/v0/reference/migration-guide-new-embed-endpoint

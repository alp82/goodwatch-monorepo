# Libraries, tools and services for social-content discovery and embedding (state: October 2026)

> **Method note:** These notes were gathered on 2026-10-14. From this sandbox, the **npm and PyPI registry JSON APIs** could be reached, so release dates and licences below come straight from them. The GitHub API, github.com and ecosyste.ms were **blocked** (proxy 403), and WebFetch could not resolve vendor domains. As a result, **star counts and archived flags could not be fetched directly**. Where archived status is stated, it comes from a web search source. Vendor pricing comes from web search summaries, and many of those are third-party or competitor pages, which are flagged where relevant. Registry lookups (`https://registry.npmjs.org/<pkg>`, `https://pypi.org/pypi/<pkg>/json`) are cited as the npm/PyPI package page.

## Frontend embedding and rendering: which lite and static components are maintained and fit Remix and React 18?

### Takeaway
- **YouTube:** use a facade. `react-lite-youtube-embed` (3.7.0, Sep 2026) or Paul Irish's `lite-youtube-embed` (0.3.4, Nov 2025) work well with React 18 and Remix.
- **Tweets:** `react-tweet` (3.3.1, Jun 2026) renders tweets statically with no iframe. It depends on X's undocumented syndication endpoint.
- **Bluesky:** static, RSC-style React renderers exist (`bsky-react-post`, `react-bluesky-embed`), but they are small hobby projects.
- **TikTok, Instagram and Mastodon:** no maintained "lite" React component exists. Old wrappers (`react-tiktok`, `react-instagram-embed`) are stale since 2020/2021.
- **Catch-all wrapper:** `react-social-media-embed` (last release Feb 2025) only wraps the vendors' heavy official scripts.

### Cited Findings
**YouTube / Vimeo facades**
- `lite-youtube-embed` (Paul Irish): latest 0.3.4, published 2025-11-10, Apache-2.0. — [npm](https://www.npmjs.com/package/lite-youtube-embed)
- `react-lite-youtube-embed`: latest 3.7.0, published 2026-09-06, MIT. It is actively released. — [npm](https://www.npmjs.com/package/react-lite-youtube-embed)
- `@justinribeiro/lite-youtube` (web component): latest 1.9.0, published 2025-10-28, MIT. — [npm](https://www.npmjs.com/package/@justinribeiro/lite-youtube)
- Lighthouse's "third-party facades" audit lists `paulirish/lite-youtube-embed` and `justinribeiro/lite-youtube` as the recommended YouTube facades. Its illustration says a facade "weighs 3 KB and the player weighing 540 KB is loaded on interaction." — [Chrome Lighthouse docs](https://developer.chrome.com/docs/lighthouse/performance/third-party-facades)
- The third-party-web rule of thumb: "a facade should be < 10% of the product it's mimicking." — [patrickhulce/third-party-web facades.md](https://github.com/patrickhulce/third-party-web/blob/10ec0f8f30bbbb73e2de5640cb652a07dd4d7d11/facades.md)
- Lighthouse quirk: the facade audit returns "not applicable" when no facade-eligible third-party resource is loaded. Correctly using lite-youtube therefore does not show up as a "pass". — [Lighthouse issue #14269](https://github.com/GoogleChrome/lighthouse/issues/14269)
- `lite-vimeo-embed` (luwes): latest 0.3.0, published **2023-11-23**, MIT. It is **stale**. — [npm](https://www.npmjs.com/package/lite-vimeo-embed)
- `@slightlyoff/lite-vimeo`: latest 0.1.4, published 2025-10-04, MIT. — [npm](https://www.npmjs.com/package/@slightlyoff/lite-vimeo)
- `@astro-community/astro-embed-youtube` (part of the astro-embed monorepo, useful for patterns only, since it is Astro): latest 0.5.10, published 2026-01-01, MIT. — [npm](https://www.npmjs.com/package/@astro-community/astro-embed-youtube)

**X / Twitter**
- `react-tweet` (Vercel): latest 3.3.1, published 2026-06-03, MIT. — [npm](https://www.npmjs.com/package/react-tweet)
- Its main branch still calls `cdn.syndication.twimg.com/tweet-result` and computes a token from the tweet ID. — [react-tweet fetch-tweet.ts](https://github.com/vercel/react-tweet/blob/main/packages/react-tweet/src/api/fetch-tweet.ts)
- The endpoint is unofficial, and a maintainer-thread commenter warns "these apis can break at anytime." — [react-tweet issue #76](https://github.com/vercel/react-tweet/issues/76)
- An August 2025 write-up describes X.com's official embed as broken while the reverse-engineered syndication approach still worked. — [samwize 2025](https://samwize.com/2025/08/10/the-x-com-embed-disaster-still-broken-but-we-have-a-reverse-engineered-solution/)
- A 2026 Chinese-language post calls syndication an undocumented internal interface that has caused embed outages before. — [bingqiangzhou](https://bingqiangzhou.github.io/posts/toolsandresources-tweetembedapis/)
- One commenter says syndication only returns about 140 characters of text and no threads or replies. This is a single social post and is unverified. — [X post by dotey](https://x.com/dotey/status/1808326779083579400)

**Multi-platform wrapper**
- `react-social-media-embed` (justinmahar): latest 2.5.18, published 2025-02-18, MIT. There have been no 2025 H2 or 2026 releases. — [npm](https://www.npmjs.com/package/react-social-media-embed)
- `react-tiktok`: 1.0.0, published **2020-07-26**. It is **stale**. — [npm](https://www.npmjs.com/package/react-tiktok)
- `react-instagram-embed`: 3.0.0, published **2021-07-10**. It is **stale** and predates Meta's oEmbed changes. — [npm](https://www.npmjs.com/package/react-instagram-embed)

**TikTok lite**
- `justinribeiro/lite-tiktok` is a web component that lazy-loads TikTok embeds. Its README calls it "experimental and a work in progress." — [GitHub lite-tiktok](https://github.com/justinribeiro/lite-tiktok)

**Bluesky**
- `bsky-react-post`: 0.1.7, published 2024-11-27, MIT. — [npm](https://www.npmjs.com/package/bsky-react-post)
  - Its docs say posts "can be rendered statically, preventing the need to include an iframe and additional client-side JavaScript," and that it is RSC-compatible. They advise caching, because rendering calls Bluesky's API. — [bsky-react-post docs](https://bsky-react-post.rhinobase.io/)
- `react-bluesky-embed` (0.5.0) takes a similar static, RSC-compatible approach for threads. — [react-bluesky-embed docs](https://react-bluesky-embed.vercel.app/), [npmpackage.info](https://npmpackage.info/package/react-bluesky-embed)
- Other options:
  - `@hamstack/bluesky-embed-rsc` (RSC). — [demo](https://bluesky-embed-rsc.vercel.app/)
  - `react-bsky-embed` (RSC, uses embed.bsky.app's template). — [GitHub](https://github.com/dsalvagni/react-bsky-embed)
  - `bluesky-embed-react` (client-side). — [GitHub](https://github.com/oetherington/bluesky-embed-react)
- A Bluesky engineer's write-up says the official Bluesky embed is iframe-based and "doesn't mesh very nicely with React." — [mozzius.dev](https://mozzius.dev/post/3l7dnil23ed23)
- The npm package named `bluesky-embed` is 0.0.1 (2024-11-09) with no licence field. It is probably not mary-ext's project. — [npm](https://www.npmjs.com/package/bluesky-embed)

**Mastodon**
- No package named `mastodon-embed` exists on the npm registry (the registry lookup returned 404). — [npm registry lookup](https://registry.npmjs.org/mastodon-embed)

**Static (server-rendered) vs iframe**
- web.dev recommends lazy-loading third-party embeds and "displaying a facade in its place when users may not interact with the embed." It notes the Instagram embed "can be over 100 KB gzipped." — [web.dev embed best practices](https://web.dev/articles/embed-best-practices)

### Inferences
- Static rendering suits Remix plus Valkey well. The pattern is to fetch the tweet or post JSON in a loader (or in the Windmill pipeline), cache it in Valkey, and render plain HTML. This gives zero third-party requests until the user clicks, which is privacy-friendly. Media images still hot-link to pbs.twimg.com or cdn.bsky.app unless they are proxied.
- `react-tweet` exports its data-fetching (`getTweet`) separately from rendering. That means tweet JSON could be cached server-side. It is the best-maintained option, but the X endpoint is a single point of failure.
- For TikTok and Instagram, the realistic approach is a self-built facade: a thumbnail (from oEmbed `thumbnail_url` or a stored image) plus a "load from TikTok/Instagram" click. No maintained React lite component exists to adopt.

### Gaps
- GitHub stars and last-commit dates for each repo could not be fetched (GitHub and ecosyste.ms were blocked).
- mary-ext's `bluesky-embed` (which may be published on JSR rather than npm) was not verified.
- No live verification that `cdn.syndication.twimg.com` works in October 2026.
- No maintained lite components for Mastodon or Instagram were found in the searches.

## oEmbed and metadata tooling and hosted proxies (Iframely, Embedly, noembed, Microlink)

### Takeaway
- **Self-hosted (all MIT, maintained in 2026):** `@extractus/oembed-extractor` (6.0.0, Aug 2026), `open-graph-scraper` (6.12.0, Jun 2026) and `metascraper` (5.58.4, Oct 2026). Together they cover oEmbed and OG metadata without a vendor.
- **Iframely:** free tier of about 2,000 hits per month, then $49 per month.
- **Microlink:** free tier of 100 requests per month. Paid pricing conflicts between sources (€39 or $49 per month).
- **Embedly:** roughly $119 per month, per a competitor's figure.
- **Meta:** reportedly re-allowed tokenless Instagram, Facebook and Threads oEmbed in June 2026. This is undocumented and fragile.

### Cited Findings
- `@extractus/oembed-extractor`: 6.0.0, published 2026-08-06, MIT. — [npm](https://www.npmjs.com/package/@extractus/oembed-extractor)
- `open-graph-scraper`: 6.12.0, published 2026-06-26, MIT. — [npm](https://www.npmjs.com/package/open-graph-scraper)
- `metascraper`: 5.58.4, published 2026-10-09, MIT. It is very active. — [npm](https://www.npmjs.com/package/metascraper)
- `@microlink/react`: 5.5.25, published 2026-05-21, MIT. — [npm](https://www.npmjs.com/package/@microlink/react)
- `iframely` (open-source self-hostable server): 2.5.0, published 2025-08-21, MIT. — [npm](https://www.npmjs.com/package/iframely)
- **Iframely pricing:**
  - The official page lists four plans:

    | Plan | Price per month | Hits per month included |
    |---|---|---|
    | Starter | $0 | 2,000 |
    | Business | $49 | 25,000 |
    | Editorial | $149 | 100,000 |
    | Enterprise | $399 | 500,000 |

  - A "hit" is one hour a URL is active, with a maximum of 24 per day. Fetching raw data can cost as little as 1 hit per URL. — [Iframely pricing](https://iframely.com/pricing)
  - Older listings show 1k, 10k, 100k and 1M hits at the same price tiers. — [Iframely plans (old)](https://iframely.com/plans/187acc0cc254), [SaaSworthy](https://www.saasworthy.com/product/iframely)
  - Iframely tracked Meta's 2020 breaking change to Facebook and Instagram oEmbed (a token requirement). — [itteco/iframely #284](https://github.com/itteco/iframely/issues/284)
- **Microlink pricing:**
  - Free key with 100 requests per month and all Pro features; Pro "starting at €39/month." — [Microlink API](https://microlink.io/api), [Microlink metadata](https://microlink.io/metadata)
  - Microlink's comparison pages cite $49 per month for 46,000 requests and "50 requests/day forever" free. These conflict with the figures above. — [Microlink vs Iframely](https://microlink.io/alternative/iframely), [Microlink vs Embedly](https://microlink.io/alternative/embedly)
  - A third party says the free tier is 25 requests per day. — [freepublicapis](https://www.freepublicapis.com/microlink-api)
- **Embedly pricing:** API plan from $119 per month for 10,000 embed URLs, a 30-day trial, and a Cards plan at $14 per month. These figures come from a competitor (Microlink) and are unverified. — [Microlink vs Embedly](https://microlink.io/alternative/embedly)
- **Meta oEmbed:**
  - Meta reportedly reversed the oEmbed token requirement in June 2026 (June 15). Instagram, Facebook and Threads oEmbed can now be called without a token or App Review, and "rate limits on tokenless calls may differ." — [WP Mayor](https://wpmayor.com/meta-tokenless-oembed-wordpress/), [Spotlight](https://spotlightwp.com/instagram-embed-wordpress/), [Bluehost on Meta oEmbed Read](https://www.bluehost.com/blog/meta-oembed-read-explained/)
  - A developer guide tested tokenless calls on 2026-09-11 and found they worked, but warns the behaviour is undocumented and could be switched off. — [Feedframer](https://feedframer.com/guides/instagram-post-embed)
  - Meta's official doc was updated 2026-05-15. — [Meta Instagram oEmbed docs](https://developers.facebook.com/documentation/instagram-platform/oembed)

### Inferences
- For GoodWatch, the cheapest robust path is to resolve oEmbed and OG data **in the Windmill pipeline**, using Python equivalents or a small Node step with `@extractus/oembed-extractor` or `metascraper`. Store the thumbnail, title, author and html in MongoDB, then render facades from stored data. That makes hosted proxies unnecessary.
- Iframely's free 2,000 hits are too few if hits accrue per active URL-hour. Fetching raw data once per URL in the pipeline keeps cost at about 1 hit per URL.

### Gaps
- noembed.com's current status and maintenance could not be verified (the site was unreachable and no search results were found).
- The provider-registry JSON (`iamcal/oembed`, `oembed.com/providers.json`) and its last-update date could not be fetched.
- Embedly's official 2026 pricing page was not found.

## Consent facades and CMPs: which give per-vendor embed placeholders? Is Google Consent Mode v2 relevant?

### Takeaway
- **Per-vendor embed placeholders out of the box:** Klaro ("contextual consent") and orestbida's **iframemanager** (pairs with CookieConsent v3) provide them. CookieConsent v3 itself does not. Commercial CMPs Usercentrics and Cookiebot also offer per-service content blocking, though that was not verified here.
- **Release status:** Klaro's npm release is stale (0.7.21, Mar 2024). `vanilla-cookieconsent` 3.1.0 is from Feb 2025.
- **Heise projects:** Shariff (3.3.0, 2023) is for share buttons, not embeds. The `@heise/embetty-base` package has had no release since 2019, so it is **stale**.
- **Google Consent Mode v2:** it matters mainly for sites that send EEA traffic to Google Ads or Analytics tags.

### Cited Findings
**Klaro**
- `klaro`: 0.7.21, published **2024-03-26**, BSD-3-Clause. There have been no npm releases since. — [npm](https://www.npmjs.com/package/klaro)
- Contextual consent: replace `src` with `data-src`, add `data-name`, and Klaro shows a placeholder with consent buttons in place of the iframe. — [Klaro contextual consent tutorial](https://klaro.org/docs/tutorials/contextual_consent)
- Known issues:
  - It does not handle elements injected after init (AJAX/SPA). — [kiprotect/klaro #434](https://github.com/kiprotect/klaro/issues/434)
  - Placeholder customization is limited (a user wanted a video thumbnail). — [kiprotect/klaro #458](https://github.com/kiprotect/klaro/issues/458)

**CookieConsent v3 and iframemanager**
- `vanilla-cookieconsent` (orestbida CookieConsent v3): 3.1.0, published 2025-02-04, MIT. — [npm](https://www.npmjs.com/package/vanilla-cookieconsent)
- iframemanager "completely remov[es] iframes initially," generates them on accept, supports custom thumbnails, and "can be integrated with any consent solution." It syncs with CookieConsent via the onChange callback. — [orestbida/iframemanager](https://github.com/orestbida/iframemanager), [Iframe Manager blog](https://orestbida.com/blog/iframe-manager/), [iframemanager #28](https://github.com/orestbida/iframemanager/issues/28), [CookieConsent v3 playground](https://playground.cookieconsent.orestbida.com/)
- A WordPress plugin built on CookieConsent v3 + iframemanager + Consent Mode v2 favours this approach over Klaro. This is one project's opinion. — [AlkoKod/cz-cookie-consent](https://github.com/AlkoKod/cz-cookie-consent)

**Heise Shariff and embetty**
- `shariff` (heise): 3.3.0, published 2023-09-19, MIT. — [npm](https://www.npmjs.com/package/shariff)
- Shariff succeeds heise's original 2-click share buttons, and a heise Group page in 2026 still describes it. — [heise group](https://www.heisegroup.de/bilderstrecke/bilderstrecke_2467112.html?bild=1), [dr-datenschutz](https://www.dr-datenschutz.de/like-button-und-datenschutz-heise-shariff-verbessert-2-klick-loesung/)
- `@heise/embetty-base` (heise's server-proxied embed component for Twitter, YouTube and Vimeo): 1.0.9, published **2019-09-05**. The npm name `embetty` returns 404. — [npm](https://www.npmjs.com/package/@heise/embetty-base)

**Cookiebot and Usercentrics**
- Cookiebot free plan: 1 domain with fewer than 50 subpages, one-language banner, manual blocking, Consent Mode v2, and a consent expiry capped at 1 month. Premium runs about $8–96 per month per domain. — [Enzuzo on Cookiebot pricing](https://www.enzuzo.com/blog/cookiebot-pricing), [Consently review](https://consently.net/blog/cookiebot-review)
- Usercentrics free plan reportedly covers 1 domain, up to 1,000 sessions, GDPR only. — [Consently comparison](https://consently.net/blog/cookiebot-vs-usercentrics)

**Google Consent Mode v2**
- It passes `ad_user_data` and `ad_personalization`, which Google requires for EEA advertising traffic.
- In "advanced" mode, tags send cookieless pings after a decline. In "basic" mode, tags do not load until consent. — [Consently review](https://consently.net/blog/cookiebot-review), [Cookiebot WP plugin](https://wordpress.org/plugins/cookiebot/)

### Inferences
- For a non-commercial Remix app without Google Ads, Consent Mode v2 is only relevant if GA4 or other Google tags are used. Embeds themselves (YouTube, TikTok) are governed by the per-vendor consent placeholder, not by Consent Mode.
- iframemanager is not React-native. In React 18 the simplest approach is a custom `<ConsentFacade vendor="youtube">` component that reads consent state (from CookieConsent v3's API or a cookie) and swaps facade for iframe. This avoids Klaro's dynamic-DOM problem.
- A `youtube-nocookie.com` iframe still loads Google JS after the click. The facade (click-to-load) acts as the consent action, which is the "two-click" pattern in one click.

### Gaps
- Osano and Termly pricing and features were not researched (tool budget).
- Whether Usercentrics or Cookiebot ship ready-made per-vendor iframe placeholders was not verified from primary docs.
- Embetty's GitHub archived flag was not verified.

## Discovery and ingestion libraries (Python): maintenance and do they work in 2026?

### Takeaway
- **Healthy (2026 releases):** google-api-python-client, yt-dlp, PRAW/asyncpraw (8.0.3), atproto (0.0.72), twscrape (0.20.1), instaloader (4.15.4, 2 days ago), Mastodon.py (2.2.2), feedparser, trafilatura (2.3.1), newspaper4k (0.9.6), apify/crawlee, camoufox, patchright and playwright-stealth 2.x.
- **Stale or dead:** youtube-search-python (2022), snscrape (2023, X modules broken), pytrends (repo **archived April 2025**, 429/404 errors), mwviews (2022), and the spaCy entity linkers (2023).
- **Constraints, not library limits:** Reddit API access now requires manual approval, and YouTube downloads need PO tokens and a JS runtime.

### Cited Findings
**YouTube**
- `google-api-python-client`: 2.201.0, published 2026-09-30, Apache-2.0. — [PyPI](https://pypi.org/project/google-api-python-client/)
- YouTube Data API: the default quota is 10,000 units per day. `search.list` is commonly cited at 100 units per call, while Google's own reference page now phrases it as "100 calls per day," a conflict that needs checking. `playlistItems.list` costs 1 unit (100× cheaper for listing a channel's uploads). Quota resets at midnight PT. — [Google search.list docs](https://developers.google.com/youtube/v3/docs/search/list), [Google quota cost](https://developers.google.com/youtube/v3/determine_quota_cost), [OutlierKit](https://outlierkit.com/resources/youtube-search-api/)
- `yt-dlp`: 2026.8.19, published 2026-08-19, Unlicense. — [PyPI](https://pypi.org/project/yt-dlp/)
  - yt-dlp now needs a JS runtime (Deno ≥ 2.0.0 recommended) for YouTube. — [yt-dlp #14404](https://github.com/yt-dlp/yt-dlp/issues/14404)
  - PO-token provider plugin `bgutil-ytdlp-pot-provider`: "a PO token does not bypass IP-based login restrictions." Datacenter IPs usually also need cookies. — [bgutil README](https://github.com/Brainicism/bgutil-ytdlp-pot-provider), [tunelio 2026](https://tunelio.dev/blog/yt-dlp-sign-in-to-confirm-not-a-bot/)
- `scrapetube`: 2.6.0, published 2025-09-16, MIT. It has had no 2026 release. — [PyPI](https://pypi.org/project/scrapetube/)
- `youtube-search-python`: 1.6.6, published **2022-06-23**. It is **unmaintained**. — [PyPI](https://pypi.org/project/youtube-search-python/)

**Reddit**
- `praw` and `asyncpraw`: both 8.0.3, published 2026-08-12, BSD-2. — [PyPI praw](https://pypi.org/project/praw/), [PyPI asyncpraw](https://pypi.org/project/asyncpraw/)
- Reddit's "Responsible Builder Policy" (Nov 2025) requires manual approval before new OAuth tokens get API access. The free tier is reported as 100 queries per minute per client, non-commercial only. Small personal projects report rejections, and existing approved keys keep working. Policy dates conflict across sources (Nov 2025 vs Jun 2026). — [Prowlo](https://prowlo.com/blog/reddit-data-api), [ReplyDaddy](https://replydaddy.com/blog/reddit-api-pre-approval-2025-personal-projects-crackdown), [redditapis.com (vendor)](https://www.redditapis.com/blogs/reddit-data-api-2026), [Wikipedia](https://en.wikipedia.org/wiki/Reddit_API_controversy)

**Bluesky**
- `atproto` (MarshalX): 0.0.72, published 2026-09-10, MIT. — [PyPI](https://pypi.org/project/atproto/)
  - It covers XRPC clients, Firehose, Jetstream, identity and more. — [MarshalX/atproto](https://github.com/MarshalX/atproto)
- Bluesky runs 4 official public Jetstream instances (e.g. `jetstream2.us-west.bsky.network/subscribe`). They need no auth, deliver JSON, and use cursors in Unix µs. — [Jaz's blog](https://jazco.dev/2024/09/24/jetstream/), [Joseph Scott](https://josephscott.org/blog/2025/sky-view-a-look-into-the-bluesky-jetstream/)
- `truewire-dev/bluesky` is a typed client for the unauthenticated public AppView (`public.api.bsky.app`, IP-rate-limited) plus Jetstream. Its import name collides with an unrelated PyPI package. — [truewire-dev/bluesky](https://github.com/truewire-dev/bluesky)

**X / Twitter**
- `twscrape`: 0.20.1, published 2026-08-25, MIT. It needs pools of real X accounts (auth_token and ct0 cookies). — [PyPI](https://pypi.org/project/twscrape/), [Scrapfly](https://scrapfly.io/blog/posts/best-twitter-scrapers-github), [xpoz](https://www.xpoz.ai/blog/guides/open-source-social-media-scrapers-what-still-works-2026/)
- `snscrape`: last release 0.7.0.20230622. Its X modules are broken since X removed public endpoints in 2023, and its last commit was Nov 2023. — [PyPI](https://pypi.org/project/snscrape/), [Scrapfly](https://scrapfly.io/blog/posts/best-twitter-scrapers-github)
- Other X tools:
  - Twint was archived in 2023.
  - Nitter was reportedly archived in Aug 2026 after a cease-and-desist (single vendor-blog source).
  - Scweet was "last verified" Sep 2026.
  - The official X API is now pay-per-use.
  - Sources: [Scrapfly](https://scrapfly.io/blog/posts/best-twitter-scrapers-github), [Scweet](https://github.com/Altimis/Scweet), [voidmob](https://voidmob.com/blog/how-to-scrape-twitter-x-2026)

**Instagram and TikTok**
- `instaloader`: 4.15.4, published 2026-10-12, MIT. It is actively released.
  - A doc_id revocation caused 401s for all users, and PR #2676 fixes it. A June 2026 comment reports that the workflow works again.
  - Bellingcat advises using `--login` (a logged-in session).
  - Sources: [PyPI](https://pypi.org/project/instaloader/), [instaloader PR #2676](https://github.com/instaloader/instaloader/pull/2676), [Bellingcat toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/instaloader)
- `TikTokApi` (davidteather): 7.3.3, published 2026-04-01, MIT. It has had no release for about 6 months.
  - Its recurring failure mode is `EmptyResponseException` (bot detection). The library's own message advises headless=False, webkit or a proxy, and an ms_token is required. — [PyPI](https://pypi.org/project/TikTokApi/), [TikTok-Api #1242](https://github.com/davidteather/tiktok-api/issues/1242), [Discussion #1115](https://github.com/davidteather/TikTok-Api/discussions/1115)
  - No 2026-specific "works / broken" reports were found.
- `tiktok-scraper` (drawrowfly, Node): not checked via the registry. It is widely known to be abandoned, but this is unverified here, so it is moved to Gaps.

**Mastodon**
- `Mastodon.py`: 2.2.2, published 2026-08-03, MIT. — [PyPI](https://pypi.org/project/Mastodon.py/)

**News**
- `gdeltdoc` (GDELT DOC 2.0 API): 1.12.0, published 2025-04-03. It has had no 2026 release. — [PyPI](https://pypi.org/project/gdeltdoc/)
- `feedparser`: 6.0.14, published 2026-07-30, BSD-2. — [PyPI](https://pypi.org/project/feedparser/)
- `trafilatura`: 2.3.1, published 2026-10-06, Apache-2.0. — [PyPI](https://pypi.org/project/trafilatura/)
- `newspaper4k`: 0.9.6, published 2026-07-19, MIT. — [PyPI](https://pypi.org/project/newspaper4k/)

**Wikimedia and trends**
- `mwviews`: 0.2.1, published **2022-03-02**. It is stale, though the underlying Wikimedia Pageviews REST API can be called directly. — [PyPI](https://pypi.org/project/mwviews/)
- `pytrends`:
  - It has been an **archived** GitHub repo since 2025-04-17, and its last PyPI release is 4.9.2 (Apr 2023). — [PyPI](https://pypi.org/project/pytrends/), [GeneralMills/pytrends](https://github.com/GeneralMills/pytrends), [DEV: pytrends is archived](https://dev.to/alfhar/pytrends-is-archived-how-i-pull-google-trends-data-in-python-now-1hcp)
  - Users frequently get 429 errors, and its trending endpoints return 404. — [DEV: 404 trending](https://dev.to/egrarobo/pytrends-trendingsearches-returns-404-get-google-trends-trending-now-from-the-rss-feed-2026-59ma), [ScrapingBee](https://www.scrapingbee.com/blog/google-trends-scraper/)
  - Google's official Trends API (announced 2025-07-24) is still an application-gated alpha. — [DEV: Trends API invite-only](https://dev.to/ishemah/googles-trends-api-is-still-invite-only-i-tested-what-the-alternatives-return-5be4)
  - One suggested fork is `trendspy` (last commit Dec 2024). — [DEV: pytrends is dead](https://dev.to/datafabrik/pytrends-is-dead-3-ways-to-get-google-trends-data-in-2026-with-code-1i5i)

**Crawling and anti-bot**
- `apify` (Python SDK): 4.1.0, published 2026-10-08, Apache-2.0. — [PyPI](https://pypi.org/project/apify/)
- `crawlee` (Python): 1.10.4, published 2026-10-06, Apache-2.0. — [PyPI](https://pypi.org/project/crawlee/)
- `camoufox`: 0.5.8, published 2026-10-06, MIT. — [PyPI](https://pypi.org/project/camoufox/)
- `patchright`: 1.63.0, published 2026-09-20, Apache-2.0. — [PyPI](https://pypi.org/project/patchright/)
- `playwright-stealth`: 2.0.3, published 2026-04-04, MIT. — [PyPI](https://pypi.org/project/playwright-stealth/)
- `tf-playwright-stealth`: 1.2.0, published 2025-06-13. — [PyPI](https://pypi.org/project/tf-playwright-stealth/)
- `scrapling`: 0.4.15, published 2026-08-23, BSD-3. — [PyPI](https://pypi.org/project/scrapling/)

### Inferences
- **Recommended free, ToS-friendly sources for the pipeline:**
  - YouTube Data API: use `playlistItems` on official studio and trailer channels, and keep `search.list` usage sparse.
  - Bluesky via public AppView and Jetstream.
  - Mastodon.py.
  - feedparser plus trafilatura for news and RSS.
  - Wikimedia pageviews via direct REST.
  - Reddit only if API approval is granted.
- **Fragile, high-maintenance options:** TikTok (TikTokApi), Instagram (instaloader) and X (twscrape) all need accounts, cookies, tokens or proxies. They are a poor fit for a non-commercial project's maintenance budget, and a hosted vendor (next section) is the pragmatic alternative.
- **yt-dlp `extract_flat`** (metadata only, no media download) is likely still workable for listing playlists and search results. YouTube's bot wall is IP-reputation based, so running it from Windmill on a datacenter IP may need cookies or residential egress.

### Gaps
- `extract_flat` behaviour under the 2026 PO-token regime was not specifically confirmed.
- No 2026-dated reports on whether TikTokApi works were found.
- `tiktok-scraper` (drawrowfly) status was not checked.
- GitHub stars for all repos were not obtained.
- Proxy prices (residential $/GB) in 2026 were not researched.

## Hosted scraping and data vendors: coverage, 2026 pricing and reliability

### Takeaway
For a low-volume non-commercial project, the pay-as-you-go options with no expiry or subscription are the best fit: **ScrapeCreators** (about $1.88 per 1k calls, credits never expire) and **Apify** pay-per-result actors ($1–3 per 1k results depending on plan). EnsembleData ($100+ per month), Phyllo (quote-based, creator-OAuth oriented), Bright Data and Oxylabs are aimed at larger or commercial users.

### Cited Findings
- **ScrapeCreators:**
  - Credit packs: $47 buys 25k credits ($1.88 per 1k one-credit calls), and $497 buys 500k (about $0.99 per 1k). Most endpoints cost 1 credit. Credits never expire and there is no rate limit.
  - Free trial is either 100 free credits or $1 of credit (sources conflict).
  - It covers TikTok keyword video search and hashtag search.
  - The figures come mainly from third-party pages. — [CreatorCrawl alternatives](https://creatorcrawl.com/alternatives/scrapecreators/), [treg.to listing](https://treg.to/tools/scrapecreators), [ScrapeCreators hashtag scrapers blog](https://scrapecreators.com/blog/best-tiktok-hashtag-scrapers), [UGC Roster review](https://www.ugcroster.com/blog/scrape-creators-alternative-creator-data-api)
- **EnsembleData** (official page):
  - Free trial of 50 units per day.
  - Paid plans, all covering TikTok and Instagram:

    | Plan | Price per month | Units per day |
    |---|---|---|
    | Wood | $100 | 1,500 |
    | Bronze | $200 | 5,000 (adds Threads) |
    | Silver | $400 | 11,000 |
    | Gold | $800 | 25,000 |
    | Platinum | $1,400 | 50,000 |

  - Units reset at 00:00 UTC with no rollover, and failed calls are not charged. — [EnsembleData pricing](https://ensembledata.com/pricing), [SocialCrawl vs EnsembleData](https://www.socialcrawl.dev/vs/ensembledata)
- **Apify TikTok Scraper:** per-result pricing of $3 per 1k on Free, $2 on Starter, $1.50 on Scale and $1 on Business (checked 2026-10-07). Platform and compute fees are extra. — [SocialCrawl TikTok APIs 2026](https://www.socialcrawl.dev/blog/best-tiktok-data-apis-2026), [Social Fetch](https://www.socialfetch.dev/blog/best-tiktok-data-apis-2026)
- **Bright Data:** about $1.50 per 1k records pay-as-you-go, about $499 per month Scale tier, and 5k free records per month. — [xpoz comparison](https://www.xpoz.ai/blog/comparisons/apify-vs-bright-data-vs-xpoz-social-media-scraping/), [Social Fetch](https://www.socialfetch.dev/blog/best-social-media-scraping-apis-2026)
- **Data365:** one claim of $0.60 per 1k records, while another source says custom pricing. Unconfirmed. — [ScrapeBadger](https://scrapebadger.com/blog/best-tiktok-scraping-apis-in-2026-compared-and-ranked), [BrowserAct](https://www.browseract.com/blog/best-tiktok-scraper)
- **SociaVault:** credit packs of $29 for 6k, $79 for 20k, $199 for 75k and $399 for 200k, with 50 free credits. The TikTok credit cost per call is unclear. — [ScrapeBadger](https://scrapebadger.com/blog/best-tiktok-scraping-apis-in-2026-compared-and-ranked)
- **Phyllo:** custom, quote-based pricing, reportedly from about $199 per month. It is creator-OAuth (connected accounts) oriented, not public search. — [Influencer Hero](https://www.influencer-hero.com/blogs/phyllo-pricing-and-review), [Social Fetch vs Phyllo (competitor)](https://www.socialfetch.dev/compare/phyllo), [Phyllo social data pricing](https://www.getphyllo.com/post/social-data-api-pricing)
- **SerpApi:** YouTube is included as an engine under the general plans. — [apiserpent](https://apiserpent.com/blog/serpapi-pricing-explained), [itechguides](https://www.itechguides.com/products/serpapi/)

  | Plan | Price per month | Searches per month |
  |---|---|---|
  | Free | $0 | 250 |
  | Starter | $25 | 1,000 |
  | Developer | $75 | 5,000 |
  | Production | $150 | 15,000 |
  | Big Data | $275 | 30,000 |

  There is no pay-as-you-go option, and hourly throughput is capped at 20% of the monthly volume.
- **Oxylabs Web Scraper API:**
  - Plans run from $49 per month (Micro) to $999 (Business), billed on successful requests.
  - The "Other" category is about $1.15 per 1k results without JS and $1.35 per 1k with JS.
  - No TikTok-specific rate was found, and plan quotas conflict across sources. — [frontdeskreview](https://frontdeskreview.com/software/web-scraping-api/oxylabs/), [scrapeprices](https://scrapeprices.com/provider/oxylabs-web-scraper), [TrustRadius](https://www.trustradius.com/products/oxylabs/pricing)
- **Caveat:** most comparison pages above (socialcrawl, socialfetch, scrapebadger, creatorcrawl, xpoz, ScrapeCreators' own blog) are published by competing vendors.

### Inferences
- A rough budget example: a weekly TikTok keyword search for about 500 trending titles comes to about 2k calls per month, which is about $4 per month on ScrapeCreators. That is affordable without a subscription.
- Reliability claims (uptime, success rates) are not independently measured anywhere found. Treat vendors as swappable behind a pipeline adapter.

### Gaps
- No independent reliability or uptime data for any vendor.
- Reddit coverage per vendor (ScrapeCreators reportedly has Reddit endpoints, but this was not verified).
- Instagram Reels search-by-keyword availability per vendor was not verified.
- Data365 and SociaVault official pricing pages were not reached.

## Entity linking: matching posts and videos to the right title

### Takeaway
No maintained open-source "movie mention detector" was found, and the spaCy entity linkers are stale (2023). Practitioners converge on a pipeline with four parts: normalize titles, retrieve TMDB candidates, score them with a threshold and margin (year and popularity as tie-breakers), and send ambiguous cases to an LLM with the candidate list. Research shows LLM entity linking helps on noisy Reddit text, and that images disambiguate short posts.

### Cited Findings
- `spacy-entity-linker`: 1.0.3, published 2023-02-03. — [PyPI](https://pypi.org/project/spacy-entity-linker/)
- `spacyopentapioca`: 0.1.7, published 2023-04-01. Both are stale. — [PyPI](https://pypi.org/project/spacyopentapioca/)
- `refined` (Amazon ReFinED) on PyPI is 0.0.1 from 2021. — [PyPI](https://pypi.org/project/refined/)
- An LLM-based entity-linking step improved movie-name extraction from Reddit, where users misspell or abbreviate titles. — [arXiv 2502.14137](https://arxiv.org/pdf/2502.14137)
- Pattern: send the label plus TMDB candidates (title, year, overview, popularity) to an LLM that picks one or declines, with fallback when it declines. — [windows-ripping-machine #13](https://github.com/wiz0floyd/windows-ripping-machine/issues/13)
- Pattern: accept a TMDB match only above a score threshold **and** a margin over the runner-up. Otherwise mark it ambiguous. Year distance and popularity act as tie-breakers. — [relos #19](https://github.com/relos-tv/relos/issues/19)
- Title normalization (regex plus a corrections list) comes before TMDB search, and leftovers go to an LLM stage. — [DEV: cleaning cinema titles](https://dev.to/alistairjcbrown/cleaning-cinema-titles-before-you-can-even-search-1463)
- Short social posts often lack text context, and images can disambiguate (e.g. Harry Potter film vs book). — [arXiv 2306.12725](https://arxiv.org/pdf/2306.12725)

### Inferences
- **Proposed GoodWatch approach:**
  1. Run a high-precision first pass. Posts from official handles (TMDB `external_ids` give the instagram, twitter, facebook and, for some records, tiktok/youtube IDs; the field list is from memory and was not verified this session) and official hashtags are auto-linked.
  2. Generate candidates by fuzzy title match plus year and season tokens.
  3. Run an embedding similarity between post text and TMDB overview and cast in Qdrant, which already exists in the stack.
  4. For ambiguous cases, use an OpenRouter LLM classifier with a candidate list and a "none" option. This handles "The Bear" vs bears, sequels (number or year tokens) and remakes (year and cast).
- Cast and character names in the post are strong disambiguators for remakes. Pass the top cast to the LLM prompt.

### Gaps
- No open-source project specifically for movie or TV mention detection in social media was found.
- The TMDB `external_ids` field list was not verified this session.
- No benchmarks were found on LLM vs embedding accuracy for title linking.

## Performance: what embeds cost and what facades save

### Takeaway
- **YouTube:** the iframe player is about 540 KB of JS in Lighthouse's own example, against about 3 KB for a facade.
- **TikTok:** an embed loads about 500 KB of JS plus 3–5 MB of images and video, totalling 8–12 MB per embed (2022 measurements).
- **Instagram:** the embed exceeds 100 KB gzipped.
- **Advice:** facades or click-to-load are strongly advised for grids of social content. Lighthouse explicitly audits for facades.

### Cited Findings
- YouTube player: about 540 KB loaded on interaction, against a 3 KB facade. — [Lighthouse third-party facades](https://developer.chrome.com/docs/lighthouse/performance/third-party-facades)
- TikTok: "a single embed will load 500kB of JavaScript… then 3-5Mb of images, on top of loading the entire video clip… expect 8-12MB on the wire." — [lite-tiktok README](https://github.com/justinribeiro/lite-tiktok), [Justin Ribeiro 2022](https://justinribeiro.com/chronicle/2022/07/15/terrible-tiktok-embed-web-performance-and-my-imperfect-web-component-solution/)
- A post with 18 TikTok embeds consistently crashed mobile browsers. — [WordPress/performance #1706](https://github.com/WordPress/performance/issues/1706)
- Native `loading="lazy"` does not cover TikTok iframes injected by script without the attribute. — [Chromium issue 40235598](https://issues.chromium.org/issues/40235598)
- Instagram embed is "over 100 KB gzipped." Lazy-load it, or use a facade when users may not interact with it. — [web.dev embed best practices](https://web.dev/articles/embed-best-practices)
- A rough threshold: use a facade when the payload is above about 100 KB, otherwise native lazy-loading is enough. — [performanceisolation.com](https://performanceisolation.com/script-loading-fundamentals-priority-optimization/lazy-loading-third-party-embeds-on-interaction/)

### Inferences
- For GoodWatch title pages showing several clips or posts, eager official embeds would multiply into tens of MB. Use server-rendered static cards (thumbnail from pipeline storage, served via your own image CDN or proxy) plus click-to-load iframes per vendor. That combines performance and consent in one pattern.
- Bluesky and X static renderers (react-tweet, bsky-react-post) cost close to zero JS beyond React. They are the cheapest "real content" option.

### Gaps
- No 2025–2026 measurements of the current TikTok or Instagram embed.js sizes were found. The TikTok figures are from 2022.
- No measured Lighthouse score deltas specific to React 18 or Remix were found.

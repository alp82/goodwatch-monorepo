# Text-first social networks and forums: discovering and embedding posts about movies/TV in GoodWatch

State as of 2026-10-14. Research method: web search only. Direct HTTP probing of endpoints from the research sandbox was blocked by the egress proxy (CONNECT 403 for mastodon.social etc.), and WebFetch failed on most primary hosts (reddithelp.com, redditinc.com, techcrunch.com, docs.joinmastodon.org). So **no endpoint below was live-tested**. Many findings come from secondary sources (vendor blogs, scraping-tool marketers, GitHub issues). They are flagged where relevant. Items marked "[background, unverified 2026]" come from the researcher's prior knowledge, with the canonical URL given, and were not re-confirmed in this session.

---

## Reddit: lore, current access (Oct 2026), embeds, terms, AI deals

### Takeaway
Reddit is the richest source of movie/TV discussion: r/movies, r/television, r/boxoffice, show subreddits, episode discussion threads and AMAs. It is also the one closing fastest.
- **May 2026:** unauthenticated `.json` was blocked.
- **Since Nov 2025:** OAuth API access needs manual approval under the Responsible Builder Policy.
- **30 Sep 2026:** Reddit announced that RSS ends **13 Nov 2026**, that new public Data API registrations close **31 Oct 2026**, and that remaining public API access ends by **March 2027**, with migration to the Developer Platform (Devvit).

For GoodWatch, the only durable, low-risk path is official **embeds** (publish.reddit.com / oEmbed) of hand-picked or search-discovered thread URLs. Discovery has to come from elsewhere, e.g. a search engine or an approved API client while it still exists.

### Cited Findings

**2023 API pricing, blackout, Apollo**
- Pricing took effect 1 July 2023 at $0.24 per 1,000 API calls — [TechTarget](https://www.techtarget.com/whatis/feature/Reddit-pricing-API-charge-explained).
- From 1 July 2023 the free tier had two rate limits: 100 queries per minute (QPM) per OAuth client id, and 10 QPM without OAuth. The previous stated limit was 60 QPM — [KnowYourMeme reproduction of Reddit's announcement](https://knowyourmeme.com/memes/2023-reddit-api-pricing-blackout).
- The free exemption was narrower than "all non-commercial use". It was stated as covering non-commercial apps that meet accessibility needs — [TechTarget](https://www.techtarget.com/whatis/feature/Reddit-pricing-API-charge-explained).
- Apollo shut down on 30 June 2023. Its developer said the new pricing would have cost about $20M a year — [mezha.ua, 9 Jun 2023](https://mezha.ua/en/2023/06/09/apollo-will-not-survive-reddit-s-pricing-policy-and-will-close-on-june-30th/); [AppleInsider, 31 May 2023](https://appleinsider.com/articles/23/05/31/the-best-reddit-client-app-is-in-danger-due-to-price-demands).
- The blackout began 12 June 2023. CNBC counted 6,000+ subreddits dark; KnowYourMeme says 8,000+ — [CNBC](https://www.cnbc.com/amp/2023/06/12/reddit-blackout-api-charges-prompt-community-outrage-shutdowns.html); [KnowYourMeme](https://knowyourmeme.com/memes/2023-reddit-api-pricing-blackout).
- Google launched the "Perspectives" filter partly to cope with Reddit's absence during the blackout — [CNBC, 26 Jun 2023](https://www.cnbc.com/2023/06/26/google-execs-hope-new-search-feature-will-help-amid-reddit-blackouts.html).

**Responsible Builder Policy (Nov 2025)**
- Reddit's help center says you must "request access and get explicit approval before accessing any Reddit data through our API". Commercial use needs explicit written approval. Multiple accounts or duplicate requests for the same use case are prohibited — [Reddit Help: Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy). (Quoted via search snippet; the page could not be fetched directly.)
- The policy was reportedly updated 11 Nov 2025, and pre-approval applies even to personal and hobby projects — [ReplyDaddy blog](https://replydaddy.com/blog/reddit-api-pre-approval-2025-personal-projects-crackdown). This is a secondary source; the date is not confirmed on Reddit's page.
- There is no published SLA. Developers on r/redditdev report everything from fast approvals to weeks of silence, plus repeated rejections of detailed, policy-aligned requests. Existing credentials are reportedly grandfathered — [redditapis.com](https://www.redditapis.com/reddit-responsible-builder-policy); [redditapis.com 2026](https://www.redditapis.com/blogs/reddit-data-api-2026). The vendor is biased: it sells an alternative API.

**Unauthenticated `.json` blocked (May 2026)**
- Reddit posted "Protecting communities from scrapers and platform abuse" to r/modnews. Reports give 28 May 2026 as the announcement date. Anonymous `.json` returned 403 within days, with no deprecation window. A retest on 11 Jul 2026 still returned 403, even with a browser User-Agent. Logged-in sessions and OAuth were unaffected — [DEV Community / Crawlora](https://dev.to/tonywangca/why-reddit-blocked-unauthenticated-json-in-2026-and-how-to-still-get-reddit-data-58b9); [Crawlora](https://crawlora.net/blog/reddit-json-api-blocked-2026). Exact effective date conflicts: 29 vs 30 May.

**RSS and public API sunset (announced 30 Sep 2026)**
- TechCrunch headline, 30 Sep 2026: "Reddit is killing RSS feeds and ending public API access because of AI bots" — [TechCrunch](https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/). Article body not fetched.
- RSS ends 13 Nov 2026. Reddit cited RSS as a channel for scraping and automated abuse. Moderators are pointed to the "Discord Relay" Devvit app. Users of non-mod feeds get no replacement — [AndroidHeadlines, Oct 2026](https://www.androidheadlines.com/2026/10/reddit-is-ending-rss-feeds-amid-scraping-concerns.html); [techjournal.org](https://techjournal.org/reddit-rss-feeds-ending); [Lapaas Voice](https://lapaasvoice.com/reddit-to-shut-down-rss-feeds-in-november-public-api-access-by-march-2027).
- Public Data API apps and bots are moving to Reddit's Developer Platform — [Reddit Changelog, 8 Oct 2026](https://support.reddithelp.com/hc/en-us/articles/54353370049684-Changelog-October-8-2026). Search snippet only.
- The legacy public Data API stops accepting new developer requests on 31 Oct 2026. Remaining external access is revoked by March 2027 — [Lapaas Voice](https://lapaasvoice.com/reddit-to-shut-down-rss-feeds-in-november-public-api-access-by-march-2027); [superframeworks](https://superframeworks.com/articles/reddit-api-shutdown-founder-migration-plan).
  - Conflicting secondary details: a "register and migrate to the Developer Platform by 12 Jan 2027" deadline, and a "$1M App Migration Program" closing 30 Nov 2026. **Unverified.**
- Old Reddit is reportedly now accessible only to registered accounts active in the past 6 months — [all-ai.de](https://www.all-ai.de/news/news26/reddit-ende-rss-api); [pasqualepillitteri.it](https://pasqualepillitteri.it/news/19941/reddit-chiude-rss-scraping-ia). **Unverified** against Reddit's own posts.
- A May 2026 guide said `.rss` was then "still free, still public, still maintained", but rate-limited for anonymous traffic — [WP RSS Aggregator](https://www.wprssaggregator.com/blog/).

**Embeds**
- The official writer flow is: Share menu, then Embed, which opens publish.reddit.com to customize. Alternatively, paste a Reddit link into an oEmbed-capable CMS. If the post or comment is later edited or deleted, the embed shows a notice and links to the current version — [Reddit Help: embedding](https://support.reddithelp.com/hc/en-us/articles/360043033532-How-do-I-embed-a-Reddit-post-or-comment-in-an-article-or-other-publication).
- Historical oEmbed endpoint: `reddit.com/oembed?url=…`, with params `parent`, `live` and `omitscript`. It originally covered comment permalinks only; other URLs returned 404 — [reddit-archive wiki](https://github.com/reddit-archive/reddit/wiki/oEmbed). The wiki is about 11 years old.
- Comment embeds launched in March 2015, for public subreddits only. Post embeds followed in May 2016 — [TechCrunch 2015](https://techcrunch.com/2015/03/23/reddit-embeddable-comments); [TechCrunch 2016](https://techcrunch.com/2016/05/19/reddit-embeds).
- As of 2019, the oEmbed response lacked CORS headers, so it had to be fetched server-side. The unofficial alternative was an iframe to `redditmedia.com/...?...embed=true` — [joshuatz.com 2019](https://joshuatz.com/posts/2019/reddit-apis-and-building-reddit-embeds/).
- No documentation was found for `embed.reddit.com` specifically. **Gap.**

**Archives: Pushshift, Arctic Shift**
- Pushshift lost privileged ingestion in 2023 (r/modnews, 1 May 2023: "Reddit Data API update: changes to Pushshift access") and its public API was withdrawn. Its dumps end around March 2023 — [THINKPOL](https://think-pol.com/pushshift-alternative); [xpoz.ai](https://www.xpoz.ai/blog/tutorials/how-to-get-historical-reddit-data-after-pushshift/).
- Arctic Shift is the community-run successor. It offers monthly dumps and a free, keyless API with no uptime guarantee. One source cites about 2.5B items through Feb 2026 (about 261 GB of Parquet on Hugging Face), with a 4–6 week lag and no real-time path. PullPush is a partial fallback — [redditapis.com](https://www.redditapis.com/blogs/best-pushshift-alternatives-2026); [redreplier](https://redreplier.com/blog/arctic-shift); [THINKPOL](https://think-pol.com/blogs/reddit-archive-api).
- GitHub repo (not fetched): https://github.com/ArthurHeitmann/arctic_shift [background].

**Data API terms**
- Commercial use, research beyond rate limits, and anything not expressly permitted need a separate agreement. Data not needed for the approved use must be deleted. User content may not be used to train ML/AI models without rightsholder permission. Terms reportedly last revised 20 Jul 2026. The authenticated limit is cited as 60 req/min, which conflicts with the 100 QPM figure from 2023 — [vorplabs (secondary)](https://vorplabs.com/agent-tools/reddit-data-api). The canonical source, https://redditinc.com/policies/data-api-terms, was not fetchable.

**AI deals and Reddit Answers**
- Reported deal values (not disclosed by the companies) — [LLM Pulse](https://llmpulse.ai/blog/ai-content-licensing-deals/); [illiquidalpha](https://illiquidalpha.substack.com/p/reddit-no-data-deal-announcement):
  - Google: about $60M/yr, signed Feb 2024.
  - OpenAI: about $70M/yr, signed May 2024 — [FXStreet, May 2024](https://www.fxstreet.com/cryptocurrencies/news/reddit-shares-jump-after-hours-on-openai-data-sharing-deal-202405170813).
  - The IPO S-1 disclosed $203M aggregate contract value over 2–3 years.
- In 2026 Reddit is pushing for dynamic, usage-based pricing in renewals. In July 2026 the WSJ reported Reddit weighing cutting off Google's AI access. Expiry timing is disputed: 2026 vs early 2027 — [Stan Ventures](https://www.stanventures.com/news/reddit-wants-more-from-its-ai-deals-with-google-and-openai-4426/); [prowlo](https://prowlo.com/blog/reddit-google-deal); [TIKR](https://www.tikr.com/blog/reddit-fell-6-as-its-550m-ai-deal-renewal-looms-heres-where-the-stock-could-go-in-2026).

### Inferences
- **Non-commercial free access.** Historically the free tier covered non-commercial use at 100 QPM with OAuth. Since Nov 2025 it requires an approved application, and new applications close 31 Oct 2026. A GoodWatch application filed now would be racing a closing window, for access that ends by March 2027 anyway. Not worth building on.
- **Embeds probably survive.** They are a Reddit-controlled, ad-and-attribution-preserving surface, and nothing found says they are affected. Still, re-verify after 13 Nov 2026.
- **Discovery without the API.** Practical options are:
  - A search engine API restricted to `site:reddit.com/r/movies` etc.
  - Arctic Shift. Lagged, so not "hot now", and gray-area for display.
  - Manual or editorial curation of megathreads, e.g. r/movies "Official Discussion" threads and r/television episode threads.
- **Scraping is now high-risk.** Logged-out `.json` is blocked, RSS is dying, and old.reddit is reportedly login-gated. Avoid it.

### Gaps
- Primary text of the r/modnews (May 2026) and r/modnews/r/redditdev (30 Sep 2026) posts was not read. All dates are from secondary coverage.
- Whether non-commercial or accessibility exemptions continue on the Developer Platform: not found.
- Whether `embed.reddit.com` exists as a distinct host, and what the current oEmbed renders (iframe vs blockquote+script): not verified.
- Spoiler and NSFW flags: Reddit `spoiler` and `over_18` are fields in the listing JSON [background]. No 2026 doc confirms them.
- Reddit Answers (the AI search product, launched Dec 2024 [background]): no 2026 source found linking it to API or embed policy.

---

## X/Twitter: embeds, syndication endpoint, Nitter, pricing

### Takeaway
X costs money for any API read since pay-per-use became the default on **6 Feb 2026**, at about $0.005 per post read. Unofficial no-auth routes:
- the `cdn.syndication.twimg.com/tweet-result` endpoint used by Vercel's react-tweet, and
- the publish.twitter.com oEmbed.

Both are undocumented or fragile. No 2026 confirmation of either was found. Nitter was killed again by cease-and-desist letters in **Aug 2026**. Embed individual known tweet IDs via the official widget at most. Don't build discovery on X.

### Cited Findings
- **Pay-per-use and the free tier:** pay-per-use became the default API pricing on 6 Feb 2026, and the free tier was discontinued for new signups — [postproxy](https://postproxy.dev/blog/x-api-pricing-2026/); [opentweet](https://opentweet.io/how-to/x-api-pay-per-use-explained).
- **Rates:** about $0.005 per post read and $0.015 per post created ($0.20 for a post with a URL, added Apr 2026) — [outstand.so](https://www.outstand.so/blog/x-api-pricing); [socialcrawl](https://www.socialcrawl.dev/blog/x-twitter-api-2026).
- **Legacy tiers:**
  - Basic ($200/mo) migrated to pay-per-use after 1 Jun 2026; Pro reportedly after 1 Sep 2026.
  - Enterprise is about $42k/mo.
  - Monthly read cap is reported as 2M or 3M (conflicting).
  - Sources: [api.sorsa.io](https://api.sorsa.io/blog/twitter-api-pricing-2026); [twitterapi.io](https://twitterapi.io/blog/x-api-cost-breakdown-2026). All secondary; official page: https://docs.x.com.
- **react-tweet internals:** it fetches `https://cdn.syndication.twimg.com/tweet-result?id=…&lang=…&token=…&features=…`, with the token computed from the ID — [react-tweet fetch-tweet.ts](https://github.com/vercel/react-tweet/blob/main/packages/react-tweet/src/api/fetch-tweet.ts).
  - Maintainers acknowledge the API is unofficial — [react-tweet issue #76](https://github.com/vercel/react-tweet/issues/76).
  - It only returns the single tweet: no threads or replies, and text limits on long posts — [@dotey on X](https://x.com/dotey/status/1808326779083579400).
- **Embed breakage in 2025:** an Aug 2025 post, "The X.com embed disaster: Still broken, but we have a reverse engineered solution", describes official embeds breaking and a workaround — [samwize](https://samwize.com/2025/08/10/the-x-com-embed-disaster-still-broken-but-we-have-a-reverse-engineered-solution/).
- **No-key archiving:** an Apr 2025 post shows archiving tweets via the syndication/oEmbed endpoints without an API key — [shkspr.mobi](https://shkspr.mobi/blog/2025/04/you-dont-need-an-api-key-to-archive-twitter-data/).
- **2023 login wall:**
  - Late June 2023: logged-out viewing was blocked — [Engadget](https://www.engadget.com/twitter-isnt-showing-tweets-unless-youre-logged-in-165254006.html).
  - By 5 Jul 2023 single tweets were viewable logged out, but replies and full profiles were not — [MobileSyrup](https://mobilesyrup.com/2023/07/05/twitter-users-without-accounts-can-see-tweets-not-profiles-replies/).
  - Reports conflict on embedded timelines/feeds: University of Maine says embedded feeds show a misleading message to logged-out visitors — [UMaine](https://umaine.edu/userguide/?p=2648).
- **Nitter:**
  - X removed guest accounts in Jan 2024 and Nitter was declared dead.
  - It resumed on 6 Feb 2025, using real-account session tokens.
  - On 24 Aug 2026 X sent cease-and-desist letters citing the Texas Harmful Access by Computer Act and the Lanham Act. nitter.net and XCancel went offline and the repo was archived.
  - Conflicting reports followed: the repo was unarchived on 6 Sep 2026 and then archived again on 11 Sep; XCancel suspended in mid-Sep.
  - Sources: [Wikipedia: Nitter](https://en.wikipedia.org/wiki/Nitter); [The Next Web](https://thenextweb.com/news/nitter-xcancel-offline-x-cease-and-desist); [The Register, 7 Sep 2026](https://www.theregister.com/personal-tech/2026/09/07/nitter-lives-to-proxy-another-day-after-taking-legal-advice/5294754).

### Inferences
- **X is actively litigious toward no-auth readers** (Nitter, Aug 2026). Using the syndication endpoint server-side to re-render tweets, as react-tweet does, is gray-area.
- **The official `widgets.js` blockquote embed is the lowest-risk option** (https://publish.twitter.com/?url=… and `platform.twitter.com/widgets.js`, [background]). It loads X tracking scripts, so it needs a consent banner in the EU.
- **Replies/"what people are saying" cannot be shown to logged-out users** from X embeds. Only single posts can.

### Gaps
- Whether `cdn.syndication.twimg.com/tweet-result` and `publish.twitter.com/oembed` respond in Oct 2026. Untested: the network was blocked.
- Whether the starter credits reported for Oct 2026 are real: a single source.

---

## Bluesky (AT Protocol)

### Takeaway
Bluesky is the most open major network, but `searchPosts` is now effectively **auth-only**.
- Unauthenticated requests to `public.api.bsky.app` return 403 "Request forbidden by administrative rules", reported up to late Sep 2026.
- Authenticated reads via `api.bsky.app` with an app-password session work.

Embeds (`embed.bsky.app` and its oEmbed), `getPostThread`, feeds and the Jetstream firehose are the right building blocks. Label-based moderation gives clean spoiler/NSFW filtering.

### Cited Findings
- **searchPosts 403:**
  - An unauthenticated `searchPosts` on both `api.bsky.app` and `public.api.bsky.app` returns 403 "Request forbidden by administrative rules" — [cyanheads/bluesky-mcp-server issue #32 (late Sep 2026)](https://github.com/cyanheads/bluesky-mcp-server/issues/32); [bsky-docs issue #332](https://github.com/bluesky-social/bsky-docs/issues/332).
  - Adding a `cursor` triggered a 403 earlier — [atproto #2838](https://github.com/bluesky-social/atproto/issues/2838); [atproto #3583](https://github.com/bluesky-social/atproto/issues/3583).
  - `public.api.bsky.app` returned 403 even with a Bearer token, while the authenticated AppView `api.bsky.app` worked — [kamoras/civitas PR #594](https://github.com/kamoras/civitas/pull/594).
  - Workaround: an app password, `com.atproto.server.createSession`, then a Bearer token — [DEV Community 2026](https://dev.to/ethan_teague/how-to-scrape-bluesky-data-in-2026-posts-profiles-and-search-1a2k).
- **Labels:** labels come from moderation services and attach to accounts, profiles or records. Clients choose hide, warn or blur per label — [Bluesky docs: Labels and moderation](https://www.docs.bsky.app/docs/advanced-guides/moderation).
  - Clients should ship at least one built-in moderation service and layer user-chosen labelers on top — [Bluesky blog: moderation architecture](https://docs.bsky.app/blog/blueskys-moderation-architecture).
- **Developer Guidelines:** apps with UGC must provide reporting of illegal content, blocking of forbidden content, blocking of abusive users, and a system to respond to reports — [Bluesky Developer Guidelines](https://docs.bsky.app/docs/support/developer-guidelines).
- **Feed generators** filter the public stream by keyword, hashtag or language. They are hosted independently and need no Bluesky permission — [SocialPilot](https://www.socialpilot.co/strategy/bluesky-community-building-with-starter-packs); [medhir.com](https://medhir.com/blog/a-more-complete-bluesky-feed-generator).
- **Third-party moderation (Apr 2025):** third-party apps were not required to apply Bluesky's geographic moderation labelers — [TechCrunch, Apr 2025](https://techcrunch.com/2025/04/23/government-censorship-comes-to-bluesky-but-not-its-third-party-apps-yet).

### Inferences
- **Embed:** `https://embed.bsky.app/oembed?url=https://bsky.app/profile/<handle>/post/<rkey>` returns a blockquote plus `embed.bsky.app/static/embed.js`. Public, no auth [background, unverified 2026].
- **Threads (replies):** `app.bsky.feed.getPostThread` on `public.api.bsky.app` is cached and unauthenticated [background]. It is the best "show the replies" option among all networks.
- **Self-label opt-out:** respect the `!no-unauthenticated` self-label, which users set to hide from logged-out viewers [background; the label spec is at https://docs.bsky.app/docs/advanced-guides/moderation].
- **Discovery of "hot" film posts:**
  1. Consume Jetstream (`wss://jetstream*.bsky.network/subscribe`, JSON firehose [background]) and filter by title keywords and hashtags (#Letterboxd, #FilmSky, #TVSky). Or
  2. Use authenticated `searchPosts` via a GoodWatch bot account with `sort=top`. Or
  3. Read existing community feeds via `app.bsky.feed.getFeed`. "FilmSky"/"TVSky"-style feeds exist [background, unverified 2026].
- **Spoilers:** Bluesky has no native spoiler flag. Content warnings and labels cover sexual, nudity, graphic-media, porn and gore. Spoilers need keyword heuristics, or a community spoiler labeler if one exists.

### Gaps
- No primary 2026 confirmation of the oEmbed format, or that `getPostThread` remains public.
- Film-specific feeds by name and AT-URI: not found.
- Bluesky Terms text on caching and display: not fetched.

---

## Threads (Meta)

### Takeaway
The Threads API's keyword search requires the `threads_keyword_search` permission via App Review. Without it, search returns only your own posts. The oEmbed is reportedly now tokenless: Meta's own WordPress plugin advertises "No access tokens". Embedding known post URLs is easy; discovery is gated by app review.

### Cited Findings
- `threads_basic` is required for all endpoints, and `threads_keyword_search` for the keyword search GET. Without approval, search covers only the authenticated user's posts; after approval, public posts — [Meta docs: Keyword Search](https://developers.facebook.com/docs/threads/keyword-search/).
- One report cites a cap of 500 keyword queries per rolling 7 days. The article is about 22 months old — [ppc.land](https://ppc.land/meta-introduces-new-search-and-analytics-features-to-threads-api-platform/).
- oEmbed requirements conflict:
  - The official plugin uses "Meta's tokenless oEmbed APIs… No access tokens or configuration required" — [facebook/meta-embeds-for-wordpress](https://github.com/facebook/meta-embeds-for-wordpress).
  - Older guides say an app token and `threads_basic` with advanced access are required — [Bluehost](https://www.bluehost.com/blog/meta-oembed-read-explained/); [ppc.land](https://ppc.land/meta-introduces-new-search-and-analytics-features-to-threads-api-platform/).

### Inferences
- Use oEmbed for curated or search-engine-found Threads posts. Apply for keyword search only if Threads volume justifies the app review.
- Threads federates opted-in users' posts over ActivityPub [background, unverified 2026]. So some Threads posts appear on Mastodon instances and can be fetched via Mastodon APIs, though only from users who opted in.

### Gaps
- Current federation status and scope (replies, two-way) as of 2026: not verified.

---

## Mastodon and the fediverse

### Takeaway
Mastodon has the most generous no-auth public APIs:
- trends for tags, statuses and links;
- the tag timeline;
- an oEmbed.

Fediverse norms are hostile to scraping and aggregation, though, so the respectful use is to query a few large or film-friendly instances' **trends** and **tag timelines**, filter strictly, honor opt-outs, and embed rather than copy.

### Cited Findings
- `/api/v1/trends/tags` and `/api/v1/trends/statuses` are publicly reachable. Disabling unauthenticated public timelines does not hide trends — [bentasker.co.uk](https://www.bentasker.co.uk/posts/blog/security/restricting-unauthenticated-access-to-mastodons-public-feeds.html).
- A status trends only if it is:
  - public and discoverable,
  - not silenced or sensitive,
  - without a content warning (CW),
  - not a reply,
  - in a valid locale.
  Unauthenticated trend responses carry `Cache-Control: max-age=900, public` — [fedibird PR #186 (backport of Mastodon 4.2 public trends)](https://github.com/fedibird/mastodon/pull/186); controller source: [statuses_controller.rb](https://github.com/mastodon/mastodon/blob/main/app/controllers/api/v1/trends/statuses_controller.rb).
- The link timeline only includes statuses from people who opted into discoverability. Unauthenticated full-text status search is not available — [Mastodon docs: timelines](https://docs.joinmastodon.org/methods/timelines/); [Mastodon docs: search](https://docs.joinmastodon.org/methods/search/).
- `indexable` is an account-level flag. Instances check it before full-text-indexing an account's statuses — [mastodon discussion #28674](https://github.com/mastodon/mastodon/discussions/28674).

### Inferences
- **Endpoints [background, per docs.joinmastodon.org/methods/trends and /methods/oembed]:**
  - `/api/v1/trends/links` (3.5+).
  - `/api/v1/timelines/tag/:hashtag` (public unless the admin disables it).
  - `/api/oembed?url=…`, which returns an iframe of `/@user/:id/embed`.
- **Trend moderation:** trends are admin-reviewed and moderated by default. That helps: trending statuses are already filtered for CWs and sensitive media.
- **Consent rules to adopt:**
  - Skip accounts with `discoverable: false`, `indexable: false`, or `#nobot`/`#noindex`/`#nosearch` in the bio.
  - Skip posts with a CW (spoiler_text) or `sensitive: true`.
  - Never store beyond a short cache.
  - Link back.
  - Use a clear User-Agent.
- **Film instances and tags:** film instances like mastodon.film / filmfans.club exist [background, unverified]. Common tags are #FilmMastodon, #Letterboxd and #TVTooter.

### Gaps
- Whether trends endpoints themselves honor `indexable`: no official statement found.
- Current list of active film instances: not verified.

---

## Lemmy and kbin/mbin

### Takeaway
Lemmy exposes a public REST API, `/api/v3/search`, that can be read without login. Volume for movies/TV is small (e.g. !movies@lemmy.world). Usable as a minor source with link-out; there is no official embed widget.

### Cited Findings
- SearXNG's Lemmy engine uses `https://lemmy.ml/api/v3/search` without auth — [SearXNG lemmy.py](https://gitea.zaclys.com/zaclys/searxng/raw/commit/32d52cd856b325eac01656ac3db15e5d47b4609e/searx/engines/lemmy.py).
- Multiple scrapers describe the v3 REST API as public and needing no login — [Apify lemmy-scraper](https://apify.com/dami_studio/lemmy-scraper.md).
- A 2026 advisory: private Lemmy instances exposed multi-community metadata without auth (a bug) — [GitLab advisory](https://advisories.gitlab.com/pkg/cargo/lemmy_api/).

### Gaps
- kbin is largely defunct and mbin is its successor [background, unverified]. No API research done.
- Lemmy v4/0.20 API changes and the NSFW flag name: not verified (posts have an `nsfw` boolean [background]).

---

## Tumblr

### Takeaway
Tumblr API v2 `/v2/tagged?tag=…&api_key=…` returns public tagged posts. Getting a key needs only an OAuth app registration, with no review. Tumblr is fandom-heavy and spoiler- and NSFW-prone. Native embed code exists per post. Treat it as a niche source.

### Cited Findings
- `api_key` is the app's OAuth consumer key. Tag queries take `tag`, `before`, and `limit` (1–50, legacy post format) — [Rtumblr docs](https://cloud.r-project.org/web/packages/Rtumblr/refman/Rtumblr.html); [Tumbloire](https://hexdocs.pm/tumbloire/Tumbloire.html).
- tumblr-js exposes `taggedPosts('tag', {limit, sort})` — [tumblr-js docs](https://tessl.io/registry/tessl/npm-tumblr-js/4.0.0/files/docs/tagged-and-generic.md).
- Keys come from tumblr.com/oauth/apps with no review process — [Apify actor docs](https://apify.com/xtracto/tumblr-blog-scraper.md).

### Gaps
- Embed code mechanics (`embed.tumblr.com/embed/post/…` [background]) and the state of Automattic's WordPress-backend migration (paused in 2025 [background]): not verified.

---

## Discord

### Takeaway
Not useful for public discussion embedding. The server widget shows only presence and an invite. Chat content is not public.

### Cited Findings
- Admins enable the widget in server settings and copy HTML or JSON. The JSON lives at `discord.com/api/guilds/{id}/widget.json` — [Discord blog](https://discord.com/blog/add-the-discord-widget-to-your-site); [is-pro.dev](https://is-pro.dev/tutorials/host-discord-widgets-on-subdomain/).
- The widget lists at most 100 members, and IDs were removed — [WordPress plugin](https://wordpress.org/plugins/?p=370124); [hedius/discordvoicestatus](https://hub.docker.com/r/hedius/discordvoicestatus).

### Gaps
- WidgetBot (a third-party live-chat embed, needs a bot in the server): not researched.

---

## Pinterest, Hacker News-style aggregators, Quora

### Takeaway
None of these are meaningful sources of "what people say" about titles.
- **Pinterest** is visual (pin embeds exist).
- **HN** rarely discusses specific films. The Algolia HN API is open (`hn.algolia.com/api/v1/search`) [background].
- **Quora** has no public API.

### Gaps
- Not researched in this session beyond background knowledge. Flag all as unverified.

---

## How others show "what people are saying", and moderation risk

### Takeaway
Google is the main precedent: Perspectives (May 2023), later reportedly a "Forums" filter, surfacing Reddit, Quora and others. Entertainment sites mostly embed curated individual posts rather than live streams. Moderation for GoodWatch must combine platform flags with spoiler heuristics:
- Reddit `spoiler`/`over_18`;
- Mastodon `sensitive`/`spoiler_text`;
- Bluesky labels;
- Lemmy `nsfw`.

### Cited Findings
- Google Perspectives launched in May 2023 to surface Reddit, YouTube, TikTok and similar posts. It was mobile first, with desktop later in 2023 — [TechCrunch, May 2023](https://techcrunch.com/2023/05/10/google-perspectives-integrates-reddit-youtube-tiktok-and-more-in-search-results); [9to5Google, Jun 2023](https://9to5google.com/2023/06/23/google-search-perspectives-filter/).
- Google tweaked ranking to help forum content rank (Nov 2023) — [TechCrunch](https://techcrunch.com/2023/11/27/googles-new-tools-help-discussion-forums-and-social-media-platforms-rank-higher-in-search-results).
- Google reportedly replaced Perspectives with a "Forums" filter in Mar 2024 — [onlinemarketing.de](https://onlinemarketing.de/seo/google-perspectives-zum-forums-filter). Single source.

### Inferences
- **No-API precedents:** the "Discussions and forums" SERP block and Google's Reddit deal mean Google itself is the de facto Reddit discovery layer. A search API (Google/Bing/Brave) scoped to `site:reddit.com` is a plausible discovery path that needs no Reddit API.
- **Spoiler filter recipe:**
  1. Drop any item carrying the platform's spoiler flag or CW.
  2. Drop posts younger than N days after an episode airs that contain episode-specific terms (character deaths, "ending").
  3. Prefer threads titled "Official Discussion" only behind a "spoilers" click-to-reveal.
  4. Always blur or flag NSFW.
  5. Exclude replies by default to reduce harassment exposure.

### Gaps
- JustWatch, Letterboxd and Rotten Tomatoes practices: not researched in this session.
  - Letterboxd shows its own reviews.
  - RT shows critic and audience reviews.
  - Neither embeds Reddit or X to the researcher's knowledge [background, unverified].
- No sources found on how other entertainment sites handled embed takedowns or harassment incidents.
